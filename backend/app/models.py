"""SQLModel tables + Pydantic request/response schemas."""

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField
from sqlmodel import Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------ tables
class Script(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    title: str = SQLField(index=True)
    text: str
    created_at: datetime = SQLField(default_factory=utcnow)

    scenes: list["Scene"] = Relationship(back_populates="script")


class Scene(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    script_id: int = SQLField(foreign_key="script.id", index=True)
    index: int = SQLField(index=True)
    narration: str
    start_char: int = 0
    end_char: int = 0

    script: Optional[Script] = Relationship(back_populates="scenes")
    queries: list["SearchQuery"] = Relationship(back_populates="scene")
    assets: list["MediaAsset"] = Relationship(back_populates="scene")


class SearchQuery(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    scene_id: int = SQLField(foreign_key="scene.id", index=True)
    query: str = SQLField(index=True)
    rank: int = 0

    scene: Optional[Scene] = Relationship(back_populates="queries")


class MediaAsset(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    scene_id: int = SQLField(foreign_key="scene.id", index=True)
    provider: str = SQLField(index=True)
    provider_id: str = SQLField(index=True)
    title: str = ""
    description: str = ""
    url: str = ""
    download_url: str = ""
    thumbnail_url: str = ""
    cached_thumbnail: str = ""
    media_type: str = "image"  # image | video
    width: int = 0
    height: int = 0
    duration: float = 0.0
    license: str = "unknown"
    license_url: str = ""
    creator: str = ""
    attribution_required: bool = False
    score: float = 0.0
    status: str = "candidate"  # candidate | selected | rejected

    scene: Optional[Scene] = Relationship(back_populates="assets")


class ApiCache(SQLModel, table=True):
    __tablename__ = "api_cache"
    key: str = SQLField(primary_key=True)
    response_json: str
    created_at: datetime = SQLField(default_factory=utcnow)
    ttl_seconds: int = 21600


class StoryboardSave(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    script_id: int = SQLField(foreign_key="script.id", index=True)
    state_json: str
    created_at: datetime = SQLField(default_factory=utcnow)


# ------------------------------------------------------------------ schemas
class ScriptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    text: str = Field(min_length=1, max_length=100_000)


class ErrorResponse(BaseModel):
    error: str
    detail: str = ""


class MediaAssetRead(BaseModel):
    id: int
    scene_id: int
    provider: str
    provider_id: str
    title: str
    description: str = ""
    url: str = ""
    download_url: str = ""
    thumbnail_url: str = ""
    cached_thumbnail: str = ""
    media_type: str
    width: int = 0
    height: int = 0
    duration: float = 0.0
    license: str = "unknown"
    license_url: str = ""
    creator: str = ""
    attribution_required: bool = False
    score: float = 0.0
    status: str = "candidate"


class SceneRead(BaseModel):
    id: int
    script_id: int
    index: int
    narration: str
    start_char: int
    end_char: int
    queries: list[str] = []
    media: list[MediaAssetRead] = []


class ScriptRead(BaseModel):
    id: int
    title: str
    text: str
    created_at: datetime
    scenes: list[SceneRead] = []


class StoryboardSaveCreate(BaseModel):
    script_id: int
    state: dict[str, Any]


class StoryboardSaveRead(BaseModel):
    id: int
    script_id: int
    state: dict[str, Any]
    created_at: datetime
