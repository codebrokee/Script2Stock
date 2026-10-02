"""Application configuration loaded from environment / .env."""
from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = BASE_DIR / "data"
THUMB_DIR = DATA_DIR / "thumbnails"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    PEXELS_API_KEY: str = ""
    PIXABAY_API_KEY: str = ""
    DATABASE_URL: str = f"sqlite:///{(DATA_DIR / 'cache.db').as_posix()}"
    CACHE_TTL_DEFAULT: int = 21600  # 6h
    CACHE_TTL_PIXABAY: int = 86400  # 24h
    THUMBNAIL_DIR: str = str(THUMB_DIR)
    # matching pipeline tuning
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    SEMANTIC_WEIGHT: float = 0.6  # final = (1-w)*keyword + w*semantic
    RRF_K: int = 60  # RRF smoothing constant; top-60 fused items get reranked

    @property
    def sqlite_path(self) -> Path:
        url = self.DATABASE_URL
        if url.startswith("sqlite:///"):
            p = Path(url.replace("sqlite:///", ""))
            if not p.is_absolute():
                p = (Path.cwd() / p).resolve()
            return p
        return DATA_DIR / "cache.db"


settings = Settings()
