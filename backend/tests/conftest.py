"""Pytest fixtures: isolated in-memory SQLite engine."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app import models  # noqa: E402,F401
from app.database import get_session  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture()
def session(test_engine):
    with Session(test_engine) as s:
        yield s


@pytest.fixture()
def client(session):
    def override():
        yield session

    app.dependency_overrides[get_session] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
