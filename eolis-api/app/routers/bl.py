import io
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, BLDocument
from ..deps import get_current_user
from ..config import settings

router = APIRouter(prefix="/bl", tags=["bl"])

EAGLE_BL_PROMPT = """Tu es un expert en documents de transport maritime.
Analyse ce document "Booking Confirmation" émis par Eagle (Europe Africa Global Line Express) pour Eolis Cameroun.

Ce document a toujours la même structure. Extrais les champs suivants en JSON strict.
Réponds UNIQUEMENT avec le JSON, sans texte ni balises markdown. Mets null pour tout champ absent ou vide.

{
  "booking_no": "numéro de booking (ex: EA2604921DLAPME)",
  "customer_ref": "référence client ou null",
  "date": "date du document au format YYYY-MM-DD",
  "service": "service (ex: CAM NORTH)",

  "booking_party": {
    "name": "nom de l'entreprise ou du particulier",
    "region": "région / ville Cameroun (ex: NGAOUNDERE CAMEROUN)",
    "email": "adresse email ou null",
    "bp": "boîte postale (ex: PO BOX 7253) ou null"
  },

  "vessel": "nom du navire (ex: Star First)",
  "voyage": "numéro de voyage (ex: 2620136N)",
  "ets": "date de départ ETS au format YYYY-MM-DD",
  "eta": "date d'arrivée ETA au format YYYY-MM-DD",
  "port_of_loading": "port de chargement (ex: DOUALA)",
  "port_of_discharge": "port de déchargement (ex: PORTSMOUTH)",
  "place_of_receipt": "lieu de réception ou null",
  "place_of_delivery": "lieu de livraison ou null",

  "pickup": {
    "reference": "pickup reference (ex: EA2604921DLAPME)",
    "quantity": "quantité entier (ex: 0 ou 2)",
    "size_type": "type et taille du conteneur (ex: 40' hc reefer, 20' dry)",
    "depot": "dépôt ou null",
    "container_usage": "usage du conteneur ou null",
    "release_date": "date mise à disposition ou null"
  },

  "turn_in": {
    "reference": "turn in reference",
    "terminal": "terminal (ex: TMFD Terminal / DOUALA)",
    "terminal_closing": "date/heure fermeture terminal ou null",
    "vgm_closing": "date/heure fermeture VGM ou null",
    "customs_closing": "date/heure fermeture douanes ou null"
  },

  "booking_items": [
    {
      "item": "numéro item",
      "no_of_packs": "nombre de colis (entier)",
      "kind_of_pack": "type de colis/conteneur",
      "description_of_goods": "description des marchandises (ex: Foodstuff)",
      "liner_terms": "conditions liner (ex: FILO)",
      "imo": "code IMO (O ou N)",
      "gross_weight_tons": "poids brut en tonnes (nombre)",
      "measurement_cbm": "mesure en CBM (nombre)"
    }
  ],

  "container_details": [
    {
      "container_no": "numéro de conteneur ou null si non attribué",
      "set_point": "température de consigne pour reefer (ex: -20.0 °C) ou null",
      "vent": "ventilation ou null",
      "drains": "drains ou null",
      "humidity": "humidité ou null",
      "remarks": "remarques conteneur ou null"
    }
  ],

  "remarks": "remarques générales ou null"
}"""


def _extract_pdf_text(content: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        raise HTTPException(400, f"Impossible de lire le PDF : {e}")


def _call_gpt(text: str) -> dict:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "GPT non configuré — ajoutez OPENAI_API_KEY dans les variables Railway")
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": EAGLE_BL_PROMPT},
                {"role": "user",   "content": f"Voici le contenu extrait du document :\n\n{text}"},
            ],
            temperature=0,
            max_tokens=2000,
        )
        raw = resp.choices[0].message.content.strip()
        # Nettoyer les éventuels blocs markdown ```json ... ```
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw
        return json.loads(raw)
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

    content = await file.read()
    text = _extract_pdf_text(content)
    data = _call_gpt(text)

    # Données extra sauvegardées dans vessel_data
    extra = {
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
    db.commit()
    db.refresh(bl)

    return {
        "bl_id": bl.id,
        "form_data": {
            "shipName":      data.get("vessel") or "",
            "voyageNumber":  data.get("voyage") or "",
            "shipDate":      data.get("ets") or "",
            "code":          data.get("booking_no") or "",
            "sizeType":      size_type,
            "description":   desc_goods,
        },
        "display": {
            "bookingNo":       data.get("booking_no"),
            "vessel":          data.get("vessel"),
            "voyage":          data.get("voyage"),
            "ets":             data.get("ets"),
            "eta":             data.get("eta"),
            "portOfLoading":   data.get("port_of_loading"),
            "portOfDischarge": data.get("port_of_discharge"),
            "bookingParty":    data.get("booking_party"),
            "sizeType":        size_type,
            "goodsDescription":desc_goods,
        },
        "vesselData": json.dumps(extra, ensure_ascii=False),
    }


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
