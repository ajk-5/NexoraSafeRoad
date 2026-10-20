from enum import StrEnum


class Role(StrEnum):
    ADMIN = "ADMIN"
    POLICE = "POLICE"
    AMBULANCE = "AMBULANCE"
    POMPIERS = "POMPIERS"
    DEPANNAGE = "DEPANNAGE"


class OperatorStatus(StrEnum):
    ACTIVE = "ACTIVE"  # connected, can receive new work
    BUSY = "BUSY"  # handling one incident or intervention
    PAUSED = "PAUSED"  # connected, but no new work is assigned
    OFFLINE = "OFFLINE"  # logged out or no heartbeat


class Severity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class IncidentStatus(StrEnum):
    DETECTED = "DETECTED"
    WAITING_FOR_OPERATOR = "WAITING_FOR_OPERATOR"
    ASSIGNED = "ASSIGNED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ALERT_SENT = "ALERT_SENT"
    DECLINED = "DECLINED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


# An incident is locked to its admin while in one of these statuses.
LOCKED_STATUSES = (IncidentStatus.ASSIGNED, IncidentStatus.UNDER_REVIEW)


class ServiceType(StrEnum):
    POLICE = "POLICE"
    AMBULANCE = "AMBULANCE"
    POMPIERS = "POMPIERS"
    DEPANNAGE = "DEPANNAGE"


class AlertStatus(StrEnum):
    SENT = "SENT"  # waiting for a service operator to accept it
    ACCEPTED = "ACCEPTED"
    EN_ROUTE = "EN_ROUTE"
    ON_SCENE = "ON_SCENE"
    RESOLVED = "RESOLVED"


class ModelSource(StrEnum):
    PRETRAINED = "PRETRAINED"  # downloaded weights, kept by the AI side (ai/download_models.py)
    TRAINED = "TRAINED"  # produced by a training job, stored by the backend


class TrainingStatus(StrEnum):
    QUEUED = "QUEUED"  # waiting for a training worker
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


FINISHED_TRAINING_STATUSES = (TrainingStatus.COMPLETED, TrainingStatus.FAILED, TrainingStatus.CANCELLED)


# The intervention flow, in order. An operator can only move an alert forward.
ALERT_FLOW = list(AlertStatus)
# A service operator is busy while holding an alert in one of these statuses.
ACTIVE_ALERT_STATUSES = (AlertStatus.ACCEPTED, AlertStatus.EN_ROUTE, AlertStatus.ON_SCENE)
