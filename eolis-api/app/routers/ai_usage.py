from datetime import datetime, timedelta, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AIUsage, Ticket, User
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/ai-usage", tags=["ai-usage"])


def _apply_date_filter(q, from_date: Optional[str], to_date: Optional[str]):
    """Filter by ISO date strings YYYY-MM-DD (inclusive on both ends)."""
    if from_date:
        try:
            d = datetime.strptime(from_date, "%Y-%m-%d")
            q = q.filter(AIUsage.created_at >= d)
        except ValueError:
            pass
    if to_date:
        try:
            d = datetime.strptime(to_date, "%Y-%m-%d")
            # Include the entire to_date day
            d = d.replace(hour=23, minute=59, second=59)
            q = q.filter(AIUsage.created_at <= d)
        except ValueError:
            pass
    return q


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

    total_usd  = sum(r.cost_usd  for r in rows)
    total_fcfa = sum(r.cost_fcfa for r in rows)

    items = []
    for r in rows:
        ticket = db.query(Ticket).filter(Ticket.id == r.ticket_id).first() if r.ticket_id else None
        items.append({
            "id":           r.id,
            "ticketId":     r.ticket_id,
            "ticketRef":    ticket.ref if ticket else None,
            "model":        r.model,
            "inputTokens":  r.input_tokens,
            "outputTokens": r.output_tokens,
            "costUsd":      round(r.cost_usd, 8),
            "costFcfa":     round(r.cost_fcfa, 4),
            "fcfaRate":     r.fcfa_rate,
            "createdAt":    r.created_at.isoformat() + "Z",
        })

    return {
        "totalUsd":  round(total_usd, 8),
        "totalFcfa": round(total_fcfa, 4),
        "count":     len(items),
        "items":     items,
    }


@router.get("/admin")
def admin_usage(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    q = db.query(AIUsage)
    q = _apply_date_filter(q, from_date, to_date)
    rows = q.order_by(AIUsage.created_at.desc()).all()

    total_usd  = sum(r.cost_usd  for r in rows)
    total_fcfa = sum(r.cost_fcfa for r in rows)

    # Per-client aggregation
    from collections import defaultdict
    by_client: dict = defaultdict(lambda: {"costUsd": 0.0, "costFcfa": 0.0, "count": 0, "firstName": None, "lastName": None})
    items = []
    for r in rows:
        client = db.query(User).filter(User.id == r.client_id).first()
        ticket = db.query(Ticket).filter(Ticket.id == r.ticket_id).first() if r.ticket_id else None
        by_client[r.client_id]["costUsd"]   += r.cost_usd
        by_client[r.client_id]["costFcfa"]  += r.cost_fcfa
        by_client[r.client_id]["count"]     += 1
        by_client[r.client_id]["firstName"]  = client.first_name if client else None
        by_client[r.client_id]["lastName"]   = client.last_name  if client else None
        items.append({
            "id":           r.id,
            "clientId":     r.client_id,
            "clientName":   f"{client.first_name} {client.last_name}" if client else r.client_id,
            "ticketId":     r.ticket_id,
            "ticketRef":    ticket.ref if ticket else None,
            "model":        r.model,
            "inputTokens":  r.input_tokens,
            "outputTokens": r.output_tokens,
            "costUsd":      round(r.cost_usd, 8),
            "costFcfa":     round(r.cost_fcfa, 4),
            "fcfaRate":     r.fcfa_rate,
            "createdAt":    r.created_at.isoformat() + "Z",
        })

    clients_summary = [
        {
            "clientId":    cid,
            "firstName":   v["firstName"],
            "lastName":    v["lastName"],
            "count":       v["count"],
            "totalUsd":    round(v["costUsd"],  8),
            "totalFcfa":   round(v["costFcfa"], 4),
        }
        for cid, v in sorted(by_client.items(), key=lambda x: -x[1]["costUsd"])
    ]

    return {
        "totalUsd":       round(total_usd, 8),
        "totalFcfa":      round(total_fcfa, 4),
        "count":          len(items),
        "clientsSummary": clients_summary,
        "items":          items,
    }
