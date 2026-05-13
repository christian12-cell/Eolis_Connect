"""
Ticket WebSocket manager — one room per ticket_id.
Broadcast lightweight "refresh" events so clients re-fetch via REST.
This keeps message serialization logic in one place (REST schemas).
"""
from __future__ import annotations
from collections import defaultdict
from fastapi import WebSocket


class TicketWSManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, ticket_id: str, ws: WebSocket):
        await ws.accept()
        self._rooms[ticket_id].append(ws)

    def disconnect(self, ticket_id: str, ws: WebSocket):
        self._rooms[ticket_id] = [c for c in self._rooms[ticket_id] if c is not ws]

    async def broadcast(self, ticket_id: str, event: dict):
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(ticket_id, [])):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ticket_id, ws)


# Singleton shared across all routers
ws_manager = TicketWSManager()
