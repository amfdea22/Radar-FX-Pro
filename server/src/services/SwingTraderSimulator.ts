import axios from 'axios';
import { SwingTraderEngine } from './SwingTraderEngine';

interface BacktestResult {
    symbol: string;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
    profitFactor: number;
    maxDrawdown: number;
    trades: any[];
}

export class SwingTraderSimulator {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    static async runBacktest(symbol: string, days: number = 30): Promise<BacktestResult> {
        console.log(`🧪 Iniciando Backtest IA para ${symbol} (${days} dias)...`);

        // 1. Buscar dados históricos (D1, H4, H1)
        const h1Count = Math.min(days * 24, 2000); // Limite de 2000 para segurança
        const h4Count = Math.ceil(h1Count / 4) + 100;
        const d1Count = Math.ceil(days) + 100;

        const [d1Data, h4Data, h1Data] = await Promise.all([
            this.fetchHistorical(symbol, 'D1', d1Count),
            this.fetchHistorical(symbol, 'H4', h4Count),
            this.fetchHistorical(symbol, 'H1', h1Count)
        ]);

        if (h1Data.length < 50) {
            return {
                symbol, totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalProfit: 0, profitFactor: 0, maxDrawdown: 0, trades: [],
                error: 'Dados insuficientes (< 50 velas H1) para simulação.'
            } as any;
        }

        const trades: any[] = [];
        let balance = 0;
        let peakBalance = 0;
        let maxDD = 0;
        let currentTrade: any = null;

        const minScore = 70; // Hardcoded default for backtest base

        // 2. Simulação Bar-by-Bar (H1)
        // Começamos após termos dados suficientes para indicadores
        for (let i = 100; i < h1Data.length; i++) {
            const currentTime = h1Data[i].time;

            // Gerenciar trade aberto
            if (currentTrade) {
                const candle = h1Data[i];
                const high = candle.high;
                const low = candle.low;

                let hit = false;

                if (currentTrade.type === 'BUY') {
                    if (low <= currentTrade.sl) {
                        balance += (currentTrade.sl - currentTrade.entry) * 100; // Simplificado sem considerar spread/lote variável
                        currentTrade.exit = currentTrade.sl;
                        currentTrade.result = 'LOSS';
                        hit = true;
                    } else if (high >= currentTrade.tp) {
                        balance += (currentTrade.tp - currentTrade.entry) * 100;
                        currentTrade.exit = currentTrade.tp;
                        currentTrade.result = 'WIN';
                        hit = true;
                    }
                } else {
                    if (high >= currentTrade.sl) {
                        balance += (currentTrade.entry - currentTrade.sl) * 100;
                        currentTrade.exit = currentTrade.sl;
                        currentTrade.result = 'LOSS';
                        hit = true;
                    } else if (low <= currentTrade.tp) {
                        balance += (currentTrade.entry - currentTrade.tp) * 100;
                        currentTrade.exit = currentTrade.tp;
                        currentTrade.result = 'WIN';
                        hit = true;
                    }
                }

                if (hit) {
                    currentTrade.exitTime = currentTime;
                    // Cálculo de lucro realista (Points * 0.01 lot)
                    const points = Math.abs(currentTrade.exit - currentTrade.entry);
                    currentTrade.profit = (currentTrade.result === 'WIN' ? points : -points) * (symbol.includes('BTC') ? 0.01 : 10);

                    trades.push(currentTrade);
                    balance += currentTrade.profit;
                    currentTrade = null;

                    if (balance > peakBalance) peakBalance = balance;
                    const dd = peakBalance - balance;
                    if (dd > maxDD) maxDD = dd;
                }
                continue;
            }

            // 3. Gerar Análise Fake para o Momento i
            // Pegamos fatias dos dados que seriam visíveis no tempo i
            const visibleH1 = h1Data.slice(0, i + 1);
            const visibleH4 = h4Data.filter(c => c.time <= currentTime);
            const visibleD1 = d1Data.filter(c => c.time <= currentTime);

            if (visibleH4.length < 40 || visibleD1.length < 50) continue;

            // Reutilizar lógica de cálculo da Engine (mocking private methods via any or exporting them)
            const analysis = this.analyzeSnapshot(symbol, visibleD1, visibleH4, visibleH1);

            if (analysis.swingScore >= minScore && analysis.direction) {
                const atr = analysis.atrH4;
                const slDist = atr * 1.5;
                const tpDist = atr * 3.0;

                const entry = h1Data[i].close;
                currentTrade = {
                    time: currentTime,
                    type: analysis.direction,
                    entry: entry,
                    sl: analysis.direction === 'BUY' ? entry - slDist : entry + slDist,
                    tp: analysis.direction === 'BUY' ? entry + tpDist : entry - tpDist,
                    score: analysis.swingScore
                };
            }
        }

        const wins = trades.filter(t => t.result === 'WIN').length;
        const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
        const grossProfit = trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
        const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));

        return {
            symbol,
            totalTrades: trades.length,
            wins,
            losses: trades.length - wins,
            winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
            totalProfit,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
            maxDrawdown: maxDD,
            trades
        };
    }

    private static async fetchHistorical(symbol: string, tf: string, count: number) {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${tf}&count=${count}`);
            return Array.isArray(resp.data) ? resp.data : [];
        } catch {
            return [];
        }
    }

    // Snapshot Analysis (Logic copy from Engine but optimized for backtest)
    private static analyzeSnapshot(symbol: string, d1: any[], h4: any[], h1: any[]) {
        // Cópia simplificada da lógica do SwingTraderEngine para o backtest
        const ema50D1 = this.calcEMA(d1.map(c => c.close), 50);
        const ema200D1 = this.calcEMA(d1.map(c => c.close), 200);
        const ema21H4 = this.calcEMA(h4.map(c => c.close), 21);
        const lastH4 = h4[h4.length - 1];
        const rsi14 = this.calcRSI(h4.map(c => c.close), 14);
        const atr = this.calcATR(h4, 14);

        const trendD1 = ema50D1 > ema200D1 ? 'BULLISH' : 'BEARISH';
        const trendH4 = lastH4.close > ema21H4 ? 'BULLISH' : 'BEARISH';

        // Mock score logic (simplificada)
        let score = 40;
        if (trendD1 === trendH4) score += 20;
        if (trendD1 === 'BULLISH' && rsi14 < 50) score += 20;
        if (trendD1 === 'BEARISH' && rsi14 > 50) score += 20;
        if (rsi14 < 30 || rsi14 > 70) score += 10;

        return {
            swingScore: score,
            direction: trendD1 === 'BULLISH' ? 'BUY' : 'SELL',
            atrH4: atr
        };
    }

    private static calcEMA(data: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private static calcRSI(closes: number[], period: number): number {
        if (closes.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff; else losses += Math.abs(diff);
        }
        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }

    private static calcATR(candles: any[], period: number): number {
        const trs = [];
        for (let i = 1; i < candles.length; i++) {
            const hl = candles[i].high - candles[i].low;
            const hc = Math.abs(candles[i].high - candles[i - 1].close);
            const lc = Math.abs(candles[i].low - candles[i - 1].close);
            trs.push(Math.max(hl, hc, lc));
        }
        const slice = trs.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    }
}
