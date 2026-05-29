export interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    tick_volume?: number;
    time?: number;
}

import { PatternDetector } from './PatternDetector';

export interface Features {
    returns_1: number;
    returns_2: number;
    returns_4: number;
    returns_8: number;
    returns_24: number;
    volatility: number;
    rsi_14: number;
    sma_20_dist: number;
    sma_50_dist: number;
    sma_200_dist: number;
    bb_position: number;
    bb_width: number;
    volume_ratio: number;
    hour: number;
    atr_14: number;
    high_low_ratio: number;
    body_ratio: number;
    pattern_score: number;
}

export class MLFeatureExtractor {
    static extract(candles: Candle[]): Features[] {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.tick_volume || 0);

        const sma20 = this.sma(closes, 20);
        const sma50 = this.sma(closes, 50);
        const sma200 = this.sma(closes, 200);
        const atr14 = this.atr(highs, lows, closes, 14);
        const bb = this.bollinger(closes, 20, 2);
        const rsi14 = this.rsi(closes, 14);

        const patternAnalysis = PatternDetector.analyze(candles);
        const patternScore = patternAnalysis.summary.netSentiment;

        const features: Features[] = [];

        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const price = c.close;

            features.push({
                returns_1: i >= 1 ? (price / closes[i - 1] - 1) * 100 : 0,
                returns_2: i >= 2 ? (price / closes[i - 2] - 1) * 100 : 0,
                returns_4: i >= 4 ? (price / closes[i - 4] - 1) * 100 : 0,
                returns_8: i >= 8 ? (price / closes[i - 8] - 1) * 100 : 0,
                returns_24: i >= 24 ? (price / closes[i - 24] - 1) * 100 : 0,
                volatility: i >= 1 ? (highs[i] - lows[i]) / price * 100 : 0,
                rsi_14: rsi14[i] ?? 50,
                sma_20_dist: sma20[i] != null ? (price - sma20[i]!) / sma20[i]! * 100 : 0,
                sma_50_dist: sma50[i] != null ? (price - sma50[i]!) / sma50[i]! * 100 : 0,
                sma_200_dist: sma200[i] != null ? (price - sma200[i]!) / sma200[i]! * 100 : 0,
                bb_position: bb.upper[i] != null && bb.lower[i] != null
                    ? (price - bb.lower[i]!) / (bb.upper[i]! - bb.lower[i]!)
                    : 0.5,
                bb_width: bb.upper[i] != null && bb.lower[i] != null
                    ? (bb.upper[i]! - bb.lower[i]!) / price * 100
                    : 0,
                volume_ratio: this.volumeRatio(volumes, i, 20),
                hour: c.time ? new Date(c.time * 1000).getHours() : 0,
                atr_14: atr14[i] ?? 0,
                high_low_ratio: c.high > 0 ? (c.high - c.low) / c.close * 100 : 0,
                body_ratio: c.open > 0 ? Math.abs(c.close - c.open) / (c.high - c.low || 1) : 0,
                pattern_score: patternScore,
            });
        }

        return features;
    }

    static extractOne(candles: Candle[]): Features | null {
        if (candles.length < 200) return null;
        const allFeatures = this.extract(candles);
        return allFeatures[allFeatures.length - 1];
    }

    static normalize(features: Features[]): Features[] {
        const keys = Object.keys(features[0]) as (keyof Features)[];
        const stats: Record<string, { mean: number; std: number }> = {};

        for (const key of keys) {
            const vals = features.map(f => f[key]).filter(v => isFinite(v));
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
            stats[key] = { mean, std };
        }

        return features.map(f => {
            const nf = { ...f };
            for (const key of keys) {
                (nf as any)[key] = ((f[key] as number) - stats[key].mean) / stats[key].std;
            }
            return nf;
        });
    }

    static featureVector(f: Features): number[] {
        return [
            f.returns_1, f.returns_2, f.returns_4, f.returns_8, f.returns_24,
            f.volatility, f.rsi_14, f.sma_20_dist, f.sma_50_dist, f.sma_200_dist,
            f.bb_position, f.bb_width, f.volume_ratio, f.hour, f.atr_14,
            f.high_low_ratio, f.body_ratio, f.pattern_score,
        ];
    }

    static featureNames(): string[] {
        return [
            'returns_1', 'returns_2', 'returns_4', 'returns_8', 'returns_24',
            'volatility', 'rsi_14', 'sma_20_dist', 'sma_50_dist', 'sma_200_dist',
            'bb_position', 'bb_width', 'volume_ratio', 'hour', 'atr_14',
            'high_low_ratio', 'body_ratio', 'pattern_score',
        ];
    }

    private static sma(values: number[], period: number): (number | null)[] {
        const result: (number | null)[] = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) { result.push(null); continue; }
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += values[j];
            result.push(sum / period);
        }
        return result;
    }

    private static rsi(values: number[], period: number): number[] {
        const result: number[] = [50];
        let gains = 0, losses = 0;
        for (let i = 1; i <= period && i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        for (let i = 1; i < values.length; i++) {
            if (i > period) {
                const diff = values[i] - values[i - 1];
                gains = (gains * (period - 1) + (diff > 0 ? diff : 0)) / period;
                losses = (losses * (period - 1) + (diff < 0 ? -diff : 0)) / period;
            }
            result.push(losses === 0 ? 100 : gains === 0 ? 0 : 100 - 100 / (1 + gains / losses));
        }
        return result;
    }

    private static atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
        const result: number[] = [0];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
            result.push(i < period ? tr : (result[i - 1] * (period - 1) + tr) / period);
        }
        return result;
    }

    private static bollinger(values: number[], period: number, stdDev: number): { upper: (number | null)[]; lower: (number | null)[]; middle: (number | null)[] } {
        const middle = this.sma(values, period);
        const upper: (number | null)[] = [];
        const lower: (number | null)[] = [];
        for (let i = 0; i < values.length; i++) {
            if (middle[i] === null) { upper.push(null); lower.push(null); continue; }
            const sumSq = values.slice(Math.max(0, i - period + 1), i + 1).reduce((s, v) => s + (v - middle[i]!) ** 2, 0);
            const std = Math.sqrt(sumSq / Math.min(period, i + 1));
            upper.push(middle[i]! + stdDev * std);
            lower.push(middle[i]! - stdDev * std);
        }
        return { upper, lower, middle };
    }

    private static volumeRatio(volumes: number[], i: number, period: number): number {
        if (i < period) return 1;
        const avg = volumes.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        return avg > 0 ? volumes[i] / avg : 1;
    }
}
