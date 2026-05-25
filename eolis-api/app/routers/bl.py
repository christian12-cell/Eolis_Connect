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

EAGLE_BL_PROMPT = """Tu es un expert en documents de transport maritime.
Analyse ce document "Booking Confirmation" émis par Eagle (Europe Africa Global Line Express) pour Eolis Cameroun.

Extrais UNIQUEMENT les informations présentes dans le texte fourni. N'invente aucune valeur.
Si un champ est absent ou illisible dans le document, mets null.
Réponds UNIQUEMENT avec le JSON strict ci-dessous, sans texte ni balises markdown.

{
  "booking_no": "numéro de booking tel qu'il apparaît dans le document",
  "customer_ref": "référence client ou null",
  "date": "date du document au format YYYY-MM-DD",
  "service": "service logistique tel qu'il apparaît dans le document",

  "booking_party": {
    "name": "nom de l'entreprise ou du particulier",
    "region": "région / ville",
    "email": "adresse email ou null",
    "bp": "boîte postale ou null"
  },

  "vessel": "nom du navire tel qu'il apparaît dans le document",
  "voyage": "numéro de voyage tel qu'il apparaît dans le document",
  "ets": "date de départ ETS au format YYYY-MM-DD",
  "eta": "date d'arrivée ETA au format YYYY-MM-DD",
  "port_of_loading": "port de chargement tel qu'il apparaît dans le document",
  "port_of_discharge": "port de déchargement tel qu'il apparaît dans le document",
  "place_of_receipt": "lieu de réception ou null",
  "place_of_delivery": "lieu de livraison ou null",

  "pickup": {
    "reference": "pickup reference tel qu'il apparaît dans le document",
    "quantity": "quantité entier ou null",
    "size_type": "type et taille du conteneur tel qu'il apparaît dans le document",
    "depot": "dépôt ou null",
    "container_usage": "usage du conteneur ou null",
    "release_date": "date mise à disposition ou null"
  },

  "turn_in": {
    "reference": "turn in reference tel qu'il apparaît dans le document",
    "terminal": "terminal tel qu'il apparaît dans le document",
    "terminal_closing": "date/heure fermeture terminal ou null",
    "vgm_closing": "date/heure fermeture VGM ou null",
    "customs_closing": "date/heure fermeture douanes ou null"
  },

  "booking_items": [
    {
      "item": "numéro item",
      "no_of_packs": "nombre de colis entier",
      "kind_of_pack": "type de colis tel qu'il apparaît dans le document",
      "description_of_goods": "description des marchandises telle qu'elle apparaît dans le document",
      "liner_terms": "conditions liner telles qu'elles apparaissent dans le document",
      "imo": "code IMO tel qu'il apparaît dans le document",
      "gross_weight_tons": "poids brut en tonnes",
      "measurement_cbm": "mesure en CBM"
    }
  ],

  "container_details": [
    {
      "container_no": "numéro de conteneur ou null si absent",
      "set_point": "température de consigne ou null",
      "vent": "ventilation ou null",
      "drains": "drains ou null",
      "humidity": "humidité ou null",
      "remarks": "remarques conteneur ou null"
    }
  ],

  "remarks": "remarques générales ou null"
}"""


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
