@echo off
title Radar FX Super App - Master Startup
echo [INFO] Iniciando o Coração do Radar FX...

:: 1. Iniciar o Servidor (Minimizado)
echo [INFO] Ligando Motores de IA e Sincronismo (Server)...
start "Radar-FX Server" /min cmd /c "cd /d %~dp0server && npm run dev"

:: 2. Iniciar a Bridge MT5 (Minimizado)
echo [INFO] Conectando ao Terminal MetaTrader 5 (Bridge)...
start "Radar-FX Bridge" /min cmd /c "cd /d %~dp0bridge && call START_BRIDGE.bat"

:: 3. Aguardar Inicialização
echo [INFO] Sincronizando com o mercado... (10 segundos)
timeout /t 10 > nul

:: 4. Abrir no Navegador
echo [INFO] Abrindo Aplicativo...
start msedge --app=http://localhost:3015 --window-size=1280,900

echo [SUCESSO] Radar FX está online e pronto para operar! 🚀
echo [INFO] URL: http://localhost:3015
echo [INFO] Você pode fechar esta janela, o app continuará rodando em segundo plano.
timeout /t 3 > nul
exit
