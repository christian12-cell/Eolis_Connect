import json
import time
import logging
from .config import settings

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

# Délai avant envoi : laisse le temps à mark-read de s'exécuter si l'user est sur la page.
PUSH_DELAY_SECONDS = 5


def send_push_to_user(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    url: str = "/",
    urgency: str | None = None,
    ticket_id: str | None = None,
    delay_seconds: int = PUSH_DELAY_SECONDS,
) -> None:
    """
    Envoie un push Web à tous les appareils abonnés d'un utilisateur.
    Utilise sa propre session DB (pas celle du request) car les background
    tasks FastAPI s'exécutent après la fermeture de la session de la requête.
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    from .database import SessionLocal
    from .models import PushSubscription, PushPreference, Notification

    # ── Lecture initiale ──────────────────────────────────────────────────────
    with SessionLocal() as db:
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

    # ── Délai : laisse mark-read s'exécuter si l'user est sur la page ─────────
    if delay_seconds > 0:
        time.sleep(delay_seconds)

    # ── Vérifier si déjà lu (session fraîche) ─────────────────────────────────
    if ticket_id:
        with SessionLocal() as check_db:
            still_unread = check_db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.ticket_id == ticket_id,
                Notification.is_read == False,
            ).first()
        if not still_unread:
            return  # L'user était sur la page et a déjà lu → pas de push

    # ── Envoi ─────────────────────────────────────────────────────────────────
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    private_key = settings.VAPID_PRIVATE_KEY
    payload = json.dumps({"title": title, "body": body, "url": url, "ticketId": ticket_id})

    with SessionLocal() as push_db:
        from .models import PushSubscription as PS
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
                    stale = push_db.query(PS).filter(PS.id == sub["id"]).first()
                    if stale:
                        push_db.delete(stale)
                        push_db.commit()
                else:
                    logger.warning("WebPush failed user=%s: %s", user_id, exc)
            except Exception as exc:
                logger.warning("WebPush unexpected error user=%s: %s", user_id, exc)
