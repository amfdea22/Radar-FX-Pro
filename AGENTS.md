# Radar-FX

Projeto de análise de radar.

## Stack
- Node.js
- React (client/)
- Express/Fastify (server/)
- Prisma (ORM)

## Comandos
- `cd client && npm run dev` - Iniciar frontend
- `cd server && npm run dev` - Iniciar backend

## Progress

### Done
- **Kill Switch**: `POST /api/system/engines/disable-all` server-side — desliga Gold Scalper, Alpha, Omni, Supreme, Shark, Wolf, Bitcoin Pro, Aura Quant, Crypto IA, Motor IA, Recovery, Micro Scalper, Swing Trader, Forex Scalper, Sweep (15 engines).
- **Desligar Todos button**: Card no Dashboard (seção Kill Switch) com botão vermelho + confirmação.
- **Engine name in positions**: Server enriquece `/api/mt5/positions` com campo `engine` via MAGIC_MAP; Dashboard exibe badge do robô ao lado do símbolo na posição.
- **Fox.tsx**: chatbox flutuante laranja com streaming SSE, slash commands, abas Fox/Analista Técnico, botões rápidos.
- **CopilotService**: `ask()`, `askStream()`, `handleSlashCommand()` com 8 comandos, `initMemory()`/`saveMemory()` via JSON, `groqStream()` com SSE real.
- **ResearchService**: calendário ForexFactory, artigos LiteFinance, análise técnica Investing.com, fallback DailyFX RSS.
- **gatherContext()**: 12 fontes paralelas com Promise.allSettled.
- **buildSystemPrompt()**: contexto completo do Radar FX em markdown.
- **Rota SSE** `/api/copilot/ask/stream`: NDJSON streaming.
- **Correção Alpha/Omni auto-start**: `onEmergencyReset()` não mexe em `enabled`.
- **/ranking**: ordenado por lucro, destaca maior lucro.
- **/ajuda**: lista todos os 17 robôs/estratégias.

### Done (new)
- **Bug POST com body**: `express.json()`/`body-parser` hanging em Node.js v24 no Windows. Causa raiz: stream HTTP em modo paused sem `resume()`. Solução: custom middleware `readBody()` que lê `req.on('data')` + `req.on('end')` com `req.resume()` explícito. Aplicado em `server/src/index.ts:117-133` e `server/src/bridge.ts:6-28`.

## Critical Notes
- **POST body em Node.js v24**: `express.json()` e `body-parser` não funcionam — o stream da requisição não emite eventos `data`/`end` sem `req.resume()`. Usar custom body parser manual.

## Relevant Files
- `client/src/components/RadarDashboard.tsx` — Dashboard com posições, Kill Switch, KPI, ativos, sinais.
- `server/src/index.ts` — Custom body parser (linha 108-130), `POST /api/system/engines/disable-all` (linha ~2095), `GET /api/mt5/positions` com engine name (linha 406).
- `server/src/bridge.ts` — Custom body parser (linha 6-28), mesma abordagem.
- `server/src/services/MagicMap.ts` — Mapa de magic numbers para nome do robô.
