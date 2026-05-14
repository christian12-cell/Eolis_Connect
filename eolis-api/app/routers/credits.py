import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CreditBalance, CreditRequest, User, Notification
from ..deps import get_current_user, require_roles
from ..credit_service import get_or_create_balance, FREE_CREDITS_ON_SIGNUP
from ..config import settings

router = APIRouter(prefix="/credits", tags=["credits"])

ORANGE_NUMBER = "689 506 319"
MTN_NUMBER    = "676 652 945"
ACCOUNT_NAME  = "Blandine Denmeko"

# ── Upload helper (reuse S3/local pattern from attachments) ────────────────────

def _save_photo(content: bytes, filename: str) -> str:
    if getattr(settings, "USE_S3", False):
        import boto3, io
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        key = f"credit-proofs/{uuid.uuid4()}-{filename}"
        s3.upload_fileobj(io.BytesIO(content), settings.AWS_S3_BUCKET, key)
        return f"s3://{settings.AWS_S3_BUCKET}/{key}"
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

    photo_url = _save_photo(content, photo.filename or "proof.jpg")

    req = CreditRequest(
        client_id=current_user.id,
        amount_declared=amount_declared,
        photo_url=photo_url,
        status="pending",
    )
    db.add(req)
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

    credits_to_add = amount_received  # 1 crédit = 1 FCFA

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
        title="Crédits ajoutés ✓",
        message=f"{int(credits_to_add)} crédits premium ont été ajoutés à votre compte.",
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

    notif = Notification(
        user_id=req.client_id,
        type="CREDITS_REJECTED",
        title="Demande de recharge refusée",
        message=reason or "Votre demande de recharge a été refusée. Contactez le support.",
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
