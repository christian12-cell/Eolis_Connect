import io
import os
import uuid
import mimetypes
import boto3
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CreditBalance, CreditRequest, User, Notification, AIUsage, Ticket
from ..deps import get_current_user, require_roles
from ..credit_service import get_or_create_balance, FREE_CREDITS_ON_SIGNUP
from ..config import settings

router = APIRouter(prefix="/credits", tags=["credits"])


# ── Public config endpoint ─────────────────────────────────────────────────────

@router.get("/payment-info")
def payment_info():
    return {
        "orangeNumber":  settings.ORANGE_MONEY_NUMBER,
        "mtnNumber":     settings.MTN_MONEY_NUMBER,
        "accountName":   settings.PAYMENT_ACCOUNT_NAME,
        "supportEmail":  settings.MAIL_SUPPORT_FROM,
        "adminEmail":    settings.ADMIN_EMAIL,
    }


# ── S3 helpers (mirror attachments.py) ────────────────────────────────────────

def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _upload_proof(content: bytes, key: str, mime_type: str) -> str:
    s3 = _s3_client()
    s3.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=mime_type or "application/octet-stream",
    )
    return f"s3://{settings.AWS_S3_BUCKET}/{key}"


def _proof_presigned_url(s3_uri: str) -> str:
    key = s3_uri.replace(f"s3://{settings.AWS_S3_BUCKET}/", "")
    s3  = _s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
        ExpiresIn=3600,
    )


def _save_photo(content: bytes, filename: str, mime_type: str = "") -> str:
    if settings.USE_S3:
        key = f"credit-proofs/{uuid.uuid4()}-{filename}"
        return _upload_proof(content, key, mime_type)
    os.makedirs("uploads/credit-proofs", exist_ok=True)
    path = f"uploads/credit-proofs/{uuid.uuid4()}-{filename}"
    with open(path, "wb") as f:
        f.write(content)
    return path


# ── Client endpoints ───────────────────────────────────────────────────────────

@router.get("/balance")
def get_balance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "CLIENT":
        raise HTTPException(403)
    bal = get_or_create_balance(current_user.id, db)
    db.commit()
    remaining = max(0.0, bal.credits_total - bal.credits_used)
    return {
        "creditsTotal":     round(bal.credits_total, 2),
        "creditsUsed":      round(bal.credits_used,  2),
        "creditsRemaining": round(remaining,          2),
    }


@router.post("/request")
async def submit_request(
    amount_declared: float = Form(...),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "CLIENT":
        raise HTTPException(403)
    if amount_declared < 500:
        raise HTTPException(400, "Montant minimum 500 FCFA")

    content = await photo.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Photo trop volumineuse (max 10 Mo)")

    photo_url = _save_photo(content, photo.filename or "proof.jpg", photo.content_type or "")

    req = CreditRequest(
        client_id=current_user.id,
        amount_declared=amount_declared,
        photo_url=photo_url,
        status="pending",
    )
    db.add(req)
    db.flush()

    # Notify all admins (bilingual title|||message)
    client_name = f"{current_user.first_name} {current_user.last_name}"
    admins = db.query(User).filter(User.role.in_(["SYSTEM_ADMIN", "OPS_ADMIN"])).all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            type="CREDIT_REQUEST_NEW",
            title="Nouvelle demande de recharge|||New top-up request",
            message=f"{client_name} a soumis une demande de {int(amount_declared)} FCFA.|||{client_name} submitted a request for {int(amount_declared)} FCFA.",
        ))

    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": "pending"}


@router.get("/my-requests")
def my_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "CLIENT":
        raise HTTPException(403)
    rows = (
        db.query(CreditRequest)
        .filter(CreditRequest.client_id == current_user.id)
        .order_by(CreditRequest.created_at.desc())
        .limit(20)
        .all()
    )
    return [_fmt_request(r) for r in rows]


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/requests")
def admin_list_requests(
    status: Optional[str] = None,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    q = db.query(CreditRequest).order_by(CreditRequest.created_at.desc())
    if status:
        q = q.filter(CreditRequest.status == status)
    rows = q.limit(200).all()
    result = []
    for r in rows:
        client = db.query(User).filter(User.id == r.client_id).first()
        d = _fmt_request(r)
        d["clientName"] = f"{client.first_name} {client.last_name}" if client else r.client_id
        result.append(d)
    return result


@router.post("/admin/requests/{request_id}/approve")
def approve_request(
    request_id: str,
    amount_received: float = Form(...),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending":
        raise HTTPException(400, "Demande déjà traitée")
    if amount_received < 500:
        raise HTTPException(400, "Montant minimum 500 FCFA")

    credits_to_add = round(amount_received)  # 1 crédit = 1 FCFA, toujours entier

    bal = get_or_create_balance(req.client_id, db)
    bal.credits_total += credits_to_add
    db.add(bal)

    req.status = "approved"
    req.amount_validated = amount_received
    req.credits_added = credits_to_add
    req.validated_by = current_user.id
    req.validated_at = datetime.utcnow()
    db.add(req)

    notif = Notification(
        user_id=req.client_id,
        type="CREDITS_ADDED",
        title="Crédits ajoutés ✓|||Credits added ✓",
        message=(
            f"{int(credits_to_add)} crédits premium ont été ajoutés à votre compte."
            f" Une question ? {settings.MAIL_SUPPORT_FROM}"
            f"|||{int(credits_to_add)} premium credits have been added to your account."
            f" Questions? {settings.MAIL_SUPPORT_FROM}"
        ),
    )
    db.add(notif)
    db.commit()
    return {"creditsAdded": credits_to_add}


@router.post("/admin/requests/{request_id}/reject")
def reject_request(
    request_id: str,
    reason: str = Form(""),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending":
        raise HTTPException(400, "Demande déjà traitée")

    req.status = "rejected"
    req.rejection_reason = reason
    req.validated_by = current_user.id
    req.validated_at = datetime.utcnow()
    db.add(req)

    reason_prefix_fr = f"{reason} — " if reason else ""
    reason_prefix_en = f"{reason} — " if reason else ""
    notif = Notification(
        user_id=req.client_id,
        type="CREDITS_REJECTED",
        title="Demande de recharge refusée|||Top-up request rejected",
        message=(
            f"{reason_prefix_fr}Contactez-nous : {settings.MAIL_SUPPORT_FROM}"
            f"|||{reason_prefix_en}Contact us: {settings.MAIL_SUPPORT_FROM}"
        ),
    )
    db.add(notif)
    db.commit()
    return {"status": "rejected"}


# ── Helper ─────────────────────────────────────────────────────────────────────

def _fmt_request(r: CreditRequest) -> dict:
    return {
        "id":              r.id,
        "clientId":        r.client_id,
        "amountDeclared":  r.amount_declared,
        "photoUrl":        r.photo_url,
        "status":          r.status,
        "amountValidated": r.amount_validated,
        "creditsAdded":    r.credits_added,
        "rejectionReason": r.rejection_reason,
        "createdAt":       r.created_at.isoformat() + "Z",
        "validatedAt":     r.validated_at.isoformat() + "Z" if r.validated_at else None,
    }


# ── Proof file viewer ──────────────────────────────────────────────────────────

@router.get("/photo/{request_id}")
def get_proof_photo(
    request_id: str,
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    photo_url = req.photo_url

    if photo_url.startswith("s3://"):
        # Stream directly from S3 — avoids all browser CORS/presigned-URL issues
        key = photo_url.replace(f"s3://{settings.AWS_S3_BUCKET}/", "")
        s3  = _s3_client()
        try:
            obj          = s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
            content_type = obj.get("ContentType", "application/octet-stream")
            return StreamingResponse(obj["Body"], media_type=content_type)
        except Exception:
            raise HTTPException(404, "File not found")

    if not os.path.exists(photo_url):
        raise HTTPException(404, "File not found")

    content_type = mimetypes.guess_type(photo_url)[0] or "application/octet-stream"
    with open(photo_url, "rb") as f:
        data = f.read()
    return StreamingResponse(io.BytesIO(data), media_type=content_type)


# ── Admin: credit balances per client ─────────────────────────────────────────

@router.get("/admin/balances")
def admin_balances(
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    rows = db.query(CreditBalance).order_by(CreditBalance.updated_at.desc()).all()
    result = []
    for b in rows:
        client = db.query(User).filter(User.id == b.client_id).first()
        result.append({
            "clientId":         b.client_id,
            "clientName":       f"{client.first_name} {client.last_name}" if client else b.client_id,
            "username":         client.username if client else None,
            "creditsTotal":     round(b.credits_total, 2),
            "creditsUsed":      round(b.credits_used,  2),
            "creditsRemaining": round(max(0.0, b.credits_total - b.credits_used), 2),
            "updatedAt":        b.updated_at.isoformat() + "Z" if b.updated_at else None,
        })
    return result


# ── Admin: benefits calculation ────────────────────────────────────────────────

@router.get("/admin/benefits")
def admin_benefits(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    urgency:   Optional[str] = Query(None),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN", "OPS_ADMIN")),
    db: Session = Depends(get_db),
):
    def _parse_from(s: str):
        try: return datetime.strptime(s, "%Y-%m-%d")
        except ValueError: return None

    def _parse_to(s: str):
        try: return datetime.strptime(s, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError: return None

    # Credit requests filtered by validation date
    req_q = db.query(CreditRequest).filter(CreditRequest.status == "approved")
    if from_date and (d := _parse_from(from_date)):
        req_q = req_q.filter(CreditRequest.validated_at >= d)
    if to_date and (d := _parse_to(to_date)):
        req_q = req_q.filter(CreditRequest.validated_at <= d)
    approved      = req_q.all()
    pending_count = db.query(CreditRequest).filter(CreditRequest.status == "pending").count()
    total_revenue = sum(r.amount_validated or 0 for r in approved)

    # AI usages filtered by date
    usage_q = db.query(AIUsage)
    if from_date and (d := _parse_from(from_date)):
        usage_q = usage_q.filter(AIUsage.created_at >= d)
    if to_date and (d := _parse_to(to_date)):
        usage_q = usage_q.filter(AIUsage.created_at <= d)
    usages = usage_q.all()

    # Urgency filter via ticket join
    urgency_list = [u.strip() for u in urgency.split(",")] if urgency else None
    if urgency_list:
        filtered = []
        for u in usages:
            ticket = None
            if u.ticket_id:
                ticket = db.query(Ticket).filter(Ticket.id == u.ticket_id).first()
            elif u.bl_document_id:
                ticket = db.query(Ticket).filter(Ticket.bl_document_id == u.bl_document_id).first()
            if ticket and ticket.urgency in urgency_list:
                filtered.append(u)
        usages = filtered

    total_api     = sum(u.cost_fcfa for u in usages)
    total_credits = sum(getattr(u, "credits_cost", 0) or 0 for u in usages)
    bl_credits    = sum(getattr(u, "credits_cost", 0) or 0 for u in usages if u.type == "bl_extraction")
    voice_credits = sum(getattr(u, "credits_cost", 0) or 0 for u in usages if u.type == "voice_transcription")

    nb_clients   = db.query(CreditBalance).count()
    free_credits = nb_clients * FREE_CREDITS_ON_SIGNUP

    per_request = []
    for req in approved:
        client = db.query(User).filter(User.id == req.client_id).first()
        per_request.append({
            "clientName":      f"{client.first_name} {client.last_name}" if client else req.client_id,
            "amountValidated": req.amount_validated,
            "creditsAdded":    req.credits_added,
            "validatedAt":     req.validated_at.isoformat() + "Z" if req.validated_at else None,
        })

    return {
        "totalRevenue":           round(total_revenue,               2),
        "totalApiCost":           round(total_api,                   4),
        "totalCreditsConsumed":   round(total_credits,               2),
        "totalClientFcfa":        round(total_credits,               2),
        "usageProfit":            round(total_credits - total_api,   4),
        "grossProfit":            round(total_revenue - total_api,   2),
        "freeCreditsGiven":       free_credits,
        "blCreditsConsumed":      round(bl_credits,                  2),
        "voiceCreditsConsumed":   round(voice_credits,               2),
        "approvedRequestsCount":  len(approved),
        "pendingRequestsCount":   pending_count,
        "revenueDetails":         per_request,
    }
