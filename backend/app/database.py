"""SQLite engine + session helpers (SQLModel)."""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import settings


def _ensure_dirs() -> None:
    db_path = settings.sqlite_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    Path(settings.THUMBNAIL_DIR).mkdir(parents=True, exist_ok=True)


_ensure_dirs()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)


def create_db_and_tables() -> None:
    from . import models  # noqa: F401  (register tables)

    _ensure_dirs()
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
