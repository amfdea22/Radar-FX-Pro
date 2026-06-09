@echo off
title Radar-FX System
cd /d "%~dp0"

echo [Radar-FX] Iniciando servidor (porta 3015)...
start /B /MIN cmd /c "cd /d "%~dp0server" && npm run dev"

echo [Radar-FX] Aguardando servidor...
timeout /t 10 /nobreak >nul

echo [Radar-FX] Sistema iniciado!
echo   URL: http://localhost:3015
echo.
echo Pressione qualquer tecla para abrir o navegador...
pause >nul
start http://localhost:3015
