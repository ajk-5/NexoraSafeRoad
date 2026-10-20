"""Rule-based accident severity for the MVP (see "Severity Analysis" in the README).

Which services to alert is decided by the backend from the same observations
(backend/services/ai_service.py)."""
from enum import Enum


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


def classify(vehicles: int, people: int, fire: bool = False, overturned: bool = False) -> Severity:
    if fire or overturned or people >= 2 or vehicles >= 3:
        return Severity.HIGH
    if vehicles >= 2 or people >= 1:
        return Severity.MEDIUM
    return Severity.LOW
