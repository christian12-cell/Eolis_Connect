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

    logger.warning("[PUSH] start user=%s type=%s ticket=%s", user_id, notif_type, ticket_id)

    # ── Lecture initiale ──────────────────────────────────────────────────────
    try:
        with SessionLocal() as db:
            pref = db.query(PushPreference).filter(PushPreference.user_id == user_id).first()
            if pref:
                field = PREF_FIELD.get(notif_type, "new_message")
                if not getattr(pref, field, True):
                    logger.warning("[PUSH] skip — preference %s=False user=%s", field, user_id)
                    return
                if pref.high_only and urgency and urgency != "HIGH":
                    logger.warning("[PUSH] skip — high_only filter user=%s urgency=%s", user_id, urgency)
                    return

            subs_list = [
                {"endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth, "id": s.id}
                for s in db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
            ]
            logger.warning("[PUSH] found %d subscription(s) for user=%s", len(subs_list), user_id)
    except Exception as exc:
        logger.error("[PUSH] DB error (initial read) user=%s: %s", user_id, exc)
        return

    if not subs_list:
        logger.warning("[PUSH] skip — no subscriptions for user=%s", user_id)
        return

    # ── Check présence WebSocket : user déjà sur la page → pas de push ────────
    if ticket_id:
        from .ws_manager import ws_manager
        if ws_manager.is_user_on_ticket(user_id, ticket_id):
            logger.warning("[PUSH] skip — user=%s has active WS on ticket=%s", user_id, ticket_id)
            return

    # ── Délai : laisse mark-read s'exécuter si l'user est sur la page ─────────
    if delay_seconds > 0:
        logger.warning("[PUSH] sleeping %ds before send user=%s", delay_seconds, user_id)
        time.sleep(delay_seconds)

    # ── Vérifier si déjà lu (session fraîche) ─────────────────────────────────
    if ticket_id:
        try:
            with SessionLocal() as check_db:
                still_unread = check_db.query(Notification).filter(
                    Notification.user_id == user_id,
                    Notification.ticket_id == ticket_id,
                    Notification.is_read == False,
                ).first()
            logger.warning("[PUSH] unread_check user=%s ticket=%s still_unread=%s", user_id, ticket_id, still_unread is not None)
        except Exception as exc:
            logger.error("[PUSH] DB error (unread check) user=%s: %s", user_id, exc)
            still_unread = True  # En cas d'erreur, on envoie quand même
        if not still_unread:
            logger.warning("[PUSH] skip — already read user=%s ticket=%s", user_id, ticket_id)
            return

    # ── Envoi ─────────────────────────────────────────────────────────────────
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    private_key = settings.VAPID_PRIVATE_KEY
    payload = json.dumps({"title": title, "body": body, "url": url, "ticketId": ticket_id})

    logger.warning("[PUSH] sending to %d device(s) user=%s", len(subs_list), user_id)
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
                logger.warning("[PUSH] sent OK user=%s endpoint=...%s", user_id, sub["endpoint"][-30:])
            except WebPushException as exc:
                logger.warning("[PUSH] WebPushException user=%s status=%s body=%s",
                    user_id,
                    exc.response.status_code if exc.response else "?",
                    exc.response.text[:200] if exc.response else str(exc))
                if exc.response is not None and exc.response.status_code in (400, 404, 410):
                    stale = push_db.query(PS).filter(PS.id == sub["id"]).first()
                    if stale:
                        push_db.delete(stale)
                        push_db.commit()
            except Exception as exc:
                logger.warning("[PUSH] unexpected error user=%s: %s", user_id, exc)
