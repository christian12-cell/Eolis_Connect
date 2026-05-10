import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Ticket, Attachment, gen_id
from ..schemas import AttachmentResponse
from ..deps import get_current_user

router = APIRouter(tags=["attachments"])
UPLOAD_DIR = "uploads"

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
    ticket_dir = os.path.join(UPLOAD_DIR, ticket_id)
    os.makedirs(ticket_dir, exist_ok=True)
    results = []
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        stored_name = f"{gen_id()}{ext}"
        file_path = os.path.join(ticket_dir, stored_name)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        attachment = Attachment(
            ticket_id=ticket_id,
            message_id=message_id,
            filename=file.filename or stored_name,
            url=file_path,
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
    if not os.path.exists(attachment.url):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=attachment.url,
        filename=attachment.filename,
        media_type=attachment.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'}
    )
