"""Shared credit helpers — imported by bl.py, whisper.py, credits.py."""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from .models import CreditBalance

CREDITS_PER_EXTRACTION = 50.0
CREDITS_PER_VOICE_MINUTE = 10.0
FREE_CREDITS_ON_SIGNUP = 100.0
CREDITS_INFO_PREMIUM_OPENING = 5.0
CREDITS_PER_SMS = 160.0


def get_or_create_balance(client_id: str, db: Session) -> CreditBalance:
    bal = db.query(CreditBalance).filter(CreditBalance.client_id == client_id).first()
    if not bal:
        bal = CreditBalance(client_id=client_id, credits_total=0.0, credits_used=0.0)
        db.add(bal)
        db.flush()
    return bal


def credits_remaining(client_id: str, db: Session) -> float:
    bal = db.query(CreditBalance).filter(CreditBalance.client_id == client_id).first()
    if not bal:
        return 0.0
    return max(0.0, bal.credits_total - bal.credits_used)


def check_credits(client_id: str, required: float, db: Session) -> None:
    rem = credits_remaining(client_id, db)
    if rem < required:
        raise HTTPException(402, "insufficient_credits")


def deduct_credits(client_id: str, amount: float, db: Session) -> float:
    """Deduct credits and return new remaining balance. Caller must commit."""
    bal = db.query(CreditBalance).filter(CreditBalance.client_id == client_id).with_for_update().first()
    if not bal:
        raise HTTPException(402, "insufficient_credits")
    bal.credits_used = min(bal.credits_total, bal.credits_used + amount)
    db.add(bal)
    return max(0.0, bal.credits_total - bal.credits_used)
