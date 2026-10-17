from fastapi import APIRouter

from ..database import utcnow
from ..deps import DB, AdminOperator
from ..schemas.statistics import StatisticsOut
from ..services import statistics_service

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("", response_model=StatisticsOut)
def statistics(db: DB, _: AdminOperator):
    return statistics_service.compute(db, utcnow())
