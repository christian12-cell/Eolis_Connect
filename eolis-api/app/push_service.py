import json
import time
import logging
from sqlalchemy.orm import Session
from .config import settings
from .models import PushSubscription, PushPreference, Notification

logger = logging.getLogger(__name__)

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

# Délai avant envoi (secondes) — laisse le temps à mark-read de s'exécuter
# si l'utilisateur est déjà sur la page. Après ce délai, on vérifie si la
# notification est déjà lue avant d'envoyer vraiment le push.
PUSH_DELAY_SECONDS = 3


def send_push_to_user(
    db: Session,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    url: str = "/",
    urgency: str | None = None,
    ticket_id: str | None = None,
) -> None:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    # Vérifier les préférences (avec la session originale, avant le sleep)
    pref = db.query(PushPreference).filter(PushPreference.user_id == user_id).first()
    if pref:
        field = PREF_FIELD.get(notif_type, "new_message")
        if not getattr(pref, field, True):
            return
        if pref.high_only and urgency and urgency != "HIGH":
            return

    subs_list = [
        {"endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth, "id": s.id}
        for s in db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    ]
    if not subs_list:
        return

    # Délai : laisse le temps à mark-read de s'exécuter si l'user est sur la page
    time.sleep(PUSH_DELAY_SECONDS)

    # Après le délai, vérifier si la notif est déjà lue avec une session fraîche
    if ticket_id:
        from .database import SessionLocal
        check_db = SessionLocal()
        try:
            still_unread = check_db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.ticket_id == ticket_id,
                Notification.is_read == False,
            ).first()
            if not still_unread:
                return  # L'user était sur la page et a déjà lu — pas de push
        finally:
            check_db.close()

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    private_key = settings.VAPID_PRIVATE_KEY
    payload = json.dumps({"title": title, "body": body, "url": url, "ticketId": ticket_id})

    # Supprimer les subscriptions expirées via une session fraîche
    from .database import SessionLocal
    push_db = SessionLocal()
    try:
        for sub in subs_list:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=private_key,
                    vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
                )
            except WebPushException as exc:
                if exc.response is not None and exc.response.status_code in (400, 404, 410):
                    stale = push_db.query(PushSubscription).filter(
                        PushSubscription.id == sub["id"]
                    ).first()
                    if stale:
                        push_db.delete(stale)
                        push_db.commit()
                else:
                    logger.warning("WebPush failed user=%s: %s", user_id, exc)
            except Exception as exc:
                logger.warning("WebPush unexpected error user=%s: %s", user_id, exc)
    finally:
        push_db.close()
