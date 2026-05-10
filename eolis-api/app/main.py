import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .config import settings
from .database import engine
from .models import Base
from .routers import auth, tickets, messages, notifications, users, faq, ratings, admin_logs, otp, attachments

app = FastAPI(title="Eolis Connect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        conn.commit()

    _ensure_system_admin()


@app.get("/")
def root():
    return {"status": "ok", "app": "Eolis Connect API"}
