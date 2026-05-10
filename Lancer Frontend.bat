@echo off
title Eolis Connect — Frontend (Next.js)
color 07

echo.
echo  =========================================
echo     EOLIS CONNECT — FRONTEND  (port 3000)
echo  =========================================
echo.

echo  Arret des anciens processus sur le port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo  OK
echo.

echo  Nettoyage du cache Turbopack...
if exist "%~dp0eolis-connect\.next" rmdir /s /q "%~dp0eolis-connect\.next"
echo  OK
echo.

echo  Demarrage de Next.js...
echo  Frontend : http://localhost:3000
echo.
echo  =========================================
echo.

cd /d "%~dp0eolis-connect"
npm run dev
