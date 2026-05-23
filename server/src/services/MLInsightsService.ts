import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { InstitutionalEngine } from './InstitutionalEngine';
import { TelegramService } from './TelegramService';

interface Candle {
    time?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface TimeframeSignal {
    timeframe: string;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    ema: number;
    rsi: number;
}

interface SupportResistance {
    support: number;
    resistance: number;
}

interface InstitutionalData {
    power: number;
    type: string;
    bias: string;
    confidence: number;
}

interface SymbolPrediction {
    symbol: string;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    rewardRisk: number;
    signalStrength: 'ALTA' | 'MODERADA' | 'FRACA';
    error?: string;
    horizon: string;
    timeframes: TimeframeSignal[];
    supportResistance: SupportResistance;
    institutional: InstitutionalData | null;
    factors: { name: string; impact: number }[];
}

interface MarketRegime {
    regime: 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGING' | 'VOLATILE' | 'SILENT';
    volatility: number;
    strength: number;
    probability: number;
    description: string;
}

interface NewsSentiment {
    title: string;
    source: string;
    time: string;
    sentiment: number;
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    keywords: string[];
    relevance: number;
}

interface RiskMetrics {
    sharpe: number;
    sortino: number;
    calmar: number;
    var95: number;
    cvar95: number;
    maxDrawdown: number;
    expectancy: number;
    profitFactor: number;
}

interface PredictionRecord {
    id: string;
    symbol: string;
    direction: 'UP' | 'DOWN';
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    signalStrength: string;
    confidence: number;
    rewardRisk: number;
    timestamp: string;
    resolved?: 'WIN' | 'LOSS' | 'PENDING';
    resolvedAt?: string;
    resolutionPrice?: number;
}

export interface MLSettings {
    enabled: boolean;
    symbols: string[];
    confidenceThresholdAlta: number;
    confidenceThresholdModerada: number;
    minRewardRiskAlta: number;
    minRewardRiskModerada: number;
    autoTradeEnabled: boolean;
    autoTradeMaxRisk: number;
    autoTradeDefaultLot: number;
    telegramAlerts: boolean;
}

const DEFAULT_SYMBOLS = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD', 'XAGUSD', 'WTI', 'SP500'];
const HISTORY_PATH = path.resolve(process.cwd(), 'ml_prediction_history.json');
const SETTINGS_PATH = path.resolve(process.cwd(), 'ml_settings.json');

export class MLInsightsService {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static cache: Record<string, { data: any; time: number }> = {};
    private static CACHE_TTL = 30000;
    private static lastTelegramAlert: Record<string, number> = {};
    private static settings: MLSettings = MLInsightsService.loadSettings();

    static loadSettings(): MLSettings {
        const defaults: MLSettings = {
            enabled: true, symbols: [...DEFAULT_SYMBOLS],
            confidenceThresholdAlta: 70, confidenceThresholdModerada: 50,
            minRewardRiskAlta: 2.0, minRewardRiskModerada: 1.5,
            autoTradeEnabled: false, autoTradeMaxRisk: 1.0, autoTradeDefaultLot: 0.01,
            telegramAlerts: true,
        };
        if (fs.existsSync(SETTINGS_PATH)) {
            try { return { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) }; }
            catch (e) { console.error('ML: Failed to load settings'); }
        }
        return defaults;
    }

    static saveSettings(s: Partial<MLSettings>) {
        this.settings = { ...this.settings, ...s };
        try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2)); }
        catch (e) { console.error('ML: Failed to save settings'); }
    }

    static getSettings(): MLSettings { return this.settings; }

    static async getFullReport(): Promise<any> {
        const settings = this.settings;
        if (!settings.enabled) {
            return { symbols: [], robotName: 'ML Insights Engine', predictions: [], regime: null, risk: null, news: [], correlation: null, timestamp: new Date().toISOString() };
        }

        const activeSymbols = settings.symbols.filter(s => s);

        const results = await Promise.allSettled(
            activeSymbols.map(async (symbol) => {
                const [m15, h1, d1] = await Promise.all([
                    this.fetchCandles(symbol, 'M15', 200),
                    this.fetchCandles(symbol, 'H1', 100).catch(() => [] as Candle[]),
                    this.fetchCandles(symbol, 'D1', 60).catch(() => [] as Candle[]),
                ]);
                if (!m15 || m15.length < 10) {
                    return { symbol, direction: 'NEUTRAL' as const, confidence: 0, entryPrice: 0,
                        targetPrice: 0, stopPrice: 0, rewardRisk: 0, signalStrength: 'FRACA' as const,
                        error: 'Dados insuficientes (mercado pode estar fechado)',
                        horizon: 'M15', timeframes: [], supportResistance: { support: 0, resistance: 0 },
                        institutional: null, factors: [] as { name: string; impact: number }[] };
                }
                const prediction = await this.predictPrice(symbol, m15, h1, d1, settings);
                const institutional = await InstitutionalEngine.detectSharkActivity(symbol).catch(() => null);
                return { ...prediction, institutional };
            })
        );

        const predictions: SymbolPrediction[] = results.map(r => r.status === 'fulfilled' ? r.value : {
            symbol: 'ERROR', direction: 'NEUTRAL' as const, confidence: 0, entryPrice: 0,
            targetPrice: 0, stopPrice: 0, rewardRisk: 0, signalStrength: 'FRACA' as const,
            error: 'Falha na análise', horizon: 'M15', timeframes: [], supportResistance: { support: 0, resistance: 0 },
            institutional: null, factors: [],
        });

        let overallRegime: MarketRegime | null = null;
        for (const p of predictions) {
            if (p.error) continue;
            try {
                const candles = await this.fetchCandles(p.symbol, 'M15', 200);
                if (candles.length > 20) { overallRegime = this.detectRegime(candles); break; }
            } catch (e) { }
        }

        if (settings.telegramAlerts) {
            const altaSignals = predictions.filter(p => p.signalStrength === 'ALTA');
            for (const sig of altaSignals) await this.notifyTelegram(sig);
            await this.savePredictions(altaSignals);
        }

        const [trades, dxyCandles] = await Promise.all([
            this.getTradeHistory(),
            this.fetchCandles('DXY', 'M15', 100).catch(() => null),
        ]);

        const risk = this.calculateRiskMetrics(trades);
        const news = await this.getNewsSentiment();

        return {
            symbols: activeSymbols,
            robotName: 'ML Insights Engine',
            predictions,
            regime: overallRegime,
            risk,
            news,
            timestamp: new Date().toISOString(),
        };
    }

    static async getPerformance(): Promise<{ perSymbol: Record<string, { total: number; wins: number; losses: number; hitRate: number }>; overall: { total: number; wins: number; losses: number; hitRate: number } }> {
        await this.resolvePredictions();
        const records = this.loadHistory();
        const perSymbol: Record<string, { total: number; wins: number; losses: number; hitRate: number }> = {};
        let overall = { total: 0, wins: 0, losses: 0, hitRate: 0 };

        for (const rec of records) {
            if (rec.resolved !== 'WIN' && rec.resolved !== 'LOSS') continue;
            if (!perSymbol[rec.symbol]) perSymbol[rec.symbol] = { total: 0, wins: 0, losses: 0, hitRate: 0 };
            perSymbol[rec.symbol].total++;
            overall.total++;
            if (rec.resolved === 'WIN') { perSymbol[rec.symbol].wins++; overall.wins++; }
            else { perSymbol[rec.symbol].losses++; overall.losses++; }
        }

        for (const key of Object.keys(perSymbol)) {
            const s = perSymbol[key];
            s.hitRate = s.total > 0 ? Number((s.wins / s.total * 100).toFixed(1)) : 0;
        }
        overall.hitRate = overall.total > 0 ? Number((overall.wins / overall.total * 100).toFixed(1)) : 0;

        return { perSymbol, overall };
    }

    private static async notifyTelegram(sig: SymbolPrediction): Promise<void> {
        const key = `${sig.symbol}_${sig.direction}`;
        const lastSent = this.lastTelegramAlert[key] || 0;
        if (Date.now() - lastSent < 3600000) return;

        const emoji = sig.direction === 'UP' ? '🟢' : '🔴';
        const text = `<b>${emoji} ML INSIGHTS — SINAL DE ${sig.signalStrength}</b>\n\n<b>Ativo:</b> ${sig.symbol}\n<b>Direção:</b> ${sig.direction === 'UP' ? 'COMPRA' : 'VENDA'}\n<b>Confiança:</b> ${sig.confidence}%\n<b>Entry:</b> ${sig.entryPrice}\n<b>TP:</b> ${sig.targetPrice}\n<b>SL:</b> ${sig.stopPrice}\n<b>R:R:</b> ${sig.rewardRisk.toFixed(1)}:1\n\n<i>Análise multi-timeframe + Smart Money</i>`;

        const ok = await TelegramService.sendMessage(text);
        if (ok) { this.lastTelegramAlert[key] = Date.now(); }
    }

    static async predictPrice(symbol: string, m15: Candle[], h1: Candle[], d1: Candle[], settings?: MLSettings): Promise<SymbolPrediction> {
        const s = settings || this.settings;
        if (!m15 || m15.length < 10) {
            return { symbol, direction: 'NEUTRAL', confidence: 0, entryPrice: 0,
                targetPrice: 0, stopPrice: 0, rewardRisk: 0, signalStrength: 'FRACA',
                error: 'Dados insuficientes', horizon: 'M15', timeframes: [],
                supportResistance: { support: 0, resistance: 0 }, institutional: null, factors: [] };
        }

        const closes = m15.map(c => c.close);
        const volumes = m15.map(c => c.volume || 0);
        const len = closes.length;
        const lastPrice = closes[len - 1];

        const getRSI = (candles: Candle[], period: number = 14): number => {
            const c = candles.map(x => x.close);
            if (c.length < period + 1) return 50;
            let gains = 0, losses = 0;
            for (let i = c.length - period; i < c.length; i++) {
                const diff = c[i] - c[i - 1];
                if (diff >= 0) gains += diff; else losses += Math.abs(diff);
            }
            return 100 - (100 / (1 + (gains / period) / ((losses / period) || 0.001)));
        };

        const getEMA = (candles: Candle[], period: number): number => {
            const c = candles.map(x => x.close);
            if (c.length < period) return c[c.length - 1];
            const k = 2 / (period + 1);
            let ema = c.slice(0, period).reduce((a, b) => a + b, 0) / period;
            for (let i = period; i < c.length; i++) ema = c[i] * k + ema * (1 - k);
            return ema;
        };

        const getTrend = (candles: Candle[]): { trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number } => {
            if (!candles || candles.length < 10) return { trend: 'NEUTRAL', strength: 0 };
            const c = candles.map(x => x.close);
            const p = Math.min(20, c.length);
            const recent = c.slice(-p);
            const xM = (p - 1) / 2, yM = recent.reduce((a, b) => a + b, 0) / p;
            let num = 0, den = 0;
            for (let i = 0; i < p; i++) { num += (i - xM) * (recent[i] - yM); den += (i - xM) ** 2; }
            const slope = den > 0 ? num / den : 0;
            const strength = Math.min(100, Math.abs(slope) / (c[c.length - 1] * 0.0001) * 5);
            if (slope > 0.005) return { trend: 'BULLISH', strength };
            if (slope < -0.005) return { trend: 'BEARISH', strength };
            return { trend: 'NEUTRAL', strength };
        };

        const findSwingLevels = (candles: Candle[]): { support: number; resistance: number } => {
            if (!candles || candles.length < 10) return { support: 0, resistance: 0 };
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const lookback = Math.min(10, Math.floor(candles.length / 2));
            const pivotsHigh: number[] = [], pivotsLow: number[] = [];
            for (let i = lookback; i < candles.length - lookback; i++) {
                const h = highs.slice(i - lookback, i + lookback + 1);
                const l = lows.slice(i - lookback, i + lookback + 1);
                if (highs[i] === Math.max(...h)) pivotsHigh.push(highs[i]);
                if (lows[i] === Math.min(...l)) pivotsLow.push(lows[i]);
            }
            return {
                support: pivotsLow.length > 0 ? pivotsLow.sort((a, b) => a - b).slice(0, 3).reduce((s, v) => s + v, 0) / pivotsLow.length : 0,
                resistance: pivotsHigh.length > 0 ? pivotsHigh.sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0) / pivotsHigh.length : 0,
            };
        };

        const m15Trend = getTrend(m15);
        const h1Trend = h1.length > 10 ? getTrend(h1) : { trend: 'NEUTRAL' as const, strength: 0 };
        const d1Trend = d1.length > 10 ? getTrend(d1) : { trend: 'NEUTRAL' as const, strength: 0 };

        const rsiM15 = getRSI(m15);
        const rsiH1 = h1.length > 15 ? getRSI(h1) : 50;
        const rsiD1 = d1.length > 15 ? getRSI(d1) : 50;

        const ema20M15 = getEMA(m15, 20);
        const ema50M15 = getEMA(m15, 50);
        const ema20H1 = h1.length > 20 ? getEMA(h1, 20) : 0;

        const recentVol = volumes.slice(-10);
        const olderVol = volumes.slice(-20, -10);
        const avgRecentVol = recentVol.reduce((a, b) => a + b, 0) / Math.max(recentVol.length, 1);
        const avgOlderVol = olderVol.reduce((a, b) => a + b, 0) / Math.max(olderVol.length, 1);
        const volRatio = avgOlderVol > 0 ? avgRecentVol / avgOlderVol : 1;

        const trs: number[] = [];
        for (let i = 1; i < Math.min(14, len); i++) {
            trs.push(Math.max(
                m15[len - i].high - m15[len - i].low,
                Math.abs(m15[len - i].high - m15[len - i - 1].close),
                Math.abs(m15[len - i].low - m15[len - i - 1].close)
            ));
        }
        const atr = trs.length > 0 ? trs.reduce((a, b) => a + b, 0) / trs.length : 0.5;

        let totalBull = 0, totalBear = 0;
        const factors: { name: string; impact: number }[] = [];

        if (m15Trend.trend === 'BULLISH') { totalBull += 20; factors.push({ name: 'Tendência M15: Alta', impact: 20 }); }
        else if (m15Trend.trend === 'BEARISH') { totalBear += 20; factors.push({ name: 'Tendência M15: Baixa', impact: -20 }); }
        else factors.push({ name: 'Tendência M15: Neutra', impact: 3 });

        if (h1Trend.trend === 'BULLISH') { totalBull += 15; factors.push({ name: 'Tendência H1: Alta', impact: 15 }); }
        else if (h1Trend.trend === 'BEARISH') { totalBear += 15; factors.push({ name: 'Tendência H1: Baixa', impact: -15 }); }
        else factors.push({ name: 'Tendência H1: Neutra', impact: 2 });

        if (d1Trend.trend === 'BULLISH') { totalBull += 15; factors.push({ name: 'Tendência D1: Alta', impact: 15 }); }
        else if (d1Trend.trend === 'BEARISH') { totalBear += 15; factors.push({ name: 'Tendência D1: Baixa', impact: -15 }); }
        else factors.push({ name: 'Tendência D1: Neutra', impact: 2 });

        if (rsiM15 > 70) { totalBear += 12; factors.push({ name: `RSI M15: Sobrecomprado (${rsiM15.toFixed(0)})`, impact: -12 }); }
        else if (rsiM15 < 30) { totalBull += 12; factors.push({ name: `RSI M15: Sobrevendido (${rsiM15.toFixed(0)})`, impact: 12 }); }
        else factors.push({ name: `RSI M15: Neutro (${rsiM15.toFixed(0)})`, impact: 5 });

        if (volRatio > 1.5) { totalBull += 10; factors.push({ name: `Volume: Alto (${volRatio.toFixed(1)}x)`, impact: 10 }); }
        else if (volRatio < 0.5) { totalBear += 8; factors.push({ name: `Volume: Baixo (${volRatio.toFixed(1)}x)`, impact: -8 }); }
        else factors.push({ name: `Volume: Normal (${volRatio.toFixed(1)}x)`, impact: 4 });

        if (lastPrice > ema50M15) { totalBull += 10; factors.push({ name: 'Preço > EMA50 M15', impact: 10 }); }
        else { totalBear += 10; factors.push({ name: 'Preço < EMA50 M15', impact: -10 }); }
        if (lastPrice > ema20M15) { totalBull += 8; factors.push({ name: 'Preço > EMA20 M15', impact: 8 }); }
        else { totalBear += 8; factors.push({ name: 'Preço < EMA20 M15', impact: -8 }); }

        const netScore = totalBull - totalBear;
        const confidence = Math.min(95, Math.max(0, 50 + netScore));
        let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
        if (netScore > 15) direction = 'UP';
        else if (netScore < -15) direction = 'DOWN';

        const levels = findSwingLevels(m15);
        const targetMultiplier = 2.0;
        const stopMultiplier = 1.0;
        const targetPrice = direction === 'UP' ? lastPrice + atr * targetMultiplier
            : direction === 'DOWN' ? lastPrice - atr * targetMultiplier : lastPrice;
        const stopPrice = direction === 'UP' ? lastPrice - atr * stopMultiplier
            : direction === 'DOWN' ? lastPrice + atr * stopMultiplier : lastPrice;
        const rewardRisk = direction !== 'NEUTRAL' ? Number((Math.abs(targetPrice - lastPrice) / Math.max(Math.abs(stopPrice - lastPrice), 0.1)).toFixed(2)) : 0;

        let signalStrength: 'ALTA' | 'MODERADA' | 'FRACA' = 'FRACA';
        if (direction !== 'NEUTRAL' && confidence >= s.confidenceThresholdAlta && rewardRisk >= s.minRewardRiskAlta) signalStrength = 'ALTA';
        else if (direction !== 'NEUTRAL' && confidence >= s.confidenceThresholdModerada && rewardRisk >= s.minRewardRiskModerada) signalStrength = 'MODERADA';

        const timeframes: TimeframeSignal[] = [
            { timeframe: 'M15', trend: m15Trend.trend, strength: m15Trend.strength, ema: Number(ema20M15.toFixed(2)), rsi: Number(rsiM15.toFixed(0)) },
            { timeframe: 'H1', trend: h1Trend.trend, strength: h1Trend.strength, ema: Number(ema20H1.toFixed(2)), rsi: Number(rsiH1.toFixed(0)) },
            { timeframe: 'D1', trend: d1Trend.trend, strength: d1Trend.strength, ema: d1.length > 0 ? Number(getEMA(d1, 20).toFixed(2)) : 0, rsi: Number(rsiD1.toFixed(0)) },
        ];

        return {
            symbol, direction, confidence: Number(confidence.toFixed(0)),
            entryPrice: Number(lastPrice.toFixed(2)), targetPrice: Number(targetPrice.toFixed(2)),
            stopPrice: Number(stopPrice.toFixed(2)), rewardRisk, signalStrength,
            horizon: 'M15 (multi-timeframe)', timeframes, supportResistance: levels,
            institutional: null, factors,
        };
    }

    static async getHistory(): Promise<{ records: PredictionRecord[]; stats: { total: number; wins: number; losses: number; pending: number; hitRate: number } }> {
        await this.resolvePredictions();
        const records = this.loadHistory();
        const resolved = records.filter(r => r.resolved === 'WIN' || r.resolved === 'LOSS');
        const wins = resolved.filter(r => r.resolved === 'WIN').length;
        const losses = resolved.filter(r => r.resolved === 'LOSS').length;
        const pending = records.filter(r => r.resolved === 'PENDING' || !r.resolved).length;
        return {
            records: records.slice(-100).reverse(),
            stats: { total: records.length, wins, losses, pending, hitRate: resolved.length > 0 ? Number((wins / resolved.length * 100).toFixed(1)) : 0 },
        };
    }

    private static loadHistory(): PredictionRecord[] {
        try { if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')); } catch (e) { }
        return [];
    }

    private static saveHistory(records: PredictionRecord[]) {
        try { fs.writeFileSync(HISTORY_PATH, JSON.stringify(records, null, 2)); } catch (e) { }
    }

    private static async savePredictions(altaSignals: SymbolPrediction[]) {
        const records = this.loadHistory();
        for (const sig of altaSignals) {
            records.push({
                id: `${sig.symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                symbol: sig.symbol, direction: sig.direction as 'UP' | 'DOWN',
                entryPrice: sig.entryPrice, targetPrice: sig.targetPrice, stopPrice: sig.stopPrice,
                signalStrength: sig.signalStrength, confidence: sig.confidence, rewardRisk: sig.rewardRisk,
                timestamp: new Date().toISOString(), resolved: 'PENDING',
            });
        }
        if (records.length > 500) records.splice(0, records.length - 500);
        this.saveHistory(records);
    }

    private static async resolvePredictions() {
        const records = this.loadHistory();
        let changed = false;
        for (const rec of records) {
            if (rec.resolved !== 'PENDING') continue;
            try {
                const candles = await this.fetchCandles(rec.symbol, 'M15', 10);
                if (!candles || candles.length < 2) continue;
                const maxHigh = Math.max(...candles.map(c => c.high));
                const minLow = Math.min(...candles.map(c => c.low));

                if (rec.direction === 'UP') {
                    if (maxHigh >= rec.targetPrice) { rec.resolved = 'WIN'; rec.resolvedAt = new Date().toISOString(); rec.resolutionPrice = rec.targetPrice; changed = true; }
                    else if (minLow <= rec.stopPrice) { rec.resolved = 'LOSS'; rec.resolvedAt = new Date().toISOString(); rec.resolutionPrice = rec.stopPrice; changed = true; }
                } else {
                    if (minLow <= rec.targetPrice) { rec.resolved = 'WIN'; rec.resolvedAt = new Date().toISOString(); rec.resolutionPrice = rec.targetPrice; changed = true; }
                    else if (maxHigh >= rec.stopPrice) { rec.resolved = 'LOSS'; rec.resolvedAt = new Date().toISOString(); rec.resolutionPrice = rec.stopPrice; changed = true; }
                }
            } catch (e) { }
        }
        if (changed) this.saveHistory(records);
    }

    static detectRegime(candles: Candle[]): MarketRegime {
        if (!candles || candles.length < 20) return { regime: 'SILENT', volatility: 0, strength: 0, probability: 0, description: 'Dados insuficientes' };
        const closes = candles.map(c => c.close);
        const returns: number[] = [];
        for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i - 1]) / closes[i - 1] * 100);
        const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / returns.length;
        const volatility = Math.sqrt(variance);
        const annualizedVol = volatility * Math.sqrt(96);
        const period = Math.min(20, returns.length);
        const recentReturns = returns.slice(-period);
        const xMeanR = (period - 1) / 2, yMeanR = recentReturns.reduce((a, b) => a + b, 0) / period;
        let numR = 0, denR = 0;
        for (let i = 0; i < period; i++) { numR += (i - xMeanR) * (recentReturns[i] - yMeanR); denR += (i - xMeanR) ** 2; }
        const trendSlope = denR > 0 ? numR / denR : 0;
        const strength = Math.min(100, Math.abs(trendSlope) * 500);
        const regime = volatility > 0.15 ? (trendSlope > 0.01 ? 'TRENDING_BULL' : trendSlope < -0.01 ? 'TRENDING_BEAR' : 'VOLATILE') :
            strength > 30 ? (trendSlope > 0 ? 'TRENDING_BULL' : 'TRENDING_BEAR') :
            volatility < 0.03 ? 'SILENT' : 'RANGING';
        const descriptions: Record<string, string> = {
            TRENDING_BULL: 'Tendência de alta com força — favorece operações compradas',
            TRENDING_BEAR: 'Tendência de baixa com força — favorece operações vendidas',
            RANGING: 'Mercado lateral sem direção definida — evitar escalpelamento',
            VOLATILE: 'Volatilidade elevada — risco alto, usar SL largo',
            SILENT: 'Mercado silencioso — baixa liquidez, evitar entrar',
        };
        return { regime: regime as any, volatility: Number(annualizedVol.toFixed(4)), strength: Number(strength.toFixed(1)), probability: Number(Math.min(95, 50 + strength / 2 + (volatility > 0.1 ? 10 : 0)).toFixed(0)), description: descriptions[regime] || '' };
    }

    static calculateRiskMetrics(trades: any[]): RiskMetrics {
        const def: RiskMetrics = { sharpe: 0, sortino: 0, calmar: 0, var95: 0, cvar95: 0, maxDrawdown: 0, expectancy: 0, profitFactor: 0 };
        if (!trades || trades.length < 5) return def;
        const profits = trades.map(t => t.profit || 0).filter(p => p !== 0);
        if (profits.length < 3) return def;
        const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
        const variance = profits.reduce((s, p) => s + (p - mean) ** 2, 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const downsideReturns = profits.filter(p => p < 0);
        const downsideVar = downsideReturns.length > 0 ? downsideReturns.reduce((s, p) => s + (p - mean) ** 2, 0) / downsideReturns.length : 0.001;
        const downsideDev = Math.sqrt(downsideVar);
        const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
        const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;
        const sorted = [...profits].sort((a, b) => a - b);
        const varIdx = Math.max(0, Math.floor(sorted.length * 0.05));
        const var95 = sorted[varIdx] || 0;
        const cvar95 = sorted.slice(0, varIdx + 1).reduce((a, b) => a + b, 0) / (varIdx + 1);
        let peak = 0, maxDD = 0, running = 0;
        for (const p of profits) { running += p; if (running > peak) peak = running; const dd = (peak - running) / (Math.abs(peak) || 1); if (dd > maxDD) maxDD = dd; }
        const wins = profits.filter(p => p > 0);
        const losses = profits.filter(p => p < 0);
        const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1;
        const winRate = profits.length > 0 ? wins.length / profits.length : 0;
        const expectancy = avgLoss > 0 ? (winRate * avgWin - (1 - winRate) * avgLoss) : 0;
        const grossProfit = wins.reduce((a, b) => a + b, 0);
        const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0)) || 1;
        const profitFactor = grossProfit / grossLoss;
        const calmar = maxDD > 0 ? (mean * 252) / (maxDD * 100) : 0;
        return { sharpe: Number(sharpe.toFixed(2)), sortino: Number(sortino.toFixed(2)), calmar: Number(calmar.toFixed(2)), var95: Number(var95.toFixed(2)), cvar95: Number(cvar95.toFixed(2)), maxDrawdown: Number((maxDD * 100).toFixed(1)), expectancy: Number(expectancy.toFixed(4)), profitFactor: Number(profitFactor.toFixed(2)) };
    }

    static monteCarloSimulation(trades: any[], iterations: number = 1000): any {
        if (!trades || trades.length < 3) return { iterations: 0, expectedProfit: 0, confidence95: [0, 0], ruinProbability: 0 };
        const profits = trades.map(t => t.profit || 0).filter(p => p !== 0);
        if (profits.length < 3) return { iterations: 0, expectedProfit: 0, confidence95: [0, 0], ruinProbability: 0 };
        const initialCapital = 1000;
        const results: number[] = [];
        for (let i = 0; i < iterations; i++) {
            let capital = initialCapital;
            for (let j = 0; j < Math.min(profits.length, 100); j++) { capital += profits[Math.floor(Math.random() * profits.length)]; if (capital <= 0) break; }
            results.push(capital);
        }
        results.sort((a, b) => a - b);
        const meanCapital = results.reduce((a, b) => a + b, 0) / results.length;
        const li = Math.floor(results.length * 0.025), ui = Math.floor(results.length * 0.975);
        return { iterations, expectedProfit: Number((meanCapital - initialCapital).toFixed(2)), confidence95: [Number(results[li].toFixed(2)), Number(results[ui].toFixed(2))], ruinProbability: Number((results.filter(r => r <= 0).length / results.length * 100).toFixed(1)), medianCapital: Number(results[Math.floor(results.length / 2)].toFixed(2)) };
    }

    static async getNewsSentiment(): Promise<NewsSentiment[]> {
        try {
            const cacheKey = 'news';
            if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].time < 120000) return this.cache[cacheKey].data;
            const news: NewsSentiment[] = [];
            const now = new Date();
            for (const symbol of this.settings.symbols.slice(0, 2)) {
                const candles = await this.fetchCandles(symbol, 'H1', 24).catch(() => [] as Candle[]);
                if (candles.length > 5) {
                    const closes = candles.map(c => c.close);
                    const hourChange = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
                    const dayChange = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
                    if (Math.abs(hourChange) > 0.3) news.push({ title: `${symbol} ${hourChange > 0 ? 'em alta' : 'em baixa'} horária de ${Math.abs(hourChange).toFixed(2)}%`, source: 'ML Analysis', time: now.toISOString(), sentiment: hourChange > 0 ? 0.7 : -0.6, label: hourChange > 0 ? 'POSITIVE' : 'NEGATIVE' as any, keywords: hourChange > 0 ? ['alta', 'compra'] : ['baixa', 'venda'], relevance: 85 });
                    if (Math.abs(dayChange) > 0.5) news.push({ title: `${symbol} sessão ${dayChange > 0 ? '+' : ''}${dayChange.toFixed(2)}%`, source: 'Market Context', time: now.toISOString(), sentiment: dayChange > 0 ? 0.6 : -0.5, label: dayChange > 0 ? 'POSITIVE' : 'NEGATIVE' as any, keywords: ['sessão', dayChange > 0 ? 'alta' : 'baixa'], relevance: 75 });
                }
            }
            this.cache[cacheKey] = { data: news, time: Date.now() };
            return news;
        } catch (e) { return []; }
    }

    static async fetchCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol, timeframe, count }, timeout: 5000 });
            return r.data || [];
        } catch (e: any) {
            const msg = e?.response?.data || e?.message || '';
            if (msg.includes('10018') || msg.includes('closed') || msg.includes('offline')) {
                return [];
            }
            return [];
        }
    }

    static async getTradeHistory(): Promise<any[]> {
        try {
            const r = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report', { timeout: 3000 });
            return r.data?.trades || [];
        } catch { return []; }
    }
}
