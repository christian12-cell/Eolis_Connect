from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, MaintenanceSetting
from ..deps import require_roles

OWNER_USERNAME = "Christian.DENMEKO"

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

SINGLETON_ID = "singleton"


def _get_or_create(db: Session) -> MaintenanceSetting:
    row = db.query(MaintenanceSetting).filter(MaintenanceSetting.id == SINGLETON_ID).first()
    if not row:
        row = MaintenanceSetting(id=SINGLETON_ID, active=False)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ── Public endpoint — no auth required ────────────────────────────────────────

@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    """Public. Returns current maintenance state for the frontend check."""
    row = _get_or_create(db)
    return {
        "active":          row.active,
        "message":         row.message,
        "estimatedReturn": row.estimated_return.isoformat() + "Z" if row.estimated_return else None,
    }


# ── Admin endpoints ────────────────────────────────────────────────────────────

class ActivateBody(BaseModel):
    message: str
    estimated_return: Optional[str] = None  # ISO datetime string
    send_email: bool = True
    send_push:  bool = True
    send_sms:   bool = False


class DeactivateBody(BaseModel):
    return_message: Optional[str] = None
    send_email: bool = True
    send_push:  bool = True
    send_sms:   bool = False


def _require_owner(current_user: User):
    if current_user.username != OWNER_USERNAME:
        raise HTTPException(status_code=403, detail="owner_only")


@router.get("")
def get_settings(
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    _require_owner(current_user)
    row = _get_or_create(db)
    return {
        "active":          row.active,
        "message":         row.message,
        "estimatedReturn": row.estimated_return.isoformat() + "Z" if row.estimated_return else None,
        "updatedAt":       row.updated_at.isoformat() + "Z",
    }


@router.post("/activate")
def activate(
    body: ActivateBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    _require_owner(current_user)
    row = _get_or_create(db)
    row.active = True
    row.message = body.message
    row.estimated_return = datetime.fromisoformat(body.estimated_return) if body.estimated_return else None
    row.updated_at = datetime.utcnow()
    db.commit()

    eta_str = row.estimated_return.strftime("%d/%m/%Y %H:%M") if row.estimated_return else None

    if body.send_email or body.send_push or body.send_sms:
        background_tasks.add_task(
            _broadcast_maintenance_start,
            body.message, eta_str, body.send_email, body.send_push, body.send_sms,
        )

    return {"active": True}


@router.post("/deactivate")
def deactivate(
    body: DeactivateBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    _require_owner(current_user)
    row = _get_or_create(db)
    row.active = False
    row.updated_at = datetime.utcnow()
    db.commit()

    if body.send_email or body.send_push or body.send_sms:
        background_tasks.add_task(
            _broadcast_maintenance_end,
            body.return_message, body.send_email, body.send_push, body.send_sms,
        )

    return {"active": False}


# ── Broadcast helpers (run in background) ─────────────────────────────────────

def _broadcast_maintenance_start(
    message: str, eta_str: str | None,
    send_email: bool, send_push: bool, send_sms: bool,
):
    from ..database import SessionLocal
    from ..models import User as UserModel
    from ..email_service import send_maintenance_start
    from ..sms_service import sms_maintenance_start
    from ..push_service import broadcast_push

    if send_push:
        push_body = message[:100] + ("…" if len(message) > 100 else "")
        broadcast_push("🔧 Maintenance en cours", push_body, "/maintenance")

    if send_email or send_sms:
        with SessionLocal() as db:
            users = db.query(UserModel).filter(UserModel.status == "ACTIVE").all()
            for u in users:
                if send_email and u.email:
                    try:
                        send_maintenance_start(u.email, u.first_name, message, eta_str, u.language or "fr")
                    except Exception as exc:
                        print(f"[maintenance] email failed {u.email}: {exc}")
                if send_sms and u.phone:
                    try:
                        sms_maintenance_start(u.phone, u.first_name, eta_str)
                    except Exception as exc:
                        print(f"[maintenance] sms failed {u.phone}: {exc}")


def _broadcast_maintenance_end(
    return_message: str | None,
    send_email: bool, send_push: bool, send_sms: bool,
):
    from ..database import SessionLocal
    from ..models import User as UserModel
    from ..email_service import send_maintenance_end
    from ..sms_service import sms_maintenance_end
    from ..push_service import broadcast_push

    if send_push:
        push_body = return_message[:100] + ("…" if return_message and len(return_message) > 100 else "") if return_message else "La plateforme est de retour en ligne."
        broadcast_push("✅ Eolis Connect — Retour en ligne", push_body, "/")

    if send_email or send_sms:
        with SessionLocal() as db:
            users = db.query(UserModel).filter(UserModel.status == "ACTIVE").all()
            for u in users:
                if send_email and u.email:
                    try:
                        send_maintenance_end(u.email, u.first_name, return_message, u.language or "fr")
                    except Exception as exc:
                        print(f"[maintenance] email failed {u.email}: {exc}")
                if send_sms and u.phone:
                    try:
                        sms_maintenance_end(u.phone, u.first_name)
                    except Exception as exc:
                        print(f"[maintenance] sms failed {u.phone}: {exc}")
