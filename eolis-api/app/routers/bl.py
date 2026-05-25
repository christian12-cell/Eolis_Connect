import base64
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, BLDocument, AIUsage, SystemConfig
from ..deps import get_current_user
from ..config import settings
from ..credit_service import check_credits, deduct_credits, CREDITS_PER_EXTRACTION

router = APIRouter(prefix="/bl", tags=["bl"])

# gpt-4o-mini pricing (USD per 1M tokens) — update here if OpenAI changes rates
_INPUT_PRICE_PER_1M  = 0.150
_OUTPUT_PRICE_PER_1M = 0.600

def _get_fcfa_rate(db: Session) -> float:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == "fcfa_rate").first()
    return float(cfg.value) if cfg else 600.0

EAGLE_BL_PROMPT = """Tu es un expert en documents de transport maritime Eagle (Europe Africa Global Line Express).
Tu reçois les images d'une "Booking Confirmation" émise pour Eolis Cameroun.

RÈGLES ABSOLUES :
1. Extrais UNIQUEMENT ce qui est visible et lisible dans le document. N'invente et ne déduis rien.
2. Si un champ est absent, vide ou illisible : mets null (valeur JSON null, pas une chaîne).
3. Les dates du document sont au format DD.MM.YY — convertis-les systématiquement en YYYY-MM-DD.
4. Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte d'introduction ni balises markdown.

FORMATS ATTENDUS (pour t'aider à lire les scans) :
- "voyage" : format attendu 7 chiffres suivis de la lettre N, commençant par l'année (ex: 26XXXXXN pour 2026). Utilise ce format comme guide de lecture. Si le scan est trop flou pour lire un chiffre avec certitude, mets null plutôt que de deviner.
- "booking_no" : commence par 2 lettres majuscules (ex: EA, XX, FA) suivies de chiffres puis un code port (ex: DLA) puis des lettres.
- "customer_ref" : ce champ est PRESQUE TOUJOURS vide sur les BL Eagle. Il ne contient jamais un nom de ville. Si tu vois "DOUALA" ou une autre ville near "Customer Ref", c'est le champ Service ou une adresse — mets null dans customer_ref.
- "service" : valeur textuelle comme "CAM NORTH". Une ville (ex: DOUALA) peut apparaître sur la même ligne ou en dessous mais elle n'est PAS la valeur de service.

STRUCTURE DU DOCUMENT (certaines sections peuvent être absentes) :
- En-tête : Booking Party, Date, Booking no., Customer Ref, Service
- Navire : Vessel, Voyage, ETS, ETA, Port of loading, Port of discharge, Place of receipt, Place of Delivery
- Référence conteneur : soit "Pickup reference/depot" (BL standard), soit "Reference" (BL bananes — contient aussi Commodity et Shipper)
- Turn in location : Turn in Reference, Terminal, Terminal/VGM/Customs Closing Date/Time
- Booking items : tableau avec Item, No. of Pack., Kind of Pack., Description of Goods, Liner terms, IMO, Grossweight [tons], Measurem. [cbm]
- Container Details (optionnel, présent sur les BL reefer ou avec conteneur nommé) : Container no, Set Point, Vent, Drains, Humidity, Reefer Remarks
- Remarks

{
  "booking_no": "numéro de booking",
  "customer_ref": "référence client ou null",
  "date": "date du document YYYY-MM-DD",
  "service": "service logistique",

  "booking_party": {
    "name": "nom de l'entreprise ou du particulier, ou null si illisible",
    "region": "région ou ville, ou null si illisible",
    "email": "adresse email ou null",
    "bp": "boîte postale ou null"
  },

  "vessel": "nom du navire",
  "voyage": "numéro de voyage",
  "ets": "date ETS YYYY-MM-DD",
  "eta": "date ETA YYYY-MM-DD",
  "port_of_loading": "port de chargement",
  "port_of_discharge": "port de déchargement",
  "place_of_receipt": "lieu de réception ou null",
  "place_of_delivery": "lieu de livraison ou null",

  "pickup": {
    "reference": "valeur du champ Reference ou Pickup Reference, ou null si section absente",
    "quantity": "quantité entier ou null",
    "size_type": "type et taille du conteneur ou null",
    "depot": "dépôt ou null",
    "commodity": "code commodity ou null (présent uniquement sur les BL bananes/PHP)",
    "shipper": "nom du shipper ou null (présent uniquement sur les BL bananes/PHP)",
    "container_usage": "usage du conteneur ou null",
    "release_date": "date de mise à disposition ou null"
  },

  "turn_in": {
    "reference": "turn in reference ou null",
    "terminal": "terminal ou null",
    "terminal_closing": "date/heure fermeture terminal ou null",
    "vgm_closing": "date/heure fermeture VGM ou null",
    "customs_closing": "date/heure fermeture douanes ou null"
  },

  "booking_items": [
    {
      "item": "numéro item",
      "no_of_packs": "nombre de colis ou de conteneurs, entier",
      "kind_of_pack": "type de colis ou type de conteneur tel qu'il apparaît",
      "description_of_goods": "description des marchandises telle qu'elle apparaît",
      "liner_terms": "conditions liner (FIFO, FILO, LIFO...)",
      "imo": "code IMO ou null",
      "gross_weight_tons": "poids brut en tonnes tel qu'il apparaît (peut être 0.0)",
      "measurement_cbm": "mesure en CBM telle qu'elle apparaît (peut être 0.00)"
    }
  ],

  "container_details": [],

  "remarks": "remarques générales ou null"
}

RÈGLES SPÉCIFIQUES :
- "container_details" : si la section "Container Details" est présente, remplace [] par un tableau avec un objet par ligne du tableau. Format de chaque objet : {"container_no": "numéro ou null", "set_point": "température avec unité ou null", "vent": "valeur ou null", "drains": "valeur ou null", "humidity": "valeur ou null", "remarks": "remarques ou null"}. Si la section est absente, laisse [].
- "booking_party" : sur les documents scannés la zone client peut être illisible. Mets null pour chaque champ que tu ne peux pas lire avec certitude.
- "pickup.commodity" et "pickup.shipper" : extrais ces champs uniquement si le document contient une section "Reference" avec les colonnes Commodity et Shipper (cas des BL bananes PHP).
- Si "No. of Pack." contient un nombre avec une virgule comme séparateur de milliers (ex: 1,687), extrait-le comme entier 1687."""


def _pdf_to_images(content: bytes) -> list[str]:
    """Convert each PDF page to a base64-encoded PNG using PyMuPDF."""
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=content, filetype="pdf")
        images = []
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        doc.close()
        if not images:
            raise HTTPException(400, "Le PDF est vide ou illisible")
        return images
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Impossible de lire le PDF : {e}")


def _call_gpt(images: list[str]) -> tuple[dict, int, int]:
    """Send PDF pages as images to GPT-4o-mini vision. Returns (parsed_data, in_tok, out_tok)."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "GPT non configuré — ajoutez OPENAI_API_KEY dans les variables Railway")
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        user_content: list[dict] = [{"type": "text", "text": "Voici le document à analyser :"}]
        for img_b64 in images:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{img_b64}", "detail": "high"},
            })

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": EAGLE_BL_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0,
            max_tokens=2000,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw
        data = json.loads(raw)
        in_tok  = resp.usage.prompt_tokens     if resp.usage else 0
        out_tok = resp.usage.completion_tokens if resp.usage else 0
        return data, in_tok, out_tok
    except json.JSONDecodeError as e:
        raise HTTPException(422, f"Erreur de parsing GPT : {e}")
    except Exception as e:
        raise HTTPException(503, f"Erreur GPT : {e}")


@router.post("/extract")
async def extract_bl(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "CLIENT":
        raise HTTPException(403, "Clients uniquement")

    check_credits(current_user.id, CREDITS_PER_EXTRACTION, db)

    content = await file.read()
    images = _pdf_to_images(content)
    data, in_tok, out_tok = _call_gpt(images)

    # Données complètes sauvegardées dans vessel_data
    extra = {
        "date":             data.get("date"),
        "service":          data.get("service"),
        "customer_ref":     data.get("customer_ref"),
        "booking_party":    data.get("booking_party"),
        "place_of_receipt": data.get("place_of_receipt"),
        "place_of_delivery":data.get("place_of_delivery"),
        "pickup":           data.get("pickup"),
        "turn_in":          data.get("turn_in"),
        "booking_items":    data.get("booking_items"),
        "container_details":data.get("container_details"),
        "eta":              data.get("eta"),
        "port_of_loading":  data.get("port_of_loading"),
        "port_of_discharge":data.get("port_of_discharge"),
        "remarks":          data.get("remarks"),
    }

    first_item = (data.get("booking_items") or [{}])[0]
    desc_goods = first_item.get("description_of_goods") or ""
    size_type  = (data.get("pickup") or {}).get("size_type") or ""

    bl = BLDocument(
        client_id=current_user.id,
        filename=file.filename,
        booking_no=data.get("booking_no"),
        vessel=data.get("vessel"),
        voyage=data.get("voyage"),
        ets=data.get("ets"),
        eta=data.get("eta"),
        port_of_loading=data.get("port_of_loading"),
        port_of_discharge=data.get("port_of_discharge"),
        description_of_goods=desc_goods,
        vessel_data=json.dumps(extra, ensure_ascii=False),
        raw_extracted=json.dumps(data, ensure_ascii=False),
    )
    db.add(bl)
    db.flush()  # get bl.id without committing

    # Calculate cost and persist AI usage
    fcfa_rate = _get_fcfa_rate(db)
    cost_usd  = (in_tok * _INPUT_PRICE_PER_1M + out_tok * _OUTPUT_PRICE_PER_1M) / 1_000_000
    cost_fcfa = cost_usd * fcfa_rate
    ai_usage  = AIUsage(
        client_id=current_user.id,
        bl_document_id=bl.id,
        model="gpt-4o-mini",
        type="bl_extraction",
        input_tokens=in_tok,
        output_tokens=out_tok,
        cost_usd=cost_usd,
        cost_fcfa=cost_fcfa,
        fcfa_rate=fcfa_rate,
        credits_cost=CREDITS_PER_EXTRACTION,
    )
    db.add(ai_usage)
    deduct_credits(current_user.id, CREDITS_PER_EXTRACTION, db)
    db.commit()
    db.refresh(bl)
    db.refresh(ai_usage)

    return {
        "bl_id":       bl.id,
        "ai_usage_id": ai_usage.id,
        "cost_usd":    round(cost_usd, 8),
        "cost_fcfa":   round(cost_fcfa, 4),
        "raw":         data,
        "vesselData":  json.dumps(extra, ensure_ascii=False),
    }


@router.get("/{bl_id}/raw")
def get_bl_raw(
    bl_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bl = db.query(BLDocument).filter(BLDocument.id == bl_id, BLDocument.client_id == current_user.id).first()
    if not bl:
        raise HTTPException(404, "BL non trouvé")
    raw = json.loads(bl.raw_extracted) if bl.raw_extracted else {}
    return {"bl_id": bl.id, "raw": raw}


@router.get("/my-bls")
def list_my_bls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "CLIENT":
        raise HTTPException(403, "Clients uniquement")
    bls = (
        db.query(BLDocument)
        .filter(BLDocument.client_id == current_user.id)
        .order_by(BLDocument.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id":              b.id,
            "filename":        b.filename,
            "bookingNo":       b.booking_no,
            "vessel":          b.vessel,
            "voyage":          b.voyage,
            "ets":             b.ets,
            "portOfLoading":   b.port_of_loading,
            "portOfDischarge": b.port_of_discharge,
            "createdAt":       b.created_at.isoformat(),
        }
        for b in bls
    ]
