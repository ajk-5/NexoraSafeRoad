"""Rule-based accident severity for the MVP (see "Accident Severity" in the README)."""
from enum import Enum


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# Services alerted (simulated) for each severity level.
RESPONDERS: dict[Severity, list[str]] = {
    Severity.LOW: ["police", "depannage"],
    Severity.MEDIUM: ["police", "ambulance", "depannage"],
    Severity.HIGH: ["police", "pompiers", "ambulance", "depannage"],
}


def classify(vehicles: int, people: int, fire: bool = False, overturned: bool = False) -> Severity:
    if fire or overturned or people >= 2 or vehicles >= 3:
        return Severity.HIGH
    if vehicles >= 2 or people >= 1:
        return Severity.MEDIUM
    return Severity.LOW
