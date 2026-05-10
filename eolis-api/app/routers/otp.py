import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, OtpCode
from ..schemas import OtpSendRequest, OtpVerifyRequest
from ..sms_service import sms_otp, _e164

router = APIRouter(prefix="/auth/otp", tags=["otp"])

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 3


def _generate_code() -> str:
    return str(random.randint(100000, 999999))


def _normalize(phone: str) -> str:
    return _e164(phone)


@router.post("/send")
def send_otp(body: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    phone = _normalize(body.phone)
    if not phone.startswith("+"):
        raise HTTPException(status_code=400, detail="invalid_phone")

    # Invalidate any existing unused OTPs for this phone
    db.query(OtpCode).filter(
        OtpCode.phone == phone,
        OtpCode.used == False,
    ).update({"used": True})

    code = _generate_code()
    otp = OtpCode(
        user_id=body.user_id,
        phone=phone,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()

    background_tasks.add_task(sms_otp, phone, code)
    return {"sent": True, "phone": phone}


@router.post("/verify")
def verify_otp(body: OtpVerifyRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    phone = _normalize(body.phone)

    otp = (
        db.query(OtpCode)
        .filter(
            OtpCode.phone == phone,
            OtpCode.used == False,
            OtpCode.expires_at > datetime.utcnow(),
        )
        .order_by(OtpCode.created_at.desc())
        .first()
    )

    if not otp:
        raise HTTPException(status_code=400, detail="otp_expired")

    otp.attempts += 1
    if otp.attempts >= OTP_MAX_ATTEMPTS and otp.code != body.code:
        otp.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="otp_max_attempts")

    if otp.code != body.code:
        db.commit()
        remaining = OTP_MAX_ATTEMPTS - otp.attempts
        raise HTTPException(status_code=400, detail=f"otp_wrong:{remaining}")

    # Correct code — mark used and verify phone on user
    otp.used = True
    if body.user_id or otp.user_id:
        uid = body.user_id or otp.user_id
        user = db.query(User).filter(User.id == uid).first()
        if user:
            user.phone_verified = True
    db.commit()
    return {"verified": True}


@router.post("/resend")
def resend_otp(body: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Alias for /send — used for the resend button on the frontend."""
    return send_otp(body, background_tasks, db)
