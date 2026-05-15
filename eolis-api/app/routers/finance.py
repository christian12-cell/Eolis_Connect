from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, AIUsage, CreditRequest, InfrastructureCost
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/finance", tags=["finance"])

FINANCE_ROLES = ("FINANCE_AGENT", "SYSTEM_ADMIN")


class InfraCostIn(BaseModel):
    category: str
    label: str
    amount_fcfa: float
    amount_usd: float
    period: str
    invoice_url: Optional[str] = None


def _apply_date_filter(q, model_col, from_date, to_date):
    if from_date:
        try: q = q.filter(model_col >= datetime.strptime(from_date, "%Y-%m-%d"))
        except ValueError: pass
    if to_date:
        try:
            d = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            q = q.filter(model_col <= d)
        except ValueError: pass
    return q


@router.get("/dashboard")
def finance_dashboard(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    # Revenue — approved credit requests
    req_q = db.query(CreditRequest).filter(CreditRequest.status == "approved")
    req_q = _apply_date_filter(req_q, CreditRequest.validated_at, from_date, to_date)
    approved = req_q.all()
    total_revenue = sum(r.amount_validated or 0 for r in approved)

    # AI costs
    ai_q = db.query(AIUsage)
    ai_q = _apply_date_filter(ai_q, AIUsage.created_at, from_date, to_date)
    usages = ai_q.all()
    total_ai_fcfa  = sum(u.cost_fcfa for u in usages)
    total_credits  = sum(getattr(u, "credits_cost", 0) or 0 for u in usages)

    # Infrastructure costs
    infra_q = db.query(InfrastructureCost)
    if from_date:
        try:
            ym = from_date[:7]
            infra_q = infra_q.filter(InfrastructureCost.period >= ym)
        except Exception: pass
    if to_date:
        try:
            ym = to_date[:7]
            infra_q = infra_q.filter(InfrastructureCost.period <= ym)
        except Exception: pass
    infra_costs = infra_q.all()
    total_infra_fcfa = sum(c.amount_fcfa for c in infra_costs)
    total_infra_usd  = sum(c.amount_usd  for c in infra_costs)

    # Pending credit requests
    pending = db.query(CreditRequest).filter(CreditRequest.status == "pending").all()
    pending_amount = sum(r.amount_declared for r in pending)

    # P&L
    total_costs     = total_ai_fcfa + total_infra_fcfa
    gross_profit    = total_revenue - total_ai_fcfa
    net_profit      = total_revenue - total_costs
    usage_profit    = total_credits - total_ai_fcfa
    margin_pct      = round((net_profit / total_revenue * 100), 1) if total_revenue > 0 else None

    return {
        "totalRevenue":      round(total_revenue,     2),
        "totalAiCostFcfa":   round(total_ai_fcfa,     4),
        "totalAiCostUsd":    round(total_ai_fcfa / 600, 6),
        "totalCreditsConsumed": round(total_credits,  2),
        "usageProfit":       round(usage_profit,      4),
        "totalInfraFcfa":    round(total_infra_fcfa,  2),
        "totalInfraUsd":     round(total_infra_usd,   4),
        "totalCosts":        round(total_costs,       2),
        "grossProfit":       round(gross_profit,      2),
        "netProfit":         round(net_profit,        2),
        "marginPct":         margin_pct,
        "approvedCount":     len(approved),
        "pendingCount":      len(pending),
        "pendingAmount":     round(pending_amount,    2),
        "infraBreakdown":    [
            {
                "id":          c.id,
                "category":    c.category,
                "label":       c.label,
                "amountFcfa":  c.amount_fcfa,
                "amountUsd":   c.amount_usd,
                "period":      c.period,
                "invoiceUrl":  c.invoice_url,
                "addedBy":     f"{c.added_by_user.first_name} {c.added_by_user.last_name}" if c.added_by_user else None,
                "createdAt":   c.created_at.isoformat() + "Z",
            } for c in sorted(infra_costs, key=lambda x: x.period, reverse=True)
        ],
    }


@router.get("/infra-costs")
def list_infra_costs(
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    costs = db.query(InfrastructureCost).order_by(InfrastructureCost.period.desc(), InfrastructureCost.created_at.desc()).all()
    return [
        {
            "id":         c.id,
            "category":   c.category,
            "label":      c.label,
            "amountFcfa": c.amount_fcfa,
            "amountUsd":  c.amount_usd,
            "period":     c.period,
            "invoiceUrl": c.invoice_url,
            "addedBy":    f"{c.added_by_user.first_name} {c.added_by_user.last_name}" if c.added_by_user else None,
            "createdAt":  c.created_at.isoformat() + "Z",
        } for c in costs
    ]


@router.post("/infra-costs", status_code=201)
def add_infra_cost(
    body: InfraCostIn,
    current_user: User = Depends(require_roles("FINANCE_AGENT")),
    db: Session = Depends(get_db),
):
    cost = InfrastructureCost(
        category=body.category,
        label=body.label,
        amount_fcfa=body.amount_fcfa,
        amount_usd=body.amount_usd,
        period=body.period,
        invoice_url=body.invoice_url,
        added_by=current_user.id,
    )
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return {"id": cost.id, "label": cost.label, "amountFcfa": cost.amount_fcfa}


@router.delete("/infra-costs/{cost_id}", status_code=204)
def delete_infra_cost(
    cost_id: str,
    current_user: User = Depends(require_roles("FINANCE_AGENT")),
    db: Session = Depends(get_db),
):
    cost = db.query(InfrastructureCost).filter(InfrastructureCost.id == cost_id).first()
    if not cost:
        raise HTTPException(404)
    db.delete(cost)
    db.commit()


@router.get("/pnl")
def pnl_report(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    """Monthly P&L breakdown."""
    req_q = db.query(CreditRequest).filter(CreditRequest.status == "approved")
    req_q = _apply_date_filter(req_q, CreditRequest.validated_at, from_date, to_date)
    approved = req_q.all()

    ai_q = db.query(AIUsage)
    ai_q = _apply_date_filter(ai_q, AIUsage.created_at, from_date, to_date)
    usages = ai_q.all()

    infra = db.query(InfrastructureCost).all()

    # Group by month
    months: dict = {}

    for r in approved:
        if not r.validated_at: continue
        key = r.validated_at.strftime("%Y-%m")
        months.setdefault(key, {"revenue": 0, "aiCost": 0, "infraCost": 0, "credits": 0})
        months[key]["revenue"] += r.amount_validated or 0

    for u in usages:
        key = u.created_at.strftime("%Y-%m")
        months.setdefault(key, {"revenue": 0, "aiCost": 0, "infraCost": 0, "credits": 0})
        months[key]["aiCost"]  += u.cost_fcfa
        months[key]["credits"] += float(getattr(u, "credits_cost", 0) or 0)

    for c in infra:
        key = c.period
        months.setdefault(key, {"revenue": 0, "aiCost": 0, "infraCost": 0, "credits": 0})
        months[key]["infraCost"] += c.amount_fcfa

    rows = []
    for month, v in sorted(months.items()):
        net = v["revenue"] - v["aiCost"] - v["infraCost"]
        rows.append({
            "month":      month,
            "revenue":    round(v["revenue"],   2),
            "aiCost":     round(v["aiCost"],    4),
            "infraCost":  round(v["infraCost"], 2),
            "totalCost":  round(v["aiCost"] + v["infraCost"], 2),
            "grossProfit": round(v["revenue"] - v["aiCost"], 2),
            "netProfit":  round(net,             2),
            "credits":    round(v["credits"],    2),
            "marginPct":  round(net / v["revenue"] * 100, 1) if v["revenue"] > 0 else None,
        })

    return rows
