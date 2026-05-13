from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from ..ws_manager import ws_manager
from ..security import decode_token
from ..database import SessionLocal
from ..models import User, Ticket

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/ticket/{ticket_id}")
async def ticket_ws(
    websocket: WebSocket,
    ticket_id: str,
    token: str = Query(default=""),
):
    # ── Authenticate ──────────────────────────────────────────────────────────
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user   = db.query(User).filter(User.id == user_id).first()
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not user or not ticket:
            await websocket.close(code=4004)
            return
        if user.role == "CLIENT" and ticket.client_id != user.id:
            await websocket.close(code=4003)
            return
    finally:
        db.close()

    # ── Accept & listen ───────────────────────────────────────────────────────
    await ws_manager.connect(ticket_id, websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(ticket_id, websocket)
