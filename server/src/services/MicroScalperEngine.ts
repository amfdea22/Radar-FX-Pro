import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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
}

const SETTINGS_PATH = path.join(process.cwd(), 'micro_scalper_settings.json');

export class MicroScalperEngine {
    private static settings: MicroSettings = {
        enabled: false,
        symbol: 'BTCUSD',
        lotBase: 0.01,
        lotMultiplier: 1.2,
        gridStepPips: 80,
        maxLevels: 10,
        targetProfitUSD: 1.5,
        stopLossUSD: 50,
        rsiPeriod: 7,
        rsiOverbought: 75,
        rsiOversold: 25,
        magic: 888111,
        trendFilterM1: true,
        trendFilterM5: true,
        quickTP: true,
        sniperMode: true
    };

    private static state = {
        activeOrders: [] as any[],
        rsi: 50,
        trendM1: 'NEUTRAL' as string,
        trendM5: 'NEUTRAL' as string,
        lastTick: 0,
        isProcessing: false,
        sniperTrigger: null as 'BUY' | 'SELL' | null,
        logs: [] as { time: string, msg: string, type: 'INFO' | 'TRADE' | 'WARN' }[]
    };

    // URL da Bridge REAL (porta 5555)
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static addLog(msg: string, type: 'INFO' | 'TRADE' | 'WARN' = 'INFO') {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.state.logs.unshift({ time, msg, type });
        if (this.state.logs.length > 50) this.state.logs.pop();
        console.log(`[Titan Sniper] ${msg}`);
    }

    static init() {
        this.loadSettings();
        console.log('⚡ Titan Micro-Sniper: Engine v2.0 ONLINE (Bridge :5555 | 1s Cycle)');
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

    static getStatus() {
        return {
            settings: this.settings,
            ...this.state,
            activePositions: this.state.activeOrders.length,
            totalProfit: this.state.activeOrders.reduce((acc, o) => acc + (o.profit || 0), 0)
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
            // 1. Sync posições e dados de mercado da Bridge real
            await this.syncPositions();
            await this.syncMarketData();

            // 2. Check Basket TP/SL
            const totalProfit = this.state.activeOrders.reduce((acc, o) => acc + (o.profit || 0), 0);
            if (this.state.activeOrders.length > 0) {
                if (totalProfit >= this.settings.targetProfitUSD) {
                    this.addLog(`🎯 Alvo da cesta alcançado: +$${totalProfit.toFixed(2)}. Fechando tudo.`, 'TRADE');
                    await this.closeAllPositions();
                    this.state.isProcessing = false;
                    return;
                }
                if (totalProfit <= -this.settings.stopLossUSD) {
                    this.addLog(`⚠️ Stop Loss da cesta atingido: -$${Math.abs(totalProfit).toFixed(2)}. Fechando tudo.`, 'WARN');
                    await this.closeAllPositions();
                    this.state.isProcessing = false;
                    return;
                }
            }

            // 3. Trading Logic
            if (this.state.activeOrders.length === 0) {
                await this.checkFirstEntry();
            } else if (this.state.activeOrders.length < this.settings.maxLevels) {
                await this.manageGrid();
            }

        } catch (err) {
            console.error('Titan Sniper Cycle Error:', (err as any).message);
        } finally {
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

            // Buscar candles M5 para tendência de médio prazo
            const m5Resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.settings.symbol}&timeframe=M5&count=14`, { timeout: 10000 });
            const m5Candles = Array.isArray(m5Resp.data) ? m5Resp.data : [];

            if (m5Candles.length >= 9) {
                this.state.trendM5 = this.detectTrend(m5Candles.slice(-9));
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

        if (lastClose > sma9 * 1.0005) return 'BULLISH';
        if (lastClose < sma9 * 0.9995) return 'BEARISH';
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

    // ========== PRIMEIRA ENTRADA (Sniper Shot) ==========
    private static async checkFirstEntry() {
        const { rsi, trendM1, trendM5, sniperTrigger } = this.state;
        const { rsiOversold, rsiOverbought, trendFilterM1, trendFilterM5, sniperMode } = this.settings;

        let side: 'BUY' | 'SELL' | null = null;

        // Modo Sniper: Exige padrão de vela específico
        if (sniperMode) {
            if (!sniperTrigger) return; // Sem gatilho = sem entrada

            // Validar confluência RSI + Sniper Trigger
            if (sniperTrigger === 'BUY' && rsi < rsiOverbought) {
                if (!trendFilterM5 || trendM5 !== 'BEARISH') {
                    side = 'BUY';
                }
            } else if (sniperTrigger === 'SELL' && rsi > rsiOversold) {
                if (!trendFilterM5 || trendM5 !== 'BULLISH') {
                    side = 'SELL';
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
            const reason = sniperMode ? `Sniper ${sniperTrigger}` : 'RSI Signal';
            this.addLog(`🚀 Titan disparo detectado [${side}] (${reason}). RSI: ${rsi.toFixed(1)}`, 'TRADE');
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

            const diffPips = Math.abs(currentPrice - openPrice);
            const gridDist = this.settings.gridStepPips;

            // Se o preço se moveu contra a ordem além do grid step
            const isAgainst = lastOrder.type === 0
                ? currentPrice < openPrice
                : currentPrice > openPrice;

            if (isAgainst && diffPips >= gridDist) {
                const nextLot = Number((lastOrder.volume * this.settings.lotMultiplier).toFixed(2));
                const side: 'BUY' | 'SELL' = lastOrder.type === 0 ? 'BUY' : 'SELL';

                this.addLog(`⛓️ Grid nível ${this.state.activeOrders.length + 1}. Lote: ${nextLot}`, 'INFO');
                await this.placeOrder(side, nextLot);
            }
        } catch (err) {
            // Ignora erro de tick
        }
    }

    // ========== ABRIR ORDEM (endpoint /order) ==========
    private static async placeOrder(side: 'BUY' | 'SELL', lot: number) {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                action: side,
                symbol: this.settings.symbol,
                lot: lot,
                magic: this.settings.magic,
                comment: 'Titan_Sniper'
            }, { timeout: 15000 });

            if (resp.data?.status === 'success') {
                this.addLog(`✅ Ordem ${side} aberta. Ticket: #${resp.data.order_id}`, 'TRADE');
            } else {
                this.addLog(`❌ Falha ao abrir ordem: ${resp.data?.error || 'Unknown'}`, 'WARN');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            this.addLog(`❌ Erro ao enviar ordem: ${errorMsg}`, 'WARN');
        }
    }

    // ========== FECHAR TODAS AS POSIÇÕES (endpoint /close_order por ticket) ==========
    private static async closeAllPositions() {
        try {
            for (const pos of this.state.activeOrders) {
                const ticket = pos.ticket;
                if (!ticket) continue;

                try {
                    await axios.post(`${this.BRIDGE_URL}/close_order`, {
                        ticket: ticket,
                        magic: this.settings.magic,
                        comment: 'Titan_Close'
                    }, { timeout: 15000 });
                    this.addLog(`🔒 Fechada posição #${ticket}`, 'INFO');
                } catch (closeErr: any) {
                    this.addLog(`❌ Falha ao fechar #${ticket}: ${closeErr.message}`, 'WARN');
                }
            }
            this.state.activeOrders = [];
        } catch (err) {
            console.error('CloseAll failed:', (err as any).message);
        }
    }

    // ========== RESET MANUAL ==========
    static async resetBasket() {
        this.addLog('🔄 Titan Sniper: Reset manual solicitado.', 'INFO');
        await this.closeAllPositions();
    }
}
