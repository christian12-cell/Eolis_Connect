import os
import boto3
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Ticket, Attachment, gen_id
from ..schemas import AttachmentResponse
from ..deps import get_current_user
from ..config import settings

router = APIRouter(tags=["attachments"])
UPLOAD_DIR = "uploads"


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _upload_to_s3(content: bytes, key: str, mime_type: str) -> str:
    s3 = _s3_client()
    s3.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=mime_type or "application/octet-stream",
    )
    return f"s3://{settings.AWS_S3_BUCKET}/{key}"


def _s3_presigned_url(s3_uri: str) -> str:
    key = s3_uri.replace(f"s3://{settings.AWS_S3_BUCKET}/", "")
    s3 = _s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
        ExpiresIn=3600,
    )


@router.post("/tickets/{ticket_id}/attachments", response_model=list[AttachmentResponse])
async def upload_attachments(
    ticket_id: str,
    files: list[UploadFile] = File(...),
    source: str | None = Query(None),
    message_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(403, "Access denied")

    results = []
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        file_id = gen_id()
        stored_name = f"{file_id}{ext}"
        content = await file.read()

        if settings.USE_S3:
            key = f"tickets/{ticket_id}/{stored_name}"
            url = _upload_to_s3(content, key, file.content_type or "")
        else:
            ticket_dir = os.path.join(UPLOAD_DIR, ticket_id)
            os.makedirs(ticket_dir, exist_ok=True)
            file_path = os.path.join(ticket_dir, stored_name)
            with open(file_path, "wb") as f:
                f.write(content)
            url = file_path

        attachment = Attachment(
            ticket_id=ticket_id,
            message_id=message_id,
            filename=file.filename or stored_name,
            url=url,
            size=len(content),
            mime_type=file.content_type,
            source=source,
        )
        db.add(attachment)
        db.flush()
        results.append(attachment)

    db.commit()
    for a in results:
        db.refresh(a)
    return results


@router.get("/tickets/{ticket_id}/attachments", response_model=list[AttachmentResponse])
def list_attachments(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if current_user.role == "CLIENT" and ticket.client_id != current_user.id:
        raise HTTPException(403, "Access denied")
    return db.query(Attachment).filter(Attachment.ticket_id == ticket_id).order_by(Attachment.created_at.asc()).all()


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(404, "Not found")
    ticket = db.query(Ticket).filter(Ticket.id == attachment.ticket_id).first()
    if current_user.role == "CLIENT" and ticket and ticket.client_id != current_user.id:
        raise HTTPException(403, "Access denied")

    # S3 — redirect to presigned URL
    if attachment.url and attachment.url.startswith("s3://"):
        presigned = _s3_presigned_url(attachment.url)
        return RedirectResponse(url=presigned)

    # Local disk
    if not attachment.url or not os.path.exists(attachment.url):
        raise HTTPException(404, "File not found")
    return FileResponse(
        path=attachment.url,
        filename=attachment.filename,
        media_type=attachment.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'}
    )
