import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .limiter import limiter
from sqlalchemy import text
from .config import settings
from .database import engine
from .models import Base
from .routers import auth, tickets, messages, notifications, users, faq, ratings, admin_logs, otp, attachments, bl, sessions, ai_usage, admin_config, ws, whisper, credits, finance

app = FastAPI(title="Eolis Connect API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=()"
    return response

app.include_router(auth.router, prefix="/api")
app.include_router(otp.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(faq.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(admin_logs.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(bl.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(ai_usage.router, prefix="/api")
app.include_router(admin_config.router, prefix="/api")
app.include_router(whisper.router, prefix="/api")
app.include_router(credits.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(ws.router)  # WebSocket — no /api prefix, path is /ws/ticket/{id}


def _ensure_system_admin():
    """Auto-create SYSTEM_ADMIN if none exists."""
    from .database import SessionLocal
    from .models import User
    from .security import hash_password
    import uuid
    from datetime import datetime
    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.role == "SYSTEM_ADMIN").first()
        if not exists:
            now = datetime.utcnow()
            u = User(
                id=str(uuid.uuid4()),
                first_name="Christian", last_name="DENMEKO",
                username="Christian.DENMEKO",
                email="christian.denmeko@eoliscameroun.com",
                phone="+33748523385",
                phone_verified=False,
                password_hash=hash_password("Admin@2026!"),
                role="SYSTEM_ADMIN", status="ACTIVE", language="fr",
                created_at=now, updated_at=now,
            )
            db.add(u)
            db.commit()
            print("[startup] SYSTEM_ADMIN created: Christian.DENMEKO / Admin@2026!")
    except Exception as e:
        print(f"[startup] Could not ensure SYSTEM_ADMIN: {e}")
    finally:
        db.close()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    os.makedirs("uploads", exist_ok=True)
    # Live schema migrations for columns added after initial deploy
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE tickets ALTER COLUMN equipment_type TYPE TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS code VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS vessel_data TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS source TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS document_description TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE messages ALTER COLUMN sender_type TYPE VARCHAR(30)"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bl_documents (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL REFERENCES users(id),
                filename VARCHAR(255),
                booking_no VARCHAR(100),
                vessel VARCHAR(200),
                voyage VARCHAR(100),
                ets VARCHAR(20),
                eta VARCHAR(20),
                port_of_loading VARCHAR(200),
                port_of_discharge VARCHAR(200),
                description_of_goods TEXT,
                vessel_data TEXT,
                raw_extracted TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # AI usage tracking tables
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_usage (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL REFERENCES users(id),
                ticket_id VARCHAR(36) REFERENCES tickets(id),
                bl_document_id VARCHAR(36) REFERENCES bl_documents(id),
                model VARCHAR(50) NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
                cost_fcfa DOUBLE PRECISION NOT NULL DEFAULT 0,
                fcfa_rate DOUBLE PRECISION NOT NULL DEFAULT 600,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bl_document_id VARCHAR(36)"
        ))
        conn.execute(text(
            "ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'bl_extraction'"
        ))
        conn.execute(text(
            "ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS credits_cost DOUBLE PRECISION NOT NULL DEFAULT 0"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS credit_balances (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id),
                credits_total DOUBLE PRECISION NOT NULL DEFAULT 0,
                credits_used DOUBLE PRECISION NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS financial_projections (
                id VARCHAR(36) PRIMARY KEY,
                period VARCHAR(7) NOT NULL UNIQUE,
                target_revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
                target_clients INTEGER NOT NULL DEFAULT 0,
                target_margin_pct DOUBLE PRECISION,
                target_net_profit DOUBLE PRECISION,
                notes TEXT,
                created_by VARCHAR(36) NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS target_net_profit DOUBLE PRECISION"
        ))
        conn.execute(text(
            "ALTER TABLE credit_requests ADD COLUMN IF NOT EXISTS admin_confirmed_by VARCHAR(36)"
        ))
        conn.execute(text(
            "ALTER TABLE credit_requests ADD COLUMN IF NOT EXISTS admin_confirmed_at TIMESTAMP"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS credit_requests (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL REFERENCES users(id),
                amount_declared DOUBLE PRECISION NOT NULL,
                photo_url VARCHAR(500) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                amount_validated DOUBLE PRECISION,
                credits_added DOUBLE PRECISION,
                validated_by VARCHAR(36) REFERENCES users(id),
                validated_at TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS financial_audit_logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                entity_id VARCHAR(36),
                amount_fcfa DOUBLE PRECISION,
                details TEXT,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS infrastructure_costs (
                id VARCHAR(36) PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                label VARCHAR(200) NOT NULL,
                amount_fcfa DOUBLE PRECISION NOT NULL DEFAULT 0,
                amount_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
                period VARCHAR(20) NOT NULL,
                invoice_url VARCHAR(500),
                added_by VARCHAR(36) NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.commit()

    _ensure_system_admin()
    print(f"[startup] OPENAI_API_KEY set: {bool(settings.OPENAI_API_KEY)}")
    print(f"[startup] OPENAI_MODEL: {settings.OPENAI_MODEL}")


@app.get("/")
def root():
    return {"status": "ok", "app": "Eolis Connect API"}


@app.get("/api/debug/config")
def debug_config():
    return {
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "openai_model": settings.OPENAI_MODEL,
    }


 
 
