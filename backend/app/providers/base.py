"""MediaProvider interface + normalized result type."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal, Optional

import httpx


@dataclass
class NormalizedMedia:
    provider: str
    provider_id: str
    title: str = ""
    description: str = ""
    url: str = ""
    download_url: str = ""
    thumbnail_url: str = ""
    media_type: Literal["image", "video"] = "image"
    width: int = 0
    height: int = 0
    duration: float = 0.0
    license: str = "unknown"
    license_url: str = ""
    creator: str = ""
    attribution_required: bool = False


class MediaProvider(ABC):
    name: str = "base"

    @property
    def is_configured(self) -> bool:
        return True

    @abstractmethod
    async def search(
        self,
        query: str,
        client: httpx.AsyncClient,
        per_page: int = 6,
        media_type: str = "any",
    ) -> list[NormalizedMedia]:
        ...
