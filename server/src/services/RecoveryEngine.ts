import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';

interface RecoverySettings {
    enabled: boolean;
    maxDrawdownPercent: number;
    maxDailyRecoveryTrades: number;
    baseLotSize: number;
    maxLotMultiplier: number;
    recoveryCooldownMinutes: number;
    targetSymbols: string[];
    minConfidenceScore: number;
    useMartingale: boolean;
    martingaleMultiplier: number;
    useAntiMartingale: boolean;
    antiMartingaleMultiplier: number;
    useKellySizing: boolean;
    kellyFraction: number;
    volatilityAdjustment: boolean;
    consecutiveLossThreshold: number;
    preserveModeOnDrawdown: boolean;
    telegramAlerts: boolean;
}

interface RecoveryState {
    active: boolean;
    currentDrawdown: number;
    dailyRecoveryTrades: number;
    consecutiveLosses: number;
    lastRecoveryTime: number;
    currentTier: number;
    totalRecovered: number;
    totalLosses: number;
    recoveryAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    inPreservationMode: boolean;
    lastResetDate: string;
}

interface StrategyStats {
    name: string;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalTrades: number;
    consecutiveLosses: number;
    maxConsecutiveLosses: number;
    recoveryRecommended: boolean;
    recoveryLotSize: number;
    recoveryConfidence: number;
}

interface RecoverySignal {
    symbol: string;
    direction: 'BUY' | 'SELL';
    strategyName: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    lotSize: number;
    confidence: number;
    recoveryFactor: number;
    expectedRecovery: number;
    reason: string;
}

interface TradeRecord {
    ticket: number;
    symbol: string;
    direction?: string;
    type?: string;
    volume: number;
    priceOpen: number;
    priceCurrent: number;
    profit: number;
    magic: number;
    comment: string;
    time: number;
}

export class RecoveryEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'recovery_settings.json');
    private static HISTORY_PATH = path.resolve(process.cwd(), 'recovery_history.json');

    private static settings: RecoverySettings = {
        enabled: false,
        maxDrawdownPercent: 15,
        maxDailyRecoveryTrades: 5,
        baseLotSize: 0.01,
        maxLotMultiplier: 3.0,
        recoveryCooldownMinutes: 30,
        targetSymbols: ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD'],
        minConfidenceScore: 40,
        useMartingale: true,
        martingaleMultiplier: 1.6,
        useAntiMartingale: true,
        antiMartingaleMultiplier: 1.3,
        useKellySizing: true,
        kellyFraction: 0.25,
        volatilityAdjustment: true,
        consecutiveLossThreshold: 2,
        preserveModeOnDrawdown: true,
        telegramAlerts: true,
    };

    private static state: RecoveryState = {
        active: false,
        currentDrawdown: 0,
        dailyRecoveryTrades: 0,
        consecutiveLosses: 0,
        lastRecoveryTime: 0,
        currentTier: 0,
        totalRecovered: 0,
        totalLosses: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        inPreservationMode: false,
        lastResetDate: new Date().toISOString().split('T')[0],
    };

    private static strategyStats: Map<string, StrategyStats> = new Map();
    private static isRunning = false;
    private static lastMarginCheck = 0;
    private static marginOk = false;
    private static recoveryHistory: any[] = [];

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            isRunning: this.isRunning,
            marginOk: this.marginOk,
            strategyStats: Array.from(this.strategyStats.values()),
            recentHistory: this.recoveryHistory.slice(-20).reverse(),
            performance: this.computePerformance(),
        };
    }

    private static computePerformance() {
        const total = this.state.recoveryAttempts;
        const success = this.state.successfulRecoveries;
        const failed = this.state.failedRecoveries;
        const winRate = total > 0 ? (success / total) * 100 : 0;
        const netResult = this.state.totalRecovered - this.state.totalLosses;
        return { totalAttempts: total, successes: success, failures: failed, winRate, netResult, totalRecovered: this.state.totalRecovered, totalLosses: this.state.totalLosses };
    }

    static updateSettings(partial: Partial<RecoverySettings>) {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
    }

    static async init() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadHistory();
        this.isRunning = true;
        console.log('🔄 RecoveryEngine: Motor de Recuperação Inteligente INICIADO');
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        console.log('🔄 RecoveryEngine: Motor de Recuperação PARADO');
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(this.SETTINGS_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8'));
                this.settings = { ...this.settings, ...data };
            }
        } catch (e) {
            console.warn('🔄 RecoveryEngine: Erro ao carregar configurações', e);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.warn('🔄 RecoveryEngine: Erro ao salvar configurações', e);
        }
    }

    private static loadHistory() {
        try {
            if (fs.existsSync(this.HISTORY_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.HISTORY_PATH, 'utf-8'));
                this.recoveryHistory = data.history || [];
                this.state = { ...this.state, ...data.state };
            }
        } catch (e) { /* silent */ }
    }

    private static saveHistory() {
        try {
            fs.writeFileSync(this.HISTORY_PATH, JSON.stringify({ history: this.recoveryHistory.slice(-200), state: this.state }, null, 2));
        } catch (e) { /* silent */ }
    }

    private static async loop() {
        while (this.isRunning) {
            try {
                if (!this.settings.enabled) {
                    await this.sleep(30000);
                    continue;
                }

                await this.resetDailyIfNeeded();
                await this.updateAccountMetrics();
                await this.analyzeEngineLosses();
                await this.evaluateRecovery();

            } catch (error) {
                console.error('🔄 RecoveryEngine: Loop error', error);
            }
            await this.sleep(30000);
        }
    }

    private static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static async resetDailyIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (this.state.lastResetDate !== today) {
            this.state.dailyRecoveryTrades = 0;
            this.state.lastResetDate = today;
            this.saveHistory();
        }
    }

    private static async updateAccountMetrics() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 });
            const balance = parseFloat(resp.data?.balance || '0');
            const equity = parseFloat(resp.data?.equity || balance);
            const peakStr = fs.existsSync(path.resolve(process.cwd(), 'account_peak.json'))
                ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'account_peak.json'), 'utf-8'))
                : { peak: balance };
            const peak = peakStr.peak || balance;
            if (equity > peak) {
                fs.writeFileSync(path.resolve(process.cwd(), 'account_peak.json'), JSON.stringify({ peak: equity }));
            }
            this.state.currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
            this.state.active = this.state.currentDrawdown > 1;
            this.marginOk = true;
        } catch {
            this.marginOk = false;
        }
    }

    private static async analyzeEngineLosses() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 10000 });
            const trades: any[] = Array.isArray(resp.data) ? resp.data : [];

            const strategyGroups = new Map<string, { wins: number; losses: number; grossProfit: number; grossLoss: number; consecutiveLosses: number; maxConsecutiveLosses: number; totalTrades: number; recentResults: boolean[] }>();

            const recentTrades = trades.slice(-100);
            for (const t of recentTrades) {
                const magic = t.magic || 0;
                const comment = (t.comment || '').toLowerCase();
                let strategyName = this.identifyStrategy(magic, comment);

                if (!strategyGroups.has(strategyName)) {
                    strategyGroups.set(strategyName, { wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, consecutiveLosses: 0, maxConsecutiveLosses: 0, totalTrades: 0, recentResults: [] });
                }
                const stats = strategyGroups.get(strategyName)!;
                const profit = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
                stats.totalTrades++;

                if (profit > 0) {
                    stats.wins++;
                    stats.grossProfit += profit;
                    stats.consecutiveLosses = 0;
                    stats.recentResults.push(true);
                } else if (profit < 0) {
                    stats.losses++;
                    stats.grossLoss += Math.abs(profit);
                    stats.consecutiveLosses++;
                    if (stats.consecutiveLosses > stats.maxConsecutiveLosses) {
                        stats.maxConsecutiveLosses = stats.consecutiveLosses;
                    }
                    stats.recentResults.push(false);
                }
                if (stats.recentResults.length > 50) stats.recentResults.shift();
            }

            this.state.consecutiveLosses = 0;
            for (const [, stats] of strategyGroups) {
                if (stats.consecutiveLosses > this.state.consecutiveLosses) {
                    this.state.consecutiveLosses = stats.consecutiveLosses;
                }
            }

            this.strategyStats.clear();
            for (const [name, stats] of strategyGroups) {
                const total = stats.wins + stats.losses;
                if (total === 0) continue;
                const winRate = (stats.wins / total) * 100;
                const avgWin = stats.wins > 0 ? stats.grossProfit / stats.wins : 0;
                const avgLoss = stats.losses > 0 ? stats.grossLoss / stats.losses : 0;
                const profitFactor = stats.grossLoss > 0 ? stats.grossProfit / stats.grossLoss : stats.grossProfit > 0 ? 999 : 0;

                const recoveryConfidence = this.calculateRecoveryConfidence(winRate, stats.consecutiveLosses, stats.maxConsecutiveLosses, profitFactor);
                const recoveryLot = this.calculateRecoveryLotSize(winRate, avgWin, avgLoss, stats.consecutiveLosses);

                this.strategyStats.set(name, {
                    name,
                    winRate,
                    avgWin,
                    avgLoss,
                    profitFactor,
                    totalTrades: total,
                    consecutiveLosses: stats.consecutiveLosses,
                    maxConsecutiveLosses: stats.maxConsecutiveLosses,
                    recoveryRecommended: recoveryConfidence >= this.settings.minConfidenceScore && stats.consecutiveLosses >= this.settings.consecutiveLossThreshold,
                    recoveryLotSize: recoveryLot,
                    recoveryConfidence,
                });
            }
        } catch (e) {
            console.warn('🔄 RecoveryEngine: Erro ao analisar perdas', e);
        }
    }

    private static identifyStrategy(magic: number, comment: string): string {
        const strategyMap: Record<number, string> = {
            7777: 'Supreme Engine',
            777111: 'Speed Scalper',
            8888: 'Crypto IA',
            88881: 'Alpha Robot',
            88882: 'Alpha Robot V2',
            9876: 'Shark Bot',
            9999: 'Gold Scalper',
            999111: 'Omni Probabilistic',
            202605: 'Agent IA',
        };
        if (strategyMap[magic]) return strategyMap[magic];
        if (comment.includes('gold')) return 'Gold Scalper';
        if (comment.includes('shark')) return 'Shark Bot';
        if (comment.includes('alpha')) return 'Alpha Robot';
        if (comment.includes('swing')) return 'Swing Trader';
        return `Magic_${magic}`;
    }

    private static calculateRecoveryConfidence(winRate: number, consecutiveLosses: number, maxConsecutiveLosses: number, profitFactor: number): number {
        if (winRate === 0) return 0;

        // Probabilidade de streak continuar: P(loss)^N
        const lossProb = 1 - (winRate / 100);
        const streakProb = Math.pow(lossProb, consecutiveLosses);
        const meanReversionScore = Math.max(0, Math.min(100, (1 - streakProb) * 100));

        // Quão perto estamos do max histórico de perdas consecutivas
        const streakRatio = maxConsecutiveLosses > 0 ? consecutiveLosses / maxConsecutiveLosses : 0;
        const exhaustionScore = Math.min(100, streakRatio * 100);

        // Profit factor: PF > 1 = bom, PF <= 1 = ruim
        const pfScore = profitFactor >= 999 ? 50 : Math.max(0, Math.min(100, (profitFactor - 0.5) * 50));

        const confidence = (meanReversionScore * 0.5) + (exhaustionScore * 0.3) + (pfScore * 0.2);
        return Math.min(100, Math.max(0, confidence));
    }

    private static calculateRecoveryLotSize(winRate: number, avgWin: number, avgLoss: number, consecutiveLosses: number): number {
        if (consecutiveLosses < this.settings.consecutiveLossThreshold) return this.settings.baseLotSize;

        let multiplier = 1;

        // Martingale factor
        if (this.settings.useMartingale) {
            const martingaleFactor = Math.pow(this.settings.martingaleMultiplier, consecutiveLosses - this.settings.consecutiveLossThreshold + 1);
            multiplier *= Math.min(martingaleFactor, this.settings.maxLotMultiplier);
        }

        // Anti-Martingale (increase after wins, but for recovery we reduce if winRate is low)
        if (this.settings.useAntiMartingale) {
            const wr = winRate / 100;
            const antiFactor = wr < 0.4 ? 0.8 : wr < 0.6 ? 1.0 : 1.2;
            multiplier *= antiFactor;
        }

        // Kelly sizing
        if (this.settings.useKellySizing && avgLoss > 0) {
            const wr = winRate / 100;
            const lossRate = 1 - wr;
            const kellyPct = avgWin > 0 ? (wr * avgWin - lossRate * avgLoss) / avgWin : 0;
            const kellyFactor = 1 + Math.max(0, kellyPct * this.settings.kellyFraction);
            multiplier *= kellyFactor;
        }

        // Volatility adjustment
        if (this.settings.volatilityAdjustment) {
            const recentVolatility = this.getRecentVolatility();
            const volFactor = recentVolatility < 1 ? 1 / Math.max(0.5, recentVolatility) : 1;
            multiplier *= Math.min(volFactor, 1.5);
        }

        return Math.round(this.settings.baseLotSize * Math.min(multiplier, this.settings.maxLotMultiplier) * 100) / 100;
    }

    private static getRecentVolatility(): number {
        try {
            const barsPath = path.resolve(process.cwd(), 'recent_bars_cache.json');
            if (!fs.existsSync(barsPath)) return 1;
            const data = JSON.parse(fs.readFileSync(barsPath, 'utf-8'));
            const closes = (data.bars || []).map((b: any) => b.c).filter((v: number) => v > 0);
            if (closes.length < 10) return 1;
            const mean = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
            const variance = closes.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / closes.length;
            const stdDev = Math.sqrt(variance);
            const avgPrice = mean;
            return avgPrice > 0 ? (stdDev / avgPrice) * 100 : 1;
        } catch { return 1; }
    }

    private static async evaluateRecovery() {
        if (this.state.dailyRecoveryTrades >= this.settings.maxDailyRecoveryTrades) return;
        if (this.state.currentTier >= 4 && this.settings.preserveModeOnDrawdown) {
            if (!this.state.inPreservationMode) {
                this.state.inPreservationMode = true;
                console.log('🔄 RecoveryEngine: MODO PRESERVAÇÃO ATIVADO - Drawdown crítico');
            }
            return;
        }
        if (Date.now() - this.state.lastRecoveryTime < this.settings.recoveryCooldownMinutes * 60 * 1000) return;

        this.determineDrawdownTier();

        const signals: RecoverySignal[] = [];
        for (const [, stats] of this.strategyStats) {
            if (!stats.recoveryRecommended) continue;

            const positions = await this.getOpenPositions();
            const position = positions.find(p => this.identifyStrategy(p.magic, p.comment) === stats.name);
            if (position) continue;

            const bars = await this.getRecentBars();
            if (!bars || bars.length < 20) continue;

            const price = bars[bars.length - 1].c;
            const sma20 = bars.slice(-20).reduce((a: number, b: any) => a + b.c, 0) / 20;
            const direction = price < sma20 && stats.consecutiveLosses >= this.settings.consecutiveLossThreshold ? 'BUY' : 'SELL';

            const atr = this.calcATR(bars);
            const slDistance = atr * 1.5;
            const tpDistance = slDistance * (stats.avgWin > 0 && stats.avgLoss > 0 ? Math.max(1.5, stats.avgWin / stats.avgLoss) : 2);

            const riskAmount = stats.recoveryLotSize * slDistance * 100;
            const rewardAmount = stats.recoveryLotSize * tpDistance * 100;

            signals.push({
                symbol: await this.findBestSymbol(stats.name),
                direction,
                strategyName: stats.name,
                entryPrice: price,
                stopLoss: direction === 'BUY' ? price - slDistance : price + slDistance,
                takeProfit: direction === 'BUY' ? price + tpDistance : price - tpDistance,
                lotSize: stats.recoveryLotSize,
                confidence: stats.recoveryConfidence,
                recoveryFactor: Math.pow(this.settings.martingaleMultiplier, Math.max(0, stats.consecutiveLosses - 1)),
                expectedRecovery: rewardAmount - riskAmount,
                reason: `Recuperação pós ${stats.consecutiveLosses}x perdas consecutivas | Confiança: ${stats.recoveryConfidence.toFixed(0)}%`,
            });
        }

        signals.sort((a, b) => b.confidence - a.confidence);

        for (const signal of signals) {
            if (signal.confidence < this.settings.minConfidenceScore) continue;
            if (this.state.dailyRecoveryTrades >= this.settings.maxDailyRecoveryTrades) break;
            if (!this.marginOk) {
                console.log('🔄 RecoveryEngine: Margem insuficiente para recovery');
                break;
            }

            await this.executeRecoveryTrade(signal);
        }
    }

    private static determineDrawdownTier() {
        const dd = this.state.currentDrawdown;
        if (dd < 3) this.state.currentTier = 0;
        else if (dd < 5) this.state.currentTier = 1;
        else if (dd < 8) this.state.currentTier = 2;
        else if (dd < this.settings.maxDrawdownPercent) this.state.currentTier = 3;
        else this.state.currentTier = 4;
    }

    private static async getOpenPositions(): Promise<TradeRecord[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            return Array.isArray(resp.data) ? resp.data : [];
        } catch { return []; }
    }

    private static async getRecentBars(symbol?: string): Promise<any[] | null> {
        try {
            const sym = symbol || 'XAUUSD';
            const resp = await axios.post(`${this.BRIDGE_URL}/candles`, { symbol: sym, timeframe: 'H1', count: 50 }, { timeout: 5000 });
            const data = resp.data?.candles || resp.data || [];
            return Array.isArray(data) ? data : null;
        } catch { return null; }
    }

    private static calcATR(bars: any[], period: number = 14): number {
        if (bars.length < period + 1) return 0;
        let trSum = 0;
        for (let i = 1; i <= period; i++) {
            const highLow = bars[i].h - bars[i].l;
            const highClose = Math.abs(bars[i].h - bars[i - 1].c);
            const lowClose = Math.abs(bars[i].l - bars[i - 1].c);
            trSum += Math.max(highLow, highClose, lowClose);
        }
        return trSum / period;
    }

    private static async findBestSymbol(strategyName: string): Promise<string> {
        const positions = await this.getOpenPositions();
        for (const sym of this.settings.targetSymbols) {
            if (!positions.some((p: TradeRecord) => p.symbol === sym)) return sym;
        }
        return this.settings.targetSymbols[0] || 'XAUUSD';
    }

    private static async executeRecoveryTrade(signal: RecoverySignal) {
        console.log(`🔄 RecoveryEngine: EXECUTANDO RECUPERAÇÃO ${signal.direction} ${signal.symbol} | Lote: ${signal.lotSize} | Confiança: ${signal.confidence.toFixed(0)}%`);

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: signal.symbol,
                action: signal.direction,
                lot: signal.lotSize,
                sl: Math.round(signal.stopLoss * 100) / 100,
                tp: Math.round(signal.takeProfit * 100) / 100,
                magic: 999000,
                comment: `Recovery ${signal.strategyName} v${signal.confidence.toFixed(0)}`,
            }, { timeout: 10000 });

            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (ticket) {
                SymbolLockService.acquire(signal.symbol, 'Recovery', ticket, signal.direction);
                this.state.lastRecoveryTime = Date.now();
                this.state.recoveryAttempts++;
                this.state.dailyRecoveryTrades++;

                const entry = {
                    ticket,
                    time: Date.now(),
                    symbol: signal.symbol,
                    direction: signal.direction,
                    strategy: signal.strategyName,
                    lotSize: signal.lotSize,
                    entryPrice: signal.entryPrice,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit,
                    confidence: signal.confidence,
                    reason: signal.reason,
                    result: 'PENDING' as string,
                    profit: 0,
                };
                this.recoveryHistory.push(entry);
                this.saveHistory();

                if (this.settings.telegramAlerts) {
                    try {
                        const { TradeNotificationBot } = require('./TradeNotificationBot');
                        TradeNotificationBot.notifyTradeOpened('Recovery Engine', signal.symbol, signal.direction, signal.lotSize, signal.entryPrice, signal.stopLoss, signal.takeProfit);
                    } catch (e) { /* notif fail */ }
                }

                    AlertEngine.addAlert('GUARDIAN', 'INFO', 'Recovery Engine', `${signal.direction} ${signal.symbol} ${signal.lotSize} lotes | ${signal.reason}`);
            }
        } catch (e) {
            console.error('🔄 RecoveryEngine: Falha ao executar recovery', e);
        }

        // Monitor open positions after placing
        await this.monitorRecoveryPositions();
    }

    private static async monitorRecoveryPositions() {
        try {
            const positions = await this.getOpenPositions();
            const recoveryPositions = positions.filter(p => p.magic === 999000);

            for (const pos of recoveryPositions) {
                const historyEntry = this.recoveryHistory.find(h => h.ticket === pos.ticket);
                if (!historyEntry) continue;
                if (historyEntry.result !== 'PENDING') continue;

                if (pos.profit !== 0 && (pos.profit >= historyEntry.takeProfit - historyEntry.entryPrice || pos.profit <= historyEntry.entryPrice - historyEntry.stopLoss)) {
                    const isWin = pos.profit > 0;
                    historyEntry.result = isWin ? 'WIN' : 'LOSS';
                    historyEntry.profit = pos.profit;
                    historyEntry.closeTime = Date.now();

                    if (isWin) {
                        this.state.successfulRecoveries++;
                        this.state.totalRecovered += pos.profit;
                        this.state.consecutiveLosses = 0;
                    } else {
                        this.state.failedRecoveries++;
                        this.state.totalLosses += Math.abs(pos.profit);
                    }

                    this.saveHistory();

                    if (this.settings.telegramAlerts) {
                        try {
                            const { TradeNotificationBot } = require('./TradeNotificationBot');
                            TradeNotificationBot.notifyTradeClosed('Recovery Engine', pos.symbol, pos.type || pos.direction, pos.profit, isWin ? 'WIN' : 'LOSS', isWin ? 'Take Profit' : 'Stop Loss', pos.volume || pos.volume);
                        } catch (e) { /* notif fail */ }
                    }

                    AlertEngine.addAlert('GUARDIAN', isWin ? 'INFO' : 'WARNING', 'Recovery Engine', `${isWin ? '✓' : '✗'} ${pos.symbol} ${isWin ? `+$${pos.profit.toFixed(2)}` : `-$${Math.abs(pos.profit).toFixed(2)}`}`);
                }
            }
        } catch (e) {
            console.warn('🔄 RecoveryEngine: Erro ao monitorar posições', e);
        }
    }

    static async getRecoverySignals(): Promise<RecoverySignal[]> {
        const signals: RecoverySignal[] = [];
        for (const [, stats] of this.strategyStats) {
            if (stats.recoveryRecommended) {
                signals.push({
                    symbol: await this.findBestSymbol(stats.name),
                    direction: 'BUY',
                    strategyName: stats.name,
                    entryPrice: 0,
                    stopLoss: 0,
                    takeProfit: 0,
                    lotSize: stats.recoveryLotSize,
                    confidence: stats.recoveryConfidence,
                    recoveryFactor: 1,
                    expectedRecovery: 0,
                    reason: `${stats.consecutiveLosses}x perdas consecutivas | WR: ${stats.winRate.toFixed(1)}%`,
                });
            }
        }
        return signals;
    }
}
