from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, Dialect, Engine, Enum, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from . import config


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_type(enum: type[StrEnum]) -> Enum:
    # Stored as VARCHAR rather than a PostgreSQL ENUM so adding a value needs no migration.
    return Enum(enum, native_enum=False, length=32)


class UTCDateTime(TypeDecorator[datetime]):
    """Timezone-aware UTC datetimes on every database (SQLite drops the timezone)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return _as_utc(value)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return _as_utc(value)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:  # naive values are UTC throughout the backend
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class Base(DeclarativeBase):
    pass


def add_missing_columns(engine: Engine) -> None:
    """Add the columns that are in the models but not yet in the database.

    create_all() creates missing tables but never changes existing ones, and there are no
    migrations yet. This handles new nullable columns, so an existing database keeps its
    data; any other schema change needs Alembic (or a fresh database)."""
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                if not column.nullable:
                    raise RuntimeError(f"Cannot add the required column {table.name}.{column.name} to an existing database.")
                kind = column.type.compile(dialect=engine.dialect)
                connection.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {kind}'))


def make_engine(url: str, **kwargs: Any) -> Engine:
    if url.startswith("sqlite"):
        kwargs.setdefault("connect_args", {"check_same_thread": False})
    return create_engine(url, **kwargs)


engine = make_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db
