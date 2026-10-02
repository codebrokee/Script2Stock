@echo off
setlocal
REM ============================================================
REM  Script2Stock one-click launcher.
REM  - Skips anything already listening (:8000 backend, :5173 frontend)
REM  - Otherwise starts the backend first, waits for it to answer,
REM    then starts the frontend and opens it in your browser.
REM  Servers run in their own windows; close those windows (or
REM  Ctrl+C inside them) to stop. This window may be closed.
REM ============================================================
cd /d "%~dp0"

echo ============================================
echo  Script2Stock launcher
echo ============================================

if not exist "backend\.venv\Scripts\python.exe" (
  echo [ERROR] Backend virtualenv not found.
  echo   Set it up once with:
  echo     cd backend
  echo     py -m venv .venv
  echo     .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)

REM ---------- backend :8000 ----------
netstat -ano | findstr /C:":8000" | findstr /C:"LISTENING" >nul 2>&1
if %errorlevel%==0 goto backend_running
echo [..] Starting backend on :8000 ...
start "Script2Stock Backend" /D "%~dp0backend" cmd /k ".\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
set /a btries=0
:waitbackend
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/health -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto backendup
set /a btries+=1
if %btries% GEQ 20 goto backendfail
timeout /t 2 /nobreak >nul
goto waitbackend
:backendfail
echo [ERROR] Backend did not answer on :8000. Check the "Script2Stock Backend" window.
pause
exit /b 1
:backendup
echo [OK] Backend answering on http://localhost:8000
goto backend_done
:backend_running
echo [OK] Backend already running on http://localhost:8000 - leaving it alone.
:backend_done

REM ---------- frontend :5173 ----------
if not exist "%~dp0frontend\node_modules" (
  echo [..] First run: installing frontend dependencies ^(one-time, may take a minute^)...
  pushd "%~dp0frontend"
  call npm install
  popd
)
if not exist "%~dp0frontend\node_modules" (
  echo [ERROR] npm install did not produce node_modules. Run it manually inside frontend\.
  pause
  exit /b 1
)
netstat -ano | findstr /C:":5173" | findstr /C:"LISTENING" >nul 2>&1
if %errorlevel%==0 goto frontend_running
echo [..] Starting frontend on :5173 ...
start "Script2Stock Frontend" /D "%~dp0frontend" cmd /k npm run dev
set /a ftries=0
:waitfrontend
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:5173/ -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto frontendup
set /a ftries+=1
if %ftries% GEQ 30 goto frontendfail
timeout /t 2 /nobreak >nul
goto waitfrontend
:frontendfail
echo [ERROR] Frontend did not answer on :5173. Check the "Script2Stock Frontend" window.
pause
exit /b 1
:frontendup
echo [OK] Frontend answering on http://localhost:5173
goto frontend_done
:frontend_running
echo [OK] Frontend already running on http://localhost:5173 - leaving it alone.
:frontend_done

echo --------------------------------------------
echo  App ready: http://localhost:5173
echo  (backend http://localhost:8000 - providers: Pixabay + Wikimedia)
echo --------------------------------------------
start http://localhost:5173
exit /b 0
