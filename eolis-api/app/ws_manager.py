"""
Ticket WebSocket manager — one room per ticket_id.
Broadcast lightweight "refresh" events so clients re-fetch via REST.
This keeps message serialization logic in one place (REST schemas).

Also tracks user presence: which users have an active WebSocket on which ticket.
Used by push_service to avoid sending push notifications to users already on the page.
"""
from __future__ import annotations
from collections import defaultdict
from fastapi import WebSocket


class TicketWSManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = defaultdict(list)
        # user_id → set of ticket_ids where they have an active WS
        self._presence: dict[str, set[str]] = defaultdict(set)

    async def connect(self, ticket_id: str, ws: WebSocket, user_id: str | None = None):
        await ws.accept()
        self._rooms[ticket_id].append(ws)
        if user_id:
            self._presence[user_id].add(ticket_id)

    def disconnect(self, ticket_id: str, ws: WebSocket, user_id: str | None = None):
        self._rooms[ticket_id] = [c for c in self._rooms[ticket_id] if c is not ws]
        if user_id:
            self._presence[user_id].discard(ticket_id)

    def is_user_on_ticket(self, user_id: str, ticket_id: str) -> bool:
        """True si l'utilisateur a un WebSocket actif sur ce ticket."""
        return ticket_id in self._presence.get(user_id, set())

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
