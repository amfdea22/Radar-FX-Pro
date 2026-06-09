@echo off
title Radar FX — Bridge MT5 Remota
color 0B

echo ============================================
echo   Radar FX — Bridge MT5 (Cliente Windows)
echo ============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado. Instale Python 3.11+ em https://python.org
    pause
    exit /b 1
)

:: Verificar MetaTrader5
python -c "import MetaTrader5" >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Biblioteca MetaTrader5 nao instalada.
    echo Instalando modo simulado... (apenas para testes)
    echo.
    echo Para modo real com MT5, instale:
    echo   pip install MetaTrader5
    echo.
)

:: Instalar dependencias
echo [1/3] Instalando dependencias...
pip install flask flask-cors requests -q

:: Definir variaveis (ALTERE AQUI)
set BRIDGE_API_KEY=senha_secreta_compartilhada
set BRIDGE_PORT=5555

echo [2/3] Verificando MT5...
echo.

:: Caminho do script da bridge
set BRIDGE_SCRIPT=%~dp0server\python\bridge_remote.py
if not exist "%BRIDGE_SCRIPT%" (
    echo [ERRO] bridge_remote.py nao encontrado em:
    echo   %BRIDGE_SCRIPT%
    pause
    exit /b 1
)

echo [3/3] Iniciando Bridge MT5 na porta %BRIDGE_PORT%...
echo.
echo   API Key: %BRIDGE_API_KEY%
echo   Porta:   %BRIDGE_PORT%
echo.
echo   Pressione Ctrl+C para parar
echo ============================================
echo.

python "%BRIDGE_SCRIPT%"

pause
