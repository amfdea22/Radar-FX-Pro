import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';

interface SharkBotSettings {
    enabled: boolean;
    symbol: string;
    timeframe: string;
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    riskPercent: number;
    fvgMinAtrRatio: number;
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
}

export class SharkBotEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 9876;
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'shark_bot_settings.json');

    private static settings: SharkBotSettings = {
        enabled: false,
        symbol: 'XAUUSD',
        timeframe: 'H1',
        lotSize: 0.01,
        maxDailyLoss: 50,
        maxDailyProfit: 100,
        riskPercent: 1.0,
        fvgMinAtrRatio: 0.5,
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
        this.isRunning = true;
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

    static stop() {
        this.isRunning = false;
        console.log('🦈 SharkBot: Robô parado.');
    }

    private static async checkMargin(): Promise<boolean> {
        if (Date.now() - this.lastMarginCheck < 60000) return this.marginOk;
        this.lastMarginCheck = Date.now();
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/account`);
            const free = parseFloat(resp.data?.margin_free || '0');
            const balance = parseFloat(resp.data?.balance || '0');
            this.marginOk = free > balance * 0.15;
            if (!this.marginOk) console.log(`🦈 SharkBot: Margem insuficiente (livre: $${free.toFixed(2)})`);
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

    private static async loop() {
        while (this.isRunning) {
            try {
                if (this.settings.enabled) {
                    await this.syncPosition();
                    await this.resetDailyIfNeeded();
                    const analysis = await this.analyzeSmc();
                    if (analysis) {
                        this.lastAnalysis = analysis;
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
            } catch (error) {
                console.error('🦈 SharkBot: Loop error', error);
            }
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    private static calcEMA(values: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
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

                // Bearish FVG (gap down) -> BUY opportunity
                const gapBearExists = lowPrices[i - 2] > highPrices[i];
                const gapBearSize = gapBearExists ? lowPrices[i - 2] - highPrices[i] : 0;
                const gapBearRelevant = gapBearSize > this.settings.fvgMinAtrRatio * atr;
                const fvgBear = gapBearExists && gapBearRelevant;
                const buyEntry = lowPrices[i - 2];
                const buyArmed = fvgBear && buyEntry <= nivel50 && bars[i].c > sma50;

                // Bullish FVG (gap up) -> SELL opportunity
                const gapBullExists = highPrices[i - 2] < lowPrices[i];
                const gapBullSize = gapBullExists ? lowPrices[i] - highPrices[i - 2] : 0;
                const gapBullRelevant = gapBullSize > this.settings.fvgMinAtrRatio * atr;
                const fvgBull = gapBullExists && gapBullRelevant;
                const sellEntry = highPrices[i - 2];
                const sellArmed = fvgBull && sellEntry >= nivel50 && bars[i].c < sma50;

                if (fvgBear || fvgBull) fvgCount++;
                if (buyArmed) {
                    setupCount++;
                    setups.push({ entradaLimit: buyEntry, stopLoss: swingLow20, gapSize: gapBearSize, barIndex: i, swingLow: swingLow20, nivel50 });
                }
                if (sellArmed) {
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
                price,
                atr,
                swingHigh: lastSwingHigh,
                swingLow: lastSwingLow,
                nivel50: lastNivel50,
                sma50,
                fvgCount,
                bos: lastBos,
                setupCount,
                setups,
                setupsSell,
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

    private static async evaluateEntry(analysis: DailyAnalysis) {
        if (analysis.setupCount === 0) return;

        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) return;

        // BUY: find the most recent BUY setup where price is within range
        const latestBuy = analysis.setups.length > 0 ? analysis.setups[analysis.setups.length - 1] : null;
        if (latestBuy && currentPrice <= latestBuy.entradaLimit * 1.02) {
            const sl = latestBuy.stopLoss;
            const risk = currentPrice - sl;
            if (risk >= currentPrice * 0.002) {
                const tp = currentPrice + risk * 2;
                await this.placeTrade('BUY', currentPrice, sl, tp, latestBuy);
                return;
            } else {
                console.log('🦈 SharkBot: Risco muito pequeno para BUY');
            }
        } else if (latestBuy) {
            console.log(`🦈 SharkBot: Preço ${currentPrice.toFixed(2)} acima do FVG BUY ${latestBuy.entradaLimit.toFixed(2)}, aguardando recuo`);
        }

        // SELL: find the most recent SELL setup where price is within range
        const latestSell = analysis.setupsSell.length > 0 ? analysis.setupsSell[analysis.setupsSell.length - 1] : null;
        if (latestSell && currentPrice >= latestSell.entradaLimit * 0.98) {
            const sl = latestSell.stopLoss;
            const risk = sl - currentPrice;
            if (risk >= currentPrice * 0.002) {
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

    private static async placeTrade(direction: 'BUY' | 'SELL', currentPrice: number, sl: number, tp: number, setup: FVGSignal) {
        console.log(`🦈 SharkBot: ENTRADA ${direction} ${this.settings.symbol} | Preço: ${currentPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | Gap: ${setup.gapSize.toFixed(2)}`);

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: this.settings.symbol,
                action: direction,
                lot: this.settings.lotSize,
                magic: this.MAGIC,
                comment: `SharkBot ${direction}`,
            });

            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (ticket) {
                SymbolLockService.acquire(this.settings.symbol, 'Shark Bot', ticket, direction);
                this.state.position = {
                    ticket, type: direction, price: currentPrice, sl, tp, time: Date.now(),
                };

                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Shark Bot', this.settings.symbol, direction, this.settings.lotSize, currentPrice, sl, tp);
                } catch (e) { /* notif fail */ }

                this.trades.push({
                    entryTime: Date.now(), exitTime: 0, entryPrice: currentPrice,
                    exitPrice: 0, direction, result: 'WIN', profit: 0,
                    fvgSize: setup.entradaLimit - setup.stopLoss,
                    gapSize: setup.gapSize,
                });

                AlertEngine.addAlert('GUARDIAN', 'INFO', 'SharkBot', `${direction} ${this.settings.symbol}: ${currentPrice.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)}`);

                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.syncPosition();

                if (this.state.position) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket, sl: Math.round(sl * 100) / 100, tp: Math.round(tp * 100) / 100, magic: this.MAGIC,
                        });
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

            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const pos = positions.find((p: any) => p.ticket === this.state.position!.ticket);

            if (!pos) {
                const isBuy = this.state.position.type === 'BUY';
                const hitTp = isBuy ? this.state.position.tp <= currentPrice : this.state.position.tp >= currentPrice;
                const lastTrade = this.trades.find(t => t.entryTime === this.state.position!.time);
                if (lastTrade) {
                    lastTrade.result = hitTp ? 'WIN' : 'LOSS';
                    lastTrade.exitTime = Date.now();
                    lastTrade.exitPrice = currentPrice;
                    lastTrade.profit = hitTp ? this.settings.maxDailyProfit * 0.5 : -this.settings.maxDailyLoss * 0.3;
                }
                if (hitTp) this.state.dailyProfit += this.settings.maxDailyProfit * 0.5;
                else this.state.dailyLoss += this.settings.maxDailyLoss * 0.3;

                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeClosed('Shark Bot', this.settings.symbol, this.state.position.type, lastTrade?.profit || 0, hitTp ? 'WIN' : 'LOSS', hitTp ? 'Take Profit' : 'Stop Loss', this.settings.lotSize);
                } catch (e) { /* notif fail */ }

                this.state.position = null;
                return;
            }

            const priceNow = pos.price_current || currentPrice;
            // Breakeven: for BUY move SL up, for SELL move SL down
            if (this.state.position.type === 'BUY' && priceNow > this.state.position.price + (this.state.position.tp - this.state.position.price) * 0.5) {
                const breakeven = this.state.position.price + 1;
                if (this.state.position.sl < breakeven) {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, {
                        ticket: this.state.position.ticket,
                        sl: Math.round(breakeven * 100) / 100,
                        magic: this.MAGIC
                    });
                    this.state.position.sl = breakeven;
                    console.log('🦈 SharkBot: Stop ajustado para breakeven');
                }
            } else if (this.state.position.type === 'SELL' && priceNow < this.state.position.price - (this.state.position.price - this.state.position.tp) * 0.5) {
                const breakeven = this.state.position.price - 1;
                if (this.state.position.sl > breakeven) {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, {
                        ticket: this.state.position.ticket,
                        sl: Math.round(breakeven * 100) / 100,
                        magic: this.MAGIC
                    });
                    this.state.position.sl = breakeven;
                    console.log('🦈 SharkBot: Stop ajustado para breakeven (SELL)');
                }
            }
        } catch (e) {
            console.error('🦈 SharkBot: Manage position error', e);
        }
    }

    private static async syncPosition() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const pos = positions.find((p: any) => p.symbol === this.settings.symbol && p.magic === this.MAGIC);
            if (!pos) {
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
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, {
                symbols: [this.settings.symbol],
            });
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
