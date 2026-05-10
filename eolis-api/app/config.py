from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "eolis-connect-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    FRONTEND_URL: str = "http://localhost:3000"

    MAIL_ENABLED: bool = False
    MAIL_SERVER: str = "smtp.zoho.eu"
    MAIL_PORT: int = 587
    MAIL_NOREPLY_FROM: str = ""
    MAIL_NOREPLY_PASSWORD: str = ""
    MAIL_SUPPORT_FROM: str = ""
    ADMIN_EMAIL: str = ""

    TWILIO_ENABLED: bool = False
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    model_config = {"env_file": ".env"}

settings = Settings()
