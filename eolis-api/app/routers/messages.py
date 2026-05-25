from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from sqlalchemy import func, update
from ..models import User, Ticket, Message, Notification, Attachment
from ..schemas import MessageCreateRequest, MessageResponse
from ..deps import get_current_user
from ..config import settings
from ..sms_service import sms_final_response, sms_document_requested
from ..email_service import send_final_response_email, send_document_requested_email
from ..credit_service import credits_remaining, deduct_credits, CREDITS_PER_SMS, SMS_REAL_COST_FCFA, SMS_REAL_COST_USD
from ..push_service import send_push_to_user
from ..ws_manager import ws_manager

router = APIRouter(prefix="/tickets/{ticket_id}/messages", tags=["messages"])

STAFF_ROLES = {"AGENT", "OPS_ADMIN", "SYSTEM_ADMIN"}
ALLOWED_STAFF_TYPES = {"INTERNAL_NOTE", "DOCUMENT_REQUEST", "FINAL_RESPONSE"}
ALLOWED_CLIENT_TYPES = {"CLIENT", "DOCS_SUBMITTED"}


@router.get("", response_model=list[MessageResponse])
def list_messages(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q = db.query(Message).options(joinedload(Message.sender)).filter(Message.ticket_id == ticket_id)

    # INTERNAL_NOTE hidden from clients
    if current_user.role == "CLIENT":
        q = q.filter(Message.sender_type != "INTERNAL_NOTE")

    msgs = q.order_by(Message.created_at.asc()).all()

    if msgs:
        counts = db.query(Attachment.message_id, func.count(Attachment.id))\
            .filter(Attachment.message_id.in_([m.id for m in msgs]))\
            .group_by(Attachment.message_id).all()
        att_counts = {msg_id: count for msg_id, count in counts}
        for m in msgs:
            m.__dict__['attachment_count'] = att_counts.get(m.id, 0)

    return msgs


@router.post("/mark-read", status_code=200)
def mark_messages_read(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark as read all messages visible to the caller:
    - CLIENT: marks AGENT, FINAL_RESPONSE, DOCUMENT_REQUEST messages as read
    - STAFF: marks CLIENT, DOCS_SUBMITTED messages as read
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404)
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(status_code=403)

    if current_user.role == "CLIENT":
        sender_types = ["AGENT", "FINAL_RESPONSE", "DOCUMENT_REQUEST"]
    else:
        sender_types = ["CLIENT", "DOCS_SUBMITTED"]

    db.query(Message).filter(
        Message.ticket_id == ticket_id,
        Message.sender_type.in_(sender_types),
        Message.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()}, synchronize_session=False)

    # Also mark ticket notifications as read for this user
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.ticket_id == ticket_id,
        Notification.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)

    db.commit()
    return {"success": True}


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    ticket_id: str,
    body: MessageCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Determine sender_type
    if current_user.role == "CLIENT":
        sender_type = body.sender_type if body.sender_type in ALLOWED_CLIENT_TYPES else "CLIENT"
    elif body.sender_type in ALLOWED_STAFF_TYPES:
        sender_type = body.sender_type
    else:
        sender_type = "AGENT"

    # Block non-INTERNAL_NOTE messages on closed/treated tickets
    if ticket.status in ("CLOSED", "TREATED") and sender_type != "INTERNAL_NOTE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ticket_closed")

    # Block DOCS_SUBMITTED if no unanswered DOCUMENT_REQUEST exists
    if sender_type == "DOCS_SUBMITTED":
        last_doc_req = (
            db.query(Message)
            .filter(
                Message.ticket_id == ticket_id,
                Message.sender_type == "DOCUMENT_REQUEST",
                Message.is_deleted == False,
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        if not last_doc_req:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_pending_document_request")
        already_answered = (
            db.query(Message)
            .filter(
                Message.ticket_id == ticket_id,
                Message.sender_type == "DOCS_SUBMITTED",
                Message.created_at > last_doc_req.created_at,
                Message.is_deleted == False,
            )
            .first()
        )
        if already_answered:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_pending_document_request")

    msg = Message(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        sender_type=sender_type,
        content=body.content,
        document_description=body.document_description if sender_type == "DOCUMENT_REQUEST" else None,
    )
    db.add(msg)
    db.flush()

    # Link pre-uploaded attachments to this message
    if body.attachment_ids:
        db.query(Attachment).filter(
            Attachment.id.in_(body.attachment_ids),
        ).update({"message_id": msg.id, "source": None}, synchronize_session=False)

    client = ticket.client

    if sender_type == "FINAL_RESPONSE":
        # Close the ticket
        ticket.status = "CLOSED"
        ticket.closed_at = datetime.utcnow()
        # SMS + notification to client
        if client:
            db.add(Notification(
                user_id=ticket.client_id,
                ticket_id=ticket_id,
                type="FINAL_RESPONSE",
                title="Réponse finale" if (client.language != "en") else "Final response",
                message=f"Votre dossier {ticket.ref} a été clôturé. Consultez la réponse." if (client.language != "en") else f"Your request {ticket.ref} has been closed. View the response.",
            ))
            # SMS premium : seulement si ticket premium + sms_enabled + crédits ≥ 160
            if (client.phone
                    and ticket.ticket_mode in ("BL_PREMIUM", "INFO_PREMIUM")
                    and ticket.sms_enabled
                    and credits_remaining(client.id, db) >= CREDITS_PER_SMS):
                deduct_credits(client.id, CREDITS_PER_SMS, db)
                from ..models import AIUsage
                db.add(AIUsage(
                    client_id=client.id, ticket_id=ticket_id,
                    type="sms_notification", model="sms_final",
                    input_tokens=0, output_tokens=0,
                    cost_usd=SMS_REAL_COST_USD, cost_fcfa=SMS_REAL_COST_FCFA,
                    fcfa_rate=1.0, credits_cost=CREDITS_PER_SMS,
                ))
                background_tasks.add_task(
                    sms_final_response,
                    client.phone, client.first_name, current_user.first_name,
                    ticket.ref, client.language or "fr",
                )
            _frontend = settings.ALLOWED_ORIGINS.split(",")[0].strip()
            _login_url = f"{_frontend}/{client.language or 'fr'}/mes-demandes/{ticket_id}"
            background_tasks.add_task(
                send_final_response_email,
                client.email, client.first_name, current_user.first_name,
                ticket.ref, _login_url, client.language or "fr",
            )
            background_tasks.add_task(
                send_push_to_user,ticket.client_id, "FINAL_RESPONSE",
                "Réponse finale" if (client.language != "en") else "Final response",
                f"Votre dossier {ticket.ref} a été clôturé. Consultez la réponse." if (client.language != "en") else f"Your request {ticket.ref} has been closed.",
                f"/{client.language or 'fr'}/mes-demandes/{ticket_id}", ticket.urgency, ticket_id,
            )

    elif sender_type == "DOCUMENT_REQUEST":
        if client:
            db.add(Notification(
                user_id=ticket.client_id,
                ticket_id=ticket_id,
                type="DOCUMENT_REQUEST",
                title="Documents requis" if (client.language != "en") else "Documents required",
                message=f"Documents demandés pour le dossier {ticket.ref}" if (client.language != "en") else f"Documents requested for {ticket.ref}",
            ))
            # SMS premium : demande de docs — crédits ≥ 320 (réserve 160 pour la finale)
            _lang = client.language or "fr"
            _en   = _lang == "en"
            if (ticket.ticket_mode in ("BL_PREMIUM", "INFO_PREMIUM") and ticket.sms_enabled):
                rem = credits_remaining(client.id, db)
                if client.phone and rem >= CREDITS_PER_SMS * 2:
                    deduct_credits(client.id, CREDITS_PER_SMS, db)
                    from ..models import AIUsage
                    db.add(AIUsage(
                        client_id=client.id, ticket_id=ticket_id,
                        type="sms_notification", model="sms_doc",
                        input_tokens=0, output_tokens=0,
                        cost_usd=SMS_REAL_COST_USD, cost_fcfa=SMS_REAL_COST_FCFA,
                        fcfa_rate=1.0, credits_cost=CREDITS_PER_SMS,
                    ))
                    background_tasks.add_task(
                        sms_document_requested,
                        client.phone, client.first_name, ticket.ref, _lang,
                    )
                elif rem < CREDITS_PER_SMS * 2:
                    # Crédits insuffisants pour SMS doc — notifier le client
                    background_tasks.add_task(
                        send_push_to_user, ticket.client_id, "SMS_QUOTA_LOW",
                        "Crédits SMS insuffisants" if not _en else "Insufficient SMS credits",
                        (f"Votre dossier {ticket.ref} nécessite des documents mais votre solde ne permet plus d'envoyer de SMS. Rechargez vos crédits."
                         if not _en else
                         f"Your file {ticket.ref} requires documents but your balance no longer allows SMS notifications. Top up your credits."),
                        f"/{_lang}/recharger", ticket.urgency, ticket_id, 0,
                    )
            _frontend = settings.ALLOWED_ORIGINS.split(",")[0].strip()
            _login_url = f"{_frontend}/{client.language or 'fr'}/mes-demandes/{ticket_id}"
            background_tasks.add_task(
                send_document_requested_email,
                client.email, client.first_name, ticket.ref, _login_url, client.language or "fr",
            )
            background_tasks.add_task(
                send_push_to_user,ticket.client_id, "DOCUMENT_REQUEST",
                "Documents requis" if (client.language != "en") else "Documents required",
                f"Documents demandés pour le dossier {ticket.ref}" if (client.language != "en") else f"Documents requested for {ticket.ref}",
                f"/{client.language or 'fr'}/mes-demandes/{ticket_id}", ticket.urgency, ticket_id,
            )

    elif sender_type == "AGENT":
        if ticket.client_id and client:
            db.add(Notification(
                user_id=ticket.client_id,
                ticket_id=ticket_id,
                type="NEW_MESSAGE",
                title="Nouveau message" if (client.language != "en") else "New message",
                message=f"Nouveau message dans le dossier {ticket.ref}",
            ))
            background_tasks.add_task(
                send_push_to_user,ticket.client_id, "NEW_MESSAGE",
                "Nouveau message" if (client.language != "en") else "New message",
                f"Réponse sur le dossier {ticket.ref}" if (client.language != "en") else f"Reply on {ticket.ref}",
                f"/{client.language or 'fr'}/mes-demandes/{ticket_id}", ticket.urgency, ticket_id,
            )

    elif sender_type == "INTERNAL_NOTE":
        import re
        from ..models import User as UserModel
        # Parse @mentions in the note content
        mentioned_usernames = set(re.findall(r'@([\w.]+)', body.content))
        mentioned_users: list[UserModel] = []
        if mentioned_usernames:
            mentioned_users = (
                db.query(UserModel)
                .filter(
                    UserModel.username.in_(list(mentioned_usernames)),
                    UserModel.status == "ACTIVE",
                    UserModel.role.in_(["AGENT", "OPS_ADMIN", "SYSTEM_ADMIN"]),
                    UserModel.id != current_user.id,
                )
                .all()
            )
        already_notified_ids: set = set()
        if mentioned_users:
            for u in mentioned_users:
                db.add(Notification(
                    user_id=u.id,
                    ticket_id=ticket_id,
                    type="MENTION",
                    title=f"Mention — {ticket.ref}",
                    message=f"{current_user.first_name} vous a mentionné dans une note sur le dossier {ticket.ref}",
                ))
                background_tasks.add_task(
                    send_push_to_user,u.id, "MENTION",
                    f"Mention — {ticket.ref}",
                    f"{current_user.first_name} vous a mentionné dans une note",
                    f"/fr/agent/dossiers/{ticket_id}", ticket.urgency, ticket_id,
                )
                already_notified_ids.add(u.id)
        else:
            # No @mention — broadcast to all active OPS_ADMIN
            ops_users = db.query(UserModel).filter(
                UserModel.role == "OPS_ADMIN", UserModel.status == "ACTIVE", UserModel.id != current_user.id,
            ).all()
            for ops in ops_users:
                db.add(Notification(
                    user_id=ops.id,
                    ticket_id=ticket_id,
                    type="INTERNAL_NOTE",
                    title=f"Note interne — {ticket.ref}",
                    message=f"{current_user.first_name} a ajouté une note interne sur le dossier {ticket.ref}",
                ))
                already_notified_ids.add(ops.id)

        # Also notify the assigned agent if they're not the author and not already notified
        if ticket.agent_id and ticket.agent_id != current_user.id and ticket.agent_id not in already_notified_ids:
            db.add(Notification(
                user_id=ticket.agent_id,
                ticket_id=ticket_id,
                type="INTERNAL_NOTE",
                title=f"Note interne — {ticket.ref}",
                message=f"{current_user.first_name} a ajouté une note interne sur votre dossier {ticket.ref}",
            ))

    elif sender_type == "DOCS_SUBMITTED" and ticket.agent_id:
        lang_notif = client.language if client else "fr"
        db.add(Notification(
            user_id=ticket.agent_id,
            ticket_id=ticket_id,
            type="DOCS_SUBMITTED",
            title="Documents reçus" if lang_notif != "en" else "Documents received",
            message=f"Le client a envoyé les documents demandés pour {ticket.ref}",
        ))
        # Pas de SMS agent pour docs soumis — push suffit
        background_tasks.add_task(
            send_push_to_user,ticket.agent_id, "DOCS_SUBMITTED",
            "Documents reçus",
            f"Le client a envoyé les documents pour {ticket.ref}",
            f"/fr/agent/dossiers/{ticket_id}", ticket.urgency, ticket_id,
        )

    elif sender_type == "CLIENT" and ticket.agent_id:
        db.add(Notification(
            user_id=ticket.agent_id,
            ticket_id=ticket_id,
            type="NEW_MESSAGE",
            title="Réponse client",
            message=f"Le client a répondu sur le dossier {ticket.ref}",
        ))
        background_tasks.add_task(
            send_push_to_user,ticket.agent_id, "NEW_MESSAGE",
            f"Réponse client — {ticket.ref}",
            f"Le client a répondu sur le dossier {ticket.ref}",
            f"/fr/agent/dossiers/{ticket_id}", ticket.urgency, ticket_id,
        )

    db.commit()
    db.refresh(msg)

    # Broadcast real-time events to all WebSocket connections watching this ticket
    event_type = "ticket_updated" if sender_type == "FINAL_RESPONSE" else "messages_updated"
    background_tasks.add_task(ws_manager.broadcast, ticket_id, {
        "type": event_type,
        "ticketId": ticket_id,
        "senderType": sender_type,
    })
    # Always also signal messages_updated so both sides refresh the list
    if sender_type == "FINAL_RESPONSE":
        background_tasks.add_task(ws_manager.broadcast, ticket_id, {
            "type": "messages_updated",
            "ticketId": ticket_id,
            "senderType": sender_type,
        })

    return msg


@router.delete("/{message_id}", status_code=200)
def delete_message(
    ticket_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msg = db.query(Message).filter(Message.id == message_id, Message.ticket_id == ticket_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Only the sender can delete
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")

    # Only within 5 minutes
    if datetime.utcnow() - msg.created_at > timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="delete_too_late")

    msg.is_deleted = True
    msg.deleted_at = datetime.utcnow()

    # Notify other participants
    sender_name = f"{current_user.first_name} {current_user.last_name}"
    is_fr_client = ticket.client and ticket.client.language != "en"

    # Notify agent if sender is client
    if current_user.role == "CLIENT" and ticket.agent_id:
        db.add(Notification(
            user_id=ticket.agent_id,
            ticket_id=ticket_id,
            type="NEW_MESSAGE",
            title="Message supprimé" if True else "Message deleted",
            message=f"Le client a supprimé un message sur le dossier {ticket.ref}",
        ))

    # Notify client if sender is staff
    elif current_user.role != "CLIENT" and ticket.client_id:
        title = "Message supprimé" if is_fr_client else "Message deleted"
        message = (f"Un message a été supprimé sur votre dossier {ticket.ref}"
                   if is_fr_client else f"A message was deleted on your request {ticket.ref}")
        db.add(Notification(
            user_id=ticket.client_id,
            ticket_id=ticket_id,
            type="NEW_MESSAGE",
            title=title,
            message=message,
        ))

    db.commit()
    return {"ok": True}
