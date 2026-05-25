import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';

interface MotorIASettings {
    enabled: boolean;
    activeSymbols: string[];
    timeframe: string;
    maxDailyTrades: number;
    baseLot: number;
    maxLotMultiplier: number;
    minConfidence: number;
    useAdaptiveLearning: boolean;
    useRegimeDetection: boolean;
    useSentimentAnalysis: boolean;
    maxConsecutiveLosses: number;
    dailyStopLoss: number;
    dailyTakeProfit: number;
    telegramAlerts: boolean;
    cooldownMinutes: number;
}

interface MotorIAState {
    isReady: boolean;
    marketRegime: string;
    dailyTrades: number;
    dailyPnl: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    activePositions: number;
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    totalProfit: number;
    lastResetDate: string;
    lastTradeTime: number;
}

interface TradeExecution {
    id: string;
    time: number;
    symbol: string;
    direction: 'BUY' | 'SELL';
    lotSize: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    exitPrice: number | null;
    exitTime: number | null;
    profit: number | null;
    result: 'PENDING' | 'WIN' | 'LOSS';
    confidence: number;
    strategy: string;
    marketRegime: string;
    tags: string[];
    exitReason: string;
}

interface LearningData {
    symbol: string;
    direction: string;
    regime: string;
    confidence: number;
    success: boolean;
    timestamp: number;
}

interface RegimeData {
    regime: string;
    volatility: number;
    trend: string;
    strength: number;
}

export class MotorIAEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'motor_ia_settings.json');
    private static HISTORY_PATH = path.resolve(process.cwd(), 'motor_ia_history.json');
    private static LEARNING_PATH = path.resolve(process.cwd(), 'motor_ia_learning.json');

    private static settings: MotorIASettings = {
        enabled: false,
        activeSymbols: ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD'],
        timeframe: 'H1',
        maxDailyTrades: 10,
        baseLot: 0.01,
        maxLotMultiplier: 2.0,
        minConfidence: 55,
        useAdaptiveLearning: true,
        useRegimeDetection: true,
        useSentimentAnalysis: true,
        maxConsecutiveLosses: 3,
        dailyStopLoss: 50,
        dailyTakeProfit: 100,
        telegramAlerts: true,
        cooldownMinutes: 15,
    };

    private static state: MotorIAState = {
        isReady: false,
        marketRegime: 'UNKNOWN',
        dailyTrades: 0,
        dailyPnl: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        activePositions: 0,
        totalTrades: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        lastTradeTime: 0,
    };

    private static executions: TradeExecution[] = [];
    private static learningData: LearningData[] = [];
    private static regimeHistory: RegimeData[] = [];
    private static isRunning = false;

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            isRunning: this.isRunning,
            executions: this.executions.slice(-50).reverse(),
            regime: this.regimeHistory.slice(-10).reverse(),
            learningStats: this.computeLearningStats(),
            performance: this.computePerformance(),
        };
    }

    private static computeLearningStats() {
        const total = this.learningData.length;
        if (total === 0) return { totalSamples: 0 };
        const wins = this.learningData.filter(l => l.success).length;
        const winRate = (wins / total) * 100;
        const byRegime: Record<string, { wins: number; total: number }> = {};
        for (const d of this.learningData) {
            if (!byRegime[d.regime]) byRegime[d.regime] = { wins: 0, total: 0 };
            byRegime[d.regime].total++;
            if (d.success) byRegime[d.regime].wins++;
        }
        const regimeStats = Object.entries(byRegime).map(([r, s]) => ({
            regime: r, winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0, samples: s.total,
        }));
        return { totalSamples: total, overallWinRate: winRate, byRegime: regimeStats };
    }

    private static computePerformance() {
        const total = this.state.totalTrades;
        const wins = this.state.totalWins;
        const losses = this.state.totalLosses;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        return { totalTrades: total, wins, losses, winRate, netProfit: this.state.totalProfit };
    }

    static updateSettings(partial: Partial<MotorIASettings>) {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
    }

    static async init() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadHistory();
        this.loadLearning();
        this.isRunning = true;
        console.log('🧠 MotorIA: Cérebro de Inteligência Artificial INICIADO');
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        this.saveHistory();
        this.saveLearning();
        console.log('🧠 MotorIA: Motor de IA PARADO');
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(this.SETTINGS_PATH)) {
                this.settings = { ...this.settings, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) };
            }
        } catch (e) { console.warn('🧠 MotorIA: Erro ao carregar config', e); }
    }

    private static saveSettings() {
        try { fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2)); } catch (e) { }
    }

    private static loadHistory() {
        try {
            if (fs.existsSync(this.HISTORY_PATH)) {
                const d = JSON.parse(fs.readFileSync(this.HISTORY_PATH, 'utf-8'));
                this.executions = d.executions || [];
                if (d.state) this.state = { ...this.state, ...d.state };
            }
        } catch (e) { }
    }

    private static saveHistory() {
        try {
            fs.writeFileSync(this.HISTORY_PATH, JSON.stringify({
                executions: this.executions.slice(-500),
                state: this.state,
            }, null, 2));
        } catch (e) { }
    }

    private static loadLearning() {
        try {
            if (fs.existsSync(this.LEARNING_PATH)) {
                this.learningData = JSON.parse(fs.readFileSync(this.LEARNING_PATH, 'utf-8'));
            }
        } catch (e) { }
    }

    private static saveLearning() {
        try {
            fs.writeFileSync(this.LEARNING_PATH, JSON.stringify(this.learningData.slice(-1000), null, 2));
        } catch (e) { }
    }

    private static async loop() {
        while (this.isRunning) {
            try {
                if (!this.settings.enabled) { await this.sleep(30000); continue; }
                await this.resetDailyIfNeeded();
                await this.detectMarketRegime();
                await this.analyzeAllEngines();
                await this.monitorExecutions();
                await this.scanRecoveryOpportunities();
            } catch (e) {
                console.error('🧠 MotorIA: Loop error', e);
            }
            await this.sleep(15000);
        }
    }

    private static sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

    private static async resetDailyIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (this.state.lastResetDate !== today) {
            this.state.dailyTrades = 0;
            this.state.dailyPnl = 0;
            this.state.consecutiveLosses = 0;
            this.state.consecutiveWins = 0;
            this.state.lastResetDate = today;
            this.saveHistory();
        }
    }

    private static async detectMarketRegime() {
        if (!this.settings.useRegimeDetection) return;
        try {
            const bars = await this.fetchBars('XAUUSD', 'H1', 100);
            if (!bars || bars.length < 30) return;
            const closes = bars.map((b: any) => b.c);
            const returns = closes.slice(1).map((c: any, i: number) => (c - closes[i]) / closes[i] * 100);
            const mean = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
            const variance = returns.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / returns.length;
            const volatility = Math.sqrt(variance);
            const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
            const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
            const price = closes[closes.length - 1];
            let regime = 'NEUTRAL';
            if (volatility > 1.5) regime = 'HIGH_VOLATILITY';
            else if (volatility < 0.5) regime = 'LOW_VOLATILITY';
            if (price > sma20 && sma20 > sma50) regime = 'BULLISH';
            else if (price < sma20 && sma20 < sma50) regime = 'BEARISH';
            this.state.marketRegime = regime;
            const trend = price > sma50 ? 'UP' : price < sma50 ? 'DOWN' : 'SIDEWAYS';
            this.regimeHistory.push({ regime, volatility, trend, strength: Math.abs(mean) });
            if (this.regimeHistory.length > 100) this.regimeHistory.shift();
        } catch (e) { }
    }

    private static async fetchBars(symbol: string, tf: string, count: number): Promise<any[] | null> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol, timeframe: tf, count }, timeout: 5000 });
            return Array.isArray(resp.data?.candles) ? resp.data.candles : Array.isArray(resp.data) ? resp.data : null;
        } catch { return null; }
    }

    private static async analyzeAllEngines() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 10000 });
            const trades: any[] = Array.isArray(resp.data) ? resp.data : [];
            const recentTrades = trades.filter(t => t.magic === 999001).slice(-50);

            let totalLosses = 0;
            let totalWins = 0;
            let lossStreak = 0;
            let maxLossStreak = 0;

            for (const t of recentTrades) {
                const profit = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
                if (profit > 0) { totalWins++; lossStreak = 0; }
                else if (profit < 0) { totalLosses++; lossStreak++; if (lossStreak > maxLossStreak) maxLossStreak = lossStreak; }
            }

            this.state.consecutiveLosses = maxLossStreak;
            this.state.consecutiveWins = 0;

            for (const t of recentTrades.reverse()) {
                const profit = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
                if (profit > 0) { this.state.consecutiveWins++; }
                else break;
            }
        } catch (e) { }
    }

    private static async monitorExecutions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const positions: any[] = Array.isArray(resp.data) ? resp.data : [];
            const openTickets = new Set(positions.map(p => p.ticket));

            for (const exec of this.executions) {
                if (exec.result !== 'PENDING') continue;
                const pos = positions.find(p => p.ticket.toString() === exec.id);
                if (!pos) {
                    const resolved = await this.resolveExecution(exec);
                    if (resolved) this.updateLearning(exec);
                } else {
                    exec.entryPrice = pos.price_open || exec.entryPrice;
                }
            }
            this.state.activePositions = positions.filter(p => p.magic === 999001).length;
            this.saveHistory();
        } catch (e) { }
    }

    private static async resolveExecution(exec: TradeExecution): Promise<boolean> {
        try {
            const history = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 5000 });
            const trades: any[] = Array.isArray(history.data) ? history.data : [];
            const closed = trades.find((t: any) => t.ticket.toString() === exec.id);
            if (!closed) {
                exec.result = 'LOSS';
                exec.profit = -(exec.lotSize * 10);
                exec.exitReason = 'Desconhecido';
            } else {
                const profit = (closed.profit || 0) + (closed.commission || 0) + (closed.swap || 0);
                exec.exitPrice = closed.price_close || closed.price || exec.entryPrice;
                exec.exitTime = Date.now();
                exec.profit = profit;
                exec.result = profit > 0 ? 'WIN' : 'LOSS';
                exec.exitReason = profit > 0 ? 'Take Profit' : 'Stop Loss';
            }

            if (exec.result === 'WIN') {
                this.state.totalWins++;
                this.state.consecutiveWins++;
                this.state.consecutiveLosses = 0;
            } else {
                this.state.totalLosses++;
                this.state.consecutiveLosses++;
                this.state.consecutiveWins = 0;
            }
            this.state.totalTrades++;
            this.state.totalProfit += exec.profit || 0;
            this.state.dailyPnl += exec.profit || 0;

            if (this.settings.telegramAlerts) {
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeClosed('Motor IA', exec.symbol, exec.direction, exec.profit || 0, exec.result, exec.exitReason, exec.lotSize);
                } catch (e) { }
            }
            AlertEngine.addAlert('GUARDIAN', exec.result === 'WIN' ? 'INFO' : 'WARNING', 'Motor IA', `${exec.result} ${exec.symbol} ${exec.direction} $${(exec.profit || 0).toFixed(2)}`);
            return true;
        } catch { return false; }
    }

    private static updateLearning(exec: TradeExecution) {
        this.learningData.push({
            symbol: exec.symbol,
            direction: exec.direction,
            regime: exec.marketRegime,
            confidence: exec.confidence,
            success: exec.result === 'WIN',
            timestamp: Date.now(),
        });
        if (this.learningData.length > 1000) this.learningData = this.learningData.slice(-1000);
        this.saveLearning();
    }

    private static async scanRecoveryOpportunities() {
        if (this.state.dailyTrades >= this.settings.maxDailyTrades) return;
        if (this.state.consecutiveLosses >= this.settings.maxConsecutiveLosses && this.settings.useAdaptiveLearning) {
            console.log(`🧠 MotorIA: ${this.state.consecutiveLosses}x perdas consecutivas — pausando recuperação`);
            return;
        }
        if (this.state.dailyPnl <= -this.settings.dailyStopLoss) {
            console.log(`🧠 MotorIA: Stop loss diário atingido ($${this.state.dailyPnl.toFixed(2)})`);
            return;
        }

        const regime = this.state.marketRegime;
        const learning = this.learningData;
        const regimeSamples = learning.filter(l => l.regime === regime);
        const regimeWinRate = regimeSamples.length > 0
            ? regimeSamples.filter(l => l.success).length / regimeSamples.length * 100
            : 50;
        const confidence = Math.min(95, Math.max(10,
            (regimeWinRate * 0.4) +
            (this.state.consecutiveWins > 2 ? 20 : 0) +
            (this.state.consecutiveLosses > 0 ? 15 : 0) +
            (regime === 'BULLISH' ? 10 : regime === 'BEARISH' ? 5 : 0)
        ));

        if (confidence < this.settings.minConfidence) return;
        if (Date.now() - this.state.lastTradeTime < this.settings.cooldownMinutes * 60 * 1000) return;

        for (const symbol of this.settings.activeSymbols) {
            const bars = await this.fetchBars(symbol, this.settings.timeframe, 30);
            if (!bars || bars.length < 20) continue;
            const price = bars[bars.length - 1].c;
            const sma10 = bars.slice(-10).reduce((a: number, b: any) => a + b.c, 0) / 10;
            const sma20 = bars.slice(-20).reduce((a: number, b: any) => a + b.c, 0) / 20;
            const atr = this.calcATR(bars, 14);
            if (atr <= 0) continue;

            const direction = price < sma10 && sma10 < sma20 ? 'SELL' : price > sma10 && sma10 > sma20 ? 'BUY' : null;
            if (!direction) continue;
            if (this.state.consecutiveLosses >= 2 && confidence < 65) continue;

            const lot = Math.round(this.settings.baseLot * (1 + (confidence - 50) / 100) * 100) / 100;
            const slDist = atr * 1.2;
            const tpDist = slDist * 2;
            const sl = direction === 'BUY' ? price - slDist : price + slDist;
            const tp = direction === 'BUY' ? price + tpDist : price - tpDist;

            await this.executeTrade({
                symbol, direction, lotSize: Math.min(lot, this.settings.baseLot * this.settings.maxLotMultiplier),
                entryPrice: price, stopLoss: sl, takeProfit: tp,
                confidence, strategy: 'Motor IA Adaptive',
                marketRegime: regime, tags: [regime, `WR${regimeWinRate.toFixed(0)}`],
            });
            break;
        }
    }

    private static calcATR(bars: any[], period: number): number {
        if (bars.length < period + 1) return 0;
        let trSum = 0;
        for (let i = 1; i <= period; i++) {
            const hl = bars[i].h - bars[i].l;
            const hc = Math.abs(bars[i].h - bars[i - 1].c);
            const lc = Math.abs(bars[i].l - bars[i - 1].c);
            trSum += Math.max(hl, hc, lc);
        }
        return trSum / period;
    }

    private static async executeTrade(params: {
        symbol: string; direction: 'BUY' | 'SELL'; lotSize: number;
        entryPrice: number; stopLoss: number; takeProfit: number;
        confidence: number; strategy: string; marketRegime: string; tags: string[];
    }) {
        const execId = `IA_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        console.log(`🧠 MotorIA: EXECUTANDO ${params.direction} ${params.symbol} | Lote: ${params.lotSize} | Confiança: ${params.confidence.toFixed(0)}% | Regime: ${params.marketRegime}`);

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: params.symbol, action: params.direction, lot: params.lotSize,
                sl: Math.round(params.stopLoss * 100) / 100,
                tp: Math.round(params.takeProfit * 100) / 100,
                magic: 999001, comment: `MotorIA v${params.confidence.toFixed(0)}`,
            }, { timeout: 10000 });

            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (!ticket) return;
            SymbolLockService.acquire(params.symbol, 'Motor IA', ticket, params.direction);

            const exec: TradeExecution = {
                id: ticket.toString(), time: Date.now(), ...params,
                exitPrice: null, exitTime: null, profit: null,
                result: 'PENDING', exitReason: '',
            };

            this.executions.push(exec);
            this.state.dailyTrades++;
            this.state.lastTradeTime = Date.now();
            this.state.activePositions++;
            this.saveHistory();

            if (this.settings.telegramAlerts) {
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Motor IA', params.symbol, params.direction, params.lotSize, params.entryPrice, params.stopLoss, params.takeProfit);
                } catch (e) { }
            }
            AlertEngine.addAlert('GUARDIAN', 'INFO', 'Motor IA', `${params.direction} ${params.symbol} ${params.lotSize} lotes | ${params.confidence.toFixed(0)}% conf.`);
        } catch (e) {
            console.error('🧠 MotorIA: Falha na ordem', e);
        }
    }

    static getExecutions(filters?: { symbol?: string; result?: string; limit?: number }) {
        let result = [...this.executions];
        if (filters?.symbol) result = result.filter(e => e.symbol === filters.symbol);
        if (filters?.result) result = result.filter(e => e.result === filters.result);
        result.sort((a, b) => b.time - a.time);
        return result.slice(0, filters?.limit || 50);
    }

    static getLearningInsights() {
        const learning = this.learningData;
        const bySymbol: Record<string, { wins: number; total: number }> = {};
        const byDirection: Record<string, { wins: number; total: number }> = {};

        for (const d of learning) {
            if (!bySymbol[d.symbol]) bySymbol[d.symbol] = { wins: 0, total: 0 };
            bySymbol[d.symbol].total++;
            if (d.success) bySymbol[d.symbol].wins++;
            if (!byDirection[d.direction]) byDirection[d.direction] = { wins: 0, total: 0 };
            byDirection[d.direction].total++;
            if (d.success) byDirection[d.direction].wins++;
        }

        return {
            bySymbol: Object.entries(bySymbol).map(([s, v]) => ({
                symbol: s, winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0, samples: v.total,
            })),
            byDirection: Object.entries(byDirection).map(([d, v]) => ({
                direction: d, winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0, samples: v.total,
            })),
            totalSamples: learning.length,
        };
    }
}
