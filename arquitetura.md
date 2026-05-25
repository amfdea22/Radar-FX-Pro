# Radar-FX — Arquitetura do Sistema

> **Versão:** v1.1-RESET
> **Plataforma:** Trading automatizado multi-robô com integração MetaTrader 5, análise Wyckoff/VWAP/SMC, aprendizado adaptativo e notificações Telegram.

---

## 1. Visão Geral da Arquitetura

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite/React) :3006                           │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  App.tsx → 30 telas mapeadas por activeTab                          │      │
│  │  Layout.tsx → 5 seções de menu, 30+ itens                          │      │
│  │  Proxy Vite: /api → http://127.0.0.1:3015                          │      │
│  │  44 componentes React, SoundService (Web Audio)                     │      │
│  └────────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ axios (HTTP)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Node.js/Express) :3015                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  index.ts — 80+ endpoints REST                                      │      │
│  │                                                                      │      │
│  │  ENGINES DE TRADING (14):                                            │      │
│  │  ├── AlphaRobotEngine  (magic 88881) — Multi-ativo institucional     │      │
│  │  ├── GoldScalperEngine (magic 9999)  — XAUUSD scalping              │      │
│  │  ├── SupremeEngine     (magic 7777)  — Forex/Índices                │      │
│  │  ├── CryptoIAEngine    (magic 8888)  — Criptomoedas Wyckoff+VWAP    │      │
│  │  ├── BitcoinProEngine  (magic 444111) — BTCUSD                      │      │
│  │  ├── SharkBotEngine    (magic 9876)  — FVG multi-ativo              │      │
│  │  ├── SwingTraderEngine (magic 777222) — Médio prazo multi-símbolo   │      │
│  │  ├── ForexScalperEngine(magic 777111) — EURUSD, GBPUSD              │      │
│  │  ├── MicroScalperEngine(magic 888111) — BTCUSD ultra-scalping       │      │
│  │  ├── OmniProbabilistic (magic 999111) — Multi-ativo probabilístico  │      │
│  │  ├── CopyTraderEngine  — Réplica de sinais                          │      │
│  │  ├── RecoveryEngine    — Recuperação matemática (Martingale/Kelly)  │      │
│  │  ├── MotorIAEngine     — IA adaptativa com detecção de regime       │      │
│  │  └── AgentIAEngine     (magic 202605) — Análise autônoma FVG        │      │
│  │                                                                      │      │
│  │  SERVIÇOS DE SUPORTE:                                                 │      │
│  │  ├── SignalEngine      — Geração de sinais (16+ estratégias)         │      │
│  │  ├── TradeGuardian     — Proteção de posições (trailing, BE)         │      │
│  │  ├── DisciplineEngine  — Limites diários de perda/ganho              │      │
│  │  ├── ReportEngine      — Relatórios de performance                   │      │
│  │  ├── MLInsightsService — Predições ML, Monte Carlo, sentimento       │      │
│  │  ├── AlertEngine       — Alertas centralizados com dedup             │      │
│  │  ├── HealthService     — Health check de 14 componentes              │      │
│  │  ├── SymbolLockService — Lock de símbolos entre engines              │      │
│  │  ├── DatabaseService   — Interface Prisma SQLite                     │      │
│  │  ├── MarketService     — Verificação de mercado aberto               │      │
│  │  ├── MarketDataService — Agregação de dados multi-fonte              │      │
│  │  ├── TelegramService   — Envio de mensagens Telegram                 │      │
│  │  └── TradeNotificationBot — Notificações automáticas de trades       │      │
│  └────────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ HTTP
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     BRIDGE MT5 (Python/Flask) :5555                          │
│                                                                              │
│  mt5_bridge.py (1126 linhas) — v1.1.3-DIAG                                  │
│  ├── /health, /login, /order, /close_order, /update_order                   │
│  ├── /account, /positions, /history                                          │
│  ├── /candles, /symbols, /ticks                                              │
│  ├── /analysis (RSI, MACD, BB, EMA, SMA200, sentiment)                     │
│  ├── /smc_levels (Order Blocks, FVG, Liquidez)                              │
│  └── /smc_analysis (SMC completa)                                           │
│                                                                              │
│  └── MetaTrader 5 (biblioteca oficial mt5)                                   │
│       └── Broker: Pepperstone (ou qualquer broker conectado)                 │
│                                                                              │
│  BRIDGE FMP (Python) :5556                                                   │
│  └── financialmodelingprep.com — COT reports, dados fundamentalistas         │
└──────────────────────────────────────────────────────────────────────────────┘

FONTES DE DADOS EXTERNAS:
├── Polygon.io (API Key configurada)
├── LiteFinance (my.litefinance.org — quotes em tempo real)
└── Economic Calendar (nfs.faireconomy.media)
```

---

## 2. Pilha Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React + Vite + TypeScript | React 18, Vite 4 |
| **UI** | Tailwind CSS + Framer Motion + Lucide Icons | Tailwind 3 |
| **Gráficos** | Recharts (charting) + Lightweight Charts (trading) | Recharts 2 |
| **Backend** | Node.js + Express + TypeScript | Express 4 |
| **ORM** | Prisma + SQLite | Prisma 5 |
| **Bridge MT5** | Python 3 + Flask + MetaTrader5 | Flask, pandas_ta |
| **Bridge FMP** | Python + fastmcp | - |
| **Notificações** | Telegram Bot API | - |
| **ML** | XGBoost (modelo treinado `cerebro_smc_btcusd.pkl`) | - |
| **Outros** | jsPDF (exportação), Zustand (state), axios | - |

---

## 3. Portas e Endpoints

| Porta | Serviço | Objetivo |
|-------|---------|----------|
| **3006** | Vite Dev Server | Frontend React |
| **3015** | Express API | Backend Radar-FX |
| **5555** | Python Flask Bridge | Conexão MT5 |
| **5556** | Python FMP Bridge | Dados FMP |

### 3.1 Proxy Vite
No `vite.config.ts`:
```
/api → http://127.0.0.1:3015
```

---

## 4. Catálogo de Magic Numbers

| Magic | Engine | Ativos |
|-------|--------|--------|
| **88881** | Alpha Robot | XAUUSD, BTCUSD, ETHUSD, EURUSD, GBPUSD |
| **9999** | Gold Scalper | XAUUSD |
| **7777** | Supreme | EURUSD, GBPUSD, US100Cash, US30Cash |
| **8888** | Crypto IA | BTCUSD, ETHUSD, SOLUSD, BNBUSD, XRPUSD, ADAUSD, DOGEUSD, LINKUSD |
| **444111** | Bitcoin Pro | BTCUSD |
| **777111** | Forex Scalper | EURUSD, GBPUSD |
| **888111** | Micro Sniper | BTCUSD |
| **999111** | Omni Probabilistic | EURUSD, GBPUSD, XAUUSD, BTCUSD |
| **9876** | Shark Bot | XAUUSD, BTCUSD, ETHUSD, EURUSD, GBPUSD, XAGUSD, WTI, SP500 |
| **777222** | Swing Trader | Multi-símbolo |
| **202605** | Agent IA | Multi (análise FVG) |
| **999001** | Motor IA | Multi (IA adaptativa) |
| **999000** | Recovery Engine | Multi (recuperação) |
| **999999** | Telegram Manual | Trades manuais via Telegram |
| **123456** | Bridge Fallback | Padrão bridge |

---

## 5. Rotas da API REST

### 5.1 Sistema e Infraestrutura

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check simples |
| GET | `/api/health/full` | Relatório completo de 14 componentes (cache 10s) |
| GET | `/api/locks` | Lista locks de símbolos |
| POST | `/api/locks/reset` | Reseta todos os locks |
| GET/POST | `/api/system/config` | Configurações do sistema |

### 5.2 Database (Prisma SQLite)

| Método | Rota | Parâmetros |
|--------|------|-----------|
| GET | `/api/db/trades` | `?limit=100` |
| GET | `/api/db/stats` | `?strategy=X` |
| POST | `/api/db/settings` | `{key, value}` |
| GET | `/api/db/settings/:key` | - |
| GET | `/api/db/alerts` | `?limit=50` |

### 5.3 Bridge MT5 (Proxy)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/mt5/login` | Login MT5 |
| POST | `/api/mt5/order` | Ordem (com validação disciplinar + sanitização + auditoria) |
| GET | `/api/mt5/account` | Dados da conta (fallback Gold Scalper sintético) |
| GET | `/api/mt5/positions` | Posições abertas (fallback sintético) |
| GET | `/api/mt5/history` | Histórico de 30 dias |
| GET | `/api/mt5/analysis` | Análise técnica (`?symbol=X&timeframe=H1&count=300`) |
| POST | `/api/mt5/ticks` | Ticks real-time (merge MT5 + LiteFinance) |

### 5.4 Disciplina e Proteção

| Método | Rota | Handler |
|--------|------|---------|
| GET | `/api/mt5/discipline` | `DisciplineEngine.getDailyStatus()` |
| POST | `/api/mt5/discipline/settings` | `DisciplineEngine.updateSettings()` |
| POST | `/api/mt5/discipline/reset` | `DisciplineEngine.reset()` |
| GET/POST | `/api/mt5/guardian/status` + `/settings` | `TradeGuardian` |
| GET | `/api/mt5/risk-management` | Relatório consolidado de risco |
| POST | `/api/mt5/trade/open` | Trade manual (Telegram) |
| POST | `/api/mt5/trade/close` | Fechar por ticket |
| POST | `/api/mt5/trade/close-all` | Fechar todas |

### 5.5 Robôs Específicos

| Método | Rota | Engine |
|--------|------|--------|
| GET/POST | `/api/mt5/robot/status` + `/settings` + `/report` + `/sync` | AlphaRobotEngine |
| GET/POST | `/api/mt5/copy-trader/status` + `/follow` | CopyTraderEngine |
| GET/POST | `/api/mt5/bitcoin-pro/status` + `/settings` | BitcoinProEngine |
| GET/POST | `/api/mt5/recovery/status` + `/settings` + `/signals` | RecoveryEngine |
| GET/POST | `/api/mt5/motor-ia/status` + `/settings` | MotorIAEngine |
| GET/POST | `/api/mt5/shark-bot/status` + `/settings` | SharkBotEngine |
| GET/POST | `/api/mt5/crypto-ia/status` + `/settings` + `/restart` | CryptoIAEngine |
| GET/POST | `/api/mt5/supreme/status` + `/toggle` + `/report` + `/sync` | SupremeEngine |
| GET/POST | `/api/mt5/micro-scalper/status` + `/settings` + `/reset` | MicroScalperEngine |
| GET/POST | `/api/mt5/gold-scalper/status` + `/statistics` + `/risk-report` + `/report` + `/settings` + `/trade` + `/reset` + `/reset-trades` + `/unlock` + `/lock` + `/calendar` + `/sync` | GoldScalperEngine |
| GET/POST | `/api/mt5/swing-trader/status` + `/settings` + `/command` + `/reset` | SwingTraderEngine |
| GET | `/api/mt5/swing-trader/backtest` | SwingTraderSimulator |
| GET/POST | `/api/mt5/forex-scalper/status` + `/settings` + `/close` | ForexScalperEngine |
| GET/POST | `/api/mt5/omni/status` + `/settings` | OmniProbabilisticEngine |
| GET | `/api/mt5/omni/history/full` | Omni history + ranking |

### 5.6 Agente IA

| Método | Rota | Handler |
|--------|------|---------|
| GET | `/api/agent-ia/status` | `AgentIAEngine.getStatus()` |
| POST | `/api/agent-ia/start` | Inicia (intervalo 60s) |
| POST | `/api/agent-ia/stop` | Para |
| POST | `/api/agent-ia/dry-run` | Alterna dry-run |
| POST | `/api/agent-ia/analyze` | Análise única |
| GET | `/api/agent-ia/logs` | `?count=50` |
| POST | `/api/agent-ia/logs/clear` | Limpa logs |
| GET | `/api/agent-ia/signals` | `?count=30` |
| POST | `/api/agent-ia/signal/outcome` | Marca resultado |
| POST | `/api/agent-ia/config` | Atualiza config |
| POST | `/api/agent-ia/reset-daily` | Reseta diário |

### 5.7 Relatórios e Análise

| Método | Rota | Handler |
|--------|------|---------|
| GET | `/api/mt5/reports` | `ReportEngine.getPerformanceReports()` |
| GET | `/api/mt5/reports/crypto` | Relatório cripto (curva, pizza, barras) |
| GET | `/api/mt5/reports/strategies` | `SignalEngine.getStrategyReport()` |
| GET | `/api/mt5/reports/strategy-history` | `?name=X` |
| POST | `/api/mt5/reports/sync` | Sincroniza Gold + Alpha + Supreme |
| GET | `/api/mt5/global-report` | Agrega todos os motores |
| GET | `/api/mt5/analytics/advanced` | Analytics avançados |
| GET | `/api/mt5/ai-monitoring` | Status agregado de 8 engines |
| GET/POST/DEL | `/api/mt5/journal` | CRUD diário |
| GET | `/api/mt5/signals` | `SignalEngine.getActiveSignals()` |
| POST | `/api/mt5/sentiment` | Sentimento institucional |
| GET | `/api/mt5/debug/symbols` | Símbolos bridge |

### 5.8 ML Insights

| Método | Rota |
|--------|------|
| GET | `/api/mt5/ml-insights/full-report` |
| GET | `/api/mt5/ml-insights/history` |
| GET/POST | `/api/mt5/ml-insights/settings` |
| GET | `/api/mt5/ml-insights/performance` |
| GET | `/api/mt5/ml-insights/prediction` |
| GET | `/api/mt5/ml-insights/regime` |
| GET | `/api/mt5/ml-insights/risk-metrics` |
| GET | `/api/mt5/ml-insights/news` |

### 5.9 Telegram

| Método | Rota |
|--------|------|
| GET/POST | `/api/mt5/telegram/settings` |
| POST | `/api/mt5/telegram/test` |
| GET/POST | `/api/mt5/telegram/bot/settings` |
| POST | `/api/mt5/telegram/bot/test` |
| POST | `/api/mt5/telegram/bot/summary` |

---

## 6. Engines de Trading — Detalhamento

### 6.1 Alpha Robot Engine (`AlphaRobotEngine.ts` — 1220 linhas)
| Campo | Valor |
|-------|-------|
| **Magic** | `88881` |
| **Ativos** | XAUUSD, BTCUSD, ETHUSD, EURUSD, GBPUSD |
| **Análise** | Order Blocks + FVG + PD Arrays + liquidez 1H/15M |
| **Execução** | 2 caminhos: `executeInstitutionalTrade` (comment `AlphaInst`) e `executeTrade` (comment `AlphaV2 {setup}`) |
| **Persistência** | `alpha_robot_settings.json` + `alpha_robot_history.json` |
| **Status** | `getStatus()` retorna configurações + posições + estados por símbolo |

### 6.2 Gold Scalper Engine (`GoldScalperEngine.ts` — 1598 linhas)
| Campo | Valor |
|-------|-------|
| **Magic** | `9999` |
| **Ativos** | XAUUSD (ouro) |
| **Análise** | Trend M1 + M15 + SMC + FVG + Order Blocks + VSA |
| **Persistência** | `gold_scalper_settings.json` + `gold_scalper_history.json` |
| **Simulador** | `GoldScalperSimulator.ts` (simulação HFT em dados M15) |
| **Rotas** | 12 endpoints REST (status, settings, trade, unlock, lock, sync, reset, calendar...) |

### 6.3 Crypto IA Engine (`CryptoIAEngine.ts` — 690 linhas)
| Campo | Valor |
|-------|-------|
| **Magic** | `8888` |
| **Ativos** | BTCUSD, ETHUSD, SOLUSD, BNBUSD, XRPUSD, ADAUSD, DOGEUSD, LINKUSD |
| **Análise** | Wyckoff (D1) + VWAP + Market Structure (D1/H4) + Order Blocks (H4) + RSI + ATR + Volume |
| **Pontuação** | Composta 0-100: Wyckoff(30) + VWAP(20) + MS(20) + OB(15) + RSI(10) + Volume(5) |
| **Perfis** | conservador (≥75), moderado (≥65), agressivo (≥55) |
| **R:R fixo** | 2.5:1 |
| **Cooldown** | 1h entre sinais |
| **Persistência** | `crypto_ia_settings.json` + `crypto_ia_data.json` |

### 6.4 Supreme Engine (`SupremeEngine.ts` — 379 linhas)
| Campo | Valor |
|-------|-------|
| **Magic** | `7777` |
| **Ativos** | EURUSD, GBPUSD, US100Cash, US30Cash |
| **Persistência** | `alpha_supreme_settings.json` + `alpha_supreme_history.json` |

### 6.5 Recovery Engine (`RecoveryEngine.ts` — 654 linhas)
| Campo | Valor |
|-------|-------|
| **Ativos** | Multi-símbolo (monitora todas as estratégias) |
| **Algoritmos** | Martingale (1.6x), Anti-Martingale, Kelly Fractional (0.25), Ajuste por Volatilidade |
| **Tiers** | 5 zonas de drawdown (Tier 0-4; crítico ≥15%) |
| **Modo** | Preservação automática em drawdown crítico |

### 6.6 Motor IA Engine (`MotorIAEngine.ts` — 532 linhas)
| Campo | Valor |
|-------|-------|
| **Magic** | `999001` |
| **Ativos** | XAUUSD, BTCUSD, EURUSD, GBPUSD, ETHUSD |
| **Regime** | Detecção automática (BULLISH/BEARISH/NEUTRAL/HIGH_VOL/LOW_VOL) via SMA20/50 + volatilidade |
| **Aprendizado** | Armazena resultados por símbolo, direção e regime; win rate por regime calibra confiança |
| **Confiança** | Composta: 40% regime WR + streaks + bias de regime |
| **SL/TP** | ATR * 1.2 (SL) e ATR * 2.4 (TP) |
| **Limites** | Stop Loss diário $50, Take Profit diário $100 |

### 6.7 Outros Engines

| Engine | Magic | Ativos | Especialidade |
|--------|-------|--------|--------------|
| **Bitcoin Pro** | 444111 | BTCUSD | Neural Momentum, grid adaptativo |
| **Shark Bot** | 9876 | Multi (8 ativos) | FVG detection, bullish + bearish |
| **Swing Trader** | 777222 | Multi | Médio prazo, análise estrutural |
| **Forex Scalper** | 777111 | EURUSD, GBPUSD | Scalping rápido M1 |
| **Micro Sniper** | 888111 | BTCUSD | Ultra-scalping, basket grid |
| **Omni Probabilistic** | 999111 | Multi (4 ativos) | Probabilístico, ciclo multi-ativo |
| **Agent IA** | 202605 | Multi | FVG autônomo, dry-run |

---

## 7. Frontend — Mapa de Telas

### 7.1 Menu Lateral (5 seções, 30 itens)

#### PRINCIPAL
| ID | Ícone | Label |
|----|-------|-------|
| `cockpit` | LayoutDashboard | Cockpit |
| `analytics` | BarChart2 | Analytics |
| `ml` | Brain | ML Insights |

#### ROBÔS (dots coloridos indicam status ativo)
| ID | Ícone | Label | Dot |
|----|-------|-------|-----|
| `robot` | Cpu | Alpha Robot | Fuchsia |
| `bitcoin_pro` | Bitcoin | Bitcoin Pro | Green |
| `shark_bot` | Zap | Shark Bot | Cyan |
| `crypto` | Bitcoin | Alpha Cripto | Orange |
| `gold_scalper` | Target | Gold Scalper | Amber |
| `micro_sniper` | Zap | Micro Sniper | Indigo |
| `swing_ia` | TrendingUp | Swing IA | Yellow |
| `speed_scalper` | Zap | Speed Scalper | Cyan |
| `supreme` | Crown | Supreme AI | Emerald |
| `omni` | Sigma | Omni Prob | Purple |

#### TRADING
| ID | Ícone | Label |
|----|-------|-------|
| `recovery` | Brain | Recovery |
| `motor_ia` | Brain | Motor IA |
| `trade` | Send | Operar |
| `copy` | Copy | Copy Trader |
| `analysis` | LineChart | Análise Técnica |
| `ranking` | PieChart | Ranking |

#### GESTÃO
| ID | Ícone | Label |
|----|-------|-------|
| `risk` | Shield | Gestão Risco |
| `financial` | BookOpen | Financeiro |
| `statistics` | BarChart2 | Estatísticas |
| `strategy_reports` | PieChart | Relatórios |
| `journal` | BookOpen | Diário |
| `simulator` | Box | Simulador |
| `costs` | Wallet | Custos |

#### SISTEMA
| ID | Ícone | Label |
|----|-------|-------|
| `ai_monitoring` | Cpu | Monitoramento IA |
| `agent_ia` | Brain | Agente IA |
| `alerts` | Bell | Alertas |
| `settings` | Settings | Ajustes |

### 7.2 Polling do Header
A cada 5s, o Layout consulta o status de 11 engines para exibir os dots de atividade no sidebar.

---

## 8. Catálogo de Estratégias (SignalEngine)

| Estratégia | Categoria | Ativo | Prioridade | Magic |
|-----------|-----------|-------|-----------|-------|
| Alpha Nakamoto | Cripto | BTCUSD | 1 | 8888 |
| Ethereum Core | Cripto | ETHUSD | 1 | 8888 |
| Crypto Whale Hunt | Cripto | Multi (BNB, DOGE, SOL, XRP...) | 2 | 8888 |
| Altcoin Sniper | Cripto | Altcoins | 1 | 8888 |
| Crypto IA Pro | Cripto | Multi-IA | 0 | 8888 |
| Alpha Robot | Forex | Multi (XAU, BTC, ETH, EUR, GBP) | 1 | 88881 |
| Supreme | Forex | EUR, GBP, US100, US30 | 1 | 7777 |
| Intelligence 7 | Forex | Majors | 2 | - |
| Smart Momentum | Forex | Majors | 3 | - |
| Gold Scalper | Metais | XAUUSD | 0 | 9999 |
| Shark Hunt XAU | Metais | XAUUSD | 1 | - |
| Golden Rejection | Metais | XAU/XAG | 2 | - |
| Alpha Shark | Metais/Cripto | XAU/Cripto | 3 | - |
| Shark Bot | Metais | Multi | 0 | 9876 |
| Omni Probabilistic | Ciclos | Multi-Asset | 0 | 999111 |
| VSA | Multi | Qualquer | - | - |
| Alpha Confluence | Multi | Multi (VSA + Institutional) | - | - |
| Squeeze Breakout | Multi | Qualquer | - | - |
| Alpha Scalper Grid | Multi | Qualquer | - | - |
| Golden Whale Hunter | Metais | XAUUSD | - | - |
| Alpha Index Pro | Índices | Índices | - | - |

**Classificação de trades no relatório:**
1. Por comment (nome da estratégia no comment, ex: `AlphaV2`)
2. Por magic number
3. Por símbolo (fallback)

---

## 9. Persistência e Armazenamento

### 9.1 JSON Files (raiz do projeto)

| Arquivo | Engine | Formato |
|---------|--------|---------|
| `alpha_robot_settings.json` | AlphaRobotEngine | Config |
| `alpha_robot_history.json` | AlphaRobotEngine | Histórico de trades |
| `alpha_supreme_settings.json` | SupremeEngine | Config |
| `alpha_supreme_history.json` | SupremeEngine | Histórico |
| `gold_scalper_settings.json` | GoldScalperEngine | Config |
| `gold_scalper_history.json` | GoldScalperEngine | Histórico |
| `gold_status.json` | GoldScalperEngine | Status |
| `crypto_ia_settings.json` | CryptoIAEngine | Config |
| `crypto_ia_data.json` | CryptoIAEngine | Estados + daily P&L |
| `forex_scalper_settings.json` | ForexScalperEngine | Config |
| `micro_scalper_settings.json` | MicroScalperEngine | Config |
| `shark_bot_settings.json` | SharkBotEngine | Config |
| `omni_probabilistic_settings.json` | OmniProbabilisticEngine | Config |
| `motor_ia_settings.json` | MotorIAEngine | Config |
| `motor_ia_history.json` | MotorIAEngine | Histórico de execuções |
| `motor_ia_learning.json` | MotorIAEngine | Dados de aprendizado |
| `discipline_settings.json` | DisciplineEngine | Config |
| `guardian_settings.json` | TradeGuardian | Config |
| `crypto_risk_settings.json` | CryptoRiskEngine | Config |
| `telegram_settings.json` | TelegramService | Config |
| `trading_journal.json` | JournalService | Diário |
| `profile.json` | ConfigService | Perfil |
| `ia_learning_state.json` | Geral | Estado ML |
| `data/alpha_audit_history.json` | AlphaAuditService | Auditoria |
| `data/signal_tracker.json` | SignalEngine | Tracking |
| `data/ml_weights.json` | SignalEngine | Pesos ML |

### 9.2 Banco SQLite (Prisma)

**Arquivo:** `server/prisma/radar_fx.db`

**Modelos:**
- `Trade` — histórico de trades (ticket, símbolo, direção, volume, preços, P&L, estratégia)
- `Signal` — sinais gerados (símbolo, setup, tipo, confiança, status)
- `StrategyStats` — estatísticas por estratégia (win rate, trades, P&L, profit factor, drawdown)
- `Alert` — alertas do sistema (tipo, severidade, fonte, mensagem)
- `Setting` — pares chave-valor de configuração
- `JournalEntry` — entradas do diário de trading

---

## 10. Integrações Externas

| Fonte | Dados | API Key |
|-------|-------|---------|
| **MetaTrader 5** | Cotações, ordens, posições, história, candles, análise técnica | Via terminal |
| **Polygon.io** | Dados históricos de mercado | `DTVShs79OkVi3nCHMXyS0BPJ4vNex_i` |
| **LiteFinance** | Quotes em tempo real | Pública |
| **Financial Modeling Prep** | COT reports, fundamentalistas | `38H3sDW3t09VitCF3QJe3f0X2g8ZlQJc` |
| **Economic Calendar** | Calendário econômico (faireconomy.media) | Pública |
| **Telegram Bot API** | Notificações de trades, alertas, resumo diário | Configurável |

---

## 11. Inicialização do Sistema

**Ordem de inicialização dos motores** (no `app.listen()`):

```
1. TradeGuardian.start()
2. AlphaRobotEngine.start()
3. CopyTraderEngine.start()
4. SupremeEngine.start()
5. GoldScalperEngine.start()
6. BitcoinProEngine.init()
7. CryptoIAEngine.init()
8. MicroScalperEngine.init()
9. SwingTraderEngine.init()
10. ForexScalperEngine.init()
11. OmniProbabilisticEngine.start()
12. SharkBotEngine.init()
13. RecoveryEngine.init()
14. MotorIAEngine.init()
15. TradeNotificationBot.start()
```

**Scripts de inicialização (Windows):**

| Script | O que inicia |
|--------|-------------|
| `start_all.bat` | MT5 + Bridge Python (5555) + Node Server (3015) + Vite (3006) |
| `start_radar.bat` | Node Server + Vite (abre navegador) |
| `INICIAR_RADAR_FX.bat` | Launcher master |
| `watchdog.bat` | Monitora e reinicia processos a cada 30s |
| `install_services.bat` / `.ps1` | 4 tarefas agendadas Windows (bridge 30s + server/client/watchdog 45s após logon) |

---

## 12. Segurança e Validação

- **Sanitização de comment** nas ordens: `re.sub(r'[^a-zA-Z0-9\s\-_]', '', text)` + truncamento 31 chars
- **Validação de disciplina** antes de cada ordem: verifica limites diários, perdas consecutivas, mercado aberto
- **Symbol Lock Service**: impede que 2 engines negociem o mesmo símbolo simultaneamente (lock 24h, cooldown 5min)
- **Health check** com cache 10s monitora 14 componentes
- **CORS** habilitado na API
- **Rate limiting** via cooldowns internos de cada engine (1h CryptoIA, 15s MotorIA, etc.)

---

## 13. Arquivos de Diagnóstico e Suporte

O diretório `tmp/` contém 17 scripts de diagnóstico, correção e monitoramento:
- `bridge_diagnostic_5555.json` — diagnóstico da bridge
- `diagnose_bridge.js/ts` — diagnósticos de conectividade
- `fix_sync.js`, `fix_frontend.js` — correções de sincronização
- `monitor_alert_turbo.js`, `monitor_agility.js` — monitores em tempo real
- `test_mt5_login.py`, `test_comment.py` — testes Python
- `global_scan.js`, `inspect_comments.js`, `omni_trace.js` — verificações

---

## 14. Versionamento

**Commits notáveis:**
- `3a06cb1` — Supreme/Omni movidos, Copy Trader reposicionado, lote manual 0.02
- Estrutura de branches: `main` (produção)

---

## 15. Checklist de Funcionalidades

Ver `CHECKLIST_FEITO.md` para inventário completo de funcionalidades implementadas.
Ver `CHECKLIST_MELHORIAS.md` para prioridades futuras (alta/média/baixa).
