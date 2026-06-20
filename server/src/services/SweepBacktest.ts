import axios from 'axios';

interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface SwingPoint {
    time: number;
    price: number;
    type: 'HIGH' | 'LOW';
}

interface BacktestParams {
    slMultiplier: number;
    tpMultiplier: number;
    minScore: number;
}

interface BacktestTrade {
    entryTime: number;
    exitTime: number;
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    sl: number;
    tp: number;
    swingLevel: number;
    score: number;
    result: 'WIN' | 'LOSS' | null;
    profit: number;
    pips: number;
    holdBars: number;
    entryIndex: number;
}

interface BacktestResult {
    symbol: string;
    params: BacktestParams;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
    profitFactor: number;
    maxDrawdown: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    avgHoldBars: number;
    trades: BacktestTrade[];
}

interface OptimizationResult {
    symbol: string;
    totalCombos: number;
    results: BacktestResult[];
    bestByProfit: BacktestResult;
    bestByWinRate: BacktestResult;
    bestByProfitFactor: BacktestResult;
    bestByExpectancy: BacktestResult;
}

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

function getPipSize(symbol: string): number {
    if (/^X(AU|AG|PD|PT|CU)/i.test(symbol)) return 0.01;
    if (/^(BTC|ETH|LTC|XRP)/i.test(symbol)) return 0.01;
    if (/JPY/i.test(symbol)) return 0.001;
    return 0.0001;
}

function getTickValue(symbol: string): number {
    if (/^X(AU|AG|PD|PT|CU)/i.test(symbol)) return 0.10;
    if (/^(BTC|ETH)/i.test(symbol)) return 0.01;
    if (/JPY/i.test(symbol)) return 0.10;
    return 0.10;
}

function updateSwingPoints(candles: Candle[]): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];
    const lookback = 5;
    for (let i = lookback; i < candles.length - lookback; i++) {
        const c = candles[i];
        const prev = candles.slice(i - lookback, i);
        const next = candles.slice(i + 1, i + 1 + lookback);
        if (prev.every(p => c.high > p.high) && next.every(n => c.high >= n.high))
            highs.push({ time: c.time, price: c.high, type: 'HIGH' });
        if (prev.every(p => c.low < p.low) && next.every(n => c.low <= n.low))
            lows.push({ time: c.time, price: c.low, type: 'LOW' });
    }
    return { highs: highs.slice(-20), lows: lows.slice(-20) };
}

async function fetchCandles(symbol: string, tf: string, count: number): Promise<Candle[]> {
    try {
        const resp = await axios.get(`${BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${tf}&count=${count}`, { timeout: 20000 });
        return Array.isArray(resp.data) ? resp.data : [];
    } catch { return []; }
}

async function runBacktest(symbol: string, params: BacktestParams): Promise<BacktestResult> {
    const [h4Raw, m15Raw] = await Promise.all([
        fetchCandles(symbol, 'H4', 200),
        fetchCandles(symbol, 'M15', 1000)
    ]);

    if (h4Raw.length < 40 || m15Raw.length < 60) return emptyResult(symbol, params);

    const pipSize = getPipSize(symbol);
    const tickValue = getTickValue(symbol);
    const trades: BacktestTrade[] = [];
    const lastSweepTime: Record<string, number> = {};
    const cooldownMs = 15 * 60 * 1000;
    let balance = 0, peak = 0, maxDD = 0;

    for (let i = 60; i < m15Raw.length; i++) {
        const currentTime = m15Raw[i].time;
        const h4UpToNow = h4Raw.filter(h => h.time <= currentTime);
        if (h4UpToNow.length < 40) continue;

        const { highs, lows } = updateSwingPoints(h4UpToNow);
        const recentM15 = m15Raw.slice(Math.max(0, i - 29), i + 1);
        const lastH4 = h4UpToNow[h4UpToNow.length - 1];

        // Check open trade
        const openIdx = trades.findIndex(t => t.result === null);
        if (openIdx !== -1) {
            const t = trades[openIdx];
            const c = m15Raw[i];
            if (t.direction === 'BUY') {
                if (c.low <= t.sl) {
                    t.result = 'LOSS'; t.exitPrice = t.sl; t.exitTime = currentTime;
                } else if (c.high >= t.tp) {
                    t.result = 'WIN'; t.exitPrice = t.tp; t.exitTime = currentTime;
                }
            } else {
                if (c.high >= t.sl) {
                    t.result = 'LOSS'; t.exitPrice = t.sl; t.exitTime = currentTime;
                } else if (c.low <= t.tp) {
                    t.result = 'WIN'; t.exitPrice = t.tp; t.exitTime = currentTime;
                }
            }
            if (t.result) {
                t.holdBars = i - t.entryIndex;
                const points = Math.abs(t.exitPrice - t.entryPrice);
                t.profit = (t.result === 'WIN' ? 1 : -1) * points * (1 / pipSize) * tickValue * 0.01; // 0.01 lot
                balance += t.profit;
                if (balance > peak) peak = balance;
                if (peak - balance > maxDD) maxDD = peak - balance;
            }
        }

        if (trades.some(t => t.result === null)) continue;

        // BUY sweep
        for (const low of [...lows].reverse()) {
            const sweptCandle = recentM15.find(c => c.low < low.price && c.close > low.price);
            if (!sweptCandle) continue;
            const swingKey = `${symbol}_LOW_${low.time}`;
            if (currentTime - (lastSweepTime[swingKey] || 0) < cooldownMs) continue;

            const entryPrice = sweptCandle.close;
            const slDist = Math.max(entryPrice - low.price + (pipSize * 10), pipSize);
            let score = 60;
            const sl = entryPrice - slDist * params.slMultiplier;
            const tp = entryPrice + slDist * params.tpMultiplier;

            const bullish = h4UpToNow.slice(-3).filter(c => c.close > c.open).length;
            if (bullish >= 2) score += 15;
            if (low.price < lastH4.close) score += 10;
            if (recentM15.filter(c => c.low < low.price).length >= 2) score += 10;

            if (score >= params.minScore) {
                lastSweepTime[swingKey] = currentTime;
                trades.push({ entryTime: currentTime, exitTime: 0, symbol, direction: 'BUY', entryPrice, exitPrice: 0, sl, tp, swingLevel: low.price, score, result: null, profit: 0, pips: 0, holdBars: 0, entryIndex: i });
                break;
            }
        }

        if (trades.some(t => t.result === null)) continue;

        // SELL sweep
        for (const high of [...highs].reverse()) {
            const sweptCandle = recentM15.find(c => c.high > high.price && c.close < high.price);
            if (!sweptCandle) continue;
            const swingKey = `${symbol}_HIGH_${high.time}`;
            if (currentTime - (lastSweepTime[swingKey] || 0) < cooldownMs) continue;

            const entryPrice = sweptCandle.close;
            const slDist = Math.max(high.price - entryPrice + (pipSize * 10), pipSize);
            let score = 60;
            const sl = entryPrice + slDist * params.slMultiplier;
            const tp = entryPrice - slDist * params.tpMultiplier;

            const bearish = h4UpToNow.slice(-3).filter(c => c.close < c.open).length;
            if (bearish >= 2) score += 15;
            if (high.price > lastH4.close) score += 10;
            if (recentM15.filter(c => c.high > high.price).length >= 2) score += 10;

            if (score >= params.minScore) {
                lastSweepTime[swingKey] = currentTime;
                trades.push({ entryTime: currentTime, exitTime: 0, symbol, direction: 'SELL', entryPrice, exitPrice: 0, sl, tp, swingLevel: high.price, score, result: null, profit: 0, pips: 0, holdBars: 0, entryIndex: i });
                break;
            }
        }
    }

    // Close remaining as loss
    for (const t of trades) {
        if (t.result) continue;
        const lastC = m15Raw[m15Raw.length - 1];
        t.result = 'LOSS';
        t.exitPrice = lastC.close;
        t.exitTime = lastC.time;
        t.holdBars = m15Raw.length - 1 - t.entryIndex;
        const points = Math.abs(t.exitPrice - t.entryPrice);
        t.profit = -points * (1 / pipSize) * tickValue * 0.01;
        balance += t.profit;
        if (balance > peak) peak = balance;
        if (peak - balance > maxDD) maxDD = peak - balance;
    }

    const completed = trades.filter(t => t.result === 'WIN' || t.result === 'LOSS');
    if (completed.length === 0) return emptyResult(symbol, params);

    // Set pips for display
    for (const t of completed) {
        t.pips = Math.abs(t.exitPrice - t.entryPrice) / pipSize;
    }

    return computeResult(symbol, params, completed, balance, maxDD);
}

function emptyResult(symbol: string, params: BacktestParams): BacktestResult {
    return { symbol, params, totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalProfit: 0, profitFactor: 0, maxDrawdown: 0, avgWin: 0, avgLoss: 0, expectancy: 0, avgHoldBars: 0, trades: [] };
}

function computeResult(symbol: string, params: BacktestParams, completed: BacktestTrade[], balance: number, maxDD: number): BacktestResult {
    const wins = completed.filter(t => t.result === 'WIN').length;
    const losses = completed.filter(t => t.result === 'LOSS').length;
    const grossWin = completed.filter(t => t.result === 'WIN').reduce((s, t) => s + t.profit, 0);
    const grossLoss = Math.abs(completed.filter(t => t.result === 'LOSS').reduce((s, t) => s + t.profit, 0));
    return {
        symbol, params,
        totalTrades: completed.length, wins, losses,
        winRate: completed.length > 0 ? Math.round((wins / completed.length) * 1000) / 10 : 0,
        totalProfit: Math.round(balance * 100) / 100,
        profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 99.99 : 0,
        maxDrawdown: Math.round(maxDD * 100) / 100,
        avgWin: wins > 0 ? Math.round((grossWin / wins) * 100) / 100 : 0,
        avgLoss: losses > 0 ? Math.round((grossLoss / losses) * 100) / 100 : 0,
        expectancy: completed.length > 0 ? Math.round((balance / completed.length) * 100) / 100 : 0,
        avgHoldBars: Math.round(completed.reduce((s, t) => s + t.holdBars, 0) / completed.length * 10) / 10,
        trades: completed,
    };
}

export async function runBacktestSweep(symbol: string, slM?: number, tpM?: number, minScore?: number): Promise<BacktestResult> {
    return runBacktest(symbol, {
        slMultiplier: slM ?? 1.5,
        tpMultiplier: tpM ?? 2.0,
        minScore: minScore ?? 60,
    });
}

export async function optimizeSweep(symbol: string): Promise<OptimizationResult> {
    const variations: BacktestParams[] = [];
    for (const sl of [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]) {
        for (const tp of [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]) {
            for (const ms of [60, 70, 80]) {
                variations.push({ slMultiplier: sl, tpMultiplier: tp, minScore: ms });
            }
        }
    }

    const results: BacktestResult[] = [];
    for (const v of variations) {
        const r = await runBacktest(symbol, v);
        if (r.totalTrades >= 3) results.push(r);
    }

    const sortKey = (k: string) => (a: BacktestResult, b: BacktestResult) => (b as any)[k] - (a as any)[k];
    results.sort(sortKey('totalProfit'));
    const bestByProfit = results[0] || emptyResult(symbol, { slMultiplier: 0, tpMultiplier: 0, minScore: 0 });
    results.sort(sortKey('winRate'));
    const bestByWinRate = results[0] || emptyResult(symbol, { slMultiplier: 0, tpMultiplier: 0, minScore: 0 });
    results.sort(sortKey('profitFactor'));
    const bestByProfitFactor = results[0] || emptyResult(symbol, { slMultiplier: 0, tpMultiplier: 0, minScore: 0 });
    results.sort(sortKey('expectancy'));
    const bestByExpectancy = results[0] || emptyResult(symbol, { slMultiplier: 0, tpMultiplier: 0, minScore: 0 });

    results.sort((a, b) => b.totalProfit - a.totalProfit);

    return {
        symbol,
        totalCombos: variations.length,
        results,
        bestByProfit,
        bestByWinRate,
        bestByProfitFactor,
        bestByExpectancy,
    };
}
