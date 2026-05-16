import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, PushSubscription, PushPreference
from ..deps import get_current_user
from ..config import settings

router = APIRouter(prefix="/push", tags=["push"])

FIELD_MAP = {
    "newMessage":        "new_message",
    "finalResponse":     "final_response",
    "documentRequested": "document_requested",
    "internalNote":      "internal_note",
    "mention":           "mention",
    "clientMsgUnread":   "client_msg_unread",
    "finalUnread":       "final_unread",
    "highOnly":          "high_only",
}


def _prefs_to_dict(p: PushPreference) -> dict:
    return {
        "newMessage":        p.new_message,
        "finalResponse":     p.final_response,
        "documentRequested": p.document_requested,
        "internalNote":      p.internal_note,
        "mention":           p.mention,
        "clientMsgUnread":   p.client_msg_unread,
        "finalUnread":       p.final_unread,
        "highOnly":          p.high_only,
    }


def _default_prefs() -> dict:
    return {
        "newMessage": True, "finalResponse": True, "documentRequested": True,
        "internalNote": True, "mention": True, "clientMsgUnread": True,
        "finalUnread": True, "highOnly": False,
    }


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=200)
def subscribe(
    body: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    endpoint = body.get("endpoint")
    p256dh   = body.get("p256dh")
    auth     = body.get("auth")
    if not endpoint or not p256dh or not auth:
        return {"ok": False, "error": "missing_fields"}

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.user_id    = current_user.id
        existing.p256dh     = p256dh
        existing.auth       = auth
        existing.user_agent = request.headers.get("user-agent")
    else:
        db.add(PushSubscription(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=request.headers.get("user-agent"),
        ))

    if not db.query(PushPreference).filter(PushPreference.user_id == current_user.id).first():
        db.add(PushPreference(id=str(uuid.uuid4()), user_id=current_user.id))

    db.commit()
    return {"ok": True}


@router.delete("/subscribe", status_code=200)
def unsubscribe(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    endpoint = body.get("endpoint")
    q = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id)
    if endpoint:
        q = q.filter(PushSubscription.endpoint == endpoint)
    q.delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.get("/preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(PushPreference).filter(PushPreference.user_id == current_user.id).first()
    return _prefs_to_dict(p) if p else _default_prefs()


@router.patch("/preferences", status_code=200)
def update_preferences(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(PushPreference).filter(PushPreference.user_id == current_user.id).first()
    if not p:
        p = PushPreference(id=str(uuid.uuid4()), user_id=current_user.id)
        db.add(p)

    for camel, snake in FIELD_MAP.items():
        if camel in body:
            setattr(p, snake, bool(body[camel]))

    db.commit()
    return {"ok": True}
