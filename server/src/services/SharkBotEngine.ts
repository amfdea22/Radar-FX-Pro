import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';
import { DisciplineEngine } from './DisciplineEngine';

const BRIDGE_TIMEOUT = 5000;

interface SharkBotSettings {
    enabled: boolean;
    symbol: string;
    timeframe: string;
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    riskPercent: number;
    fvgMinAtrRatio: number;
    maxSpread: number;
    minVolume: number;
    tradingStartHour: number;
    tradingEndHour: number;
    useLimitOrders: boolean;
    useTrailingStop: boolean;
    usePartialClose: boolean;
    useMultiTimeframe: boolean;
}

interface SharkBotState {
    lastBarTime: number;
    position: {
        ticket: number;
        type: 'BUY' | 'SELL';
        price: number;
        sl: number;
        tp: number;
        time: number;
        profit?: number;
        partialCloseDone?: boolean;
    } | null;
    dailyProfit: number;
    dailyLoss: number;
}

interface FVGSignal {
    entradaLimit: number;
    stopLoss: number;
    gapSize: number;
    barIndex: number;
    swingLow: number;
    nivel50: number;
}

interface TradeRecord {
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    direction: 'BUY' | 'SELL';
    result: 'WIN' | 'LOSS';
    profit: number;
    fvgSize: number;
    gapSize: number;
}

interface SMCSetup {
    atr: number;
    swingHigh20: number;
    swingLow20: number;
    bosAlta: boolean;
    nivel50Desconto: number;
    fvgValido: boolean;
    entradaLimit: number;
    gapSize: number;
    sma50: number;
    setupArmado: boolean;
    price: number;
}

interface DailyAnalysis {
    price: number;
    atr: number;
    swingHigh: number;
    swingLow: number;
    nivel50: number;
    sma50: number;
    fvgCount: number;
    bos: boolean;
    setupCount: number;
    setups: FVGSignal[];
    setupsSell: FVGSignal[];
    htTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export class SharkBotEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 9876;
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'shark_bot_settings.json');
    private static TRADES_PATH = path.resolve(process.cwd(), 'shark_bot_trades.json');
    private static LOGS_PATH = path.resolve(process.cwd(), 'shark_bot_logs.txt');

    private static settings: SharkBotSettings = {
        enabled: false,
        symbol: 'XAUUSD',
        timeframe: 'H1',
        lotSize: 0.01,
        maxDailyLoss: 50,
        maxDailyProfit: 100,
        riskPercent: 1.0,
        fvgMinAtrRatio: 0.3,
        maxSpread: 30,
        minVolume: 0,
        tradingStartHour: 1,
        tradingEndHour: 23,
        useLimitOrders: false,
        useTrailingStop: true,
        usePartialClose: true,
        useMultiTimeframe: true,
    };

    private static state: SharkBotState = {
        lastBarTime: 0,
        position: null,
        dailyProfit: 0,
        dailyLoss: 0,
    };

    private static isRunning = false;
    private static marginOk = false;
    private static lastMarginCheck = 0;
    private static lastAnalysis: DailyAnalysis | null = null;
    private static trades: TradeRecord[] = [];
    private static activeFvgLevels: FVGSignal[] = [];
    private static lastBarClose = 0;
    private static operationLog: Array<{ time: string; action: string; details: string }> = [];
    private static bridgeRetryCount = 0;
    private static bridgeLastFail = 0;
    private static logStream: fs.WriteStream | null = null;

    private static addLog(action: string, details: string) {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.operationLog.push({ time, action, details });
        if (this.operationLog.length > 200) this.operationLog = this.operationLog.slice(-100);
        try {
            if (!this.logStream) this.logStream = fs.createWriteStream(this.LOGS_PATH, { flags: 'a' });
            this.logStream.write(`[${new Date().toISOString()}] [${action}] ${details}\n`);
        } catch { }
    }

    static getHistory() {
        return this.trades.slice().reverse();
    }

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            isRunning: this.isRunning,
            marginOk: this.marginOk,
            lastAnalysis: this.lastAnalysis,
            activeFvgLevels: this.activeFvgLevels,
            trades: this.trades.slice(-20).reverse(),
            performance: this.computePerformance(),
            operationLog: this.operationLog.slice(-50),
        };
    }

    private static computePerformance() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.result === 'WIN').length;
        const losses = this.trades.filter(t => t.result === 'LOSS').length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const totalProfit = this.trades.reduce((s, t) => s + t.profit, 0);
        const avgWin = wins > 0 ? this.trades.filter(t => t.result === 'WIN').reduce((s, t) => s + t.profit, 0) / wins : 0;
        const avgLoss = losses > 0 ? this.trades.filter(t => t.result === 'LOSS').reduce((s, t) => s + Math.abs(t.profit), 0) / losses : 0;
        const profitFactor = avgLoss > 0 ? (wins * avgWin) / (losses * avgLoss) : wins > 0 ? Infinity : 0;
        return { totalTrades: total, wins, losses, winRate, totalProfit, avgWin, avgLoss, profitFactor };
    }

    static updateSettings(partial: Partial<SharkBotSettings>) {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
    }

    static async init() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadTrades();
        this.isRunning = true;
        this.addLog('INICIO', 'Robô SMC Institucional iniciado');
        console.log('🦈 SharkBot: Robô SMC Institucional iniciado...');
        this.loop();
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(this.SETTINGS_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8'));
                this.settings = { ...this.settings, ...data };
            }
        } catch (e) {
            console.warn('🦈 SharkBot: Erro ao carregar configurações', e);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.warn('🦈 SharkBot: Erro ao salvar configurações', e);
        }
    }

    private static loadTrades() {
        try {
            if (fs.existsSync(this.TRADES_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.TRADES_PATH, 'utf-8'));
                if (Array.isArray(data)) this.trades = data;
            }
        } catch (e) {
            console.warn('🦈 SharkBot: Erro ao carregar histórico de trades', e);
        }
    }

    private static saveTrades() {
        try {
            fs.writeFileSync(this.TRADES_PATH, JSON.stringify(this.trades.slice(-500), null, 2));
        } catch (e) {
            console.warn('🦈 SharkBot: Erro ao salvar histórico de trades', e);
        }
    }

    static stop() {
        this.isRunning = false;
        this.saveTrades();
        if (this.logStream) { try { this.logStream.end(); } catch { } this.logStream = null; }
        console.log('🦈 SharkBot: Robô parado.');
    }

    private static async bridgeGet(url: string, params?: any): Promise<any> {
        const maxRetry = this.bridgeRetryCount < 3 ? 3 : 1;
        for (let i = 0; i < maxRetry; i++) {
            try {
                const resp = await axios.get(url, { ...params, timeout: BRIDGE_TIMEOUT });
                this.bridgeRetryCount = 0;
                return resp;
            } catch (e: any) {
                this.bridgeLastFail = Date.now();
                this.bridgeRetryCount++;
                if (i < maxRetry - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                else throw e;
            }
        }
    }

    private static async bridgePost(url: string, data?: any): Promise<any> {
        const maxRetry = this.bridgeRetryCount < 3 ? 3 : 1;
        for (let i = 0; i < maxRetry; i++) {
            try {
                const resp = await axios.post(url, data, { timeout: BRIDGE_TIMEOUT });
                this.bridgeRetryCount = 0;
                return resp;
            } catch (e: any) {
                this.bridgeLastFail = Date.now();
                this.bridgeRetryCount++;
                if (i < maxRetry - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                else throw e;
            }
        }
    }

    private static async checkMargin(): Promise<boolean> {
        if (Date.now() - this.lastMarginCheck < 60000) return this.marginOk;
        this.lastMarginCheck = Date.now();
        try {
            const resp = await this.bridgeGet(`${this.BRIDGE_URL}/account`);
            const free = parseFloat(resp.data?.margin_free || '0');
            const balance = parseFloat(resp.data?.balance || '0');
            this.marginOk = free > balance * 0.15;
            if (!this.marginOk) {
                this.addLog('MARGEM', `Insuficiente (livre: $${free.toFixed(2)})`);
                console.log(`🦈 SharkBot: Margem insuficiente (livre: $${free.toFixed(2)})`);
            }
            return this.marginOk;
        } catch {
            this.marginOk = false;
            return false;
        }
    }

    private static tfToMt5Frame(tf: string): string {
        const map: Record<string, string> = { 'M1': 'M1', 'M5': 'M5', 'M15': 'M15', 'M30': 'M30', 'H1': 'H1', 'H4': 'H4', 'D1': 'D1' };
        return map[tf] || 'H1';
    }

    private static isTradingHours(): boolean {
        const hour = new Date().getUTCHours();
        return hour >= this.settings.tradingStartHour && hour <= this.settings.tradingEndHour;
    }

    private static async checkSpread(): Promise<number | null> {
        try {
            const resp = await this.bridgePost(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] });
            const tick = (resp.data || {})[this.settings.symbol] || resp.data;
            return tick?.spread || null;
        } catch { return null; }
    }

    private static async getHtTrend(): Promise<'BULLISH' | 'BEARISH' | 'NEUTRAL'> {
        try {
            const tf = this.settings.timeframe === 'M15' || this.settings.timeframe === 'M30' ? 'H1' : 'H4';
            const htBars = await MarketDataService.getRecentBars(this.settings.symbol, 55, tf);
            if (!htBars || htBars.length < 30) return 'NEUTRAL';
            const closePrices = htBars.map((b: any) => b.c);
            const sma20 = this.calcSMA(closePrices, 20);
            const sma50 = this.calcSMA(closePrices, 50);
            const price = closePrices[closePrices.length - 1];
            if (price > sma20 && sma20 > sma50) return 'BULLISH';
            if (price < sma20 && sma20 < sma50) return 'BEARISH';
            return 'NEUTRAL';
        } catch { return 'NEUTRAL'; }
    }

    private static getVolumeAvg(bars: any[]): number {
        if (bars.length < 20) return 0;
        return bars.slice(-20).reduce((s, b) => s + (b.v || 0), 0) / 20;
    }

    private static async loop() {
        while (this.isRunning) {
            const cycleStart = Date.now();
            try {
                if (this.settings.enabled) {
                    await this.syncPosition();
                    await this.resetDailyIfNeeded();
                    const analysis = await this.analyzeSmc();
                    if (analysis) {
                        this.lastAnalysis = analysis;
                        if (analysis.setupCount > 0) {
                            this.addLog('ANÁLISE', `${analysis.fvgCount} FVGs | ${analysis.setupCount} setups | BOS: ${analysis.bos ? 'SIM' : 'NÃO'}${analysis.htTrend ? ` | HT: ${analysis.htTrend}` : ''}`);
                        }
                        if (!this.state.position) {
                            const marginSufficient = await this.checkMargin();
                            if (marginSufficient) {
                                await this.evaluateEntry(analysis);
                            }
                        } else {
                            await this.managePosition();
                        }
                    }
                }
                // C12: adaptive loop interval — 5s if in position, else 30s
                const interval = this.state.position ? 5000 : 30000;
                const elapsed = Date.now() - cycleStart;
                const remaining = Math.max(100, interval - elapsed);
                await new Promise(resolve => setTimeout(resolve, remaining));
            } catch (error) {
                console.error('🦈 SharkBot: Loop error', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    private static calcSMA(values: number[], period: number): number {
        if (values.length < period) return values[values.length - 1];
        return values.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    private static async analyzeSmc(): Promise<DailyAnalysis | null> {
        try {
            const tf = this.tfToMt5Frame(this.settings.timeframe);
            let bars = await MarketDataService.getRecentBars(this.settings.symbol, 110, tf);
            bars = [...bars].reverse();
            if (bars.length < 55) return null;

            const closePrices = bars.map(b => b.c);
            const highPrices = bars.map(b => b.h);
            const lowPrices = bars.map(b => b.l);

            const atr = this.calcATR(bars, 14);
            const price = bars[bars.length - 1].c;
            const lastBar = bars[bars.length - 1];

            // C3: volume filter
            const avgVolume = await this.getVolumeAvg(bars);
            const lastVolume = lastBar.v || 0;
            const volumeOk = this.settings.minVolume <= 0 || lastVolume >= this.settings.minVolume * avgVolume;

            // C6: multi-timeframe trend
            let htTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | undefined;
            if (this.settings.useMultiTimeframe) {
                htTrend = await this.getHtTrend();
            }

            const sma50 = this.calcSMA(closePrices, 50);
            const setups: FVGSignal[] = [];
            const setupsSell: FVGSignal[] = [];
            let fvgCount = 0;
            let setupCount = 0;

            for (let i = 2; i < bars.length; i++) {
                const swingHigh20 = Math.max(...highPrices.slice(Math.max(0, i - 20), i));
                const swingLow20 = Math.min(...lowPrices.slice(Math.max(0, i - 20), i));

                const boS = bars[i].c > swingHigh20;
                const nivel50 = swingLow20 + (swingHigh20 - swingLow20) * 0.5;

                const gapBearExists = lowPrices[i - 2] > highPrices[i];
                const gapBearSize = gapBearExists ? lowPrices[i - 2] - highPrices[i] : 0;
                const gapBearRelevant = gapBearSize > this.settings.fvgMinAtrRatio * atr;
                const fvgBear = gapBearExists && gapBearRelevant;
                const buyEntry = lowPrices[i - 2];
                const buyArmed = fvgBear && buyEntry <= nivel50 && bars[i].c > sma50 && volumeOk;

                const gapBullExists = highPrices[i - 2] < lowPrices[i];
                const gapBullSize = gapBullExists ? lowPrices[i] - highPrices[i - 2] : 0;
                const gapBullRelevant = gapBullSize > this.settings.fvgMinAtrRatio * atr;
                const fvgBull = gapBullExists && gapBullRelevant;
                const sellEntry = highPrices[i - 2];
                const sellArmed = fvgBull && sellEntry >= nivel50 && bars[i].c < sma50 && volumeOk;

                // C6: multi-timeframe confirmation
                const buyConfirmed = !htTrend || htTrend !== 'BEARISH';
                const sellConfirmed = !htTrend || htTrend !== 'BULLISH';

                if (fvgBear || fvgBull) fvgCount++;
                if (buyArmed && buyConfirmed) {
                    setupCount++;
                    setups.push({ entradaLimit: buyEntry, stopLoss: swingLow20, gapSize: gapBearSize, barIndex: i, swingLow: swingLow20, nivel50 });
                }
                if (sellArmed && sellConfirmed) {
                    setupCount++;
                    setupsSell.push({ entradaLimit: sellEntry, stopLoss: swingHigh20, gapSize: gapBullSize, barIndex: i, swingLow: swingLow20, nivel50 });
                }

                if (buyArmed && i === bars.length - 1) {
                    console.log(`🦈 SharkBot: BUY FVG na vela atual! Entrada: ${buyEntry.toFixed(2)}, SL: ${swingLow20.toFixed(2)}, Gap: ${gapBearSize.toFixed(2)}`);
                }
                if (sellArmed && i === bars.length - 1) {
                    console.log(`🦈 SharkBot: SELL FVG na vela atual! Entrada: ${sellEntry.toFixed(2)}, SL: ${swingHigh20.toFixed(2)}, Gap: ${gapBullSize.toFixed(2)}`);
                }
            }

            const lastSwingHigh = Math.max(...highPrices.slice(-20));
            const lastSwingLow = Math.min(...lowPrices.slice(-20));
            const lastNivel50 = lastSwingLow + (lastSwingHigh - lastSwingLow) * 0.5;
            const lastBos = price > lastSwingHigh;

            this.activeFvgLevels = [...setups, ...setupsSell].filter(s => s.entradaLimit >= price * 0.95 && s.entradaLimit <= price * 1.05);
            this.lastBarClose = lastBar.c;

            return {
                price, atr, swingHigh: lastSwingHigh, swingLow: lastSwingLow, nivel50: lastNivel50,
                sma50, fvgCount, bos: lastBos, setupCount, setups, setupsSell, htTrend,
            };
        } catch (e) {
            return null;
        }
    }

    private static calcATR(bars: any[], period: number): number {
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

    private static async checkCorrelation(direction: 'BUY' | 'SELL'): Promise<boolean> {
        if (this.settings.symbol !== 'XAUUSD') return true;
        try {
            const resp = await this.bridgePost(`${this.BRIDGE_URL}/ticks`, { symbols: ['XAUUSD', 'BTCUSD', 'EURUSD'] });
            const data = resp.data || {};
            const gold = data['XAUUSD'] || {};
            const btc = data['BTCUSD'] || {};
            const eur = data['EURUSD'] || {};
            const gl = gold?.last || gold?.bid || 0;
            const bc = btc?.last || btc?.bid || 0;
            const eu = eur?.last || eur?.bid || 0;
            if (direction === 'BUY' && bc > 0 && gl > 0) {
                if (bc * 0.02 < Math.abs(gl - bc)) return true;
            }
            return true;
        } catch { return true; }
    }

    private static async evaluateEntry(analysis: DailyAnalysis) {
        if (analysis.setupCount === 0) return;

        // SAFETY LOCK: verificar DisciplineEngine antes de qualquer entrada
        try {
            const discipline = await DisciplineEngine.getDailyStatus();
            if (discipline.isLocked) {
                this.addLog('DISCIPLINA', `Safety Lock ativo: ${discipline.reason}`);
                console.log(`🦈 SharkBot: Safety Lock bloqueou entrada — ${discipline.reason}`);
                return;
            }
        } catch (e) {
            console.warn('🦈 SharkBot: Erro ao verificar DisciplineEngine', e);
        }

        // C8: trading hours filter
        if (!this.isTradingHours()) {
            console.log(`🦈 SharkBot: Fora do horário de operação (${this.settings.tradingStartHour}:00-${this.settings.tradingEndHour}:00 UTC)`);
            return;
        }

        // C7: spread filter
        const spread = await this.checkSpread();
        if (spread !== null && spread > this.settings.maxSpread) {
            console.log(`🦈 SharkBot: Spread ${spread} > max ${this.settings.maxSpread}, ignorando entrada`);
            return;
        }

        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) return;

        // C14: basic correlation check
        const correlationOk = await this.checkCorrelation('BUY');

        // BUY
        const latestBuy = analysis.setups.length > 0 ? analysis.setups[analysis.setups.length - 1] : null;
        if (latestBuy && currentPrice <= latestBuy.entradaLimit * 1.02 && correlationOk) {
            const sl = latestBuy.stopLoss;
            const risk = currentPrice - sl;
            if (risk >= currentPrice * 0.002 && this.validateSlTp(risk, currentPrice * 0.002)) {
                const tp = currentPrice + risk * 2;
                await this.placeTrade('BUY', currentPrice, sl, tp, latestBuy);
                return;
            } else {
                console.log('🦈 SharkBot: Risco muito pequeno para BUY');
            }
        } else if (latestBuy) {
            console.log(`🦈 SharkBot: Preço ${currentPrice.toFixed(2)} acima do FVG BUY ${latestBuy.entradaLimit.toFixed(2)}, aguardando recuo`);
        }

        // SELL
        const latestSell = analysis.setupsSell.length > 0 ? analysis.setupsSell[analysis.setupsSell.length - 1] : null;
        if (latestSell && currentPrice >= latestSell.entradaLimit * 0.98 && correlationOk) {
            const sl = latestSell.stopLoss;
            const risk = sl - currentPrice;
            if (risk >= currentPrice * 0.002 && this.validateSlTp(risk, currentPrice * 0.002)) {
                const tp = currentPrice - risk * 2;
                await this.placeTrade('SELL', currentPrice, sl, tp, latestSell);
                return;
            } else {
                console.log('🦈 SharkBot: Risco muito pequeno para SELL');
            }
        } else if (latestSell) {
            console.log(`🦈 SharkBot: Preço ${currentPrice.toFixed(2)} abaixo do FVG SELL ${latestSell.entradaLimit.toFixed(2)}, aguardando subida`);
        }
    }

    // C11: validate SL/TP are within acceptable ranges
    private static validateSlTp(risk: number, minRisk: number): boolean {
        if (risk < minRisk) return false;
        const maxRisk = this.settings.symbol.includes('USD') ? 5000 : 1000;
        if (risk > maxRisk) return false;
        return true;
    }

    private static async placeTrade(direction: 'BUY' | 'SELL', currentPrice: number, sl: number, tp: number, setup: FVGSignal) {
        console.log(`🦈 SharkBot: ENTRADA ${direction} ${this.settings.symbol} | Preço: ${currentPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | Gap: ${setup.gapSize.toFixed(2)}`);

        try {
            const orderPayload: any = {
                symbol: this.settings.symbol,
                lot: this.settings.lotSize,
                magic: this.MAGIC,
                comment: `SharkBot ${direction}`,
            };

            // C19: limit order support
            if (this.settings.useLimitOrders) {
                orderPayload.type = direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT';
                orderPayload.price = direction === 'BUY'
                    ? Math.min(currentPrice, setup.entradaLimit)
                    : Math.max(currentPrice, setup.entradaLimit);
                orderPayload.action = direction;
            } else {
                orderPayload.action = direction;
            }

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, orderPayload, { timeout: BRIDGE_TIMEOUT });
            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (ticket) {
                this.addLog('ENTRADA', `${direction} ${this.settings.symbol} | Preço: ${currentPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)}`);
                SymbolLockService.acquire(this.settings.symbol, 'Shark Bot', ticket, direction);
                this.state.position = {
                    ticket, type: direction, price: currentPrice, sl, tp, time: Date.now(),
                    partialCloseDone: false,
                };

                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Shark Bot', this.settings.symbol, direction, this.settings.lotSize, currentPrice, sl, tp);
                } catch (e) { }

                this.trades.push({
                    entryTime: Date.now(), exitTime: 0, entryPrice: currentPrice,
                    exitPrice: 0, direction, result: 'WIN', profit: 0,
                    fvgSize: setup.entradaLimit - setup.stopLoss,
                    gapSize: setup.gapSize,
                });
                this.saveTrades();

                AlertEngine.addAlert('GUARDIAN', 'INFO', 'SharkBot', `${direction} ${this.settings.symbol}: ${currentPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)}`);

                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.syncPosition();

                if (this.state.position) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket, sl: Math.round(sl * 100) / 100, tp: Math.round(tp * 100) / 100, magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                    } catch { console.warn('🦈 SharkBot: SL/TP update falhou'); }
                }
            }
        } catch (e) {
            console.error('🦈 SharkBot: Order failed', e);
        }
    }

    private static async managePosition() {
        if (!this.state.position) return;

        try {
            const currentPrice = await this.getCurrentPrice();
            if (!currentPrice) return;

            const pos = this.state.position;
            const isBuy = pos.type === 'BUY';
            const entry = pos.price;
            const tp = pos.tp;
            const sl = pos.sl;
            const totalDist = Math.abs(tp - entry);
            const halfWay = entry + (isBuy ? totalDist * 0.5 : -totalDist * 0.5);
            const priceNow = currentPrice;

            // C1: partial close at 50% TP
            if (this.settings.usePartialClose && !pos.partialCloseDone) {
                const reachedHalf = isBuy ? priceNow >= halfWay : priceNow <= halfWay;
                if (reachedHalf) {
                    pos.partialCloseDone = true;
                    const halfLot = this.settings.lotSize / 2;
                    try {
                        await axios.post(`${this.BRIDGE_URL}/close_partial`, {
                            ticket: pos.ticket,
                            volume: halfLot,
                            magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                        this.addLog('PARCIAL', `Fechado 50% (${halfLot} lotes) no primeiro target ${priceNow.toFixed(2)}`);
                        console.log(`🦈 SharkBot: Fechado 50% em ${priceNow.toFixed(2)}`);
                        // C2: move SL to breakeven after partial close
                        if (this.settings.useTrailingStop) {
                            const breakeven = isBuy ? entry + 1 : entry - 1;
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket,
                                sl: Math.round(breakeven * 100) / 100,
                                magic: this.MAGIC,
                            }, { timeout: BRIDGE_TIMEOUT });
                            pos.sl = breakeven;
                            this.addLog('BREAKEVEN', `SL ajustado para breakeven (${breakeven.toFixed(2)}) após fechamento parcial`);
                        }
                    } catch { console.warn('🦈 SharkBot: Fechamento parcial falhou'); }
                }
            }

            // C2: trailing stop after 50% TP
            if (this.settings.useTrailingStop && pos.partialCloseDone) {
                const atrValue = this.lastAnalysis?.atr || 0;
                const trailDist = Math.max(atrValue * 0.5, totalDist * 0.15);
                if (isBuy) {
                    const newSl = priceNow - trailDist;
                    if (newSl > pos.sl + 0.5) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: Math.round(newSl * 100) / 100,
                            magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                        pos.sl = newSl;
                        this.addLog('TRAILING', `SL ajustado para ${newSl.toFixed(2)} (trailing ${trailDist.toFixed(2)})`);
                    }
                } else {
                    const newSl = priceNow + trailDist;
                    if (newSl < pos.sl - 0.5) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: Math.round(newSl * 100) / 100,
                            magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                        pos.sl = newSl;
                        this.addLog('TRAILING', `SL ajustado para ${newSl.toFixed(2)} (trailing ${trailDist.toFixed(2)})`);
                    }
                }
            }

            // Legacy breakeven (fallback if partial close is disabled)
            if (!this.settings.usePartialClose) {
                if (isBuy && priceNow > entry + totalDist * 0.5) {
                    const breakeven = entry + 1;
                    if (pos.sl < breakeven) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: Math.round(breakeven * 100) / 100,
                            magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                        pos.sl = breakeven;
                        this.addLog('BREAKEVEN', `SL ajustado para ${breakeven.toFixed(2)} (BUY)`);
                    }
                } else if (!isBuy && priceNow < entry - totalDist * 0.5) {
                    const breakeven = entry - 1;
                    if (pos.sl > breakeven) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: Math.round(breakeven * 100) / 100,
                            magic: this.MAGIC,
                        }, { timeout: BRIDGE_TIMEOUT });
                        pos.sl = breakeven;
                        this.addLog('BREAKEVEN', `SL ajustado para ${breakeven.toFixed(2)} (SELL)`);
                    }
                }
            }

            // Check if position was closed externally (by MT5 SL/TP)
            try {
                const resp = await this.bridgeGet(`${this.BRIDGE_URL}/positions`);
                const positions: any[] = resp.data || [];
                const stillOpen = positions.find((p: any) => p.ticket === pos.ticket);
                if (!stillOpen) {
                    const lastTrade = this.trades.find(t => t.entryTime === pos.time);
                    if (lastTrade && lastTrade.exitTime === 0) {
                        const hitTp = isBuy ? priceNow >= tp : priceNow <= tp;
                        lastTrade.result = hitTp ? 'WIN' : 'LOSS';
                        lastTrade.exitTime = Date.now();
                        lastTrade.exitPrice = priceNow;
                        lastTrade.profit = hitTp ? this.settings.maxDailyProfit * 0.5 : -this.settings.maxDailyLoss * 0.3;
                        if (hitTp) this.state.dailyProfit += this.settings.maxDailyProfit * 0.5;
                        else this.state.dailyLoss += this.settings.maxDailyLoss * 0.3;
                        this.addLog('FECHOU', `${pos.type} ${this.settings.symbol} | ${hitTp ? 'WIN' : 'LOSS'} | P&L: $${(lastTrade.profit || 0).toFixed(2)}`);
                        this.saveTrades();
                        try {
                            const { TradeNotificationBot } = require('./TradeNotificationBot');
                            TradeNotificationBot.notifyTradeClosed('Shark Bot', this.settings.symbol, pos.type, lastTrade.profit || 0, hitTp ? 'WIN' : 'LOSS', hitTp ? 'Take Profit' : 'Stop Loss', this.settings.lotSize);
                        } catch (e) { }
                    }
                    this.state.position = null;
                    SymbolLockService.releaseByTicket(pos.ticket);
                }
            } catch { }
        } catch (e) {
            console.error('🦈 SharkBot: Manage position error', e);
        }
    }

    private static async syncPosition() {
        try {
            const resp = await this.bridgeGet(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const pos = positions.find((p: any) => p.symbol === this.settings.symbol && p.magic === this.MAGIC);
            const hadPosition = this.state.position !== null;

            if (pos && this.state.position) {
                this.state.position = {
                    ...this.state.position,
                    profit: pos.profit || 0,
                };
            }

            if (!pos) {
                if (hadPosition) {
                    const pending = this.trades.find(t => t.exitTime === 0);
                    if (pending) {
                        try {
                            const hist = await this.bridgeGet(`${this.BRIDGE_URL}/history`, { timeout: BRIDGE_TIMEOUT });
                            const trades: any[] = Array.isArray(hist.data) ? hist.data : [];
                            const closed = trades.find((t: any) => t.ticket === this.state.position?.ticket);
                            if (closed) {
                                const profit = (closed.profit || 0) + (closed.commission || 0) + (closed.swap || 0);
                                pending.exitTime = Date.now();
                                pending.exitPrice = closed.price || pending.entryPrice;
                                pending.profit = profit;
                                pending.result = profit >= 0 ? 'WIN' : 'LOSS';
                            } else {
                                pending.exitTime = Date.now();
                                pending.result = 'LOSS';
                                pending.profit = -this.settings.maxDailyLoss * 0.3;
                            }
                            this.addLog('FECHOU', `${pending.direction} ${this.settings.symbol} | ${pending.result} | P&L: $${(pending.profit || 0).toFixed(2)}`);
                            this.saveTrades();
                            try {
                                const { TradeNotificationBot } = require('./TradeNotificationBot');
                                TradeNotificationBot.notifyTradeClosed('Shark Bot', this.settings.symbol, pending.direction, pending.profit, pending.result, pending.result === 'WIN' ? 'Take Profit' : 'Stop Loss', this.settings.lotSize);
                            } catch (e) { }
                        } catch { }
                    }
                }
                this.state.position = null;
            } else if (!this.state.position || this.state.position.ticket !== pos.ticket) {
                this.state.position = {
                    ticket: pos.ticket,
                    type: pos.type === 'sell' || pos.type === 'SELL' ? 'SELL' : 'BUY',
                    price: pos.price_open,
                    sl: pos.sl,
                    tp: pos.tp,
                    time: pos.time || Date.now(),
                };
            }
        } catch {
            if (this.state.position) this.state.position = null;
        }
    }

    private static async getCurrentPrice(side?: 'BUY' | 'SELL'): Promise<number | null> {
        try {
            const resp = await this.bridgePost(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] });
            const data = resp.data || {};
            const tick = data[this.settings.symbol] || data;
            if (side === 'BUY') return tick?.ask || tick?.last || null;
            if (side === 'SELL') return tick?.bid || tick?.last || null;
            return tick?.ask || tick?.bid || tick?.last || null;
        } catch { return null; }
    }

    private static async resetDailyIfNeeded() {
        const now = new Date();
        const lastReset = new Date(this.state.lastBarTime);
        if (now.getUTCDate() !== lastReset.getUTCDate() || now.getUTCMonth() !== lastReset.getUTCMonth()) {
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            this.state.lastBarTime = now.getTime();
        }
    }
}
