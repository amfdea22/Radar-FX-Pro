@echo off
title Radar-FX Monitor
cd /d "%~dp0"

:loop
echo [%date% %time%] Verificando processos...

netstat -ano | findstr ":3015 " >nul
if %errorlevel% neq 0 (
    echo [%date% %time%] Servidor API caido! Reiniciando...
    start /B /MIN cmd /c "cd /d "%~dp0server" && npm run dev"
)

netstat -ano | findstr ":3006 " >nul
if %errorlevel% neq 0 (
    echo [%date% %time%] Frontend caido! Reiniciando...
    start /B /MIN cmd /c "cd /d "%~dp0client" && npm run dev"
)

timeout /t 30 /nobreak >nul
goto loop
