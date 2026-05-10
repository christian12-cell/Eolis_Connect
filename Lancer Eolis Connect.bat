@echo off
title Eolis Connect — Lanceur
color 07

echo.
echo  ==========================================
echo     EOLIS CONNECT — Demarrage complet
echo  ==========================================
echo.

echo  [1/4] Arret des anciens processus (ports 3000 et 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo        OK
echo.

echo  [2/4] Lancement du backend FastAPI...
start "Eolis API — Backend" cmd /k "%~dp0Lancer Backend.bat"
echo        OK
echo.

echo  [3/4] Lancement du frontend Next.js...
start "Eolis Connect — Frontend" cmd /k "%~dp0Lancer Frontend.bat"
echo        OK
echo.

echo  [4/4] Attente du demarrage des deux serveurs...
echo        (La premiere compilation peut prendre 30 a 60 secondes)
echo.

:wait_backend
timeout /t 2 >nul
curl -s --max-time 2 -o nul http://localhost:8000/ 2>nul
if errorlevel 1 goto wait_backend
echo  Backend  pret  -- http://localhost:8000

:wait_frontend
timeout /t 2 >nul
curl -s --max-time 2 -o nul http://localhost:3000/ 2>nul
if errorlevel 1 goto wait_frontend
echo  Frontend pret  -- http://localhost:3000

echo.
start "" "http://localhost:3000"

echo.
echo  ==========================================
echo     SERVEURS EN LIGNE
echo  ==========================================
echo.
echo    Frontend  :  http://localhost:3000
echo    Backend   :  http://localhost:8000
echo    API Docs  :  http://localhost:8000/docs
echo.
echo  ==========================================
echo     COMPTE ADMIN
echo  ==========================================
echo.
echo    SYSTEM_ADMIN   Christian.DENMEKO     Admin@2026!
echo.
echo    (Reset DB disponible dans Admin ^ Systeme)
echo.
echo  ==========================================
echo.
echo  (Appuyez sur une touche pour fermer cette fenetre)
pause >nul
