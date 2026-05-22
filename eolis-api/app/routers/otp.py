from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, OtpCode
from ..schemas import OtpSendRequest, OtpVerifyRequest
from ..sms_service import _e164, verify_send, verify_check
from ..email_service import send_welcome_client
from typing import Optional

OTP_TTL_MINUTES = 10
_VERIFY_MARKER = "VERIFY"

router = APIRouter(prefix="/auth/otp", tags=["otp"])


def _normalize(phone: str) -> str:
    return _e164(phone)


@router.post("/send")
def send_otp(body: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    phone = _normalize(body.phone)
    if not phone.startswith("+"):
        raise HTTPException(status_code=400, detail="invalid_phone")

    db.query(OtpCode).filter(OtpCode.phone == phone, OtpCode.code == _VERIFY_MARKER, OtpCode.used == False).update({"used": True})
    db.add(OtpCode(user_id=body.user_id, phone=phone, code=_VERIFY_MARKER,
                   expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)))
    db.commit()
    background_tasks.add_task(verify_send, phone)
    return {"sent": True, "phone": phone}


@router.post("/verify")
def verify_otp(body: OtpVerifyRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    phone = _normalize(body.phone)

    result = verify_check(phone, body.code)
    if result == "canceled":
        raise HTTPException(status_code=400, detail="otp_expired")
    if result != "approved":
        raise HTTPException(status_code=400, detail="otp_wrong:2")

    audit = (db.query(OtpCode)
             .filter(OtpCode.phone == phone, OtpCode.code == _VERIFY_MARKER, OtpCode.used == False)
             .order_by(OtpCode.created_at.desc()).first())
    if audit:
        audit.used = True

    uid  = body.user_id
    user: Optional[User] = db.query(User).filter(User.id == uid).first() if uid else None

    first_verification = user and not user.phone_verified
    if user:
        user.phone_verified = True
        user.login_failed_count = 0
        user.login_locked_until = None
    if first_verification and user and user.role == "CLIENT":
        hint = user.pwd_hint or ""
        user.pwd_hint = None
        db.commit()
        background_tasks.add_task(send_welcome_client, user.email, user.first_name, user.username, hint, user.language or "fr")
    else:
        db.commit()

    return {"verified": True}


@router.post("/resend")
def resend_otp(body: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Alias for /send — used for the resend button on the frontend."""
    return send_otp(body, background_tasks, db)


@router.post("/phone-verify-init")
def phone_verify_init(body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Initiate phone verification from login page (phone_not_verified flow)."""
    username = body.get("username")
    if not username:
        raise HTTPException(400, "username_required")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(404, "not_found")
    if not user.phone:
        raise HTTPException(400, "no_phone")

    phone = _normalize(user.phone)
    db.query(OtpCode).filter(OtpCode.phone == phone, OtpCode.code == _VERIFY_MARKER, OtpCode.used == False).update({"used": True})
    db.add(OtpCode(user_id=user.id, phone=phone, code=_VERIFY_MARKER,
                   expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)))
    db.commit()
    background_tasks.add_task(verify_send, phone)

    p = user.phone
    masked = (p[:3] + '*' * max(1, len(p) - 6) + p[-3:]) if len(p) >= 7 else p
    return {"userId": user.id, "maskedPhone": masked}


@router.post("/phone-verify-confirm")
def phone_verify_confirm(body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Verify OTP code from login page phone_not_verified flow."""
    user_id = body.get("userId")
    code    = body.get("code", "").strip()
    if not user_id or not code:
        raise HTTPException(400, "missing_fields")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "not_found")
    if user.phone_verified:
        return {"verified": True}

    phone = _normalize(user.phone)
    result = verify_check(phone, code)
    if result == "canceled":
        raise HTTPException(400, "otp_expired")
    if result != "approved":
        raise HTTPException(400, "otp_wrong:2")

    audit = (db.query(OtpCode)
             .filter(OtpCode.phone == phone, OtpCode.code == _VERIFY_MARKER, OtpCode.used == False)
             .order_by(OtpCode.created_at.desc()).first())
    if audit:
        audit.used = True

    first_verification = not user.phone_verified
    user.phone_verified = True
    user.login_failed_count = 0
    user.login_locked_until = None
    if first_verification and user.role == "CLIENT":
        hint = user.pwd_hint or ""
        user.pwd_hint = None
        db.commit()
        background_tasks.add_task(send_welcome_client, user.email, user.first_name, user.username, hint, user.language or "fr")
    else:
        db.commit()

    return {"verified": True}
