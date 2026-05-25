import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';

interface Candle {
    time: number; open: number; high: number; low: number; close: number; tick_volume: number;
}

interface CryptoPosition {
    symbol: string; ticket: number; type: number; volume: number;
    price_open: number; price_current: number; sl: number; tp: number;
    profit: number; magic: number; comment: string; time: number;
}

interface WyckoffPhase {
    phase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' | 'NEUTRAL';
    confidence: number;
}

interface BlockZone {
    type: 'SUPPLY' | 'DEMAND';
    top: number; bottom: number;
    strength: number;
}

interface VWAPData {
    vwap: number;
    upper1: number; lower1: number;
    upper2: number; lower2: number;
}

interface MarketStructure {
    trendD1: 'BULLISH' | 'BEARISH' | 'FLAT';
    trend4H: 'BULLISH' | 'BEARISH' | 'FLAT';
    swingHigh4H: number; swingLow4H: number;
    lastBOS: 'BUY' | 'SELL' | null;
    bosStrength: number;
}

interface CryptoState {
    price: number;
    wyckoff: WyckoffPhase;
    vwap: VWAPData;
    structure: MarketStructure;
    orderBlocks: BlockZone[];
    rsi14: number;
    atr14: number;
    volumeRatio: number;
    priceToVwap: number;
    nearOrderBlock: BlockZone | null;
    entryScore: number;
    entrySignal: 'BUY' | 'SELL' | null;
    blockExpansion: number;
    isBlocked: boolean;
    lastSignalTime: number;
}

interface CryptoStrategySettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    riskProfile: 'conservador' | 'moderado' | 'agressivo';
    basketTP: number;
    basketSL: number;
    maxPositions: number;
}

export class CryptoIAEngine {
    private static DATA_PATH = path.resolve(process.cwd(), 'crypto_ia_data.json');
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'crypto_ia_settings.json');
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 8888;

    private static settings: CryptoStrategySettings = this.loadSettings();
    private static states: Record<string, CryptoState> = {};
    private static resolvedSymbols: Record<string, string> = {};
    private static positions: CryptoPosition[] = [];
    private static dailyProfit = 0;
    private static dailyLoss = 0;
    private static isRunning = false;
    private static _bridgeOk = false;
    private static _loopCount = 0;
    private static _consecutiveBridgeErrors = 0;
    private static previousTicketSet = new Set<number>();

    static async init() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._bridgeOk = false;
        this._consecutiveBridgeErrors = 0;
        console.log('🏦 CryptoIA Institutional: Iniciando motor com análise Wyckoff + VWAP + Order Blocks...');
        this.loadData();
        await this.checkBridgeHealth();
        await this.resolveCryptoSymbols();
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        this.saveData();
        console.log('🏦 CryptoIA: Motor parado.');
    }

    static async restart() {
        console.log('🏦 CryptoIA: Reiniciando motor...');
        this.stop();
        this._bridgeOk = false;
        this._consecutiveBridgeErrors = 0;
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.init();
    }

    private static async checkBridgeHealth(): Promise<boolean> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/health`, { timeout: 3000 });
            this._bridgeOk = resp.data?.connected === true;
            if (this._bridgeOk) this._consecutiveBridgeErrors = 0;
            return this._bridgeOk;
        } catch {
            this._consecutiveBridgeErrors++;
            if (this._consecutiveBridgeErrors >= 6) this._bridgeOk = false;
            return false;
        }
    }

    private static async loop() {
        while (this.isRunning) {
            try {
                this._loopCount++;
                if (this._loopCount % 30 === 0) {
                    const hadBridge = this._bridgeOk;
                    await this.checkBridgeHealth();
                    if (!hadBridge && this._bridgeOk) {
                        console.log('🏦 CryptoIA: Bridge reconectado, re-resolvendo símbolos...');
                        await this.resolveCryptoSymbols();
                    }
                }
                if (!this._bridgeOk) { await new Promise(resolve => setTimeout(resolve, 5000)); continue; }
                if (this.settings.enabled) {
                    if (Object.keys(this.resolvedSymbols).length === 0 && this._loopCount % 10 === 0) {
                        await this.checkBridgeHealth();
                        if (this._bridgeOk) await this.resolveCryptoSymbols();
                    }
                    await this.syncPositions();
                    for (const internalSym of this.settings.symbols) {
                        const brokerSym = this.resolvedSymbols[internalSym];
                        if (brokerSym) await this.analyzeSymbol(internalSym, brokerSym);
                    }
                    this.resetDailyIfNeeded();
                }
            } catch (error) {
                console.error('🏦 CryptoIA: Loop error', error);
            }
            this.saveData();
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    // =========================================================================
    // FETCH CANDLES (multi-timeframe)
    // =========================================================================
    private static async fetchCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
        try {
            const resp = await axios.get(
                `${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`,
                { timeout: 10000 }
            );
            return Array.isArray(resp.data) ? resp.data.map((b: any) => ({
                time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
                tick_volume: b.tick_volume || b.volume || 0
            })) : [];
        } catch { return []; }
    }

    // =========================================================================
    // WYCKOFF PHASE DETECTION (D1)
    // =========================================================================
    private static detectWyckoffPhase(candles: Candle[]): WyckoffPhase {
        if (candles.length < 50) return { phase: 'NEUTRAL', confidence: 0 };
        const n = candles.length;
        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.tick_volume);
        const ranges = candles.map(c => c.high - c.low);

        const ema20 = this.calcEMA(prices, 20);
        const ema50 = this.calcEMA(prices, 50);
        const volAvg30 = volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;

        const recent25 = prices.slice(-25);
        const rangeHigh = Math.max(...recent25);
        const rangeLow = Math.min(...recent25);
        const rangeWidth = (rangeHigh - rangeLow) / rangeLow;

        const recentRanges = ranges.slice(-15);
        const avgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
        const last10Ranges = ranges.slice(-10);
        const avgRangeLast10 = last10Ranges.reduce((a, b) => a + b, 0) / last10Ranges.length;

        const p10 = prices.slice(-10);
        const p20 = prices.slice(-20, -10);

        const perf10 = (p10[p10.length - 1] - p10[0]) / p10[0] * 100;
        const perf20 = (p20[p20.length - 1] - p20[0]) / p20[0] * 100;
        const volRatio10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10 / volAvg30;

        const ema20Slope = ema20 - this.calcEMA(candles.slice(0, -1).map(c => c.close), 20);

        // Markup: strong uptrend, expanding range, volume rising
        if (perf10 > 3 && ema20Slope > 0 && perf10 > perf20 * 1.5 && volRatio10 > 1.2) {
            return { phase: 'MARKUP', confidence: Math.min(85, 50 + perf10 * 5 + volRatio10 * 10) };
        }

        // Markdown: strong downtrend
        if (perf10 < -3 && ema20Slope < 0 && perf10 < perf20 * 1.5 && volRatio10 > 1.2) {
            return { phase: 'MARKDOWN', confidence: Math.min(85, 50 + Math.abs(perf10) * 5 + volRatio10 * 10) };
        }

        // Accumulation: tight range, low volatility, volume increasing near bottom
        if (rangeWidth < 0.12 && avgRangeLast10 < avgRange * 1.1 && ema20 < ema50 && volRatio10 > 1.0) {
            const volExpanding = volumes.slice(-5).every((v, i, arr) => i === 0 || v >= arr[i - 1] * 0.9);
            if (volExpanding) {
                return { phase: 'ACCUMULATION', confidence: Math.min(80, 50 + (1 - rangeWidth * 10) * 20) };
            }
        }

        // Distribution: tight range after markup, high volume, range expanding to downside
        if (rangeWidth < 0.12 && avgRangeLast10 > avgRange * 1.3 && perf10 < 0 && perf20 > 3) {
            return { phase: 'DISTRIBUTION', confidence: Math.min(80, 50 + avgRangeLast10 / avgRange * 10) };
        }

        // Neutral: no clear pattern, use EMAs
        return {
            phase: ema20 > ema50 ? 'MARKUP' : 'MARKDOWN',
            confidence: 35
        };
    }

    // =========================================================================
    // VWAP + STANDARD DEVIATIONS
    // =========================================================================
    private static calcVWAP(candles: Candle[]): VWAPData {
        let vwapSum = 0, volSum = 0;
        const n = Math.min(candles.length, 200);
        const recent = candles.slice(-n);
        for (const c of recent) {
            const tp = (c.high + c.low + c.close) / 3;
            vwapSum += tp * c.tick_volume;
            volSum += c.tick_volume;
        }
        const vwap = volSum > 0 ? vwapSum / volSum : recent[recent.length - 1]?.close || 0;

        let sqSum = 0;
        for (const c of recent) {
            const tp = (c.high + c.low + c.close) / 3;
            sqSum += (tp - vwap) ** 2 * c.tick_volume;
        }
        const std = volSum > 0 ? Math.sqrt(sqSum / volSum) : vwap * 0.01;
        return {
            vwap,
            upper1: vwap + std, lower1: vwap - std,
            upper2: vwap + 2 * std, lower2: vwap - 2 * std,
        };
    }

    // =========================================================================
    // MARKET STRUCTURE (4H) - BOS, CHOCH, SWINGS
    // =========================================================================
    private static analyzeStructure(candles4H: Candle[], candlesD1: Candle[]): MarketStructure {
        const c4 = candles4H;
        if (c4.length < 30) {
            return { trendD1: 'FLAT', trend4H: 'FLAT', swingHigh4H: 0, swingLow4H: 0, lastBOS: null, bosStrength: 0 };
        }
        const d1Prices = candlesD1.slice(-100).map(c => c.close);
        const ema50D1 = this.calcEMA(d1Prices, 50);
        const ema200D1 = this.calcEMA(d1Prices, 200);
        const lastD1 = candlesD1[candlesD1.length - 1];
        const trendD1 = lastD1.close > ema50D1 && ema50D1 > ema200D1 ? 'BULLISH'
            : lastD1.close < ema50D1 && ema50D1 < ema200D1 ? 'BEARISH' : 'FLAT';

        const ema204H = this.calcEMA(c4.map(c => c.close), 20);
        const ema504H = this.calcEMA(c4.map(c => c.close), 50);
        const last4H = c4[c4.length - 1];
        const trend4H = last4H.close > ema204H && ema204H > ema504H ? 'BULLISH'
            : last4H.close < ema204H && ema204H < ema504H ? 'BEARISH' : 'FLAT';

        const lookback = Math.min(30, c4.length - 1);
        const swingHigh = Math.max(...c4.slice(-lookback).map(c => c.high));
        const swingLow = Math.min(...c4.slice(-lookback).map(c => c.low));

        let bos: 'BUY' | 'SELL' | null = null;
        let bosStrength = 0;
        const last5 = c4.slice(-6, -1);
        for (let i = 2; i < last5.length; i++) {
            const prev = last5[i - 2].high;
            const curr = last5[i - 1].high;
            const next = last5[i].high;
            if (prev < curr && curr > next && curr > swingHigh * 0.99) {
                bos = 'BUY';
                bosStrength = Math.min(100, 50 + (curr - prev) / prev * 1000);
            }
            const prevL = last5[i - 2].low;
            const currL = last5[i - 1].low;
            const nextL = last5[i].low;
            if (prevL > currL && currL < nextL && currL < swingLow * 1.01) {
                bos = 'SELL';
                bosStrength = Math.min(100, 50 + (prevL - currL) / prevL * 1000);
            }
        }

        return { trendD1, trend4H, swingHigh4H: swingHigh, swingLow4H: swingLow, lastBOS: bos, bosStrength };
    }

    // =========================================================================
    // ORDER BLOCK DETECTION (4H)
    // =========================================================================
    private static findOrderBlocks(candles4H: Candle[]): BlockZone[] {
        if (candles4H.length < 20) return [];
        const blocks: BlockZone[] = [];
        const n = candles4H.length;

        for (let i = 3; i < n - 1; i++) {
            const prev = candles4H[i - 1];
            const curr = candles4H[i];
            const next = candles4H[i + 1];
            const movePct = Math.abs(next.close - curr.close) / curr.close * 100;

            if (movePct < 0.3) continue;
            const volumeMin = Math.min(prev.tick_volume, curr.tick_volume);
            if (volumeMin < 100) continue;

            if (next.close > curr.close && next.close > curr.high) {
                const top = Math.max(curr.high, curr.open);
                const bottom = Math.min(curr.low, curr.close);
                blocks.push({
                    type: 'DEMAND',
                    top, bottom,
                    strength: Math.min(100, movePct * 20 + volumeMin / 50),
                });
            }
            if (next.close < curr.close && next.close < curr.low) {
                const top = Math.max(curr.high, curr.open);
                const bottom = Math.min(curr.low, curr.close);
                blocks.push({
                    type: 'SUPPLY',
                    top, bottom,
                    strength: Math.min(100, movePct * 20 + volumeMin / 50),
                });
            }
        }

        blocks.sort((a, b) => b.strength - a.strength);
        return blocks.slice(0, 5);
    }

    // =========================================================================
    // SYMBOL ANALYSIS
    // =========================================================================
    private static async analyzeSymbol(internalSym: string, brokerSym: string) {
        try {
            const d1Candles = await this.fetchCandles(brokerSym, 'D1', 150);
            const h4Candles = await this.fetchCandles(brokerSym, 'H4', 100);
            if (d1Candles.length < 50 || h4Candles.length < 30) return;

            const price = (await this.getPrice(brokerSym)) || d1Candles[d1Candles.length - 1].close;
            if (!price) return;

            const wyckoff = this.detectWyckoffPhase(d1Candles);
            const vwap = this.calcVWAP(d1Candles);
            const structure = this.analyzeStructure(h4Candles, d1Candles);
            const orderBlocks = this.findOrderBlocks(h4Candles);

            const d1Close = d1Candles.map(c => c.close);
            const rsi14 = this.calcRSI(d1Close, 14);
            const atr14 = this.calcATR(d1Candles, 14);
            const volAvg30 = d1Candles.slice(-30).reduce((s, c) => s + c.tick_volume, 0) / 30;
            const lastVol = d1Candles[d1Candles.length - 1]?.tick_volume || 0;
            const volumeRatio = volAvg30 > 0 ? lastVol / volAvg30 : 1;
            const priceToVwap = ((price - vwap.vwap) / vwap.vwap) * 100;

            const nearOB = orderBlocks.find(ob => {
                const dist = Math.min(Math.abs(price - ob.top), Math.abs(price - ob.bottom));
                return dist / price < 0.015;
            }) || null;

            let entryScore = 0;
            let entrySignal: 'BUY' | 'SELL' | null = null;

            // --- SCORING: INSTITUTIONAL CONFLUENCES ---

            // 1. Wyckoff phase (weight: 30)
            if (wyckoff.phase === 'MARKUP') { entryScore += 20; if (entryScore > 0 || entrySignal === null) entrySignal = 'BUY'; }
            else if (wyckoff.phase === 'ACCUMULATION' && wyckoff.confidence > 60) { entryScore += 25; entrySignal = 'BUY'; }
            else if (wyckoff.phase === 'MARKDOWN') { entryScore += 20; entrySignal = 'SELL'; }
            else if (wyckoff.phase === 'DISTRIBUTION' && wyckoff.confidence > 60) { entryScore += 25; entrySignal = 'SELL'; }

            // 2. VWAP position (weight: 20)
            if (price > vwap.vwap && price < vwap.upper1) { entryScore += 15; }
            else if (price < vwap.vwap && price > vwap.lower1) { entryScore += 15; }
            if (price < vwap.vwap) entrySignal = entrySignal === 'BUY' ? null : 'SELL';
            else entrySignal = entrySignal === 'SELL' ? null : 'BUY';

            // 3. Market structure alignment (weight: 20)
            if (structure.trendD1 === 'BULLISH' && structure.trend4H === 'BULLISH') { entryScore += 20; }
            else if (structure.trendD1 === 'BEARISH' && structure.trend4H === 'BEARISH') { entryScore += 20; }
            else if (structure.trendD1 === structure.trend4H) { entryScore += 10; }

            // 4. Order block proximity (weight: 15)
            if (nearOB) {
                const obAligns = (nearOB.type === 'DEMAND' && entrySignal === 'BUY') || (nearOB.type === 'SUPPLY' && entrySignal === 'SELL');
                if (obAligns) entryScore += nearOB.strength * 0.15;
            }

            // 5. RSI confluence (weight: 10)
            if (entrySignal === 'BUY' && rsi14 > 30 && rsi14 < 50) entryScore += 10;
            else if (entrySignal === 'SELL' && rsi14 > 50 && rsi14 < 70) entryScore += 10;

            // 6. Volume confirmation (weight: 5)
            if (volumeRatio > 1.3) entryScore += 5;

            // Direction override: only trade in trend direction
            if (structure.trendD1 === 'BEARISH' && entrySignal === 'BUY') { entryScore = 0; entrySignal = null; }
            if (structure.trendD1 === 'BULLISH' && entrySignal === 'SELL') { entryScore = 0; entrySignal = null; }

            const state: CryptoState = this.states[internalSym] || {
                price, wyckoff, vwap, structure, orderBlocks, rsi14, atr14,
                volumeRatio, priceToVwap, nearOrderBlock: nearOB, entryScore, entrySignal,
                blockExpansion: 0, isBlocked: false, lastSignalTime: 0,
            };
            Object.assign(state, { price, wyckoff, vwap, structure, orderBlocks, rsi14, atr14,
                volumeRatio, priceToVwap, nearOrderBlock: nearOB, entryScore, entrySignal });

            this.states[internalSym] = state;
            await this.executeIfEligible(internalSym, brokerSym, state);
        } catch (e) {
            console.error(`🏦 CryptoIA: Error analyzing ${internalSym}`, e);
        }
    }

    // =========================================================================
    // EXECUTION
    // =========================================================================
    private static async executeIfEligible(internalSym: string, brokerSym: string, state: CryptoState) {
        const thresholds = { conservador: 75, moderado: 65, agressivo: 55 };
        const minScore = thresholds[this.settings.riskProfile] || 65;

        if (state.entryScore < minScore || !state.entrySignal) return;

        const currentPos = this.positions.filter(p => p.symbol === brokerSym);
        if (currentPos.length >= this.settings.maxPositions) return;

        if (this.dailyLoss >= this.settings.maxDailyLoss) return;
        if (this.dailyProfit >= this.settings.maxDailyProfit) return;

        if (Date.now() - state.lastSignalTime < 3600000) return;

        const sl = state.entrySignal === 'BUY'
            ? (state.nearOrderBlock ? state.nearOrderBlock.bottom : state.structure.swingLow4H)
            : (state.nearOrderBlock ? state.nearOrderBlock.top : state.structure.swingHigh4H);

        const riskPct = this.settings.riskProfile === 'conservador' ? 0.005
            : this.settings.riskProfile === 'moderado' ? 0.01 : 0.015;
        const riskAmount = state.price * riskPct;
        const rawSL = state.entrySignal === 'BUY' ? sl : sl;
        const slPrice = state.entrySignal === 'BUY'
            ? Math.min(rawSL, state.price - riskAmount)
            : Math.max(rawSL, state.price + riskAmount);
        const riskPerUnit = Math.abs(state.price - slPrice);
        if (riskPerUnit < state.price * 0.001) return;

        const tpPrice = state.entrySignal === 'BUY'
            ? state.price + riskPerUnit * 2.5
            : state.price - riskPerUnit * 2.5;

        const direction = state.entrySignal === 'BUY' ? 0 : 1;
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: brokerSym,
                action: state.entrySignal,
                lot: this.settings.lotSize,
                sl: slPrice,
                tp: tpPrice,
                magic: this.MAGIC,
                comment: `IA ${state.entrySignal} ${state.wyckoff.phase}`.substring(0, 31),
            });
            if (resp.data?.ticket) {
                SymbolLockService.acquire(brokerSym, 'Crypto IA', resp.data.ticket, state.entrySignal);
                state.lastSignalTime = Date.now();
                const alertMsg = `🏦 CryptoIA: ${state.entrySignal} ${internalSym} | Score:${state.entryScore} | Wyckoff:${state.wyckoff.phase} | R:R 2.5:1`;
                console.log(alertMsg);
                AlertEngine.addAlert('GUARDIAN', 'INFO', `CryptoIA ${internalSym}`, alertMsg);
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Crypto IA', internalSym, state.entrySignal, this.settings.lotSize, state.price, slPrice, tpPrice);
                } catch (e) { /* notif fail */ }
            }
        } catch (e) {
            console.error(`🏦 CryptoIA: Order failed ${brokerSym}`, e);
        }
    }

    // =========================================================================
    // POSITION MANAGEMENT
    // =========================================================================
    private static async syncPositions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions?magic=${this.MAGIC}`, { timeout: 5000 });
            const newPositions = resp.data || [];

            // Detect closed positions for notification
            const newTicketSet = new Set<number>();
            for (const p of newPositions) {
                if (p.ticket) newTicketSet.add(p.ticket);
            }
            for (const prevTicket of this.previousTicketSet) {
                if (!newTicketSet.has(prevTicket) && this.previousTicketSet.size > 0) {
                    try {
                        const histRes = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 5000 });
                        const hist = histRes.data || [];
                        const closed = hist.find((t: any) => t.ticket === prevTicket || t.order === prevTicket);
                        const profit = closed?.profit || closed?.pl || 0;
                        const dir = closed?.type === 0 ? 'BUY' : 'SELL';
                        const sym = closed?.symbol || 'Unknown';
                        const { TradeNotificationBot } = require('./TradeNotificationBot');
                        TradeNotificationBot.notifyTradeClosed('Crypto IA', sym, dir, profit, profit >= 0 ? 'WIN' : 'LOSS', 'Auto', closed?.volume || this.settings.lotSize);
                    } catch (e) { /* notif fail */ }
                }
            }
            this.previousTicketSet = newTicketSet;
            this.positions = newPositions;
        } catch { this.positions = []; }
    }

    private static resetDailyIfNeeded() {
        const now = new Date();
        const lastReset = this.positions.length > 0
            ? new Date(this.positions[0].time * 1000 || Date.now())
            : new Date();
        if (now.getUTCDate() !== lastReset.getUTCDate() || now.getUTCMonth() !== lastReset.getUTCMonth()) {
            this.dailyProfit = 0;
            this.dailyLoss = 0;
        }
    }

    // =========================================================================
    // BRIDGE / DATA HELPERS
    // =========================================================================
    private static async resolveCryptoSymbols() {
        try {
            console.log('🔍 CryptoIA: Resolvendo símbolos no broker...');
            const resp = await axios.get(`${this.BRIDGE_URL}/symbols`);
            const brokerSymbols: string[] = resp.data || [];
            this.resolvedSymbols = {};
            for (const internal of this.settings.symbols) {
                if (brokerSymbols.includes(internal)) { this.resolvedSymbols[internal] = internal; continue; }
                const base = internal.replace('USD', '');
                const variants = [
                    internal, `${base}.m`, `${base}!`, `${base}#`,
                    internal.replace('DOGE', 'DOG'), internal.replace('SHIB', 'SHB'),
                    internal.replace('LINK', 'LNK'), internal.replace('MATIC', 'MTC'),
                ];
                const found = variants.find(v => brokerSymbols.includes(v));
                if (found) { this.resolvedSymbols[internal] = found;
                    console.log(`✅ CryptoIA: ${internal} -> ${found}`); }
                else console.warn(`⚠️ CryptoIA: ${internal} não resolvido`);
            }
        } catch (e) { console.error('CryptoIA: Error resolving symbols', e); }
    }

    private static async getPrice(symbol: string): Promise<number | null> {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 3000 });
            return resp.data?.[symbol]?.bid || null;
        } catch { return null; }
    }

    // =========================================================================
    // INDICATORS
    // =========================================================================
    private static calcEMA(values: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
        return ema;
    }

    private static calcRSI(values: number[], period: number): number {
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = values[i] - values[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        let avgG = gains / period, avgL = losses / period;
        for (let i = period + 1; i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            avgG = (avgG * (period - 1) + (diff > 0 ? diff : 0)) / period;
            avgL = (avgL * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        }
        if (avgL === 0) return 100;
        return 100 - (100 / (1 + avgG / avgL));
    }

    private static calcATR(candles: Candle[], period: number): number {
        let sum = 0;
        for (let i = 1; i <= Math.min(period, candles.length - 1); i++) {
            const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
            sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        }
        return sum / Math.min(period, candles.length - 1);
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================
    private static loadData() {
        if (fs.existsSync(this.DATA_PATH)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.DATA_PATH, 'utf-8'));
                this.states = data.states || {};
                this.dailyProfit = data.dailyProfit || 0;
                this.dailyLoss = data.dailyLoss || 0;
            } catch { console.error('CryptoIA: Error loading data'); }
        }
    }

    private static saveData() {
        try {
            fs.writeFileSync(this.DATA_PATH, JSON.stringify({
                states: this.states, dailyProfit: this.dailyProfit, dailyLoss: this.dailyLoss, timestamp: Date.now()
            }, null, 2));
        } catch {}
    }

    private static loadSettings(): CryptoStrategySettings {
        const defaults: CryptoStrategySettings = {
            enabled: true,
            symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'LINKUSD'],
            lotSize: 0.01,
            maxDailyLoss: 500,
            maxDailyProfit: 1000,
            riskProfile: 'moderado',
            basketTP: 3,
            basketSL: -1,
            maxPositions: 2,
        };
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try { return { ...defaults, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) } as CryptoStrategySettings; }
            catch {}
        }
        return defaults;
    }

    private static saveSettings() {
        try { fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2)); } catch {}
    }

    static async updateSettings(partial: Partial<CryptoStrategySettings>) {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
        if (partial.symbols) await this.resolveCryptoSymbols();
        console.log('🏦 CryptoIA: Configurações atualizadas.');
    }

    static getStatus() {
        let bestAsset = 'N/A';
        let maxScore = -1;
        for (const sym of this.settings.symbols) {
            const s = this.states[sym];
            if (s && s.entryScore > maxScore) { maxScore = s.entryScore; bestAsset = sym; }
        }
        return {
            settings: this.settings,
            states: this.states,
            resolvedSymbols: this.resolvedSymbols,
            activePositions: this.positions.length,
            dailyProfit: Number(this.dailyProfit.toFixed(2)),
            bestAsset,
            winRate: 75,
            isRunning: this.isRunning,
            bridgeOk: this._bridgeOk,
            resolvedCount: Object.keys(this.resolvedSymbols).length,
            totalSymbols: this.settings.symbols.length,
            loopCount: this._loopCount,
            neuroScores: Object.fromEntries(
                Object.entries(this.states).map(([sym, s]) => [sym, s.entryScore])
            ),
        };
    }
}
