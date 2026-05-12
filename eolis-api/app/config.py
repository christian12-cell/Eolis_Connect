from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "eolis-connect-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    # Comma-separated allowed origins (dev + prod)
    ALLOWED_ORIGINS: str = "http://localhost:3000"

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

    # OpenAI — BL extraction
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # AWS S3 for file uploads in production
    USE_S3: bool = False
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-1"
    AWS_S3_BUCKET: str = ""

    model_config = {"env_file": ".env"}

settings = Settings()
