import axios from 'axios';

interface BacktestConfig {
    symbol: string;
    days: number;
    lotSize: number;
    gridDistancePoints: number;
    maxGridLevels: number;
    takeProfitPoints: number;
    stopLossPoints: number;
    smartBreakevenEnabled: boolean;
    smartBreakevenTriggerPoints: number;
    smartBreakevenLockPoints: number;
    trailingStopEnabled: boolean;
    trailingStopPoints: number;
    basketSize: number;
    basketOffsetPoints: number;
    basketTPMultiplier: number;
    gridMultiplier: number;
    gridDynamicDistance: boolean;
    trendFilterM5: boolean;
    initialCapital: number;
}

interface SimPosition {
    type: 'BUY' | 'SELL';
    entryPrice: number;
    lots: number;
    sl: number;
    tp: number;
    gridLevel: number;
    openTime: number;
}

interface SimTrade {
    type: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    lots: number;
    profit: number;
    result: 'WIN' | 'LOSS';
    gridLevel: number;
    closeReason: string;
    openTime: number;
    closeTime: number;
}

interface BacktestResult {
    symbol: string;
    config: BacktestConfig;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    finalBalance: number;
    totalReturn: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    trades: SimTrade[];
}

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

export class ForexScalperBacktest {

    static async run(config: BacktestConfig): Promise<BacktestResult> {
        const tf = 'M1';
        const count = config.days * 24 * 60;
        const candles = await this.fetchCandles(config.symbol, tf, Math.min(count, 5000));
        if (candles.length < 100) {
            return this.emptyResult(config, 'Dados insuficientes (< 100 velas M1)');
        }

        const positions: SimPosition[] = [];
        const trades: SimTrade[] = [];
        let balance = config.initialCapital;
        let peak = balance;
        let maxDD = 0;
        let wins = 0;
        let losses = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        for (let i = 60; i < candles.length; i++) {
            const candle = candles[i];
            const high = candle.high;
            const low = candle.low;
            const close = candle.close;
            const time = candle.time;

            if (positions.length > 0) {
                const closedPnl = await this.managePositions(positions, candle, config, trades, time);
                balance += closedPnl;
            }

            if (positions.length === 0) {
                const closes = candles.slice(i - 20, i + 1).map(c => c.close);
                const rsi = this.calcRSI(closes, 7);
                let side: 'BUY' | 'SELL' | null = null;

                if (rsi < 35) side = 'BUY';
                else if (rsi > 65) side = 'SELL';

                if (side) {
                    const entryPrice = close;
                    const pointSize = this.getPointSize(config.symbol);
                    for (let b = 0; b < config.basketSize; b++) {
                        let price = entryPrice;
                        if (b > 0) {
                            const offset = b * config.basketOffsetPoints * pointSize;
                            price = side === 'BUY' ? entryPrice - offset : entryPrice + offset;
                        }
                        positions.push({
                            type: side,
                            entryPrice: price,
                            lots: config.lotSize,
                            sl: side === 'BUY'
                                ? price - config.stopLossPoints * pointSize
                                : price + config.stopLossPoints * pointSize,
                            tp: side === 'BUY'
                                ? price + config.takeProfitPoints * pointSize
                                : price - config.takeProfitPoints * pointSize,
                            gridLevel: 0,
                            openTime: time,
                        });
                    }
                }
            } else {
                await this.checkGridAveraging(positions, candle, config, time);
            }

            const currentEquity = balance + positions.reduce((s, p) => {
                const profitPoints = p.type === 'BUY'
                    ? (close - p.entryPrice) / this.getPointSize(config.symbol)
                    : (p.entryPrice - close) / this.getPointSize(config.symbol);
                return s + profitPoints * p.lots;
            }, 0);

            if (currentEquity > peak) peak = currentEquity;
            const dd = peak - currentEquity;
            if (dd > maxDD) maxDD = dd;
        }

        for (const pos of positions) {
            const lastClose = candles[candles.length - 1].close;
            const profitPoints = pos.type === 'BUY'
                ? (lastClose - pos.entryPrice) / this.getPointSize(config.symbol)
                : (pos.entryPrice - lastClose) / this.getPointSize(config.symbol);
            const profit = profitPoints * pos.lots;
            balance += profit;
            trades.push({
                type: pos.type,
                entryPrice: pos.entryPrice,
                exitPrice: lastClose,
                lots: pos.lots,
                profit: Math.round(profit * 100) / 100,
                result: profit >= 0 ? 'WIN' : 'LOSS',
                gridLevel: pos.gridLevel,
                closeReason: 'END_OF_TEST',
                openTime: pos.openTime,
                closeTime: lastClose,
            });
            if (profit >= 0) { wins++; grossProfit += profit; }
            else { losses++; grossLoss += Math.abs(profit); }
        }

        wins = trades.filter(t => t.result === 'WIN').length;
        losses = trades.filter(t => t.result === 'LOSS').length;
        grossProfit = trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
        grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));
        const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const totalTrades = trades.length;

        return {
            symbol: config.symbol,
            config,
            totalTrades,
            wins,
            losses,
            winRate: totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(2)) : 0,
            totalProfit: Math.round(totalProfit * 100) / 100,
            grossProfit: Math.round(grossProfit * 100) / 100,
            grossLoss: Math.round(grossLoss * 100) / 100,
            profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0,
            maxDrawdown: Math.round(maxDD * 100) / 100,
            maxDrawdownPct: config.initialCapital > 0 ? Number(((maxDD / config.initialCapital) * 100).toFixed(2)) : 0,
            finalBalance: Math.round(balance * 100) / 100,
            totalReturn: config.initialCapital > 0 ? Number((((balance - config.initialCapital) / config.initialCapital) * 100).toFixed(2)) : 0,
            avgWin: Math.round(avgWin * 100) / 100,
            avgLoss: Math.round(avgLoss * 100) / 100,
            expectancy: Math.round((avgWin * wins - avgLoss * losses) / totalTrades * 100) / 100 || 0,
            trades: trades.slice(-100).reverse(),
        };
    }

    private static async managePositions(positions: SimPosition[], candle: any, config: BacktestConfig, trades: SimTrade[], time: number): Promise<number> {
        const high = candle.high;
        const low = candle.low;
        const pointSize = this.getPointSize(config.symbol);
        const closed: number[] = [];
        let closedPnl = 0;

        for (let j = 0; j < positions.length; j++) {
            const pos = positions[j];
            const currentProfitPts = pos.type === 'BUY'
                ? (candle.close - pos.entryPrice) / pointSize
                : (pos.entryPrice - candle.close) / pointSize;

            let hit = false;
            let exitPrice = 0;
            let reason = '';

            if (pos.type === 'BUY') {
                if (low <= pos.sl) { exitPrice = pos.sl; reason = 'SL'; hit = true; }
                else if (high >= pos.tp) { exitPrice = pos.tp; reason = 'TP'; hit = true; }
            } else {
                if (high >= pos.sl) { exitPrice = pos.sl; reason = 'SL'; hit = true; }
                else if (low <= pos.tp) { exitPrice = pos.tp; reason = 'TP'; hit = true; }
            }

            if (!hit && config.smartBreakevenEnabled && currentProfitPts >= config.smartBreakevenTriggerPoints) {
                const bePrice = pos.type === 'BUY'
                    ? pos.entryPrice + config.smartBreakevenLockPoints * pointSize
                    : pos.entryPrice - config.smartBreakevenLockPoints * pointSize;
                const needsMove = pos.type === 'BUY' ? pos.sl < bePrice : pos.sl > bePrice;
                if (needsMove) pos.sl = bePrice;
            }

            if (!hit && config.trailingStopEnabled && currentProfitPts >= config.trailingStopPoints) {
                const tsDist = config.trailingStopPoints * pointSize;
                const newSl = pos.type === 'BUY' ? candle.close - tsDist : candle.close + tsDist;
                if (pos.type === 'BUY' ? newSl > pos.sl : newSl < pos.sl) pos.sl = newSl;
            }

                if (hit) {
                const profitPts = Math.abs(exitPrice - pos.entryPrice) / pointSize;
                const profit = profitPts * pos.lots;
                trades.push({
                    type: pos.type,
                    entryPrice: pos.entryPrice,
                    exitPrice,
                    lots: pos.lots,
                    profit: Math.round(profit * 100) / 100,
                    result: profit >= 0 ? 'WIN' : 'LOSS',
                    gridLevel: pos.gridLevel,
                    closeReason: reason,
                    openTime: pos.openTime,
                    closeTime: time,
                });
                closedPnl += profit;
                closed.push(j);
            }
        }

        for (const idx of closed.sort((a, b) => b - a)) positions.splice(idx, 1);

        // Update equity and check basket TP using positions still open
        const totalProfitUsd = positions.reduce((s, p) => {
            const pts = p.type === 'BUY'
                ? (candle.close - p.entryPrice) / pointSize
                : (p.entryPrice - candle.close) / pointSize;
            return s + pts * p.lots;
        }, 0);

        const basketTPThreshold = Math.max(
            config.lotSize * config.takeProfitPoints * config.basketTPMultiplier * 0.01, 0.50
        );
        if (totalProfitUsd > basketTPThreshold && positions.length > 0) {
            for (const pos of positions) {
                const profitPts = pos.type === 'BUY'
                    ? (candle.close - pos.entryPrice) / pointSize
                    : (pos.entryPrice - candle.close) / pointSize;
                const profit = profitPts * pos.lots;
                trades.push({
                    type: pos.type,
                    entryPrice: pos.entryPrice,
                    exitPrice: candle.close,
                    lots: pos.lots,
                    profit: Math.round(profit * 100) / 100,
                    result: profit >= 0 ? 'WIN' : 'LOSS',
                    gridLevel: pos.gridLevel,
                    closeReason: 'BASKET_TP',
                    openTime: pos.openTime,
                    closeTime: time,
                });
                closedPnl += profit;
            }
            positions.length = 0;
        }
        return closedPnl;
    }

    private static async checkGridAveraging(positions: SimPosition[], candle: any, config: BacktestConfig, time: number) {
        if (positions.length >= config.maxGridLevels) return;

        const pointSize = this.getPointSize(config.symbol);
        const mainType = positions[0].type;
        const lastPos = positions[positions.length - 1];

        let distancePts = 0;
        if (mainType === 'BUY') distancePts = (lastPos.entryPrice - candle.close) / pointSize;
        else distancePts = (candle.close - lastPos.entryPrice) / pointSize;

        let currentGridDistance = config.gridDistancePoints;
        if (config.gridDynamicDistance) {
            currentGridDistance = Math.floor(config.gridDistancePoints * Math.pow(1.2, positions.length));
        }

        if (distancePts >= currentGridDistance) {
            const side = mainType === 'BUY' ? 'BUY' : 'SELL';
            const nextLot = Number((config.lotSize * Math.pow(config.gridMultiplier, positions.length)).toFixed(2));
            positions.push({
                type: side as 'BUY' | 'SELL',
                entryPrice: candle.close,
                lots: nextLot,
                sl: side === 'BUY'
                    ? candle.close - config.stopLossPoints * pointSize
                    : candle.close + config.stopLossPoints * pointSize,
                tp: side === 'BUY'
                    ? candle.close + config.takeProfitPoints * pointSize
                    : candle.close - config.takeProfitPoints * pointSize,
                gridLevel: positions.length + 1,
                openTime: time,
            });
        }
    }

    private static async fetchCandles(symbol: string, tf: string, count: number) {
        try {
            const resp = await axios.get(`${BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${tf}&count=${count}`, { timeout: 30000 });
            const data = Array.isArray(resp.data) ? resp.data : [];
            return data.map((c: any) => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.tick_volume || c.volume || 0,
            }));
        } catch { return []; }
    }

    private static getPointSize(symbol: string): number {
        if (symbol.includes('BTC') || symbol.includes('ETH')) return 0.1;
        if (symbol.includes('XAU') || symbol.includes('GOLD')) return 0.01;
        return 0.00001;
    }

    private static calcRSI(closes: number[], period: number): number {
        if (closes.length < period + 1) return 50;
        let avgGain = 0, avgLoss = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
        }
        avgGain /= period; avgLoss /= period;
        for (let i = closes.length - period - 1; i >= 1; i--) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) { avgGain = (avgGain * (period - 1) + diff) / period; avgLoss = (avgLoss * (period - 1) + 0) / period; }
            else { avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period; avgGain = (avgGain * (period - 1) + 0) / period; }
        }
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }

    private static emptyResult(config: BacktestConfig, error: string): BacktestResult {
        return {
            symbol: config.symbol, config,
            totalTrades: 0, wins: 0, losses: 0, winRate: 0,
            totalProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0,
            maxDrawdown: 0, maxDrawdownPct: 0,
            finalBalance: config.initialCapital, totalReturn: 0,
            avgWin: 0, avgLoss: 0, expectancy: 0, trades: [],
        };
    }
}
