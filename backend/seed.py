"""Data created on first start: the model registry's baseline, and demo accounts for
development (disable those with SEED_DEMO_OPERATORS=0)."""
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import config
from .models import AIModel, ModelSource, Operator, Role
from .password_policy import validate_new_password
from .security import hash_password

DEMO_SUPERADMIN = ("superadmin", "Super Admin", Role.SUPERADMIN)

DEMO_OPERATORS = [
    DEMO_SUPERADMIN,
    ("admin1", "Operator 01", Role.ADMIN),
    ("admin2", "Operator 02", Role.ADMIN),
    ("admin3", "Operator 03", Role.ADMIN),
    ("police1", "Police Operator 01", Role.POLICE),
    ("ambulance1", "Ambulance Operator 01", Role.AMBULANCE),
    ("pompiers1", "Pompiers Operator 01", Role.POMPIERS),
    ("depannage1", "Dépannage Operator 01", Role.DEPANNAGE),
]


def upgrade_demo_operator_names(db: Session) -> None:
    """Rename only legacy default demo labels; preserve custom names and login usernames."""
    for number in range(1, 4):
        db.execute(update(Operator).where(
            Operator.username == f"admin{number}",
            Operator.role == Role.ADMIN,
            Operator.display_name == f"Admin Operator {number:02}",
        ).values(display_name=f"Operator {number:02}"))
    db.commit()


def seed_demo_operators(db: Session) -> None:
    """All demo accounts in an empty database. A database created before the super admin role
    existed gets the demo super admin, so the platform can still be administered."""
    if db.scalar(select(func.count()).select_from(Operator)):
        has_superadmin = db.scalar(select(func.count()).select_from(Operator).where(Operator.role == Role.SUPERADMIN))
        username_free = db.scalar(select(func.count()).select_from(Operator).where(Operator.username == DEMO_SUPERADMIN[0])) == 0
        accounts = [DEMO_SUPERADMIN] if not has_superadmin and username_free else []
    else:
        accounts = DEMO_OPERATORS
    if not accounts:
        return
    password = validate_new_password(config.DEMO_PASSWORD)
    db.add_all(
        Operator(username=u, display_name=name, role=role, password_hash=hash_password(password))
        for u, name, role in accounts
    )
    db.commit()


def seed_model_registry(db: Session) -> None:
    """Register the pretrained accident model as the active one (see ai/download_models.py)."""
    if db.scalar(select(func.count()).select_from(AIModel)):
        return
    db.add(
        AIModel(
            name="YOLO11x traffic accident (pretrained)",
            source=ModelSource.PRETRAINED,
            sha256="ea56e358905e79e1451170e699b21ad774ca95e12034ae1ab1f7d09fd3619cae",
            size_bytes=114_368_274,
            class_names=["accident", "vehicle"],
            map50=0.826,
            map50_95=0.600,
            precision=0.808,
            recall=0.759,
            metrics_note="Reported by its author: huggingface.co/Enos-123/traffic-accident-detection-yolo11x",
            is_active=True,
        )
    )
    db.commit()
