from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import User, Ticket, Message, Notification, Log
from ..schemas import TicketCreateRequest, TicketUpdateRequest, TicketResponse
from ..deps import get_current_user
from ..config import settings

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
    return q.order_by(Ticket.created_at.desc()).all()


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(body: TicketCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients only")
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
        description=body.description,
        urgency=body.urgency,
        status="PENDING",
    )
    db.add(ticket)
    db.flush()
    db.add(Log(user_id=current_user.id, action="CREATE_TICKET", entity="Ticket", entity_id=ticket.id, details=ticket.ref))
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).options(joinedload(Ticket.client), joinedload(Ticket.agent), joinedload(Ticket.satisfaction_rating), joinedload(Ticket.attachments)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: str, body: TicketUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if body.agent_id is not None and current_user.role in ("OPS_ADMIN", "SYSTEM_ADMIN"):
        ticket.agent_id = body.agent_id
        ticket.taken_at = datetime.utcnow()

    if body.status is not None:
        ticket.status = body.status
        if body.status in ("TREATED", "CLOSED"):
            ticket.closed_at = datetime.utcnow()

    if body.urgency is not None:
        ticket.urgency = body.urgency

    db.add(Log(user_id=current_user.id, action="UPDATE_TICKET", entity="Ticket", entity_id=ticket.id))
    db.commit()
    db.refresh(ticket)
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
    db.add(Log(user_id=current_user.id, action="CLOSE_TICKET", entity="Ticket", entity_id=ticket.id))
    db.commit()
    db.refresh(ticket)
    return ticket
