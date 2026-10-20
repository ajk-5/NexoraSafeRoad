"""The AI suggested response (README "AI Suggested Response"): which services an incident
needs, decided from what the AI saw in the video, each with the reason shown to the admin.

Only the services the situation calls for are suggested. The admin watches the clip and
adds any other one before sending (README "Human Validation")."""
from __future__ import annotations

from ..models import Incident, ServiceType

# A pile-up this large is likely to have injured people even if nobody is visible.
PILE_UP_VEHICLES = 3


def suggest(vehicles: int, people: int, fire: bool, overturned: bool) -> list[tuple[ServiceType, str]]:
    """The services to alert and why, in the order they are shown."""
    suggestion = [(ServiceType.POLICE, "Secure the scene and manage traffic")]
    if injury := _injury_reason(vehicles, people, fire, overturned):
        suggestion.append((ServiceType.AMBULANCE, injury))
    if fire:
        suggestion.append((ServiceType.POMPIERS, "Vehicle fire"))
    elif overturned:
        suggestion.append((ServiceType.POMPIERS, "Overturned vehicle: people may be trapped, fuel may leak"))
    if fire or overturned:
        suggestion.append((ServiceType.DEPANNAGE, f"Remove the {'burnt' if fire else 'overturned'} vehicle"))
    elif vehicles >= 2:
        suggestion.append((ServiceType.DEPANNAGE, f"Remove {vehicles} damaged vehicles"))
    return suggestion


def explain(incident: Incident) -> list[tuple[ServiceType, str]]:
    """The incident's suggested services with their reasons."""
    reasons = dict(suggest(incident.vehicles, incident.people, incident.fire, incident.overturned))
    # Incidents created before these rules may list a service they no longer justify.
    return [(ServiceType(s), reasons.get(ServiceType(s), "Suggested by the AI")) for s in incident.suggested_services]


def _injury_reason(vehicles: int, people: int, fire: bool, overturned: bool) -> str | None:
    if people > 0:
        return f"{people} {'person' if people == 1 else 'people'} on the scene: possible injuries"
    if overturned:
        return "Overturned vehicle: likely injuries"
    if fire:
        return "Vehicle fire: risk of burns"
    if vehicles >= PILE_UP_VEHICLES:
        return f"Collision of {vehicles} vehicles: likely injuries"
    return None
