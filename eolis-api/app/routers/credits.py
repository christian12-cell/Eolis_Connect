import io
import os
import uuid
import mimetypes
import boto3
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CreditBalance, CreditRequest, User, Notification, AIUsage, Ticket, FinancialAuditLog, InfrastructureCost
from ..deps import get_current_user, require_roles
from ..credit_service import get_or_create_balance, FREE_CREDITS_ON_SIGNUP
from ..config import settings
from ..limiter import limiter
from ..push_service import send_push_to_user

router = APIRouter(prefix="/credits", tags=["credits"])

# Seuil maker-checker (FCFA) — au-dessus, confirmation SYSTEM_ADMIN obligatoire
LARGE_APPROVAL_THRESHOLD = 30_000

def _audit(db: Session, user_id: str, action: str, entity_id: str | None = None,
           amount: float | None = None, details: str | None = None, ip: str | None = None):
    db.add(FinancialAuditLog(
        user_id=user_id, action=action, entity_id=entity_id,
        amount_fcfa=amount, details=details, ip_address=ip,
    ))

def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else str(request.client.host) if request.client else None


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
    background_tasks: BackgroundTasks = BackgroundTasks(),
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
    admins = db.query(User).filter(User.role.in_(["FINANCE_AGENT", "SYSTEM_ADMIN"])).all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            type="CREDIT_REQUEST_NEW",
            title="Nouvelle demande de recharge|||New top-up request",
            message=f"{client_name} a soumis une demande de {int(amount_declared)} FCFA.|||{client_name} submitted a request for {int(amount_declared)} FCFA.",
        ))

    db.commit()
    db.refresh(req)

    # Push notification to each finance agent / admin
    client_name = f"{current_user.first_name} {current_user.last_name}"
    for admin in admins:
        lang = getattr(admin, 'language', 'fr') or 'fr'
        en = lang == 'en'
        background_tasks.add_task(
            send_push_to_user, admin.id, "CREDIT_REQUEST_NEW",
            "New top-up request" if en else "Nouvelle demande de recharge",
            f"{client_name} — {int(amount_declared)} FCFA",
            f"/{lang}/finance/credits", None, None, 0,
        )

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
    current_user: User = Depends(require_roles("FINANCE_AGENT", "SYSTEM_ADMIN")),
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
@limiter.limit("10/minute")
def approve_request(
    request: Request,
    request_id: str,
    amount_received: float = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("FINANCE_AGENT")),
    db: Session = Depends(get_db),
):
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending":
        raise HTTPException(400, "Demande déjà traitée")
    if amount_received < 500:
        raise HTTPException(400, "Montant minimum 500 FCFA")
    # Option B — strict 1× : montant approuvé ≤ montant déclaré (aucun gonflement possible)
    if amount_received > req.amount_declared:
        raise HTTPException(400, f"Montant trop élevé — déclaré : {req.amount_declared} FCFA, maximum autorisé : {req.amount_declared} FCFA")

    credits_to_add = round(amount_received)

    # Option A — maker-checker : montants ≥ seuil suspendus jusqu'à confirmation SYSTEM_ADMIN
    if amount_received >= LARGE_APPROVAL_THRESHOLD:
        req.status = "pending_admin"
        req.amount_validated = amount_received
        req.credits_added = credits_to_add
        req.validated_by = current_user.id
        req.validated_at = datetime.utcnow()
        db.add(req)
        _audit(db, current_user.id, "CREDIT_PENDING_ADMIN", req.id, amount_received,
               f"client={req.client_id} credits={credits_to_add}", _client_ip(request))
        admins = db.query(User).filter(User.role == "SYSTEM_ADMIN").all()
        client_obj = db.query(User).filter(User.id == req.client_id).first()
        client_name = f"{client_obj.first_name} {client_obj.last_name}" if client_obj else req.client_id
        for admin in admins:
            db.add(Notification(
                user_id=admin.id,
                type="LARGE_CREDIT_APPROVAL",
                title=f"⚠️ Confirmation requise — {int(amount_received):,} FCFA|||⚠️ Confirmation needed — {int(amount_received):,} FCFA",
                message=(
                    f"{current_user.first_name} {current_user.last_name} a validé {int(amount_received):,} FCFA "
                    f"pour {client_name}. Votre confirmation est requise avant crédit."
                    f"|||{current_user.first_name} {current_user.last_name} approved {int(amount_received):,} FCFA "
                    f"for {client_name}. Your confirmation is required before crediting."
                ),
            ))
        db.commit()
        return {"status": "pending_admin", "creditsProposed": credits_to_add}

    bal = get_or_create_balance(req.client_id, db)
    bal.credits_total += credits_to_add
    db.add(bal)

    req.status = "approved"
    req.amount_validated = amount_received
    req.credits_added = credits_to_add
    req.validated_by = current_user.id
    req.validated_at = datetime.utcnow()
    db.add(req)

    db.add(Notification(
        user_id=req.client_id,
        type="CREDITS_ADDED",
        title="Crédits ajoutés ✓|||Credits added ✓",
        message=(
            f"{int(credits_to_add)} crédits premium ont été ajoutés à votre compte."
            f" Une question ? {settings.MAIL_SUPPORT_FROM}"
            f"|||{int(credits_to_add)} premium credits have been added to your account."
            f" Questions? {settings.MAIL_SUPPORT_FROM}"
        ),
    ))

    _audit(db, current_user.id, "CREDIT_APPROVE", req.id, amount_received,
           f"client={req.client_id} credits={credits_to_add}", _client_ip(request))

    db.commit()

    client_obj = db.query(User).filter(User.id == req.client_id).first()
    lang = getattr(client_obj, 'language', 'fr') or 'fr'
    en = lang == 'en'
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_ADDED",
        "Credits added ✓" if en else "Crédits ajoutés ✓",
        f"{int(credits_to_add)} credits added to your account." if en else f"{int(credits_to_add)} crédits ajoutés à votre compte.",
        f"/{lang}/depenses", None, None, 0,
    )

    return {"creditsAdded": credits_to_add}


@router.post("/admin/requests/{request_id}/reject")
@limiter.limit("10/minute")
def reject_request(
    request: Request,
    request_id: str,
    reason: str = Form(""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("FINANCE_AGENT")),
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
    _audit(db, current_user.id, "CREDIT_REJECT", req.id, req.amount_declared,
           f"reason={reason[:200]}", _client_ip(request))
    db.commit()

    client_obj = db.query(User).filter(User.id == req.client_id).first()
    lang = getattr(client_obj, 'language', 'fr') or 'fr'
    en = lang == 'en'
    body_txt = (f"{reason} — " if reason else "") + ("Contact us." if en else "Contactez-nous.")
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_REJECTED",
        "Top-up request rejected" if en else "Demande de recharge refusée",
        body_txt, f"/{lang}/recharger", None, None, 0,
    )

    return {"status": "rejected"}


# ── Helper ─────────────────────────────────────────────────────────────────────

def _fmt_request(r: CreditRequest) -> dict:
    return {
        "id":                   r.id,
        "clientId":             r.client_id,
        "amountDeclared":       r.amount_declared,
        "photoUrl":             r.photo_url,
        "status":               r.status,
        "amountValidated":      r.amount_validated,
        "creditsAdded":         r.credits_added,
        "rejectionReason":      r.rejection_reason,
        "createdAt":            r.created_at.isoformat() + "Z",
        "validatedAt":          r.validated_at.isoformat() + "Z" if r.validated_at else None,
        "validatedByName":      f"{r.validator.first_name} {r.validator.last_name}" if r.validator else None,
        "adminConfirmedAt":     r.admin_confirmed_at.isoformat() + "Z" if r.admin_confirmed_at else None,
        "adminConfirmedByName": f"{r.admin_confirmer.first_name} {r.admin_confirmer.last_name}" if getattr(r, "admin_confirmer", None) else None,
    }


# ── Admin maker-checker endpoints (SYSTEM_ADMIN only) ─────────────────────────

@router.post("/admin/requests/{request_id}/admin-confirm")
@limiter.limit("10/minute")
def admin_confirm_request(
    request: Request,
    request_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """2e étape 4 yeux — SYSTEM_ADMIN crédite après validation FINANCE_AGENT."""
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending_admin":
        raise HTTPException(400, "Cette demande n'est pas en attente de confirmation admin")

    credits_to_add = req.credits_added or round(req.amount_validated or 0)

    bal = get_or_create_balance(req.client_id, db)
    bal.credits_total += credits_to_add
    db.add(bal)

    req.status = "approved"
    req.admin_confirmed_by = current_user.id
    req.admin_confirmed_at = datetime.utcnow()
    db.add(req)

    db.add(Notification(
        user_id=req.client_id,
        type="CREDITS_ADDED",
        title="Crédits ajoutés ✓|||Credits added ✓",
        message=(
            f"{int(credits_to_add)} crédits premium ont été ajoutés à votre compte."
            f" Une question ? {settings.MAIL_SUPPORT_FROM}"
            f"|||{int(credits_to_add)} premium credits have been added to your account."
            f" Questions? {settings.MAIL_SUPPORT_FROM}"
        ),
    ))

    if req.validated_by:
        agent = db.query(User).filter(User.id == req.validated_by).first()
        if agent:
            db.add(Notification(
                user_id=agent.id,
                type="CREDIT_ADMIN_CONFIRMED",
                title="Approbation confirmée ✓|||Approval confirmed ✓",
                message=(
                    f"Votre approbation de {int(req.amount_validated or 0):,} FCFA a été confirmée par l'administrateur.|||"
                    f"Your approval of {int(req.amount_validated or 0):,} FCFA was confirmed by the administrator."
                ),
            ))

    _audit(db, current_user.id, "CREDIT_ADMIN_CONFIRM", req.id, req.amount_validated,
           f"client={req.client_id} credits={credits_to_add}", _client_ip(request))
    db.commit()

    client_obj2 = db.query(User).filter(User.id == req.client_id).first()
    clang = getattr(client_obj2, 'language', 'fr') or 'fr'
    cen = clang == 'en'
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_ADDED",
        "Credits added ✓" if cen else "Crédits ajoutés ✓",
        f"{int(credits_to_add)} credits added to your account." if cen else f"{int(credits_to_add)} crédits ajoutés à votre compte.",
        f"/{clang}/depenses", None, None, 0,
    )

    return {"creditsAdded": credits_to_add}


@router.post("/admin/requests/{request_id}/admin-reject")
@limiter.limit("10/minute")
def admin_reject_pending(
    request: Request,
    request_id: str,
    reason: str = Form(""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """SYSTEM_ADMIN annule une approbation en attente (maker-checker)."""
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending_admin":
        raise HTTPException(400, "Cette demande n'est pas en attente de confirmation admin")

    req.status = "rejected"
    req.rejection_reason = f"[Admin] {reason}" if reason else "[Annulé par administrateur]"
    req.admin_confirmed_by = current_user.id
    req.admin_confirmed_at = datetime.utcnow()
    db.add(req)

    reason_txt = f"{reason} — " if reason else ""
    db.add(Notification(
        user_id=req.client_id,
        type="CREDITS_REJECTED",
        title="Demande de recharge refusée|||Top-up request rejected",
        message=(
            f"{reason_txt}Contactez-nous : {settings.MAIL_SUPPORT_FROM}"
            f"|||{reason_txt}Contact us: {settings.MAIL_SUPPORT_FROM}"
        ),
    ))

    if req.validated_by:
        agent = db.query(User).filter(User.id == req.validated_by).first()
        if agent:
            db.add(Notification(
                user_id=agent.id,
                type="CREDIT_ADMIN_REJECTED",
                title="Approbation annulée|||Approval cancelled",
                message=(
                    f"Votre approbation de {int(req.amount_validated or 0):,} FCFA a été annulée par l'administrateur. "
                    f"Motif : {reason or 'non précisé'}.|||"
                    f"Your approval of {int(req.amount_validated or 0):,} FCFA was cancelled by the administrator. "
                    f"Reason: {reason or 'not specified'}."
                ),
            ))

    _audit(db, current_user.id, "CREDIT_ADMIN_REJECT", req.id, req.amount_validated,
           f"reason={reason[:200]}", _client_ip(request))
    db.commit()

    client_r = db.query(User).filter(User.id == req.client_id).first()
    clang_r = getattr(client_r, 'language', 'fr') or 'fr'
    cen_r = clang_r == 'en'
    body_r = (f"{reason} — " if reason else "") + ("Contact us." if cen_r else "Contactez-nous.")
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_REJECTED",
        "Top-up request rejected" if cen_r else "Demande de recharge refusée",
        body_r, f"/{clang_r}/recharger", None, None, 0,
    )

    # Push aussi à l'agent financier qui avait validé
    if req.validated_by:
        agent_r = db.query(User).filter(User.id == req.validated_by).first()
        if agent_r:
            ag_lang = getattr(agent_r, 'language', 'fr') or 'fr'
            ag_en = ag_lang == 'en'
            ag_body = (
                f"Your approval of {int(req.amount_validated or 0):,} FCFA was cancelled. Reason: {reason or 'not specified'}."
                if ag_en else
                f"Votre approbation de {int(req.amount_validated or 0):,} FCFA a été annulée. Motif : {reason or 'non précisé'}."
            )
            background_tasks.add_task(
                send_push_to_user, agent_r.id, "CREDIT_ADMIN_REJECTED",
                "Approval cancelled" if ag_en else "Approbation annulée",
                ag_body, f"/{ag_lang}/finance/credits", None, None, 0,
            )

    return {"status": "rejected"}


@router.post("/admin/requests/{request_id}/direct-approve")
@limiter.limit("10/minute")
def direct_approve_request(
    request: Request,
    request_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """SYSTEM_ADMIN approuve directement une grosse demande pending (sans passer par FINANCE_AGENT)."""
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending":
        raise HTTPException(400, "La demande n'est plus en attente")
    if req.amount_declared < LARGE_APPROVAL_THRESHOLD:
        raise HTTPException(400, f"Montant inférieur au seuil ({LARGE_APPROVAL_THRESHOLD} FCFA)")

    credits_to_add = round(req.amount_declared)

    bal = get_or_create_balance(req.client_id, db)
    bal.credits_total += credits_to_add
    db.add(bal)

    req.status = "approved"
    req.amount_validated = req.amount_declared
    req.credits_added = credits_to_add
    req.validated_by = current_user.id
    req.validated_at = datetime.utcnow()
    req.admin_confirmed_by = current_user.id
    req.admin_confirmed_at = datetime.utcnow()
    db.add(req)

    db.add(Notification(
        user_id=req.client_id,
        type="CREDITS_ADDED",
        title="Crédits ajoutés ✓|||Credits added ✓",
        message=(
            f"{int(credits_to_add)} crédits premium ont été ajoutés à votre compte."
            f" Une question ? {settings.MAIL_SUPPORT_FROM}"
            f"|||{int(credits_to_add)} premium credits have been added to your account."
            f" Questions? {settings.MAIL_SUPPORT_FROM}"
        ),
    ))

    _audit(db, current_user.id, "CREDIT_DIRECT_ADMIN_APPROVE", req.id, req.amount_declared,
           f"client={req.client_id} credits={credits_to_add} (approbation directe admin)", _client_ip(request))
    db.commit()

    da_client = db.query(User).filter(User.id == req.client_id).first()
    da_lang = getattr(da_client, 'language', 'fr') or 'fr'
    da_en = da_lang == 'en'
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_ADDED",
        "Credits added ✓" if da_en else "Crédits ajoutés ✓",
        f"{int(credits_to_add)} credits added to your account." if da_en else f"{int(credits_to_add)} crédits ajoutés à votre compte.",
        f"/{da_lang}/depenses", None, None, 0,
    )

    return {"creditsAdded": credits_to_add}


@router.post("/admin/requests/{request_id}/direct-reject")
@limiter.limit("10/minute")
def direct_reject_request(
    request: Request,
    request_id: str,
    reason: str = Form(""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    """SYSTEM_ADMIN rejette directement une grosse demande pending."""
    req = db.query(CreditRequest).filter(CreditRequest.id == request_id).first()
    if not req:
        raise HTTPException(404)
    if req.status != "pending":
        raise HTTPException(400, "La demande n'est plus en attente")
    if req.amount_declared < LARGE_APPROVAL_THRESHOLD:
        raise HTTPException(400, f"Montant inférieur au seuil ({LARGE_APPROVAL_THRESHOLD} FCFA)")

    req.status = "rejected"
    req.rejection_reason = f"[Admin direct] {reason}" if reason else "[Refusé directement par administrateur]"
    req.validated_by = current_user.id
    req.validated_at = datetime.utcnow()
    req.admin_confirmed_by = current_user.id
    req.admin_confirmed_at = datetime.utcnow()
    db.add(req)

    reason_txt = f"{reason} — " if reason else ""
    db.add(Notification(
        user_id=req.client_id,
        type="CREDITS_REJECTED",
        title="Demande de recharge refusée|||Top-up request rejected",
        message=(
            f"{reason_txt}Contactez-nous : {settings.MAIL_SUPPORT_FROM}"
            f"|||{reason_txt}Contact us: {settings.MAIL_SUPPORT_FROM}"
        ),
    ))

    _audit(db, current_user.id, "CREDIT_DIRECT_ADMIN_REJECT", req.id, req.amount_declared,
           f"reason={reason[:200]}", _client_ip(request))
    db.commit()

    dr_client = db.query(User).filter(User.id == req.client_id).first()
    dr_lang = getattr(dr_client, 'language', 'fr') or 'fr'
    dr_en = dr_lang == 'en'
    dr_body = (f"{reason} — " if reason else "") + ("Contact us." if dr_en else "Contactez-nous.")
    background_tasks.add_task(
        send_push_to_user, req.client_id, "CREDITS_REJECTED",
        "Top-up request rejected" if dr_en else "Demande de recharge refusée",
        dr_body, f"/{dr_lang}/recharger", None, None, 0,
    )

    return {"status": "rejected"}


# ── Proof file viewer ──────────────────────────────────────────────────────────

@router.get("/photo/{request_id}")
def get_proof_photo(
    request_id: str,
    current_user: User = Depends(require_roles("FINANCE_AGENT", "SYSTEM_ADMIN")),
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
    current_user: User = Depends(require_roles("FINANCE_AGENT", "SYSTEM_ADMIN")),
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


# ── Admin: manual credit adjustment (SYSTEM_ADMIN only) ──────────────────────

@router.post("/admin/adjust")
def admin_adjust_credits(
    request: Request,
    client_id: str = Form(...),
    amount_fcfa: float = Form(...),
    note: str = Form(""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_roles("SYSTEM_ADMIN")),
    db: Session = Depends(get_db),
):
    if amount_fcfa == 0:
        raise HTTPException(400, "amount_fcfa ne peut pas être 0")

    client = db.query(User).filter(User.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client introuvable")

    bal = get_or_create_balance(client_id, db)

    if amount_fcfa > 0:
        credits_delta = round(amount_fcfa)
        bal.credits_total += credits_delta
        action = "CREDIT_ADMIN_ADD"
        notif_title = "Crédits ajoutés ✓|||Credits added ✓"
        notif_msg = (
            f"{int(credits_delta)} crédits ont été ajoutés à votre compte par l'administrateur."
            + (f" Note : {note}" if note else "")
            + f"|||{int(credits_delta)} credits were added to your account by the administrator."
            + (f" Note: {note}" if note else "")
        )
    else:
        credits_delta = round(abs(amount_fcfa))
        credits_delta = min(credits_delta, round(bal.credits_total))
        bal.credits_total = max(0.0, bal.credits_total - credits_delta)
        credits_delta = -credits_delta
        action = "CREDIT_ADMIN_REMOVE"
        notif_title = "Ajustement de crédits|||Credits adjusted"
        notif_msg = (
            f"{abs(int(credits_delta))} crédits ont été retirés de votre compte."
            + (f" Motif : {note}" if note else "")
            + f"|||{abs(int(credits_delta))} credits were removed from your account."
            + (f" Reason: {note}" if note else "")
        )

    db.add(bal)
    db.add(Notification(
        user_id=client_id,
        type="CREDITS_ADJUSTED",
        title=notif_title,
        message=notif_msg,
    ))
    _audit(db, current_user.id, action, None, amount_fcfa,
           f"client={client_id} note={note}", _client_ip(request))
    db.commit()

    if credits_delta > 0:
        lang = getattr(client, "language", "fr") or "fr"
        en = lang == "en"
        background_tasks.add_task(
            send_push_to_user, client_id, "CREDITS_ADJUSTED",
            "Credits added ✓" if en else "Crédits ajoutés ✓",
            f"{int(credits_delta)} credits added to your account." if en
            else f"{int(credits_delta)} crédits ajoutés à votre compte.",
            f"/{lang}/depenses", None, None, 0,
        )

    new_remaining = max(0.0, bal.credits_total - bal.credits_used)
    return {
        "creditsAdjusted": credits_delta,
        "newCreditsTotal":  round(bal.credits_total, 2),
        "newRemaining":     round(new_remaining, 2),
    }


# ── Admin: benefits calculation ────────────────────────────────────────────────

@router.get("/admin/benefits")
def admin_benefits(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    urgency:   Optional[str] = Query(None),
    current_user: User = Depends(require_roles("FINANCE_AGENT", "SYSTEM_ADMIN")),
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

    ai_usages     = [u for u in usages if u.type != "sms_notification"]
    sms_usages    = [u for u in usages if u.type == "sms_notification"]
    total_ai       = sum(u.cost_fcfa for u in ai_usages)
    total_sms_cost = sum(u.cost_fcfa for u in sms_usages)
    total_api      = total_ai + total_sms_cost

    # Infra costs — filter by period (YYYY-MM) derived from date range
    infra_q = db.query(InfrastructureCost)
    if from_date and (d := _parse_from(from_date)):
        infra_q = infra_q.filter(InfrastructureCost.period >= d.strftime("%Y-%m"))
    if to_date and (d := _parse_to(to_date)):
        infra_q = infra_q.filter(InfrastructureCost.period <= d.strftime("%Y-%m"))
    total_infra_fcfa = sum(c.amount_fcfa for c in infra_q.all())
    total_credits = sum(getattr(u, "credits_cost", 0) or 0 for u in usages)
    sms_credits   = sum(getattr(u, "credits_cost", 0) or 0 for u in sms_usages)
    bl_credits      = sum(getattr(u, "credits_cost", 0) or 0 for u in usages if u.type == "bl_extraction")
    voice_credits   = sum(getattr(u, "credits_cost", 0) or 0 for u in usages if u.type == "voice_transcription")
    opening_credits = sum(getattr(u, "credits_cost", 0) or 0 for u in usages if u.type == "info_premium_opening")

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
        "totalRevenue":           round(total_revenue,                     2),
        "totalApiCost":           round(total_api,                         4),
        "aiCostFcfa":             round(total_ai,                          4),
        "smsCostFcfa":            round(total_sms_cost,                    4),
        "smsCount":               len(sms_usages),
        "smsCreditsConsumed":     round(sms_credits,                       2),
        "totalCreditsConsumed":   round(total_credits,                     2),
        "totalClientFcfa":        round(total_credits,                     2),
        "usageProfit":            round(total_credits - total_api,         4),
        "grossProfit":            round(total_revenue - total_api,         2),
        "totalInfraFcfa":         round(total_infra_fcfa,                  2),
        "netProfit":              round(total_revenue - total_api - total_infra_fcfa, 2),
        "freeCreditsGiven":       free_credits,
        "blCreditsConsumed":       round(bl_credits,                        2),
        "voiceCreditsConsumed":   round(voice_credits,                     2),
        "openingCreditsConsumed": round(opening_credits,                   2),
        "approvedRequestsCount":  len(approved),
        "pendingRequestsCount":   pending_count,
        "revenueDetails":         per_request,
    }
