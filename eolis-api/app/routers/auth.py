import re
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..limiter import limiter
from ..models import User, Log, AccountSetupToken, CreditBalance
from ..credit_service import FREE_CREDITS_ON_SIGNUP
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from ..security import hash_password, verify_password, create_access_token
from ..deps import get_current_user
from ..config import settings
from ..email_service import send_welcome_email, send_welcome_client

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
    background_tasks.add_task(send_welcome_client, user.email, user.first_name, username)
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


@router.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return {"exists": True, "status": user.status}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
