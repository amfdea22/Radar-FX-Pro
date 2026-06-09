import axios from 'axios';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';
import { SymbolLockService } from './SymbolLockService';
import { TradeNotificationBot } from './TradeNotificationBot';

interface BitcoinProSettings {
    enabled: boolean;
    symbol: string;
    lotSize: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
}

interface BitcoinProState {
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

interface TradeRecord {
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    direction: 'BUY' | 'SELL';
    result: 'WIN' | 'LOSS';
    profit: number;
    conditions: {
        trendBullish: boolean;
        ema50SlopeUp: boolean;
        pullbackToEma: boolean;
        nearPullback: boolean;
        rsiSignal: boolean;
        rsiInRange: boolean;
    };
}

interface IndicatorPerformance {
    signalCount: number;
    winCount: number;
    winRate: number;
    label: string;
}

interface DailyAnalysis {
    price: number;
    ema50: number;
    ema200: number;
    ema50Slope: 'UP' | 'DOWN' | 'FLAT';
    trend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' | 'FLAT';
    rsi: number;
    distanceToEma50: number;
    pullbackToEma: boolean;
    rsiSignal: boolean;
    entryScore: number;
    direction: 'BUY' | 'SELL';
    swingLow: number;
    swingHigh: number;
}

export class BitcoinProEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 444111;

    private static settings: BitcoinProSettings = {
        enabled: false,
        symbol: 'BTCUSD',
        lotSize: 0.01,
        maxDailyLoss: 50,
        maxDailyProfit: 100,
    };

    private static state: BitcoinProState = {
        lastBarTime: 0,
        position: null,
        dailyProfit: 0,
        dailyLoss: 0,
    };

    private static isRunning = false;
    private static lastAnalysis: DailyAnalysis | null = null;
    private static trades: TradeRecord[] = [];
    private static marginOk = false;
    private static lastMarginCheck = 0;

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state,
            isRunning: this.isRunning,
            lastAnalysis: this.lastAnalysis,
            marginOk: this.marginOk,
            performance: this.computePerformance(),
            stats: this.computeStrategyStats(),
            trades: this.trades.slice(-20).reverse(),
        };
    }

    static getPerformance() {
        return this.computePerformance();
    }

    private static computeStrategyStats() {
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
            totalTrades: total,
            winCount,
            lossCount,
            winRate,
            totalProfit: Math.round(totalProfit * 100) / 100,
            avgWin: Math.round(avgWin * 100) / 100,
            avgLoss: Math.round(avgLoss * 100) / 100,
            profitFactor: Math.round(profitFactor * 100) / 100,
            maxConsecutiveWins,
            maxConsecutiveLosses,
            bestTrade: Math.round(bestTrade * 100) / 100,
            worstTrade: Math.round(worstTrade * 100) / 100,
        };
    }

    private static computePerformance(): IndicatorPerformance[] {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.result === 'WIN').length;

        const indicators: { key: keyof TradeRecord['conditions']; label: string }[] = [
            { key: 'trendBullish', label: 'Tendência Bullish' },
            { key: 'ema50SlopeUp', label: 'EMA50 Inclinação' },
            { key: 'pullbackToEma', label: 'Recuo EMA50' },
            { key: 'nearPullback', label: 'Recuo Parcial' },
            { key: 'rsiSignal', label: 'RSI Sinal' },
            { key: 'rsiInRange', label: 'RSI Zona 40-60' },
        ];

        return indicators.map(ind => {
            const withSignal = this.trades.filter(t => t.conditions[ind.key]);
            const winsWith = withSignal.filter(t => t.result === 'WIN');
            return {
                label: ind.label,
                signalCount: withSignal.length,
                winCount: winsWith.length,
                winRate: withSignal.length > 0 ? (winsWith.length / withSignal.length) * 100 : 0,
            };
        }).concat({
            label: 'Geral (Todos os trades)',
            signalCount: total,
            winCount: wins,
            winRate: total > 0 ? (wins / total) * 100 : 0,
        });
    }

    static updateSettings(partial: Partial<BitcoinProSettings>) {
        this.settings = { ...this.settings, ...partial };
    }

    static async init() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('₿ BitcoinPro: Iniciando robô estratégia 50/200 + RSI...');
        this.loop();
    }

    static stop() {
        this.isRunning = false;
        console.log('₿ BitcoinPro: Robô parado.');
    }

    private static async checkMargin(): Promise<boolean> {
        if (Date.now() - this.lastMarginCheck < 60000) return this.marginOk;
        this.lastMarginCheck = Date.now();
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/account`);
            const free = parseFloat(resp.data?.margin_free || '0');
            const balance = parseFloat(resp.data?.balance || '0');
            this.marginOk = free > balance * 0.15;
            if (!this.marginOk) console.log(`₿ BitcoinPro: Margem insuficiente (livre: $${free.toFixed(2)})`);
            return this.marginOk;
        } catch {
            this.marginOk = false;
            return false;
        }
    }

    private static async loop() {
        while (this.isRunning) {
            try {
                if (this.settings.enabled) {
                    await this.syncPosition();
                    await this.resetDailyIfNeeded();
                    const analysis = await this.analyzeDaily();
                    if (analysis) {
                        this.lastAnalysis = analysis;
                        if (!this.state.position) {
                            if (this.state.dailyLoss >= this.settings.maxDailyLoss) {
                                if (this.state.dailyLoss === this.settings.maxDailyLoss) {
                                    console.log(`₿ BitcoinPro: Limite de perda diária atingido ($${this.state.dailyLoss.toFixed(2)}). Bloqueado.`);
                                }
                            } else if (this.state.dailyProfit >= this.settings.maxDailyProfit) {
                                if (this.state.dailyProfit === this.settings.maxDailyProfit) {
                                    console.log(`₿ BitcoinPro: Meta diária atingida ($${this.state.dailyProfit.toFixed(2)}). Bloqueado.`);
                                }
                            } else {
                                const marginSufficient = await this.checkMargin();
                                if (marginSufficient) {
                                    await this.evaluateEntry(analysis);
                                }
                            }
                        } else {
                            await this.managePosition(analysis);
                        }
                    }
                }
            } catch (error) {
                console.error('₿ BitcoinPro: Loop error', error);
            }
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    private static async analyzeDaily(): Promise<DailyAnalysis | null> {
        try {
            let bars = await MarketDataService.getRecentBars(this.settings.symbol, 250, 'D1');
            bars = [...bars].reverse();
            if (bars.length < 210) return null;

            const closePrices = bars.map(b => b.c);
            const highPrices = bars.map(b => b.h);
            const lowPrices = bars.map(b => b.l);

            const ema50 = this.calcEMA(closePrices, 50);
            const ema200 = this.calcEMA(closePrices, 200);

            const ema50Prev = this.calcEMA(closePrices.slice(0, -1), 50);
            const ema50Slope = ema50 > ema50Prev * 1.0005 ? 'UP' : ema50 < ema50Prev * 0.9995 ? 'DOWN' : 'FLAT';

            const price = bars[bars.length - 1].c;

            const trend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' | 'FLAT' =
                price > ema50 && ema50 > ema200 ? 'STRONG_BULLISH' :
                price > ema50 ? 'BULLISH' :
                price < ema50 && ema50 < ema200 ? 'STRONG_BEARISH' :
                price < ema50 ? 'BEARISH' : 'FLAT';

            const rsi = this.calcRSI(closePrices, 14);
            const rsiPrev = this.calcRSI(closePrices.slice(0, -1), 14);

            const distanceToEma50 = ((price - ema50) / ema50) * 100;

            const pullbackToEma = distanceToEma50 > -3.0 && distanceToEma50 < 3.0;

            const nearPullback = !pullbackToEma && distanceToEma50 > -5.0 && distanceToEma50 < 5.0;

            const rsiSignal = rsi > 40 && rsi < 60 && rsi > rsiPrev;

            const lookback = Math.min(30, bars.length - 1);
            const swingLow = Math.min(...lowPrices.slice(-lookback));
            const swingHigh = Math.max(...highPrices.slice(-lookback));

            const rsiBullSignal = rsi > 40 && rsi < 60 && rsi > rsiPrev;
            const rsiBearSignal = rsi > 40 && rsi < 60 && rsi < rsiPrev;

            let bullScore = 0, bearScore = 0;
            if (trend === 'STRONG_BULLISH') bullScore += 30;
            else if (trend === 'BULLISH') bullScore += 15;
            if (trend === 'STRONG_BEARISH') bearScore += 30;
            else if (trend === 'BEARISH') bearScore += 15;
            if (ema50Slope === 'UP') bullScore += 15;
            if (ema50Slope === 'DOWN') bearScore += 15;
            if (pullbackToEma) { bullScore += 25; bearScore += 25; }
            else if (nearPullback) { bullScore += 10; bearScore += 10; }
            if (rsiBullSignal) bullScore += 20;
            else if (rsi > 40 && rsi < 60) bullScore += 10;
            if (rsiBearSignal) bearScore += 20;
            else if (rsi > 40 && rsi < 60) bearScore += 10;

            const entryScore = Math.max(bullScore, bearScore);
            const direction: 'BUY' | 'SELL' = bullScore >= bearScore ? 'BUY' : 'SELL';

            return {
                price,
                ema50,
                ema200,
                ema50Slope,
                trend,
                rsi,
                distanceToEma50,
                pullbackToEma,
                rsiSignal,
                entryScore,
                direction,
                swingLow,
                swingHigh,
            };
        } catch (e) {
            return null;
        }
    }

    private static async getCurrentPrice(): Promise<number | null> {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, {
                symbols: [this.settings.symbol],
            });
            const data = resp.data || {};
            const tick = data[this.settings.symbol] || data;
            return tick?.ask || tick?.bid || tick?.last || null;
        } catch { return null; }
    }

    private static async evaluateEntry(analysis: DailyAnalysis) {
        if (analysis.entryScore < 50) return;

        const currentPrice = await this.getCurrentPrice();
        if (!currentPrice) { console.log('₿ BitcoinPro: No current price'); return; }

        if (analysis.direction === 'BUY' && currentPrice > analysis.ema50 * 1.08) {
            console.log('₿ BitcoinPro: Price too far from EMA for BUY'); return;
        }
        if (analysis.direction === 'SELL' && currentPrice < analysis.ema50 * 0.92) {
            console.log('₿ BitcoinPro: Price too far from EMA for SELL'); return;
        }

        let sl: number, tp: number;
        const swingRange = analysis.swingHigh - analysis.swingLow;

        if (analysis.direction === 'BUY') {
            if (currentPrice > analysis.swingLow) {
                sl = analysis.swingLow - swingRange * 0.15;
            } else {
                sl = currentPrice * 0.93;
            }
            const risk = currentPrice - sl;
            if (risk < currentPrice * 0.005) { console.log('₿ BitcoinPro: Risk too small for BUY'); return; }
            tp = currentPrice + Math.max(risk, currentPrice * 0.02) * 2;
        } else {
            if (currentPrice < analysis.swingHigh) {
                sl = analysis.swingHigh + swingRange * 0.15;
            } else {
                sl = currentPrice * 1.07;
            }
            const risk = sl - currentPrice;
            if (risk < currentPrice * 0.005) { console.log('₿ BitcoinPro: Risk too small for SELL'); return; }
            tp = currentPrice - Math.max(risk, currentPrice * 0.02) * 2;
        }

        const action = analysis.direction === 'BUY' ? 'BUY' : 'SELL';

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: this.settings.symbol,
                action,
                lot: this.settings.lotSize,
                magic: this.MAGIC,
                comment: 'BitcoinPro',
            });

            const ticket = resp.data?.order_id || resp.data?.ticket;
            if (ticket) {
                SymbolLockService.acquire(this.settings.symbol, 'Bitcoin Pro', ticket, action);
                this.state.position = {
                    ticket,
                    type: analysis.direction,
                    price: currentPrice,
                    sl,
                    tp,
                    time: Date.now(),
                };

                const tradeRec: TradeRecord = {
                    entryTime: Date.now(),
                    exitTime: 0,
                    entryPrice: currentPrice,
                    exitPrice: 0,
                    direction: analysis.direction,
                    result: 'WIN',
                    profit: 0,
                    conditions: {
                        trendBullish: analysis.trend === 'BULLISH' || analysis.trend === 'STRONG_BULLISH',
                        ema50SlopeUp: analysis.ema50Slope === 'UP',
                        pullbackToEma: analysis.pullbackToEma,
                        nearPullback: !analysis.pullbackToEma && analysis.distanceToEma50 > -5.0 && analysis.distanceToEma50 < 5.0,
                        rsiSignal: analysis.rsiSignal,
                        rsiInRange: analysis.rsi > 40 && analysis.rsi < 60,
                    },
                };
                this.trades.push(tradeRec);

                AlertEngine.addAlert('GUARDIAN', 'INFO', 'BitcoinPro', `${action} BTC: ${currentPrice} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | Score: ${analysis.entryScore}`);

                try {
                    
                    TradeNotificationBot.notifyTradeOpened('Bitcoin Pro', this.settings.symbol, action, this.settings.lotSize, currentPrice, sl, tp);
                } catch (e) { /* notif fail */ }

                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.syncPosition();

                if (this.state.position) {
                    const realSl = analysis.direction === 'BUY'
                        ? Math.min(this.state.position.sl || Infinity, Math.round(sl * 100) / 100)
                        : Math.max(this.state.position.sl || 0, Math.round(sl * 100) / 100);
                    const realTp = analysis.direction === 'BUY'
                        ? Math.max(this.state.position.tp || 0, Math.round(tp * 100) / 100)
                        : Math.min(this.state.position.tp || Infinity, Math.round(tp * 100) / 100);
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket,
                            sl: realSl,
                            tp: realTp,
                            magic: this.MAGIC,
                        });
                    } catch (e2) {
                        console.warn('₿ BitcoinPro: SL/TP via update_order falhou');
                    }
                }
            }
        } catch (e) {
            console.error('₿ BitcoinPro: Order failed', e);
        }
    }

    private static async managePosition(analysis: DailyAnalysis) {
        if (!this.state.position) return;

        try {
            const currentPrice = await this.getCurrentPrice() || analysis.price;
            const position = this.state.position;
            if (!position) return;

            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const pos = positions.find((p: any) => p.ticket === position.ticket);

            if (!pos) {
                let result: 'WIN' | 'LOSS' = 'LOSS';
                let profit = -this.settings.maxDailyLoss * 0.3;

                const lastTrade = this.trades.find(t => t.entryTime === position.time);
                const hitTp = this.state.position.type === 'BUY'
                    ? this.state.position.tp <= currentPrice
                    : this.state.position.tp >= currentPrice;

                if (hitTp) {
                    result = 'WIN';
                    profit = this.settings.maxDailyProfit * 0.5;
                }

                if (lastTrade) {
                    lastTrade.result = result;
                    lastTrade.exitTime = Date.now();
                    lastTrade.exitPrice = currentPrice;
                    lastTrade.profit = Math.round(profit * 100) / 100;
                }

                if (profit > 0) this.state.dailyProfit += profit;
                else this.state.dailyLoss += Math.abs(profit);

                try {
                    
                    const dir = this.state.position?.type || (profit > 0 ? 'BUY' : 'SELL');
                    TradeNotificationBot.notifyTradeClosed('Bitcoin Pro', this.settings.symbol, dir, Math.round(profit * 100) / 100, result, hitTp ? 'Take Profit' : 'Stop Loss', this.settings.lotSize);
                } catch (e) { /* notif fail */ }

                this.state.position = null;
                return;
            }

            const priceNow = pos.price_current || currentPrice;

            // Breakeven at 50% of TP
            const isBuy = this.state.position.type === 'BUY';
            const entry = this.state.position.price;
            const tp = this.state.position.tp;
            const tpDistance = isBuy ? tp - entry : entry - tp;
            const currentDistance = isBuy ? priceNow - entry : entry - priceNow;
            if (tpDistance > 0 && currentDistance >= tpDistance * 0.5) {
                const bePrice = isBuy ? entry + 0.01 : entry - 0.01;
                if ((isBuy && this.state.position.sl < entry) || (!isBuy && this.state.position.sl > entry)) {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, {
                        ticket: this.state.position.ticket,
                        sl: Math.round(bePrice * 100) / 100,
                        magic: this.MAGIC
                    });
                    this.state.position.sl = bePrice;
                    console.log(`₿ BitcoinPro: Breakeven ativado #${this.state.position.ticket}`);
                }
            }

            if (this.state.position.type === 'BUY') {
                const trailActivation = this.state.position.price + (priceNow - this.state.position.price) * 0.4;
                if (priceNow > trailActivation && priceNow > this.state.position.price) {
                    const newSl = this.state.position.price + (priceNow - this.state.position.price) * 0.25;
                    if (newSl > this.state.position.sl) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: this.state.position.ticket,
                            sl: Math.round(newSl * 100) / 100,
                            magic: this.MAGIC
                        });
                        this.state.position.sl = newSl;
                    }
                }
            } else {
                const trailActivation = this.state.position.price - (this.state.position.price - priceNow) * 0.4;
                if (priceNow < trailActivation && priceNow < this.state.position.price) {
                    const newSl = this.state.position.price - (this.state.position.price - priceNow) * 0.25;
                    if (newSl < this.state.position.sl) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: this.state.position.ticket,
                            sl: Math.round(newSl * 100) / 100,
                            magic: this.MAGIC
                        });
                        this.state.position.sl = newSl;
                    }
                }
            }
        } catch (e) {
            console.error('₿ BitcoinPro: Manage position error', e);
        }
    }

    private static async syncPosition() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`);
            const positions: any[] = resp.data || [];
            const btcPos = positions.find(p => p.symbol === this.settings.symbol && p.magic === this.MAGIC);
            if (!btcPos) {
                this.state.position = null;
            } else if (!this.state.position || this.state.position.ticket !== btcPos.ticket) {
                this.state.position = {
                    ticket: btcPos.ticket,
                    type: btcPos.type === 1 ? 'SELL' : 'BUY',
                    price: btcPos.price_open,
                    sl: btcPos.sl,
                    tp: btcPos.tp,
                    time: btcPos.time || Date.now(),
                };
            }
        } catch (e) {
            if (this.state.position) {
                this.state.position = null;
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

    private static calcRSI(values: number[], period: number): number {
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = values[i] - values[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        let avgGain = gains / period, avgLoss = losses / period;
        for (let i = period + 1; i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
            avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        }
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }
}
