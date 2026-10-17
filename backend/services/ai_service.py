"""The AI's response suggestion, as shown to the admin (README "AI Suggested Response").

The services themselves come from the AI pipeline (`responders` in its incident
report); this module explains each one in operator terms."""
from ..models import ServiceType

REASONS = {
    ServiceType.POLICE: "Traffic management",
    ServiceType.AMBULANCE: "Possible injuries",
    ServiceType.POMPIERS: "Vehicle extraction",
    ServiceType.DEPANNAGE: "Vehicle removal",
}


def explain(services: list[str]) -> list[tuple[ServiceType, str]]:
    return [(ServiceType(s), REASONS[ServiceType(s)]) for s in services]
