from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import utcnow
from ..deps import DB, AdminOperator, CurrentOperator
from ..models import Operator
from ..schemas.operator import OperatorOut
from ..services import assignment_service, operator_service

router = APIRouter(prefix="/operators", tags=["operators"])


def operator_out(db: Session, operator: Operator) -> OperatorOut:
    return OperatorOut(
        id=operator.id,
        username=operator.username,
        display_name=operator.display_name,
        role=operator.role,
        status=operator.status,
        last_seen_at=operator.last_seen_at,
        current_incident_id=assignment_service.current_incident_id(db, operator),
    )


@router.get("", response_model=list[OperatorOut])
def list_operators(db: DB, _: AdminOperator):
    """Everyone's availability, for the admin dashboard."""
    operators = db.scalars(select(Operator).order_by(Operator.role, Operator.username)).all()
    return [operator_out(db, o) for o in operators]


@router.get("/me", response_model=OperatorOut)
def me(db: DB, operator: CurrentOperator):
    return operator_out(db, operator)


@router.post("/pause", response_model=OperatorOut)
def pause(db: DB, operator: CurrentOperator):
    operator_service.pause(db, operator)
    db.commit()
    return operator_out(db, operator)


@router.post("/resume", response_model=OperatorOut)
def resume(db: DB, operator: CurrentOperator):
    operator_service.resume(db, operator, utcnow())
    db.commit()
    return operator_out(db, operator)


@router.post("/heartbeat", response_model=OperatorOut)
def heartbeat(db: DB, operator: CurrentOperator):
    operator_service.heartbeat(db, operator, utcnow())
    db.commit()
    return operator_out(db, operator)
