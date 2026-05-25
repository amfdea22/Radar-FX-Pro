# Alpha Crypto — Documentação da Interface

## Visão Geral

**Alpha Crypto** é um motor de trading algorítmico especializado em criptomoedas, focado em análise Wyckoff + VWAP + Estrutura de Mercado + Order Blocks no par D1/H4. Opera exclusivamente com magic **8888** e faz parte do ecossistema Radar-FX como "Crypto IA Pro".

---

## 1. Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│  CryptoIntelligenceHub.tsx (UI)                                    │
│  ├── Alpha Smart IA Engine Panel (controles do motor)              │
│  ├── Alpha Signals Crypto Matrix (sinais filtrados)                │
│  ├── Elite Copy Traders (masters cripto simulados)                 │
│  ├── Comunidade Cripto (social trading)                            │
│  └── CryptoReport (gráficos de desempenho)                         │
├─────────────────────────────────────────────────────────────────────┤
│  API REST (Express, porta 3015)                                    │
│  ├── GET  /api/mt5/crypto-ia/status                                │
│  ├── POST /api/mt5/crypto-ia/settings                              │
│  ├── POST /api/mt5/crypto-ia/restart                               │
│  └── GET  /api/mt5/ai-monitoring (aggregated)                      │
├─────────────────────────────────────────────────────────────────────┤
│  CryptoIAEngine.ts (servidor, loop 30s)                            │
│  ├── Análise Wyckoff (D1)                                          │
│  ├── VWAP + 2 desvios padrão (D1)                                  │
│  ├── Market Structure (D1 + H4)                                    │
│  ├── Order Block Detection (H4)                                    │
│  ├── RSI(14) + ATR(14) + Volume Ratio                              │
│  └── Pontuação composta → Execução via Bridge MT5                  │
├─────────────────────────────────────────────────────────────────────┤
│  Bridge MT5 (Python, porta 5555)                                   │
│  ├── candles, symbols, positions, history, order, ticks            │
│  └── Terminal MetaTrader 5                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Engine Server (`CryptoIAEngine.ts`)

### 2.1 Settings Interface (`crypto_ia_settings.json`)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `enabled` | `boolean` | `true` | Liga/desliga o motor |
| `symbols` | `string[]` | `['BTCUSD','ETHUSD','SOLUSD','BNBUSD','XRPUSD','ADAUSD','DOGEUSD','LINKUSD']` | Símbolos monitorados |
| `lotSize` | `number` | `0.01` | Lote fixo para ordens |
| `maxDailyLoss` | `number` | `500` | Limite de perda diária (USD) |
| `maxDailyProfit` | `number` | `1000` | Limite de ganho diário (USD) |
| `riskProfile` | `'conservador' \| 'moderado' \| 'agressivo'` | `'moderado'` | Perfil de risco |
| `basketTP` | `number` | `3` | (não utilizado ativamente) |
| `basketSL` | `number` | `-1` | (não utilizado ativamente) |
| `maxPositions` | `number` | `2` | Máximo de posições simultâneas por símbolo |

### 2.2 State Interface (`CryptoState`, por símbolo)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `price` | `number` | Preço atual |
| `wyckoff` | `{ phase: string, confidence: number }` | Fase Wyckoff detectada |
| `vwap` | `{ vwap, upper1, lower1, upper2, lower2 }` | VWAP + bandas de desvio |
| `structure` | `{ trendD1, trend4H, swingHigh4H, swingLow4H, lastBOS, bosStrength }` | Estrutura de mercado |
| `orderBlocks` | `BlockZone[]` | Order blocks detectados (top 5) |
| `rsi14` | `number` | RSI período 14 |
| `atr14` | `number` | ATR período 14 |
| `volumeRatio` | `number` | Volume atual / média 30 períodos |
| `priceToVwap` | `number` | `(preço - vwap) / vwap * 100` |
| `nearOrderBlock` | `BlockZone \| null` | OB mais próximo (dentro de 1.5%) |
| `entryScore` | `number` | Pontuação composta (0-100) |
| `entrySignal` | `'BUY' \| 'SELL' \| null` | Sinal gerado |
| `lastSignalTime` | `number` | Timestamp do último sinal (cooldown 1h) |

### 2.3 Wyckoff Phase Detection

| Fase | Critérios |
|------|-----------|
| `ACCUMULATION` | EMA20 > EMA50, volume crescente, range estreito, price near low |
| `MARKUP` | EMA20 >> EMA50, price > prev close, volume alto |
| `DISTRIBUTION` | EMA20 < EMA50, volume alto, price near high, range expanding |
| `MARKDOWN` | EMA20 << EMA50, price < prev close, volume alto |
| `NEUTRAL` | Nenhum dos acima |

**Fórmula de confiança:**
- MARKUP/MARKDOWN: `min(85, 50 + perf10*5 + volRatio*10)`
- ACCUMULATION: `min(80, 50 + (1 - rangeWidth*10)*20)`
- DISTRIBUTION: `min(80, 50 + avgRangeLast10/avgRange*10)`

### 2.4 Sistema de Pontuação (0-100)

| Componente | Peso | Condição |
|------------|------|----------|
| **Wyckoff** | 30 pts | +25 para ACCUMULATION/DISTRIBUTION (confiança > 60), +20 para MARKUP/MARKDOWN |
| **VWAP** | 20 pts | +15 se price entre VWAP e ±1 desvio |
| **Market Structure** | 20 pts | +20 se D1 e H4 concordam, +10 se mesma direção mas não ambos fortes |
| **Order Block** | 15 pts | `nearOB.strength * 0.15` se OB alinhado com sinal |
| **RSI** | 10 pts | +10 se RSI entre 30-50 (BUY) ou 50-70 (SELL) |
| **Volume** | 5 pts | +5 se volumeRatio > 1.3 |

**Override:** Se D1 trend é BEARISH e sinal é BUY (ou BULLISH + SELL), score = 0.

**Thresholds por perfil:**
| Perfil | Score Mínimo |
|--------|-------------|
| conservador | 75 |
| moderado | 65 |
| agressivo | 55 |

### 2.5 Execução de Ordens

**Parâmetros da ordem:**
- **Magic:** `8888`
- **Comment:** `"IA {BUY|SELL} {WYCKOFF_PHASE}"` (max 31 chars)
- **Lote:** `settings.lotSize` (default 0.01)
- **SL:** Near order block bottom/up; fallback swing low/high; limitado a `riskPct * price`
- **TP:** `SL_distance * 2.5` (R:R fixo 2.5:1)
- **Risk%:** conservador=0.5%, moderado=1.0%, agressivo=1.5%

**Guards de segurança:**
1. `entryScore >= minScore` (threshold do perfil)
2. `entrySignal !== null`
3. Posições abertas do símbolo < `maxPositions` (default 2)
4. `dailyLoss < maxDailyLoss` (default $500)
5. `dailyProfit < maxDailyProfit` (default $1000)
6. `lastSignalTime` + 1h já passou
7. Risco por unidade >= 0.1% do preço

### 2.6 Resolução de Símbolos

Para cada símbolo interno (ex: `BTCUSD`), tenta no broker:
1. Match exato
2. Remove `USD`, tenta `{base}.m`, `{base}!`, `{base}#`
3. Aliases especiais: `DOGE→DOG`, `SHIB→SHB`, `LINK→LNK`, `MATIC→MTC`

### 2.7 Persistência

| Arquivo | Conteúdo | Frequência |
|---------|----------|------------|
| `crypto_ia_settings.json` | `CryptoStrategySettings` | A cada alteração |
| `crypto_ia_data.json` | `{ states, dailyProfit, dailyLoss, timestamp }` | A cada loop (30s) |

---

## 3. API REST

### 3.1 Rotas do Motor

**`GET /api/mt5/crypto-ia/status`**
```json
{
  "settings": { /* CryptoStrategySettings */ },
  "states": { "BTCUSD": { /* CryptoState */ }, ... },
  "resolvedSymbols": { "BTCUSD": "BTCUSD.m", ... },
  "activePositions": 2,
  "dailyProfit": 45.30,
  "bestAsset": "ETHUSD",
  "winRate": 75,
  "isRunning": true,
  "bridgeOk": true,
  "resolvedCount": 6,
  "totalSymbols": 8,
  "loopCount": 1247,
  "neuroScores": { "BTCUSD": 72, "ETHUSD": 85, ... }
}
```

**`POST /api/mt5/crypto-ia/settings`**
```json
{ "riskProfile": "agressivo", "enabled": true }
```
Resposta:
```json
{ "status": "success", "statusData": { /* status completo */ } }
```

**`POST /api/mt5/crypto-ia/restart`**
Resposta:
```json
{ "status": "success", "statusData": { /* status completo */ } }
```

### 3.2 Rotas Relacionadas (usadas pelo frontend)

| Método | Rota | Frequência UI |
|--------|------|---------------|
| `GET` | `/api/mt5/signals` | 5s |
| `GET` | `/api/mt5/crypto-ia/status` | 5s |
| `GET` | `/api/mt5/copy-trader/status` | 5s |
| `GET` | `/api/mt5/social/community?crypto=true` | 8s |
| `GET` | `/api/mt5/social/status?crypto=true` | 8s |
| `GET` | `/api/mt5/reports/strategies` | 15s |
| `GET` | `/api/mt5/reports/crypto` | 15s |
| `GET` | `/api/mt5/ai-monitoring` | sob demanda |
| `POST` | `/api/mt5/order` | manual |
| `POST` | `/api/mt5/copy-trader/follow` | manual |
| `POST` | `/api/mt5/social/follow` | manual |

---

## 4. Frontend (`CryptoIntelligenceHub.tsx`)

### 4.1 Seções da Interface

#### A. Header
- Título "Crypto Hub" com badge "24/7 Ativo"
- Subtítulo: "Inteligência Algorítmica & Copy Trader Digital"
- Botão "Recarregar Dashboard" (sync manual)
- Indicador de status de rede (alterna "Buscando Volatilidade" / "Padrão Confirmado" a cada 3s)

#### B. Alpha Smart IA Engine Panel
- **Toggle IA On/Off** → `POST /api/mt5/crypto-ia/settings { enabled }`
- **Smart Grid toggle** → `POST /api/mt5/crypto-ia/settings { smartGridIA }` (UI-only)
- **Perfil selector:** C (conservador, verde) / M (moderado, amber) / A (agressivo, vermelho)
- **HFT Filters toggle** → `POST /api/mt5/crypto-ia/settings { hftFilters }` (UI-only)
- **4 KPIs:** % Acerto Global IA (hardcoded 75), Melhor Ativo (24h), Ativos Monitorados, Lucro Acumulado IA
- **Cards por símbolo:** nome, broker resolvido, trend, IA score, RSI bar, ATR, volume

#### C. Alpha Signals Crypto Matrix
- Filtra `/api/mt5/signals` para símbolos cripto (26 chaves)
- Cada card: BUY/SELL badge, símbolo, confiança, setup, preço
- **Controles editáveis:** lote, TP points, SL points
- **Botão Executar** → `POST /api/mt5/order` com comment `"Matrix:{symbol}:{type}"`

#### D. Elite Copy Traders
- 4 masters simulados: Alpha Nakamoto, Altcoin Sniper, Ethereum Core, Quantum BTC Pro
- Win rate, profit today, career stats, Sharpe ratio, avg trade time
- Histórico de trades por master
- **Botão Copy Trader** → `POST /api/mt5/copy-trader/follow`
- **Auto-Pilot** (Altcoin Sniper only): bridge status, resolved symbols, toggle

#### E. Comunidade Cripto
- Lista de traders sociais com rank, username, nível, followers, win rate, profit, drawdown
- **Follow/Unfollow** → `POST /api/mt5/social/follow`
- Desabilitado quando auto-pilot ativo

#### F. CryptoReport (componente embutido)
- Gráfico área: evolução do saldo
- Gráfico pizza: distribuição de lucro por ativo
- Gráfico barras: PnL diário
- KPIs: lucro total, win rate global, max drawdown, top asset

### 4.2 Constantes de Símbolos Cripto (filtro de sinais)

```
['BTC','ETH','BNB','DOG','SOL','XRP','ADA','AVAX','MATIC','DOT',
 'LINK','TRX','LTC','SHIB','BCH','ETC','XLM','XMR','ZEC','EOS',
 'LNK','SHB','MTC']
```

### 4.3 Discrepâncias Frontend vs Backend

| Campo no Frontend | Campo Real no Backend | Status |
|-------------------|----------------------|--------|
| `state.rsi` | `state.rsi14` | ❌ Mismatch |
| `state.atr` | `state.atr14` | ❌ Mismatch |
| `state.trendM1` | `state.structure.trendD1` / `trend4H` | ❌ Mismatch |
| `state.gridLevel` | não existe | ❌ Ausente |
| `state.currentVolume` | não existe (tem `volumeRatio`) | ❌ Ausente |
| `state.volumeAvg` | não existe | ❌ Ausente |

---

## 5. Catálogo de Estratégias (SignalEngine)

**Entry:**
```ts
{
  name: 'Crypto IA Pro',
  category: 'Cripto',
  asset: 'Multi-IA',
  color: '#00ccff',
  symbols: ['BTCUSD','ETHUSD','SOLUSD','BNBUSD','ADABUSD','XRPBUSD'],
  priority: 0,
  magic: 8888
}
```

---

## 6. Fluxo de Execução Completo

```
[Loop a cada 30s]
  │
  ├─ 1. Bridge Health Check
  │     └─ Se 6 erros consecutivos → marca offline, tenta reconnect a cada 30 loops
  │
  ├─ 2. Resolver Símbolos
  │     └─ Mapeia símbolos configurados → nomes do broker
  │
  ├─ 3. Fetch D1 (150 candles) + H4 (100 candles) por símbolo
  │
  ├─ 4. Análise por Símbolo:
  │     ├─ Wyckoff Phase Detection (EMA20/50, volume, range)
  │     ├─ VWAP + 2σ (últimos 200 candles)
  │     ├─ Market Structure (trend D1 + H4, swing highs/lows, BOS)
  │     ├─ Order Block Detection (H4, min move 0.3%, min vol 100)
  │     ├─ RSI(14), ATR(14), Volume Ratio
  │     └─ Pontuação Composta (score 0-100)
  │
  ├─ 5. Decisão de Trade
  │     ├─ score >= minScore (perfil)
  │     ├─ sinal definido
  │     ├─ posições < maxPositions
  │     ├─ dailyLoss/maxDailyProfit ok
  │     ├─ cooldown 1h respeitado
  │     └─ risco >= 0.1% price
  │
  ├─ 6. Execução (se todas as condições OK)
  │     ├─ Calcula SL (OB ou swing)
  │     ├─ Calcula TP (SL * 2.5)
  │     ├─ POST /order { symbol, action, lot, sl, tp, magic: 8888, comment }
  │     └─ Notifica AlertEngine + TradeNotificationBot
  │
  └─ 7. Sync de Posições
        ├─ GET /positions?magic=8888
        ├─ Detecta fechamentos por diff de tickets
        ├─ Busca P&L no /history
        └─ Notifica fechamento via TradeNotificationBot

[Cooldown entre sinais: 60 minutos]
[Reset diário: quando UTC date muda]
```

---

## 7. Constantes

| Constante | Valor |
|-----------|-------|
| Bridge URL | `http://127.0.0.1:5555` |
| Magic | `8888` |
| Loop interval | 30s |
| D1 candles | 150 |
| H4 candles | 100 |
| Min D1 candles | 50 |
| Min H4 candles | 30 |
| Signal cooldown | 3600000ms (1h) |
| R:R fixo | 2.5:1 |
| Bridge error threshold | 6 |
| Bridge reconnect check | a cada 30 loops |
| OB proximity | 1.5% do preço |
| OB min move | 0.3% |
| OB min volume | 100 |
| Max OBs | 5 |
| VWAP window | 200 candles |
| Hardcoded winRate | 75 |
| Default lot | 0.01 |
