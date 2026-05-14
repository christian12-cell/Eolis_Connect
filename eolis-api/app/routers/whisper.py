import io
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, AIUsage, SystemConfig
from ..deps import get_current_user
from ..config import settings
from ..credit_service import credits_remaining, deduct_credits, CREDITS_PER_VOICE_MINUTE

router = APIRouter(prefix="/whisper", tags=["whisper"])

_WHISPER_PRICE_PER_MINUTE = 0.006


def _get_fcfa_rate(db: Session) -> float:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == "fcfa_rate").first()
    return float(cfg.value) if cfg else 600.0


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    ticket_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "CLIENT":
        raise HTTPException(403, "Clients uniquement")
    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "Service non configuré")

    if credits_remaining(current_user.id, db) <= 0:
        raise HTTPException(402, "insufficient_credits")

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(413, "Fichier audio trop volumineux (max 25 Mo)")
    if len(content) < 100:
        raise HTTPException(400, "Fichier audio trop court")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        audio_buf = io.BytesIO(content)
        audio_buf.name = file.filename or "recording.webm"
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_buf,
            response_format="verbose_json",
        )
        text = (transcript.text or "").strip()
        duration_seconds = getattr(transcript, "duration", None) or (len(content) / 2000)
    except Exception as e:
        raise HTTPException(503, f"Erreur de transcription : {e}")

    cost_usd = (duration_seconds / 60) * _WHISPER_PRICE_PER_MINUTE
    fcfa_rate = _get_fcfa_rate(db)
    cost_fcfa = cost_usd * fcfa_rate

    # Arrondi supérieur → toujours un entier (ex: 9.84s → 2 crédits, jamais 1.64)
    credits_cost = max(1, math.ceil((duration_seconds / 60) * CREDITS_PER_VOICE_MINUTE))

    usage = AIUsage(
        client_id=current_user.id,
        ticket_id=ticket_id,
        model="whisper-1",
        type="voice_transcription",
        input_tokens=0,
        output_tokens=0,
        cost_usd=cost_usd,
        cost_fcfa=cost_fcfa,
        fcfa_rate=fcfa_rate,
        credits_cost=float(credits_cost),
    )
    db.add(usage)
    credits_left = deduct_credits(current_user.id, credits_cost, db)
    db.commit()

    return {
        "text":             text,
        "durationSeconds":  round(duration_seconds, 1),
        "creditsUsed":      credits_cost,
        "creditsRemaining": int(credits_left),
        "costFcfa":         round(cost_fcfa, 4),
    }
