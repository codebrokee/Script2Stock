# Script2Stock — YouTube scripts → storyboards with free stock media

Local-first tool. Backend on `:8000`, frontend on `:5173`. No paid services, no cloud.

## Prerequisites

- Python 3.11+
- Node 18+

## Quick start (Windows)

Double-click **`start-app.bat`** in the project root. It checks whether the
backend (`:8000`) and frontend (`:5173`) are already listening, starts
whatever is missing (backend first, then frontend), and opens the app in your
browser. Each server runs in its own window — close the window (or Ctrl+C) to
stop it. Individual starters (`start-backend.bat`, `start-frontend.bat`) are
also available.

## Manual setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm   # optional — regex fallback works without it
copy .env.example .env                   # then add PEXELS_API_KEY / PIXABAY_API_KEY (optional)
uvicorn app.main:app --reload --port 8000
```

Wikimedia works with no keys. If Pexels/Pixabay keys are missing the UI shows a warning and continues.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api + /thumbnails to :8000)
```

### 3. Tests

```bash
cd backend
pytest -q
```

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/scripts` | `{title, text}` → **202** `{job_id}` — generation runs in background; poll the job endpoint for live progress |
| GET | `/api/jobs/{job_id}` | `{status, stage, script_id, total_scenes, done_scenes, media_found, scenes[], error, paused, elapsed}` — poll ~1/s |
| DELETE | `/api/jobs/{job_id}` | cancel (takes effect between scenes; partial results kept, viewable via `script_id`) |
| POST | `/api/jobs/{job_id}/pause` | pause after the current scene finishes |
| POST | `/api/jobs/{job_id}/resume` | resume a paused job |
| GET | `/api/scripts/{id}/storyboard` | scenes with ranked media |
| GET | `/api/scenes/{id}/search?q=` | manual search across all providers |
| POST | `/api/scenes/{id}/media/{asset_id}/select` | mark selected |
| POST | `/api/scenes/{id}/media/{asset_id}/reject` | mark rejected |
| POST | `/api/storyboards` | `{script_id, state}` save JSON state |
| GET | `/api/storyboards` | list saved storyboards (id, title, scene count, date) |
| GET | `/api/storyboards/{id}` | load a saved storyboard state |
| GET | `/api/providers` | provider configured status |
| GET | `/api/health` | health check |

Errors: `{error, detail}` with appropriate HTTP status.

## Notes

- SQLite at `backend/data/cache.db`; thumbnails at `backend/data/thumbnails/`.
- Cache TTL: Pixabay 24h, others 6h (`api_cache` table, key = sha256 of provider+endpoint+params).
- Ranking: `keyword_overlap*0.5 + orientation*0.2 + resolution*0.2 + type_pref*0.1`, deduped, top 12/scene.
- Out of scope: video assembly, voiceover, subtitles, LLM, media downloading (thumbnails only), auth.
