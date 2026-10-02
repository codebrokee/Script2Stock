"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import create_db_and_tables
from .routers import scenes, scripts


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    Path(settings.THUMBNAIL_DIR).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Script2Stock", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail if isinstance(exc.detail, str) else "request failed",
                     "detail": str(exc.detail)},
        )
    return JSONResponse(status_code=500, content={"error": "internal server error", "detail": str(exc)})


app.include_router(scripts.router)
app.include_router(scenes.router)

_thumb_dir = Path(settings.THUMBNAIL_DIR)
_thumb_dir.mkdir(parents=True, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=str(_thumb_dir)), name="thumbnails")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "script2stock"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "script2stock", "docs": "/docs"}
