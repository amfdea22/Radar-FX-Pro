@echo off
title Radar FX - Intel Engine (Multi-Agente IA)
color 0B
echo =====================================================
echo       RADAR FX - INTEL ENGINE (MULTI-AGENTE IA)
echo =====================================================
echo.
echo Inicializando o Orquestrador Multi-Agente...
echo.
echo Agentes:
echo   [1/4] Bias & Trend Agent (SMC/Order Flow)
echo   [2/4] News & Macro Agent (Calendario Economico)
echo   [3/4] Quant Stats Agent (Z-Score/ML)
echo   [4/4] Session Intelligence Agent (Sessoes/Horarios)
echo.
echo Porta: 5004
echo.
echo =====================================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\activate" (
    echo [INFO] Criando ambiente virtual...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r server\python\requirements.txt
) else (
    call .venv\Scripts\activate
)

python -m server.python.ai_agents.intel_service 5004

if errorlevel 1 (
    echo [ERRO] Falha ao iniciar Intel Engine.
    pause
)
