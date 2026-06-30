import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { SymbolLockService } from './SymbolLockService';
import { LoggerService } from './LoggerService';

interface MicroSettings {
    enabled: boolean;
    symbol: string;
    lotBase: number;
    lotMultiplier: number;
    gridStepPips: number;
    maxLevels: number;
    targetProfitUSD: number;
    stopLossUSD: number;
    rsiPeriod: number;
    rsiOverbought: number;
    rsiOversold: number;
    magic: number;
    trendFilterM1: boolean;
    trendFilterM5: boolean;
    quickTP: boolean;
    sniperMode: boolean;
    breakevenThresholdPct: number;
    trailingThresholdPct: number;
    dailyTargetUSD: number;
    atrMultiplier: number;
    rrRatio: number;
}

interface TradeRecord {
    ticket: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    exitPrice: number;
    sl: number;
    tp: number;
    profit: number;
    profitPct: number;
    entryTime: number;
    exitTime: number;
    openTime: string;
    closeTime: string;
    duration: number;
    closeReason: string;
    balance: number;
}

const SETTINGS_PATH = path.join(process.cwd(), 'micro_scalper_settings.json');
const HISTORY_PATH = path.join(process.cwd(), 'micro_scalper_history.json');

const SYMBOL_PIP_VALUE: Record<string, number> = {
    'BTCUSD': 1,      // 1 pip = $1 (digits=1)
    'ETHUSD': 1,      // 1 pip = $1
    'SOLUSD': 0.01,   // 1 pip = $0.01
    'XRPUSD': 0.001,  // 1 pip = $0.001
    'EURUSD': 0.0001, // 1 pip = 0.0001 (forex standard)
    'XAUUSD': 0.1,    // 1 pip = $0.10 (digits=2, mini-pip standard)
};

function getPipValue(symbol: string): number {
    return SYMBOL_PIP_VALUE[symbol] ?? 0.0001;
}

export class MicroScalperEngine {
    private static settings: MicroSettings = {
        enabled: false,
        symbol: 'XAUUSD',
        lotBase: 0.01,
        lotMultiplier: 1.0,
        gridStepPips: 120,
        maxLevels: 1,
        targetProfitUSD: 8,
        stopLossUSD: 8,
        rsiPeriod: 7,
        rsiOverbought: 70,
        rsiOversold: 30,
        magic: 888111,
        trendFilterM1: true,
        trendFilterM5: true,
        quickTP: false,
        sniperMode: true,
        breakevenThresholdPct: 0.3,
        trailingThresholdPct: 0.6,
        dailyTargetUSD: 10,
        atrMultiplier: 2.0,
        rrRatio: 2.0
    };

    private static isRunning = false;

    private static state = {
        activeOrders: [] as any[],
        rsi: 50,
        trendM1: 'NEUTRAL' as string,
        trendM5: 'NEUTRAL' as string,
        lastTick: 0,
        isProcessing: false,
        sniperTrigger: null as 'BUY' | 'SELL' | null,
        logs: [] as { time: string, msg: string, type: 'INFO' | 'TRADE' | 'WARN' }[],
        dailyProfit: 0,
        dailyProfitDate: '',
        lastCycleTime: 0,
        spread: 0,
        atr: 2,
        atrMA20: 2,
        stats: {
            totalTrades: 0,
            wins: 0,
            losses: 0,
            closedPnL: 0,
        },
        tradeHistory: [] as TradeRecord[],
    };

    // URL da Bridge REAL (porta 5555)
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static addLog(msg: string, type: 'INFO' | 'TRADE' | 'WARN' = 'INFO') {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.state.logs.unshift({ time, msg, type });
        if (this.state.logs.length > 60) this.state.logs.pop();
        
        LoggerService.log('MicroScalperEngine', type, msg);
    }

    static init() {
        this.loadSettings();
        this.loadTradeHistory();
        this.isRunning = true;
        console.log(`⚡ Titan Micro-Sniper: Engine v2.0 ONLINE | Histórico: ${this.state.tradeHistory.length} trades`);
        setInterval(() => this.mainCycle(), 1000);
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
            }
        } catch (err) {
            console.error('Error loading MicroScalper settings:', err);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (err) {
            console.error('Error saving MicroScalper settings:', err);
        }
    }

    private static saveTradeHistory() {
        try {
            const data = {
                trades: this.state.tradeHistory.slice(0, 200),
                stats: this.state.stats,
            };
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Error saving MicroScalper trade history:', err);
        }
    }

    private static loadTradeHistory() {
        try {
            if (fs.existsSync(HISTORY_PATH)) {
                const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
                if (raw.trades && Array.isArray(raw.trades)) {
                    this.state.tradeHistory = raw.trades;
                }
                if (raw.stats) {
                    this.state.stats = { ...this.state.stats, ...raw.stats };
                }
            }
        } catch (err) {
            console.error('Error loading MicroScalper trade history:', err);
        }
    }

    static getStatus() {
        const { totalTrades, wins, losses, closedPnL } = this.state.stats;
        const winRate = totalTrades > 0 ? Math.round(wins / totalTrades * 1000) / 10 : 0;
        return {
            isRunning: this.isRunning,
            settings: this.settings,
            ...this.state,
            activePositions: this.state.activeOrders.length,
            totalProfit: this.state.activeOrders.reduce((acc, o) => acc + (o.profit || 0), 0),
            dailyProgress: this.settings.dailyTargetUSD > 0
                ? Math.min(100, Math.round((this.state.dailyProfit / this.settings.dailyTargetUSD) * 100))
                : 0,
            stats: {
                totalTrades,
                wins,
                losses,
                winRate,
                closedPnL: Math.round(closedPnL * 100) / 100,
                dailyPnL: Math.round(this.state.dailyProfit * 100) / 100,
            }
        };
    }

    static getLiveMonitor() {
        const now = Date.now() / 1000;
        const positions = this.state.activeOrders.map((o: any) => {
            const entryPrice = o.price_open || 0;
            const currentPrice = o.price_current || entryPrice;
            const isBuy = o.type === 0;
            const profitPct = entryPrice > 0
                ? (isBuy ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice) * 100
                : 0;
            const pnlPerLot = isBuy ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
            const slPrice = o.sl || 0;
            const tpPrice = o.tp || 0;
            const slDistance = slPrice > 0 ? Math.abs(currentPrice - slPrice) : 0;
            const slDistancePct = currentPrice > 0 ? (slDistance / currentPrice * 100) : 0;
            const tpDistance = tpPrice > 0 ? Math.abs(tpPrice - currentPrice) : 0;
            const tpDistancePct = currentPrice > 0 ? (tpDistance / currentPrice * 100) : 0;

            // Breakeven / Trailing status
            const targetProfitPct = this.settings.targetProfitUSD > 0 && entryPrice > 0
                ? (this.settings.targetProfitUSD) / (entryPrice * (o.volume || 0.01) * (o.contract_size || 100) * (o.tick_value || 0.01)) * 100
                : 0.0075;
            const isBE = slPrice > 0 && entryPrice > 0 && ((isBuy && slPrice >= entryPrice) || (!isBuy && slPrice <= entryPrice));
            const beTriggered = profitPct >= targetProfitPct * this.settings.breakevenThresholdPct;
            const trailingTriggered = profitPct >= targetProfitPct * this.settings.trailingThresholdPct;

            // Time in trade
            const openTime = o.time || 0;
            const timeInTrade = openTime > 0 ? Math.floor(now - openTime) : 0;
            const mins = Math.floor(timeInTrade / 60);
            const secs = timeInTrade % 60;
            const timeStr = `${mins}m ${secs}s`;

            return {
                ticket: o.ticket,
                symbol: o.symbol,
                type: isBuy ? 'BUY' : 'SELL',
                volume: o.volume,
                entryPrice: Math.round(entryPrice * 100) / 100,
                currentPrice: Math.round(currentPrice * 100) / 100,
                sl: Math.round(slPrice * 100) / 100,
                tp: Math.round(tpPrice * 100) / 100,
                profit: Math.round((o.profit || 0) * 100) / 100,
                profitPct: Math.round(profitPct * 10000) / 100,
                pnlPerLot: Math.round(pnlPerLot * 100) / 100,
                slDistance: Math.round(slDistance * 100) / 100,
                slDistancePct: Math.round(slDistancePct * 10000) / 100,
                tpDistance: Math.round(tpDistance * 100) / 100,
                tpDistancePct: Math.round(tpDistancePct * 10000) / 100,
                isBE,
                beTriggered,
                trailingTriggered,
                timeInTrade: timeStr,
                timeSeconds: timeInTrade,
            };
        });

        return {
            positions,
            summary: {
                totalPositions: positions.length,
                totalProfit: Math.round(positions.reduce((a: number, p: any) => a + p.profit, 0) * 100) / 100,
                totalVolume: Math.round(positions.reduce((a: number, p: any) => a + p.volume, 0) * 100) / 100,
                avgProfitPct: positions.length > 0
                    ? Math.round(positions.reduce((a: number, p: any) => a + p.profitPct, 0) / positions.length * 100) / 100
                    : 0,
            },
            indicators: {
                rsi: Math.round(this.state.rsi * 100) / 100,
                rsiZone: this.state.rsi < 30 ? 'OVERSOLD' : this.state.rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
                trendM1: this.state.trendM1,
                trendM5: this.state.trendM5,
                sniperTrigger: this.state.sniperTrigger,
                sniperValid: this.state.sniperTrigger === 'BUY' && this.state.rsi < 40
                    || this.state.sniperTrigger === 'SELL' && this.state.rsi > 60,
            },
            cycleInfo: {
                lastCycleTime: this.state.lastCycleTime,
                isProcessing: this.state.isProcessing,
                enabled: this.settings.enabled,
            }
        };
    }

    static getHistory() {
        return {
            trades: this.state.tradeHistory,
            stats: {
                totalTrades: this.state.stats.totalTrades,
                wins: this.state.stats.wins,
                losses: this.state.stats.losses,
                winRate: this.state.stats.totalTrades > 0
                    ? Math.round(this.state.stats.wins / this.state.stats.totalTrades * 1000) / 10
                    : 0,
                closedPnL: Math.round(this.state.stats.closedPnL * 100) / 100,
                avgProfit: this.state.stats.totalTrades > 0
                    ? Math.round(this.state.stats.closedPnL / this.state.stats.totalTrades * 100) / 100
                    : 0,
            }
        };
    }

    static updateSettings(newSettings: Partial<MicroSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    // ========== CICLO PRINCIPAL ==========
    private static async mainCycle() {
        if (!this.settings.enabled || this.state.isProcessing) return;
        this.state.isProcessing = true;

        try {
            // Reset diário da meta
            const today = new Date().toDateString();
            if (this.state.dailyProfitDate !== today) {
                this.state.dailyProfit = 0;
                this.state.dailyProfitDate = today;
            }

            // 1. Sync posições e dados de mercado da Bridge real
            await this.syncPositions();
            await this.syncMarketData();

            // 2. Check Basket TP/SL
            const totalProfit = this.state.activeOrders.reduce((acc, o) => acc + (o.profit || 0), 0);
            if (this.state.activeOrders.length > 0) {
                if (totalProfit >= this.settings.targetProfitUSD) {
                    this.addLog(`🎯 Alvo da cesta alcançado: +$${totalProfit.toFixed(2)}. Fechando tudo.`, 'TRADE');
                    await this.closeAllPositions('BASKET_TP');
                    this.state.isProcessing = false;
                    return;
                }
                if (totalProfit <= -this.settings.stopLossUSD) {
                    this.addLog(`⚠️ Stop Loss da cesta atingido: -$${Math.abs(totalProfit).toFixed(2)}. Fechando tudo.`, 'WARN');
                    await this.closeAllPositions('BASKET_SL');
                    this.state.isProcessing = false;
                    return;
                }
                if (this.settings.quickTP && totalProfit >= this.settings.targetProfitUSD * 0.5) {
                    this.addLog(`⚡ Quick TP: +$${totalProfit.toFixed(2)}. Fechando tudo.`, 'TRADE');
                    await this.closeAllPositions('QUICK_TP');
                    this.state.isProcessing = false;
                    return;
                }
            }

            // 3. Individual SL/TP check per position
            if (this.state.activeOrders.length > 0) {
                try {
                    const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, {
                        symbols: [this.settings.symbol]
                    }, { timeout: 5000 });
                    const tick = tickResp.data?.[this.settings.symbol];
                    if (tick) {
                        const snapshot = [...this.state.activeOrders];
                        for (const pos of snapshot) {
                            const isBuy = pos.type === 0;
                            const currentPrice = isBuy ? tick.bid : tick.ask;
                            if (pos.sl > 0 && ((isBuy && currentPrice <= pos.sl) || (!isBuy && currentPrice >= pos.sl))) {
                                this.addLog(`🛑 SL atingido #${pos.ticket} (${isBuy ? 'BUY' : 'SELL'}) a $${currentPrice.toFixed(2)}`, 'TRADE');
                                await this.closeSinglePosition(pos.ticket, 'SL');
                            } else if (pos.tp > 0 && ((isBuy && currentPrice >= pos.tp) || (!isBuy && currentPrice <= pos.tp))) {
                                this.addLog(`🎯 TP atingido #${pos.ticket} (${isBuy ? 'BUY' : 'SELL'}) a $${currentPrice.toFixed(2)}`, 'TRADE');
                                await this.closeSinglePosition(pos.ticket, 'TP');
                            }
                        }
                    }
                } catch (e) { /* tick fail */ }
            }

            // 4. Position Management (trailing stop / breakeven)
            if (this.state.activeOrders.length > 0) {
                await this.managePositions();
            }

            // 5. Trading Logic
            if (this.state.activeOrders.length === 0) {
                await this.checkFirstEntry();
            } else if (this.state.activeOrders.length < this.settings.maxLevels) {
                await this.manageGrid();
            }

        } catch (err) {
            console.error('Titan Sniper Cycle Error:', (err as any).message);
        } finally {
            this.state.lastCycleTime = Date.now();
            this.state.isProcessing = false;
        }
    }

    // ========== SYNC: POSIÇÕES (endpoint /positions) ==========
    private static async syncPositions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions?magic=${this.settings.magic}`, { timeout: 10000 });
            this.state.activeOrders = Array.isArray(resp.data) ? resp.data : [];
        } catch (err) {
            this.state.activeOrders = [];
        }
    }

    // ========== SYNC: DADOS DE MERCADO (endpoint /candles + /ticks) ==========
    private static async syncMarketData() {
        try {
            // Buscar candles M1 para RSI e Padrões Sniper
            const m1Resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&timeframe=M1&count=20`, { timeout: 10000 });
            const m1Candles = Array.isArray(m1Resp.data) ? m1Resp.data : [];

            if (m1Candles.length >= 14) {
                // Calcular RSI manualmente a partir dos candles
                this.state.rsi = this.calculateRSI(m1Candles, this.settings.rsiPeriod);

                // Detectar tendência M1
                this.state.trendM1 = this.detectTrend(m1Candles.slice(-9));

                // Detectar gatilho Sniper M1 (Pin Bar / Engolfo)
                if (this.settings.sniperMode) {
                    this.state.sniperTrigger = this.detectSniperTrigger(m1Candles);
                }
            }

            // Buscar candles M5 para tendência de médio prazo + ATR
            const m5Resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&timeframe=M5&count=20`, { timeout: 10000 });
            const m5Candles = Array.isArray(m5Resp.data) ? m5Resp.data : [];

            if (m5Candles.length >= 14) {
                this.state.trendM5 = this.detectTrend(m5Candles.slice(-9));
                this.state.atr = this.calculateATR(m5Candles, 14);
                this.state.atrMA20 = this.state.atr;
            }

        } catch (err) {
            // Se falhar, mantém os valores anteriores
        }
    }

    // ========== RSI MANUAL (Close-Based) ==========
    private static calculateRSI(candles: any[], period: number): number {
        if (candles.length < period + 1) return 50;

        const closes = candles.map(c => c.close);
        let avgGain = 0;
        let avgLoss = 0;

        // Primeiro cálculo
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) avgGain += diff;
            else avgLoss += Math.abs(diff);
        }
        avgGain /= period;
        avgLoss /= period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // ========== DETECTAR TENDÊNCIA (SMA 9) ==========
    private static detectTrend(candles: any[]): string {
        if (candles.length < 9) return 'NEUTRAL';
        const closes = candles.map(c => c.close);
        const sma9 = closes.reduce((a, b) => a + b, 0) / closes.length;
        const lastClose = closes[closes.length - 1];

        if (lastClose > sma9 * 1.002) return 'BULLISH';
        if (lastClose < sma9 * 0.998) return 'BEARISH';
        return 'NEUTRAL';
    }

    // ========== SNIPER TRIGGER: Pin Bar + Engolfo ==========
    private static detectSniperTrigger(candles: any[]): 'BUY' | 'SELL' | null {
        if (candles.length < 3) return null;

        const last = candles[candles.length - 2]; // Vela FECHADA anterior
        const prev = candles[candles.length - 3];

        const body = Math.abs(last.close - last.open);
        const range = last.high - last.low;
        if (range === 0) return null;
        const bodyRatio = body / range;

        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;

        // Pin Bar de COMPRA: pavio inferior >= 65% do range, corpo <= 35%
        if (bodyRatio <= 0.35 && lowerWick / range >= 0.65) {
            return 'BUY';
        }

        // Pin Bar de VENDA: pavio superior >= 65% do range, corpo <= 35%
        if (bodyRatio <= 0.35 && upperWick / range >= 0.65) {
            return 'SELL';
        }

        // Engolfo de COMPRA: vela anterior vermelha, vela atual verde engolindo
        const prevBody = Math.abs(prev.close - prev.open);
        if (prev.close < prev.open && last.close > last.open && body > prevBody * 1.2) {
            return 'BUY';
        }

        // Engolfo de VENDA: vela anterior verde, vela atual vermelha engolindo
        if (prev.close > prev.open && last.close < last.open && body > prevBody * 1.2) {
            return 'SELL';
        }

        return null;
    }

    // ========== ATR (Average True Range) ==========
    private static calculateATR(candles: any[], period: number = 14): number {
        if (candles.length < period + 1) return 2;
        const ranges: number[] = [];
        for (let i = candles.length - period; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = i > 0 ? candles[i - 1].close || 0 : low;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            ranges.push(tr);
        }
        let atr = ranges.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < ranges.length; i++) {
            atr = (atr * (period - 1) + ranges[i]) / period;
        }
        return atr;
    }

    // ========== PRIMEIRA ENTRADA (Sniper Shot) ==========
    private static async checkFirstEntry() {
        const { rsi, trendM1, trendM5, sniperTrigger } = this.state;
        const { rsiOversold, rsiOverbought, trendFilterM1, trendFilterM5, sniperMode } = this.settings;

        let side: 'BUY' | 'SELL' | null = null;

        // Modo Sniper: Exige padrão de vela específico
        if (sniperMode) {
            if (!sniperTrigger) return; // Sem gatilho = sem entrada

            if (sniperTrigger === 'BUY' && rsi < 40) {
                if (!trendFilterM5 || trendM5 !== 'BEARISH') {
                    if (!trendFilterM1 || trendM1 !== 'BEARISH') {
                        side = 'BUY';
                    }
                }
            } else if (sniperTrigger === 'SELL' && rsi > 60) {
                if (!trendFilterM5 || trendM5 !== 'BULLISH') {
                    if (!trendFilterM1 || trendM1 !== 'BULLISH') {
                        side = 'SELL';
                    }
                }
            }
        } else {
            // Modo Clássico: RSI Esticado
            if (rsi < rsiOversold) {
                if (!trendFilterM1 || trendM1 === 'BULLISH') side = 'BUY';
            } else if (rsi > rsiOverbought) {
                if (!trendFilterM1 || trendM1 === 'BEARISH') side = 'SELL';
            }
        }

        if (side) {
            if (this.state.atr > 0) {
                const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] }, { timeout: 5000 });
                const tick = tickResp.data?.[this.settings.symbol];
                if (tick) {
                    const currentSpread = (tick.ask - tick.bid);
                    const maxSpread = this.state.atr * 0.3;
                    if (currentSpread > maxSpread) {
                        this.addLog(`⚠️ Spread ${currentSpread.toFixed(2)} > 30% ATR (${maxSpread.toFixed(2)})`, 'WARN');
                        return;
                    }
                }
            }
            const reason = sniperMode ? `Sniper ${sniperTrigger}` : 'RSI Signal';
            this.addLog(`🚀 Titan disparo detectado [${side}] (${reason}). RSI: ${rsi.toFixed(1)} | TendM1: ${trendM1} | TendM5: ${trendM5}`, 'TRADE');
            await this.placeOrder(side, this.settings.lotBase);
        }
    }

    // ========== GESTÃO DE GRADE ==========
    private static async manageGrid() {
        const lastOrder = this.state.activeOrders[this.state.activeOrders.length - 1];
        if (!lastOrder) return;

        // Buscar preço atual via /ticks
        try {
            const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, {
                symbols: [this.settings.symbol]
            }, { timeout: 10000 });

            const tickData = tickResp.data[this.settings.symbol];
            if (!tickData) return;

            const currentPrice = lastOrder.type === 0 ? tickData.ask : tickData.bid;
            const openPrice = lastOrder.price_open || lastOrder.open_price;

            const diffRaw = Math.abs(currentPrice - openPrice);
            const pipValue = getPipValue(this.settings.symbol);
            const diffPips = diffRaw / pipValue;
            const gridDistPips = this.settings.gridStepPips;

            // Se o preço se moveu contra a ordem além do grid step (em pips reais)
            const isAgainst = lastOrder.type === 0
                ? currentPrice < openPrice
                : currentPrice > openPrice;

            if (isAgainst && diffPips >= gridDistPips) {
                // Filtro de RSI para grid: não adicionar nível se momentum estiver muito forte contra
                const { rsi } = this.state;
                const side: 'BUY' | 'SELL' = lastOrder.type === 0 ? 'BUY' : 'SELL';
                if (side === 'BUY' && rsi < 20) {
                    this.addLog(`⏸️ Grid nível ${this.state.activeOrders.length + 1} bloqueado. RSI muito baixo (${rsi.toFixed(1)})`, 'INFO');
                    return;
                }
                if (side === 'SELL' && rsi > 80) {
                    this.addLog(`⏸️ Grid nível ${this.state.activeOrders.length + 1} bloqueado. RSI muito alto (${rsi.toFixed(1)})`, 'INFO');
                    return;
                }

                const nextLot = Number((lastOrder.volume * this.settings.lotMultiplier).toFixed(2));
                if (this.state.atr > 0 && tickData) {
                    const currentSpread = (tickData.ask - tickData.bid);
                    const maxSpread = this.state.atr * 0.3;
                    if (currentSpread > maxSpread) {
                        this.addLog(`⚠️ Grid spread ${currentSpread.toFixed(2)} > 30% ATR (${maxSpread.toFixed(2)})`, 'WARN');
                        return;
                    }
                }
                this.addLog(`⛓️ Grid nível ${this.state.activeOrders.length + 1} (${diffPips.toFixed(0)}/${gridDistPips} pips). Lote: ${nextLot}`, 'INFO');
                await this.placeOrder(side, nextLot);
            }
        } catch (err) {
            // Ignora erro de tick
        }
    }

    // ========== GERENCIAMENTO DE POSIÇÃO (trailing + breakeven) ==========
    private static async managePositions() {
        try {
            const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] }, { timeout: 5000 });
            const tick = tickResp.data?.[this.settings.symbol];
            if (!tick) return;
            const atr = Math.max(this.state.atr || 2, 1.5);
            const tpDistance = atr * this.settings.atrMultiplier * this.settings.rrRatio;
            for (const order of this.state.activeOrders) {
                const entryPrice = order.price_open || 0;
                if (!entryPrice || !order.ticket) continue;
                const isBuy = order.type === 0;
                const currentPrice = isBuy ? tick.bid : tick.ask;
                const profitPct = isBuy ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice;
                const sl = order.sl || 0;
                const targetProfitPct = tpDistance / entryPrice;
                if (targetProfitPct <= 0) continue;

                if (profitPct > 0 && profitPct >= targetProfitPct * this.settings.breakevenThresholdPct) {
                    const beOffset = Math.max(0.5, atr * 0.3);
                    const bePrice = isBuy ? entryPrice + beOffset : entryPrice - beOffset;
                    if ((isBuy && sl < entryPrice) || (!isBuy && sl > entryPrice)) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: order.ticket,
                            sl: Math.round(bePrice * 100) / 100,
                        }, { timeout: 3000 });
                        this.addLog(`🛡️ Breakeven #${order.ticket} (${(profitPct * 100).toFixed(2)}%)`, 'TRADE');
                    }
                }
                if (profitPct > 0 && profitPct >= targetProfitPct * this.settings.trailingThresholdPct) {
                    const trailDistPrice = atr * 0.8;
                    const newSl = isBuy ? currentPrice - trailDistPrice : currentPrice + trailDistPrice;
                    if ((isBuy && newSl > sl) || (!isBuy && (sl === 0 || newSl < sl))) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: order.ticket,
                            sl: Math.round(newSl * 100) / 100,
                        }, { timeout: 3000 });
                        this.addLog(`🔁 Trailing #${order.ticket} (${(profitPct * 100).toFixed(2)}%)`, 'TRADE');
                    }
                }
            }
        } catch (e) { /* manage fail */ }
    }

    // ========== ABRIR ORDEM (endpoint /order) ==========
    private static async placeOrder(side: 'BUY' | 'SELL', lot: number) {
        try {
            const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] }, { timeout: 5000 });
            const tick = tickResp.data?.[this.settings.symbol];
            const price = side === 'BUY' ? tick?.ask || 0 : tick?.bid || 0;

            const atr = Math.max(this.state.atr || 2, 1.5);
            const slDistance = Math.round((atr * this.settings.atrMultiplier) * 100) / 100;
            const tpDistance = Math.round((slDistance * this.settings.rrRatio) * 100) / 100;

            const sl = side === 'BUY'
                ? Math.round((price - slDistance) * 100) / 100
                : Math.round((price + slDistance) * 100) / 100;
            const tp = side === 'BUY'
                ? Math.round((price + tpDistance) * 100) / 100
                : Math.round((price - tpDistance) * 100) / 100;

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                action: side,
                symbol: this.settings.symbol,
                lot: lot,
                sl: sl,
                tp: tp,
                magic: this.settings.magic,
                comment: 'Titan_Sniper'
            }, { timeout: 15000 });

            if (resp.data?.status === 'success') {
                SymbolLockService.acquire(this.settings.symbol, 'Micro Sniper', resp.data.order_id || 0, side);
                this.addLog(`✅ Ordem ${side} aberta. Ticket: #${resp.data.order_id} SL:${sl} TP:${tp} (ATR:${atr.toFixed(2)})`, 'TRADE');
                try {
                    const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.settings.symbol] });
                    const tick = tickResp.data?.[this.settings.symbol];
                    const price = side === 'BUY' ? tick?.ask || 0 : tick?.bid || 0;
                } catch (e) {}
            } else {
                this.addLog(`❌ Falha ao abrir ordem: ${resp.data?.error || 'Unknown'}`, 'WARN');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            this.addLog(`❌ Erro ao enviar ordem: ${errorMsg}`, 'WARN');
        }
    }

    // ========== FECHAR POSIÇÃO INDIVIDUAL ==========
    private static async closeSinglePosition(ticket: number, reason: string) {
        const pos = this.state.activeOrders.find(p => p.ticket === ticket);
        if (!pos) return;
        const exitTime = Math.floor(Date.now() / 1000);
        const entryTime = pos.time || 0;
        const duration = entryTime > 0 ? exitTime - entryTime : 0;
        const profit = pos.profit || 0;
        const isBuy = pos.type === 0;
        const entryPrice = pos.price_open || 0;
        const currentPrice = pos.price_current || 0;
        const profitPct = entryPrice > 0
            ? (isBuy ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice) * 100
            : 0;

        this.state.dailyProfit += profit;
        this.state.stats.closedPnL += profit;
        this.state.stats.totalTrades++;
        if (profit >= 0) this.state.stats.wins++;
        else this.state.stats.losses++;

        const runningBalance = this.state.tradeHistory.length > 0
            ? this.state.tradeHistory[0].balance + profit
            : profit;

        this.state.tradeHistory.unshift({
            ticket,
            symbol: pos.symbol || this.settings.symbol,
            type: isBuy ? 'BUY' : 'SELL',
            volume: pos.volume || 0,
            entryPrice: Math.round(entryPrice * 100) / 100,
            exitPrice: Math.round(currentPrice * 100) / 100,
            sl: pos.sl || 0,
            tp: pos.tp || 0,
            profit: Math.round(profit * 100) / 100,
            profitPct: Math.round(profitPct * 100) / 100,
            entryTime,
            exitTime,
            closeTime: new Date(exitTime * 1000).toISOString(),
            openTime: new Date(entryTime * 1000).toISOString(),
            duration,
            closeReason: reason,
            balance: Math.round(runningBalance * 100) / 100,
        });
        if (this.state.tradeHistory.length > 200) this.state.tradeHistory.pop();
        this.saveTradeHistory();

        try {
            await axios.post(`${this.BRIDGE_URL}/close_order`, {
                ticket, magic: this.settings.magic, comment: `Titan_${reason}`
            }, { timeout: 10000 });
            this.addLog(`🔒 #${ticket} fechada (${reason}) P&L: $${profit.toFixed(2)}`, 'TRADE');
        } catch (err: any) {
            this.addLog(`❌ Erro ao fechar #${ticket}: ${err.message}`, 'WARN');
        }
    }

    // ========== FECHAR TODAS AS POSIÇÕES ==========
    private static async closeAllPositions(reason: string = 'MANUAL') {
        try {
            const snapshot = [...this.state.activeOrders];
            const realizedPnl = snapshot.reduce((acc, o) => acc + (o.profit || 0), 0);

            for (const pos of snapshot) {
                const ticket = pos.ticket;
                if (!ticket) continue;
                await this.closeSinglePosition(ticket, reason);
            }

            this.addLog(`📊 Stats: ${this.state.stats.totalTrades} trades | WR: ${this.state.stats.totalTrades > 0 ? Math.round(this.state.stats.wins / this.state.stats.totalTrades * 100) : 0}% | P&L: $${this.state.stats.closedPnL.toFixed(2)}`, 'INFO');

            this.state.activeOrders = [];
        } catch (err) {
            console.error('CloseAll failed:', (err as any).message);
        }
    }

    // ========== RESET MANUAL ==========
    static async resetBasket() {
        this.addLog('🔄 Titan Sniper: Reset manual solicitado.', 'INFO');
        await this.closeAllPositions('MANUAL');
    }
}
