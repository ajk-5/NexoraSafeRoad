from typing import Annotated

from fastapi import APIRouter, Body, Depends

from ..database import utcnow
from ..deps import DB, AdminOperator, CurrentOperator, ai_client
from ..models import Incident, IncidentStatus, Operator
from ..schemas.incident import (
    IncidentAlert,
    IncidentCreate,
    IncidentOut,
    SendAlertRequest,
    ServiceSelection,
    SuggestedService,
)
from ..services import ai_service, incident_service

router = APIRouter(prefix="/incidents", tags=["incidents"])


def incident_out(incident: Incident, viewer: Operator | None = None) -> IncidentOut:
    return IncidentOut(
        id=incident.id,
        reference=incident.reference,
        camera_id=incident.camera_id,
        latitude=incident.latitude,
        longitude=incident.longitude,
        location=incident.location,
        severity=incident.severity,
        confidence=incident.confidence,
        vehicles=incident.vehicles,
        people=incident.people,
        possible_injuries=incident.possible_injuries,
        fire=incident.fire,
        overturned=incident.overturned,
        video_url=incident.video_url,
        status=incident.status,
        detected_at=incident.detected_at,
        decided_at=incident.decided_at,
        resolved_at=incident.resolved_at,
        assigned_admin=incident.assigned_admin.display_name if incident.assigned_admin else None,
        can_edit=viewer is not None and incident_service.can_edit(incident, viewer),
        suggested_services=[
            SuggestedService(service=s, reason=r) for s, r in ai_service.explain(incident.suggested_services)
        ],
        selected_services=incident.selected_services,
        alerts=[
            IncidentAlert(
                id=a.id,
                service_type=a.service_type,
                status=a.status,
                assigned_operator=a.assigned_operator.display_name if a.assigned_operator else None,
                sent_at=a.sent_at,
                accepted_at=a.accepted_at,
                resolved_at=a.resolved_at,
            )
            for a in incident.alerts
        ],
    )


@router.get("", response_model=list[IncidentOut])
def list_incidents(db: DB, viewer: CurrentOperator, status: IncidentStatus | None = None):
    return [incident_out(i, viewer) for i in incident_service.visible_to(db, viewer, status)]


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: int, db: DB, viewer: CurrentOperator):
    return incident_out(incident_service.get_visible(db, viewer, incident_id), viewer)


@router.post("", response_model=IncidentOut, status_code=201, dependencies=[Depends(ai_client)])
def report_incident(body: IncidentCreate, db: DB):
    """Called by the AI pipeline (X-API-Key header) when it confirms an accident."""
    incident = incident_service.create(db, body, utcnow())
    db.commit()
    return incident_out(incident)


@router.put("/{incident_id}/video", response_model=IncidentOut, dependencies=[Depends(ai_client)])
def upload_video(incident_id: int, video: Annotated[bytes, Body(media_type="video/mp4")], db: DB):
    """Called by the AI pipeline with the raw MP4 clip as the request body."""
    incident = incident_service.attach_video(db, incident_id, video)
    db.commit()
    return incident_out(incident)


@router.post("/{incident_id}/review", response_model=IncidentOut)
def start_review(incident_id: int, db: DB, admin: AdminOperator):
    """The admin opened the incident page (ASSIGNED -> UNDER_REVIEW)."""
    incident = incident_service.start_review(db, incident_id, admin, utcnow())
    db.commit()
    return incident_out(incident, admin)


@router.post("/{incident_id}/draft", response_model=IncidentOut)
def save_draft(incident_id: int, body: ServiceSelection, db: DB, admin: AdminOperator):
    incident = incident_service.save_draft(db, incident_id, admin, body.services, utcnow())
    db.commit()
    return incident_out(incident, admin)


@router.post("/{incident_id}/send", response_model=IncidentOut)
def send_alert(incident_id: int, body: SendAlertRequest, db: DB, admin: AdminOperator):
    incident = incident_service.send_alert(db, incident_id, admin, body.services, utcnow())
    db.commit()
    return incident_out(incident, admin)


@router.post("/{incident_id}/decline", response_model=IncidentOut)
def decline(incident_id: int, db: DB, admin: AdminOperator):
    incident = incident_service.decline(db, incident_id, admin, utcnow())
    db.commit()
    return incident_out(incident, admin)
