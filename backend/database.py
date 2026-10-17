from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Engine, Enum, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from . import config


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_type(enum: type[StrEnum]) -> Enum:
    # Stored as VARCHAR rather than a PostgreSQL ENUM so adding a value needs no migration.
    return Enum(enum, native_enum=False, length=32)


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on every database (SQLite drops the timezone)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        return _as_utc(value)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return _as_utc(value)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:  # naive values are UTC throughout the backend
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class Base(DeclarativeBase):
    pass


def make_engine(url: str, **kwargs) -> Engine:
    if url.startswith("sqlite"):
        kwargs.setdefault("connect_args", {"check_same_thread": False})
    return create_engine(url, **kwargs)


engine = make_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db
