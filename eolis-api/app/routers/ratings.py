from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Ticket, SatisfactionRating, Log
from ..schemas import RatingCreateRequest, RatingResponse
from ..deps import get_current_user

router = APIRouter(prefix="/tickets/{ticket_id}/ratings", tags=["ratings"])


@router.post("", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def create_rating(ticket_id: str, body: RatingCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if current_user.role != "CLIENT" or ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients only")
    if not ticket.agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No agent assigned")
    existing = db.query(SatisfactionRating).filter(SatisfactionRating.ticket_id == ticket_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already rated")
    rating = SatisfactionRating(
        ticket_id=ticket_id,
        client_id=current_user.id,
        agent_id=ticket.agent_id,
        score=body.score,
        comment=body.comment,
    )
    db.add(rating)
    db.add(Log(user_id=current_user.id, action="CREATE_RATING", entity="Ticket", entity_id=ticket_id))
    db.commit()
    db.refresh(rating)
    print(f"[rating] ✅ Ticket {ticket.ref} — score={body.score}/5 — comment={'oui' if body.comment else 'non'} — agent={ticket.agent_id}")
    return rating
