@echo off
title KhmerDub AI (Simple)
chcp 65001 > nul
cd /d "%~dp0\.."

echo ====================================================
echo Starting KhmerDub AI (Simple)...
echo ====================================================

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] .venv not found. Please run run.bat in the main project folder first to install dependencies.
    pause
    exit /b 1
)

echo [INFO] Starting server at http://localhost:4000 ...
.venv\Scripts\python.exe simple_studio\server.py
pause
