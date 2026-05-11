import uuid, secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from ..database import get_db
from ..models import User, Ticket, Message, Notification, Attachment, SatisfactionRating, OtpCode, PasswordReset, Log, AccountSetupToken
from ..schemas import UserResponse, UserUpdateRequest, CreateUserRequest
from ..deps import get_current_user, require_roles
from ..security import hash_password, verify_password
from ..config import settings
from ..email_service import send_account_approved, send_account_rejected, send_account_created_by_admin, send_account_deleted
from ..sms_service import sms_account_approved, sms_account_rejected, sms_test, sms_account_deleted

router = APIRouter(prefix="/users", tags=["users"])

PHONE = '+33748523385'

_SEED = [
    dict(first_name='Christian', last_name='DENMEKO', username='Christian.DENMEKO',
         email='christian.denmeko@eoliscameroun.com', phone=PHONE,
         role='SYSTEM_ADMIN', status='ACTIVE', language='fr', raw_pw='Admin@2026!'),
]

STAFF = ("AGENT", "OPS_ADMIN", "SYSTEM_ADMIN")


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


@router.get("", response_model=list[UserResponse])
def list_users(current_user: User = Depends(require_roles("OPS_ADMIN", "SYSTEM_ADMIN")), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/staff/mentions")
def get_staff_for_mentions(
    current_user: User = Depends(require_roles(*STAFF)),
    db: Session = Depends(get_db),
):
    """Active staff list for @mention autocomplete in internal notes."""
    users = (
        db.query(User)
        .filter(User.status == "ACTIVE", User.role.in_(STAFF), User.id != current_user.id)
        .order_by(User.first_name)
        .all()
    )
    return [
        {"id": u.id, "username": u.username, "firstName": u.first_name, "lastName": u.last_name, "role": u.role}
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, current_user: User = Depends(require_roles(*STAFF)), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(body: UserUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    allowed = {"first_name", "last_name", "phone", "email", "language"}
    updates = body.model_dump(exclude_none=True, by_alias=False)
    for field, value in updates.items():
        if field in allowed:
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/password")
def change_my_password(body: PasswordChangeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="wrong_current_password")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.post("/admin/test-sms")
def test_sms(body: dict, background_tasks: BackgroundTasks, current_user: User = Depends(require_roles("SYSTEM_ADMIN"))):
    phone = body.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="phone_required")
    background_tasks.add_task(sms_test, phone)
    return {"sent": True, "to": phone}


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("OPS_ADMIN", "SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    prev_status = user.status
    updates = body.model_dump(exclude_none=True, by_alias=False)

    # Handle password reset separately
    new_pw = updates.pop('new_password', None)
    if new_pw:
        user.password_hash = hash_password(new_pw)

    # Handle username uniqueness check
    new_username = updates.get('username')
    if new_username and new_username != user.username:
        conflict = db.query(User).filter(User.username == new_username, User.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="username_taken")

    # Handle email uniqueness check
    new_email = updates.get('email')
    if new_email and new_email != user.email:
        conflict = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="email_taken")

    allowed = {'first_name', 'last_name', 'username', 'email', 'phone', 'role', 'status', 'language'}
    for field, value in updates.items():
        if field in allowed:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    _frontend = settings.ALLOWED_ORIGINS.split(",")[0].strip()
    login_url = f"{_frontend}/fr/login"
    if body.status == "ACTIVE" and prev_status == "PENDING":
        background_tasks.add_task(send_account_approved, user.email, user.first_name, user.username)
        if user.phone:
            background_tasks.add_task(sms_account_approved, user.phone, user.first_name, user.username, login_url)
    elif body.status == "REJECTED" and prev_status == "PENDING":
        background_tasks.add_task(send_account_rejected, user.email, user.first_name)
        if user.phone:
            background_tasks.add_task(sms_account_rejected, user.phone, user.first_name)
    return user


@router.post("/admin/create", response_model=UserResponse, status_code=201)
def admin_create_user(
    body: CreateUserRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """Create any user (any role). SYSTEM_ADMIN only."""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="username_taken")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="email_taken")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    u = User(
        id=str(uuid.uuid4()),
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        email=body.email,
        phone=body.phone,
        phone_verified=False,
        password_hash=hash_password(body.password),
        role=body.role,
        status='ACTIVE',
        language=body.language,
        created_at=now,
        updated_at=now,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    # Generate one-time setup token (48h, single-use)
    token = secrets.token_urlsafe(32)
    setup = AccountSetupToken(
        id=str(uuid.uuid4()),
        user_id=u.id,
        token=token,
        temp_password=body.password,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=48),
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(setup)
    db.commit()
    _frontend = settings.ALLOWED_ORIGINS.split(",")[0].strip()
    setup_url = f"{_frontend}/{body.language}/account-setup/{token}"
    background_tasks.add_task(send_account_created_by_admin, u.email, u.first_name, u.username, body.password, u.role, setup_url)
    return u


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """Delete a user account. Sends SMS + email to the deleted user."""
    from ..models import Ticket, Message, Notification, Attachment, SatisfactionRating, OtpCode, PasswordReset, Log
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="not_found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot_delete_self")

    # Save contact info before deletion
    email = user.email
    phone = user.phone
    first_name = user.first_name

    # Cascade-delete user data
    for ticket_id, in db.query(Ticket.id).filter((Ticket.client_id == user_id) | (Ticket.agent_id == user_id)).all():
        db.query(SatisfactionRating).filter(SatisfactionRating.ticket_id == ticket_id).delete()
        db.query(Attachment).filter(Attachment.ticket_id == ticket_id).delete()
        db.query(Message).filter(Message.ticket_id == ticket_id).delete()
        db.query(Notification).filter(Notification.ticket_id == ticket_id).delete()
    db.query(Ticket).filter((Ticket.client_id == user_id) | (Ticket.agent_id == user_id)).delete()
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(OtpCode).filter(OtpCode.user_id == user_id).delete()
    db.query(PasswordReset).filter(PasswordReset.user_id == user_id).delete()
    db.query(AccountSetupToken).filter(AccountSetupToken.user_id == user_id).delete()
    db.query(Log).filter(Log.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()

    # Notify the deleted user
    background_tasks.add_task(send_account_deleted, email, first_name)
    if phone:
        background_tasks.add_task(sms_account_deleted, phone, first_name)


@router.post("/admin/reset-db")
def reset_database(
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """Delete all operational data (tickets, messages, logs…). Never deletes user accounts. SYSTEM_ADMIN only."""
    # Delete operational data only — never users
    db.query(SatisfactionRating).delete()
    db.query(Attachment).delete()
    db.query(Message).delete()
    db.query(Notification).delete()
    db.query(OtpCode).delete()
    db.query(PasswordReset).delete()
    db.query(Log).delete()
    db.query(Ticket).delete()
    db.commit()

    return {"reset": True, "deleted": "operational_data_only"}
