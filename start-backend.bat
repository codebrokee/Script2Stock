@echo off
REM Start the Script2Stock backend (FastAPI on :8000). Double-click this file.
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Virtualenv not found. Set up once with:
  echo   py -m venv .venv
  echo   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
pause
