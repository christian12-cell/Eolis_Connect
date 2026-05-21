import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def gen_id() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    language: Mapped[str] = mapped_column(String(5), default="fr")
    last_login_at:    Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at:   Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    login_failed_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    login_locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    login_last_ip:    Mapped[str | None] = mapped_column(String(50), nullable=True)
    pwd_hint: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tickets_as_client: Mapped[list["Ticket"]] = relationship("Ticket", foreign_keys="Ticket.client_id", back_populates="client")
    tickets_as_agent: Mapped[list["Ticket"]] = relationship("Ticket", foreign_keys="Ticket.agent_id", back_populates="agent")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="sender")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user")
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="user")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    ref: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    agent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    equipment_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    ship_line: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ship_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    voyage_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ship_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vessel_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    bl_document_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bl_documents.id"), nullable=True)
    ticket_mode: Mapped[str] = mapped_column(String(20), default="MANUEL", server_default="MANUEL")
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    urgency: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    client: Mapped["User"] = relationship("User", foreign_keys=[client_id], back_populates="tickets_as_client")
    agent: Mapped["User | None"] = relationship("User", foreign_keys=[agent_id], back_populates="tickets_as_agent")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="ticket", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="ticket", cascade="all, delete-orphan")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")
    satisfaction_rating: Mapped["SatisfactionRating | None"] = relationship("SatisfactionRating", back_populates="ticket", uselist=False, cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"))
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    sender_type: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    document_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="messages")
    sender: Mapped["User"] = relationship("User", back_populates="messages")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    ticket_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tickets.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="notifications")
    ticket: Mapped["Ticket | None"] = relationship("Ticket", back_populates="notifications")


class SatisfactionRating(Base):
    __tablename__ = "satisfaction_ratings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"), unique=True)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    score: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="satisfaction_rating")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"))
    message_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("messages.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(500))
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="attachments")


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AccountSetupToken(Base):
    __tablename__ = "account_setup_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    temp_password: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FAQ(Base):
    __tablename__ = "faqs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    locale: Mapped[str] = mapped_column(String(5))
    category: Mapped[str] = mapped_column(String(100))
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User | None"] = relationship("User", back_populates="logs")


class FinancialAuditLog(Base):
    """Immutable audit trail for every financial action."""
    __tablename__ = "financial_audit_logs"

    id: Mapped[str]           = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str]      = mapped_column(String(36), ForeignKey("users.id"))
    action: Mapped[str]       = mapped_column(String(100))   # CREDIT_APPROVE, CREDIT_REJECT, INFRA_ADD, INFRA_DELETE
    entity_id: Mapped[str | None]    = mapped_column(String(36), nullable=True)
    amount_fcfa: Mapped[float | None] = mapped_column(nullable=True)
    details: Mapped[str | None]      = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None]   = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class BLDocument(Base):
    __tablename__ = "bl_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    booking_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vessel: Mapped[str | None] = mapped_column(String(200), nullable=True)
    voyage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ets: Mapped[str | None] = mapped_column(String(20), nullable=True)
    eta: Mapped[str | None] = mapped_column(String(20), nullable=True)
    port_of_loading: Mapped[str | None] = mapped_column(String(200), nullable=True)
    port_of_discharge: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description_of_goods: Mapped[str | None] = mapped_column(Text, nullable=True)
    vessel_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_extracted: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PushSubscription(Base):
    """One row per browser/device per user."""
    __tablename__ = "push_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(100))
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")


class PushPreference(Base):
    """One row per user — all push toggles."""
    __tablename__ = "push_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, index=True)
    # Common
    new_message: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Client
    final_response: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    document_requested: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Staff
    internal_note: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    mention: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    client_msg_unread: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    final_unread: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    high_only: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    user: Mapped["User"] = relationship("User")


class InfrastructureCost(Base):
    """Manual infrastructure cost entries (Vercel, Railway, Cloudflare, etc.)."""
    __tablename__ = "infrastructure_costs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    category: Mapped[str] = mapped_column(String(50))   # vercel, railway, cloudflare, domain, other
    label: Mapped[str] = mapped_column(String(200))
    amount_fcfa: Mapped[float] = mapped_column(nullable=False)
    amount_usd: Mapped[float] = mapped_column(nullable=False)
    period: Mapped[str] = mapped_column(String(20))     # ex: "2026-05"
    invoice_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    added_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    added_by_user: Mapped["User"] = relationship("User", foreign_keys=[added_by])


class FinancialProjection(Base):
    """Objectifs financiers mensuels définis par le FINANCE_AGENT."""
    __tablename__ = "financial_projections"

    id: Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_id)
    period: Mapped[str]        = mapped_column(String(7), unique=True, nullable=False)  # YYYY-MM
    target_revenue: Mapped[float] = mapped_column(default=0.0, server_default="0")
    target_clients: Mapped[int]   = mapped_column(Integer, default=0, server_default="0")
    target_margin_pct: Mapped[float | None] = mapped_column(nullable=True)
    target_net_profit: Mapped[float | None] = mapped_column(nullable=True)
    notes: Mapped[str | None]  = mapped_column(Text, nullable=True)
    created_by: Mapped[str]    = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])


class SystemConfig(Base):
    """Key-value store for admin-configurable settings (e.g. fcfa_rate)."""
    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIUsage(Base):
    """Tracks every AI call (GPT or Whisper): tokens/duration, exact cost in USD and FCFA."""
    __tablename__ = "ai_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    ticket_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tickets.id"), nullable=True)
    bl_document_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bl_documents.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="bl_extraction", server_default="bl_extraction")
    model: Mapped[str] = mapped_column(String(50))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[float] = mapped_column(nullable=False)
    cost_fcfa: Mapped[float] = mapped_column(nullable=False)
    fcfa_rate: Mapped[float] = mapped_column(nullable=False)
    credits_cost: Mapped[float] = mapped_column(default=0.0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])
    ticket: Mapped["Ticket | None"] = relationship("Ticket", foreign_keys=[ticket_id])


class CreditBalance(Base):
    """Premium credit balance per client. 1 credit = 1 FCFA."""
    __tablename__ = "credit_balances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True)
    credits_total: Mapped[float] = mapped_column(default=0.0, server_default="0")
    credits_used: Mapped[float] = mapped_column(default=0.0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])


class CreditRequest(Base):
    """Client top-up request via mobile money."""
    __tablename__ = "credit_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    amount_declared: Mapped[float] = mapped_column(nullable=False)
    photo_url: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    amount_validated: Mapped[float | None] = mapped_column(nullable=True)
    credits_added: Mapped[float | None] = mapped_column(nullable=True)
    validated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_confirmed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    admin_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])
    validator: Mapped["User | None"] = relationship("User", foreign_keys=[validated_by])
    admin_confirmer: Mapped["User | None"] = relationship("User", foreign_keys=[admin_confirmed_by])


class MaintenanceSetting(Base):
    """Singleton row controlling maintenance mode."""
    __tablename__ = "maintenance_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_return: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
