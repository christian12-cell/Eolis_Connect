import re
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..limiter import limiter
from ..models import User, Log, AccountSetupToken, CreditBalance, PasswordReset
from ..credit_service import FREE_CREDITS_ON_SIGNUP
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from ..security import hash_password, verify_password, create_access_token
from ..deps import get_current_user
from ..config import settings
from ..email_service import send_welcome_email, send_welcome_client, send_password_reset
from ..sms_service import sms_password_reset

router = APIRouter(prefix="/auth", tags=["auth"])

def generate_username(first_name: str, last_name: str) -> str:
    def clean(s: str) -> str:
        import unicodedata
        s = unicodedata.normalize("NFD", s)
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return re.sub(r"[^a-zA-Z0-9]", "", s)
    # Take only the first word of each name (handles compound African names)
    first = clean(first_name.strip().split()[0] if first_name.strip() else first_name)
    last  = clean(last_name.strip().split()[0]  if last_name.strip()  else last_name)
    return f"{first[0].upper()}{first[1:].lower()}.{last.upper()}"


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if user.status in ("REJECTED", "SUSPENDED"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="blocked")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong_password")

    user.last_login_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id, "role": user.role, "username": user.username}, role=user.role)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")

    username = generate_username(body.first_name, body.last_name)
    if db.query(User).filter(User.username == username).first():
        import random
        username = f"{username}{random.randint(100, 999)}"

    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        username=username,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role="CLIENT",
        status="ACTIVE",
        language=body.language,
    )
    db.add(user)
    db.flush()
    db.add(Log(user_id=user.id, action="REGISTER", entity="User", entity_id=user.id, details=f"New registration — @{username}"))
    db.add(CreditBalance(client_id=user.id, credits_total=FREE_CREDITS_ON_SIGNUP, credits_used=0.0))
    db.commit()
    pwd_hint = "●" * max(4, len(body.password) - 2) + body.password[-2:]
    background_tasks.add_task(send_welcome_client, user.email, user.first_name, username, pwd_hint, user.language or "fr")
    # Welcome SMS is sent after OTP verification, not here
    return {"success": True, "userId": user.id, "username": username}


@router.get("/account-setup/{token}")
def get_account_setup(token: str, db: Session = Depends(get_db)):
    setup = db.query(AccountSetupToken).filter(AccountSetupToken.token == token).first()
    if not setup:
        raise HTTPException(status_code=404, detail="not_found")
    if setup.used_at:
        raise HTTPException(status_code=410, detail="already_used")
    if datetime.utcnow() > setup.expires_at:
        raise HTTPException(status_code=410, detail="expired")
    user = db.query(User).filter(User.id == setup.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    # Read before clearing
    temp_pw = setup.temp_password
    setup.used_at = datetime.utcnow()
    setup.temp_password = ""
    db.commit()
    return {"username": user.username, "tempPassword": temp_pw, "firstName": user.first_name}


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    user = db.query(User).filter(User.email == email, User.status == "ACTIVE").first()
    if user:
        # Invalidate any existing unused tokens
        db.query(PasswordReset).filter(PasswordReset.user_id == user.id, PasswordReset.used == False).update({"used": True})
        token = secrets.token_urlsafe(32)
        pr = PasswordReset(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=48),
        )
        db.add(pr)
        db.commit()
        _frontend = settings.ALLOWED_ORIGINS.split(",")[0].strip()
        lang = user.language or "fr"
        reset_url = f"{_frontend}/{lang}/reset-password?token={token}"
        background_tasks.add_task(send_password_reset, user.email, user.first_name, reset_url, lang)
        # Send SMS to the phone provided (allows updated phone numbers)
        sms_to = phone or user.phone
        if sms_to:
            background_tasks.add_task(sms_password_reset, sms_to, user.first_name, reset_url, lang)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(body: dict, db: Session = Depends(get_db)):
    token    = (body.get("token") or "").strip()
    password = (body.get("password") or "").strip()
    if not token or not password:
        raise HTTPException(400, "missing_fields")
    pr = db.query(PasswordReset).filter(PasswordReset.token == token).first()
    if not pr:
        raise HTTPException(404, "invalid_token")
    if pr.used:
        raise HTTPException(410, "already_used")
    if datetime.utcnow() > pr.expires_at:
        pr.used = True
        db.commit()
        raise HTTPException(410, "expired")
    user = db.query(User).filter(User.id == pr.user_id).first()
    if not user:
        raise HTTPException(404, "user_not_found")
    user.password_hash = hash_password(password)
    pr.used = True
    db.commit()
    return {"ok": True}


@router.patch("/update-contact")
def update_contact(body: dict, db: Session = Depends(get_db)):
    """Allow a newly registered user to fix their phone/email within 1h of creation."""
    user_id = body.get("userId")
    if not user_id:
        raise HTTPException(400, "userId_required")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "not_found")
    if (datetime.utcnow() - user.created_at).total_seconds() > 3600:
        raise HTTPException(403, "too_late")
    phone = body.get("phone")
    email = body.get("email")
    if phone:
        user.phone = phone
        user.phone_verified = False
    if email:
        if db.query(User).filter(User.email == email, User.id != user_id).first():
            raise HTTPException(409, "email_taken")
        user.email = email
    db.commit()
    return {"ok": True}


@router.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return {"exists": True, "status": user.status}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
