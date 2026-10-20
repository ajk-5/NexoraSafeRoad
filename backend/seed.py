"""Data created on first start: the model registry's baseline, and demo accounts for
development (disable those with SEED_DEMO_OPERATORS=0)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AIModel, ModelSource, Operator, Role
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
