import axios from 'axios';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';
import { DisciplineEngine } from './DisciplineEngine';

interface AuraQuantSettings {
    enabled: boolean;
    symbol: string;
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    maxSpread: number;
    riskPercent: number;
}

interface AuraQuantState {
    lastBarTime: number;
    position: {
        ticket: number;
        type: 'BUY' | 'SELL';
        price: number;
        sl: number;
        tp: number;
        time: number;
        comment: string;
        partialHit: boolean;
    } | null;
    dailyProfit: number;
    dailyLoss: number;
}

interface TradeRecord {
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    direction: 'BUY' | 'SELL';
    result: 'WIN' | 'LOSS';
    profit: number;
    partialClose: boolean;
}

interface M15Analysis {
    price: number;
    ema21: number;
    ema50: number;
    stochK: number;
    stochD: number;
    prevStochK: number;
    atr: number;
    atrMA20: number;
    trend: number;
    adx: number;
    signal: 'BUY' | 'SELL' | null;
    entryScore: number;
    altSignal: 'BUY' | 'SELL' | null;
    altScore: number;
    dxyBias: number;
    calendarBlock: boolean;
    calendarReason: string;
}

export class AuraQuantEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 1447597644;

    private static settings: AuraQuantSettings = {
        enabled: false,
        symbol: 'XAUUSD',
        lotSize: 0.01,
        maxDailyLoss: 50,
        maxDailyProfit: 100,
        maxSpread: 50,
        riskPercent: 1,
    };

    private static state: AuraQuantState = {
        lastBarTime: 0,
        position: null,
        dailyProfit: 0,
        dailyLoss: 0,
    };

    private static isRunning = false;
    private static lastAnalysis: M15Analysis | null = null;
    private static trades: TradeRecord[] = [];
    private static marginOk = true;
    private static lastMarginCheck = 0;
    private static operationLog: { time: string; action: string; details: string }[] = [];
    private static cachedCalendar: any[] | null = null;
    private static lastCalendarFetch = 0;
    private static dxyBiasCached: number = 0;
    private static dxyBiasTime = 0;
    private static dxyPriceCached: number = 0;

    private static log(action: string, details: string) {
        const entry = { time: new Date().toLocaleTimeString('pt-BR', { hour12: false }), action, details };
        this.operationLog.push(entry);
        if (this.operationLog.length > 100) this.operationLog.shift();
        console.log(`AuraQuant | ${action} | ${details}`);
    }

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            isRunning: this.isRunning,
            lastAnalysis: this.lastAnalysis,
            marginOk: this.marginOk,
            stats: this.computeStats(),
            trades: this.trades.slice(-20).reverse(),
            operationLog: this.operationLog.slice(-50),
        };
    }

    private static computeStats() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.result === 'WIN');
        const losses = this.trades.filter(t => t.result === 'LOSS');
        const winCount = wins.length;
        const lossCount = losses.length;
        const winRate = total > 0 ? (winCount / total) * 100 : 0;
        const totalProfit = this.trades.reduce((s, t) => s + t.profit, 0);
        const avgWin = winCount > 0 ? wins.reduce((s, t) => s + t.profit, 0) / winCount : 0;
        const avgLoss = lossCount > 0 ? losses.reduce((s, t) => s + Math.abs(t.profit), 0) / lossCount : 0;
        const profitFactor = avgLoss > 0 ? (winCount * avgWin) / (lossCount * avgLoss) : winCount > 0 ? Infinity : 0;

        let maxConsecutiveWins = 0, maxConsecutiveLosses = 0;
        let curWins = 0, curLosses = 0;
        for (const t of this.trades) {
            if (t.result === 'WIN') { curWins++; curLosses = 0; maxConsecutiveWins = Math.max(maxConsecutiveWins, curWins); }
            else { curLosses++; curWins = 0; maxConsecutiveLosses = Math.max(maxConsecutiveLosses, curLosses); }
        }

        const bestTrade = this.trades.length > 0 ? Math.max(...this.trades.map(t => t.profit)) : 0;
        const worstTrade = this.trades.length > 0 ? Math.min(...this.trades.map(t => t.profit)) : 0;

        return {
            totalTrades: total, winCount, lossCount, winRate: Math.round(winRate * 100) / 100,
            totalProfit: Math.round(totalProfit * 100) / 100,
            avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
            profitFactor: Math.round(profitFactor * 100) / 100,
            maxConsecutiveWins, maxConsecutiveLosses,
            bestTrade: Math.round(bestTrade * 100) / 100, worstTrade: Math.round(worstTrade * 100) / 100,
        };
    }

    static updateSettings(partial: Partial<AuraQuantSettings>) {
        this.settings = { ...this.settings, ...partial };
        this.log('CONFIG', `Config atualizada: ${JSON.stringify(partial)}`);
    }

    static async init() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.log('INIT', 'Aura Quant — Pullback + Stoch(14,3,3) + ADX + H4 Trend + Calendário + DXY');
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        this.log('STOP', 'Aura Quant parado.');
    }

    private static async checkMargin(): Promise<boolean> {
        if (Date.now() - this.lastMarginCheck < 60000) return this.marginOk;
        this.lastMarginCheck = Date.now();
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/account`);
            const free = parseFloat(resp.data?.margin_free || '0');
            const balance = parseFloat(resp.data?.balance || '0');
            this.marginOk = free > balance * 0.1;
            return this.marginOk;
        } catch {
            this.marginOk = false;
            return false;
        }
    }

    private static async loop() {
        while (this.isRunning) {
            try {
                await this.syncPosition();
                await this.resetDailyIfNeeded();
                this.lastAnalysis = await this.analyzeM15();
                if (this.settings.enabled) {
                    await this.checkMargin();
                    if (this.lastAnalysis) {
                        // Verifica disciplina global
                        const discipline = await DisciplineEngine.getDailyStatus();
                        if (discipline.isLocked) {
                            console.log(`AuraQuant: Safety Lock — ${discipline.reason}`);
                            continue;
                        }
                        if (this.state.position) {
                            await this.managePosition(this.lastAnalysis);
                        } else {
                            const limitLost = this.state.dailyLoss >= this.settings.maxDailyLoss;
                            const limitGain = this.state.dailyProfit >= this.settings.maxDailyProfit;
                            if (!limitLost && !limitGain && this.marginOk) {
                                await this.evaluateEntry(this.lastAnalysis);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('AuraQuant: Loop error', error);
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    private static async getBars(n: number = 100): Promise<any[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&count=${n}&timeframe=M15`, { timeout: 5000 });
            const data = resp.data;
            if (Array.isArray(data) && data.length > 0) {
                return data.map((b: any) => ({
                    o: b.open, h: b.high, l: b.low, c: b.close, v: b.tick_volume || b.volume || 100, t: b.time * 1000
                }));
            }
            return [];
        } catch {
            return [];
        }
    }

    private static async getH1Bars(n: number = 250): Promise<any[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&count=${n}&timeframe=H1`, { timeout: 5000 });
            const data = resp.data;
            if (Array.isArray(data) && data.length > 0) {
                return data.map((b: any) => ({
                    o: b.open, h: b.high, l: b.low, c: b.close, v: b.tick_volume || b.volume || 100, t: b.time * 1000
                }));
            }
            return [];
        } catch {
            return [];
        }
    }

    private static async getH4Bars(n: number = 500): Promise<any[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&count=${n}&timeframe=H4`, { timeout: 5000 });
            const data = resp.data;
            if (Array.isArray(data) && data.length > 0) {
                return data.map((b: any) => ({
                    o: b.open, h: b.high, l: b.low, c: b.close, v: b.tick_volume || b.volume || 100, t: b.time * 1000
                }));
            }
            return [];
        } catch {
            return [];
        }
    }

    private static async filterMarket(): Promise<{ allowed: boolean; reason: string }> {
        try {
            const tick = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] });
            const t = tick.data?.[this.settings.symbol] || tick.data;
            if (t?.ask && t?.bid) {
                const spread = (t.ask - t.bid) * 100000;
                if (spread > this.settings.maxSpread) return { allowed: false, reason: `Spread alto: ${spread.toFixed(0)}` };
            }
            return { allowed: true, reason: 'OK' };
        } catch {
            return { allowed: true, reason: 'OK' };
        }
    }

    private static async checkEconomicCalendar(): Promise<{ block: boolean; reason: string }> {
        try {
            if (Date.now() - this.lastCalendarFetch > 300000) {
                const resp = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 8000 });
                this.cachedCalendar = Array.isArray(resp.data) ? resp.data : [];
                this.lastCalendarFetch = Date.now();
            }
            const now = Date.now() / 1000;
            const event = this.cachedCalendar?.find((e: any) => {
                const et = typeof e.date === 'number' ? e.date : new Date(e.date).getTime() / 1000;
                return Math.abs(now - et) < 3600 && e.impact === 'High' && e.country === 'USD' && e.title;
            });
            if (event) return { block: true, reason: `Notícia: ${event.title || event.event} (${event.impact})` };
            return { block: false, reason: 'OK' };
        } catch { return { block: false, reason: 'OK' }; }
    }

    private static async getDXYBias(): Promise<{ bias: number; price: number }> {
        if (Date.now() - this.dxyBiasTime < 300000 && this.dxyBiasTime > 0) {
            return { bias: this.dxyBiasCached, price: this.dxyPriceCached };
        }
        try {
            let dxyPrice: number | null = null;
            let dxyCloses: number[] = [];
            try {
                const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=USDX&count=60&timeframe=D1`, { timeout: 5000 });
                const data = resp.data;
                if (Array.isArray(data) && data.length > 10) {
                    dxyPrice = data[data.length - 1].close;
                    dxyCloses = data.map((b: any) => b.close);
                }
            } catch {}
            if (!dxyPrice) {
                try {
                    const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=USDOLLAR&count=60&timeframe=D1`, { timeout: 5000 });
                    const data = resp.data;
                    if (Array.isArray(data) && data.length > 10) {
                        dxyPrice = data[data.length - 1].close;
                        dxyCloses = data.map((b: any) => b.close);
                    }
                } catch {}
            }
            if (!dxyPrice) {
                try {
                    const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=DX&count=60&timeframe=D1`, { timeout: 5000 });
                    const data = resp.data;
                    if (Array.isArray(data) && data.length > 10) {
                        dxyPrice = data[data.length - 1].close;
                        dxyCloses = data.map((b: any) => b.close);
                    }
                } catch {}
            }
            if (!dxyPrice) {
                const key = process.env.FMP_API_KEY;
                if (key) {
                    try {
                        const resp = await axios.get(`https://financialmodelingprep.com/api/v3/quote/DX-Y.NYB?apikey=${key}`, { timeout: 5000 });
                        dxyPrice = resp.data?.[0]?.price || null;
                    } catch {}
                }
            }
            if (!dxyPrice) return { bias: 0, price: 0 };
            if (dxyCloses.length < 50) dxyCloses = Array(60).fill(dxyPrice);
            const ema50 = this.calcEMA(dxyCloses, 50);
            let bias = 0;
            if (dxyPrice > ema50 * 1.002) bias = -1;
            else if (dxyPrice < ema50 * 0.998) bias = 1;
            this.dxyBiasCached = bias;
            this.dxyPriceCached = dxyPrice;
            this.dxyBiasTime = Date.now();
            return { bias, price: dxyPrice };
        } catch { return { bias: 0, price: 0 }; }
    }

    private static calcEMA(values: number[], period: number): number {
        if (values.length < period) return values[values.length - 1];
        const k = 2 / (period + 1);
        let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private static calcStoch(high: number[], low: number[], close: number[], kPeriod: number, dPeriod: number, smooth: number): { k: number; d: number } {
        if (close.length < kPeriod + 1) return { k: 50, d: 50 };
        const kValues: number[] = [];
        for (let i = kPeriod; i < close.length; i++) {
            const hh = Math.max(...high.slice(i - kPeriod, i + 1));
            const ll = Math.min(...low.slice(i - kPeriod, i + 1));
            const range = hh - ll;
            kValues.push(range > 0 ? ((close[i] - ll) / range) * 100 : 50);
        }
        if (kValues.length < dPeriod) return { k: kValues[kValues.length - 1] || 50, d: 50 };
        const dValue = kValues.slice(-dPeriod).reduce((s, v) => s + v, 0) / dPeriod;
        const k = kValues[kValues.length - 1];
        return { k, d: dValue };
    }

    private static calcATR(high: number[], low: number[], close: number[], period: number): number {
        if (high.length < 2) return 0;
        const trs: number[] = [];
        for (let i = 1; i < high.length; i++) {
            const hl = high[i] - low[i];
            const hc = Math.abs(high[i] - close[i - 1]);
            const lc = Math.abs(low[i] - close[i - 1]);
            trs.push(Math.max(hl, hc, lc));
        }
        if (trs.length < period) return trs.reduce((s, v) => s + v, 0) / trs.length;
        let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
        for (let i = period; i < trs.length; i++) {
            atr = (atr * (period - 1) + trs[i]) / period;
        }
        return atr;
    }

    private static calcADX(high: number[], low: number[], close: number[], period: number): number {
        if (close.length < period + 2) return 0;
        const tr: number[] = [0];
        const plusDM: number[] = [0];
        const minusDM: number[] = [0];
        for (let i = 1; i < close.length; i++) {
            const hl = high[i] - low[i];
            const hc = Math.abs(high[i] - close[i - 1]);
            const lc = Math.abs(low[i] - close[i - 1]);
            tr.push(Math.max(hl, hc, lc));
            const upMove = high[i] - high[i - 1];
            const downMove = low[i - 1] - low[i];
            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        }
        const smoothWilder = (values: number[], p: number): number[] => {
            const result: number[] = [values[0]];
            for (let i = 1; i < values.length; i++) {
                result.push(result[i - 1] - (result[i - 1] / p) + values[i]);
            }
            return result;
        };
        const smoothTR = smoothWilder(tr, period);
        const smoothPlusDM = smoothWilder(plusDM, period);
        const smoothMinusDM = smoothWilder(minusDM, period);
        const plusDI = smoothTR.map((t, i) => t > 0 ? 100 * smoothPlusDM[i] / t : 0);
        const minusDI = smoothTR.map((t, i) => t > 0 ? 100 * smoothMinusDM[i] / t : 0);
        const dx: number[] = [];
        for (let i = 0; i < plusDI.length; i++) {
            const sum = plusDI[i] + minusDI[i];
            dx.push(sum > 0 ? 100 * Math.abs(plusDI[i] - minusDI[i]) / sum : 0);
        }
        if (dx.length < period) return dx[dx.length - 1] || 0;
        return dx.slice(-period).reduce((s, v) => s + v, 0) / period;
    }

    private static async getTrend(): Promise<number> {
        try {
            let bars = await this.getH4Bars(500);
            if (bars.length < 200) {
                bars = await this.getH1Bars(250);
            }
            if (bars.length < 200) return 0;
            const close = bars.map(b => b.c);
            const ema200Val = this.calcEMA(close, 200);
            const lastClose = close[close.length - 1];
            return lastClose > ema200Val ? 1 : -1;
        } catch {
            return 0;
        }
    }

    private static async analyzeM15(): Promise<M15Analysis | null> {
        try {
            const bars = await this.getBars(100);
            if (bars.length < 40) return null;

            const close = bars.map(b => b.c);
            const high = bars.map(b => b.h);
            const low = bars.map(b => b.l);

            const ema21 = this.calcEMA(close, 21);
            const ema50 = this.calcEMA(close, 50);
            const stoch = this.calcStoch(high, low, close, 14, 3, 3);
            const atrSeries: number[] = [];
            for (let i = 14; i < close.length; i++) {
                atrSeries.push(this.calcATR(high.slice(0, i + 1), low.slice(0, i + 1), close.slice(0, i + 1), 14));
            }
            const atr = atrSeries[atrSeries.length - 1] || 0;
            const atrMA20 = atrSeries.length > 20 ? atrSeries.slice(-20).reduce((s, v) => s + v, 0) / 20 : atr;
            const adx = this.calcADX(high, low, close, 14);
            const trend = await this.getTrend();
            const price = close[close.length - 1];

            let signal: 'BUY' | 'SELL' | null = null;
            let score = 0;
            let altSignal: 'BUY' | 'SELL' | null = null;
            let altScore = 0;

            const distanceToEma21 = ((price - ema21) / ema21) * 100;
            const nearEma21 = distanceToEma21 > -2.0 && distanceToEma21 < 2.0;
            const prevStochK = stoch.k;

            // Primary: pullback + Stoch extreme + Stoch crossover
            if (trend === 1 && nearEma21 && stoch.k < 25 && stoch.k > stoch.d) {
                signal = 'BUY';
                const pullbackQual = Math.max(0, 30 - Math.abs(distanceToEma21) * 10);
                const stochQual = Math.max(0, 25 - stoch.k);
                score = Math.round(pullbackQual + stochQual + (adx > 20 ? 20 : 0) + 15);
            } else if (trend === -1 && nearEma21 && stoch.k > 75 && stoch.k < stoch.d) {
                signal = 'SELL';
                const pullbackQual = Math.max(0, 30 - Math.abs(distanceToEma21) * 10);
                const stochQual = Math.max(0, stoch.k - 75);
                score = Math.round(pullbackQual + stochQual + (adx > 20 ? 20 : 0) + 15);
            }

            // Alternative: ADX > 25 + EMA21/50 cross aligned + near EMA21
            if (!signal && trend !== 0 && adx > 25 && nearEma21) {
                const emaCross = price > ema50 ? 1 : -1;
                if (emaCross === trend) {
                    altSignal = trend === 1 ? 'BUY' : 'SELL';
                    const pullbackQual = Math.max(0, 25 - Math.abs(distanceToEma21) * 8);
                    const adxQual = Math.min(20, (adx - 25) * 2);
                    altScore = Math.round(pullbackQual + adxQual + 10);
                }
            }

            const dxyInfo = await this.getDXYBias();
            const calInfo = await this.checkEconomicCalendar();

            return {
                price, ema21, ema50, stochK: stoch.k, stochD: stoch.d, prevStochK,
                atr, atrMA20, trend, adx,
                signal, entryScore: score,
                altSignal, altScore,
                dxyBias: dxyInfo.bias,
                calendarBlock: calInfo.block,
                calendarReason: calInfo.reason,
            };
        } catch {
            return null;
        }
    }

    private static async getCurrentPrice(): Promise<number | null> {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] });
            const data = resp.data || {};
            const tick = data[this.settings.symbol] || data;
            return tick?.ask || tick?.bid || tick?.last || null;
        } catch { return null; }
    }

    private static async calculateDynamicLot(slPoints: number): Promise<number> {
        try {
            const ar = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 });
            const balance = ar.data?.balance || 1000;
            const riskAmount = balance * (this.settings.riskPercent / 100);
            if (slPoints > 0) {
                let lot = riskAmount / (slPoints * 1);
                const step = 0.01;
                lot = Math.round(lot / step) * step;
                return Math.max(0.01, Math.min(lot, 50));
            }
        } catch {}
        return this.settings.lotSize;
    }

    private static async evaluateEntry(analysis: M15Analysis) {
        if (analysis.calendarBlock) {
            this.log('FILTER', `Calendário bloqueado: ${analysis.calendarReason}`);
            return;
        }

        if (!analysis.signal && !analysis.altSignal) return;
        if (analysis.signal && analysis.entryScore < 30) return;
        if (analysis.altSignal && analysis.altScore < 25) return;

        if (analysis.adx < 20) {
            this.log('FILTER', `ADX ${analysis.adx.toFixed(1)} < 20 — pulando`);
            return;
        }
        if (analysis.atr < analysis.atrMA20) {
            this.log('FILTER', `ATR ${analysis.atr.toFixed(2)} < média ${analysis.atrMA20.toFixed(2)} — volatilidade baixa`);
            return;
        }

        const marketCheck = await this.filterMarket();
        if (!marketCheck.allowed) {
            this.log('FILTER', `Mercado bloqueado: ${marketCheck.reason}`);
            return;
        }

        const action = analysis.signal || analysis.altSignal;
        if (!action) return;
        let finalScore = analysis.signal ? analysis.entryScore : analysis.altScore;
        const isAlt = !analysis.signal;

        // Apply DXY bias: reduce score if DXY opposes trade direction
        if (analysis.dxyBias !== 0) {
            const dxyConflict = (action === 'BUY' && analysis.dxyBias < 0) || (action === 'SELL' && analysis.dxyBias > 0);
            if (dxyConflict) {
                finalScore = Math.round(finalScore * 0.7);
                this.log('DXY', `Viés DXY contrário (bias=${analysis.dxyBias}), score ajustado para ${finalScore}`);
            } else {
                finalScore = Math.round(finalScore * 1.1);
                this.log('DXY', `Viés DXY favorável (bias=${analysis.dxyBias}), score ajustado para ${finalScore}`);
            }
        }

        if (finalScore < 25) {
            this.log('FILTER', `Score final ${finalScore} < 25, pulando`);
            return;
        }

        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) return;

        const atr = analysis.atr;
        const slPoints = atr * 1.5;
        const tp1Points = atr * 2.0;

        const lot = await this.calculateDynamicLot(slPoints * 10000);

        this.log('ENTRY', `${action} Score:${finalScore}${isAlt ? ' (ALT)' : ''} ADX:${analysis.adx.toFixed(1)} ATR:${atr.toFixed(2)} DXY:${analysis.dxyBias} Lote:${lot}`);

        const entryPrice = currentPrice;
        const sl = action === 'BUY' ? entryPrice - slPoints : entryPrice + slPoints;
        const tp1 = action === 'BUY' ? entryPrice + tp1Points : entryPrice - tp1Points;

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: this.settings.symbol, action, lot,
                sl: Number(sl.toFixed(2)), tp: Number(tp1.toFixed(2)),
                magic: this.MAGIC, comment: 'AuraTP1',
            });

            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (ticket) {
                SymbolLockService.acquire(this.settings.symbol, 'Aura Quant', ticket, action);
                this.state.position = {
                    ticket, type: action, price: entryPrice,
                    sl, tp: tp1, time: Date.now(), comment: 'AuraTP1',
                    partialHit: false,
                };

                const tradeRec: TradeRecord = {
                    entryTime: Date.now(), exitTime: 0, entryPrice, exitPrice: 0,
                    direction: action, result: 'WIN', profit: 0, partialClose: false,
                };
                this.trades.push(tradeRec);

                AlertEngine.addAlert('GUARDIAN', 'INFO', 'AuraQuant', `${action} XAU: ${entryPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp1.toFixed(2)} | ADX: ${analysis.adx.toFixed(1)}`);

                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.syncPosition();

                if (this.state.position) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket, sl: Number(sl.toFixed(2)), tp: Number(tp1.toFixed(2)), magic: this.MAGIC,
                        });
                    } catch {}
                }
            }
        } catch (e) {
            this.log('ERROR', `Falha ordem ${action}: ${(e as any).message}`);
        }
    }

    private static async managePosition(analysis: M15Analysis) {
        if (!this.state.position) return;
        const pos = this.state.position;

        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const bridgePos = positions.find((p: any) => p.ticket === pos.ticket);

            if (!bridgePos) {
                let result: 'WIN' | 'LOSS' = 'LOSS';
                let profit = -5;
                const lastTrade = this.trades.find(t => t.entryTime === pos.time);
                if (lastTrade) {
                    result = lastTrade.result;
                    profit = lastTrade.profit;
                }
                if (profit > 0) this.state.dailyProfit += profit;
                else this.state.dailyLoss += Math.abs(profit);
                this.state.position = null;
                this.log('CLOSE', `Posição #${pos.ticket} fechada. Lucro: $${profit.toFixed(2)}`);
                return;
            }

            const currentPrice = bridgePos.price_current || analysis.price;
            const isBuy = pos.type === 'BUY';

            if (!pos.partialHit) {
                const hitTP1 = isBuy ? (bridgePos.price_current >= pos.tp) : (bridgePos.price_current <= pos.tp);
                if (hitTP1) {
                    const closeLot = Math.max(0.01, bridgePos.volume / 2);
                    try {
                        await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: pos.ticket, lot: Number(closeLot.toFixed(2)) });
                        this.log('TP1', `Fechado 50% #${pos.ticket}`);
                    } catch {}

                    const beSL = isBuy ? pos.price + 0.01 : pos.price - 0.01;
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, sl: Number(beSL.toFixed(2)), magic: this.MAGIC,
                        });
                    } catch {}

                    this.state.position.partialHit = true;
                    this.state.position.comment = 'AuraTP2';
                    let lastTrade = this.trades.find(t => t.entryTime === pos.time);
                    if (lastTrade) lastTrade.partialClose = true;
                    this.log('TP1', `TP1 atingido. SL movido BE. Modo trailing ativado.`);

                    const tp2 = isBuy ? (bridgePos.price_current + analysis.atr * 3) : (bridgePos.price_current - analysis.atr * 3);
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, tp: Number(tp2.toFixed(2)), magic: this.MAGIC,
                        });
                    } catch {}
                }
            } else {
                const atr = analysis.atr || 0;
                if (atr > 0) {
                    const trailDist = atr * 2.0;
                    const newSL = isBuy ? (currentPrice - trailDist) : (currentPrice + trailDist);
                    const improvedSL = isBuy ? (newSL > bridgePos.sl) : (newSL < bridgePos.sl || bridgePos.sl === 0);
                    if (improvedSL) {
                        try {
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket, sl: Number(newSL.toFixed(2)), magic: this.MAGIC,
                            });
                            this.log('TRAIL', `Trailing 2×ATR: SL movido para ${newSL.toFixed(2)}`);
                        } catch {}
                    }
                }

                const hitTP2 = isBuy ? (bridgePos.price_current >= pos.tp) : (bridgePos.price_current <= pos.tp);
                if (hitTP2) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: pos.ticket, lot: Number(bridgePos.volume.toFixed(2)) });
                        this.log('TP2', `Posição restante fechada #${pos.ticket} (TP alvo)`);
                        const lastTrade = this.trades.find(t => t.entryTime === pos.time);
                        if (lastTrade) {
                            lastTrade.result = 'WIN';
                            lastTrade.exitTime = Date.now();
                            lastTrade.exitPrice = currentPrice;
                            lastTrade.profit = Math.round(((isBuy ? currentPrice - pos.price : pos.price - currentPrice)) * this.settings.lotSize * 100);
                        }
                    } catch {}
                }
            }
        } catch (e) {
            console.error('AuraQuant: Manage position error', e);
        }
    }

    private static async syncPosition() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const auraPos = positions.find((p: any) => p.symbol === this.settings.symbol && p.magic === this.MAGIC);
            if (!auraPos) {
                if (this.state.position) {
                    this.state.position = null;
                    this.log('SYNC', 'Posição fechada externamente');
                }
            } else if (!this.state.position || this.state.position.ticket !== auraPos.ticket) {
                const isBuy = auraPos.type === 0;
                this.state.position = {
                    ticket: auraPos.ticket,
                    type: isBuy ? 'BUY' : 'SELL',
                    price: auraPos.price_open,
                    sl: auraPos.sl,
                    tp: auraPos.tp,
                    time: auraPos.time || Date.now(),
                    comment: auraPos.comment || 'AuraTP1',
                    partialHit: auraPos.comment === 'AuraTP2',
                };
                this.log('SYNC', `Posição sincronizada #${auraPos.ticket}`);
            }
        } catch {
            if (this.state.position) this.state.position = null;
        }
    }

    private static async resetDailyIfNeeded() {
        const now = new Date();
        const lastReset = new Date(this.state.lastBarTime);
        if (now.getUTCDate() !== lastReset.getUTCDate() || now.getUTCMonth() !== lastReset.getUTCMonth()) {
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            this.state.lastBarTime = now.getTime();
            this.log('DAILY', 'Contadores diários resetados');
        }
    }
}
