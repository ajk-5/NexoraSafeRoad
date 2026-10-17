"""Demo accounts for development. Disable with SEED_DEMO_OPERATORS=0."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Operator, Role
from .security import hash_password

DEMO_PASSWORD = "saferoad"

DEMO_OPERATORS = [
    ("admin1", "Admin Operator 01", Role.ADMIN),
    ("admin2", "Admin Operator 02", Role.ADMIN),
    ("admin3", "Admin Operator 03", Role.ADMIN),
    ("police1", "Police Operator 01", Role.POLICE),
    ("ambulance1", "Ambulance Operator 01", Role.AMBULANCE),
    ("pompiers1", "Pompiers Operator 01", Role.POMPIERS),
    ("depannage1", "Dépannage Operator 01", Role.DEPANNAGE),
]


def seed_demo_operators(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Operator)):
        return
    db.add_all(
        Operator(username=u, display_name=name, role=role, password_hash=hash_password(DEMO_PASSWORD))
        for u, name, role in DEMO_OPERATORS
    )
    db.commit()
