@echo off
echo === Altron AI Gateway ===
echo.

echo Starting backend...
start "Altron Backend" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 >nul

echo Starting frontend...
start "Altron Frontend" cmd /k "cd /d %~dp0\ui && npm run dev"

echo.
echo Altron is running!
echo   Backend:  http://localhost:3000
echo   Frontend: http://localhost:1420
echo.
pause
