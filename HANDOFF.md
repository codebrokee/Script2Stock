# Handoff — continuing Script2Stock on a new machine

Read this first, then `SESSION_TRANSCRIPT.md` (full conversation) if you need detail.

## Where things stand
- App is complete and verified: FastAPI backend (`:8000`) + React/Vite frontend (`:5173`).
- Matching pipeline v6 in `backend/app/core/`: shaped queries → semantic rerank
  (MiniLM, SQLite embedding cache) → RRF fusion → junk filtering → per-job
  diversity → feedback reweighting. Eval: 20 golden scenes, P@5 0.60 / hit 1.0,
  zero regressions across layers (`backend/tests/run_eval.py`, `results.csv`).
- Frontend had a 6-stage refactor + 5-part Studio Dark polish. All committed.
- Tests: 46/46 backend (pytest), 12 frontend (vitest). `git log --oneline` tells the story.

## Gotchas learned the hard way
1. **One backend at a time.** Two uvicorns on `:8000` both bind (Windows
   `SO_REUSEADDR`) and requests route to the oldest — a stale server will
   mysteriously serve old code. Check with `netstat -ano | Select-String ':8000'`.
2. **Always use the venv + `start-app.bat`.** A system-Python server lacks deps
   and fights for the port.
3. The loopback listener occasionally dies (`WinError 64`, deaf process);
   restart the backend if polling hangs. Frontend detects this (offline card).
4. Copied virtualenvs break — recreate with `pip install -r requirements.txt`.
5. Wikimedia needs a `User-Agent` (403 otherwise); image CDN is IP-throttled,
   so thumbnail caching degrades gracefully.
6. Never cache empty provider results; MiniLM ties at ~1e-7 are not real ties
   (don't write tests that depend on stable float ties).
7. Pexels is not issuing API keys — Pixabay + Wikimedia only.

## Environment notes (old PC)
- Python 3.11.9 via `py` launcher, Node 24, project at
  `C:\Users\OluwaseunFadipe\Documents\Script2stock`.
- `backend/.env` holds the Pixabay key (gitignored — copy it manually).
- `backend/data/` (gitignored) holds `cache.db` (scripts/boards/feedback),
  thumbnails, and the MiniLM weights (~90 MB, re-download automatically).
- Full install: `pip install -r requirements.txt` (torch CPU ~200 MB),
  `python -m spacy download en_core_web_sm`, `npm install`.
