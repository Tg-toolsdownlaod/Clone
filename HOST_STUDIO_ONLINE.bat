@echo off
chcp 65001 >nul
title Cheatz Dubbing Studio - Public Online Host
color 0b

echo ====================================================================
echo AI Cinema Dubbing Studio (Khmer) - 1-Click Online Hosting
echo ====================================================================
echo.

cd /d "%~dp0"

:: 1. Check if Studio server is already running on port 3000
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Starting Studio Server (Port 3000)...
    if exist ".venv\Scripts\python.exe" (
        start "Cheatz Dabber Server" cmd /k ".venv\Scripts\python.exe server.py"
    ) else (
        start "Cheatz Dabber Server" cmd /k "python server.py"
    )
    timeout /t 3 >nul
) else (
    echo [1/2] Studio Server is already running at http://localhost:3000!
)

echo.
echo [2/2] Creating a Public HTTPS Link so others can access it from outside...
echo ====================================================================

if exist "%~dp0cloudflared.exe" (
    echo Using the Cloudflare High-Speed Tunnel...
    "%~dp0cloudflared.exe" tunnel --url http://localhost:3000
) else (
    echo Creating a Public URL via Localtunnel...
    npx -y localtunnel --port 3000
)

pause
