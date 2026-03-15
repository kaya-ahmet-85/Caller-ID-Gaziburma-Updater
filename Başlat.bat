@echo off
REM Caller ID Programini Baslatma Kısayolu
echo Siparis Takip (Caller ID) Sistemi Baslatiliyor...
echo.
cd /d "%~dp0"
npm run dev:electron
pause
