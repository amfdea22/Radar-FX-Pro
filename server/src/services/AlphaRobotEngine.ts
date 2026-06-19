import axios from 'axios';
import { SignalEngine, TradingSignal } from './SignalEngine';
import { AlertEngine } from './AlertEngine';
import { DisciplineEngine } from './DisciplineEngine';
import fs from 'fs';
import path from 'path';
import { MarketService } from './MarketService';
import { CryptoRiskEngine } from './CryptoRiskEngine';
import { BridgeClient } from './BridgeClient';
import { MarketDataService } from './MarketDataService';
import { SymbolLockService } from './SymbolLockService';
import { PolygonBar } from './PolygonService';

// ──────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────

export interface TradeRecord {
    id: string;
    ticket: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    lot: number;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    result: 'WIN' | 'LOSS';
    setup: string;
    closeReason: 'TP' | 'SL' | 'BE' | 'TRAILING' | 'MANUAL';
    openTime: string;
    closeTime: string;
    duration: string;
    magic?: number;
    comment?: string;
}

export interface RobotSettings {
    enabled: boolean;
    minConfidence: number;
    maxTradesPerDay: number;
    defaultLot: number;
    onlyInstitutional: boolean;
    autoBreakEven: boolean;
    autoTrailing: boolean;
    tradesPer15Min: number;
    tradeLimitInterval: '1m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1mo';
    preferredTimeframe: string;

    // Institutional analysis settings
    useInstitutionalAnalysis: boolean;
    useMLSignals: boolean;
    maxRiskPerTrade: number;
    trailingActivation: number;
    breakevenActivation: number;
    atrMultiplierSL: number;
    atrMultiplierTP: number;
    entryScoreThreshold: number;
    symbols: string[];
}

// Institutional analysis result
interface InstitutionalAnalysis {
    symbol: string;
    direction: 'BUY' | 'SELL' | 'NEUTRAL';
    score: number;
    wyckoffPhase: string;
    vwapDistance: number;
    trendAlignment: string;
    nearestOB: { price: number; type: string; distance: number } | null;
    rsi: number;
    volumeRatio: number;
    entryPrice: number;
    sl: number;
    tp: number;
    confidence: number;
    details: string;
}

// Market structure swing point
interface SwingPoint {
    index: number;
    price: number;
    type: 'HIGH' | 'LOW';
}

// Wyckoff phases
type WyckoffPhase = 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' | 'NEUTRAL';

// Order Block
interface OrderBlock {
    price: number;
    type: 'SUPPLY' | 'DEMAND';
    strength: number;
    zone: [number, number];
}

// ──────────────────────────────────────────────
// AlphaRobotEngine class
// ──────────────────────────────────────────────

export class AlphaRobotEngine {
    private static isRunning = false;
    private static processedSignals = new Set<string>();
    private static settings: RobotSettings = {
        enabled: false,
        minConfidence: 85,
        maxTradesPerDay: 10,
        defaultLot: 0.01,
        onlyInstitutional: true,
        autoBreakEven: true,
        autoTrailing: true,
        tradesPer15Min: 3,
        tradeLimitInterval: '15m',
        preferredTimeframe: 'ALL',

        // Institutional
        useInstitutionalAnalysis: true,
        useMLSignals: false,
        maxRiskPerTrade: 1.0,
        trailingActivation: 0.5,
        breakevenActivation: 0.3,
        atrMultiplierSL: 1.5,
        atrMultiplierTP: 3.5,
        entryScoreThreshold: 70,
        symbols: ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD']
    };

    private static tradesThisWindow = 0;
    private static lastWindowId = '';
    private static dailyTradeCount = 0;
    private static lastTradeDate = '';
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'alpha_robot_settings.json');

    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static ROBOT_MAGIC = 88881;
    private static HISTORY_PATH = path.resolve(process.cwd(), 'alpha_robot_history.json');

    // Trade history
    private static tradeHistory: TradeRecord[] = [];
    private static totalWins = 0;
    private static totalLosses = 0;
    private static totalProfitAllTime = 0;

    // Open position tracking for management
    private static openPositions: Map<number, {
        ticket: number;
        symbol: string;
        type: 'BUY' | 'SELL';
        entryPrice: number;
        lot: number;
        sl: number;
        tp: number;
        trailingActivated: boolean;
        breakevenActivated: boolean;
    }> = new Map();

    // Last analysis cache for UI
    private static lastAnalysis: Record<string, InstitutionalAnalysis> = {};

    // ML Insights integration
    private static mlSignalsUsed = 0;
    private static lastMlResetDate = '';
    private static lastBarsCache: Record<string, PolygonBar[]> = {};

    // ──────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────

    static start() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadTradeHistory();
        this.isRunning = true;
        console.log('🤖 Alpha Robot v2: Institutional Engine ACTIVE');

        const runLoop = (fn: () => Promise<any>, interval: number) => {
            const run = () => {
                fn().finally(() => setTimeout(run, interval));
            };
            run();
        };

        runLoop(() => this.processCycle(), 5000);
        runLoop(() => this.syncTradesFromMT5(), 60000);
        runLoop(() => this.manageOpenPositions(), 10000);
        runLoop(() => this.runInstitutionalAnalysis(), 30000);
    }

    private static getTodayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    // ──────────────────────────────────────────────
    // Settings persistence
    // ──────────────────────────────────────────────

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const data = fs.readFileSync(this.SETTINGS_PATH, 'utf-8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
                console.log('🤖 Alpha Robot: Settings loaded');
            } catch (e) {
                console.error('❌ Alpha Robot: Failed to load settings', e);
            }
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) { /* ignore */ }
    }

    static ALLOWED_SYMBOLS = new Set([
        'EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','NZDUSD','USDCHF','EURGBP','EURJPY','GBPJPY',
        'XAUUSD','XAGUSD',
        'BTCUSD','ETHUSD','SOLUSD',
        'NAS100','US30','US500','GER40','UK100','FRA40','JPN225','HK50'
    ]);

    static updateSettings(newSettings: Partial<RobotSettings>) {
        if (newSettings.symbols) {
            const valid = newSettings.symbols.filter(s => this.ALLOWED_SYMBOLS.has(s.toUpperCase()));
            if (valid.length === 0) {
                console.warn('⚠️ Alpha Robot: Nenhum símbolo válido, mantendo atual');
                delete newSettings.symbols;
            } else {
                newSettings.symbols = valid;
            }
        }
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        console.log('🤖 Alpha Robot: Settings updated', this.settings);
    }

    static onEmergencyReset() {
        this.tradesThisWindow = 0;
        this.processedSignals.clear();
        console.log('🤖 Alpha Robot: Emergency Reset — contadores zerados.');
    }

    // ──────────────────────────────────────────────
    // Core cycle
    // ──────────────────────────────────────────────

    private static async processCycle() {
        if (!this.settings.enabled) return;

        const today = this.getTodayStr();
        if (this.lastTradeDate !== today) {
            this.dailyTradeCount = 0;
            this.lastTradeDate = today;
        }
        if (this.lastMlResetDate !== today) {
            this.mlSignalsUsed = 0;
            this.lastMlResetDate = today;
        }

        try {
            const discipline = await DisciplineEngine.getDailyStatus();
            if (discipline.isLocked) {
                if (this.settings.enabled) {
                    console.log('🤖 Alpha Robot: Safety Lock detected.');
                    this.settings.enabled = false;
                    AlertEngine.addAlert('DISCIPLINE', 'CRITICAL', 'Robô Pausado: Bloqueio de Segurança', 'Limites de disciplina atingidos.');
                }
                return;
            }

            const currentWindowId = this.getWindowId(this.settings.tradeLimitInterval);
            if (this.lastWindowId !== currentWindowId) {
                this.lastWindowId = currentWindowId;
                this.tradesThisWindow = 0;
            }

            if (this.settings.maxTradesPerDay > 0 && this.dailyTradeCount >= this.settings.maxTradesPerDay) {
                return;
            }

            // Get institutional signals from our own analysis
            if (this.settings.useInstitutionalAnalysis) {
                for (const analysis of Object.values(this.lastAnalysis)) {
                    if (analysis.direction === 'NEUTRAL') continue;
                    if (analysis.score < this.settings.entryScoreThreshold) continue;

                    const signalId = `inst_${analysis.symbol}_${Date.now()}`;
                    if (this.processedSignals.has(signalId)) continue;

                    const isCrypto = analysis.symbol.includes('BTC') || analysis.symbol.includes('ETH') || analysis.symbol.includes('SOL');
                    if (isCrypto && !CryptoRiskEngine.canOpenCryptoTrade()) continue;

                    if (this.tradesThisWindow >= this.settings.tradesPer15Min) break;
                    if (await this.isCorrelatedToOpenPositions(analysis.symbol)) continue;

                    await this.executeInstitutionalTrade(analysis);
                    this.processedSignals.add(signalId);
                    this.tradesThisWindow++;
                    this.dailyTradeCount++;
                }
            }

            if (this.settings.useMLSignals && !this.settings.onlyInstitutional) {
                try {
                    const { MLInsightsService } = require('./MLInsightsService');
                    const report = await MLInsightsService.getFullReport().catch(() => null);
                    if (report?.predictions) {
                        for (const mlPred of report.predictions) {
                            if (mlPred.direction === 'NEUTRAL' || mlPred.signalStrength !== 'ALTA') continue;
                            if (!this.settings.symbols.includes(mlPred.symbol)) continue;

                            const signalId = `ml_${mlPred.symbol}_${mlPred.direction}_${Date.now()}`;
                            if (this.processedSignals.has(signalId)) continue;

                            const isCrypto = mlPred.symbol.includes('BTC') || mlPred.symbol.includes('ETH') || mlPred.symbol.includes('SOL');
                            if (isCrypto && !CryptoRiskEngine.canOpenCryptoTrade()) continue;

                            if (this.tradesThisWindow >= this.settings.tradesPer15Min) break;
                            if (await this.isCorrelatedToOpenPositions(mlPred.symbol)) continue;

                            const analysis: InstitutionalAnalysis = {
                                symbol: mlPred.symbol,
                                direction: mlPred.direction === 'UP' ? 'BUY' : 'SELL',
                                score: mlPred.confidence,
                                wyckoffPhase: 'ML_SIGNAL',
                                vwapDistance: 0,
                                trendAlignment: mlPred.timeframes?.[0]?.trend === 'BULLISH' ? 'BULLISH' : mlPred.timeframes?.[0]?.trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
                                nearestOB: null,
                                rsi: mlPred.timeframes?.[0]?.rsi || 50,
                                volumeRatio: 1,
                                entryPrice: mlPred.entryPrice,
                                sl: mlPred.stopPrice,
                                tp: mlPred.targetPrice,
                                confidence: mlPred.confidence,
                                details: `ML Signal: ${mlPred.signalStrength} R:R ${mlPred.rewardRisk}:1`
                            };

                            await this.executeInstitutionalTrade(analysis);
                            this.processedSignals.add(signalId);
                            this.mlSignalsUsed++;
                            this.tradesThisWindow++;
                            this.dailyTradeCount++;
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Alpha Robot: ML Insights check failed', e);
                }
            }

            // Also check SignalEngine signals if enabled
            if (!this.settings.onlyInstitutional) {
                const signals = await SignalEngine.getActiveSignals();
                for (const signal of signals) {
                    if (this.processedSignals.has(signal.id)) continue;

                    const isCrypto = signal.symbol.includes('BTC') || signal.symbol.includes('ETH') || signal.symbol.includes('SOL');
                    if (isCrypto && !CryptoRiskEngine.canOpenCryptoTrade()) continue;
                    if (await this.isCorrelatedToOpenPositions(signal.symbol)) continue;

                    if (this.shouldTrade(signal)) {
                        await this.executeTrade(signal);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Alpha Robot: Cycle Error', error);
        }
    }

    // ──────────────────────────────────────────────
    // Institutional Analysis
    // ──────────────────────────────────────────────

    private static async runInstitutionalAnalysis() {
        if (!this.settings.enabled || !this.settings.useInstitutionalAnalysis) return;

        // Clean stale entries for removed symbols
        const activeSymbols = new Set(this.settings.symbols);
        for (const sym of Object.keys(this.lastAnalysis)) {
            if (!activeSymbols.has(sym)) delete this.lastAnalysis[sym];
        }
        for (const sym of Object.keys(this.lastBarsCache)) {
            if (!activeSymbols.has(sym)) delete this.lastBarsCache[sym];
        }

        for (const symbol of this.settings.symbols) {
            try {
                const analysis = await this.analyzeSymbol(symbol);
                if (analysis) {
                    this.lastAnalysis[symbol] = analysis;
                }
            } catch (e) {
                console.warn(`⚠️ Alpha Robot: Analysis failed for ${symbol}`);
            }
        }
        console.log(`📊 Alpha Robot: Institutional analysis complete (${Object.keys(this.lastAnalysis).length} symbols)`);
    }

    private static async analyzeSymbol(symbol: string): Promise<InstitutionalAnalysis | null> {
        const [d1Bars, h4Bars, m15Bars, h1Bars, tickData] = await Promise.all([
            this.getBarsSafe(symbol, 60, 'D1'),
            this.getBarsSafe(symbol, 80, 'H4'),
            this.getBarsSafe(symbol, 30, 'M15'),
            this.getBarsSafe(symbol, 48, 'H1'),
            this.getTickPrice(symbol)
        ]);

        if (d1Bars.length < 50) return null;
        if (!tickData) return null;

        const entryPrice = tickData;
        const d1 = [...d1Bars];

        const wyckoffPhase = this.detectWyckoffPhase(d1);

        const d1ATR = this.calculateATR(d1, 14);
        const h4ATR = this.calculateATR(h4Bars.length >= 15 ? [...h4Bars] : d1, 14);
        const adaptiveMultiplier = d1ATR > 0 ? Math.max(0.7, Math.min(1.5, h4ATR / d1ATR)) : 1;
        const wyckoffThreshold = 0.95 + (adaptiveMultiplier - 1) * 0.05;

        const vwapD1 = this.calculateVWAP(d1.slice(-200));
        const vwapDistance = ((entryPrice - vwapD1.vwap) / vwapD1.vwap) * 100;

        const vwapH1 = h1Bars.length >= 20 ? this.calculateVWAP([...h1Bars.slice(-20)]) : vwapD1;
        const vwapH1Dist = ((entryPrice - vwapH1.vwap) / vwapH1.vwap) * 100;

        const swings = this.findSwingPoints(d1, 3);
        const msTrend = this.analyzeMarketStructure(swings, d1);

        const obs = this.detectOrderBlocks(h4Bars);
        const nearestOB = this.findNearestOB(obs, entryPrice);

        const rsi = this.calculateRSI(d1, 14);
        const rsiDivergence = this.detectRSIDivergence(d1, 14);

        const volumeRatio = this.calculateVolumeRatio(d1);
        const volumeThreshold = Math.max(1.05, 1.5 - adaptiveMultiplier * 0.3);

        let score = 0;
        let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

        const isBullishTrend = msTrend === 'BULLISH';
        const isBearishTrend = msTrend === 'BEARISH';

        if (wyckoffPhase === 'ACCUMULATION' || wyckoffPhase === 'MARKUP') {
            score += 30;
            direction = 'BUY';
        } else if (wyckoffPhase === 'DISTRIBUTION' || wyckoffPhase === 'MARKDOWN') {
            score += 30;
            direction = 'SELL';
        }

        if (direction === 'NEUTRAL' && isBullishTrend) {
            direction = 'BUY';
            score += 15;
        } else if (direction === 'NEUTRAL' && isBearishTrend) {
            direction = 'SELL';
            score += 15;
        }

        if (direction === 'BUY' && vwapDistance < 0 && vwapDistance > -3) {
            score += 20;
        } else if (direction === 'SELL' && vwapDistance > 0 && vwapDistance < 3) {
            score += 20;
        } else if (direction !== 'NEUTRAL' && Math.abs(vwapDistance) < 1.5) {
            score += 10;
        } else if (Math.abs(vwapDistance) < 1) {
            score += 5;
        }

        if ((direction === 'BUY' && isBullishTrend) || (direction === 'SELL' && isBearishTrend)) {
            score += 20;
        } else if ((direction === 'BUY' && isBearishTrend) || (direction === 'SELL' && isBullishTrend)) {
            direction = 'NEUTRAL';
            score = 0;
            return null;
        }

        if (nearestOB && direction !== 'NEUTRAL') {
            if (direction === 'BUY' && nearestOB.type === 'DEMAND' && nearestOB.distance < 2) {
                score += 15;
            } else if (direction === 'SELL' && nearestOB.type === 'SUPPLY' && nearestOB.distance < 2) {
                score += 15;
            } else if (nearestOB.distance < 1) {
                score += 8;
            }
        }

        if (direction === 'BUY' && rsi >= 30 && rsi <= 50) {
            score += 10;
        } else if (direction === 'SELL' && rsi >= 50 && rsi <= 70) {
            score += 10;
        } else if (rsi >= 40 && rsi <= 60) {
            score += 5;
        }

        if (rsiDivergence !== 'NONE') {
            if ((direction === 'BUY' && rsiDivergence === 'BULLISH') ||
                (direction === 'SELL' && rsiDivergence === 'BEARISH')) {
                score += 15;
            }
        }

        if (volumeRatio > volumeThreshold) {
            score += 5;
        } else if (volumeRatio > 0.8) {
            score += 2;
        }

        if (direction === 'NEUTRAL') return null;

        const sl = direction === 'BUY'
            ? entryPrice - (d1ATR * this.settings.atrMultiplierSL)
            : entryPrice + (d1ATR * this.settings.atrMultiplierSL);

        const tp = direction === 'BUY'
            ? entryPrice + (d1ATR * this.settings.atrMultiplierTP)
            : entryPrice - (d1ATR * this.settings.atrMultiplierTP);

        const riskAmount = Math.abs(entryPrice - sl);
        const rewardAmount = Math.abs(tp - entryPrice);
        const rr = rewardAmount / riskAmount;

        if (rr < 2) return null;
        if (score < this.settings.entryScoreThreshold) return null;

        const dec = entryPrice < 0.01 ? 8 : entryPrice < 100 ? 5 : 2;

        return {
            symbol,
            direction,
            score,
            wyckoffPhase,
            vwapDistance: Number(vwapDistance.toFixed(2)),
            trendAlignment: msTrend,
            nearestOB: nearestOB ? {
                price: Number(nearestOB.price.toFixed(dec)),
                type: nearestOB.type,
                distance: Number(nearestOB.distance.toFixed(2))
            } : null,
            rsi: Number(rsi.toFixed(1)),
            volumeRatio: Number(volumeRatio.toFixed(2)),
            entryPrice: Number(entryPrice.toFixed(dec)),
            sl: Number(sl.toFixed(dec)),
            tp: Number(tp.toFixed(dec)),
            confidence: Number(Math.min(score + 10, 99).toFixed(1)),
            details: `Wyckoff:${wyckoffPhase} VWAP:${vwapDistance.toFixed(1)}% RSI:${rsi.toFixed(0)} Score:${score}`
        };
    }

    // ── Wyckoff Phase Detection (D1) ──

    private static detectWyckoffPhase(bars: PolygonBar[]): WyckoffPhase {
        if (bars.length < 50) return 'NEUTRAL';

        const recent = bars.slice(-30);
        const mid = bars.slice(-60, -30);
        const old = bars.slice(-90, -60);

        const avgRecent = recent.reduce((s, b) => s + (b.h + b.l) / 2, 0) / recent.length;
        const avgMid = mid.reduce((s, b) => s + (b.h + b.l) / 2, 0) / mid.length;
        const avgOld = old.reduce((s, b) => s + (b.h + b.l) / 2, 0) / old.length;

        // Volume profile
        const volRecent = recent.reduce((s, b) => s + b.v, 0) / recent.length;
        const volMid = mid.reduce((s, b) => s + b.v, 0) / mid.length;
        const volOld = old.reduce((s, b) => s + b.v, 0) / old.length;

        // Range analysis
        const rangeRecent = recent.reduce((s, b) => s + (b.h - b.l), 0) / recent.length;
        const rangeMid = mid.reduce((s, b) => s + (b.h - b.l), 0) / mid.length;

        // ACCUMULATION: price base, volume increasing, range contracting then expanding
        if (avgRecent >= avgOld * 0.95 && avgRecent <= avgOld * 1.05 &&
            volRecent > volOld * 1.2 && rangeRecent < rangeMid * 0.8) {
            return 'ACCUMULATION';
        }

        // MARKUP: price rising, volume high, expanding range
        if (avgRecent > avgMid * 1.08 && avgMid > avgOld * 1.05 &&
            volRecent > volMid * 0.9) {
            return 'MARKUP';
        }

        // DISTRIBUTION: price range tight at top, volume increasing
        if (avgRecent >= avgMid * 0.97 && avgRecent <= avgMid * 1.03 &&
            avgRecent > avgOld * 1.1 && volRecent > volMid * 1.15 &&
            rangeRecent < rangeMid * 0.85) {
            return 'DISTRIBUTION';
        }

        // MARKDOWN: price falling, volume high
        if (avgRecent < avgMid * 0.92 && avgMid < avgOld * 0.95 &&
            volRecent > volMid * 0.9) {
            return 'MARKDOWN';
        }

        return 'NEUTRAL';
    }

    // ── VWAP Calculation ──

    private static calculateVWAP(bars: PolygonBar[]): { vwap: number; upper1: number; lower1: number; upper2: number; lower2: number } {
        if (bars.length === 0) return { vwap: 0, upper1: 0, lower1: 0, upper2: 0, lower2: 0 };

        let cumVP = 0;
        let cumV = 0;
        const typicalPrices: number[] = [];

        for (const bar of bars) {
            const tp = (bar.h + bar.l + bar.c) / 3;
            cumVP += tp * bar.v;
            cumV += bar.v;
            typicalPrices.push(tp);
        }

        const vwap = cumVP / cumV;

        // Standard deviation of typical prices
        const variance = typicalPrices.reduce((s, tp) => s + Math.pow(tp - vwap, 2), 0) / typicalPrices.length;
        const stdDev = Math.sqrt(variance);

        return {
            vwap,
            upper1: vwap + stdDev,
            lower1: vwap - stdDev,
            upper2: vwap + 2 * stdDev,
            lower2: vwap - 2 * stdDev
        };
    }

    // ── Market Structure Analysis ──

    private static findSwingPoints(bars: PolygonBar[], leftRightBars: number = 2): SwingPoint[] {
        const swings: SwingPoint[] = [];

        for (let i = leftRightBars; i < bars.length - leftRightBars; i++) {
            const current = bars[i];

            // Swing High
            let isHigh = true;
            for (let j = i - leftRightBars; j <= i + leftRightBars; j++) {
                if (j === i) continue;
                if (bars[j].h >= current.h) { isHigh = false; break; }
            }
            if (isHigh) swings.push({ index: i, price: current.h, type: 'HIGH' });

            // Swing Low
            let isLow = true;
            for (let j = i - leftRightBars; j <= i + leftRightBars; j++) {
                if (j === i) continue;
                if (bars[j].l <= current.l) { isLow = false; break; }
            }
            if (isLow) swings.push({ index: i, price: current.l, type: 'LOW' });
        }

        return swings;
    }

    private static analyzeMarketStructure(swings: SwingPoint[], bars: PolygonBar[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        if (swings.length < 4) return 'NEUTRAL';

        // Get last 4 swing points
        const recentSwings = swings.slice(-6);
        const highs = recentSwings.filter(s => s.type === 'HIGH').map(s => s.price);
        const lows = recentSwings.filter(s => s.type === 'LOW').map(s => s.price);

        if (highs.length < 2 || lows.length < 2) return 'NEUTRAL';

        // BOS (Break of Structure): higher highs + higher lows = bullish
        const lastHighs = highs.slice(-3);
        const lastLows = lows.slice(-3);

        const higherHighs = lastHighs.length >= 2 && lastHighs[lastHighs.length - 1] > lastHighs[lastHighs.length - 2];
        const lowerLows = lastLows.length >= 2 && lastLows[lastLows.length - 1] < lastLows[lastLows.length - 2];

        if (higherHighs) return 'BULLISH';
        if (lowerLows) return 'BEARISH';

        // Check CHoCH (Change of Character)
        const currentPrice = bars[bars.length - 1].c;
        const lastSwing = swings[swings.length - 1];
        if (lastSwing) {
            if (lastSwing.type === 'LOW' && currentPrice > lastSwing.price * 1.02) return 'BULLISH';
            if (lastSwing.type === 'HIGH' && currentPrice < lastSwing.price * 0.98) return 'BEARISH';
        }

        return 'NEUTRAL';
    }

    // ── Order Block Detection ──

    private static detectOrderBlocks(bars: PolygonBar[]): OrderBlock[] {
        if (bars.length < 10) return [];
        const obs: OrderBlock[] = [];

        for (let i = 1; i < bars.length - 2; i++) {
            const current = bars[i];
            const next = bars[i - 1];

            const displacement = Math.abs(next.c - next.o);
            const avgSize = (bars[i + 1].h - bars[i + 1].l + bars[i + 2].h - bars[i + 2].l) / 2;

            if (displacement > avgSize * 2) {
                const isBullishOB = next.c > next.o && current.c < current.o;
                const isBearishOB = next.c < next.o && current.c > current.o;

                if (isBullishOB) {
                    obs.push({ price: current.l, type: 'DEMAND', strength: Math.min(displacement / avgSize, 1), zone: [current.l, current.h] });
                } else if (isBearishOB) {
                    obs.push({ price: current.h, type: 'SUPPLY', strength: Math.min(displacement / avgSize, 1), zone: [current.l, current.h] });
                }
            }
        }

        return obs.slice(0, 5);
    }

    private static findNearestOB(obs: OrderBlock[], price: number): { price: number; type: string; distance: number } | null {
        if (obs.length === 0) return null;

        let nearest = obs[0];
        let minDist = Math.abs(price - nearest.price);

        for (const ob of obs) {
            const dist = Math.abs(price - ob.price);
            if (dist < minDist) {
                minDist = dist;
                nearest = ob;
            }
        }

        return {
            price: nearest.price,
            type: nearest.type,
            distance: (Math.abs(price - nearest.price) / price) * 100
        };
    }

    // ── RSI ──

    private static detectRSIDivergence(bars: PolygonBar[], period: number = 14): 'BULLISH' | 'BEARISH' | 'NONE' {
        if (bars.length < period + 5) return 'NONE';
        const rsiValues: number[] = [];
        for (let i = 5; i < bars.length; i++) {
            const segment = bars.slice(i - period, i);
            rsiValues.push(this.calculateRSI(segment, period));
        }
        if (rsiValues.length < 5) return 'NONE';
        const recentRSI = rsiValues.slice(-5);
        const recentPrices = bars.slice(-5).map(b => b.c);
        const priceLower = recentPrices[recentPrices.length - 1] < recentPrices[0];
        const rsiHigher = recentRSI[recentRSI.length - 1] > recentRSI[0];
        const priceHigher = recentPrices[recentPrices.length - 1] > recentPrices[0];
        const rsiLower = recentRSI[recentRSI.length - 1] < recentRSI[0];
        if (priceLower && rsiHigher) return 'BULLISH';
        if (priceHigher && rsiLower) return 'BEARISH';
        return 'NONE';
    }

    private static calculateRSI(bars: PolygonBar[], period: number = 14): number {
        if (bars.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = bars.length - period; i < bars.length; i++) {
            const change = bars[i].c - bars[i - 1].c;
            if (change >= 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        if (avgGain === 0) return 0;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // ── ATR ──

    private static calculateATR(bars: PolygonBar[], period: number = 14): number {
        if (bars.length < period + 1) return 0;

        let totalTR = 0;
        for (let i = bars.length - period; i < bars.length; i++) {
            const bar = bars[i];
            const prevClose = bars[i - 1].c;
            const tr = Math.max(
                bar.h - bar.l,
                Math.abs(bar.h - prevClose),
                Math.abs(bar.l - prevClose)
            );
            totalTR += tr;
        }

        return totalTR / period;
    }

    // ── Volume Ratio ──

    private static calculateVolumeRatio(bars: PolygonBar[]): number {
        if (bars.length < 31) return 1;

        const recentVol = bars.slice(-5).reduce((s, b) => s + b.v, 0) / 5;
        const histVol = bars.slice(-35, -5).reduce((s, b) => s + b.v, 0) / 30;

        return histVol > 0 ? recentVol / histVol : 1;
    }

    // ── Correlation Filter ──

    private static readonly CORRELATION_THRESHOLD = 0.85;
    private static readonly CORRELATION_SYMBOLS: Record<string, string[]> = {
        'EURUSD': ['GBPUSD', 'USDCHF', 'EURGBP', 'EURJPY'],
        'GBPUSD': ['EURUSD', 'USDCHF', 'GBPJPY'],
        'USDJPY': ['EURJPY', 'GBPJPY'],
        'AUDUSD': ['NZDUSD'],
        'USDCAD': [],
        'NZDUSD': ['AUDUSD'],
        'USDCHF': ['EURUSD', 'GBPUSD'],
        'EURGBP': ['EURUSD', 'GBPUSD'],
        'EURJPY': ['USDJPY', 'GBPJPY'],
        'GBPJPY': ['USDJPY', 'EURJPY'],
        'XAUUSD': ['XAGUSD', 'BTCUSD'],
        'XAGUSD': ['XAUUSD'],
        'BTCUSD': ['ETHUSD', 'SOLUSD', 'XAUUSD'],
        'ETHUSD': ['BTCUSD', 'SOLUSD'],
        'SOLUSD': ['BTCUSD', 'ETHUSD'],
        'NAS100': ['US500', 'US30'],
        'US30': ['US500', 'NAS100'],
        'US500': ['NAS100', 'US30'],
        'GER40': ['UK100', 'FRA40'],
        'UK100': ['GER40'],
        'FRA40': ['GER40'],
        'JPN225': [],
        'HK50': []
    };

    private static async calculatePairCorrelation(sym1: string, sym2: string): Promise<number> {
        try {
            const b1 = await this.getBarsSafe(sym1, 24, 'H1');
            const b2 = await this.getBarsSafe(sym2, 24, 'H1');
            if (b1.length < 20 || b2.length < 20) return 0;

            const n = Math.min(b1.length, b2.length);
            const r1: number[] = [], r2: number[] = [];
            for (let i = 1; i < n; i++) {
                r1.push((b1[i].c - b1[i - 1].c) / b1[i - 1].c);
                r2.push((b2[i].c - b2[i - 1].c) / b2[i - 1].c);
            }

            const mean1 = r1.reduce((a, b) => a + b, 0) / r1.length;
            const mean2 = r2.reduce((a, b) => a + b, 0) / r2.length;

            let num = 0, d1 = 0, d2 = 0;
            for (let i = 0; i < r1.length; i++) {
                const x = r1[i] - mean1, y = r2[i] - mean2;
                num += x * y;
                d1 += x * x;
                d2 += y * y;
            }

            const denom = Math.sqrt(d1 * d2);
            return denom > 0 ? Math.abs(num / denom) : 0;
        } catch {
            return 0;
        }
    }

    private static async isCorrelatedToOpenPositions(symbol: string): Promise<boolean> {
        const related = this.CORRELATION_SYMBOLS[symbol.toUpperCase()] || [];
        if (related.length === 0) return false;

        for (const [ticket, pos] of this.openPositions) {
            if (!related.includes(pos.symbol.toUpperCase())) continue;
            const corr = await this.calculatePairCorrelation(symbol.toUpperCase(), pos.symbol.toUpperCase());
            if (corr >= this.CORRELATION_THRESHOLD) {
                console.warn(`🔗 Alpha Robot: ${symbol} correlacionado (${(corr * 100).toFixed(0)}%) com ${pos.symbol} já aberto, pulando`);
                return true;
            }
        }
        return false;
    }

    // ── Data helpers ──

    private static async getBarsSafe(symbol: string, limit: number, timeframe: string): Promise<PolygonBar[]> {
        try {
            const bars = await MarketDataService.getRecentBars(symbol, limit, timeframe);
            const ordered = [...bars].reverse();
            this.lastBarsCache[symbol] = ordered;
            return ordered;
        } catch {
            return [];
        }
    }

    private static async getTickPrice(symbol: string, direction?: 'BUY' | 'SELL'): Promise<number | null> {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 3000 });
            const data = resp.data;
            if (data && data[symbol]) {
                if (direction === 'BUY') return data[symbol].ask || data[symbol].last;
                if (direction === 'SELL') return data[symbol].bid || data[symbol].last;
                return (data[symbol].ask + data[symbol].bid) / 2 || data[symbol].last;
            }
            return null;
        } catch {
            return null;
        }
    }

    // ──────────────────────────────────────────────
    // Position Management (Trailing / Breakeven)
    // ──────────────────────────────────────────────

    private static async manageOpenPositions() {
        if (!this.settings.enabled) return;

        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const positions = Array.isArray(resp.data) ? resp.data : [];

            const robotPositions = positions.filter((p: any) => p.magic === this.ROBOT_MAGIC);

            // Update internal tracking
            const currentTickets = new Set<number>();
            for (const pos of robotPositions) {
                const ticket = pos.ticket || pos.position;
                currentTickets.add(ticket);

                if (!this.openPositions.has(ticket)) {
                    this.openPositions.set(ticket, {
                        ticket,
                        symbol: pos.symbol,
                        type: pos.type === 0 ? 'BUY' : 'SELL',
                        entryPrice: pos.price_open || pos.price,
                        lot: pos.volume || 0.01,
                        sl: pos.sl || 0,
                        tp: pos.tp || 0,
                        trailingActivated: false,
                        breakevenActivated: false
                    });
                }

                const tracked = this.openPositions.get(ticket)!;
                const currentPrice = pos.price_current || pos.bid || pos.ask;

                if (!currentPrice) continue;

                const tpDistance = Math.abs(tracked.tp - tracked.entryPrice);
                const profitPct = tpDistance > 0
                    ? ((currentPrice - tracked.entryPrice) / (tracked.type === 'BUY' ? tpDistance : -tpDistance)) * 100
                    : 0;

                if (this.settings.autoBreakEven && !tracked.breakevenActivated && profitPct >= this.settings.breakevenActivation * 100) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket,
                            sl: tracked.entryPrice
                        }, { timeout: 3000 });
                        tracked.breakevenActivated = true;
                        tracked.sl = tracked.entryPrice;
                        console.log(`🎯 Alpha Robot: Breakeven activated for ticket ${ticket} (${tracked.symbol})`);
                        AlertEngine.addAlert('GUARDIAN', 'INFO', 'Breakeven Ativado', `${tracked.symbol}: Stop ajustado para o breakeven.`);
                    } catch (e) {
                        console.warn(`⚠️ Alpha Robot: Breakeven failed for ticket ${ticket}`);
                    }
                }

                if (this.settings.autoTrailing && tracked.breakevenActivated && profitPct >= this.settings.trailingActivation * 100) {
                    if (!tracked.trailingActivated) {
                        tracked.trailingActivated = true;
                        console.log(`🎯 Alpha Robot: Trailing activated for ticket ${ticket}`);
                    }

                    const atr = this.calculateATR(this.lastBarsCache[tracked.symbol] || [], 14);
                    const trailingDistance = atr > 0 ? atr * 1.5 : Math.abs(tracked.tp - tracked.entryPrice) * 0.25;
                    let newSl: number;

                    if (tracked.type === 'BUY') {
                        newSl = currentPrice - trailingDistance;
                        if (newSl > tracked.sl + trailingDistance * 0.5) {
                            try {
                                await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket, sl: Number(newSl.toFixed(2)) }, { timeout: 3000 });
                                tracked.sl = newSl;
                                console.log(`🎯 Alpha Robot: Trailing updated for ${tracked.symbol} -> SL ${newSl.toFixed(2)}`);
                            } catch (e) { /* ignore */ }
                        }
                    } else {
                        newSl = currentPrice + trailingDistance;
                        if (newSl < tracked.sl - trailingDistance * 0.5) {
                            try {
                                await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket, sl: Number(newSl.toFixed(2)) }, { timeout: 3000 });
                                tracked.sl = newSl;
                                console.log(`🎯 Alpha Robot: Trailing updated for ${tracked.symbol} -> SL ${newSl.toFixed(2)}`);
                            } catch (e) { /* ignore */ }
                        }
                    }
                }
            }

            // Remove closed positions from tracking
            for (const [ticket] of this.openPositions) {
                if (!currentTickets.has(ticket)) {
                    this.openPositions.delete(ticket);
                }
            }
        } catch (e) {
            console.warn('⚠️ Alpha Robot: Position management cycle failed', e);
        }
    }

    // ──────────────────────────────────────────────
    // Signal validation (from SignalEngine)
    // ──────────────────────────────────────────────

    private static shouldTrade(signal: TradingSignal): boolean {
        if (signal.confidence < this.settings.minConfidence) return false;
        if (this.settings.onlyInstitutional && !signal.isInstitutional) return false;

        const age = (Date.now() - new Date(signal.timestamp).getTime()) / 1000;
        if (age > 300) return false;

        if (this.settings.tradesPer15Min > 0 && this.tradesThisWindow >= this.settings.tradesPer15Min) return false;

        if (this.settings.preferredTimeframe !== 'ALL' && signal.timeframe !== this.settings.preferredTimeframe) return false;

        return true;
    }

    // ──────────────────────────────────────────────
    // Execution
    // ──────────────────────────────────────────────

    private static async executeInstitutionalTrade(analysis: InstitutionalAnalysis) {
        try {
            console.log(`🤖 Alpha Robot: Executing institutional trade for ${analysis.symbol} (Score: ${analysis.score})`);

            const lot = this.calculateDynamicLot(analysis);

            const orderResult = await MarketService.retryWhenOpen(analysis.symbol, async () => {
                const response = await axios.post(`${this.BRIDGE_URL}/order`, {
                    symbol: analysis.symbol,
                    action: analysis.direction,
                    lot,
                    sl: analysis.sl,
                    tp: analysis.tp,
                    magic: this.ROBOT_MAGIC,
                    comment: `AlphaInst ${analysis.wyckoffPhase} S${analysis.score}`.substring(0, 30)
                });
                return response.data;
            });

            if (orderResult && (orderResult.status === 'success' || orderResult.ticket)) {
                const ticket = orderResult.ticket || orderResult.order;
                SymbolLockService.acquire(analysis.symbol, 'Alpha Robot', ticket, analysis.direction);

                this.applySLTPWithRetry(ticket, analysis.sl, analysis.tp);

                AlertEngine.addAlert('GUARDIAN', 'INFO', `Alpha Inst: ${analysis.symbol} ${analysis.direction}`,
                    `Score:${analysis.score} Wyckoff:${analysis.wyckoffPhase} R:R:${(Math.abs(analysis.tp - analysis.entryPrice) / Math.abs(analysis.sl - analysis.entryPrice)).toFixed(1)}`);
            }
        } catch (error) {
            console.error(`❌ Alpha Robot: Failed to execute institutional trade for ${analysis.symbol}`, error);
        }
    }

    private static applySLTPWithRetry(ticket: number, sl: number, tp: number, attempts: number = 3) {
        let delay = 2000;
        const tryApply = async (attempt: number) => {
            try {
                await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket, sl, tp }, { timeout: 3000 });
                console.log(`🎯 Alpha Robot: SL/TP applied for ticket ${ticket}`);
            } catch (e) {
                if (attempt < attempts) {
                    const nextDelay = delay * 2;
                    console.warn(`⚠️ Alpha Robot: SL/TP apply failed for ticket ${ticket}, retrying in ${nextDelay}ms (attempt ${attempt + 1}/${attempts})`);
                    setTimeout(() => tryApply(attempt + 1), nextDelay);
                } else {
                    console.warn(`⚠️ Alpha Robot: SL/TP apply failed for ticket ${ticket} after ${attempts} attempts`);
                }
            }
        };
        setTimeout(() => tryApply(0), delay);
    }

    private static calculateDynamicLot(analysis: InstitutionalAnalysis): number {
        try {
            // Get account balance
            const accountStr = fs.readFileSync(
                path.resolve(process.cwd(), 'account_info.json'), 'utf-8'
            );
            const account = JSON.parse(accountStr);
            const balance = account.balance || 1000;

            // Risk % of balance
            const riskAmount = balance * (this.settings.maxRiskPerTrade / 100);
            const slDistance = Math.abs(analysis.entryPrice - analysis.sl);

            // Lot = riskAmount / (slDistance * contractSize)
            // For most pairs contract size = 100,000 (standard lot)
            // For crypto CFDs: contract size = 1
            const isCrypto = analysis.symbol.includes('BTC') || analysis.symbol.includes('ETH') || analysis.symbol.includes('SOL');
            const contractSize = isCrypto ? 1 : 100000;

            let lot = slDistance > 0 ? riskAmount / (slDistance * contractSize) : this.settings.defaultLot;

            // Round to nearest valid lot step
            lot = Math.max(0.01, Math.min(lot, 10));
            lot = Math.round(lot * 100) / 100;

            return lot;
        } catch {
            return this.settings.defaultLot;
        }
    }

    private static async executeTrade(signal: TradingSignal) {
        try {
            console.log(`🤖 Alpha Robot: Executing signal trade for ${signal.symbol} (${signal.setup})`);

            if (this.tradesThisWindow >= this.settings.tradesPer15Min) return;

            const analysis: InstitutionalAnalysis = {
                symbol: signal.symbol,
                direction: signal.type,
                score: signal.confidence,
                wyckoffPhase: 'SIGNAL',
                vwapDistance: 0,
                trendAlignment: 'NEUTRAL',
                nearestOB: null,
                rsi: 50,
                volumeRatio: 1,
                entryPrice: signal.price_entry || 0,
                sl: signal.sl || 0,
                tp: signal.tp || 0,
                confidence: signal.confidence,
                details: signal.setup
            };
            const lot = this.calculateDynamicLot(analysis);

            const orderResult = await MarketService.retryWhenOpen(signal.symbol, async () => {
                const response = await axios.post(`${this.BRIDGE_URL}/order`, {
                    symbol: signal.symbol,
                    action: signal.type,
                    lot,
                    magic: this.ROBOT_MAGIC,
                    comment: `AlphaV2 ${signal.setup}`.substring(0, 30)
                });
                return response.data;
            });

            if (orderResult && (orderResult.status === 'success' || orderResult.ticket)) {
                const ticket = orderResult.ticket || orderResult.order;
                SymbolLockService.acquire(signal.symbol, 'Alpha Robot', ticket, signal.type);
                this.processedSignals.add(signal.id);
                this.tradesThisWindow++;
                this.dailyTradeCount++;
                AlertEngine.addAlert('GUARDIAN', 'INFO', `Robo Alpha: ${signal.symbol} ${signal.type}`,
                    `Executado via ${signal.setup}`);
                try {
                } catch (e) { /* notif fail */ }

                if (signal.sl || signal.tp) {
                    this.applySLTPWithRetry(orderResult.ticket || orderResult.order, signal.sl || 0, signal.tp || 0);
                }
            }
        } catch (error) {
            console.error(`❌ Alpha Robot: Failed to execute trade for ${signal.symbol}`, error);
        }
    }

    // ──────────────────────────────────────────────
    // Window / interval helpers
    // ──────────────────────────────────────────────

    private static getWindowId(interval: string): string {
        const now = new Date();
        const Y = now.getFullYear();
        const M = now.getMonth() + 1;
        const D = now.getDate();
        const H = now.getHours();
        const m = now.getMinutes();

        switch (interval) {
            case '1m': return `${Y}-${M}-${D} ${H}:${m}`;
            case '15m': return `${Y}-${M}-${D} ${H}:${Math.floor(m / 15)}`;
            case '30m': return `${Y}-${M}-${D} ${H}:${Math.floor(m / 30)}`;
            case '1h': return `${Y}-${M}-${D} ${H}`;
            case '1d': return `${Y}-${M}-${D}`;
            case '1w': {
                const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
                const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
                return `${Y}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
            }
            case '1mo': return `${Y}-${M}`;
            default: return `${Y}-${M}-${D} ${H}:${Math.floor(m / 15)}`;
        }
    }

    // ──────────────────────────────────────────────
    // Trade History
    // ──────────────────────────────────────────────

    private static loadTradeHistory() {
        if (fs.existsSync(this.HISTORY_PATH)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.HISTORY_PATH, 'utf-8'));
                let rawTrades: TradeRecord[] = data.trades || [];

                this.tradeHistory = rawTrades.filter(t =>
                    t.magic === this.ROBOT_MAGIC || (t.comment || '').toUpperCase().includes('ALPHA')
                );

                this.totalWins = data.totalWins || 0;
                this.totalLosses = data.totalLosses || 0;
                this.totalProfitAllTime = data.totalProfitAllTime || 0;

                console.log(`🤖 Alpha Robot: History loaded (${this.tradeHistory.length} trades)`);
            } catch (e) { /* ignore */ }
        }
    }

    private static saveTradeHistory() {
        try {
            fs.writeFileSync(this.HISTORY_PATH, JSON.stringify({
                trades: this.tradeHistory,
                totalWins: this.totalWins,
                totalLosses: this.totalLosses,
                totalProfitAllTime: this.totalProfitAllTime
            }, null, 2));
        } catch (e) { /* ignore */ }
    }

    static async syncTradesFromMT5() {
        try {
            const history = await BridgeClient.getHistory();

            const robotTrades = history.filter((t: any) => {
                const comment = (t.comment || '').toUpperCase();
                return t.magic === this.ROBOT_MAGIC || comment.includes('ALPHA');
            });

            const existingTickets = new Set(this.tradeHistory.map(t => t.ticket));
            let newCount = 0;

            for (const t of robotTrades) {
                const ticket = t.ticket || t.deal;
                if (existingTickets.has(ticket)) continue;

                const profit = t.profit || 0;
                let closeReason: TradeRecord['closeReason'] = 'MANUAL';
                const comment = (t.comment || '').toUpperCase();

                if (comment.includes('[TP]')) closeReason = 'TP';
                if (comment.includes('[SL]')) closeReason = 'SL';
                if (comment.includes('[BE]')) closeReason = 'BE';
                if (comment.includes('[TRAILING]')) closeReason = 'TRAILING';

                const record: TradeRecord = {
                    id: `alpha_${ticket}_${t.time}`,
                    ticket,
                    symbol: t.symbol || '',
                    type: t.type === 0 ? 'BUY' : 'SELL',
                    lot: t.volume || 0.01,
                    entryPrice: t.price_open || 0,
                    exitPrice: t.price || 0,
                    profit: Number(profit.toFixed(2)),
                    result: profit >= 0 ? 'WIN' : 'LOSS',
                    setup: `Alpha Robot - ${(t.comment || '').split('|').pop()?.trim() || 'Desconhecido'}`,
                    closeReason,
                    openTime: t.time ? new Date(t.time * 1000).toISOString() : new Date().toISOString(),
                    closeTime: t.time ? new Date(t.time * 1000).toISOString() : new Date().toISOString(),
                    duration: '-',
                    magic: t.magic,
                    comment: t.comment
                };

                this.tradeHistory.unshift(record);
                existingTickets.add(ticket);
                if (record.result === 'WIN') this.totalWins++;
                else this.totalLosses++;
                this.totalProfitAllTime += record.profit;
                newCount++;

                if (this.settings.enabled) {
                    try {
                    } catch (e) { /* notif fail */ }
                }
            }

            if (this.tradeHistory.length > 200) {
                this.tradeHistory = this.tradeHistory.slice(0, 200);
            }

            this.tradeHistory.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
            this.saveTradeHistory();

            return { synced: newCount, total: this.tradeHistory.length };
        } catch (e) {
            console.error('❌ Alpha Robot: Sync failure', e);
            return { synced: 0, total: this.tradeHistory.length };
        }
    }

    // ──────────────────────────────────────────────
    // Reports / Status
    // ──────────────────────────────────────────────

    static async getTradeReport() {
        const total = this.tradeHistory.length;
        const wins = this.tradeHistory.filter(t => t.result === 'WIN').length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        const grossProfit = this.tradeHistory.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
        const grossLoss = Math.abs(this.tradeHistory.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

        let currentStreak = 0;
        for (const t of this.tradeHistory) {
            if (t.result === 'WIN') currentStreak++;
            else break;
        }

        return {
            summary: {
                totalTrades: total,
                wins,
                losses: total - wins,
                winRate: Number(winRate.toFixed(1)),
                totalProfit: Number(this.totalProfitAllTime.toFixed(2)),
                profitFactor: Number(profitFactor.toFixed(2)),
                currentStreak
            },
            recentTrades: this.tradeHistory.slice(0, 50)
        };
    }

    static getStatus() {
        const analysisSummary = Object.values(this.lastAnalysis).map(a => ({
            symbol: a.symbol,
            direction: a.direction,
            score: a.score,
            wyckoffPhase: a.wyckoffPhase,
            rsi: a.rsi,
            confidence: a.confidence,
            details: a.details
        }));

        return {
            enabled: this.settings.enabled,
            settings: this.settings,
            processedCount: this.processedSignals.size,
            tradesThisWindow: this.tradesThisWindow,
            tradesLimit: this.settings.tradesPer15Min,
            currentInterval: this.settings.tradeLimitInterval,
            tradeHistoryCount: this.tradeHistory.length,
            totalWins: this.totalWins,
            totalLosses: this.totalLosses,
            totalProfitAllTime: Number(this.totalProfitAllTime.toFixed(2)),
            openPositions: this.openPositions.size,
            mlSignalsUsed: this.mlSignalsUsed,
            institutionalAnalysis: analysisSummary
        };
    }
}
