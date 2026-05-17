from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel
from datetime import datetime, timezone
from typing import Optional, Annotated

# Always serialize datetimes as UTC ISO strings ending with 'Z'
UTCDatetime = Annotated[
    datetime,
    PlainSerializer(
        lambda v: (v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v)
                  .isoformat()
                  .replace('+00:00', 'Z'),
        return_type=str,
        when_used='json',
    ),
]

def camel_config():
    return ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)


# ── Auth ───────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    password: str
    language: str = "fr"

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# ── User ───────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    username: str
    email: str
    phone: Optional[str]
    phone_verified: bool = False
    role: str
    status: str
    language: str
    created_at: UTCDatetime

    model_config = camel_config()


class OtpSendRequest(BaseModel):
    phone: str
    user_id: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class OtpVerifyRequest(BaseModel):
    phone: str
    code: str
    user_id: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    language: Optional[str] = None
    new_password: Optional[str] = None  # admin password reset

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class CreateUserRequest(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: str
    phone: str
    role: str
    password: str
    language: str = 'fr'

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# ── Ticket ─────────────────────────────────────────────────────────────────────

class AIUsageSummary(BaseModel):
    id: str
    cost_usd: float
    cost_fcfa: float
    fcfa_rate: float
    model: str
    input_tokens: int
    output_tokens: int
    created_at: UTCDatetime
    model_config = camel_config()

class AIUsageAdminItem(BaseModel):
    id: str
    client_id: str
    client_first_name: Optional[str] = None
    client_last_name: Optional[str] = None
    ticket_id: Optional[str] = None
    ticket_ref: Optional[str] = None
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    cost_fcfa: float
    fcfa_rate: float
    created_at: UTCDatetime
    model_config = camel_config()

class TicketCreateRequest(BaseModel):
    category: str
    subcategory: Optional[str] = None
    equipment_type: Optional[str] = None
    ship_line: Optional[str] = None
    ship_name: Optional[str] = None
    voyage_number: Optional[str] = None
    ship_date: Optional[str] = None
    code: Optional[str] = None
    vessel_data: Optional[str] = None
    bl_document_id: Optional[str] = None
    description: str
    urgency: str = "MEDIUM"

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

class TicketUpdateRequest(BaseModel):
    agent_id: Optional[str] = None
    status: Optional[str] = None
    urgency: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

class AttachmentResponse(BaseModel):
    id: str
    ticket_id: str
    message_id: Optional[str] = None
    filename: str
    size: Optional[int]
    mime_type: Optional[str]
    source: Optional[str] = None
    created_at: UTCDatetime
    model_config = camel_config()


class TicketResponse(BaseModel):
    id: str
    ref: str
    client_id: str
    agent_id: Optional[str]
    category: str
    subcategory: Optional[str]
    equipment_type: Optional[str]
    ship_line: Optional[str]
    ship_name: Optional[str]
    voyage_number: Optional[str]
    ship_date: Optional[str]
    code: Optional[str]
    vessel_data: Optional[str]
    bl_document_id: Optional[str] = None
    description: str
    urgency: str
    status: str
    created_at: UTCDatetime
    updated_at: UTCDatetime
    taken_at: Optional[UTCDatetime]
    closed_at: Optional[UTCDatetime]
    client: Optional[UserResponse] = None
    agent: Optional[UserResponse] = None
    satisfaction_rating: Optional["RatingSimpleResponse"] = None
    attachments: list[AttachmentResponse] = []
    messages: list["MessageResponse"] = []
    ai_usage: Optional["AIUsageSummary"] = None

    model_config = camel_config()


# ── Message ────────────────────────────────────────────────────────────────────

class MessageCreateRequest(BaseModel):
    content: str
    sender_type: Optional[str] = None
    document_description: Optional[str] = None
    attachment_ids: Optional[list[str]] = None  # pre-uploaded attachment IDs to link
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

class MessageResponse(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_type: str
    content: str
    document_description: Optional[str] = None
    is_read: bool
    read_at: Optional[UTCDatetime]
    is_deleted: bool = False
    deleted_at: Optional[UTCDatetime] = None
    created_at: UTCDatetime
    sender: Optional[UserResponse] = None
    attachment_count: int = 0

    model_config = camel_config()


# ── Notification ───────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    ticket_id: Optional[str]
    type: str
    title: str
    message: str
    is_read: bool
    created_at: UTCDatetime

    model_config = camel_config()


# ── Satisfaction Rating ────────────────────────────────────────────────────────

class RatingCreateRequest(BaseModel):
    score: int
    comment: Optional[str] = None

class RatingResponse(BaseModel):
    id: str
    ticket_id: str
    client_id: str
    agent_id: str
    score: int
    comment: Optional[str]
    created_at: UTCDatetime

    model_config = camel_config()


class RatingSimpleResponse(BaseModel):
    id: str
    score: int
    comment: Optional[str]
    created_at: UTCDatetime
    model_config = camel_config()


# ── FAQ ────────────────────────────────────────────────────────────────────────

class FAQResponse(BaseModel):
    id: str
    locale: str
    category: str
    subcategory: Optional[str]
    question: str
    answer: str
    order: int

    model_config = camel_config()


TicketResponse.model_rebuild()
