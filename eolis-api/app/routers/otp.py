import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, OtpCode
from ..schemas import OtpSendRequest, OtpVerifyRequest
from ..sms_service import sms_otp, _e164
from ..email_service import send_welcome_client
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
    first_verification = user and not user.phone_verified
    if user:
        user.phone_verified = True
        user.login_failed_count = 0
        user.login_locked_until = None
    db.commit()

    # Send welcome email only on first phone verification (new registration)
    if first_verification and user and user.role == "CLIENT":
        background_tasks.add_task(
            send_welcome_client,
            user.email, user.first_name, user.username, "", user.language or "fr"
        )

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
    db.query(OtpCode).filter(OtpCode.phone == phone, OtpCode.used == False).update({"used": True})
    code = _generate_code()
    otp = OtpCode(user_id=user.id, phone=phone, code=code,
                  expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES))
    db.add(otp)
    db.commit()
    background_tasks.add_task(sms_otp, phone, code)

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
    otp = (db.query(OtpCode)
           .filter(OtpCode.phone == phone, OtpCode.used == False,
                   OtpCode.expires_at > datetime.utcnow())
           .order_by(OtpCode.created_at.desc()).first())

    if not otp:
        raise HTTPException(400, "otp_expired")

    otp.attempts += 1
    if otp.code != code:
        if otp.attempts >= OTP_MAX_ATTEMPTS:
            otp.used = True
            db.commit()
            raise HTTPException(400, "otp_max_attempts")
        remaining = OTP_MAX_ATTEMPTS - otp.attempts
        db.commit()
        raise HTTPException(400, f"otp_wrong:{remaining}")

    otp.used = True
    first_verification = not user.phone_verified
    user.phone_verified = True
    user.login_failed_count = 0
    user.login_locked_until = None
    db.commit()

    if first_verification and user.role == "CLIENT":
        background_tasks.add_task(
            send_welcome_client,
            user.email, user.first_name, user.username, "", user.language or "fr"
        )
    return {"verified": True}
