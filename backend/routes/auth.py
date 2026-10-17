from fastapi import APIRouter

from ..database import utcnow
from ..deps import DB, CurrentOperator
from ..schemas.operator import LoginRequest, LoginResponse
from ..services import operator_service
from .operators import operator_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: DB):
    """Send the token back as `Authorization: Bearer <token>` on every other request."""
    operator, token = operator_service.login(db, body.role, body.username, body.password, utcnow())
    db.commit()
    return LoginResponse(token=token, operator=operator_out(db, operator))


@router.post("/logout", status_code=204)
def logout(db: DB, operator: CurrentOperator):
    operator_service.logout(db, operator)
    db.commit()
