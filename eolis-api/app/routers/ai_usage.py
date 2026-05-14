from datetime import datetime
from typing import Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AIUsage, Ticket, User
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/ai-usage", tags=["ai-usage"])

TYPE_ICONS = {"bl_extraction": "📄", "voice_transcription": "🎙️"}


def _apply_date_filter(q, from_date: Optional[str], to_date: Optional[str]):
    if from_date:
        try:
            q = q.filter(AIUsage.created_at >= datetime.strptime(from_date, "%Y-%m-%d"))
        except ValueError:
            pass
    if to_date:
        try:
            d = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            q = q.filter(AIUsage.created_at <= d)
        except ValueError:
            pass
    return q


def _resolve_ticket(r: AIUsage, db: Session, client_id: Optional[str] = None) -> Optional[Ticket]:
    """Find the ticket linked to an AIUsage row, either directly or via bl_document."""
    if r.ticket_id:
        q = db.query(Ticket).filter(Ticket.id == r.ticket_id)
        if client_id:
            q = q.filter(Ticket.client_id == client_id)
        return q.first()
    if r.bl_document_id:
        q = db.query(Ticket).filter(Ticket.bl_document_id == r.bl_document_id)
        if client_id:
            q = q.filter(Ticket.client_id == client_id)
        return q.first()
    return None


@router.get("/my")
def my_usage(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AIUsage).filter(AIUsage.client_id == current_user.id)
    q = _apply_date_filter(q, from_date, to_date)
    rows = q.order_by(AIUsage.created_at.desc()).all()

    total_credits = sum(getattr(r, "credits_cost", 0) or 0 for r in rows)

    items = []
    for r in rows:
        ticket = _resolve_ticket(r, db, current_user.id)
        items.append({
            "id":           r.id,
            "type":         r.type,
            "ticketId":     ticket.id   if ticket else r.ticket_id,
            "ticketRef":    ticket.ref  if ticket else None,
            "creditsCost":  round(getattr(r, "credits_cost", 0) or 0, 2),
            "createdAt":    r.created_at.isoformat() + "Z",
        })

    return {
        "totalCredits": round(total_credits, 2),
        "count":        len(items),
        "items":        items,
    }


@router.get("/ticket/{ticket_id}")
def ticket_ai_cost(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.client_id == current_user.id,
    ).first()
    if not ticket:
        raise HTTPException(404, "Dossier non trouvé")

    # Only count voice transcription credits used IN this specific ticket's chat
    # (BL extraction is a one-time shared cost, not per-ticket)
    rows: list[AIUsage] = db.query(AIUsage).filter(
        AIUsage.ticket_id == ticket_id,
        AIUsage.type == "voice_transcription",
    ).all()

    total_credits = sum(int(getattr(r, "credits_cost", 0) or 0) for r in rows)

    return {
        "totalCredits": total_credits,
        "count":        len(rows),
    }


@router.get("/admin")
def admin_usage(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    client_id: Optional[str] = Query(None),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    q = db.query(AIUsage)
    if client_id:
        q = q.filter(AIUsage.client_id == client_id)
    q = _apply_date_filter(q, from_date, to_date)
    rows = q.order_by(AIUsage.created_at.desc()).all()

    total_usd  = sum(r.cost_usd  for r in rows)
    total_fcfa = sum(r.cost_fcfa for r in rows)

    by_client: dict = defaultdict(lambda: {
        "costUsd": 0.0, "costFcfa": 0.0, "count": 0, "firstName": None, "lastName": None,
    })
    by_ticket: dict = defaultdict(lambda: {
        "ref": None, "ticketId": None, "clientId": None, "clientName": None,
        "costUsd": 0.0, "costFcfa": 0.0, "blCount": 0, "voiceCount": 0,
    })

    items = []
    for r in rows:
        client = db.query(User).filter(User.id == r.client_id).first()
        ticket = _resolve_ticket(r, db)

        ticket_key = (ticket.id if ticket else f"notickect-{r.client_id}-{r.created_at.date()}")
        client_name = f"{client.first_name} {client.last_name}" if client else r.client_id

        by_client[r.client_id]["costUsd"]   += r.cost_usd
        by_client[r.client_id]["costFcfa"]  += r.cost_fcfa
        by_client[r.client_id]["count"]     += 1
        by_client[r.client_id]["firstName"]  = client.first_name if client else None
        by_client[r.client_id]["lastName"]   = client.last_name  if client else None

        by_ticket[ticket_key]["ref"]        = ticket.ref if ticket else None
        by_ticket[ticket_key]["ticketId"]   = ticket.id  if ticket else None
        by_ticket[ticket_key]["clientId"]   = r.client_id
        by_ticket[ticket_key]["clientName"] = client_name
        by_ticket[ticket_key]["costUsd"]   += r.cost_usd
        by_ticket[ticket_key]["costFcfa"]  += r.cost_fcfa
        if r.type == "voice_transcription":
            by_ticket[ticket_key]["voiceCount"] += 1
        else:
            by_ticket[ticket_key]["blCount"]    += 1

        items.append({
            "id":           r.id,
            "type":         r.type,
            "clientId":     r.client_id,
            "clientName":   client_name,
            "ticketId":     ticket.id  if ticket else r.ticket_id,
            "ticketRef":    ticket.ref if ticket else None,
            "model":        r.model,
            "inputTokens":  r.input_tokens,
            "outputTokens": r.output_tokens,
            "costUsd":      round(r.cost_usd,  8),
            "costFcfa":     round(r.cost_fcfa, 4),
            "fcfaRate":     r.fcfa_rate,
            "createdAt":    r.created_at.isoformat() + "Z",
        })

    clients_summary = [
        {
            "clientId":  cid,
            "firstName": v["firstName"],
            "lastName":  v["lastName"],
            "count":     v["count"],
            "totalUsd":  round(v["costUsd"],  8),
            "totalFcfa": round(v["costFcfa"], 4),
        }
        for cid, v in sorted(by_client.items(), key=lambda x: -x[1]["costUsd"])
    ]

    tickets_summary = [
        {
            "ref":        v["ref"],
            "ticketId":   v["ticketId"],
            "clientId":   v["clientId"],
            "clientName": v["clientName"],
            "blCount":    v["blCount"],
            "voiceCount": v["voiceCount"],
            "totalUsd":   round(v["costUsd"],  8),
            "totalFcfa":  round(v["costFcfa"], 4),
        }
        for v in sorted(by_ticket.values(), key=lambda x: -x["costUsd"])
    ]

    return {
        "totalUsd":       round(total_usd,  8),
        "totalFcfa":      round(total_fcfa, 4),
        "count":          len(items),
        "clientsSummary": clients_summary,
        "ticketsSummary": tickets_summary,
        "items":          items,
    }
