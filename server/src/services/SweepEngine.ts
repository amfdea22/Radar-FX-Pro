import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { SymbolLockService } from './SymbolLockService';
import { DisciplineEngine } from './DisciplineEngine';

const HISTORY_PATH = path.join(process.cwd(), 'sweep_trade_history.json');

interface SweepSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    riskUSD: number;
    minSwingDistance: number;
    atrSlMultiplier: number;
    atrTpMultiplier: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    cooldownMinutes: number;
    magic: number;
    useProgressiveTrailing: boolean;
    useFastReversal: boolean;
}

interface SwingPoint {
    time: number;
    price: number;
    type: 'HIGH' | 'LOW';
}

interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface SweepSignal {
    symbol: string;
    direction: 'BUY' | 'SELL';
    sweepLevel: number;
    entryPrice: number;
    sl: number;
    tp: number;
    swingPoint: SwingPoint;
    score: number;
}

interface SweepPosition {
    ticket: number;
    symbol: string;
    type: number;
    volume: number;
    price_open: number;
    sl: number;
    tp: number;
    profit: number;
    comment: string;
}

interface TradeRecord {
    time: string;
    symbol: string;
    direction: string;
    entry: number;
    exit?: number;
    profit: number;
    ticket: number;
}

interface SignalRecord {
    time: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    score: number;
    sweepLevel: number;
    entryPrice: number;
    executed: boolean;
}

const SETTINGS_PATH = path.join(process.cwd(), 'sweep_settings.json');

export class SweepEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static settings: SweepSettings = {
        enabled: true,
        symbols: ['XAUUSD', 'BTCUSD'],
        lotSize: 0.01,
        riskUSD: 10.0,
        minSwingDistance: 0.05,
        atrSlMultiplier: 1.5,
        atrTpMultiplier: 2.0,
        maxDailyLoss: 50,
        maxDailyProfit: 100,
        cooldownMinutes: 15,
        magic: 777555,
        useProgressiveTrailing: true,
        useFastReversal: true
    };

    private static state = {
        swingHighs: {} as Record<string, SwingPoint[]>,
        swingLows: {} as Record<string, SwingPoint[]>,
        lastSweepTime: {} as Record<string, number>,
        positions: [] as SweepPosition[],
        dailyProfit: 0,
        dailyLoss: 0,
        isProcessing: false,
        isExecuting: false,
        lastResetDay: '',
        logs: [] as { time: string; msg: string; type: 'INFO' | 'TRADE' | 'WARN' | 'SIGNAL' }[],
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalProfitClosed: 0,
        tradeHistory: [] as TradeRecord[],
        signalHistory: [] as SignalRecord[],
        prevPositionTickets: new Set<number>(),
        prevPositionProfits: {} as Record<number, number>
    };

    private static intervalId: NodeJS.Timeout | null = null;

    static init() {
        this.loadSettings();
        this.loadTradeHistory();
        console.log('🧹 Sweep H4 M15 v1.0 ONLINE (30s Cycle) | Symbols:', this.settings.symbols.join(', '));
        this.intervalId = setInterval(() => this.mainCycle(), 30000);
        setTimeout(() => this.mainCycle(), 3000);
        
        // Sincronização inicial com MT5
        setTimeout(() => this.syncTradesFromMT5(), 5000);
    }

    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.settings.enabled = false;
        this.addLog('Sweep Engine parado.', 'INFO');
        console.log('[Sweep] Engine parado.');
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
            }
        } catch (err) {
            console.error('SweepEngine: Error loading settings:', err);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (err) {
            console.error('SweepEngine: Error saving settings:', err);
        }
    }

    private static loadTradeHistory() {
        try {
            if (fs.existsSync(HISTORY_PATH)) {
                const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
                this.state.tradeHistory = data.tradeHistory || [];
                this.state.signalHistory = data.signalHistory || [];
                this.state.wins = data.wins || 0;
                this.state.losses = data.losses || 0;
                this.state.totalTrades = data.totalTrades || 0;
                this.state.totalProfitClosed = data.totalProfitClosed || 0;
                this.state.dailyProfit = data.dailyProfit || 0;
                this.state.dailyLoss = Math.abs(data.dailyLoss || 0); // Store as positive magnitude
                this.state.lastResetDay = data.lastResetDay || '';
                console.log('[Sweep] Histórico de trades carregado:', this.state.tradeHistory.length, 'trades');
            }
        } catch (err) {
            console.error('SweepEngine: Error loading trade history:', err);
        }
    }

    private static saveTradeHistory() {
        try {
            const data = {
                tradeHistory: this.state.tradeHistory,
                signalHistory: this.state.signalHistory,
                wins: this.state.wins,
                losses: this.state.losses,
                totalTrades: this.state.totalTrades,
                totalProfitClosed: this.state.totalProfitClosed,
                dailyProfit: this.state.dailyProfit,
                dailyLoss: this.state.dailyLoss,
                lastResetDay: this.state.lastResetDay
            };
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('SweepEngine: Error saving trade history:', err);
        }
    }

    static updateSettings(newSettings: Partial<SweepSettings>) {
        if (newSettings.cooldownMinutes !== undefined && newSettings.cooldownMinutes < 1) {
            newSettings.cooldownMinutes = 1;
        }
        if (newSettings.maxDailyLoss !== undefined && newSettings.maxDailyLoss < 0) {
            newSettings.maxDailyLoss = Math.abs(newSettings.maxDailyLoss);
        }
        if (newSettings.riskUSD !== undefined && newSettings.riskUSD < 0) {
            newSettings.riskUSD = 0;
        }
        if (newSettings.lotSize !== undefined) {
            newSettings.lotSize = Math.max(0.01, Math.min(newSettings.lotSize, 10));
        }
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    static getStatus() {
        return {
            settings: this.settings,
            swingHighs: this.state.swingHighs,
            swingLows: this.state.swingLows,
            positions: this.state.positions,
            isExecuting: this.state.isExecuting,
            dailyProfit: this.state.dailyProfit,
            dailyLoss: this.state.dailyLoss,
            totalTrades: this.state.totalTrades,
            wins: this.state.wins,
            losses: this.state.losses,
            totalProfitClosed: this.state.totalProfitClosed,
            tradeHistory: this.state.tradeHistory.slice(0, 30),
            signalHistory: this.state.signalHistory.slice(0, 30),
            logs: this.state.logs.slice(0, 30),
            uptime: Math.floor((Date.now() - this._startTime) / 1000)
        };
    }

    private static _startTime = Date.now();

    static resetDailyCounters() {
        this.state.dailyProfit = 0;
        this.state.dailyLoss = 0;
        this.state.wins = 0;
        this.state.losses = 0;
        this.state.totalTrades = 0;
        this.state.totalProfitClosed = 0;
        this.state.lastResetDay = new Date().toISOString().slice(0, 10);
        this.state.tradeHistory = [];
        this.state.signalHistory = [];
        this.saveTradeHistory();
        return true;
    }

    private static addLog(msg: string, type: 'INFO' | 'TRADE' | 'WARN' | 'SIGNAL' = 'INFO') {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.state.logs.unshift({ time, msg, type });
        if (this.state.logs.length > 60) this.state.logs.pop();
        console.log(`[Sweep] ${msg}`);
    }

    private static async mainCycle() {
        if (!this.settings.enabled || this.state.isProcessing) return;
        this.state.isProcessing = true;

        try {
            this.checkDailyReset();

            // Verifica disciplina global
            const discipline = await DisciplineEngine.getDailyStatus();
            if (discipline.isLocked) {
                this.addLog(`⛔ Safety Lock: ${discipline.reason}`, 'WARN');
                this.state.isProcessing = false;
                return;
            }

            if (this.state.dailyLoss >= this.settings.maxDailyLoss) {
                this.addLog(`Limite de perda diária atingido.`, 'WARN');
                this.state.isProcessing = false;
                return;
            }
            if (this.state.dailyProfit >= this.settings.maxDailyProfit) {
                this.addLog(`Limite de lucro diário atingido.`, 'INFO');
                this.state.isProcessing = false;
                return;
            }

            await this.syncPositions();

            // Sincronização periódica com histórico do MT5 (a cada 5 ciclos ~2.5min)
            if (Math.floor(Date.now() / 150000) % 5 === 0) {
                await this.syncTradesFromMT5();
            }

            for (const symbol of this.settings.symbols) {
                try {
                    await this.processSymbol(symbol);
                } catch (err) {
                    this.addLog(`Erro em ${symbol}: ${(err as any).message}`, 'WARN');
                }
            }

            // Trailing stop
            await this.applyTrailingStop();

        } catch (err) {
            console.error('Sweep Cycle Error:', (err as any).message);
        } finally {
            this.state.isProcessing = false;
        }
    }

    private static checkDailyReset() {
        const today = new Date().toISOString().slice(0, 10);
        if (this.state.lastResetDay !== today) {
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            this.state.lastResetDay = today;
            this.state.lastSweepTime = {};
        }
    }

    private static async syncPositions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions?magic=${this.settings.magic}`, { timeout: 10000 });
            const rawPositions = Array.isArray(resp.data) ? resp.data : [];
            const newPositions = rawPositions.map((p: any) => ({
                ticket: p.ticket,
                symbol: p.symbol,
                type: p.type,
                volume: p.volume,
                price_open: p.price_open,
                sl: p.sl,
                tp: p.tp,
                profit: p.profit || 0,
                comment: p.comment || ''
            }));

            // Detectar posições fechadas e registrar no histórico
            const newTicketSet = new Set(newPositions.map((p: any) => p.ticket));
            for (const oldPos of this.state.positions) {
                if (!newTicketSet.has(oldPos.ticket)) {
                    this.state.totalTrades++;
                    const closedProfit = oldPos.profit || 0;
                    this.state.totalProfitClosed += closedProfit;

                    // Atualiza P&L diário APENAS com trades fechados (realizado)
                    if (closedProfit > 0) {
                        this.state.wins++;
                        this.state.dailyProfit += closedProfit;
                    } else if (closedProfit < 0) {
                        this.state.losses++;
                        this.state.dailyLoss += Math.abs(closedProfit); // Magnitude positiva
                    }

                    this.state.tradeHistory.unshift({
                        time: new Date().toISOString(),
                        symbol: oldPos.symbol,
                        direction: oldPos.type === 0 ? 'BUY' : 'SELL',
                        entry: oldPos.price_open,
                        profit: closedProfit,
                        ticket: oldPos.ticket
                    });
                    if (this.state.tradeHistory.length > 100) this.state.tradeHistory.pop();
                    this.addLog(`Posição fechada ${oldPos.symbol} ${oldPos.type === 0 ? 'BUY' : 'SELL'} P&L: ${closedProfit >= 0 ? '+' : ''}${closedProfit.toFixed(2)}`, 'TRADE');
                    this.saveTradeHistory();
                }
            }

            this.state.positions = newPositions;
        } catch {
            this.state.positions = [];
            this.addLog('Falha ao sincronizar posições com o bridge', 'WARN');
        }
    }

    // Sincroniza histórico completo do MT5 para recuperar trades perdidos (ex: reinício do servidor)
    private static async syncTradesFromMT5() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 15000 });
            const history = Array.isArray(resp.data) ? resp.data : [];
            const today = new Date().toISOString().split('T')[0];

            // Filtrar apenas trades de hoje e do nosso magic
            const todayTrades = history.filter((t: any) => 
                t.time > new Date(today).getTime() / 1000 && 
                t.magic === this.settings.magic &&
                t.entry === 1 // Apenas entradas (ordens de mercado fechadas)
            );

            // Reconstruir contadores do dia baseado no histórico real do MT5
            let profitSum = 0;
            let lossSum = 0;
            let wins = 0;
            let losses = 0;

            for (const t of todayTrades) {
                const pnl = t.profit || 0;
                if (pnl > 0) { profitSum += pnl; wins++; }
                else if (pnl < 0) { lossSum += Math.abs(pnl); losses++; }
            }

            // Atualizar estado apenas se o MT5 tiver mais trades do que nós (recuperação)
            if (todayTrades.length > this.state.tradeHistory.length) {
                this.state.dailyProfit = profitSum;
                this.state.dailyLoss = lossSum;
                this.state.wins = wins;
                this.state.losses = losses;
                this.state.totalTrades = this.state.wins + this.state.losses;
                this.state.totalProfitClosed = profitSum - lossSum;

                // Reconstruir tradeHistory com trades que não estão no histórico local
                const existingTickets = new Set(this.state.tradeHistory.map(t => t.ticket));
                for (const t of todayTrades) {
                    if (!existingTickets.has(t.ticket)) {
                        this.state.tradeHistory.unshift({
                            time: new Date((t.time || 0) * 1000).toISOString(),
                            symbol: t.symbol || this.settings.symbols[0],
                            direction: t.type === 0 ? 'BUY' : 'SELL',
                            entry: t.price || 0,
                            profit: t.profit || 0,
                            ticket: t.ticket
                        });
                    }
                }
                if (this.state.tradeHistory.length > 100) this.state.tradeHistory = this.state.tradeHistory.slice(0, 100);
                this.saveTradeHistory();
                this.addLog(`📊 Histórico sincronizado com MT5: ${todayTrades.length} trades hoje (W:${wins} L:${losses})`, 'INFO');
            }
        } catch (err) {
            this.addLog(`Falha ao sincronizar histórico MT5: ${(err as any).message}`, 'WARN');
        }
    }

    private static async processSymbol(symbol: string) {
        // Check cooldown
        const lastSweep = this.state.lastSweepTime[symbol] || 0;
        if (Date.now() - lastSweep < this.settings.cooldownMinutes * 60 * 1000) return;

        // Check if already in position
        const hasPosition = this.state.positions.some(p => p.symbol === symbol);
        if (hasPosition) return;

        // Fetch H4 candles
        const h4Candles = await this.fetchCandles(symbol, 'H4', 100);
        if (h4Candles.length < 40) return;

        // Fetch M15 candles
        const m15Candles = await this.fetchCandles(symbol, 'M15', 200);
        if (m15Candles.length < 60) return;

        // Update swing points from H4
        this.updateSwingPoints(symbol, h4Candles);

        // Check for liquidity sweep on M15
        const signal = this.detectSweep(symbol, h4Candles, m15Candles);
        if (signal && signal.score >= 60) {
            await this.executeSweepTrade(symbol, signal);
        }
    }

    private static updateSwingPoints(symbol: string, candles: Candle[]) {
        const highs: SwingPoint[] = [];
        const lows: SwingPoint[] = [];
        const lookback = 5;

        for (let i = lookback; i < candles.length - lookback; i++) {
            const c = candles[i];
            const prev = candles.slice(i - lookback, i);
            const next = candles.slice(i + 1, i + 1 + lookback);

            const isSwingHigh = prev.every(p => c.high > p.high) && next.every(n => c.high >= n.high);
            const isSwingLow = prev.every(p => c.low < p.low) && next.every(n => c.low <= n.low);

            if (isSwingHigh) {
                highs.push({ time: c.time, price: c.high, type: 'HIGH' });
            }
            if (isSwingLow) {
                lows.push({ time: c.time, price: c.low, type: 'LOW' });
            }
        }

        // Keep last 20 swing points
        this.state.swingHighs[symbol] = highs.slice(-20);
        this.state.swingLows[symbol] = lows.slice(-20);
    }

    private static calculateATR(candles: Candle[], period: number = 14): number {
        if (candles.length < period + 1) return 0;
        const trueRanges: number[] = [];
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trueRanges.push(tr);
        }
        return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    }

    private static detectSweep(symbol: string, h4Candles: Candle[], m15Candles: Candle[]): SweepSignal | null {
        const highs = this.state.swingHighs[symbol] || [];
        const lows = this.state.swingLows[symbol] || [];

        if (highs.length < 2 && lows.length < 2) return null;

        const lastH4 = h4Candles[h4Candles.length - 1];
        const prevH4 = h4Candles[h4Candles.length - 2];
        if (!lastH4 || !prevH4) return null;

        const atr = this.calculateATR(h4Candles, 14);
        if (atr <= 0) return null;

        const pipSize = this.getPipSize(symbol);
        const minSlDistance = Math.max(atr * 1.0, pipSize * 50);

        // Usar M15 recentes para detectar varredura
        const recentM15 = m15Candles.slice(-40);

        // Filtro: verificar se o candle de confirmação existe
        const hasConfirmationCandle = (sweepIndex: number, direction: 'BUY' | 'SELL'): boolean => {
            const confirmCandle = recentM15[sweepIndex + 1];
            if (!confirmCandle) return false;
            if (direction === 'BUY') return confirmCandle.close > confirmCandle.open && confirmCandle.close > recentM15[sweepIndex].close;
            return confirmCandle.close < confirmCandle.open && confirmCandle.close < recentM15[sweepIndex].close;
        };

        // Filtro: corpo do candle de reversão deve ser > 60% do range total
        const hasStrongBody = (candle: Candle): boolean => {
            const body = Math.abs(candle.close - candle.open);
            const range = candle.high - candle.low;
            return range > 0 && body / range > 0.6;
        };

        // Check for BUY signal: sweep of a swing low
        for (const low of [...lows].reverse()) {
            const sweptIndex = recentM15.findIndex(c => c.low < low.price && c.close > low.price);
            if (sweptIndex === -1) continue;

            const sweptCandle = recentM15[sweptIndex];
            const lastTradeTime = this.state.lastSweepTime[`${symbol}_LOW_${low.time}`] || 0;
            if (Date.now() - lastTradeTime < this.settings.cooldownMinutes * 60 * 1000) continue;

            const entryPrice = sweptCandle.close;
            if (entryPrice <= low.price) continue;

            // Confirmação: candle seguinte deve continuar na direção da reversão
            if (!hasConfirmationCandle(sweptIndex, 'BUY')) continue;

            // Corpo forte no candle de reversão
            if (!hasStrongBody(sweptCandle)) continue;

            const slDistance = Math.max(entryPrice - low.price + pipSize * 10, minSlDistance);
            if (slDistance <= 0) continue;

            let score = 75;
            const sl = entryPrice - slDistance;
            const tp = entryPrice + slDistance * 2.0;

            // Trend filter: H4 directional bias
            const bullishCandles = h4Candles.slice(-6).filter(c => c.close > c.open).length;
            if (bullishCandles >= 5) score += 20;
            else if (bullishCandles >= 4) score += 10;
            else if (bullishCandles >= 3) score += 5;
            else return null;

            // Price below last H4 close = bullish context
            if (low.price < lastH4.close) score += 10;

            // Multiple sweeps = stronger liquidity grab
            const sweepCount = recentM15.filter(c => c.low < low.price).length;
            if (sweepCount >= 2) score += 10;

            // Score bonus for strong reversal candle
            if (sweptCandle) {
                const range = sweptCandle.high - sweptCandle.low;
                if (range > atr * 0.6) score += 10;
            }

            return {
                symbol,
                direction: 'BUY',
                sweepLevel: low.price,
                entryPrice,
                sl,
                tp,
                swingPoint: low,
                score
            };
        }

        // Check for SELL signal: sweep of a swing high
        for (const high of [...highs].reverse()) {
            const sweptIndex = recentM15.findIndex(c => c.high > high.price && c.close < high.price);
            if (sweptIndex === -1) continue;

            const sweptCandle = recentM15[sweptIndex];
            const lastTradeTime = this.state.lastSweepTime[`${symbol}_HIGH_${high.time}`] || 0;
            if (Date.now() - lastTradeTime < this.settings.cooldownMinutes * 60 * 1000) continue;

            const entryPrice = sweptCandle.close;
            if (entryPrice >= high.price) continue;

            // Confirmação: candle seguinte deve continuar na direção da reversão
            if (!hasConfirmationCandle(sweptIndex, 'SELL')) continue;

            // Corpo forte no candle de reversão
            if (!hasStrongBody(sweptCandle)) continue;

            const slDistance = Math.max(high.price - entryPrice + pipSize * 10, minSlDistance);
            if (slDistance <= 0) continue;

            let score = 75;
            const sl = entryPrice + slDistance;
            const tp = entryPrice - slDistance * 2.0;

            const bearishCandles = h4Candles.slice(-6).filter(c => c.close < c.open).length;
            if (bearishCandles >= 5) score += 20;
            else if (bearishCandles >= 4) score += 10;
            else if (bearishCandles >= 3) score += 5;
            else return null;

            if (high.price > lastH4.close) score += 10;

            const sweepCount = recentM15.filter(c => c.high > high.price).length;
            if (sweepCount >= 2) score += 10;

            if (sweptCandle) {
                const range = sweptCandle.high - sweptCandle.low;
                if (range > atr * 0.6) score += 10;
            }

            return {
                symbol,
                direction: 'SELL',
                sweepLevel: high.price,
                entryPrice,
                sl,
                tp,
                swingPoint: high,
                score
            };
        }

        return null;
    }

    private static trailingActive = {} as Record<string, { ticket: number; entryPrice: number; direction: string; slDistance: number; breakevenActivated: boolean }>;

    private static recordSignal(signal: SweepSignal, executed: boolean) {
        this.state.signalHistory.unshift({
            time: new Date().toISOString(),
            symbol: signal.symbol,
            direction: signal.direction,
            score: signal.score,
            sweepLevel: signal.sweepLevel,
            entryPrice: signal.entryPrice,
            executed
        });
        if (this.state.signalHistory.length > 50) this.state.signalHistory.pop();
    }

    private static async executeSweepTrade(symbol: string, signal: SweepSignal) {
        this.state.isExecuting = true;
        try {
            const [accResp, tickResp, symbolInfoResp] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 }),
                axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 5000 }),
                axios.get(`${this.BRIDGE_URL}/symbol_info?symbol=${symbol}`, { timeout: 5000 }).catch(() => ({ data: {} }))
            ]);
            
            const account = accResp.data;
            const tick = tickResp.data?.[symbol];
            const symbolInfo = symbolInfoResp.data;
            
            if (!tick) {
                this.addLog(`Erro: Tick não encontrado para ${symbol}`, 'WARN');
                return;
            }

            const currentSpread = Math.abs(tick.ask - tick.bid);
            const maxSpread = this.getPipSize(symbol) * 30;
            if (currentSpread > maxSpread) {
                this.addLog(`Trade cancelado: Spread excessivo (${(currentSpread/this.getPipSize(symbol)).toFixed(0)} pts)`, 'WARN');
                return;
            }

            const tickValue = account.tick_value || symbolInfo?.trade_tick_value || 1.0;
            const tickSize = symbolInfo?.trade_tick_size || symbolInfo?.point || this.getPipSize(symbol);
            const stopLevel = symbolInfo?.trade_stops_level || 0;
            const minStopDistance = stopLevel * tickSize;

            const currentPrice = signal.direction === 'BUY' ? tick.ask : tick.bid;
            const originalSlDistance = Math.abs(signal.entryPrice - signal.sl);
            
            // Garantir distância mínima absoluta: STOP_LEVEL + margem OU 50 ticks, o que for maior
            const minAbsoluteDistance = Math.max(minStopDistance, tickSize * 50);
            const safeMinDistance = Math.max(originalSlDistance, minAbsoluteDistance + tickSize * 10);
            
            // Recalcular SL/TP com R:R mínimo de 2:1
            let sl: number, tp: number;
            const rrRatio = Math.max(this.settings.atrTpMultiplier / this.settings.atrSlMultiplier, 2.0);
            const tradeSlDistance = Math.max(safeMinDistance, tickSize * 100);
            if (signal.direction === 'BUY') {
                sl = currentPrice - tradeSlDistance;
                tp = currentPrice + tradeSlDistance * rrRatio;
            } else {
                sl = currentPrice + tradeSlDistance;
                tp = currentPrice - tradeSlDistance * rrRatio;
            }

            // Normalizar para o tick size
            const normalizePrice = (price: number) => {
                return Math.round(price / tickSize) * tickSize;
            };
            
            sl = normalizePrice(sl);
            tp = normalizePrice(tp);

            // Garantir que SL fique a pelo menos STOP_LEVEL de distância
            if (signal.direction === 'BUY') {
                if (currentPrice - sl < minAbsoluteDistance) sl = normalizePrice(currentPrice - minAbsoluteDistance - tickSize);
                if (tp - currentPrice < minAbsoluteDistance * 2) tp = normalizePrice(currentPrice + minAbsoluteDistance * 2);
            } else {
                if (sl - currentPrice < minAbsoluteDistance) sl = normalizePrice(currentPrice + minAbsoluteDistance + tickSize);
                if (currentPrice - tp < minAbsoluteDistance * 2) tp = normalizePrice(currentPrice - minAbsoluteDistance * 2);
            }

            const slDistance = Math.abs(currentPrice - sl);
            if (slDistance <= 0 || tickValue <= 0) {
                this.addLog(`Cálculo de lote inválido para ${symbol}: SL dist=${slDistance}`, 'WARN');
                return;
            }

            let lotSize = this.settings.lotSize;
            if (this.settings.riskUSD > 0) {
                const contractSize = symbolInfo?.trade_contract_size || 100;
                const riskPerLot = slDistance * tickValue * contractSize;
                
                if (riskPerLot > 0) {
                    const calcLot = this.settings.riskUSD / riskPerLot;
                    
                    // Hard caps para segurança - max 0.05 lots para conta pequena
                    const equity = account.equity || account.balance || 1000;
                    const maxLotByRisk = Math.min(calcLot, 0.05); // Máx 0.05 lots
                    const maxLotByMargin = Math.max(0.01, equity / 4000); // Baseado na margem disponível
                    
                    lotSize = Math.max(0.01, Math.min(maxLotByRisk, maxLotByMargin));
                    lotSize = Math.round(lotSize / 0.01) * 0.01;
                    
                    this.addLog(`Lot calc: risk=${this.settings.riskUSD} slDist=${slDistance.toFixed(2)} riskPerLot=${riskPerLot.toFixed(2)} calcLot=${calcLot.toFixed(3)} finalLot=${lotSize}`, 'INFO');
                }
            }

            const action = signal.direction === 'BUY' ? 'buy' : 'sell';
            this.recordSignal(signal, false);

            // Aplica cooldown do swing point ANTES da tentativa (evita reenvio a cada 30s se falhar)
            this.state.lastSweepTime[`${symbol}_${signal.swingPoint.type}_${signal.swingPoint.time}`] = Date.now();

            this.addLog(`📤 Enviando ordem: ${action} ${symbol} lot=${lotSize} sl=${sl} tp=${tp} price=${currentPrice}`, 'INFO');

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol,
                action,
                lot: lotSize,
                sl,
                tp,
                magic: this.settings.magic,
                comment: `Sweep_${signal.direction}_${signal.swingPoint.type}_${Math.round(signal.score)}`
            }, { timeout: 15000 });

            if (resp.data?.status === 'success') {
                const ticket = resp.data?.ticket || resp.data?.order_id || 0;
                if (this.state.signalHistory.length > 0) this.state.signalHistory[0].executed = true;
                SymbolLockService.acquire(symbol, 'Sweep H4 M15', ticket, signal.direction);
                this.state.lastSweepTime[symbol] = Date.now();
                this.trailingActive[symbol] = { ticket, entryPrice: currentPrice, direction: signal.direction, slDistance: safeMinDistance, breakevenActivated: false };
                this.addLog(`✅ ${signal.direction} ${symbol} | Lote ${lotSize} | SL ${sl} | TP ${tp} | Score ${signal.score}`, 'TRADE');
            } else {
                const errorMsg = resp.data?.error || resp.data?.message || 'erro desconhecido';
                // Cooldown curto mesmo em falha (evita spam de sinais do mesmo swing point)
                this.state.lastSweepTime[`${symbol}_${signal.swingPoint.type}_${signal.swingPoint.time}`] = Date.now() - this.settings.cooldownMinutes * 60 * 1000 + 60000;
                this.addLog(`Falha ao abrir ${symbol}: ${errorMsg}`, 'WARN');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            this.addLog(`Erro crítico executeSweepTrade ${symbol}: ${errorMsg}`, 'WARN');
        } finally {
            this.state.isExecuting = false;
        }
    }

    private static getPipSize(symbol: string): number {
        // XAUUSD, XAGUSD etc → 2 casas decimais, pip = 0.01
        if (/^X(AU|AG|PD|PT|CU)/i.test(symbol)) return 0.01;
        // BTCUSD, ETHUSD etc → 2 casas (preço > 100)
        if (/^(BTC|ETH|LTC|XRP)/i.test(symbol)) return 0.01;
        // Pares JPY → 3 casas (USDJPY ~150 → 0.001)
        if (/JPY/i.test(symbol)) return 0.001;
        // Pares foreing → 4 casas
        return 0.0001;
    }

    private static roundToSymbolPrecision(symbol: string, price: number): number {
        // Normalizar para o tick size do símbolo (MT5 exige preços múltiplos do tick size)
        const tickSize = this.getPipSize(symbol);
        return Math.round(price / tickSize) * tickSize;
    }

    private static async applyTrailingStop() {
        for (const pos of this.state.positions) {
            const trail = this.trailingActive[pos.symbol];
            if (!trail || trail.ticket !== pos.ticket) continue;

            try {
                const candles = await this.fetchCandles(pos.symbol, 'M15', 10);
                if (candles.length < 6) continue;
                
                const currentCandle = candles[candles.length - 1];
                const prevCandles = candles.slice(candles.length - 6, candles.length - 1);
                const avgRange = prevCandles.reduce((acc, c) => acc + (c.high - c.low), 0) / prevCandles.length;
                const currentRange = currentCandle.high - currentCandle.low;

                const isStrongReversal = (
                    (pos.type === 0 && currentCandle.close < currentCandle.open && currentRange > avgRange * 1.5) ||
                    (pos.type === 1 && currentCandle.close > currentCandle.open && currentRange > avgRange * 1.5)
                );

                const pipSize = this.getPipSize(pos.symbol);

                if (this.settings.useFastReversal && isStrongReversal) {
                    const tightSl = pos.type === 0 
                        ? trail.entryPrice + pipSize
                        : trail.entryPrice - pipSize;
                    
                        if ((pos.type === 0 && tightSl > pos.sl) || (pos.type === 1 && tightSl < pos.sl)) {
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket,
                                sl: this.roundToSymbolPrecision(pos.symbol, tightSl),
                                tp: pos.tp
                            }, { timeout: 5000 });
                            this.addLog(`⚠️ Reversão Forte ${pos.symbol}: SL apertado para ${tightSl.toFixed(2)}`, 'WARN');
                            continue; // Prioridade total
                        }
                }

                const currentPrice = currentCandle.close;
                const breakevenDist = trail.slDistance * 0.5;

                if (!trail.breakevenActivated) {
                    let priceMoved = pos.type === 0
                        ? currentPrice - trail.entryPrice
                        : trail.entryPrice - currentPrice;
                    
                    // Auto-recuperação de breakeven: se o preço já está bem acima da entrada, ativa automaticamente
                    if (priceMoved >= breakevenDist) {
                        trail.breakevenActivated = true;
                        const breakEvenSl = pos.type === 0
                            ? trail.entryPrice + pipSize * 5
                            : trail.entryPrice - pipSize * 5;
                        
                        // Só atualiza se o SL atual for pior que o breakeven
                        const isBetter = (pos.type === 0 && breakEvenSl > pos.sl) || (pos.type === 1 && breakEvenSl < pos.sl);
                            if (isBetter) {
                                await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                    ticket: pos.ticket,
                                    sl: this.roundToSymbolPrecision(pos.symbol, breakEvenSl),
                                    tp: pos.tp
                                }, { timeout: 5000 });
                            }
                            this.addLog(`Breakeven ${pos.symbol}: SL movido para ${breakEvenSl.toFixed(2)}`, 'INFO');
                            continue;
                        }
                }

                if (trail.breakevenActivated) {
                    let priceMoved = pos.type === 0
                        ? currentPrice - trail.entryPrice
                        : trail.entryPrice - currentPrice;

                    let trailPips: number;
                    if (this.settings.useProgressiveTrailing) {
                        // Lógica Adaptativa: Usa a volatilidade recente (avgRange) para definir o trailing
                        if (priceMoved < trail.slDistance * 1.0) {
                            trailPips = avgRange * 1.2;
                        } else if (priceMoved < trail.slDistance * 1.5) {
                            trailPips = avgRange * 0.8;
                        } else {
                            trailPips = avgRange * 0.4;
                        }
                    } else {
                        // Trailing Stop Fixo baseado em ATR
                        trailPips = avgRange * 2.0;
                    }

                        if (pos.type === 0) { // BUY
                            const newSl = currentPrice - trailPips;
                            if (newSl > pos.sl) {
                                await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                    ticket: pos.ticket,
                                    sl: this.roundToSymbolPrecision(pos.symbol, newSl),
                                    tp: pos.tp
                                }, { timeout: 5000 });
                                this.addLog(`Trailing SL ${pos.symbol}: ${pos.sl.toFixed(2)} -> ${newSl.toFixed(2)} (${(trailPips/pipSize).toFixed(0)}pt)`, 'INFO');
                            }
                        } else { // SELL
                            const newSl = currentPrice + trailPips;
                            if (newSl < pos.sl) {
                                await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                    ticket: pos.ticket,
                                    sl: this.roundToSymbolPrecision(pos.symbol, newSl),
                                    tp: pos.tp
                                }, { timeout: 5000 });
                                this.addLog(`Trailing SL ${pos.symbol}: ${pos.sl.toFixed(2)} -> ${newSl.toFixed(2)} (${(trailPips/pipSize).toFixed(0)}pt)`, 'INFO');
                            }
                        }
                }
            } catch { }
        }
    }

    private static async fetchCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
        try {
            const resp = await axios.get(
                `${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`,
                { timeout: 15000 }
            );
            return Array.isArray(resp.data) ? resp.data : [];
        } catch {
            return [];
        }
    }
}
