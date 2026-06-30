import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';
import { DisciplineEngine } from './DisciplineEngine';

const SETTINGS_PATH = path.join(process.cwd(), 'aura_quant_settings.json');
const HISTORY_PATH = path.join(process.cwd(), 'aura_quant_history.json');

interface AuraQuantSettings {
    enabled: boolean;
    symbol: string;
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    maxSpread: number;
    riskPercent: number;
    atrMultiplier: number;
    rrRatio: number;
    cooldownMinutes: number;
    tradingStartHour: number;
    tradingEndHour: number;
    consecutiveLossLimit: number;
    trailingDistanceMultiplier: number;
    breakevenOffsetATR: number;
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
    spread: number;
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
    ticket: number;
    lot: number;
    sl: number;
    tp: number;
    closeReason: string;
    symbol: string;
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
        maxDailyLoss: 20,
        maxDailyProfit: 30,
        maxSpread: 50,
        riskPercent: 1,
        atrMultiplier: 2.5,
        rrRatio: 2.0,
        cooldownMinutes: 5,
        tradingStartHour: 0,
        tradingEndHour: 24,
        consecutiveLossLimit: 3,
        trailingDistanceMultiplier: 1.0,
        breakevenOffsetATR: 0.3,
    };

    private static state: AuraQuantState = {
        lastBarTime: 0,
        position: null,
        dailyProfit: 0,
        dailyLoss: 0,
        spread: 0,
    };

    private static isRunning = false;
    private static lastAnalysis: M15Analysis | null = null;
    private static trades: TradeRecord[] = [];
    private static marginOk = true;
    private static lastMarginCheck = 0;
    private static operationLog: { time: string; action: string; details: string }[] = [];
    private static lastTradeTime = 0;
    private static consecutiveLosses = 0;
    private static cooldownUntil = 0;
    private static contractSizeCache: Record<string, number> = {};
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

    static getLiveMonitor() {
        const now = Date.now() / 1000;
        const stats = this.computeStats();
        const pos = this.state.position;

        let activePosition = null;
        if (pos) {
            const isBuy = pos.type === 'BUY';
            const entryPrice = pos.price;
            const sl = pos.sl;
            const tp = pos.tp;
            const timeSeconds = pos.time ? Math.floor(now - pos.time / 1000) : 0;
            const mins = Math.floor(timeSeconds / 60);
            const secs = timeSeconds % 60;

            activePosition = {
                ticket: pos.ticket,
                type: pos.type,
                symbol: this.settings.symbol,
                entryPrice: Math.round(entryPrice * 100) / 100,
                sl: Math.round(sl * 100) / 100,
                tp: Math.round(tp * 100) / 100,
                timeInTrade: `${mins}m ${secs}s`,
                timeSeconds,
                comment: pos.comment,
                partialHit: pos.partialHit,
            };
        }

        const a = this.lastAnalysis;
        return {
            position: activePosition,
            stats: {
                totalTrades: stats.totalTrades,
                wins: stats.winCount,
                losses: stats.lossCount,
                winRate: Math.round(stats.winRate * 10) / 10,
                closedPnL: Math.round(stats.totalProfit * 100) / 100,
                dailyPnL: Math.round((this.state.dailyProfit - this.state.dailyLoss) * 100) / 100,
                profitFactor: stats.profitFactor,
                avgWin: stats.avgWin,
                avgLoss: stats.avgLoss,
            },
            indicators: {
                price: a?.price || 0,
                ema21: a?.ema21 || 0,
                ema50: a?.ema50 || 0,
                stochK: a?.stochK || 0,
                stochD: a?.stochD || 0,
                adx: a?.adx || 0,
                atr: a?.atr || 0,
                atrMA20: a?.atrMA20 || 0,
                trend: a?.trend || 0,
                trendLabel: a?.trend === 1 ? 'ALTA' : a?.trend === -1 ? 'BAIXA' : 'NEUTRA',
                signal: a?.signal || null,
                altSignal: a?.altSignal || null,
                entryScore: a?.entryScore || 0,
                altScore: a?.altScore || 0,
                dxyBias: a?.dxyBias || 0,
                calendarBlock: a?.calendarBlock || false,
                calendarReason: a?.calendarReason || '',
            },
            cycleInfo: {
                isRunning: this.isRunning,
                enabled: this.settings.enabled,
                marginOk: this.marginOk,
                dailyProfit: this.state.dailyProfit,
                dailyLoss: this.state.dailyLoss,
            }
        };
    }

    private static computeStats() {
        const closed = this.trades.filter(t => t.exitTime > 0 && t.profit !== 0);
        const wins = closed.filter(t => t.result === 'WIN');
        const losses = closed.filter(t => t.result === 'LOSS');
        const winCount = wins.length;
        const lossCount = losses.length;
        const totalClosed = winCount + lossCount;
        const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;
        const totalProfit = closed.reduce((s, t) => s + t.profit, 0);
        const avgWin = winCount > 0 ? wins.reduce((s, t) => s + t.profit, 0) / winCount : 0;
        const avgLoss = lossCount > 0 ? losses.reduce((s, t) => s + Math.abs(t.profit), 0) / lossCount : 0;
        const profitFactor = avgLoss > 0 ? (winCount * avgWin) / (lossCount * avgLoss) : winCount > 0 ? Infinity : 0;

        let maxConsecutiveWins = 0, maxConsecutiveLosses = 0;
        let curWins = 0, curLosses = 0;
        for (const t of closed) {
            if (t.result === 'WIN') { curWins++; curLosses = 0; maxConsecutiveWins = Math.max(maxConsecutiveWins, curWins); }
            else { curLosses++; curWins = 0; maxConsecutiveLosses = Math.max(maxConsecutiveLosses, curLosses); }
        }

        const bestTrade = closed.length > 0 ? Math.max(...closed.map(t => t.profit)) : 0;
        const worstTrade = closed.length > 0 ? Math.min(...closed.map(t => t.profit)) : 0;

        return {
            totalTrades: totalClosed, winCount, lossCount, winRate: Math.round(winRate * 100) / 100,
            totalProfit: Math.round(totalProfit * 100) / 100,
            avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
            profitFactor: Math.round(profitFactor * 100) / 100,
            maxConsecutiveWins, maxConsecutiveLosses,
            bestTrade: Math.round(bestTrade * 100) / 100, worstTrade: Math.round(worstTrade * 100) / 100,
        };
    }

    static updateSettings(partial: Partial<AuraQuantSettings>) {
        const previousEnabled = this.settings.enabled;
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();

        // Log mudanças importantes
        if (partial.enabled !== undefined && partial.enabled !== previousEnabled) {
            this.log('CONFIG', `Engine ${partial.enabled ? 'ATIVADO' : 'DESATIVADO'}`);
        }
        this.log('CONFIG', `Config atualizada: ${JSON.stringify(partial)}`);
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
                this.settings = { ...this.settings, ...data };
            }
        } catch (e) {
            console.error('AuraQuant: Error loading settings:', e);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('AuraQuant: Error saving settings', e);
        }
    }

    private static saveTrades() {
        try {
            const data = {
                trades: this.trades.slice(-200),
                stats: this.computeStats(),
                operationLog: this.operationLog.slice(-50),
            };
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('AuraQuant: Error saving trades', e);
        }
    }

    private static loadTrades() {
        try {
            if (fs.existsSync(HISTORY_PATH)) {
                const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
                if (raw.trades && Array.isArray(raw.trades)) {
                    this.trades = raw.trades;
                }
                if (raw.operationLog && Array.isArray(raw.operationLog)) {
                    this.operationLog = raw.operationLog;
                }
            }
        } catch (e) {
            console.error('AuraQuant: Error loading trades', e);
        }
    }

    static getHistory() {
        return {
            trades: this.trades,
            stats: this.computeStats(),
            operationLog: this.operationLog.slice(-50),
        };
    }

    private static async syncFromMT5History() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 15000 });
            const history: any[] = Array.isArray(resp.data) ? resp.data : [];
            if (history.length === 0) return;

            let updated = 0;
            for (const trade of this.trades) {
                if (trade.exitTime > 0 && trade.profit !== 0) continue;
                const exitDeal = history.find((d: any) =>
                    (d.position_id === trade.ticket || d.ticket === trade.ticket) &&
                    d.entry === 1
                );
                if (exitDeal) {
                    const profit = (exitDeal.profit || 0) + (exitDeal.commission || 0) + (exitDeal.swap || 0);
                    trade.profit = Math.round(profit * 100) / 100;
                    trade.result = profit >= 0 ? 'WIN' : 'LOSS';
                    trade.exitTime = exitDeal.time ? exitDeal.time * 1000 : Date.now();
                    trade.exitPrice = exitDeal.price || 0;
                    updated++;
                }
            }

            if (updated > 0) {
                this.log('SYNC', `P&L sincronizado do MT5: ${updated} trades atualizados`);
                this.saveTrades();
            }

            const today = new Date().toDateString();
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            for (const t of this.trades) {
                if (t.exitTime > 0 && new Date(t.exitTime).toDateString() === today) {
                    if (t.profit > 0) this.state.dailyProfit += t.profit;
                    else this.state.dailyLoss += Math.abs(t.profit);
                }
            }
        } catch (e: any) {
            this.log('WARN', `Falha ao sincronizar com MT5: ${e?.message}`);
        }
    }

    static async init() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadTrades();
        this.isRunning = true;
        await this.syncFromMT5History();
        this.log('INIT', `Aura Quant — Pullback + Stoch(14,3,3) + ADX + H4 Trend + Calendário + DXY | Enabled: ${this.settings.enabled} | Histórico: ${this.trades.length} trades`);
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
            const free = parseFloat(resp.data?.freeMargin || resp.data?.margin_free || '0');
            const balance = parseFloat(resp.data?.balance || '0');
            this.marginOk = free > balance * 0.1;
            return this.marginOk;
        } catch {
            this.marginOk = false;
            return false;
        }
    }

    private static async loop() {
        let cycleCount = 0;
        while (this.isRunning) {
            cycleCount++;
            try {
                await this.syncPosition();
                await this.resetDailyIfNeeded();

                // Análise com timeout próprio (não depender de bridge lenta)
                const analysisPromise = this.analyzeM15();
                const analysisTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000));
                this.lastAnalysis = await Promise.race([analysisPromise, analysisTimeout]) as M15Analysis | null;

                if (!this.lastAnalysis) {
                    if (cycleCount % 10 === 0) {
                        this.log('WARN', `Análise M15 indisponível (ciclo #${cycleCount}). Bridge pode estar lenta.`);
                    }
                    // Continua rodando mas sem entrar em trades
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }

                if (this.settings.enabled) {
                    await this.checkMargin();

                    // Verifica disciplina global com timeout próprio
                    const disciplinePromise = DisciplineEngine.getDailyStatus();
                    const disciplineTimeout = new Promise<{ isLocked: boolean; reason: string | null }>((resolve) =>
                        setTimeout(() => resolve({ isLocked: false, reason: null }), 5000)
                    );
                    const discipline = await Promise.race([disciplinePromise, disciplineTimeout]);

                    if (discipline.isLocked) {
                        this.log('BLOCKED', `Safety Lock: ${discipline.reason}`);
                        await new Promise(resolve => setTimeout(resolve, 30000));
                        continue;
                    }

                    if (this.state.position) {
                        await this.managePosition(this.lastAnalysis);
                    } else {
                        const limitLost = this.state.dailyLoss >= this.settings.maxDailyLoss;
                        const limitGain = this.state.dailyProfit >= this.settings.maxDailyProfit;

                        if (limitLost) {
                            if (cycleCount % 30 === 0) this.log('LIMIT', `Loss diário ($${this.state.dailyLoss.toFixed(2)}) atingiu max ($${this.settings.maxDailyLoss}). Aguardando reset.`);
                        } else if (limitGain) {
                            if (cycleCount % 30 === 0) this.log('LIMIT', `Meta diária ($${this.state.dailyProfit.toFixed(2)}) atingida. Aguardando reset.`);
                        } else if (!this.marginOk) {
                            if (cycleCount % 30 === 0) this.log('LIMIT', 'Margin insuficiente.');
                        } else {
                            await this.evaluateEntry(this.lastAnalysis);
                        }
                    }
                } else {
                    if (cycleCount % 50 === 0) {
                        this.log('INFO', `Engine desabilitado. Use /api/mt5/aura-quant/settings para reativar.`);
                    }
                }
            } catch (error: any) {
                this.log('ERROR', `Loop error: ${error?.message || error}`);
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
            const [tickRes, infoRes] = await Promise.all([
                axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] }),
                axios.get(`${this.BRIDGE_URL}/symbol_info?symbol=${this.settings.symbol}`).catch(() => ({ data: {} }))
            ]);
            const t = tickRes.data?.[this.settings.symbol] || tickRes.data;
            const info = infoRes.data;
            if (t?.ask && t?.bid) {
                const point = info?.point || (this.settings.symbol.includes('XAU') ? 0.01 : 0.0001);
                const spreadPts = (t.ask - t.bid) / point;
                this.state.spread = t.ask - t.bid;
                if (spreadPts > this.settings.maxSpread) return { allowed: false, reason: `Spread alto: ${spreadPts.toFixed(0)} pts (max: ${this.settings.maxSpread})` };
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
            const price = close[close.length - 1];

            // Buscar trend, DXY e calendário em paralelo
            const [trend, dxyResult, calResult] = await Promise.all([
                this.getTrend(),
                this.getDXYBias(),
                this.checkEconomicCalendar(),
            ]);

            let signal: 'BUY' | 'SELL' | null = null;
            let score = 0;
            let altSignal: 'BUY' | 'SELL' | null = null;
            let altScore = 0;

            const distanceToEma21 = ((price - ema21) / ema21) * 100;
            const nearEma21 = distanceToEma21 > -2.0 && distanceToEma21 < 2.0;
            const prevStochK = stoch.k;

            // Primary: pullback + Stoch extreme + Stoch crossover
            if (trend === 1 && nearEma21 && stoch.k < 35 && stoch.k > stoch.d) {
                signal = 'BUY';
                const pullbackQual = Math.max(0, 30 - Math.abs(distanceToEma21) * 10);
                const stochQual = Math.max(0, 35 - stoch.k);
                score = Math.round(pullbackQual + stochQual + (adx > 18 ? 20 : 0) + 15);
            } else if (trend === -1 && nearEma21 && stoch.k > 65 && stoch.k < stoch.d) {
                signal = 'SELL';
                const pullbackQual = Math.max(0, 30 - Math.abs(distanceToEma21) * 10);
                const stochQual = Math.max(0, stoch.k - 65);
                score = Math.round(pullbackQual + stochQual + (adx > 18 ? 20 : 0) + 15);
            }

            // Alternative: ADX > 20 + EMA21/50 cross aligned + near EMA21
            if (!signal && trend !== 0 && adx > 20 && nearEma21) {
                const emaCross = price > ema50 ? 1 : -1;
                if (emaCross === trend) {
                    altSignal = trend === 1 ? 'BUY' : 'SELL';
                    const pullbackQual = Math.max(0, 25 - Math.abs(distanceToEma21) * 8);
                    const adxQual = Math.min(20, (adx - 25) * 2);
                    altScore = Math.round(pullbackQual + adxQual + 10);
                }
            }

            return {
                price, ema21, ema50, stochK: stoch.k, stochD: stoch.d, prevStochK,
                atr, atrMA20, trend, adx,
                signal, entryScore: score,
                altSignal, altScore,
                dxyBias: dxyResult.bias,
                calendarBlock: calResult.block,
                calendarReason: calResult.reason,
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

    private static async getContractSize(symbol: string): Promise<number> {
        if (this.contractSizeCache[symbol]) return this.contractSizeCache[symbol];
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/symbol_info?symbol=${symbol}`, { timeout: 5000 });
            const cs = resp.data?.trade_contract_size || resp.data?.contract_size;
            if (cs && cs > 0) { this.contractSizeCache[symbol] = cs; return cs; }
        } catch {}
        const fallback = symbol.includes('XAU') ? 100 : symbol.includes('BTC') ? 1 : 100000;
        this.contractSizeCache[symbol] = fallback;
        return fallback;
    }

    private static async calculateDynamicLot(slDistance: number): Promise<number> {
        try {
            const [ar, cs] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 }),
                this.getContractSize(this.settings.symbol),
            ]);
            const balance = ar.data?.balance || 1000;
            const riskAmount = balance * (this.settings.riskPercent / 100);
            const slMoneyPerLot = slDistance * cs;
            if (slMoneyPerLot > 0) {
                let lot = riskAmount / slMoneyPerLot;
                const step = 0.01;
                lot = Math.round(lot / step) * step;
                return Math.max(0.01, Math.min(lot, 50));
            }
        } catch {}
        return this.settings.lotSize;
    }

    private static async evaluateEntry(analysis: M15Analysis) {
        const now = Date.now();

        if (now < this.cooldownUntil) {
            const minsLeft = Math.ceil((this.cooldownUntil - now) / 60000);
            this.log('FILTER', `Cooldown ativo — ${minsLeft}min restantes`);
            return;
        }

        if (this.state.position) return;

        const hour = new Date().getHours();
        if (this.settings.tradingStartHour < this.settings.tradingEndHour) {
            if (hour < this.settings.tradingStartHour || hour >= this.settings.tradingEndHour) {
                this.log('FILTER', `Fora do horário (${hour}h). Sessão: ${this.settings.tradingStartHour}h-${this.settings.tradingEndHour}h`);
                return;
            }
        }

        if (this.consecutiveLosses >= this.settings.consecutiveLossLimit) {
            this.cooldownUntil = now + 30 * 60 * 1000;
            this.log('FILTER', `${this.consecutiveLosses} losses consecutivos — cooldown 30min`);
            this.consecutiveLosses = 0;
            return;
        }

        if (analysis.calendarBlock) {
            this.log('FILTER', `Calendário bloqueado: ${analysis.calendarReason}`);
            return;
        }

        if (!analysis.signal && !analysis.altSignal) return;
        if (analysis.signal && analysis.entryScore < 20) return;
        if (analysis.altSignal && analysis.altScore < 15) return;

        if (analysis.adx < 18) {
            this.log('FILTER', `ADX ${analysis.adx.toFixed(1)} < 18 — pulando`);
            return;
        }
        if (analysis.atr < analysis.atrMA20 * 0.5) {
            this.log('FILTER', `ATR ${analysis.atr.toFixed(2)} < 50% da média ${analysis.atrMA20.toFixed(2)} — volatilidade baixa`);
            return;
        }

        const marketCheck = await this.filterMarket();
        if (!marketCheck.allowed) {
            this.log('FILTER', `Mercado bloqueado: ${marketCheck.reason}`);
            return;
        }

        if (analysis.atr > 0 && this.state.spread > analysis.atr * 0.3) {
            this.log('SKIP', `Spread ${this.state.spread} > 30% ATR (${(analysis.atr * 0.3).toFixed(1)})`);
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

        if (finalScore < 18) {
            this.log('FILTER', `Score final ${finalScore} < 18, pulando`);
            return;
        }

        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) return;

        const atr = analysis.atr;
        const slPoints = atr * this.settings.atrMultiplier;
        const tp1Points = slPoints * this.settings.rrRatio;

        const lot = await this.calculateDynamicLot(slPoints);

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
                    direction: action, result: 'LOSS', profit: 0, partialClose: false,
                    ticket, lot, sl, tp: tp1, closeReason: '', symbol: this.settings.symbol,
                };
                this.trades.push(tradeRec);
                this.lastTradeTime = Date.now();
                this.saveTrades();
                
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
                let profit = 0;
                const lastTrade = this.trades.find(t => t.ticket === pos.ticket);
                
                try {
                    const histResp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 10000 });
                    const history: any[] = Array.isArray(histResp.data) ? histResp.data : [];
                    const closed = history.find((t: any) => t.position_id === pos.ticket || t.ticket === pos.ticket);
                    if (closed) {
                        profit = (closed.profit || 0) + (closed.commission || 0) + (closed.swap || 0);
                        result = profit >= 0 ? 'WIN' : 'LOSS';
                    } else if (lastTrade) {
                        profit = lastTrade.profit;
                        result = profit >= 0 ? 'WIN' : 'LOSS';
                    }
                } catch {
                    if (lastTrade) { profit = lastTrade.profit; result = profit >= 0 ? 'WIN' : 'LOSS'; }
                }

                if (lastTrade) {
                    lastTrade.result = result;
                    lastTrade.profit = Math.round(profit * 100) / 100;
                    lastTrade.exitTime = Date.now();
                    this.saveTrades();
                }
                if (profit > 0) {
                    this.state.dailyProfit += profit;
                    this.consecutiveLosses = 0;
                } else {
                    this.state.dailyLoss += Math.abs(profit);
                    this.consecutiveLosses++;
                }
                this.cooldownUntil = Date.now() + this.settings.cooldownMinutes * 60 * 1000;
                this.state.position = null;
                this.log('CLOSE', `Posição #${pos.ticket} fechada. Lucro: $${profit.toFixed(2)} (${result})`);
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

                    const beOffset = Math.max(0.5, analysis.atr * this.settings.breakevenOffsetATR);
                    const beSL = isBuy ? pos.price + beOffset : pos.price - beOffset;
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, sl: Number(beSL.toFixed(2)), magic: this.MAGIC,
                        });
                    } catch {}

                    this.state.position.partialHit = true;
                    this.state.position.comment = 'AuraTP2';
                    let lastTrade = this.trades.find(t => t.ticket === pos.ticket);
                    if (lastTrade) lastTrade.partialClose = true;
                    this.log('TP1', `TP1 atingido. SL movido BE. Modo trailing ativado.`);

                    const tp2Distance = analysis.atr * this.settings.atrMultiplier * this.settings.rrRatio * 1.5;
                    const tp2 = isBuy ? (pos.price + tp2Distance) : (pos.price - tp2Distance);
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, tp: Number(tp2.toFixed(2)), magic: this.MAGIC,
                        });
                    } catch {}
                }
            } else {
                const atr = analysis.atr || 0;
                if (atr > 0) {
                    const trailDist = atr * this.settings.trailingDistanceMultiplier;
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
                        const lastTrade = this.trades.find(t => t.ticket === pos.ticket);
                        if (lastTrade) {
                            const contractSize = await this.getContractSize(this.settings.symbol);
                            lastTrade.profit = Math.round(((isBuy ? currentPrice - pos.price : pos.price - currentPrice)) * bridgePos.volume * contractSize * 100) / 100;
                            lastTrade.result = lastTrade.profit >= 0 ? 'WIN' : 'LOSS';
                            lastTrade.exitTime = Date.now();
                            lastTrade.exitPrice = currentPrice;
                            this.saveTrades();
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
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const positions: any[] = resp.data || [];
            const auraPos = positions.find((p: any) => p.symbol === this.settings.symbol && p.magic === this.MAGIC);
            if (!auraPos) {
                if (this.state.position) {
                    const closedTicket = this.state.position.ticket;
                    const lastTrade = this.trades.find(t => t.ticket === closedTicket);
                    if (lastTrade) {
                        lastTrade.result = lastTrade.profit > 0 ? 'WIN' : 'LOSS';
                        lastTrade.exitTime = Date.now();
                        this.saveTrades();
                    }
                    this.log('CLOSE', `Posição #${closedTicket} fechada externamente.`);
                    this.state.position = null;
                }
            } else if (!this.state.position || this.state.position.ticket !== auraPos.ticket) {
                const isBuy = auraPos.type === 0;
                const mt5TimeMs = auraPos.time ? (auraPos.time > 1e11 ? auraPos.time : auraPos.time * 1000) : Date.now();
                this.state.position = {
                    ticket: auraPos.ticket,
                    type: isBuy ? 'BUY' : 'SELL',
                    price: auraPos.price_open,
                    sl: auraPos.sl,
                    tp: auraPos.tp,
                    time: mt5TimeMs,
                    comment: auraPos.comment || 'AuraTP1',
                    partialHit: auraPos.comment === 'AuraTP2',
                };
                this.log('SYNC', `Posição sincronizada #${auraPos.ticket} ${isBuy ? 'BUY' : 'SELL'} @ ${auraPos.price_open}`);
            }
        } catch (e: any) {
            // Se o bridge caiu, NÃO apagar posição — apenas avisar
            if (this.state.position) {
                this.log('WARN', `Bridge offline — mantendo posição #${this.state.position.ticket} em cache`);
            }
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

    static async forceTrade(direction?: 'BUY' | 'SELL', lot?: number) {
        if (!this.settings.enabled) throw new Error('Engine disabled');
        if (this.state.position) throw new Error('Position already open');
        
        const analysis = this.lastAnalysis || await this.analyzeM15();
        if (!analysis) throw new Error('No analysis available');
        
        const action = direction || analysis.signal || analysis.altSignal;
        if (!action) throw new Error('No valid signal');
        
        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) throw new Error('No price data');
        
        const atr = analysis.atr;
        const slPoints = atr * this.settings.atrMultiplier;
        const tpPoints = slPoints * this.settings.rrRatio;
        
        const tradeLot = lot || await this.calculateDynamicLot(slPoints);
        
        this.log('FORCE_TRADE', `${action} ${this.settings.symbol} Lot:${tradeLot} SL:${slPoints.toFixed(2)} TP:${tpPoints.toFixed(2)}`);
        
        const entryPrice = currentPrice;
        const sl = action === 'BUY' ? entryPrice - slPoints : entryPrice + slPoints;
        const tp = action === 'BUY' ? entryPrice + tpPoints : entryPrice - tpPoints;
        
        const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
            symbol: this.settings.symbol,
            action,
            lot: tradeLot,
            sl: Number(sl.toFixed(2)),
            tp: Number(tp.toFixed(2)),
            magic: this.MAGIC,
            comment: 'AuraTP1',
        });
        
        const ticket = resp.data?.order_id || resp.data?.ticket;
        if (!ticket) throw new Error('Order failed');
        
        this.state.position = {
            ticket, type: action, price: entryPrice,
            sl, tp: tp, time: Date.now(), comment: 'AuraTP1',
            partialHit: false,
        };
        
        const tradeRec: TradeRecord = {
            entryTime: Date.now(), exitTime: 0, entryPrice, exitPrice: 0,
            direction: action, result: 'LOSS', profit: 0, partialClose: false,
            ticket, lot: tradeLot, sl, tp, closeReason: '', symbol: this.settings.symbol,
        };
        this.trades.push(tradeRec);
        this.lastTradeTime = Date.now();
        this.saveTrades();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.syncPosition();
        
        if (this.state.position) {
            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                ticket, sl: Number(sl.toFixed(2)), tp: Number(tp.toFixed(2)), magic: this.MAGIC,
            });
        }
        
        this.log('FORCE_TRADE', `Ordem ${action} executada #${ticket}`);
        return { ticket, action, entryPrice, sl, tp, lot: tradeLot };
    }
}
