@echo off
title Radar-FX System
cd /d "%~dp0"

echo [Radar-FX] Iniciando servidor API (porta 3015)...
start /B /MIN cmd /c "cd /d "%~dp0server" && npm run dev"

echo [Radar-FX] Aguardando servidor...
timeout /t 8 /nobreak >nul

echo [Radar-FX] Iniciando frontend (porta 3006)...
start /B /MIN cmd /c "cd /d "%~dp0client" && npm run dev"

echo [Radar-FX] Sistema iniciado!
echo   API:  http://localhost:3015
echo   UI:   http://localhost:3006
echo.
echo Pressione qualquer tecla para abrir o navegador...
pause >nul
start http://localhost:3006
