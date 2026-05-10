@echo off
title Eolis API — Backend (FastAPI)
color 0A

echo.
echo  =========================================
echo     EOLIS API — BACKEND  (port 8000)
echo  =========================================
echo.

echo  Arret des anciens processus sur le port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo  OK
echo.

echo  Demarrage de FastAPI...
echo  API       : http://localhost:8000
echo  Swagger   : http://localhost:8000/docs
echo.
echo  =========================================
echo.

cd /d "%~dp0eolis-api"
.venv\Scripts\uvicorn app.main:app --reload --port 8000
