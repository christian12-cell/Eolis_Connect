from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..deps import require_roles
from ..config import settings

router = APIRouter(prefix="/sessions", tags=["sessions"])

SESSION_HOURS = settings.ACCESS_TOKEN_EXPIRE_HOURS
ONLINE_THRESHOLD_SEC = 5 * 60    # 5 minutes = "en ligne"
ACTIVE_THRESHOLD_SEC = 30 * 60   # 30 minutes = "actif récemment"


@router.get("")
def get_sessions(
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.status.in_(["ACTIVE", "PENDING"]))
        .order_by(User.last_active_at.desc().nullslast())
        .all()
    )
    now = datetime.utcnow()
    result = []
    for u in users:
        last_active_sec = (now - u.last_active_at).total_seconds() if u.last_active_at else None
        is_online  = last_active_sec is not None and last_active_sec < ONLINE_THRESHOLD_SEC
        is_active  = last_active_sec is not None and last_active_sec < ACTIVE_THRESHOLD_SEC and not is_online

        token_expires_at = (u.last_login_at + timedelta(hours=SESSION_HOURS)) if u.last_login_at else None
        time_remaining   = max(0, (token_expires_at - now).total_seconds()) if token_expires_at else None
        token_expired    = token_expires_at is not None and token_expires_at < now

        result.append({
            "id":                u.id,
            "firstName":         u.first_name,
            "lastName":          u.last_name,
            "username":          u.username,
            "role":              u.role,
            "status":            u.status,
            "lastLoginAt":       u.last_login_at.isoformat() + "Z"  if u.last_login_at  else None,
            "lastActiveAt":      u.last_active_at.isoformat() + "Z" if u.last_active_at else None,
            "tokenExpiresAt":    token_expires_at.isoformat() + "Z"  if token_expires_at else None,
            "timeRemainingSeconds": time_remaining,
            "isOnline":          is_online,
            "isActive":          is_active,
            "tokenExpired":      token_expired,
        })
    return result
