# Radar-FX MetaTrader Bridge

Este diretório contém os scripts necessários para conectar o sistema Radar-FX aos terminais MetaTrader 4 (MT4) e MetaTrader 5 (MT5).

## Opções de Conectividade

### 1. MetaTrader 5 (MT5) - Python
Utilizamos a biblioteca oficial `MetaTrader5` do Python para comunicação direta. O script `mt5_bridge.py` atua como um servidor intermediário que recebe comandos via HTTP/WebSocket do nosso backend Node.js e executa no terminal.

**Requisitos:**
- Python 3.8+ 
- `pip install MetaTrader5 flask flask-socketio`

### 2. MetaTrader 4 (MT4) - MQL4 WebSockets
Como o MT4 não possui uma biblioteca Python oficial de alto nível, utilizamos um Expert Advisor (EA) ou Script em MQL4 que se conecta a um servidor WebSocket (nosso backend ou bridge) para enviar cotações e receber ordens.

## Fluxo de Dados
1. **Análise**: O Backend Radar-FX analisa os dados e gera sinais.
2. **Comando**: O Backend envia uma requisição para a Bridge.
3. **Execução**: A Bridge interage com o Terminal MT4/MT5 para abrir/fechar ordens.
4. **Confirmação**: A Bridge retorna o resultado da operação para o Dashboard.
