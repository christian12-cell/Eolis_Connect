from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SystemConfig
from ..deps import require_roles
from ..models import User

router = APIRouter(prefix="/admin/config", tags=["admin-config"])

ALLOWED_KEYS = {"fcfa_rate", "eur_rate"}

class ConfigUpdate(BaseModel):
    value: str


@router.get("")
def get_config(
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    rows = db.query(SystemConfig).all()
    config = {r.key: r.value for r in rows}
    # Defaults
    config.setdefault("fcfa_rate", "600")
    config.setdefault("eur_rate",  "655.957")
    return config


@router.patch("/{key}")
def update_config(
    key: str,
    body: ConfigUpdate,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    if key not in ALLOWED_KEYS:
        raise HTTPException(400, f"Clé inconnue : {key}")
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if row:
        row.value = body.value
        row.updated_at = datetime.utcnow()
    else:
        row = SystemConfig(key=key, value=body.value)
        db.add(row)
    db.commit()
    return {"key": key, "value": body.value}
