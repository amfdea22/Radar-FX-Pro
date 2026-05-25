import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { SymbolLockService } from './SymbolLockService';

interface ForexScalperSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    useRiskPercentage: boolean;
    riskPercentage: number;
    gridDistancePoints: number;
    maxGridLevels: number;
    maxDailyLossUSD: number;
    dailyTargetUSD: number;
    smartBreakevenEnabled: boolean;
    smartBreakevenTriggerPoints: number;
    smartBreakevenLockPoints: number;
    takeProfitPoints: number;
    stopLossPoints: number;
    trailingStopEnabled: boolean;
    trailingStopPoints: number;
    basketSize: number;
    basketOffsetPoints: number;
    basketTPMultiplier: number;
    globalTrailingEnabled: boolean;
    gridMultiplier: number;
    gridDynamicDistance: boolean;
    trendFilterM5: boolean;
    magic: number;
}

const SETTINGS_PATH = path.join(process.cwd(), 'forex_scalper_settings.json');

export class ForexScalperEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static settings: ForexScalperSettings = {
        enabled: false,
        symbols: ['EURUSD', 'GBPUSD'],
        lotSize: 0.01,
        useRiskPercentage: false,
        riskPercentage: 1.0,
        gridDistancePoints: 25,
        maxGridLevels: 5,
        maxDailyLossUSD: 20,
        dailyTargetUSD: 20,
        smartBreakevenEnabled: true,
        smartBreakevenTriggerPoints: 12,
        smartBreakevenLockPoints: 3,
        takeProfitPoints: 25,
        stopLossPoints: 100,
        trailingStopEnabled: true,
        trailingStopPoints: 15,
        basketSize: 3,
        basketOffsetPoints: 20,
        basketTPMultiplier: 3.0,
        globalTrailingEnabled: true,
        gridMultiplier: 1.5,
        gridDynamicDistance: true,
        trendFilterM5: false,
        magic: 777111
    };

    private static state = {
        dailyProfit: 0,
        isGoalReached: false,
        isProcessing: false,
        lastResetDay: '',
        activePositions: [] as any[],
        logs: [] as { time: string; msg: string; type: 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' }[],
        lastTpSync: {} as Record<number, number>, // ticket -> last sync timestamp
        lastGlobalTrail: 0
    };

    static init() {
        this.loadSettings();
        console.log('⚡ Speed Scalper Engine ONLINE | Magic:', this.settings.magic);
        setInterval(() => this.mainCycle(), 2000); // 2 sec cycle for ULTRA FAST response
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
            } else {
                this.saveSettings();
            }
        } catch (err) {
            console.error('SpeedScalper: Error loading settings:', err);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (err) {
            console.error('SpeedScalper: Error saving settings:', err);
        }
    }

    static updateSettings(newSettings: Partial<ForexScalperSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    static getStatus() {
        return {
            settings: this.settings,
            state: this.state
        };
    }

    private static addLog(msg: string, type: 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' = 'INFO') {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.state.logs.unshift({ time, msg, type });
        if (this.state.logs.length > 50) this.state.logs.pop();
        console.log(`[SpeedScalper] ${msg}`);
    }

    private static async mainCycle() {
        if (!this.settings.enabled || this.state.isProcessing) return;

        this.checkDailyReset();
        if (this.state.isGoalReached) return;

        this.state.isProcessing = true;
        try {
            await this.syncState();

            // Daily limits
            if (this.state.dailyProfit >= this.settings.dailyTargetUSD && this.settings.dailyTargetUSD > 0) {
                this.state.isGoalReached = true;
                this.addLog(`🎯 META DIÁRIA ALCANÇADA: +$${this.state.dailyProfit.toFixed(2)}!`, 'SUCCESS');
                await this.closeAll();
                return;
            }

            if (this.state.dailyProfit <= -this.settings.maxDailyLossUSD && this.settings.maxDailyLossUSD > 0) {
                this.settings.enabled = false;
                this.saveSettings();
                this.addLog(`🛑 Limite de perda diária atingido. Robô desligado.`, 'WARN');
                await this.closeAll();
                return;
            }

            // Group positions by symbol
            const positionsBySymbol: { [sym: string]: any[] } = {};
            for (const sym of this.settings.symbols) positionsBySymbol[sym] = [];
            for (const pos of this.state.activePositions) {
                if (positionsBySymbol[pos.symbol]) positionsBySymbol[pos.symbol].push(pos);
            }

            // Tick data for grid / breakeven
            const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: this.settings.symbols }).catch(() => null);
            const ticks = tickResp?.data || {};

            for (const symbol of this.settings.symbols) {
                const tick = ticks[symbol];
                if (!tick) continue;

                const posList = positionsBySymbol[symbol];

                // 1. Process collective basket protection
                await this.processOpenPositions(symbol, posList, tick);

                // 2. Process grid averaging or first entry
                await this.analyzeAndTrade(symbol, posList, tick);
            }

        } catch (err: any) {
            // silent catch to keep cycle alive
        } finally {
            this.state.isProcessing = false;
        }
    }

    private static async processOpenPositions(symbol: string, positions: any[], tick: any) {
        if (positions.length === 0) return;

        const pointSize = tick.point || (tick.digits ? Math.pow(10, -tick.digits) : 0.00001);

        for (const pos of positions) {
            // Calculate current distance from entry
            const currentPrice = pos.type === 0 ? tick.bid : tick.ask; // Buy uses bid to close, Sell uses ask to close
            const profitPoints = pos.type === 0
                ? (currentPrice - pos.price_open) / pointSize
                : (pos.price_open - currentPrice) / pointSize;

            // SYNC SETTINGS (TP/SL) for existing orders (com throttle de 30s)
            const now = Date.now();
            const lastSync = this.state.lastTpSync[pos.ticket] || 0;
            const targetTp = pos.type === 0 ? pos.price_open + (this.settings.takeProfitPoints * pointSize) : pos.price_open - (this.settings.takeProfitPoints * pointSize);
            const currentTp = parseFloat(pos.tp);
            const diffTp = Math.abs(currentTp - targetTp) / pointSize;

            if (this.settings.takeProfitPoints > 0 && diffTp > 2 && now - lastSync > 30000) {
                try {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket: pos.ticket, sl: pos.sl, tp: targetTp, magic: this.settings.magic }, { timeout: 3000 });
                    this.state.lastTpSync[pos.ticket] = now;
                    this.addLog(`🔄 Sincronizado TP (${this.settings.takeProfitPoints} pts) p/ #${pos.ticket}`, 'INFO');
                } catch (e) { }
            }

            // SMART BREAK EVEN
            if (this.settings.smartBreakevenEnabled && profitPoints >= this.settings.smartBreakevenTriggerPoints) {
                // Determine new SL price
                const currentSl = pos.sl;
                const bePrice = pos.type === 0
                    ? pos.price_open + (this.settings.smartBreakevenLockPoints * pointSize)
                    : pos.price_open - (this.settings.smartBreakevenLockPoints * pointSize);

                // Only move SL if we haven't already or if we are improving it
                const needsMove = pos.type === 0 ? (currentSl < bePrice - pointSize) : (currentSl === 0 || currentSl > bePrice + pointSize);

                if (needsMove) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: bePrice,
                            tp: pos.tp, // keep existing
                            magic: this.settings.magic
                        }, { timeout: 3000 });
                        this.addLog(`🔒 Smart Break Even ativado p/ ${pos.ticket} (+${this.settings.smartBreakevenLockPoints} pts)`, 'INFO');
                    } catch (e) { }
                }
            }

            // DYNAMIC TRAILING STOP
            if (this.settings.trailingStopEnabled && profitPoints >= this.settings.trailingStopPoints) {
                const tsDistance = this.settings.trailingStopPoints * pointSize;
                const currentSl = pos.sl;
                let newSl = 0;

                if (pos.type === 0) { // BUY
                    const targetSl = tick.bid - tsDistance;
                    if (targetSl > currentSl + pointSize) newSl = targetSl;
                } else { // SELL
                    const targetSl = tick.ask + tsDistance;
                    if (currentSl === 0 || targetSl < currentSl - pointSize) newSl = targetSl;
                }

                if (newSl !== 0) {
                    try {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: newSl,
                            tp: pos.tp,
                            magic: this.settings.magic
                        }, { timeout: 3000 });
                        // Silently update to avoid log spam, or use a throttled log
                    } catch (e) { }
                }
            }
        }

        // GLOBAL TRAILING: trava lucro da cesta inteira quando ativado
        if (this.settings.globalTrailingEnabled) {
            const totalProfitUsd = positions.reduce((sum, p) => sum + (parseFloat(p.profit) || 0), 0);
            if (totalProfitUsd > 0) {
                for (const pos of positions) {
                    const currentSl = pos.sl || 0;
                    const breakevenSl = pos.type === 0
                        ? pos.price_open + (pointSize * 2)
                        : pos.price_open - (pointSize * 2);
                    const needsMove = pos.type === 0
                        ? currentSl < breakevenSl - pointSize
                        : currentSl === 0 || currentSl > breakevenSl + pointSize;
                    if (needsMove) {
                        try {
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket, sl: breakevenSl, tp: pos.tp, magic: this.settings.magic
                            }, { timeout: 3000 });
                            this.addLog(`🔒 Proteção Global: SL #${pos.ticket} movido p/ breakeven`, 'INFO');
                        } catch (e) { }
                    }
                }
            }
        }

        // BASKET TAKE PROFIT
        const totalProfitUsd = positions.reduce((sum, p) => sum + (parseFloat(p.profit) || 0), 0);

        // Basket TP: fecha cesta quando lucro agregado >= lote * TP pontos * multiplicador configurável
        const basketTPThreshold = Math.max(
            this.settings.lotSize * this.settings.takeProfitPoints * this.settings.basketTPMultiplier * 0.01,
            0.50
        );
        if (totalProfitUsd > basketTPThreshold) {
            this.addLog(`💰 Basket TP (${this.settings.basketTPMultiplier}x) atingido em ${symbol}: $${totalProfitUsd.toFixed(2)}`, 'SUCCESS');
            await this.closePositionsList(positions);
        }
    }

    private static async analyzeAndTrade(symbol: string, positions: any[], tick: any) {
        // Fast Scalping Logic (M1 momentum)
        const pointSize = tick.point || (tick.digits ? Math.pow(10, -tick.digits) : 0.00001);

        if (positions.length === 0) {
            // First entry: M1 RSI + Fast Momentum
            try {
                const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=M1&count=20`, { timeout: 3000 });
                const candles = resp.data;
                if (!Array.isArray(candles) || candles.length < 15) return;

                const closes = candles.map(c => c.close);
                const rsi = this.calcRSI(closes, 7); // Fast RSI

                // Filtro de tendência M5 (SMA9) — opcional
                let trendOk = true;
                if (this.settings.trendFilterM5) {
                    try {
                        const m5Resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=M5&count=12`, { timeout: 3000 });
                        const m5Candles = m5Resp.data;
                        if (Array.isArray(m5Candles) && m5Candles.length >= 9) {
                            const m5Closes = m5Candles.map(c => c.close);
                            const sma9 = m5Closes.reduce((a, b) => a + b, 0) / m5Closes.length;
                            const lastClose = m5Closes[m5Closes.length - 1];
                            const m5Trend = lastClose > sma9 * 1.0005 ? 'BULLISH' : lastClose < sma9 * 0.9995 ? 'BEARISH' : 'NEUTRAL';
                            trendOk = !((rsi < 42 && m5Trend === 'BEARISH') || (rsi > 58 && m5Trend === 'BULLISH'));
                        }
                    } catch (e) { /* sem filtro se falhar */ }
                }

                let side: 'BUY' | 'SELL' | null = null;
                // High Frequency Triggers (40/60 instead of 30/70)
                if (rsi < 35 && trendOk) side = 'BUY';
                else if (rsi > 65 && trendOk) side = 'SELL';

                if (side) {
                    const pointSize = tick.point || 0.0001;
                    for (let i = 0; i < this.settings.basketSize; i++) {
                        const comment = i === 0 ? 'Disparo' : `Camada_${i}`;
                        // Calculate offset price for layers (Pending Orders)
                        let targetPrice = 0;
                        if (i > 0) {
                            const offset = i * this.settings.basketOffsetPoints * pointSize;
                            targetPrice = side === 'BUY' ? tick.ask - offset : tick.bid + offset;
                        }

                        await this.executeTrade(symbol, side, comment, targetPrice, 0, pointSize);
                    }
                }
            } catch (err) { }
        } else {
            // GRID Logic: We have open positions. Are we negative by gridDistance?
            if (positions.length >= this.settings.maxGridLevels) return; // Max levels reached

            // Find the worst position (furthest from current price) or last executed
            // For a simple grid, if the current price goes against the LAST position by gridDistance, open another.
            const mainType = positions[0].type; // 0 = Buy, 1 = Sell
            const lastPos = positions[positions.length - 1]; // Assume last is the most recent

            let distancePts = 0;
            if (mainType === 0) {
                // Buy Grid: price drops -> we buy more
                distancePts = (lastPos.price_open - tick.ask) / pointSize;
            } else {
                // Sell Grid: price rises -> we sell more
                distancePts = (tick.bid - lastPos.price_open) / pointSize;
            }

            let currentGridDistance = this.settings.gridDistancePoints;
            if (this.settings.gridDynamicDistance) {
                // Exponential increase: 25, 30, 36, 43, 52...
                currentGridDistance = Math.floor(this.settings.gridDistancePoints * Math.pow(1.2, positions.length));
            }

            if (distancePts >= currentGridDistance) {
                const side = mainType === 0 ? 'BUY' : 'SELL';
                // Calculate Martingale Lot
                const nextLot = Number((this.settings.lotSize * Math.pow(this.settings.gridMultiplier, positions.length)).toFixed(2));

                this.addLog(`📉 Grid Nível ${positions.length + 1} (${nextLot} lot) em ${symbol} p/ baixar PM`, 'TRADE');
                await this.executeTrade(symbol, side, `Grid_${positions.length + 1}`, 0, nextLot);
            }
        }
    }

    private static async executeTrade(symbol: string, side: 'BUY' | 'SELL', comment: string, price: number = 0, overrideLot: number = 0, pointSize?: number) {
        try {
            let lot = overrideLot > 0 ? overrideLot : this.settings.lotSize;
            // Calcular lote por % de risco se ativado e for primeira entrada
            if (overrideLot === 0 && this.settings.useRiskPercentage && pointSize && this.settings.stopLossPoints > 0) {
                let balance = 1000;
                try {
                    const acc = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 2000 });
                    if (acc.data?.balance) balance = acc.data.balance;
                } catch (e) { /* usa saldo padrão */ }
                const riskUSD = (balance * this.settings.riskPercentage) / 100;
                const slDistPrice = this.settings.stopLossPoints * pointSize;
                if (slDistPrice > 0) {
                    const calcLot = riskUSD / (slDistPrice * 100);
                    lot = Number(Math.max(0.01, Math.min(50, calcLot)).toFixed(2));
                    this.addLog(`📊 Lote por risco: ${lot} (${this.settings.riskPercentage}% de $${balance.toFixed(2)})`, 'INFO');
                }
            }

            // Fetch tick for MARKET orders to compute SL/TP prices
            let marketPrice = 0;
            if (price === 0 && pointSize) {
                try {
                    const tickRes = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 3000 });
                    const tick = tickRes.data?.[symbol];
                    marketPrice = side === 'BUY' ? tick?.ask || 0 : tick?.bid || 0;
                } catch (e) { /* will skip SL/TP */ }
            }

            const payload: any = {
                action: side,
                symbol: symbol,
                lot: lot,
                magic: this.settings.magic,
                comment: `Speed_${comment}`
            };

            // If price is provided, it becomes a LIMIT order in the bridge logic often
            // Or we specify the action as BUY_LIMIT / SELL_LIMIT
            if (price > 0) {
                payload.action = side === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT';
                payload.price = price;
            }

            if (this.settings.stopLossPoints > 0 && pointSize) {
                const refPrice = price > 0 ? price : marketPrice;
                if (refPrice > 0) {
                    const slDist = this.settings.stopLossPoints * pointSize;
                    payload.sl = side === 'BUY' ? Math.round((refPrice - slDist) * 100000) / 100000 : Math.round((refPrice + slDist) * 100000) / 100000;
                }
            }
            if (this.settings.takeProfitPoints > 0 && pointSize) {
                const refPrice = price > 0 ? price : marketPrice;
                if (refPrice > 0) {
                    const tpDist = this.settings.takeProfitPoints * pointSize;
                    payload.tp = side === 'BUY' ? Math.round((refPrice + tpDist) * 100000) / 100000 : Math.round((refPrice - tpDist) * 100000) / 100000;
                }
            }

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, payload, { timeout: 4000 });
            if (resp.data?.status === 'success' || resp.data?.ticket) {
                SymbolLockService.acquire(symbol, 'Speed Scalper', resp.data?.ticket || resp.data?.order_id || 0, side);
                const actionDesc = price > 0 ? `LIMIT ${side}` : side;
                this.addLog(`⚡ Ordem ${actionDesc} em ${symbol} (${comment})`, 'TRADE');
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Speed Scalper', symbol, side, lot, resp.data.price || price, 0, 0);
                } catch (e) {}
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || String(err);
            this.addLog(`Falha ao abrir ordem ${side} em ${symbol}: ${msg}`, 'WARN');
        }
    }

    static async closePosition(ticket: number) {
        try {
            await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket, magic: this.settings.magic }, { timeout: 4000 });
            this.addLog(`🛑 Ordem ${ticket} encerrada manualmente.`, 'INFO');
            return true;
        } catch (err) {
            return false;
        }
    }

    private static async closePositionsList(positions: any[]) {
        for (const pos of positions) {
            try {
                await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: pos.ticket, magic: this.settings.magic }, { timeout: 3000 });
            } catch (err) { }
        }
    }

    private static async closeAll() {
        await this.closePositionsList(this.state.activePositions);
        this.state.activePositions = [];
    }

    private static async syncState() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions?magic=${this.settings.magic}`, { timeout: 4000 });
            this.state.activePositions = Array.isArray(resp.data) ? resp.data : [];
            this.state.dailyProfit = this.state.activePositions.reduce((sum, p) => sum + (parseFloat(p.profit) || 0), 0);
        } catch (err) {
            this.state.activePositions = [];
        }
    }

    private static checkDailyReset() {
        const today = new Date().toISOString().slice(0, 10);
        if (this.state.lastResetDay !== today) {
            this.state.dailyProfit = 0;
            this.state.isGoalReached = false;
            this.state.lastResetDay = today;
            this.addLog('🔄 Ciclo diário resetado.', 'INFO');
        }
    }

    private static calcRSI(closes: number[], period: number): number {
        if (closes.length < period + 1) return 50;
        let avgGain = 0, avgLoss = 0;
        // Wilder smoothed RSI: primeira média simples, depois suavização
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) avgGain += diff;
            else avgLoss += Math.abs(diff);
        }
        avgGain /= period;
        avgLoss /= period;
        // Suavização Wilder: aplicar nos períodos anteriores (se houver dados)
        for (let i = closes.length - period - 1; i >= 1; i--) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) { avgGain = (avgGain * (period - 1) + diff) / period; avgLoss = (avgLoss * (period - 1) + 0) / period; }
            else { avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period; avgGain = (avgGain * (period - 1) + 0) / period; }
        }
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
}
