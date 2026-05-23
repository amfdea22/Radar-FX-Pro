@echo off
title MT5 Bridge - Radar FX
echo [INFO] Iniciando Bridge MT5 (Python)...

:: Verificar se o terminal MT5 está rodando (opcional, mas recomendado)
tasklist /FI "IMAGENAME eq terminal64.exe" 2>NUL | find /I /N "terminal64.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [AVISO] Terminal MetaTrader 5 não detectado. Certifique-se de abri-lo para operar.
)

:: Tentar rodar com python ou python3
python --version >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    python mt5_bridge.py
) else (
    python3 --version >nul 2>&1
    if "%ERRORLEVEL%"=="0" (
        python3 mt5_bridge.py
    ) else (
        echo [ERRO] Python não encontrado! Por favor, instale o Python 3.8+ e tente novamente.
        pause
    )
)
exit
