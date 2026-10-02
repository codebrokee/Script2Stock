@echo off
REM Start the Script2Stock frontend (Vite on :5173). Backend must be running first.
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo Installing dependencies first (one-time)...
  call npm install
)
call npm run dev
pause
