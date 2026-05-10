from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FAQ
from ..schemas import FAQResponse

router = APIRouter(prefix="/faq", tags=["faq"])


@router.get("", response_model=list[FAQResponse])
def list_faq(locale: str = "fr", db: Session = Depends(get_db)):
    return db.query(FAQ).filter(FAQ.locale == locale).order_by(FAQ.order.asc()).all()
