@echo off
title KhmerDub AI (Simple)
chcp 65001 > nul
cd /d "%~dp0\.."

echo ====================================================
echo 🎬 កំពុងចាប់ផ្តើម KhmerDub AI (Simple)
echo ====================================================

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] រកមិនឃើញ .venv ទេ។ សូមរត់ run.bat នៅ Folder ចម្បងជាមុនសិន ដើម្បីដំឡើង Dependencies។
    pause
    exit /b 1
)

echo [INFO] បើកដំណើរការ Server លើ http://localhost:4000 ...
.venv\Scripts\python.exe simple_studio\server.py
pause
