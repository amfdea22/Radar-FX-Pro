import { Candle } from './MLFeatureExtractor';

export interface PatternResult {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    candles: number;
    description: string;
}

export interface SupportResistance {
    level: number;
    type: 'support' | 'resistance';
    strength: number;
    touches: number;
}

export interface TrendInfo {
    direction: 'up' | 'down' | 'sideways';
    strength: number;
    angle: number;
    duration: number;
}

export interface PatternAnalysis {
    candles: PatternResult[];
    supportResistance: SupportResistance[];
    trend: TrendInfo;
    summary: {
        bullishCount: number;
        bearishCount: number;
        netSentiment: number;
        strongestPattern: PatternResult | null;
    };
}

const BIG_BODY_THRESHOLD = 0.6;
const DOJI_BODY_THRESHOLD = 0.1;
const HAMMER_BODY_RATIO = 0.3;
const HAMMER_WICK_RATIO = 2;

export class PatternDetector {
    static analyze(candles: Candle[]): PatternAnalysis {
        const candlePatterns = this.detectCandlePatterns(candles);
        const sr = this.detectSupportResistance(candles, 10);
        const trend = this.detectTrend(candles);

        const bullishCount = candlePatterns.filter(p => p.type === 'bullish').length;
        const bearishCount = candlePatterns.filter(p => p.type === 'bearish').length;
        const netSentiment = candlePatterns.reduce((s, p) =>
            s + (p.type === 'bullish' ? p.confidence : p.type === 'bearish' ? -p.confidence : 0), 0);

        const sorted = [...candlePatterns].sort((a, b) => b.confidence - a.confidence);
        const strongestPattern = sorted.length > 0 ? sorted[0] : null;

        return {
            candles: candlePatterns,
            supportResistance: sr,
            trend,
            summary: {
                bullishCount,
                bearishCount,
                netSentiment: Math.round(netSentiment * 100) / 100,
                strongestPattern,
            },
        };
    }

    static detectCandlePatterns(candles: Candle[]): PatternResult[] {
        const patterns: PatternResult[] = [];
        if (candles.length < 5) return patterns;

        const n = candles.length;

        for (let i = 4; i < n; i++) {
            const c = this.getCandles(candles, i, 5);

            const engolfing = this.engolfing(c[3], c[4]);
            if (engolfing) patterns.push(engolfing);

            const doji = this.doji(c[4]);
            if (doji) patterns.push(doji);

            const hammer = this.hammer(c[4]);
            if (hammer) patterns.push(hammer);

            const star = this.morningEveningStar(c[2], c[3], c[4]);
            if (star) patterns.push(star);

            const soldiers = this.threeSoldiers(c[2], c[3], c[4]);
            if (soldiers) patterns.push(soldiers);

            const crows = this.threeCrows(c[2], c[3], c[4]);
            if (crows) patterns.push(crows);

            const harami = this.harami(c[3], c[4]);
            if (harami) patterns.push(harami);

            const piercing = this.piercing(c[3], c[4]);
            if (piercing) patterns.push(piercing);

            const darkCloud = this.darkCloudCover(c[3], c[4]);
            if (darkCloud) patterns.push(darkCloud);
        }

        const hs = this.headAndShoulders(candles);
        if (hs) patterns.push(hs);

        const dbt = this.doubleTop(candles);
        if (dbt) patterns.push(dbt);

        const dbb = this.doubleBottom(candles);
        if (dbb) patterns.push(dbb);

        const flag = this.flag(candles);
        if (flag) patterns.push(flag);

        return this.deduplicate(patterns);
    }

    static detectSupportResistance(candles: Candle[], lookback = 20): SupportResistance[] {
        const levels: SupportResistance[] = [];
        if (candles.length < lookback) return levels;

        const start = Math.max(0, candles.length - lookback * 3);
        const recent = candles.slice(start);

        const swingHighs: number[] = [];
        const swingLows: number[] = [];

        for (let i = 2; i < recent.length - 2; i++) {
            if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
                recent[i].high >= recent[i + 1].high && recent[i].high >= recent[i + 2].high) {
                swingHighs.push(recent[i].high);
            }
            if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
                recent[i].low <= recent[i + 1].low && recent[i].low <= recent[i + 2].low) {
                swingLows.push(recent[i].low);
            }
        }

        const clusterThreshold = this.atr(recent) * 0.5;

        for (const highs of [swingHighs, swingLows]) {
            const isResistance = highs === swingHighs;
            const clustered = this.clusterLevels(highs, clusterThreshold);
            for (const { price, count } of clustered) {
                if (count >= 1) {
                    levels.push({
                        level: Math.round(price * 100) / 100,
                        type: isResistance ? 'resistance' : 'support',
                        strength: Math.min(count / 3, 1),
                        touches: count,
                    });
                }
            }
        }

        return levels.sort((a, b) => b.strength - a.strength).slice(0, 6);
    }

    static detectTrend(candles: Candle[]): TrendInfo {
        if (candles.length < 20) return { direction: 'sideways', strength: 0, angle: 0, duration: 0 };

        const n = candles.length;
        const closes = candles.map(c => c.close);

        const sma20 = this.smaValues(closes, 20);
        const currentSMA = sma20[sma20.length - 1];
        const prevSMA = sma20[Math.max(0, sma20.length - 10)];

        const angle = ((currentSMA - prevSMA) / prevSMA) * 100;

        const higherHighs = this.countHigherHighs(candles, 14);
        const higherLows = this.countHigherLows(candles, 14);
        const maxHigher = Math.max(higherHighs, higherLows);
        const strength = Math.min(maxHigher / 14, 1);

        const direction = angle > 0.5 ? 'up' : angle < -0.5 ? 'down' : 'sideways';
        const duration = direction !== 'sideways' ? this.trendDuration(candles, direction) : 0;

        return {
            direction,
            strength: Math.round(strength * 100) / 100,
            angle: Math.round(angle * 100) / 100,
            duration,
        };
    }

    static patternFeatures(candles: Candle[]): Record<string, number> {
        const analysis = this.analyze(candles);
        const lastCandle = candles[candles.length - 1];
        const price = lastCandle.close;

        const nearestSR = analysis.supportResistance.length > 0 ? analysis.supportResistance[0] : null;
        const distToSR = nearestSR ? Math.abs(price - nearestSR.level) / price * 100 : 0;

        return {
            pattern_bullish_count: analysis.summary.bullishCount,
            pattern_bearish_count: analysis.summary.bearishCount,
            pattern_net_sentiment: analysis.summary.netSentiment,
            trend_direction: analysis.trend.direction === 'up' ? 1 : analysis.trend.direction === 'down' ? -1 : 0,
            trend_strength: analysis.trend.strength,
            trend_angle: analysis.trend.angle,
            sr_nearest_distance: Math.round(distToSR * 100) / 100,
            sr_resistance_count: analysis.supportResistance.filter(s => s.type === 'resistance').length,
            sr_support_count: analysis.supportResistance.filter(s => s.type === 'support').length,
            sr_strongest: nearestSR ? (nearestSR.type === 'resistance' ? 1 : -1) * nearestSR.strength : 0,
        };
    }

    private static getCandles(candles: Candle[], index: number, count: number): Candle[] {
        const result: Candle[] = [];
        for (let i = index - count + 1; i <= index; i++) {
            if (i >= 0 && i < candles.length) result.push(candles[i]);
        }
        return result;
    }

    private static bodySize(c: Candle): number {
        return Math.abs(c.close - c.open);
    }

    private static upperWick(c: Candle): number {
        return c.high - Math.max(c.open, c.close);
    }

    private static lowerWick(c: Candle): number {
        return Math.min(c.open, c.close) - c.low;
    }

    private static totalRange(c: Candle): number {
        return c.high - c.low;
    }

    private static isBullish(c: Candle): boolean {
        return c.close > c.open;
    }

    private static isBearish(c: Candle): boolean {
        return c.close < c.open;
    }

    private static engolfing(prev: Candle, curr: Candle): PatternResult | null {
        if (!prev || !curr) return null;
        const prevBull = this.isBullish(prev);
        const currBull = this.isBullish(curr);
        if (prevBull === currBull) return null;
        if (currBull && curr.close > prev.open && curr.open < prev.close) {
            return { name: 'Engolfo de Alta', type: 'bullish', confidence: 0.7, candles: 2, description: 'Candle alta engole candle baixa anterior' };
        }
        if (!currBull && curr.close < prev.open && curr.open > prev.close) {
            return { name: 'Engolfo de Baixa', type: 'bearish', confidence: 0.7, candles: 2, description: 'Candle baixa engole candle alta anterior' };
        }
        return null;
    }

    private static doji(c: Candle): PatternResult | null {
        if (!c) return null;
        const range = this.totalRange(c);
        if (range === 0) return null;
        if (this.bodySize(c) / range < DOJI_BODY_THRESHOLD) {
            return {
                name: 'Doji',
                type: 'neutral',
                confidence: 0.4,
                candles: 1,
                description: 'Indecisão — corpo muito pequeno em relação à amplitude total',
            };
        }
        return null;
    }

    private static hammer(c: Candle): PatternResult | null {
        if (!c) return null;
        const range = this.totalRange(c);
        if (range === 0) return null;
        const body = this.bodySize(c);
        const lowerWick = this.lowerWick(c);
        const upperWick = this.upperWick(c);

        if (body / range < HAMMER_BODY_RATIO && lowerWick > body * HAMMER_WICK_RATIO && upperWick < body * 0.5) {
            return {
                name: this.isBullish(c) ? 'Martelo' : 'Martelo Invertido',
                type: 'bullish',
                confidence: 0.65,
                candles: 1,
                description: 'Sombra inferior longa — possível reversão de alta',
            };
        }
        if (body / range < HAMMER_BODY_RATIO && upperWick > body * HAMMER_WICK_RATIO && lowerWick < body * 0.5) {
            return {
                name: 'Estrela Cadente',
                type: 'bearish',
                confidence: 0.65,
                candles: 1,
                description: 'Sombra superior longa — possível reversão de baixa',
            };
        }
        return null;
    }

    private static morningEveningStar(c1: Candle, c2: Candle, c3: Candle): PatternResult | null {
        if (!c1 || !c2 || !c3) return null;
        if (this.isBearish(c1) && this.isBullish(c3)) {
            const body1 = this.bodySize(c1);
            const range2 = this.totalRange(c2);
            if (range2 > 0 && this.bodySize(c2) / range2 < DOJI_BODY_THRESHOLD && c3.close > (c1.open + c1.close) / 2) {
                return { name: 'Estrela da Manhã', type: 'bullish', confidence: 0.75, candles: 3, description: 'Baixa → Doji → Alta acima do meio do candle 1' };
            }
        }
        if (this.isBullish(c1) && this.isBearish(c3)) {
            const body1 = this.bodySize(c1);
            const range2 = this.totalRange(c2);
            if (range2 > 0 && this.bodySize(c2) / range2 < DOJI_BODY_THRESHOLD && c3.close < (c1.open + c1.close) / 2) {
                return { name: 'Estrela da Tarde', type: 'bearish', confidence: 0.75, candles: 3, description: 'Alta → Doji → Baixa abaixo do meio do candle 1' };
            }
        }
        return null;
    }

    private static threeSoldiers(c1: Candle, c2: Candle, c3: Candle): PatternResult | null {
        if (!c1 || !c2 || !c3) return null;
        if (this.isBullish(c1) && this.isBullish(c2) && this.isBullish(c3) &&
            c1.close > c1.open && c2.close > c2.open && c3.close > c3.open &&
            c2.close > c1.close && c3.close > c2.close &&
            c2.open > c1.open && c3.open > c2.open) {
            return { name: 'Três Soldados Brancos', type: 'bullish', confidence: 0.8, candles: 3, description: '3 candles altos consecutivos com aberturas e fechamentos crescentes' };
        }
        return null;
    }

    private static threeCrows(c1: Candle, c2: Candle, c3: Candle): PatternResult | null {
        if (!c1 || !c2 || !c3) return null;
        if (this.isBearish(c1) && this.isBearish(c2) && this.isBearish(c3) &&
            c1.close < c1.open && c2.close < c2.open && c3.close < c3.open &&
            c2.close < c1.close && c3.close < c2.close &&
            c2.open < c1.open && c3.open < c2.open) {
            return { name: 'Três Corvos Negros', type: 'bearish', confidence: 0.8, candles: 3, description: '3 candles baixos consecutivos com aberturas e fechamentos decrescentes' };
        }
        return null;
    }

    private static harami(prev: Candle, curr: Candle): PatternResult | null {
        if (!prev || !curr) return null;
        const range = this.totalRange(prev);
        if (range === 0) return null;
        if (this.bodySize(curr) < this.bodySize(prev) * 0.5 &&
            curr.high < prev.high && curr.low > prev.low) {
            return {
                name: this.isBullish(prev) ? 'Harami de Baixa' : 'Harami de Alta',
                type: this.isBullish(prev) ? 'bearish' : 'bullish',
                confidence: 0.6,
                candles: 2,
                description: `Harami — corpo pequeno dentro do candle ${this.isBullish(prev) ? 'alto' : 'baixo'} anterior`,
            };
        }
        return null;
    }

    private static piercing(c1: Candle, c2: Candle): PatternResult | null {
        if (!c1 || !c2) return null;
        if (this.isBearish(c1) && this.isBullish(c2) &&
            c2.open < c1.low && c2.close > (c1.open + c1.close) / 2 && c2.close < c1.open) {
            return { name: 'Linha de Penetração', type: 'bullish', confidence: 0.7, candles: 2, description: 'Alta penetra mais da metade do candle baixo anterior' };
        }
        return null;
    }

    private static darkCloudCover(c1: Candle, c2: Candle): PatternResult | null {
        if (!c1 || !c2) return null;
        if (this.isBullish(c1) && this.isBearish(c2) &&
            c2.open > c1.high && c2.close < (c1.open + c1.close) / 2 && c2.close > c1.open) {
            return { name: 'Nuvem Escura', type: 'bearish', confidence: 0.7, candles: 2, description: 'Baixa penetra mais da metade do candle alto anterior' };
        }
        return null;
    }

    private static headAndShoulders(candles: Candle[]): PatternResult | null {
        if (candles.length < 30) return null;
        const start = candles.length - 40;
        const segment = candles.slice(Math.max(0, start));
        const highs = segment.map(c => c.high);

        const peaks = this.findPeaks(highs);
        if (peaks.length < 3) return null;

        for (let i = 0; i <= peaks.length - 3; i++) {
            const left = peaks[i];
            const head = peaks[i + 1];
            const right = peaks[i + 2];
            const headValue = highs[head];
            const leftValue = highs[left];
            const rightValue = highs[right];

            if (headValue > leftValue && headValue > rightValue) {
                const avgShoulder = (leftValue + rightValue) / 2;
                const headDiff = (headValue - avgShoulder) / avgShoulder;
                if (headDiff > 0.005 && headDiff < 0.1) {
                    return { name: 'Topo Triplo (Ombro-Cabeça-Ombro)', type: 'bearish', confidence: 0.75, candles: segment.length, description: 'Pico central mais alto que os ombros laterais — reversão de baixa' };
                }
            }
        }

        const lows = segment.map(c => c.low);
        const valleys = this.findValleys(lows);
        if (valleys.length < 3) return null;

        for (let i = 0; i <= valleys.length - 3; i++) {
            const left = valleys[i];
            const head = valleys[i + 1];
            const right = valleys[i + 2];
            const headValue = lows[head];
            const leftValue = lows[left];
            const rightValue = lows[right];

            if (headValue < leftValue && headValue < rightValue) {
                const avgShoulder = (leftValue + rightValue) / 2;
                const headDiff = (avgShoulder - headValue) / avgShoulder;
                if (headDiff > 0.005 && headDiff < 0.1) {
                    return { name: 'Fundo Triplo (Ombro-Cabeça-Ombro Invertido)', type: 'bullish', confidence: 0.75, candles: segment.length, description: 'Vale central mais baixo que os ombros laterais — reversão de alta' };
                }
            }
        }

        return null;
    }

    private static doubleTop(candles: Candle[]): PatternResult | null {
        if (candles.length < 20) return null;
        const start = candles.length - 30;
        const segment = candles.slice(Math.max(0, start));
        const highs = segment.map(c => c.high);
        const peaks = this.findPeaks(highs);
        if (peaks.length < 2) return null;

        const last = peaks[peaks.length - 1];
        const prev = peaks[peaks.length - 2];
        const diff = Math.abs(highs[last] - highs[prev]) / highs[prev];
        if (diff < 0.02 && peaks.length >= 2) {
            return { name: 'Topo Duplo', type: 'bearish', confidence: 0.7, candles: segment.length, description: 'Dois picos próximos — resistência dupla, reversão de baixa' };
        }
        return null;
    }

    private static doubleBottom(candles: Candle[]): PatternResult | null {
        if (candles.length < 20) return null;
        const start = candles.length - 30;
        const segment = candles.slice(Math.max(0, start));
        const lows = segment.map(c => c.low);
        const valleys = this.findValleys(lows);
        if (valleys.length < 2) return null;

        const last = valleys[valleys.length - 1];
        const prev = valleys[valleys.length - 2];
        const diff = Math.abs(lows[last] - lows[prev]) / lows[prev];
        if (diff < 0.02 && valleys.length >= 2) {
            return { name: 'Fundo Duplo', type: 'bullish', confidence: 0.7, candles: segment.length, description: 'Dois vales próximos — suporte duplo, reversão de alta' };
        }
        return null;
    }

    private static flag(candles: Candle[]): PatternResult | null {
        if (candles.length < 20) return null;
        const n = candles.length;
        const recent = candles.slice(n - 15, n);
        if (recent.length < 10) return null;

        const changes = recent.map(c => this.isBullish(c) ? 1 : this.isBearish(c) ? -1 : 0);
        const bullishRatio = changes.filter(c => c > 0).length / changes.length;
        const avgBody = recent.reduce((s, c) => s + this.bodySize(c), 0) / recent.length;
        const avgRange = recent.reduce((s, c) => s + this.totalRange(c), 0) / recent.length;
        const bodyToRange = avgRange > 0 ? avgBody / avgRange : 0;

        if (bullishRatio > 0.6 && bodyToRange > 0.4) {
            return { name: 'Bandeira de Alta', type: 'bullish', confidence: 0.6, candles: recent.length, description: 'Candles compactos com viés de alta — possível continuação' };
        }
        if (bullishRatio < 0.4 && bodyToRange > 0.4) {
            return { name: 'Bandeira de Baixa', type: 'bearish', confidence: 0.6, candles: recent.length, description: 'Candles compactos com viés de baixa — possível continuação' };
        }
        return null;
    }

    private static findPeaks(values: number[]): number[] {
        const peaks: number[] = [];
        for (let i = 2; i < values.length - 2; i++) {
            if (values[i] >= values[i - 1] && values[i] >= values[i - 2] &&
                values[i] > values[i + 1] && values[i] > values[i + 2]) {
                peaks.push(i);
            }
        }
        return peaks;
    }

    private static findValleys(values: number[]): number[] {
        const valleys: number[] = [];
        for (let i = 2; i < values.length - 2; i++) {
            if (values[i] <= values[i - 1] && values[i] <= values[i - 2] &&
                values[i] < values[i + 1] && values[i] < values[i + 2]) {
                valleys.push(i);
            }
        }
        return valleys;
    }

    private static countHigherHighs(candles: Candle[], period: number): number {
        let count = 0;
        const start = Math.max(0, candles.length - period);
        for (let i = start + 1; i < candles.length; i++) {
            if (candles[i].high > candles[i - 1].high) count++;
        }
        return count;
    }

    private static countHigherLows(candles: Candle[], period: number): number {
        let count = 0;
        const start = Math.max(0, candles.length - period);
        for (let i = start + 1; i < candles.length; i++) {
            if (candles[i].low > candles[i - 1].low) count++;
        }
        return count;
    }

    private static trendDuration(candles: Candle[], direction: 'up' | 'down'): number {
        let duration = 0;
        for (let i = candles.length - 1; i > 0; i--) {
            if (direction === 'up' && candles[i].close >= candles[i - 1].close) duration++;
            else if (direction === 'down' && candles[i].close <= candles[i - 1].close) duration++;
            else break;
        }
        return duration;
    }

    private static clusterLevels(values: number[], threshold: number): { price: number; count: number }[] {
        if (values.length === 0) return [];
        const sorted = [...values].sort((a, b) => a - b);
        const clusters: { price: number; count: number }[] = [];
        let currentCluster = { price: sorted[0], count: 1 };

        for (let i = 1; i < sorted.length; i++) {
            if (Math.abs(sorted[i] - currentCluster.price) < threshold) {
                currentCluster.price = (currentCluster.price * currentCluster.count + sorted[i]) / (currentCluster.count + 1);
                currentCluster.count++;
            } else {
                clusters.push(currentCluster);
                currentCluster = { price: sorted[i], count: 1 };
            }
        }
        clusters.push(currentCluster);
        return clusters;
    }

    private static smaValues(values: number[], period: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) { result.push(values[i]); continue; }
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += values[j];
            result.push(sum / period);
        }
        return result;
    }

    private static atr(candles: Candle[], period = 14): number {
        if (candles.length < 2) return 0;
        let trSum = 0;
        const count = Math.min(period, candles.length - 1);
        for (let i = candles.length - count; i < candles.length; i++) {
            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close),
            );
            trSum += tr;
        }
        return trSum / count;
    }

    private static deduplicate(patterns: PatternResult[]): PatternResult[] {
        const seen = new Set<string>();
        return patterns.filter(p => {
            const key = `${p.name}_${p.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}
