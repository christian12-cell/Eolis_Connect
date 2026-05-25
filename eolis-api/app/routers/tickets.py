from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import User, Ticket, Message, Notification, Log, AIUsage
from ..ws_manager import ws_manager
from ..schemas import TicketCreateRequest, TicketUpdateRequest, TicketResponse
from ..deps import get_current_user
from ..config import settings
from ..credit_service import check_credits, deduct_credits, get_or_create_balance, credits_remaining, CREDITS_INFO_PREMIUM_OPENING, CREDITS_PER_SMS

router = APIRouter(prefix="/tickets", tags=["tickets"])

def next_ref(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(Ticket).count() + 1
    return f"REF-{year}-{count:04d}"


@router.get("", response_model=list[TicketResponse])
def list_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Ticket).options(
        joinedload(Ticket.client),
        joinedload(Ticket.agent),
        joinedload(Ticket.satisfaction_rating),
        joinedload(Ticket.attachments),
        joinedload(Ticket.messages).joinedload(Message.sender),
    )
    if current_user.role == "CLIENT":
        q = q.filter(Ticket.client_id == current_user.id)
    elif current_user.role == "AGENT":
        q = q.filter((Ticket.agent_id == current_user.id) | (Ticket.agent_id == None))
    results = q.order_by(Ticket.created_at.desc()).all()
    rated = sum(1 for t in results if t.satisfaction_rating is not None)
    print(f"[tickets] {len(results)} tickets retournés — {rated} avec rating")
    return results


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(body: TicketCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients only")

    # Modes Info sont toujours LOW urgency
    urgency = body.urgency
    if body.ticket_mode in ("INFO_SIMPLE", "INFO_PREMIUM"):
        urgency = "LOW"

    # INFO_PREMIUM : vérifier et débiter 5 crédits à l'ouverture
    if body.ticket_mode == "INFO_PREMIUM":
        check_credits(current_user.id, CREDITS_INFO_PREMIUM_OPENING, db)

    ticket = Ticket(
        ref=next_ref(db),
        client_id=current_user.id,
        category=body.category,
        subcategory=body.subcategory,
        equipment_type=body.equipment_type,
        ship_line=body.ship_line,
        ship_name=body.ship_name,
        voyage_number=body.voyage_number,
        ship_date=body.ship_date,
        code=body.code,
        vessel_data=body.vessel_data,
        bl_document_id=body.bl_document_id,
        ticket_mode=body.ticket_mode,
        subject=body.subject,
        description=body.description,
        urgency=urgency,
        status="PENDING",
    )
    db.add(ticket)
    db.flush()

    # Débit effectif 5 cr + enregistrement AIUsage pour INFO_PREMIUM
    if body.ticket_mode == "INFO_PREMIUM":
        from ..models import SystemConfig
        cfg = db.query(SystemConfig).filter(SystemConfig.key == "fcfa_rate").first()
        fcfa_rate = float(cfg.value) if cfg else 600.0
        deduct_credits(current_user.id, CREDITS_INFO_PREMIUM_OPENING, db)
        db.add(AIUsage(
            client_id=current_user.id,
            ticket_id=ticket.id,
            type="info_premium_opening",
            model="none",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            cost_fcfa=0.0,
            fcfa_rate=fcfa_rate,
            credits_cost=CREDITS_INFO_PREMIUM_OPENING,
        ))

    # Link any pending AIUsage record for this BL to the new ticket
    if body.bl_document_id:
        pending = db.query(AIUsage).filter(
            AIUsage.bl_document_id == body.bl_document_id,
            AIUsage.ticket_id == None,
        ).first()
        if pending:
            pending.ticket_id = ticket.id

    db.add(Log(user_id=current_user.id, action="CREATE_TICKET", entity="Ticket", entity_id=ticket.id, details=ticket.ref))
    db.commit()
    db.refresh(ticket)
    return ticket


def _compute_sms_slots(ticket, db: Session) -> int:
    """Dynamic SMS capacity = floor(credits_remaining / 160). Uncapped."""
    if not ticket.sms_enabled or ticket.ticket_mode not in ("BL_PREMIUM", "INFO_PREMIUM"):
        return 0
    rem = credits_remaining(ticket.client_id, db)
    return max(0, int(rem // CREDITS_PER_SMS))


def _count_sms_doc_sent(ticket_id: str, db: Session) -> int:
    """Count doc-request SMS already sent on this ticket."""
    return db.query(AIUsage).filter(
        AIUsage.ticket_id == ticket_id,
        AIUsage.type == "sms_notification",
        AIUsage.model == "sms_doc",
    ).count()


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent), joinedload(Ticket.satisfaction_rating), joinedload(Ticket.attachments)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    ai = db.query(AIUsage).filter(AIUsage.ticket_id == ticket.id).first()
    ticket.__dict__["ai_usage"]    = ai
    ticket.__dict__["sms_slots"]   = _compute_sms_slots(ticket, db)
    ticket.__dict__["sms_doc_sent"] = _count_sms_doc_sent(ticket.id, db)
    return ticket


@router.patch("/{ticket_id}/sms", response_model=TicketResponse)
def toggle_ticket_sms(ticket_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Client toggles SMS notifications for this specific ticket (premium only)."""
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients only")
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent), joinedload(Ticket.satisfaction_rating), joinedload(Ticket.attachments)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if ticket.ticket_mode not in ("BL_PREMIUM", "INFO_PREMIUM"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sms_premium_only")

    # If trying to enable, check minimum credits
    new_state = not ticket.sms_enabled
    if new_state:
        rem = credits_remaining(current_user.id, db)
        if rem < CREDITS_PER_SMS:
            raise HTTPException(status_code=402, detail="insufficient_credits_for_sms")

    ticket.sms_enabled = new_state
    db.commit()
    db.refresh(ticket)
    ticket.__dict__["ai_usage"]    = db.query(AIUsage).filter(AIUsage.ticket_id == ticket.id).first()
    ticket.__dict__["sms_slots"]   = _compute_sms_slots(ticket, db)
    ticket.__dict__["sms_doc_sent"] = _count_sms_doc_sent(ticket.id, db)
    return ticket


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: str, body: TicketUpdateRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if body.agent_id is not None and current_user.role in ("OPS_ADMIN", "SYSTEM_ADMIN"):
        ticket.agent_id = body.agent_id
        ticket.taken_at = datetime.utcnow()

    if body.status is not None and body.status != ticket.status:
        old_status = ticket.status
        ticket.status = body.status
        if body.status in ("TREATED", "CLOSED"):
            ticket.closed_at = datetime.utcnow()
        elif old_status in ("TREATED", "CLOSED"):
            ticket.closed_at = None
        # Notify assigned agent of admin-driven status change
        if ticket.agent_id and ticket.agent_id != current_user.id:
            if body.status in ("TREATED", "CLOSED"):
                db.add(Notification(
                    user_id=ticket.agent_id, ticket_id=ticket.id,
                    type="TICKET_CLOSED",
                    title=f"Dossier clôturé — {ticket.ref}",
                    message=f"{current_user.first_name} {current_user.last_name} a clôturé le dossier {ticket.ref}",
                ))
            elif old_status in ("TREATED", "CLOSED"):
                db.add(Notification(
                    user_id=ticket.agent_id, ticket_id=ticket.id,
                    type="TICKET_REOPENED",
                    title=f"Dossier rouvert — {ticket.ref}",
                    message=f"{current_user.first_name} {current_user.last_name} a rouvert le dossier {ticket.ref}",
                ))

    if body.urgency is not None:
        ticket.urgency = body.urgency

    db.add(Log(user_id=current_user.id, action="UPDATE_TICKET", entity="Ticket", entity_id=ticket.id))
    db.commit()
    db.refresh(ticket)
    background_tasks.add_task(ws_manager.broadcast, ticket_id, {"type": "ticket_updated", "ticketId": ticket_id})
    return ticket


@router.patch("/{ticket_id}/take", response_model=TicketResponse)
def take_ticket(ticket_id: str, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ("AGENT", "OPS_ADMIN", "SYSTEM_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff only")
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent), joinedload(Ticket.satisfaction_rating)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket.agent_id = current_user.id
    ticket.status = "IN_PROGRESS"
    ticket.taken_at = datetime.utcnow()
    db.add(Log(user_id=current_user.id, action="TAKE_TICKET", entity="Ticket", entity_id=ticket.id))
    db.commit()
    db.refresh(ticket)
    background_tasks.add_task(ws_manager.broadcast, ticket_id, {"type": "ticket_updated", "ticketId": ticket_id})
    return ticket


@router.patch("/{ticket_id}/close", response_model=TicketResponse)
def close_ticket(ticket_id: str, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ("AGENT", "OPS_ADMIN", "SYSTEM_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff only")
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent), joinedload(Ticket.satisfaction_rating)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket.status = "TREATED"
    ticket.closed_at = datetime.utcnow()
    if ticket.agent_id and ticket.agent_id != current_user.id:
        db.add(Notification(
            user_id=ticket.agent_id, ticket_id=ticket_id,
            type="TICKET_CLOSED",
            title=f"Dossier clôturé — {ticket.ref}",
            message=f"{current_user.first_name} {current_user.last_name} a clôturé le dossier {ticket.ref}",
        ))
    db.add(Log(user_id=current_user.id, action="CLOSE_TICKET", entity="Ticket", entity_id=ticket.id))
    db.commit()
    db.refresh(ticket)
    background_tasks.add_task(ws_manager.broadcast, ticket_id, {"type": "ticket_updated", "ticketId": ticket_id})
    return ticket
