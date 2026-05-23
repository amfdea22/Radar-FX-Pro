import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface ForexScalperSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
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
    globalTrailingEnabled: boolean;
    gridMultiplier: number;
    gridDynamicDistance: boolean;
    magic: number;
}

const SETTINGS_PATH = path.join(process.cwd(), 'forex_scalper_settings.json');

export class ForexScalperEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static settings: ForexScalperSettings = {
        enabled: false,
        symbols: ['EURUSD', 'GBPUSD'],
        lotSize: 0.01,
        gridDistancePoints: 25,
        maxGridLevels: 10,
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
        globalTrailingEnabled: true,
        gridMultiplier: 1.5,
        gridDynamicDistance: true,
        magic: 777111
    };

    private static state = {
        dailyProfit: 0,
        isGoalReached: false,
        isProcessing: false,
        lastResetDay: '',
        activePositions: [] as any[],
        logs: [] as { time: string; msg: string; type: 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' }[]
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

            // SYNC SETTINGS (TP/SL) for existing orders
            const targetTp = pos.type === 0 ? pos.price_open + (this.settings.takeProfitPoints * pointSize) : pos.price_open - (this.settings.takeProfitPoints * pointSize);
            const currentTp = parseFloat(pos.tp);
            const diffTp = Math.abs(currentTp - targetTp) / pointSize;

            if (this.settings.takeProfitPoints > 0 && diffTp > 2) {
                try {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket: pos.ticket, sl: pos.sl, tp: targetTp, magic: this.settings.magic }, { timeout: 3000 });
                    this.addLog(`🔄 Sincronizado TP ultra-ágil (${this.settings.takeProfitPoints} pts) p/ ${pos.ticket}`, 'INFO');
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

        // BASKET TAKE PROFIT (Calculated natively vs bridge)
        // If the basket for this symbol hits the take profit in total, we close it all
        // For simplicity, native TP points handles individual orders. But if they want a grid, a basket TP is usually better.
        const totalProfitUsd = positions.reduce((sum, p) => sum + (parseFloat(p.profit) || 0), 0);

        // Approximate TP based on money scaling (if $1 is roughly X points, etc).
        // Since the user asked for "Take Profit Inteligente", closing the basket in positive is a smart feature.
        if (totalProfitUsd > (this.settings.lotSize * this.settings.takeProfitPoints * 0.1) && totalProfitUsd > 0.5) { // rough dollar heuristic
            // Or we can rely on native TP assigned during execution. The instructions said TP inteligente. Let's do Basket TP:
            this.addLog(`💰 Basket Take Profit atingido em ${symbol}: $${totalProfitUsd.toFixed(2)}`, 'SUCCESS');
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

                let side: 'BUY' | 'SELL' | null = null;
                // High Frequency Triggers (40/60 instead of 30/70)
                if (rsi < 42) side = 'BUY';
                else if (rsi > 58) side = 'SELL';

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

                        await this.executeTrade(symbol, side, comment, targetPrice);
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

    private static async executeTrade(symbol: string, side: 'BUY' | 'SELL', comment: string, price: number = 0, overrideLot: number = 0) {
        try {
            const lot = overrideLot > 0 ? overrideLot : this.settings.lotSize;
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

            if (this.settings.stopLossPoints > 0) payload.sl_points = this.settings.stopLossPoints;
            if (this.settings.takeProfitPoints > 0) payload.tp_points = this.settings.takeProfitPoints;

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, payload, { timeout: 4000 });
            if (resp.data?.status === 'success' || resp.data?.ticket) {
                const actionDesc = price > 0 ? `LIMIT ${side}` : side;
                this.addLog(`⚡ Ordem ${actionDesc} em ${symbol} (${comment})`, 'TRADE');
            }
        } catch (err: any) {
            this.addLog(`Falha ao abrir ordem ${side} em ${symbol}`, 'WARN');
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
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }
}
