@echo off
title AI Voice Clone & Dubbing Studio (Python FastAPI)
chcp 65001 > nul
cd /d "%~dp0"

echo ====================================================
echo Starting AI Voice Clone and Dubbing Studio (Python)...
echo ====================================================

REM 1. Check Python / Virtualenv
if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Setting up Virtual Environment for the first time...
    where uv >nul 2>nul && (
        uv venv .venv --python 3.12
    ) || (
        python -m venv .venv
    )
    .venv\Scripts\pip install -r requirements.txt
)

REM 2. Check FFmpeg in bin/ or system PATH
if not exist "bin\ffmpeg.exe" (
    where ffmpeg >nul 2>nul || (
        echo [INFO] FFmpeg not found, downloading automatically...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile 'ffmpeg.zip'; Expand-Archive 'ffmpeg.zip' -DestinationPath 'temp_ffmpeg'; mkdir -p bin; Move-Item 'temp_ffmpeg\*\bin\ffmpeg.exe' bin\; Move-Item 'temp_ffmpeg\*\bin\ffprobe.exe' bin\; Remove-Item -Recurse -Force 'temp_ffmpeg', 'ffmpeg.zip';"
    )
)

echo [INFO] Starting server at http://localhost:3000 ...
start "" "Launch_Studio_App.vbs"
.venv\Scripts\python.exe server.py
