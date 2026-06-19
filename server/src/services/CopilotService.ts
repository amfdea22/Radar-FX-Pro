import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OmniProbabilisticEngine } from './OmniProbabilisticEngine';
import { ResearchService, ResearchData } from './ResearchService';
import * as fs from 'fs';
import * as path from 'path';

interface CopilotContext {
    marketStatus?: string;
    omniEnabled?: boolean;
    omniTrades?: number;
    activeStrategies?: string[];
    recentErrors?: string[];
    account?: { balance: number; equity: number; profit: number };
    strategies?: {
        name: string;
        status: string;
        trades: number;
        winRate: number;
        profit: number;
    }[];
    strategyRanking?: { name: string; trades: number; winRate: number; profit: number; profitFactor: number; status: string }[];
    scoreboard?: any;
    globalReport?: any;
    goldScalper?: { status: string; trades: number; winRate: number; profit: number };
    intelStatus?: string;
    dbStats?: { totalTrades: number; winRate: number; totalProfit: number };
    enginesStatus?: { name: string; status: string; trades: number; profit: number }[];
}

interface CandleData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface TechnicalIndicators {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    atr: number;
}

type CopilotModel = 'gemini' | 'groq';
type CopilotMode = 'general' | 'analyst';

const SMC_ANALYST_PROMPT = `Você é uma analista técnica do mercado financeiro Forex com 40 anos de experiência. Você entende tudo sobre mercado e principalmente sobre a análise técnica de gráficos.

Em toda a sua carreira você fez milhões de dólares e você é um grande especialista em SMC (Smart Money Concepts).

REGRAS:
- Sempre analise os dados de candles fornecidos abaixo usando SMC
- Use seu conhecimento em: market structure, order blocks, fair value gaps, liquidity sweeps, induzimentos, quebra de estrutura
- Faça uma análise OBJETIVA e COMPLETA, não superficial
- Analise também os indicadores técnicos fornecidos (RSI, MACD, Bollinger, ATR) e correlacione com a estrutura SMC
- Resolva aproximadamente o movimento do gráfico
- Preveja: ENTRADA (direção e preço), STOP LOSS e TARGET (alvo)
- Alvo e stop para SWING TRADE (2 a 15 dias)
- Responda em português técnico

FORMATO DA RESPOSTA:
**Análise SMC - [SÍMBOLO] ([TIMEFRAME])**

**Estrutura de Mercado:**
[Análise da estrutura atual: tendência, lateralização, pontos de inflexão]

**Supply & Demand / Order Blocks:**
[Zonas de OB relevantes]

**Liquidez:**
[Pontos de liquidez, sweep targets]

**Cenário Principal:**
[Projeção de movimento]

**ENTRADA: [COMPRA/VENDA]**
- Preço: [valor]
- Stop Loss: [valor]
- Target: [valor]
- Risco:Recompensa: [X:Y]
- Duração esperada: [X a Y dias]

**Cenário Alternativo:**
[Se o mercado invalidar a tese principal]`;

export interface AskStreamResult {
    modelUsed: string;
    wasSlashCommand: boolean;
}

export class CopilotService {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static conversationMemory: Map<string, { role: string; content: string }[]> = new Map();
    private static MAX_HISTORY = 30;
    private static genAI: GoogleGenerativeAI | null = null;
    private static memoryPath = path.join(__dirname, '..', '..', 'fox_memory.json');

    private static loadMemory(): Map<string, { role: string; content: string }[]> {
        try {
            if (fs.existsSync(this.memoryPath)) {
                const raw = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
                const map = new Map<string, { role: string; content: string }[]>();
                for (const [k, v] of Object.entries(raw)) map.set(k, v as any);
                return map;
            }
        } catch { /* ignore */ }
        return new Map();
    }

    private static saveMemory() {
        try {
            const obj: Record<string, any> = {};
            for (const [k, v] of this.conversationMemory) obj[k] = v;
            fs.writeFileSync(this.memoryPath, JSON.stringify(obj, null, 2), 'utf-8');
        } catch { /* ignore */ }
    }

    private static getGemini(modelName: string = 'gemini-2.0-flash') {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return null;
        if (!this.genAI) this.genAI = new GoogleGenerativeAI(key);
        return this.genAI.getGenerativeModel({ model: modelName });
    }

    static initMemory() {
        this.conversationMemory = this.loadMemory();
    }

    static async ask(
        sessionId: string,
        userMessage: string,
        model?: CopilotModel,
        mode: CopilotMode = 'general',
        symbol?: string,
        timeframe?: string
    ): Promise<{ response: string; context?: any; modelUsed: string }> {
        const memory = this.conversationMemory.get(sessionId) || [];
        memory.push({ role: 'user', content: userMessage });
        if (memory.length > this.MAX_HISTORY) memory.splice(0, memory.length - this.MAX_HISTORY);

        const context = await this.gatherContext();
        let response = '';
        let modelUsed = model || 'groq';

        const models: CopilotModel[] = model ? [model, 'groq', 'gemini'] : ['groq', 'gemini'];

        for (const m of models) {
            const r = await this.tryModel(m, userMessage, context, memory, mode, symbol, timeframe);
            if (r) { response = r; modelUsed = m; break; }
        }

        if (!response) response = this.fallbackResponse(userMessage, context);

        memory.push({ role: 'assistant', content: response });
        this.conversationMemory.set(sessionId, memory);
        this.saveMemory();

        return { response, context, modelUsed };
    }

    static async handleSlashCommand(command: string, ctx: CopilotContext): Promise<string | null> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '/omni' || cmd === '/omni status') {
            const state = ctx.omniEnabled ? '✅ ATIVO' : '⏸️ PAUSADO';
            let reply = `**Omni Probabilistic Engine**\n- Status: ${state}\n- Trades no histórico: ${ctx.omniTrades || 0}\n- Estratégia: ${ctx.activeStrategies?.join(', ') || 'N/A'}`;
            if (ctx.scoreboard?.daily) {
                const d = ctx.scoreboard.daily;
                reply += `\n- Hoje: ${d.wins || 0}V / ${d.losses || 0}D | P&L: $${(d.netProfit || 0).toFixed(2)}`;
            }
            if (ctx.strategyRanking?.length) {
                reply += '\n\n**Ranking:**\n';
                for (const r of ctx.strategyRanking) {
                    reply += `- ${r.name}: ${r.trades} trades | ${(r.winRate * 100).toFixed(1)}% WR | $${r.profit.toFixed(2)}\n`;
                }
            }
            return reply;
        }

        if (cmd === '/gsl1' || cmd === '/gold') {
            if (ctx.goldScalper) {
                return `**Gold Scalper GSL1**\n- Status: ${ctx.goldScalper.status}\n- Trades: ${ctx.goldScalper.trades}\n- Win Rate: ${ctx.goldScalper.winRate}%\n- P&L: $${(ctx.goldScalper.profit || 0).toFixed(2)}`;
            }
            return 'Gold Scalper (GSL1) — dados indisponíveis no momento.';
        }

        if (cmd === '/ranking' || cmd === '/rank') {
            let reply = '**🏆 Ranking de Estratégias**\n\n';

            // Best profit (from all available data)
            let bestProfit: { name: string; profit: number; winRate: number; trades: number } | null = null;

            // Check Omni ranking — sorted by profit
            if (ctx.strategyRanking?.length) {
                const sorted = [...ctx.strategyRanking].sort((a, b) => b.profit - a.profit);
                reply += '\n**Omni — Estratégias por Lucro:**\n';
                for (let i = 0; i < sorted.length; i++) {
                    const r = sorted[i];
                    reply += `${i + 1}. **${r.name}** — $${r.profit.toFixed(2)} (${r.trades} trades | ${(r.winRate * 100).toFixed(1)}% WR)\n`;
                    if (!bestProfit || r.profit > bestProfit.profit) bestProfit = { name: r.name, profit: r.profit, winRate: r.winRate * 100, trades: r.trades };
                }
            }

            // Check strategies report — sorted by profit
            if (ctx.strategies?.length) {
                reply += '\n**Todos os Robôs por Lucro:**\n';
                const sorted = [...ctx.strategies].sort((a, b) => (b.profit || 0) - (a.profit || 0));
                for (const s of sorted) {
                    const profit = s.profit || 0;
                    reply += `- **${s.name}**: $${profit.toFixed(2)} | ${s.trades} trades | ${s.winRate}% WR\n`;
                    if (!bestProfit || profit > bestProfit.profit) bestProfit = { name: s.name, profit, winRate: s.winRate, trades: s.trades };
                }
            }

            // Global report summary
            if (ctx.globalReport) {
                const gr = ctx.globalReport;
                reply += `\n**Geral:** ${gr.totalTrades || 0} trades | Win Rate Global: ${gr.globalWinRate ? (gr.globalWinRate * 100).toFixed(1) + '%' : 'N/A'} | P&L Total: $${(gr.totalProfit || gr.totalPnl || 0).toFixed(2)}\n`;
            }

            if (bestProfit) {
                reply += `\n**🥇 Maior Lucro: ${bestProfit.name}** — $${bestProfit.profit.toFixed(2)} (${bestProfit.winRate.toFixed(1)}% WR em ${bestProfit.trades} trades)\n`;
            }

            return reply || 'Ranking indisponível — sem dados de estratégias.';
        }

        if (cmd.startsWith('/relatorio') || cmd.startsWith('/daily') || cmd === '/report') {
            let reply = '**📊 Relatório do Sistema**\n';

            if (ctx.account) {
                reply += `\n**Conta:** Balance $${ctx.account.balance.toFixed(2)} | Equity $${ctx.account.equity.toFixed(2)} | Flutuante ${ctx.account.profit >= 0 ? '+' : ''}$${ctx.account.profit.toFixed(2)}`;
            }
            if (ctx.marketStatus) reply += `\n**Posições:** ${ctx.marketStatus}`;

            if (ctx.scoreboard?.daily) {
                const d = ctx.scoreboard.daily;
                reply += `\n\n**Omni Hoje:** ${d.wins || 0} ganhos / ${d.losses || 0} perdas | P&L: $${(d.netProfit || 0).toFixed(2)}`;
                reply += `\n**Omni Semana:** ${ctx.scoreboard.weekly?.wins || 0}V / ${ctx.scoreboard.weekly?.losses || 0}D | $${(ctx.scoreboard.weekly?.netProfit || 0).toFixed(2)}`;
                reply += `\n**Omni Mês:** ${ctx.scoreboard.monthly?.wins || 0}V / ${ctx.scoreboard.monthly?.losses || 0}D | $${(ctx.scoreboard.monthly?.netProfit || 0).toFixed(2)}`;
            }

            if (ctx.goldScalper) {
                reply += `\n\n**Gold Scalper GSL1:** ${ctx.goldScalper.status} | ${ctx.goldScalper.winRate}% WR | $${(ctx.goldScalper.profit || 0).toFixed(2)}`;
            }

            if (ctx.dbStats) {
                reply += `\n\n**Geral DB:** ${ctx.dbStats.totalTrades} trades | ${ctx.dbStats.winRate}% WR | $${(ctx.dbStats.totalProfit || 0).toFixed(2)}`;
            }

            if (ctx.enginesStatus) {
                const online = ctx.enginesStatus.filter(e => e.status === 'online' || e.status === 'active').length;
                reply += `\n**Motores:** ${online}/${ctx.enginesStatus.length} online`;
            }

            reply += `\n\n_Atualizado: ${new Date().toLocaleString('pt-BR')}_`;
            return reply;
        }

        if (cmd === '/conta' || cmd === '/account') {
            if (ctx.account) {
                return `**Conta Radar FX**\n- Balance: $${ctx.account.balance.toFixed(2)}\n- Equity: $${ctx.account.equity.toFixed(2)}\n- P&L Flutuante: ${ctx.account.profit >= 0 ? '+' : ''}$${ctx.account.profit.toFixed(2)}\n- Posições: ${ctx.marketStatus || 'N/A'}`;
            }
            return 'Dados da conta indisponíveis.';
        }

        if (cmd === '/alertas' || cmd === '/alerts') {
            const alerts: string[] = [];
            if (ctx.recentErrors?.length) alerts.push(...ctx.recentErrors.map((e: string) => `⚠️ ${e}`));
            if (ctx.account && ctx.account.profit < -100) alerts.push(`🔴 Drawdown elevado: $${ctx.account.profit.toFixed(2)}`);
            if (ctx.enginesStatus) {
                const offline = ctx.enginesStatus.filter(e => e.status !== 'online' && e.status !== 'active');
                for (const e of offline) alerts.push(`⛔ Motor ${e.name} offline`);
            }
            return alerts.length ? `**🚨 Alertas**\n${alerts.join('\n')}` : '✅ Nenhum alerta ativo.';
        }

        if (cmd === '/ajuda' || cmd === '/help' || cmd === '/comandos') {
            return `**🦊 FOX — Assistente Radar FX**

**Comandos:**\n/relatorio — Relatório completo do sistema\n/ranking — Ranking e maior lucro das estratégias\n/conta — Balance, Equity, P&L\n/alertas — Erros, drawdown, motores offline\n/ajuda — Esta mensagem

**📡 Robôs & Estratégias do Radar FX:**

**Gold Scalper (GSL1)** — Scalping em Ouro, sinal GSL1, alta frequência
**Omni Probabilistic** — MHI1, MHI2, MHI3, TWIN_TOWERS, CYCLE_OF_3
**Supreme** — Estratégia de alta precisão multi-par
**Shark Bot** — Robô agressivo de rompimento
**Wolf Bot** — Robô de tendência com trailing dinâmico
**Bitcoin Pro** — Robô especializado em BTC
**Aura Quant** — Estratégia quantitativa baseada em momentum
**Crypto IA** — Robô de criptomoedas com IA
**Motor IA** — Motor adaptativo com aprendizado de máquina
**Recovery** — Estratégia de recuperação de perdas
**Micro Scalper** — Scalping em timeframes M1/M5
**Swing Trader** — Swing trade multicurrency (2-15 dias)
**Forex Scalper** — Scalping clássico em Forex
**Sweep** — Caçador de liquidez (sweep de stops)
**Copy Trader** — Copia sinais de contas mestras
**Gold Guardian** — Proteção e hedge em Ouro
**Trade Guardian** — Gerenciamento de risco geral

_Dica: use /relatorio para ver o desempenho em tempo real de cada robô_`;
        }

        return null;
    }

    static async askStream(
        sessionId: string,
        userMessage: string,
        onToken: (token: string) => void,
        model?: CopilotModel,
        mode: CopilotMode = 'general',
        symbol?: string,
        timeframe?: string
    ): Promise<AskStreamResult> {
        const memory = this.conversationMemory.get(sessionId) || [];
        memory.push({ role: 'user', content: userMessage });
        if (memory.length > this.MAX_HISTORY) memory.splice(0, memory.length - this.MAX_HISTORY);

        const context = await this.gatherContext();

        // Check slash command first
        if (userMessage.trim().startsWith('/')) {
            const slashReply = await this.handleSlashCommand(userMessage.trim(), context);
            if (slashReply) {
                onToken(slashReply);
                memory.push({ role: 'assistant', content: slashReply });
                this.conversationMemory.set(sessionId, memory);
                this.saveMemory();
                return { modelUsed: 'groq', wasSlashCommand: true };
            }
        }

        let modelUsed = model || 'groq';
        const models: CopilotModel[] = model ? [model, 'groq', 'gemini'] : ['groq', 'gemini'];
        let responded = false;

        for (const m of models) {
            try {
                if (m === 'groq') {
                    await this.groqStream(userMessage, context, memory, onToken, mode, symbol, timeframe);
                    modelUsed = m;
                    responded = true;
                    break;
                } else if (m === 'gemini') {
                    const text = await this.geminiResponse(userMessage, context, memory, mode, symbol, timeframe);
                    onToken(text);
                    modelUsed = m;
                    responded = true;
                    break;
                }
            } catch (e: any) {
                console.log(`[Fox] ${m} falhou no stream: ${e?.message}. Pulando...`);
            }
        }

        if (!responded) {
            const fallback = this.fallbackResponse(userMessage, context);
            onToken(fallback);
        }

        // Save memory with the full response
        this.conversationMemory.set(sessionId, memory);
        this.saveMemory();

        return { modelUsed, wasSlashCommand: false };
    }

    private static async tryModel(
        model: CopilotModel,
        msg: string,
        ctx: CopilotContext,
        memory: { role: string; content: string }[],
        mode: CopilotMode,
        symbol?: string,
        timeframe?: string
    ): Promise<string | null> {
        try {
            switch (model) {
                case 'gemini': return await this.geminiResponse(msg, ctx, memory, mode, symbol, timeframe);
                case 'groq': return await this.groqResponse(msg, ctx, memory, mode, symbol, timeframe);
            }
        } catch (e: any) {
            console.log(`[Copilot] ${model} falhou: ${e?.message || e}. Pulando...`);
            return null;
        }
    }

    private static async gatherContext(): Promise<CopilotContext> {
        const ctx: CopilotContext = {};
        const SERVER_BASE = `http://127.0.0.1:${process.env.PORT || '3015'}`;

        // Omni Engine - full status with rankings
        try {
            const omniStatus = await OmniProbabilisticEngine.getStatus();
            ctx.omniEnabled = omniStatus.enabled;
            ctx.omniTrades = omniStatus.history?.length || 0;
            ctx.activeStrategies = [omniStatus.settings?.strategy].filter(Boolean);
            const lastLogs = omniStatus.logs || [];
            ctx.recentErrors = lastLogs.filter((l: any) => l.type === 'ERROR').slice(0, 5).map((l: any) => l.msg);
            const history = omniStatus.history || [];
            const ranking = OmniProbabilisticEngine.calculateStrategyRanking(history);
            ctx.strategyRanking = ranking ? Object.entries(ranking).map(([name, r]: any) => ({
                name,
                trades: r.trades || 0,
                winRate: r.winRate || 0,
                profit: r.profit || 0,
                profitFactor: r.profitFactor || 0,
                status: r.status || 'inactive'
            })) : [];
            const scoreboard = OmniProbabilisticEngine.getScoreboard(history);
            if (scoreboard) ctx.scoreboard = scoreboard;
        } catch { /* omni not available */ }

        // Positions & Account from bridge
        try {
            const [posResp, accResp] = await Promise.allSettled([
                axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 3000 }),
                axios.get(`${this.BRIDGE_URL}/account`, { timeout: 3000 }),
            ]);
            if (posResp.status === 'fulfilled') {
                const positions = posResp.value.data || [];
                ctx.marketStatus = `${positions.length} posição(ões) aberta(s)`;
                const comments = positions.map((p: any) => p.comment || '').filter(Boolean);
                ctx.activeStrategies = [...new Set([...(ctx.activeStrategies || []), ...comments])];
            }
            if (accResp.status === 'fulfilled' && accResp.value.data) {
                const a = accResp.value.data;
                ctx.account = {
                    balance: a.balance || 0,
                    equity: a.equity || 0,
                    profit: (a.equity || 0) - (a.balance || 0),
                };
            }
        } catch { /* bridge not available */ }

        // Gold Scalper Engine status
        try {
            const gsResp = await axios.get(`${SERVER_BASE}/api/mt5/gold-scalper/status`, { timeout: 4000 });
            if (gsResp.data) {
                const gs = gsResp.data;
                ctx.goldScalper = {
                    status: gs.status || gs.state || 'unknown',
                    trades: gs.totalTrades || gs.trades || 0,
                    winRate: gs.winRate || gs.statistics?.winRate || 0,
                    profit: gs.profit || gs.statistics?.profit || 0,
                };
            }
        } catch { /* GS not available */ }

        // Strategy report (all engines performance)
        try {
            const srResp = await axios.get(`${SERVER_BASE}/api/mt5/reports/strategies`, { timeout: 4000 });
            if (Array.isArray(srResp.data)) {
                ctx.strategies = srResp.data.map((s: any) => ({
                    name: s.name || s.strategy || 'unknown',
                    status: s.status || s.state || 'unknown',
                    trades: s.trades || s.totalTrades || 0,
                    winRate: s.winRate || 0,
                    profit: s.profit || s.netProfit || 0,
                }));
            }
        } catch { /* strategy report not available */ }

        // Global report (aggregated)
        try {
            const grResp = await axios.get(`${SERVER_BASE}/api/mt5/global-report`, { timeout: 5000 });
            if (grResp.data) ctx.globalReport = grResp.data;
        } catch { /* global report not available */ }

        // DB stats
        try {
            const dbResp = await axios.get(`${SERVER_BASE}/api/db/stats`, { timeout: 3000 });
            if (dbResp.data) {
                ctx.dbStats = {
                    totalTrades: dbResp.data.totalTrades || dbResp.data.count || 0,
                    winRate: dbResp.data.winRate || 0,
                    totalProfit: dbResp.data.totalProfit || dbResp.data.totalPnl || 0,
                };
            }
        } catch { /* db stats not available */ }

        // Intel Engine status
        try {
            const ieResp = await axios.get(`${SERVER_BASE}/api/intel-engine/status`, { timeout: 3000 });
            if (ieResp.data) {
                ctx.intelStatus = ieResp.data.status || (ieResp.data.agents ? 'online' : 'unknown');
            }
        } catch { /* intel not available */ }

        // All engines status from ai-monitoring
        try {
            const monResp = await axios.get(`${SERVER_BASE}/api/mt5/ai-monitoring`, { timeout: 4000 });
            if (Array.isArray(monResp.data?.engines)) {
                ctx.enginesStatus = monResp.data.engines.map((e: any) => ({
                    name: e.name || e.engine || 'unknown',
                    status: e.status || 'unknown',
                    trades: e.trades || 0,
                    profit: e.profit || 0,
                }));
            }
        } catch { /* monitoring not available */ }

        return ctx;
    }

    private static async fetchCandles(symbol: string, timeframe: string, count: number = 100): Promise<CandleData[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles`, {
                params: { symbol, timeframe: timeframe || 'H1', count },
                timeout: 5000
            });
            if (!Array.isArray(resp.data)) return [];
            return resp.data.map((c: any) => ({
                time: new Date(c.time * 1000).toISOString().replace('T', ' ').slice(0, 19),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0
            }));
        } catch { return []; }
    }

    private static calcSMA(data: number[], period: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { result.push(NaN); continue; }
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += data[j];
            result.push(sum / period);
        }
        return result;
    }

    private static calcRSI(candles: CandleData[], period: number = 14): number {
        if (candles.length < period + 1) return 0;
        let gains = 0, losses = 0;
        for (let i = candles.length - period; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) gains += change; else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private static calcMACD(candles: CandleData[]): { macd: number; signal: number; histogram: number } {
        const closes = candles.map(c => c.close);
        const ema12 = this.calcEMA(closes, 12);
        const ema26 = this.calcEMA(closes, 26);
        const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
        const macdHistory: number[] = [];
        for (let i = 0; i < closes.length; i++) {
            const e12 = this.calcEMA(closes.slice(0, i + 1), 12);
            const e26 = this.calcEMA(closes.slice(0, i + 1), 26);
            if (e12.length && e26.length) macdHistory.push(e12[e12.length - 1] - e26[e26.length - 1]);
        }
        const signal = this.calcEMA(macdHistory, 9);
        const signalVal = signal.length > 0 ? signal[signal.length - 1] : 0;
        return { macd: macdLine, signal: signalVal, histogram: macdLine - signalVal };
    }

    private static calcEMA(data: number[], period: number): number[] {
        const result: number[] = [];
        const multiplier = 2 / (period + 1);
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { result.push(NaN); continue; }
            if (i === period - 1) {
                let sum = 0;
                for (let j = 0; j < period; j++) sum += data[j];
                result.push(sum / period);
            } else {
                result.push((data[i] - result[result.length - 1]) * multiplier + result[result.length - 1]);
            }
        }
        return result;
    }

    private static calcBollinger(candles: CandleData[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
        const closes = candles.map(c => c.close);
        const sma = this.calcSMA(closes, period);
        const middle = sma[sma.length - 1] || closes[closes.length - 1];
        const slice = closes.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / slice.length;
        const std = Math.sqrt(variance);
        return { upper: middle + stdDev * std, middle, lower: middle - stdDev * std };
    }

    private static calcATR(candles: CandleData[], period: number = 14): number {
        if (candles.length < period + 1) return 0;
        const trs: number[] = [];
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
        }
        return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    private static computeIndicators(candles: CandleData[]): TechnicalIndicators | null {
        try {
            return {
                rsi: this.calcRSI(candles),
                macd: this.calcMACD(candles),
                bollinger: this.calcBollinger(candles),
                atr: this.calcATR(candles),
            };
        } catch { return null; }
    }

    private static buildSystemPrompt(ctx: CopilotContext, mode: CopilotMode, symbol?: string, timeframe?: string, candles?: CandleData[], research?: ResearchData): string {
        if (mode === 'analyst' && candles && candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            const high24h = Math.max(...candles.slice(-24).map(c => c.high));
            const low24h = Math.min(...candles.slice(-24).map(c => c.low));
            const closes = candles.map(c => c.close);
            const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
            const indicators = this.computeIndicators(candles);

            const candleTable = candles.slice(-30).map(c =>
                `  ${c.time} | O:${c.open.toFixed(5)} H:${c.high.toFixed(5)} L:${c.low.toFixed(5)} C:${c.close.toFixed(5)} V:${c.volume}`
            ).join('\n');

            let indicatorBlock = '';
            if (indicators) {
                const bb = indicators.bollinger;
                const macd = indicators.macd;
                indicatorBlock = `
INDICADORES TÉCNICOS:
- RSI(14): ${indicators.rsi.toFixed(2)} ${indicators.rsi > 70 ? '(SOBRECOMPRADO)' : indicators.rsi < 30 ? '(SOBREVENDIDO)' : '(NEUTRO)'}
- MACD(12,26,9): linha ${macd.macd.toFixed(5)} | sinal ${macd.signal.toFixed(5)} | histograma ${macd.histogram.toFixed(5)} ${macd.histogram > 0 ? '(ALTA)' : '(BAIXA)'}
- Bollinger(20,2): superior ${bb.upper.toFixed(5)} | média ${bb.middle.toFixed(5)} | inferior ${bb.lower.toFixed(5)}
- ATR(14): ${indicators.atr.toFixed(5)} (volatilidade)
- Preço em relação às Bandas: ${lastCandle.close > bb.upper ? 'acima da banda superior (estendido)' : lastCandle.close < bb.lower ? 'abaixo da banda inferior (estendido)' : 'dentro das bandas'}
- Largura da Banda: ${((bb.upper - bb.lower) / bb.middle * 100).toFixed(2)}%`;
            }

            const calendarBlock = research?.calendar?.length
                ? '\n' + ResearchService.formatCalendarMarkdown(research.calendar)
                : '\n### EVENTOS ECONÔMICOS\nNão foi possível carregar o calendário.';

            const analysisBlock = research?.analysisSources?.length
                ? '\n' + ResearchService.formatAnalysisMarkdown(research.analysisSources)
                : '';

            const investingBlock = research?.investingTech
                ? '\n' + ResearchService.formatInvestingMarkdown(research.investingTech, symbol || '')
                : '';

            return `${SMC_ANALYST_PROMPT}

DADOS DO ATIVO:
- Símbolo: ${symbol || 'N/A'}
- Timeframe: ${timeframe || 'H1'}
- Preço atual: ${lastCandle.close.toFixed(5)}
- Máxima 24 períodos: ${high24h.toFixed(5)}
- Mínima 24 períodos: ${low24h.toFixed(5)}
- Média Móvel 20: ${sma20.toFixed(5)}
- Vela atual: ${lastCandle.close > lastCandle.open ? 'ALTA' : 'BAIXA'} (open:${lastCandle.open.toFixed(5)} close:${lastCandle.close.toFixed(5)})
${indicatorBlock}
${calendarBlock}
${analysisBlock}
${investingBlock}
ÚLTIMOS 30 CANDLES:
\`\`\`
${candleTable}
\`\`\`

Com base nos candles, indicadores, calendário econômico e análises externas acima, faça a análise SMC completa. Considere os eventos econômicos futuros e as análises de mercado como parte fundamental da sua decisão.`;
        }

        const omniState = ctx.omniEnabled ? '✅ ATIVO' : '⏸️ PAUSADO';
        const positions = ctx.marketStatus || 'indisponível';
        const errors = ctx.recentErrors?.length ? ctx.recentErrors.join(' | ') : 'nenhum';
        const tradesInfo = ctx.omniTrades !== undefined ? `${ctx.omniTrades} trades` : 'sem dados';

        let ctxBlock = `Você é a **FOX**, a assistente oficial especialista do **Radar FX**, uma plataforma profissional de trading algorítmico multi-robô. Você tem acesso completo a TODOS os dados do sistema em tempo real: status de robôs, performance de estratégias, win rates, P&L, risco, conta, calendário econômico e análises técnicas.

Você domina todas as 16 engines/estratégias do Radar FX: Omni Probabilistic (TWIN_TOWERS, MHI1, MHI2, MHI3, CYCLE_OF_3), Gold Scalper (GSL1), Supreme, Shark Bot, Wolf Bot, Bitcoin Pro, Aura Quant, Crypto IA, Motor IA, Recovery, Micro Scalper, Swing Trader, Forex Scalper, Sweep, Copy Trader, Gold Guardian, Trade Guardian.

Responda EM PORTUGUÊS de forma direta, técnica e precisa. Quando perguntarem sobre taxa de acerto, performance, P&L de uma estratégia específica, você deve consultar os dados abaixo e dar a resposta exata — não diga "não tenho informação". Use os dados fornecidos no contexto abaixo.

## 🔴 DADOS DO SISTEMA EM TEMPO REAL

### Conta
${ctx.account ? `Balance: $${ctx.account.balance.toFixed(2)} | Equity: $${ctx.account.equity.toFixed(2)} | P&L Flutuante: ${ctx.account.profit >= 0 ? '+' : ''}$${ctx.account.profit.toFixed(2)}` : 'Indisponível'}
${ctx.marketStatus ? `Posições abertas: ${ctx.marketStatus}` : ''}

### Omni Probabilistic Engine
- Status: ${omniState} | Histórico: ${tradesInfo}
- Estratégia atual: ${ctx.activeStrategies?.join(', ') || 'N/A'}
- Últimos erros: ${errors}`;

        // Strategy rankings from Omni
        if (ctx.strategyRanking && ctx.strategyRanking.length > 0) {
            ctxBlock += '\n\n**Ranking de Estratégias (Omni):**\n';
            ctxBlock += '| Estratégia | Trades | Win Rate | Lucro | F. Lucro | Status |\n|---|---|---|---|---|---|\n';
            for (const r of ctx.strategyRanking) {
                ctxBlock += `| ${r.name} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% | ${r.profit >= 0 ? '+' : ''}$${r.profit.toFixed(2)} | ${r.profitFactor.toFixed(2)} | ${r.status} |\n`;
            }
        }

        // Scoreboard
        if (ctx.scoreboard) {
            const d = ctx.scoreboard.daily;
            const w = ctx.scoreboard.weekly;
            const m = ctx.scoreboard.monthly;
            ctxBlock += '\n**Scoreboard:**\n';
            if (d) ctxBlock += `- Diário: ${d.wins || 0}V / ${d.losses || 0}D | Lucro: $${(d.netProfit || 0).toFixed(2)} | Win Rate: ${d.winRate ? (d.winRate * 100).toFixed(1) + '%' : 'N/A'}\n`;
            if (w) ctxBlock += `- Semanal: ${w.wins || 0}V / ${w.losses || 0}D | Lucro: $${(w.netProfit || 0).toFixed(2)}\n`;
            if (m) ctxBlock += `- Mensal: ${m.wins || 0}V / ${m.losses || 0}D | Lucro: $${(m.netProfit || 0).toFixed(2)}\n`;
        }

        // Gold Scalper
        if (ctx.goldScalper) {
            ctxBlock += `\n**Gold Scalper (GSL1):**\n- Status: ${ctx.goldScalper.status} | Trades: ${ctx.goldScalper.trades} | Win Rate: ${ctx.goldScalper.winRate}% | P&L: $${(ctx.goldScalper.profit || 0).toFixed(2)}\n`;
        }

        // All strategies report
        if (ctx.strategies && ctx.strategies.length > 0) {
            ctxBlock += '\n**Desempenho por Estratégia (Relatório Geral):**\n';
            ctxBlock += '| Estratégia | Status | Trades | Win Rate | Lucro |\n|---|---|---|---|---|\n';
            for (const s of ctx.strategies) {
                ctxBlock += `| ${s.name} | ${s.status} | ${s.trades} | ${s.winRate}% | $${(s.profit || 0).toFixed(2)} |\n`;
            }
        }

        // Global report summary
        if (ctx.globalReport) {
            const gr = ctx.globalReport;
            ctxBlock += `\n**Relatório Global:**\n- Total Engines: ${gr.totalEngines || gr.engines?.length || 'N/A'}\n- Total Trades: ${gr.totalTrades || 0}\n- Win Rate Global: ${gr.globalWinRate ? (gr.globalWinRate * 100).toFixed(1) + '%' : 'N/A'}\n- P&L Total: $${(gr.totalProfit || gr.totalPnl || 0).toFixed(2)}\n`;
        }

        // DB stats
        if (ctx.dbStats) {
            ctxBlock += `\n**Banco de Dados:**\n- Total trades registrados: ${ctx.dbStats.totalTrades}\n- Win Rate geral: ${ctx.dbStats.winRate}%\n- P&L total: $${(ctx.dbStats.totalProfit || 0).toFixed(2)}\n`;
        }

        // Intel Engine
        if (ctx.intelStatus) {
            ctxBlock += `\n**Intel Engine (AI Monitoring):** ${ctx.intelStatus}\n`;
        }

        // Active engines
        if (ctx.enginesStatus && ctx.enginesStatus.length > 0) {
            ctxBlock += '\n**Status dos Motores:**\n';
            const online = ctx.enginesStatus.filter(e => e.status === 'online' || e.status === 'active').length;
            const total = ctx.enginesStatus.length;
            ctxBlock += `${online}/${total} online\n`;
        }

        ctxBlock += `\n---\nCom base nos dados ACIMA, responda à pergunta do usuário com precisão técnica. Se perguntarem sobre taxa de acerto de uma estratégia específica (ex: Gold Scalper GSL1), use os dados deste contexto. Se um dado específico não estiver disponível, sugira onde o usuário pode encontrar (ex: painel Financial Control, relatório diário, etc.).`;

        return ctxBlock;
    }

    private static async geminiResponse(
        msg: string,
        ctx: CopilotContext,
        memory: { role: string; content: string }[],
        mode: CopilotMode,
        symbol?: string,
        timeframe?: string
    ): Promise<string> {
        const model = this.getGemini();
        if (!model) throw new Error('GEMINI_API_KEY não configurada');

        let candles: CandleData[] = [];
        let research: ResearchData | undefined;
        if (mode === 'analyst' && symbol) {
            [candles, research] = await Promise.all([
                this.fetchCandles(symbol, timeframe || 'H1'),
                ResearchService.getResearch(symbol),
            ]);
        }

        const history = memory.slice(-10, -1).map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.content }]
        }));

        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: this.buildSystemPrompt(ctx, mode, symbol, timeframe, candles.length > 0 ? candles : undefined, research) }] },
                { role: 'model', parts: [{ text: 'Entendido. Estou pronto.' }] },
                ...history
            ]
        });

        const result = await chat.sendMessage(msg);
        return result.response.text();
    }

    private static groqStream(
        msg: string,
        ctx: CopilotContext,
        memory: { role: string; content: string }[],
        onToken: (token: string) => void,
        mode: CopilotMode,
        symbol?: string,
        timeframe?: string
    ): Promise<string> {
        const key = process.env.GROQ_API_KEY;
        if (!key) return Promise.reject(new Error('GROQ_API_KEY não configurada'));

        return (async () => {
            let candles: CandleData[] = [];
            let research: ResearchData | undefined;
            if (mode === 'analyst' && symbol) {
                [candles, research] = await Promise.all([
                    this.fetchCandles(symbol, timeframe || 'H1'),
                    ResearchService.getResearch(symbol),
                ]);
            }

            const prompt = this.buildSystemPrompt(ctx, mode, symbol, timeframe, candles.length > 0 ? candles : undefined, research);
            const messages = [
                { role: 'system', content: prompt },
                ...memory.slice(-15).map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))
            ];

            const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama-3.3-70b-versatile',
                messages,
                max_tokens: 2048,
                temperature: 0.5,
                stream: true
            }, {
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                responseType: 'stream',
                timeout: 30000
            });

            const stream = resp.data;
            let buffer = '';
            let fullContent = '';

            for await (const chunk of stream) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullContent += delta;
                            onToken(delta);
                        }
                    } catch { /* skip */ }
                }
            }

            return fullContent;
        })();
    }

    private static async groqResponse(
        msg: string,
        ctx: CopilotContext,
        memory: { role: string; content: string }[],
        mode: CopilotMode,
        symbol?: string,
        timeframe?: string
    ): Promise<string> {
        const key = process.env.GROQ_API_KEY;
        if (!key) throw new Error('GROQ_API_KEY não configurada');

        let candles: CandleData[] = [];
        let research: ResearchData | undefined;
        if (mode === 'analyst' && symbol) {
            [candles, research] = await Promise.all([
                this.fetchCandles(symbol, timeframe || 'H1'),
                ResearchService.getResearch(symbol),
            ]);
        }

        const messages = [
            { role: 'system', content: this.buildSystemPrompt(ctx, mode, symbol, timeframe, candles.length > 0 ? candles : undefined, research) },
            ...memory.slice(-15).map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))
        ];

        const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages,
            max_tokens: 2048,
            temperature: 0.5
        }, {
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            timeout: 30000
        });

        return resp.data.choices?.[0]?.message?.content || '';
    }

    private static fallbackResponse(msg: string, ctx: CopilotContext): string {
        const lower = msg.toLowerCase();
        const omniState = ctx.omniEnabled ? '✅ ATIVO' : '⏸️ PAUSADO';
        const tradesInfo = ctx.omniTrades !== undefined ? `${ctx.omniTrades} trades no histórico` : 'sem dados';
        const positions = ctx.marketStatus || 'indisponível';
        const strats = ctx.activeStrategies?.length ? ctx.activeStrategies.join(', ') : 'nenhuma ativa';

        if (lower.includes('omn') || lower.includes('robô')) {
            return `**Omni Probabilistic Engine**\n- Status: ${omniState}\n- Estratégia: ${strats}\n- Histórico: ${tradesInfo}\n- ${positions}`;
        }
        if (lower.includes('trade') || lower.includes('lucro') || lower.includes('perda')) {
            return `**Resumo de Trading**\n- ${positions}\n- Omni: ${omniState} | ${tradesInfo}`;
        }
        if (lower.includes('ajuda') || lower.includes('help')) {
            return `Comandos: "omni", "trades", "estratégias", "mercado", "erros", "config".`;
        }
        return `Não entendi. Tente: "status omni", "ajuda", "estratégias", "erros" ou "mercado".`;
    }
}
