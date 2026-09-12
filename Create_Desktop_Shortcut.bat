@echo off
title Create Desktop Shortcut
chcp 65001 > nul
cd /d "%~dp0"

echo ====================================================
echo Creating a Desktop shortcut...
echo ====================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"

echo.
echo Desktop shortcut created successfully!
echo You can now open the App from your Desktop anytime.
echo ====================================================
timeout /t 3 > nul
