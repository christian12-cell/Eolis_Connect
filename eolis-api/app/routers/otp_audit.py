import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models import User, OtpCode
from ..deps import require_roles

router = APIRouter(prefix="/admin/otp-audit", tags=["otp-audit"])

OWNER_USERNAME = "Christian.DENMEKO"


@router.get("")
def get_otp_audit(
    search:    Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    page:      int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    if current_user.username != OWNER_USERNAME:
        raise HTTPException(status_code=403, detail="owner_only")

    now = datetime.utcnow()

    q = db.query(OtpCode).order_by(OtpCode.created_at.desc())

    if from_date:
        try:
            q = q.filter(OtpCode.created_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(OtpCode.created_at <= datetime.fromisoformat(to_date))
        except ValueError:
            pass

    if search:
        s = f"%{search}%"
        q = q.outerjoin(User, OtpCode.user_id == User.id).filter(
            or_(
                OtpCode.code.ilike(s),
                OtpCode.phone.ilike(s),
                User.username.ilike(s),
                User.first_name.ilike(s),
                User.last_name.ilike(s),
            )
        )

    total = q.count()
    rows  = q.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for o in rows:
        is_2fa   = o.phone.startswith("2fa:")
        phone_display = None if is_2fa else o.phone
        expired  = o.expires_at < now
        if o.used:
            status = "used"
        elif expired:
            status = "expired"
        else:
            status = "active"

        items.append({
            "id":        o.id,
            "code":      o.code,
            "type":      "2fa" if is_2fa else "phone",
            "phone":     phone_display,
            "status":    status,
            "attempts":  o.attempts,
            "createdAt": o.created_at.isoformat() + "Z",
            "expiresAt": o.expires_at.isoformat() + "Z",
            "user": {
                "id":        o.user.id        if o.user else None,
                "username":  o.user.username  if o.user else None,
                "firstName": o.user.first_name if o.user else None,
                "lastName":  o.user.last_name  if o.user else None,
            } if o.user else None,
        })

    return {
        "total":    total,
        "page":     page,
        "pageSize": page_size,
        "pages":    math.ceil(total / page_size) if total > 0 else 1,
        "items":    items,
    }
