from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from ..database import get_db
from ..models import Log, User
from ..deps import require_roles
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import datetime

router = APIRouter(prefix="/admin/logs", tags=["admin"])


class LogUserOut(BaseModel):
    first_name: str
    last_name: str
    role: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)


class LogOut(BaseModel):
    id: str
    action: str
    entity: Optional[str]
    entity_id: Optional[str]
    details: Optional[str]
    created_at: datetime
    user: Optional[LogUserOut] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)


class LogsPage(BaseModel):
    total: int
    items: list[LogOut]


@router.get("", response_model=LogsPage)
def list_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: Optional[str] = None,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    q = db.query(Log).options(joinedload(Log.user))
    if action:
        q = q.filter(Log.action.ilike(f"%{action}%"))
    total = q.count()
    items = q.order_by(Log.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": items}
