import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, OtpCode
from ..schemas import OtpSendRequest, OtpVerifyRequest
from ..sms_service import sms_otp, _e164
from typing import Optional

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

    now = datetime.utcnow()

    uid  = body.user_id or otp.user_id
    user: Optional[User] = db.query(User).filter(User.id == uid).first() if uid else None

    if user:
        if user.status == "LOCKED":
            raise HTTPException(status_code=403, detail="account_locked")
        if user.login_locked_until and user.login_locked_until > now:
            secs = int((user.login_locked_until - now).total_seconds())
            raise HTTPException(status_code=423, detail=f"temporarily_locked:{secs}")

    otp.attempts += 1

    if otp.code != body.code:
        if user:
            had_prev_lock = user.login_locked_until is not None
            user.login_failed_count = (user.login_failed_count or 0) + 1
            if otp.attempts >= OTP_MAX_ATTEMPTS:
                otp.used = True
            if user.login_failed_count >= 3:
                if had_prev_lock:
                    user.status = "LOCKED"
                    user.login_failed_count = 0
                    user.login_locked_until = None
                    db.commit()
                    raise HTTPException(status_code=403, detail="account_locked")
                else:
                    user.login_locked_until = now + timedelta(minutes=15)
                    user.login_failed_count = 0
                    db.commit()
                    raise HTTPException(status_code=423, detail="temporarily_locked:900")
            if otp.attempts >= OTP_MAX_ATTEMPTS:
                db.commit()
                raise HTTPException(status_code=400, detail="otp_max_attempts")
            remaining = min(3 - user.login_failed_count, OTP_MAX_ATTEMPTS - otp.attempts)
        else:
            if otp.attempts >= OTP_MAX_ATTEMPTS:
                otp.used = True
                db.commit()
                raise HTTPException(status_code=400, detail="otp_max_attempts")
            remaining = OTP_MAX_ATTEMPTS - otp.attempts
        db.commit()
        raise HTTPException(status_code=400, detail=f"otp_wrong:{remaining}")

    # Correct code — mark used and verify phone on user
    otp.used = True
    if user:
        user.phone_verified = True
        user.login_failed_count = 0
        user.login_locked_until = None
    db.commit()
    return {"verified": True}


@router.post("/resend")
def resend_otp(body: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Alias for /send — used for the resend button on the frontend."""
    return send_otp(body, background_tasks, db)
