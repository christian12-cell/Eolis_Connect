import json
import logging
from sqlalchemy.orm import Session
from .config import settings
from .models import PushSubscription, PushPreference

logger = logging.getLogger(__name__)

# Maps notification type → preference field name
PREF_FIELD: dict[str, str] = {
    "NEW_MESSAGE":       "new_message",
    "FINAL_RESPONSE":    "final_response",
    "DOCUMENT_REQUEST":  "document_requested",
    "INTERNAL_NOTE":     "internal_note",
    "MENTION":           "mention",
    "CLIENT_MSG_UNREAD": "client_msg_unread",
    "FINAL_UNREAD":      "final_unread",
    "DOCS_SUBMITTED":    "new_message",
}


def send_push_to_user(
    db: Session,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    url: str = "/",
    urgency: str | None = None,
) -> None:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    # Check preferences
    pref = db.query(PushPreference).filter(PushPreference.user_id == user_id).first()
    if pref:
        field = PREF_FIELD.get(notif_type, "new_message")
        if not getattr(pref, field, True):
            return
        if pref.high_only and urgency and urgency != "HIGH":
            return

    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    # VAPID_PRIVATE_KEY is a raw base64url-encoded 32-byte P-256 scalar
    private_key = settings.VAPID_PRIVATE_KEY
    payload = json.dumps({"title": title, "body": body, "url": url})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
            )
        except WebPushException as exc:
            if exc.response is not None and exc.response.status_code in (404, 410):
                # Subscription expired or invalid — clean up
                db.delete(sub)
                try:
                    db.commit()
                except Exception:
                    db.rollback()
            else:
                logger.warning("WebPush failed user=%s: %s", user_id, exc)
        except Exception as exc:
            logger.warning("WebPush unexpected error user=%s: %s", user_id, exc)
