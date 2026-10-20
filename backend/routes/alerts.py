from fastapi import APIRouter

from ..database import utcnow
from ..deps import DB, CurrentOperator, ServiceOperator
from ..models import Alert, AlertStatus, Operator
from ..schemas.alert import AlertOut, AlertStatusUpdate
from ..services import alert_service, station_service
from .incidents import station_out

router = APIRouter(prefix="/alerts", tags=["alerts"])


def alert_out(alert: Alert, viewer: Operator) -> AlertOut:
    incident = alert.incident
    return AlertOut(
        id=alert.id,
        incident_id=incident.id,
        incident_reference=incident.reference,
        service_type=alert.service_type,
        status=alert.status,
        severity=incident.severity,
        location=incident.location,
        latitude=incident.latitude,
        longitude=incident.longitude,
        vehicles=incident.vehicles,
        possible_injuries=incident.possible_injuries,
        assigned_operator=alert.assigned_operator.display_name if alert.assigned_operator else None,
        station=station_out(station_service.sent_station(alert)),
        sent_at=alert.sent_at,
        accepted_at=alert.accepted_at,
        resolved_at=alert.resolved_at,
        can_accept=alert.status == AlertStatus.SENT and viewer.service == alert.service_type,
        can_update=alert.assigned_operator_id == viewer.id and alert.status != AlertStatus.RESOLVED,
    )


@router.get("", response_model=list[AlertOut])
def list_alerts(db: DB, viewer: CurrentOperator, status: AlertStatus | None = None):
    """Admins see every alert; a service operator only their service's."""
    return [alert_out(a, viewer) for a in alert_service.visible_to(db, viewer, status)]


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: DB, viewer: CurrentOperator):
    return alert_out(alert_service.get_visible(db, viewer, alert_id), viewer)


@router.post("/{alert_id}/accept", response_model=AlertOut)
def accept(alert_id: int, db: DB, operator: ServiceOperator):
    alert = alert_service.accept(db, alert_id, operator, utcnow())
    db.commit()
    return alert_out(alert, operator)


@router.post("/{alert_id}/status", response_model=AlertOut)
def update_status(alert_id: int, body: AlertStatusUpdate, db: DB, operator: ServiceOperator):
    alert = alert_service.advance(db, alert_id, operator, body.status, utcnow())
    db.commit()
    return alert_out(alert, operator)
