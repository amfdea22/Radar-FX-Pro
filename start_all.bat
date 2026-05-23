@echo off
title Radar-FX System
echo ============================================
echo  Radar-FX - Inicializando Sistema
echo ============================================
echo.

:: 1. Verificar se MT5 esta rodando
tasklist /FI "IMAGENAME eq terminal64.exe" 2>NUL | find /I /N "terminal64.exe" >NUL
if "%ERRORLEVEL%"=="1" (
    echo [1/4] Iniciando MetaTrader 5...
    start "" "C:\Program Files\Pepperstone MetaTrader 5\terminal64.exe"
    timeout /t 15 /nobreak >NUL
) else (
    echo [1/4] MetaTrader 5 ja esta rodando.
)

:: 2. Verificar/Iniciar bridge Python
netstat -an | find "127.0.0.1:5555" >NUL
if "%ERRORLEVEL%"=="1" (
    echo [2/4] Iniciando Python Bridge (porta 5555)...
    start /B "" "C:\Users\Deah\AppData\Local\Programs\Python\Python312\python.exe" "%~dp0bridge\mt5_bridge.py"
    timeout /t 8 /nobreak >NUL
) else (
    echo [2/4] Python Bridge ja esta rodando na porta 5555.
)

:: 3. Verificar/Iniciar servidor Node
netstat -an | find "127.0.0.1:3015" >NUL
if "%ERRORLEVEL%"=="1" (
    echo [3/4] Iniciando Servidor (porta 3015)...
    start /B "" "npx.cmd" ts-node "%~dp0server\src\index.ts"
    timeout /t 15 /nobreak >NUL
) else (
    echo [3/4] Servidor ja esta rodando na porta 3015.
)

:: 4. Verificar/Iniciar Vite
netstat -an | find "127.0.0.1:3006" >NUL
if "%ERRORLEVEL%"=="1" (
    echo [4/4] Iniciando Frontend Vite (porta 3006)...
    start /B "" "npx.cmd" vite --host "%~dp0client"
    timeout /t 8 /nobreak >NUL
) else (
    echo [4/4] Frontend Vite ja esta rodando na porta 3006.
)

echo.
echo ============================================
echo  Radar-FX PRONTO!
echo  Frontend: http://localhost:3006
echo  Server:   http://localhost:3015
echo  Bridge:   http://localhost:5555
echo ============================================
pause
