from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import User, Notification, Message, Ticket
from ..push_service import send_push_to_user
from ..schemas import NotificationResponse
from ..deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    notif.is_read = True
    db.commit()
    return {"success": True}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}


@router.post("/check-final-unread", status_code=200)
def check_final_unread(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Checks all FINAL_RESPONSE messages unread by the client for >12h.
    Creates a FINAL_UNREAD notification for the agent + all OPS/SYSTEM admins.
    Idempotent: one notification per ticket max.
    Also checks CLIENT messages unread by the team for >1h (CLIENT_MSG_UNREAD).
    """
    if current_user.role not in ["AGENT", "OPS_ADMIN", "SYSTEM_ADMIN"]:
        return {"notified": 0}

    ops_users = db.query(User).filter(
        User.role.in_(["OPS_ADMIN", "SYSTEM_ADMIN"])
    ).all()

    def get_recipients(ticket: Ticket) -> list[User]:
        recip: dict[str, User] = {u.id: u for u in ops_users}
        if ticket.agent_id and ticket.agent_id not in recip:
            ag = db.query(User).filter(User.id == ticket.agent_id).first()
            if ag:
                recip[ag.id] = ag
        return list(recip.values())

    def already_notified(ticket_id: str, notif_type: str) -> bool:
        return db.query(Notification).filter(
            Notification.ticket_id == ticket_id,
            Notification.type == notif_type,
        ).first() is not None

    def add_notif(user: User, ticket: Ticket, notif_type: str, title_fr: str, title_en: str, msg_fr: str, msg_en: str):
        lang = getattr(user, "language", "fr") or "fr"
        db.add(Notification(
            user_id=user.id,
            ticket_id=ticket.id,
            type=notif_type,
            title=title_en if lang == "en" else title_fr,
            message=msg_en if lang == "en" else msg_fr,
            is_read=False,
        ))

    created = 0
    threshold_final = datetime.utcnow() - timedelta(hours=12)

    # ── 1. FINAL_RESPONSE not read by client for >12h ──────────────────────
    unread_finals = (
        db.query(Message)
        .filter(
            Message.sender_type == "FINAL_RESPONSE",
            Message.is_read == False,
            Message.created_at <= threshold_final,
        )
        .all()
    )

    for msg in unread_finals:
        ticket = (
            db.query(Ticket)
            .options(joinedload(Ticket.client), joinedload(Ticket.agent))
            .filter(Ticket.id == msg.ticket_id)
            .first()
        )
        if not ticket or already_notified(ticket.id, "FINAL_UNREAD"):
            continue

        client_name  = f"{ticket.client.first_name} {ticket.client.last_name}" if ticket.client else "Le client"
        client_phone = getattr(ticket.client, "phone", None) or ""
        agent_name   = f"{ticket.agent.first_name} {ticket.agent.last_name}" if ticket.agent else "l'agent"
        phone_fr     = f" · Tél : {client_phone}" if client_phone else ""
        phone_en     = f" · Tel: {client_phone}" if client_phone else ""

        for user in get_recipients(ticket):
            add_notif(
                user, ticket, "FINAL_UNREAD",
                title_fr=f"Réponse finale non lue — {ticket.ref}",
                title_en=f"Final response not viewed — {ticket.ref}",
                msg_fr=f"{client_name} n'a pas encore lu la réponse finale de {agent_name}.{phone_fr}",
                msg_en=f"{client_name} has not yet read the final response from {agent_name}.{phone_en}",
            )
            lang = getattr(user, "language", "fr") or "fr"
            send_push_to_user(
                user.id, "FINAL_UNREAD",
                f"Réponse finale non lue — {ticket.ref}" if lang != "en" else f"Final response not viewed — {ticket.ref}",
                f"{client_name} n'a pas encore lu la réponse finale." if lang != "en" else f"{client_name} has not yet read the final response.",
                f"/fr/agent/dossiers/{ticket.id}", ticket.urgency, ticket.id, delay_seconds=0,
            )
        created += 1

    # ── 2. CLIENT message unread by team for >1h ───────────────────────────
    threshold_msg = datetime.utcnow() - timedelta(hours=1)

    unread_client_msgs = (
        db.query(Message)
        .filter(
            Message.sender_type == "CLIENT",
            Message.is_read == False,
            Message.created_at <= threshold_msg,
        )
        .all()
    )

    for msg in unread_client_msgs:
        ticket = (
            db.query(Ticket)
            .options(joinedload(Ticket.client), joinedload(Ticket.agent))
            .filter(Ticket.id == msg.ticket_id)
            .first()
        )
        if not ticket or already_notified(ticket.id, "CLIENT_MSG_UNREAD"):
            continue

        client_name = f"{ticket.client.first_name} {ticket.client.last_name}" if ticket.client else "Le client"

        for user in get_recipients(ticket):
            add_notif(
                user, ticket, "CLIENT_MSG_UNREAD",
                title_fr=f"Message non lu — {ticket.ref}",
                title_en=f"Unread message — {ticket.ref}",
                msg_fr=f"{client_name} attend une réponse depuis plus d'1h.",
                msg_en=f"{client_name} has been waiting for a reply for over 1h.",
            )
            lang = getattr(user, "language", "fr") or "fr"
            send_push_to_user(
                user.id, "CLIENT_MSG_UNREAD",
                f"Message non lu — {ticket.ref}" if lang != "en" else f"Unread message — {ticket.ref}",
                f"{client_name} attend une réponse depuis plus d'1h." if lang != "en" else f"{client_name} has been waiting for a reply for over 1h.",
                f"/fr/agent/dossiers/{ticket.id}", ticket.urgency, ticket.id, delay_seconds=0,
            )
        created += 1

    if created > 0:
        db.commit()

    return {"notified": created}
