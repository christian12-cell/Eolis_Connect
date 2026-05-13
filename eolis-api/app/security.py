from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

CLIENT_TOKEN_HOURS = 4
STAFF_TOKEN_HOURS  = 7

def create_access_token(data: dict, role: str = "CLIENT") -> str:
    hours = CLIENT_TOKEN_HOURS if role == "CLIENT" else STAFF_TOKEN_HOURS
    expire = datetime.utcnow() + timedelta(hours=hours)
    return jwt.encode({**data, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}
