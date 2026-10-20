"""FastAPI dependencies: database session and who is calling."""
from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .errors import Forbidden, Unauthorized
from .models import Operator
from .services import operator_service

DB = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)


def current_operator(db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> Operator:
    operator = credentials and operator_service.find_by_token(db, credentials.credentials)
    if not operator:
        raise Unauthorized("NOT_AUTHENTICATED", "Please sign in.")
    return operator


def admin_operator(operator: Annotated[Operator, Depends(current_operator)]) -> Operator:
    if not operator.is_admin:
        raise Forbidden("ADMIN_ONLY", "Only Admin Operators can do this.")
    return operator


def service_operator(operator: Annotated[Operator, Depends(current_operator)]) -> Operator:
    if operator.is_admin:
        raise Forbidden("SERVICE_OPERATOR_ONLY", "Only service operators can do this.")
    return operator


def ai_client(x_api_key: Annotated[str | None, Header()] = None) -> None:
    if x_api_key is None or not hmac.compare_digest(x_api_key, config.AI_API_KEY):
        raise Unauthorized("INVALID_API_KEY", "A valid X-API-Key header is required.")


CurrentOperator = Annotated[Operator, Depends(current_operator)]
AdminOperator = Annotated[Operator, Depends(admin_operator)]
ServiceOperator = Annotated[Operator, Depends(service_operator)]
