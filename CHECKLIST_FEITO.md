# CHECKLIST — O QUE JÁ FOI FEITO NO RADAR FX

## INFRAESTRUTURA
- [x] Servidor Node.js/Express criado (porta 3015)
- [x] Frontend React/Vite criado (porta 3006)
- [x] Bridge Python MT5 (porta 5555) — conexão com MetaTrader 5
- [x] Bridge FMP (porta 5556) — dados do Financial Modeling Prep
- [x] Proxy Vite configurado (/api → localhost:3015)
- [x] Script `start_radar.bat` — inicia servidor + frontend
- [x] Script `watchdog.bat` — monitora e reinicia processos a cada 30s
- [x] Script `start_all.bat` — inicia MT5 terminal + bridge + servidor + frontend
- [x] Script `INICIAR_RADAR_FX.bat` — launcher master
- [x] Variáveis de ambiente via `.env`
- [x] Config Tailwind com paleta trader personalizada
- [x] PWA configurado (manifest.json + service worker)
- [x] Ícones e assets de branding

## ROBÔS/ENGINES (13 implantados)

### Alpha Robot
- [x] Análise institucional Wyckoff + Score
- [x] ML Insights como fonte de sinais
- [x] Controle de confiança mínima (minConfidence)
- [x] Limite de trades por janela de 15min
- [x] Limite diário de trades
- [x] Lote dinâmico baseado em risco
- [x] SL/TP automático (ATR-based)
- [x] Notificação Telegram
- [x] Histórico persistido (166 trades)
- [x] Safety Lock (bloqueio de segurança)
- [x] Sync de trades com MT5

### Supreme AI
- [x] Modo Nakamoto + Intelligence 7
- [x] Modo confluência (ambas estratégias)
- [x] Alocação de capital configurável
- [x] Limite de perda e alvo diário
- [x] Notificação Telegram
- [x] Histórico persistido (299 trades)
- [x] Sync de trades com MT5

### Gold Scalper (mais avançado)
- [x] Grid trading em XAUUSD
- [x] Modos SMC e AGGRESSIVE
- [x] ATR trailing stop
- [x] News guard (filtro de notícias)
- [x] Basket mode (TP por cesta)
- [x] Smart IA (aprendizado adaptativo)
- [x] DXY filter
- [x] Calendário econômico integrado
- [x] Backtesting via GoldScalperSimulator
- [x] 62 configurações ajustáveis
- [x] 544 trades reais no histórico
- [x] Lock/unlock manual

### Bitcoin Pro
- [x] EMA 50/200 cross + RSI filter
- [x] Exclusivo BTCUSD
- [x] Lote e risco configuráveis

### Crypto IA
- [x] Análise Wyckoff + VWAP
- [x] 23+ símbolos cripto
- [x] Smart grid IA
- [x] Fibo levels
- [x] News guard + HFT filters

### Shark Bot (corrigido)
- [x] Detecção de FVG (Fair Value Gap) — bearish + bullish
- [x] Entrada BUY (bearish FVG) e SELL (bullish FVG)
- [x] Break Even automático
- [x] Filtro SMA50 + zona de 50% de desconto
- [x] Gestão de margem (free > 15%)
- [x] Arquivo de configuração persistente (shark_bot_settings.json)
- [x] Suporte a SELL adicionado
- [x] Catálogo no SignalEngine (magic 9876)
- [x] 26 trades reais no MT5

### Swing Trader IA
- [x] Swing trading médio prazo
- [x] Filtro de swing score
- [x] ATR-based SL/TP
- [x] CoolDown entre trades
- [x] Backtesting via SwingTraderSimulator
- [x] Correção GOLD→XAUUSD

### Speed Scalper (Forex)
- [x] Grid scalping EURUSD/GBPUSD
- [x] Trailing stop
- [x] Basket TP

### Micro Sniper (Titan)
- [x] Ultra-scalping BTCUSD
- [x] Grid + RSI + sniper mode
- [x] Ciclo de 1 segundo

### Omni Probabilistic
- [x] Estratégia MHI3
- [x] Suporte a Martingale
- [x] Filtro RSI
- [x] Multi-símbolo

### Copy Trader
- [x] Seguir mestres (mirror positions)
- [x] Modo institucional

### Agent IA
- [x] Análise autônoma de FVG
- [x] Modo dry-run
- [x] Histórico de sinais
- [x] Logs em tempo real

### Golden Whale Hunter
- [x] Detecta movimentos institucionais em ouro
- [x] Gera alertas de baleia

## SINAIS E ANÁLISE
- [x] SignalEngine com 16+ tipos de sinal
- [x] VSA (Volume Spread Analysis) — No Supply, No Demand, Upthrust
- [x] ML Insights — predições, regime detection, Monte Carlo, risk metrics, news sentiment
- [x] Análise Técnica — RSI, MACD, Bollinger Bands
- [x] Smart Momentum
- [x] Intelligence 7
- [x] Alpha Shark
- [x] Shark Hunt XAU
- [x] Golden Rejection
- [x] Alpha Nakamoto
- [x] Ethereum Core
- [x] Crypto Whale Hunt
- [x] Altcoin Sniper
- [x] SentimentService — fear/greed score

## RELATÓRIOS
- [x] Strategy Report Hub — relatório combinado de todas as estratégias
- [x] Classificação por comment → magic → symbol
- [x] Catálogo completo com 15 estratégias
- [x] Crypto Report
- [x] Performance Analytics
- [x] Strategy Ranking
- [x] Alpha Audit — snapshots de every trade
- [x] Suporte a sync global (/api/mt5/reports/sync)

## RISK MANAGEMENT
- [x] Trade Guardian — trailing stop, break-even, grid management
- [x] Discipline Engine — daily stop loss, max trades, consecutive losses lock
- [x] Crypto Risk Engine — limites específicos para cripto
- [x] Risk settings — capital allocation, profile selection
- [x] Guardian alerts

## UI/UX
- [x] 26 telas no desktop (App.tsx)
- [x] Layout com sidebar categorizada (PRINCIPAL, ROBÔS, TRADING, GESTÃO, SISTEMA)
- [x] Modo mobile com bottom tabs (HOME, INTEL, ROBOS, TRADE, GESTÃO)
- [x] Framer Motion animations
- [x] Lucide icons
- [x] Recharts para gráficos
- [x] Lightweight Charts para trading charts
- [x] Tailwind CSS com tema escuro
- [x] Telegram config modal
- [x] Trading journal (CRUD)
- [x] Calculadora de custos
- [x] Simulador de capital
- [x] Terminal de monitoramento (Shark Bot)
- [x] Gráfico de profundidade FVG (Shark Bot)

## TELEGRAM
- [x] Notificações de trade open/close
- [x] Resumo diário agendado (18:00)
- [x] Removidos GIFs animados (sendAnimation, sendDice)
- [x] ML Insights toggle no Telegram
- [x] Teste de envio (/api/mt5/telegram/test)

## DIVERSOS
- [x] AlertEngine — sistema centralizado de alertas
- [x] MarketDataService — agregação de dados (MT5 + LiteFinance + Polygon)
- [x] ConfigService — leitura/escrita de configurações
- [x] JournalService — diário de trading CRUD
- [x] Modelo XGBoost treinado (cerebro_smc_btcusd.pkl)
- [x] Treinar IA script (treinar_ia.py)
- [x] Robô de execução Python (robo_execucao.py)
- [x] Correção GOLD→XAUUSD no SwingTrader
- [x] Correção lote manual 0.02 (era 0.01)
- [x] Remoção XAGUSD/WTI do ML Insight
- [x] Menu ROBÔS realocado (Supreme/Omni → ROBÔS, Copy → TRADING)
- [x] Comentários nos trades do AlphaV2 incluem nome da estratégia
