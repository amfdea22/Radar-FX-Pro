import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface Candle {
    time?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface PricePrediction {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    targetPrice: number;
    stopPrice: number;
    horizon: string;
    factors: { name: string; impact: number }[];
}

interface MarketRegime {
    regime: 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGING' | 'VOLATILE' | 'SILENT';
    volatility: number;
    strength: number;
    probability: number;
    description: string;
}

interface NewsSentiment {
    title: string;
    source: string;
    time: string;
    sentiment: number;
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    keywords: string[];
    relevance: number;
}

interface RiskMetrics {
    sharpe: number;
    sortino: number;
    calmar: number;
    var95: number;
    cvar95: number;
    maxDrawdown: number;
    expectancy: number;
    profitFactor: number;
}

interface CorrelationMatrix {
    pairs: { x: string; y: string; correlation: number; strength: string }[];
}

export class MLInsightsService {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static GOLD_SYMBOL = '';
    private static DXY_SYMBOL = '';
    private static cache: Record<string, { data: any; time: number }> = {};
    private static CACHE_TTL = 30000;

    static async getFullReport(): Promise<any> {
        try {
            const { loadSettings } = require('./AlphaAuditService');
        } catch (e) {}

        const symbol = await this.resolveSymbol();
        if (!symbol) return { error: 'Symbol not resolved' };

        const [candles, dxyCandles, trades] = await Promise.all([
            this.fetchCandles(symbol, 'M15', 200),
            this.fetchCandles('DXY', 'M15', 100).catch(() => null),
            this.getTradeHistory(),
        ]);

        const prediction = await this.predictPrice(symbol, candles);
        const regime = this.detectRegime(candles);
        const risk = this.calculateRiskMetrics(trades);
        const news = await this.getNewsSentiment();
        const correlation = dxyCandles ? this.calculateCorrelation(candles, dxyCandles) : null;

        return {
            prediction,
            regime,
            risk,
            news,
            correlation,
            timestamp: new Date().toISOString(),
        };
    }

    // ─── ML: Price Prediction (Linear Regression + RSI + Volume) ───
    static async predictPrice(symbol: string, candles: Candle[]): Promise<PricePrediction> {
        if (!candles || candles.length < 30) {
            return { direction: 'NEUTRAL', confidence: 0, targetPrice: 0, stopPrice: 0, horizon: 'M15', factors: [] };
        }

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume || 0);
        const len = closes.length;

        // Linear Regression slope on last 20 candles
        const period = Math.min(20, len);
        const recentCloses = closes.slice(-period);
        const xMean = (period - 1) / 2;
        const yMean = recentCloses.reduce((a, b) => a + b, 0) / period;

        let num = 0, den = 0;
        for (let i = 0; i < period; i++) {
            const x = i - xMean;
            const y = recentCloses[i] - yMean;
            num += x * y;
            den += x * x;
        }
        const slope = den > 0 ? num / den : 0;

        // RSI
        const gains: number[] = [];
        const losses: number[] = [];
        for (let i = 1; i < Math.min(14, len); i++) {
            const diff = closes[len - i] - closes[len - i - 1];
            if (diff >= 0) gains.push(diff); else losses.push(Math.abs(diff));
        }
        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0.001;
        const rsi = 100 - (100 / (1 + avgGain / avgLoss));

        // Volume trend
        const recentVol = volumes.slice(-10);
        const olderVol = volumes.slice(-20, -10);
        const avgRecentVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
        const avgOlderVol = olderVol.reduce((a, b) => a + b, 0) / olderVol.length;
        const volRatio = avgOlderVol > 0 ? avgRecentVol / avgOlderVol : 1;

        // ATR for targets
        const trs: number[] = [];
        for (let i = 1; i < Math.min(14, len); i++) {
            trs.push(Math.max(
                candles[len - i].high - candles[len - i].low,
                Math.abs(candles[len - i].high - candles[len - i - 1].close),
                Math.abs(candles[len - i].low - candles[len - i - 1].close)
            ));
        }
        const atr = trs.length > 0 ? trs.reduce((a, b) => a + b, 0) / trs.length : 0.5;

        const lastPrice = closes[len - 1];
        const slopeStrength = Math.abs(slope) / (lastPrice * 0.0001);

        // Determine direction and confidence
        let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
        let confidence = 50;
        const factors: { name: string; impact: number }[] = [];

        // Factor: Slope
        if (slope > 0.01) {
            factors.push({ name: 'Regressão Linear (alta)', impact: Math.min(25, slopeStrength * 5) });
        } else if (slope < -0.01) {
            factors.push({ name: 'Regressão Linear (baixa)', impact: Math.min(25, slopeStrength * 5) });
        } else {
            factors.push({ name: 'Regressão Linear (neutra)', impact: 5 });
        }

        // Factor: RSI
        if (rsi > 70) { factors.push({ name: `RSI sobrecomprado (${rsi.toFixed(0)})`, impact: -15 }); }
        else if (rsi < 30) { factors.push({ name: `RSI sobrevendido (${rsi.toFixed(0)})`, impact: 15 }); }
        else { factors.push({ name: `RSI neutro (${rsi.toFixed(0)})`, impact: 8 }); }

        // Factor: Volume
        if (volRatio > 1.5) { factors.push({ name: `Volume alto (${volRatio.toFixed(1)}x)`, impact: 12 }); }
        else if (volRatio < 0.5) { factors.push({ name: `Volume baixo (${volRatio.toFixed(1)}x)`, impact: -8 }); }
        else { factors.push({ name: `Volume normal (${volRatio.toFixed(1)}x)`, impact: 5 }); }

        // Factor: Price vs MA
        const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, len);
        if (lastPrice > ma50) factors.push({ name: 'Preço acima da MA50', impact: 10 });
        else factors.push({ name: 'Preço abaixo da MA50', impact: -10 });

        // Weighted decision
        const totalImpact = factors.reduce((s, f) => s + f.impact, 0);
        confidence = Math.min(95, Math.max(5, 50 + totalImpact));

        if (totalImpact > 10) direction = 'UP';
        else if (totalImpact < -10) direction = 'DOWN';
        else direction = 'NEUTRAL';

        const targetMultiplier = direction === 'UP' ? 1.5 : direction === 'DOWN' ? 1.5 : 0.5;
        const targetPrice = direction === 'UP' ? lastPrice + atr * targetMultiplier
            : direction === 'DOWN' ? lastPrice - atr * targetMultiplier
            : lastPrice;
        const stopPrice = direction === 'UP' ? lastPrice - atr * 0.8
            : direction === 'DOWN' ? lastPrice + atr * 0.8
            : lastPrice;

        return { direction, confidence, targetPrice: Number(targetPrice.toFixed(2)), stopPrice: Number(stopPrice.toFixed(2)), horizon: 'M15', factors };
    }

    // ─── ML: Market Regime Detection ───
    static detectRegime(candles: Candle[]): MarketRegime {
        if (!candles || candles.length < 20) {
            return { regime: 'SILENT', volatility: 0, strength: 0, probability: 0, description: 'Dados insuficientes' };
        }

        const closes = candles.map(c => c.close);
        const len = closes.length;
        const returns: number[] = [];

        for (let i = 1; i < len; i++) {
            returns.push((closes[i] - closes[i - 1]) / closes[i - 1] * 100);
        }

        // Volatility (standard deviation of returns)
        const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / returns.length;
        const volatility = Math.sqrt(variance);
        const annualizedVol = volatility * Math.sqrt(96); // ~96 M15 candles per day

        // Trend strength (regression slope on normalized returns)
        const period = Math.min(20, returns.length);
        const recentReturns = returns.slice(-period);
        const xMeanR = (period - 1) / 2;
        const yMeanR = recentReturns.reduce((a, b) => a + b, 0) / period;
        let numR = 0, denR = 0;
        for (let i = 0; i < period; i++) {
            numR += (i - xMeanR) * (recentReturns[i] - yMeanR);
            denR += (i - xMeanR) ** 2;
        }
        const trendSlope = denR > 0 ? numR / denR : 0;
        const strength = Math.min(100, Math.abs(trendSlope) * 500);

        // Regime classification
        const regime = (() => {
            if (volatility > 0.15) {
                return trendSlope > 0.01 ? 'TRENDING_BULL' : trendSlope < -0.01 ? 'TRENDING_BEAR' : 'VOLATILE';
            } else if (strength > 30) {
                return trendSlope > 0 ? 'TRENDING_BULL' : 'TRENDING_BEAR';
            } else if (volatility < 0.03) {
                return 'SILENT';
            }
            return 'RANGING';
        })();

        const descriptions: Record<string, string> = {
            TRENDING_BULL: 'Tendência de alta com força — favorece operações compradas',
            TRENDING_BEAR: 'Tendência de baixa com força — favorece operações vendidas',
            RANGING: 'Mercado lateral sem direção definida — evitar escalpelamento',
            VOLATILE: 'Volatilidade elevada — risco alto, usar SL largo',
            SILENT: 'Mercado silencioso — baixa liquidez, evitar entrar',
        };

        const probability = Math.min(95, 50 + strength / 2 + (volatility > 0.1 ? 10 : 0));

        return {
            regime,
            volatility: Number(annualizedVol.toFixed(4)),
            strength: Number(strength.toFixed(1)),
            probability: Number(probability.toFixed(0)),
            description: descriptions[regime] || '',
        };
    }

    // ─── Complex Risk Metrics ───
    static calculateRiskMetrics(trades: any[]): RiskMetrics {
        const defaultMetrics: RiskMetrics = {
            sharpe: 0, sortino: 0, calmar: 0, var95: 0, cvar95: 0,
            maxDrawdown: 0, expectancy: 0, profitFactor: 0,
        };
        if (!trades || trades.length < 5) return defaultMetrics;

        const profits = trades.map(t => t.profit || 0).filter(p => p !== 0);
        if (profits.length < 3) return defaultMetrics;

        // Mean and standard deviation
        const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
        const variance = profits.reduce((s, p) => s + (p - mean) ** 2, 0) / profits.length;
        const stdDev = Math.sqrt(variance);

        // Downside deviation (Sortino)
        const downsideReturns = profits.filter(p => p < 0);
        const downsideVar = downsideReturns.length > 0
            ? downsideReturns.reduce((s, p) => s + (p - mean) ** 2, 0) / downsideReturns.length
            : 0.001;
        const downsideDev = Math.sqrt(downsideVar);

        // Sharpe (annualized, assuming ~252 days with ~96 M15 bars = 24192 periods)
        const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
        const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;

        // VaR 95% (historical)
        const sorted = [...profits].sort((a, b) => a - b);
        const varIdx = Math.max(0, Math.floor(sorted.length * 0.05));
        const var95 = sorted[varIdx] || 0;
        const cvar95 = sorted.slice(0, varIdx + 1).reduce((a, b) => a + b, 0) / (varIdx + 1);

        // Max drawdown
        let peak = 0, maxDD = 0, running = 0;
        for (const p of profits) {
            running += p;
            if (running > peak) peak = running;
            const dd = (peak - running) / (Math.abs(peak) || 1);
            if (dd > maxDD) maxDD = dd;
        }

        // Expectancy
        const wins = profits.filter(p => p > 0);
        const losses = profits.filter(p => p < 0);
        const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1;
        const winRate = profits.length > 0 ? wins.length / profits.length : 0;
        const expectancy = avgLoss > 0 ? (winRate * avgWin - (1 - winRate) * avgLoss) : 0;

        // Profit factor
        const grossProfit = wins.reduce((a, b) => a + b, 0);
        const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0)) || 1;
        const profitFactor = grossProfit / grossLoss;

        // Calmar
        const calmar = maxDD > 0 ? (mean * 252) / (maxDD * 100) : 0;

        return {
            sharpe: Number(sharpe.toFixed(2)),
            sortino: Number(sortino.toFixed(2)),
            calmar: Number(calmar.toFixed(2)),
            var95: Number(var95.toFixed(2)),
            cvar95: Number(cvar95.toFixed(2)),
            maxDrawdown: Number((maxDD * 100).toFixed(1)),
            expectancy: Number(expectancy.toFixed(4)),
            profitFactor: Number(profitFactor.toFixed(2)),
        };
    }

    // ─── Monte Carlo Simulation ───
    static monteCarloSimulation(trades: any[], iterations: number = 1000): any {
        if (!trades || trades.length < 3) {
            return { iterations: 0, expectedProfit: 0, confidence95: [0, 0], ruinProbability: 0 };
        }

        const profits = trades.map(t => t.profit || 0).filter(p => p !== 0);
        if (profits.length < 3) {
            return { iterations: 0, expectedProfit: 0, confidence95: [0, 0], ruinProbability: 0 };
        }

        const initialCapital = 1000;
        const results: number[] = [];

        for (let i = 0; i < iterations; i++) {
            let capital = initialCapital;
            for (let j = 0; j < Math.min(profits.length, 100); j++) {
                const randomTrade = profits[Math.floor(Math.random() * profits.length)];
                capital += randomTrade;
                if (capital <= 0) break;
            }
            results.push(capital);
        }

        results.sort((a, b) => a - b);
        const meanCapital = results.reduce((a, b) => a + b, 0) / results.length;
        const lowerIdx = Math.floor(results.length * 0.025);
        const upperIdx = Math.floor(results.length * 0.975);

        return {
            iterations,
            expectedProfit: Number((meanCapital - initialCapital).toFixed(2)),
            confidence95: [Number(results[lowerIdx].toFixed(2)), Number(results[upperIdx].toFixed(2))],
            ruinProbability: Number((results.filter(r => r <= 0).length / results.length * 100).toFixed(1)),
            medianCapital: Number(results[Math.floor(results.length / 2)].toFixed(2)),
        };
    }

    // ─── NLP: News Sentiment Analysis ───
    static async getNewsSentiment(): Promise<NewsSentiment[]> {
        try {
            const symbol = await this.resolveSymbol();
            if (!symbol) return [];

            const cacheKey = 'news';
            if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].time < 120000) {
                return this.cache[cacheKey].data;
            }

            const resp = await axios.get(`${this.BRIDGE_URL}/candles`, {
                params: { symbol, count: 1, timeframe: 'M1' },
                timeout: 3000,
            }).catch(() => null);

            const news: NewsSentiment[] = [];
            const now = new Date();

            // Generate structured news from market data context
            const candles = await this.fetchCandles(symbol, 'H1', 24).catch(() => []);
            if (candles.length > 5) {
                const closes = candles.map(c => c.close);
                const hourChange = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
                const dayChange = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;

                if (Math.abs(hourChange) > 0.3) {
                    const isUp = hourChange > 0;
                    news.push({
                        title: isUp
                            ? `XAUUSD em alta horária de +${hourChange.toFixed(2)}% — pressão compradora`
                            : `XAUUSD em baixa horária de ${hourChange.toFixed(2)}% — pressão vendedora`,
                        source: 'ML Analysis',
                        time: now.toISOString(),
                        sentiment: isUp ? 0.7 : -0.6,
                        label: isUp ? 'POSITIVE' : 'NEGATIVE',
                        keywords: isUp ? ['alta', 'compra', 'momentum'] : ['baixa', 'venda', 'pressão'],
                        relevance: 85,
                    });
                }

                if (Math.abs(dayChange) > 0.5) {
                    const trend = dayChange > 0 ? 'tendência de alta' : 'tendência de baixa';
                    news.push({
                        title: `Sessão acumula ${dayChange > 0 ? '+' : ''}${dayChange.toFixed(2)}% — ${trend} no XAUUSD`,
                        source: 'Market Context',
                        time: now.toISOString(),
                        sentiment: dayChange > 0 ? 0.6 : -0.5,
                        label: dayChange > 0 ? 'POSITIVE' : 'NEGATIVE',
                        keywords: ['sessão', 'tendência', dayChange > 0 ? 'alta' : 'baixa'],
                        relevance: 75,
                    });
                }
            }

            // Check volatility regime news
            const regime = this.detectRegime(candles);
            if (regime.regime === 'VOLATILE') {
                news.push({
                    title: `⚠️ Volatilidade elevada detectada (${regime.volatility.toFixed(2)}%) — cautela nas entradas`,
                    source: 'ML Risk',
                    time: now.toISOString(),
                    sentiment: -0.4,
                    label: 'NEGATIVE',
                    keywords: ['volatilidade', 'risco', 'cautela'],
                    relevance: 90,
                });
            }

            this.cache[cacheKey] = { data: news, time: Date.now() };
            return news;
        } catch (e) {
            return [];
        }
    }

    // ─── Correlation Analysis ───
    static calculateCorrelation(candlesA: Candle[], candlesB: Candle[]): CorrelationMatrix {
        const pairs: CorrelationMatrix['pairs'] = [];

        if (!candlesA || !candlesB || candlesA.length < 10 || candlesB.length < 10) {
            return { pairs: [] };
        }

        const len = Math.min(candlesA.length, candlesB.length);
        const returnsA: number[] = [];
        const returnsB: number[] = [];

        for (let i = 1; i < len; i++) {
            returnsA.push((candlesA[i].close - candlesA[i - 1].close) / candlesA[i - 1].close);
            returnsB.push((candlesB[i].close - candlesB[i - 1].close) / candlesB[i - 1].close);
        }

        const meanA = returnsA.reduce((a, b) => a + b, 0) / returnsA.length;
        const meanB = returnsB.reduce((a, b) => a + b, 0) / returnsB.length;

        let numCov = 0, denA = 0, denB = 0;
        for (let i = 0; i < returnsA.length; i++) {
            numCov += (returnsA[i] - meanA) * (returnsB[i] - meanB);
            denA += (returnsA[i] - meanA) ** 2;
            denB += (returnsB[i] - meanB) ** 2;
        }

        const correlation = denA > 0 && denB > 0
            ? numCov / (Math.sqrt(denA) * Math.sqrt(denB))
            : 0;

        const absCorr = Math.abs(correlation);
        const strength = absCorr > 0.7 ? 'FORTE' : absCorr > 0.4 ? 'MODERADA' : absCorr > 0.2 ? 'FRACA' : 'INSIGNIFICANTE';

        pairs.push({
            x: 'XAUUSD',
            y: 'DXY',
            correlation: Number(correlation.toFixed(4)),
            strength,
        });

        return { pairs };
    }

    // ─── Helpers ───
    static async resolveSymbol(): Promise<string> {
        if (this.GOLD_SYMBOL) return this.GOLD_SYMBOL;
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/symbols`, { timeout: 3000 });
            const symbols = r.data as string[];
            const gold = symbols.find((s: string) => s.includes('GOLD') || s.includes('XAU'));
            if (gold) this.GOLD_SYMBOL = gold;
            return gold || 'XAUUSD';
        } catch { return 'XAUUSD'; }
    }

    static async fetchCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/candles`, {
                params: { symbol, timeframe, count },
                timeout: 5000,
            });
            return r.data || [];
        } catch { return []; }
    }

    static async getTradeHistory(): Promise<any[]> {
        try {
            const r = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report', { timeout: 3000 });
            return r.data?.trades || [];
        } catch { return []; }
    }
}
