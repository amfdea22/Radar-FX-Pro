import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MarketDataService } from './MarketDataService';
import { PolygonBar } from './PolygonService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';
import { DisciplineEngine } from './DisciplineEngine';
import { TradeNotificationBot } from './TradeNotificationBot';

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

enum WyckoffPhase {
    ACCUMULATION_PHASE_A = 'ACCUMULATION_PHASE_A',
    ACCUMULATION_PHASE_B = 'ACCUMULATION_PHASE_B',
    ACCUMULATION_PHASE_C_SPRING = 'ACCUMULATION_PHASE_C_SPRING',
    MARKUP_PHASE_D = 'MARKUP_PHASE_D',
    DISTRIBUTION_PHASE_E = 'DISTRIBUTION_PHASE_E',
    DISTRIBUTION_PHASE_A = 'DISTRIBUTION_PHASE_A',
    DISTRIBUTION_PHASE_B = 'DISTRIBUTION_PHASE_B',
    DISTRIBUTION_PHASE_C_UTAD = 'DISTRIBUTION_PHASE_C_UTAD',
    MARKDOWN_PHASE_D = 'MARKDOWN_PHASE_D',
    REACCUMULATION_PHASE_E = 'REACCUMULATION_PHASE_E',
    PHASE_NONE = 'NONE'
}

enum SMCStructure {
    BULLISH = 'BULLISH',
    BEARISH = 'BEARISH',
    CHOPPY = 'CHOPPY'
}

interface CustomSwing {
    index: number;
    price: number;
    type: 'HIGH' | 'LOW';
}

interface SwingPoint {
    index: number;
    price: number;
    type: 'HH' | 'LH' | 'LL' | 'HL';
}

interface OrderBlock {
    top: number;
    bottom: number;
    type: 'DEMAND' | 'SUPPLY';
    mitigated: boolean;
}

interface FVG {
    top: number;
    bottom: number;
    type: 'BULLISH' | 'BEARISH';
    mitigated: boolean;
    gapSize: number;
    entry50: number;
}

interface WolfBotSettings {
    enabled: boolean;
    symbol: string;
    lotSize: number;
    riskPercent: number;
    minRR: number;
    swingPeriods: number;
    breakevenPaddingPoints: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    useTrailingStop: boolean;
    usePartialClose: boolean;
    tradingStartHour: number;
    tradingEndHour: number;
}

interface WolfBotState {
    position: {
        ticket: number;
        type: 'BUY' | 'SELL';
        entryPrice: number;
        sl: number;
        tp: number;
        openTime: number;
    } | null;
    dailyProfit: number;
    dailyLoss: number;
}

interface WolfAnalysis {
    wyckoffPhase: WyckoffPhase;
    wyckoffSummary: string;
    smcStructure: SMCStructure;
    customSwings: CustomSwing[];
    swingPoints: SwingPoint[];
    hasCHoCH: 'BULLISH' | 'BEARISH' | null;
    hasBOS: 'BULLISH' | 'BEARISH' | null;
    liquiditySweep: 'BUY_SIDE' | 'SELL_SIDE' | null;
    orderBlocks: OrderBlock[];
    fvgZones: FVG[];
    oteZone: { low: number; high: number } | null;
    tradingRange: { upperSwing: number; lowerSwing: number; middle: number } | null;
    setup: {
        direction: 'LONG' | 'SHORT' | null;
        entry: number | null;
        sl: number | null;
        tp: number | null;
        tp1: number | null;
        tp2: number | null;
        lotTP1: number;
        lotTP2: number;
        confidence: 'A' | 'B' | 'C' | null;
        reason: string;
    };
}

interface TradeRecord {
    ticket: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    entry: number;
    exit: number;
    profit: number;
    result: 'WIN' | 'LOSS';
    reason: string;
    closeTime: number;
    openTime: number;
}

// ──────────────────────────────────────────────
// WolfBotEngine - Custom Swing + FVG
// ──────────────────────────────────────────────

export class WolfBotEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 7777;
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'wolf_bot_settings.json');
    private static TRADES_PATH = path.resolve(process.cwd(), 'wolf_bot_trades.json');

    private static settings: WolfBotSettings = {
        enabled: false,
        symbol: 'XAUUSD',
        lotSize: 0.01,
        riskPercent: 1.0,
        minRR: 3.0,
        swingPeriods: 10,
        breakevenPaddingPoints: 20,
        maxDailyLoss: 100,
        maxDailyProfit: 300,
        useTrailingStop: true,
        usePartialClose: true,
        tradingStartHour: 0,
        tradingEndHour: 23,
    };

    private static state: WolfBotState = {
        position: null,
        dailyProfit: 0,
        dailyLoss: 0,
    };

    private static isRunning = false;
    private static trades: TradeRecord[] = [];
    private static lastAnalysis: WolfAnalysis | null = null;
    private static operationLog: Array<{ time: string; action: string; details: string }> = [];
    private static lastTradeDate = '';
    private static pendingLimitOrders: Set<number> = new Set();

    private static addLog(action: string, details: string) {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.operationLog.push({ time, action, details });
        if (this.operationLog.length > 100) this.operationLog.shift();
        console.log(`[WolfBot] ${action}: ${details}`);
    }

    static async init() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadTrades();
        this.isRunning = true;
        this.addLog('INIT', 'Wolf Bot (Custom Swing + FVG) predador de liquidez');
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        this.saveTrades();
    }

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            lastAnalysis: this.lastAnalysis,
            trades: this.trades.slice(-20).reverse(),
            operationLog: this.operationLog.slice(-50),
            performance: this.computePerformance(),
            pendingOrders: [...this.pendingLimitOrders],
        };
    }

    static updateSettings(partial: Partial<WolfBotSettings>) {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
        this.addLog('SETTINGS', 'Configuracoes atualizadas');
    }

    static getHistory() {
        return this.trades.slice().reverse();
    }

    private static computePerformance() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.result === 'WIN').length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const totalProfit = this.trades.reduce((s, t) => s + t.profit, 0);
        return { totalTrades: total, wins, losses: total - wins, winRate, totalProfit };
    }

    // ──────────────────────────────────────────
    // Main Loop
    // ──────────────────────────────────────────

    private static async loop() {
        while (this.isRunning) {
            try {
                if (this.settings.enabled) {
                    await this.syncPosition();
                    await this.resetDailyIfNeeded();
                    const analysis = await this.analyzeMarket();
                    this.lastAnalysis = analysis;
                    if (!this.state.position) {
                        if (await this.checkSafety()) {
                            await this.evaluateEntry(analysis);
                        }
                    } else {
                        await this.managePosition();
                    }
                }
                const interval = this.state.position ? 5000 : 30000;
                await new Promise(r => setTimeout(r, interval));
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error('[WolfBot] Loop:', msg);
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }

    // ──────────────────────────────────────────
    // Analise: Custom Swing + FVG
    // ──────────────────────────────────────────

    private static async analyzeMarket(): Promise<WolfAnalysis> {
        const sym = this.settings.symbol;

        const p = this.settings.swingPeriods;
        const microP = Math.max(3, Math.ceil(p / 3));

        const [h1Bars, m15Bars, m5Bars] = await Promise.all([
            MarketDataService.getRecentBars(sym, 120, 'H1').catch(() => [] as PolygonBar[]),
            MarketDataService.getRecentBars(sym, 200, 'M15').catch(() => [] as PolygonBar[]),
            MarketDataService.getRecentBars(sym, 150, 'M5').catch(() => [] as PolygonBar[]),
        ]);

        const h1Swings = this.findCustomSwings(h1Bars, p);
        const m15Swings = this.findCustomSwings(m15Bars, microP);
        const m5Swings = this.findCustomSwings(m5Bars, microP);
        const swingPoints = this.findSwingPoints(m15Bars, 5);

        const tradingRange = this.findTradingRangeBySwings(h1Swings, h1Bars);
        const wyckoffPhase = this.detectWyckoffPhase(h1Bars, h1Swings, tradingRange);
        const wyckoffSummary = this.describeWyckoffPhase(wyckoffPhase);
        const smcStructure = this.classifySMCStructure(swingPoints);
        const hasCHoCH = this.detectCHoCH(m5Bars, m15Bars);
        const hasBOS = this.detectBOS(m5Bars);
        const liquiditySweep = this.detectLiquiditySweep(m15Bars);

        const orderBlocks = this.findOrderBlocks(m15Bars);
        const fvgZones = this.findFVGs(m15Bars);
        const oteZone = this.calculateOTEZone(m15Bars);

        const setup = this.evaluateSetup({
            wyckoffPhase, swingPoints, smcStructure, hasCHoCH, hasBOS,
            liquiditySweep, orderBlocks, fvgZones, oteZone, tradingRange,
            m5Bars, m15Bars,
        });

        return {
            wyckoffPhase,
            wyckoffSummary,
            smcStructure,
            customSwings: h1Swings.slice(-6),
            swingPoints: swingPoints.slice(-6),
            hasCHoCH,
            hasBOS,
            liquiditySweep,
            orderBlocks: orderBlocks.slice(-3),
            fvgZones: fvgZones.slice(-3),
            oteZone,
            tradingRange,
            setup,
        };
    }

    // ──────────────────────────────────────────
    // Custom Swing High/Low (InpSwingPeriods)
    // ──────────────────────────────────────────

    private static findCustomSwings(bars: PolygonBar[], period: number): CustomSwing[] {
        if (bars.length < period * 2 + 1) return [];
        const swings: CustomSwing[] = [];
        const totalWindow = period * 2 + 1;
        for (let i = period; i < bars.length - period; i++) {
            const center = i;
            const window = bars.slice(i - period, i + period + 1);

            // iHighest logic: find highest high in window
            let highestIdx = i - period;
            let highestVal = -Infinity;
            for (let j = 0; j < window.length; j++) {
                if (window[j].h > highestVal) {
                    highestVal = window[j].h;
                    highestIdx = i - period + j;
                }
            }
            if (highestIdx === center) {
                swings.push({ index: center, price: highestVal, type: 'HIGH' });
            }

            // iLowest logic: find lowest low in window
            let lowestIdx = i - period;
            let lowestVal = Infinity;
            for (let j = 0; j < window.length; j++) {
                if (window[j].l < lowestVal) {
                    lowestVal = window[j].l;
                    lowestIdx = i - period + j;
                }
            }
            if (lowestIdx === center) {
                swings.push({ index: center, price: lowestVal, type: 'LOW' });
            }
        }
        return swings;
    }

    // ──────────────────────────────────────────
    // Trading Range por Custom Swings
    // ──────────────────────────────────────────

    private static findTradingRangeBySwings(
        swings: CustomSwing[], bars: PolygonBar[]
    ): { upperSwing: number; lowerSwing: number; middle: number } | null {
        if (swings.length < 4 || bars.length < 30) return null;

        const recent = swings.slice(-8);
        const upper = recent.filter(s => s.type === 'HIGH').pop();
        const lower = recent.filter(s => s.type === 'LOW').pop();
        if (!upper || !lower) return null;

        const upperPrice = upper.price;
        const lowerPrice = lower.price;
        const middle = (upperPrice + lowerPrice) / 2;
        const rangeWidth = upperPrice - lowerPrice;

        if (rangeWidth <= 0) return null;

        const recentBars = bars.slice(-30);
        const touchesUpper = recentBars.filter(b => b.h >= upperPrice * 0.995).length;
        const touchesLower = recentBars.filter(b => b.l <= lowerPrice * 1.005).length;
        if (touchesUpper < 1 || touchesLower < 1) return null;

        return { upperSwing: upperPrice, lowerSwing: lowerPrice, middle };
    }

    // ──────────────────────────────────────────
    // Wyckoff Phase (Custom Swing + Rejeicao)
    // ──────────────────────────────────────────

    private static detectWyckoffPhase(
        h1Bars: PolygonBar[], swings: CustomSwing[], range: { upperSwing: number; lowerSwing: number; middle: number } | null
    ): WyckoffPhase {
        if (h1Bars.length < 30 || !range) return WyckoffPhase.PHASE_NONE;

        const closes = h1Bars.map(b => b.c);
        const highs = h1Bars.map(b => b.h);
        const lows = h1Bars.map(b => b.l);
        const current = closes[closes.length - 1];
        const lastCandle = h1Bars[h1Bars.length - 1];

        const atr = this.calcATR(h1Bars, 14);
        const uf = range.upperSwing;
        const lf = range.lowerSwing;

        if (lastCandle.l < lf && lastCandle.c > lf)
            return WyckoffPhase.ACCUMULATION_PHASE_C_SPRING;

        if (lastCandle.h > uf && lastCandle.c < uf)
            return WyckoffPhase.DISTRIBUTION_PHASE_C_UTAD;

        const bodyBull = lastCandle.c - lastCandle.o;
        if (bodyBull > atr * 0.6 && lastCandle.c > uf && lastCandle.h > uf)
            return WyckoffPhase.MARKUP_PHASE_D;

        const bodyBear = lastCandle.o - lastCandle.c;
        if (bodyBear > atr * 0.6 && lastCandle.c < lf && lastCandle.l < lf)
            return WyckoffPhase.MARKDOWN_PHASE_D;

        const pct = (current - lf) / (uf - lf + 0.01);

        if (pct < 0.3) {
            const l5 = closes.slice(-5);
            return l5[l5.length - 1] > l5[0]
                ? WyckoffPhase.ACCUMULATION_PHASE_A
                : WyckoffPhase.ACCUMULATION_PHASE_B;
        }

        if (pct > 0.7) {
            const l5 = closes.slice(-5);
            return l5[l5.length - 1] < l5[0]
                ? WyckoffPhase.DISTRIBUTION_PHASE_A
                : WyckoffPhase.DISTRIBUTION_PHASE_B;
        }

        if (current > uf + atr * 2) {
            const r = Math.max(...highs.slice(-10)) - Math.min(...lows.slice(-10));
            if (r < atr * 1.5) return WyckoffPhase.REACCUMULATION_PHASE_E;
        }

        if (current < lf - atr * 2) {
            const r = Math.max(...highs.slice(-10)) - Math.min(...lows.slice(-10));
            if (r < atr * 1.5) return WyckoffPhase.DISTRIBUTION_PHASE_E;
        }

        return WyckoffPhase.PHASE_NONE;
    }

    private static describeWyckoffPhase(phase: WyckoffPhase): string {
        const map: Record<WyckoffPhase, string> = {
            [WyckoffPhase.ACCUMULATION_PHASE_A]: 'Fase A: Acumulacao — preco no fundo do range fractal',
            [WyckoffPhase.ACCUMULATION_PHASE_B]: 'Fase B: Testes — preco oscila sem sair do range',
            [WyckoffPhase.ACCUMULATION_PHASE_C_SPRING]: 'Fase C: SPRING! Sweep liquidez baixista + rejeicao',
            [WyckoffPhase.MARKUP_PHASE_D]: 'Fase D: MARKUP! Rompeu fractal superior com forca',
            [WyckoffPhase.REACCUMULATION_PHASE_E]: 'Fase E: Reacumulacao apos markup',
            [WyckoffPhase.DISTRIBUTION_PHASE_A]: 'Fase A: Distribuicao — preco no topo do range fractal',
            [WyckoffPhase.DISTRIBUTION_PHASE_B]: 'Fase B: Testes — preco oscila sem sair do range',
            [WyckoffPhase.DISTRIBUTION_PHASE_C_UTAD]: 'Fase C: UTAD! Sweep liquidez compradora + rejeicao',
            [WyckoffPhase.MARKDOWN_PHASE_D]: 'Fase D: MARKDOWN! Rompeu fractal inferior com forca',
            [WyckoffPhase.DISTRIBUTION_PHASE_E]: 'Fase E: Distribuicao final apos markdown',
            [WyckoffPhase.PHASE_NONE]: 'Contexto indefinido — sem range fractal claro',
        };
        return map[phase];
    }

    // ──────────────────────────────────────────
    // SMC: Swing Points (fractal-like)
    // ──────────────────────────────────────────

    private static findSwingPoints(bars: PolygonBar[], lookback: number = 5): SwingPoint[] {
        if (bars.length < lookback * 2) return [];
        const points: SwingPoint[] = [];
        for (let i = lookback; i < bars.length - lookback; i++) {
            const mid = bars[i];
            const leftHigh = Math.max(...bars.slice(i - lookback, i).map(b => b.h));
            const rightHigh = Math.max(...bars.slice(i + 1, i + 1 + lookback).map(b => b.h));
            const leftLow = Math.min(...bars.slice(i - lookback, i).map(b => b.l));
            const rightLow = Math.min(...bars.slice(i + 1, i + 1 + lookback).map(b => b.l));
            if (mid.h > leftHigh && mid.h > rightHigh) {
                const prev = points.filter(p => p.type === 'HH' || p.type === 'LH').pop();
                points.push({ index: i, price: mid.h, type: (prev && mid.h > prev.price) ? 'HH' : 'LH' });
            }
            if (mid.l < leftLow && mid.l < rightLow) {
                const prev = points.filter(p => p.type === 'LL' || p.type === 'HL').pop();
                points.push({ index: i, price: mid.l, type: (prev && mid.l < prev.price) ? 'LL' : 'HL' });
            }
        }
        return points;
    }

    private static classifySMCStructure(swings: SwingPoint[]): SMCStructure {
        const recent = swings.slice(-6);
        if (recent.length < 3) return SMCStructure.CHOPPY;
        let bull = 0, bear = 0;
        for (let i = 1; i < recent.length; i++) {
            const p = recent[i - 1], c = recent[i];
            if ((p.type === 'LL' && c.type === 'HL') || (p.type === 'HL' && c.type === 'HH')) bull++;
            if ((p.type === 'HH' && c.type === 'LH') || (p.type === 'LH' && c.type === 'LL')) bear++;
        }
        if (bull > bear && bull >= 2) return SMCStructure.BULLISH;
        if (bear > bull && bear >= 2) return SMCStructure.BEARISH;
        return SMCStructure.CHOPPY;
    }

    // ──────────────────────────────────────────
    // CHoCH / BOS
    // ──────────────────────────────────────────

    private static detectCHoCH(m5Bars: PolygonBar[], m15Bars: PolygonBar[]): 'BULLISH' | 'BEARISH' | null {
        const bars = m5Bars.length >= 30 ? m5Bars : m15Bars;
        if (bars.length < 20) return null;
        const swings = this.findSwingPoints(bars, 3);
        const last3 = swings.slice(-3).map(s => s.type);
        if (last3.length < 3) return null;
        if ((last3[0] === 'LL' || last3[0] === 'LH') && last3[1] === 'HL' && last3[2] === 'HH') return 'BULLISH';
        if ((last3[0] === 'HH' || last3[0] === 'HL') && last3[1] === 'LH' && last3[2] === 'LL') return 'BEARISH';
        return null;
    }

    private static detectBOS(bars: PolygonBar[]): 'BULLISH' | 'BEARISH' | null {
        if (bars.length < 20) return null;
        const swings = this.findSwingPoints(bars, 3);
        const last2 = swings.slice(-2);
        if (last2.length < 2) return null;
        if (last2[0].type === 'HL' && last2[1].type === 'HH') return 'BULLISH';
        if (last2[0].type === 'LH' && last2[1].type === 'LL') return 'BEARISH';
        return null;
    }

    // ──────────────────────────────────────────
    // Liquidity Sweep via Fractais
    // ──────────────────────────────────────────

    private static detectLiquiditySweep(bars: PolygonBar[]): 'BUY_SIDE' | 'SELL_SIDE' | null {
        if (bars.length < 15) return null;

        const last = bars[bars.length - 1];
        const prev = bars.slice(-10, -1);
        const prevLow = Math.min(...prev.map(b => b.l));
        const prevHigh = Math.max(...prev.map(b => b.h));

        if (last.l < prevLow && last.c > prevLow) return 'SELL_SIDE';
        if (last.h > prevHigh && last.c < prevHigh) return 'BUY_SIDE';

        return null;
    }

    // ──────────────────────────────────────────
    // Order Blocks
    // ──────────────────────────────────────────

    private static findOrderBlocks(bars: PolygonBar[]): OrderBlock[] {
        const blocks: OrderBlock[] = [];
        if (bars.length < 5) return blocks;
        for (let i = 3; i < bars.length - 1; i++) {
            const c2 = bars[i - 1];
            const c3 = bars[i];
            if (c2.c < c2.o && c3.c > c3.o && c3.c > c2.h) {
                blocks.push({
                    top: Math.max(c2.o, c2.c), bottom: Math.min(c2.o, c2.c),
                    type: 'DEMAND', mitigated: false,
                });
            }
            if (c2.c > c2.o && c3.c < c3.o && c3.c < c2.l) {
                blocks.push({
                    top: Math.max(c2.o, c2.c), bottom: Math.min(c2.o, c2.c),
                    type: 'SUPPLY', mitigated: false,
                });
            }
        }
        const lc = bars[bars.length - 1]?.c ?? 0;
        for (const ob of blocks) {
            if (ob.type === 'DEMAND' && lc < ob.bottom) ob.mitigated = true;
            if (ob.type === 'SUPPLY' && lc > ob.top) ob.mitigated = true;
        }
        return blocks;
    }

    // ──────────────────────────────────────────
    // FVG - O Pulo do Gato
    // ──────────────────────────────────────────

    private static findFVGs(bars: PolygonBar[]): FVG[] {
        const fvgs: FVG[] = [];
        if (bars.length < 4) return fvgs;
        for (let i = 2; i < bars.length; i++) {
            const prev = bars[i - 2];
            const curr = bars[i];
            if (curr.l > prev.h) {
                const gap = curr.l - prev.h;
                fvgs.push({
                    top: curr.l, bottom: prev.h, type: 'BULLISH',
                    mitigated: false, gapSize: gap,
                    entry50: prev.h + gap / 2,
                });
            }
            if (curr.h < prev.l) {
                const gap = prev.l - curr.h;
                fvgs.push({
                    top: prev.l, bottom: curr.h, type: 'BEARISH',
                    mitigated: false, gapSize: gap,
                    entry50: prev.l - gap / 2,
                });
            }
        }
        const ll = bars[bars.length - 1]?.l ?? 0;
        const lh = bars[bars.length - 1]?.h ?? 0;
        for (const f of fvgs) {
            if (f.type === 'BULLISH' && ll <= f.bottom) f.mitigated = true;
            if (f.type === 'BEARISH' && lh >= f.top) f.mitigated = true;
        }
        return fvgs;
    }

    // ──────────────────────────────────────────
    // OTE Zone
    // ──────────────────────────────────────────

    private static calculateOTEZone(bars: PolygonBar[]): { low: number; high: number } | null {
        if (bars.length < 20) return null;
        const recent = bars.slice(-20);
        const h = Math.max(...recent.map(b => b.h));
        const l = Math.min(...recent.map(b => b.l));
        const r = h - l;
        if (r <= 0) return null;
        return { low: l + r * 0.62, high: l + r * 0.79 };
    }

    // ──────────────────────────────────────────
    // Setup Evaluation (Sinergia)
    // ──────────────────────────────────────────

    private static evaluateSetup(ctx: {
        wyckoffPhase: WyckoffPhase;
        swingPoints: SwingPoint[];
        smcStructure: SMCStructure;
        hasCHoCH: 'BULLISH' | 'BEARISH' | null;
        hasBOS: 'BULLISH' | 'BEARISH' | null;
        liquiditySweep: 'BUY_SIDE' | 'SELL_SIDE' | null;
        orderBlocks: OrderBlock[];
        fvgZones: FVG[];
        oteZone: { low: number; high: number } | null;
        tradingRange: { upperSwing: number; lowerSwing: number; middle: number } | null;
        m5Bars: PolygonBar[];
        m15Bars: PolygonBar[];
    }): WolfAnalysis['setup'] {
        const none = { direction: null, entry: null, sl: null, tp: null, tp1: null, tp2: null, lotTP1: 0, lotTP2: 0, confidence: null, reason: 'Nenhum setup encontrado' };

        const isBuy = ctx.wyckoffPhase === WyckoffPhase.ACCUMULATION_PHASE_C_SPRING
            && ctx.liquiditySweep === 'SELL_SIDE'
            && ctx.hasCHoCH === 'BULLISH';

        const isSell = ctx.wyckoffPhase === WyckoffPhase.DISTRIBUTION_PHASE_C_UTAD
            && ctx.liquiditySweep === 'BUY_SIDE'
            && ctx.hasCHoCH === 'BEARISH';

        if (!isBuy && !isSell) return none;

        if (isBuy) {
            const obs = ctx.orderBlocks.filter(o => o.type === 'DEMAND' && !o.mitigated);
            const fvgs = ctx.fvgZones.filter(f => f.type === 'BULLISH' && !f.mitigated);

            if (obs.length === 0 && fvgs.length === 0)
                return { ...none, reason: 'Sem OB Demand ou FVG bullish disponivel' };

            const entry = obs.length > 0
                ? obs[obs.length - 1].bottom
                : fvgs[fvgs.length - 1].entry50;

            const bars = ctx.m15Bars;
            const atr = this.calcATR(bars, 14) || 1;
            const springLow = Math.min(...bars.slice(-10).map(b => b.l));
            const sl = springLow - atr * 0.5;
            if (sl >= entry) return { ...none, reason: 'SL acima da entrada' };

            const risk = entry - sl;
            const buyLiq = Math.max(...bars.slice(-20).map(b => b.h));
            const rangeHigh = ctx.tradingRange?.upperSwing ?? buyLiq;

            // TP1: Internal liquidity (opposite side of range) - 60% of position
            const tp1 = rangeHigh;
            // TP2: External liquidity (next HTF pool) - 40% of position
            const nextLiq = Math.max(buyLiq, rangeHigh) + risk * 0.5;
            const tpRaw = entry + risk * this.settings.minRR;
            const tp2 = Math.max(tpRaw, nextLiq);

            const rr1 = risk > 0 ? (tp1 - entry) / risk : 0;
            const rr2 = risk > 0 ? (tp2 - entry) / risk : 0;

            const totalLot = this.settings.lotSize;
            const lotTP1 = Math.round(totalLot * 0.6 * 100) / 100;
            const lotTP2 = Math.round(totalLot * 0.4 * 100) / 100;

            let conf: 'A' | 'B' | 'C';
            if (rr2 >= 4 && ctx.hasBOS === 'BULLISH') conf = 'A';
            else if (rr2 >= 3) conf = 'B';
            else conf = 'C';

            return {
                direction: 'LONG',
                entry: Math.round(entry * 100) / 100,
                sl: Math.round(sl * 100) / 100,
                tp: Math.round(tp2 * 100) / 100,
                tp1: Math.round(tp1 * 100) / 100,
                tp2: Math.round(tp2 * 100) / 100,
                lotTP1, lotTP2,
                confidence: conf,
                reason: `ScaleOut: TP1 ${tp1.toFixed(1)} (${lotTP1}) RR${rr1.toFixed(1)} | TP2 ${tp2.toFixed(1)} (${lotTP2}) RR${rr2.toFixed(1)}`,
            };
        }

        if (isSell) {
            const obs = ctx.orderBlocks.filter(o => o.type === 'SUPPLY' && !o.mitigated);
            const fvgs = ctx.fvgZones.filter(f => f.type === 'BEARISH' && !f.mitigated);

            if (obs.length === 0 && fvgs.length === 0)
                return { ...none, reason: 'Sem OB Supply ou FVG bearish disponivel' };

            const entry = obs.length > 0
                ? obs[obs.length - 1].top
                : fvgs[fvgs.length - 1].entry50;

            const bars = ctx.m15Bars;
            const atr = this.calcATR(bars, 14) || 1;
            const utadHigh = Math.max(...bars.slice(-10).map(b => b.h));
            const sl = utadHigh + atr * 0.5;
            if (sl <= entry) return { ...none, reason: 'SL abaixo da entrada' };

            const risk = sl - entry;
            const sellLiq = Math.min(...bars.slice(-20).map(b => b.l));
            const rangeLow = ctx.tradingRange?.lowerSwing ?? sellLiq;

            // TP1: Internal liquidity (opposite side of range) - 60%
            const tp1 = rangeLow;
            // TP2: External liquidity (next HTF pool) - 40%
            const nextLiq = Math.min(sellLiq, rangeLow) - risk * 0.5;
            const tpRaw = entry - risk * this.settings.minRR;
            const tp2 = Math.min(tpRaw, nextLiq);

            const rr1 = risk > 0 ? (entry - tp1) / risk : 0;
            const rr2 = risk > 0 ? (entry - tp2) / risk : 0;

            const totalLot = this.settings.lotSize;
            const lotTP1 = Math.round(totalLot * 0.6 * 100) / 100;
            const lotTP2 = Math.round(totalLot * 0.4 * 100) / 100;

            let conf: 'A' | 'B' | 'C';
            if (rr2 >= 4 && ctx.hasBOS === 'BEARISH') conf = 'A';
            else if (rr2 >= 3) conf = 'B';
            else conf = 'C';

            return {
                direction: 'SHORT',
                entry: Math.round(entry * 100) / 100,
                sl: Math.round(sl * 100) / 100,
                tp: Math.round(tp2 * 100) / 100,
                tp1: Math.round(tp1 * 100) / 100,
                tp2: Math.round(tp2 * 100) / 100,
                lotTP1, lotTP2,
                confidence: conf,
                reason: `ScaleOut: TP1 ${tp1.toFixed(1)} (${lotTP1}) RR${rr1.toFixed(1)} | TP2 ${tp2.toFixed(1)} (${lotTP2}) RR${rr2.toFixed(1)}`,
            };
        }

        return none;
    }

    // ──────────────────────────────────────────
    // Order Execution
    // ──────────────────────────────────────────

    private static async evaluateEntry(analysis: WolfAnalysis) {
        const s = analysis.setup;
        if (!s.direction || !s.entry || !s.sl || !s.tp || !s.confidence) return;

        const lock = SymbolLockService.isLocked(this.settings.symbol);
        if (lock.locked) { this.addLog('SKIP', `Bloqueado por ${lock.by}`); return; }

        const price = await this.getCurrentPrice();
        if (!price) return;

        const atr = this.calcATR(await this.getM15Bars(), 14) || 1;
        const ok = s.direction === 'LONG'
            ? price > s.entry && price < s.entry + atr * 2
            : price < s.entry && price > s.entry - atr * 2;

        if (!ok) { this.addLog('SKIP', `Preco ${price} fora da zona para ${s.entry}`); return; }

        await this.placeLimitOrder(s.direction === 'LONG' ? 'BUY' : 'SELL', s.entry, s.sl, s.tp, s.confidence, s.reason);
    }

    private static scaleOutTickets: Map<number, { pairTicket: number; isTP1: boolean }> = new Map();

    private static async placeLimitOrder(type: string, entry: number, sl: number, tp: number, conf: string, reason: string) {
        const setup = this.lastAnalysis?.setup;
        if (!setup || !setup.tp1 || !setup.tp2) return;

        try {
            const acc = await this.getAccountInfo();
            const balance = acc.balance || 10000;
            const riskAmt = balance * (this.settings.riskPercent / 100);
            const riskPts = Math.abs(entry - sl);
            const tv = await this.getTickValue(this.settings.symbol);
            const totalLot = riskPts > 0 && tv > 0
                ? Math.max(0.01, Math.min(riskAmt / (riskPts * tv), 10))
                : this.settings.lotSize;
            const lot1 = Math.max(0.01, Math.round(totalLot * 0.6 * 100) / 100);
            const lot2 = Math.max(0.01, Math.round(totalLot * 0.4 * 100) / 100);
            if (lot1 + lot2 <= 0) return;

            const orderBody = (lot: number, tpPrice: number, label: string) => ({
                symbol: this.settings.symbol,
                action: type,
                type: 1,
                lot,
                price: entry,
                sl, tp: tpPrice,
                magic: this.MAGIC,
                comment: `Wolf${conf}${label}`,
            });

            const [r1, r2] = await Promise.allSettled([
                axios.post(`${this.BRIDGE_URL}/order`, orderBody(lot1, setup.tp1!, 'S1')),
                axios.post(`${this.BRIDGE_URL}/order`, orderBody(lot2, setup.tp2!, 'S2')),
            ]);

            const tickets: number[] = [];
            if (r1.status === 'fulfilled' && r1.value.data?.ticket) tickets.push(r1.value.data.ticket);
            if (r2.status === 'fulfilled' && r2.value.data?.ticket) tickets.push(r2.value.data.ticket);

            if (tickets.length > 0) {
                // Link the two tickets so we know they form a scale-out pair
                if (tickets.length === 2) {
                    this.scaleOutTickets.set(tickets[0], { pairTicket: tickets[1], isTP1: true });
                    this.scaleOutTickets.set(tickets[1], { pairTicket: tickets[0], isTP1: false });
                }
                for (const t of tickets) this.pendingLimitOrders.add(t);
                SymbolLockService.acquire(this.settings.symbol, 'Wolf Bot', tickets[0], type);
                this.addLog('ORDER', `${type} ScaleOut x2: ${lot1}@${setup.tp1} + ${lot2}@${setup.tp2}`);
                TradeNotificationBot.notifyTradeOpened('Wolf Bot', this.settings.symbol, type, lot1 + lot2, entry, sl, tp);
            }
        } catch (e) {
            this.addLog('ERROR', `Falha ordem: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // ──────────────────────────────────────────
    // Position Management
    // ──────────────────────────────────────────

    private static tp1HitSet: Set<number> = new Set();

    private static async managePosition() {
        if (!this.state.position) return;
        const pos = this.state.position;
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const list: any[] = resp.data || [];

            // Check if the primary ticket still exists
            const mt5 = list.find((p: any) => p.ticket === pos.ticket);
            if (!mt5) {
                if (!this.trades.some(t => t.ticket === pos.ticket)) {
                    this.addLog('CLOSE', `Pos ${pos.ticket} fechada`);
                    await this.recordTrade(pos, 0, 'LOSS', 'Fechamento externo');
                }
                this.state.position = null;
                return;
            }

            // ── Scale-out: detect if TP1 hit → move pair's SL to breakeven ──
            const scaleInfo = this.scaleOutTickets.get(pos.ticket);
            if (scaleInfo) {
                const pairTicket = scaleInfo.pairTicket;
                const isTP1Order = scaleInfo.isTP1;

                // Check if this ticket's order has been closed (TP1 hit)
                if (isTP1Order && !list.find((p: any) => p.ticket === pos.ticket)) {
                    // TP1 order closed → move pair's SL to Break Even + Custos
                    if (!this.tp1HitSet.has(pairTicket)) {
                        this.tp1HitSet.add(pairTicket);
                        const pairPos = list.find((p: any) => p.ticket === pairTicket);
                        if (pairPos) {
                            const point = await this.getPointSize();
                            const padding = this.settings.breakevenPaddingPoints * point;
                            let beSL = pos.entryPrice;
                            if (pos.type === 'BUY') beSL = pos.entryPrice + padding;
                            else beSL = pos.entryPrice - padding;
                            axios.post(`${this.BRIDGE_URL}/order`, {
                                ticket: pairTicket, action: 'SL', sl: Math.round(beSL * 100) / 100,
                            }).catch(() => {});
                            this.addLog('BE+CUSTOS', `TP1 hit! SL para ${beSL.toFixed(1)} (entry ${pos.entryPrice.toFixed(1)} + ${padding.toFixed(2)} pts) no ticket ${pairTicket}`);
                        }
                    }
                }
            }

            // ── Trailing stop on remaining position ──
            if (this.settings.useTrailingStop) {
                const bars = await this.getM15Bars();
                const atr = this.calcATR(bars, 14);
                if (atr > 0) {
                    const cur = mt5.price_current || 0;
                    if (pos.type === 'BUY' && cur > pos.entryPrice + atr * 2) {
                        const ns = cur - atr * 1.5;
                        if (ns > pos.sl) {
                            axios.post(`${this.BRIDGE_URL}/order`, { ticket: pos.ticket, action: 'SL', sl: Math.round(ns * 100) / 100 }).catch(() => {});
                            pos.sl = ns;
                            this.addLog('TRAIL', `SL para ${ns.toFixed(1)}`);
                        }
                    }
                    if (pos.type === 'SELL' && cur < pos.entryPrice - atr * 2) {
                        const ns = cur + atr * 1.5;
                        if (ns < pos.sl) {
                            axios.post(`${this.BRIDGE_URL}/order`, { ticket: pos.ticket, action: 'SL', sl: Math.round(ns * 100) / 100 }).catch(() => {});
                            pos.sl = ns;
                            this.addLog('TRAIL', `SL para ${ns.toFixed(1)}`);
                        }
                    }
                }
            }
        } catch {}
    }

    private static async recordTrade(pos: { ticket: number; type: string; entryPrice: number; openTime: number }, exit: number, result: 'WIN' | 'LOSS', reason: string) {
        const pnl = result === 'WIN' ? Math.abs(exit - pos.entryPrice) : -Math.abs(exit - pos.entryPrice);
        this.trades.push({
            ticket: pos.ticket, symbol: this.settings.symbol, type: pos.type as 'BUY' | 'SELL',
            entry: pos.entryPrice, exit, profit: pnl, result, reason,
            closeTime: Date.now(), openTime: pos.openTime,
        });
        this.saveTrades();
        if (result === 'WIN') this.state.dailyProfit += pnl;
        else this.state.dailyLoss += Math.abs(pnl);
        TradeNotificationBot.notifyTradeClosed('Wolf Bot', this.settings.symbol, pos.type, pnl, result, reason, this.settings.lotSize);
    }

    // ──────────────────────────────────────────
    // Sync & Safety
    // ──────────────────────────────────────────

    private static async syncPosition() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const list: any[] = resp.data || [];
            const wp = list.find((p: any) => p.magic === this.MAGIC);
            if (wp) {
                this.state.position = {
                    ticket: wp.ticket, type: wp.type === 0 ? 'BUY' : 'SELL',
                    entryPrice: wp.price_open, sl: wp.sl, tp: wp.tp, openTime: Date.now(),
                };
            } else {
                if (this.state.position && !this.trades.some(t => t.ticket === this.state.position!.ticket)) {
                    try {
                        const hr = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 5000 });
                        const hist: any[] = hr.data || [];
                        const closed = hist.find((h: any) => h.ticket === this.state.position!.ticket);
                        if (closed) {
                            const r = (closed.profit || 0) >= 0 ? 'WIN' : 'LOSS';
                            await this.recordTrade(this.state.position, closed.price_close || 0, r, closed.comment || 'SL/TP');
                        }
                    } catch {}
                }
                this.state.position = null;
            }
        } catch {}
    }

    private static async checkSafety(): Promise<boolean> {
        try {
            const d = await DisciplineEngine.getDailyStatus();
            if (d.isLocked) return false;
        } catch {}
        const h = new Date().getUTCHours();
        return h >= this.settings.tradingStartHour && h <= this.settings.tradingEndHour;
    }

    private static async resetDailyIfNeeded() {
        const t = new Date().toISOString().split('T')[0];
        if (this.lastTradeDate !== t) {
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            this.lastTradeDate = t;
        }
    }

    // ──────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────

    private static async getCurrentPrice(): Promise<number | null> {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 3000 });
            if (r.data?.price) return r.data.price;
        } catch {}
        try { const b = await this.getM15Bars(); return b[b.length - 1]?.c ?? null; } catch { return null; }
    }

    private static async getM15Bars(): Promise<PolygonBar[]> {
        return MarketDataService.getRecentBars(this.settings.symbol, 100, 'M15') as Promise<PolygonBar[]>;
    }

    private static async getAccountInfo(): Promise<{ balance: number }> {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 3000 });
            return { balance: r.data?.balance || 0 };
        } catch { return { balance: 10000 }; }
    }

    private static async getTickValue(symbol: string): Promise<number> {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/symbol-info?symbol=${symbol}`, { timeout: 3000 });
            return r.data?.trade_tick_value || 0.01;
        } catch { return 0.01; }
    }

    private static pointCache = 0;
    private static async getPointSize(): Promise<number> {
        if (this.pointCache > 0) return this.pointCache;
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/symbol-info?symbol=${this.settings.symbol}`, { timeout: 3000 });
            this.pointCache = r.data?.point || 0.00001;
            return this.pointCache;
        } catch { return 0.0001; }
    }

    private static calcATR(bars: PolygonBar[], period: number = 14): number {
        if (bars.length < period + 1) return 0;
        let sum = 0;
        for (let i = bars.length - period; i < bars.length; i++) {
            const b = bars[i];
            const p = bars[i - 1];
            sum += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
        }
        return sum / period;
    }

    // ──────────────────────────────────────────
    // Persistence
    // ──────────────────────────────────────────

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try { this.settings = { ...this.settings, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) }; } catch {}
        }
    }
    private static saveSettings() {
        try { fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2)); } catch {}
    }
    private static loadTrades() {
        if (fs.existsSync(this.TRADES_PATH)) {
            try { this.trades = JSON.parse(fs.readFileSync(this.TRADES_PATH, 'utf-8')); } catch {}
        }
    }
    private static saveTrades() {
        try { fs.writeFileSync(this.TRADES_PATH, JSON.stringify(this.trades, null, 2)); } catch {}
    }
}
