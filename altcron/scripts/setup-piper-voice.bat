@echo off
REM ===================================================
REM Piper Voice Clone - Windows Launcher
REM Installs piper-train in WSL2
REM ===================================================

echo ===================================================
echo  Piper Voice Clone - Setup
echo ===================================================
echo.

REM Check if WSL is available
wsl --status >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] WSL2 is not installed or not available
    echo Install WSL2 first: wsl --install
    pause
    exit /b 1
)

echo [1/3] Copying installation script to WSL...
wsl -d Ubuntu-22.04 -u root -- mkdir -p /tmp/piper-setup
wsl -d Ubuntu-22.04 -u root -- cp /mnt/c/Users/badge/Desktop/Проект Вдохновение/Альтрон/altcron/scripts/install-piper-train.sh /tmp/piper-setup/

echo [2/3] Running installation script...
wsl -d Ubuntu-22.04 -u root -- bash /tmp/piper-setup/install-piper-train.sh

echo [3/3] Done!
echo.
echo ===================================================
echo  Next steps:
echo  1. Open WSL: wsl -d Ubuntu-22.04
echo  2. cd /opt/piper-voice-clone
echo  3. source venv/bin/activate
echo  4. python3 record_voice.py
echo ===================================================
pause
