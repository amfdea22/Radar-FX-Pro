import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MLFeatureExtractor, Features, Candle } from './MLFeatureExtractor';
import { LogisticRegression, RandomForest, RegimeClassifier, ModelData } from './MLModels';

interface MLConfig {
    enabled: boolean;
    symbols: string[];
    timeframe: string;
    minSamples: number;
    retrainInterval: number;
    confidenceThreshold: number;
}

interface Prediction {
    symbol: string;
    direction: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    regime: string;
    regimeConfidence: number;
    modelConfidence: number;
    forestConfidence: number;
    timestamp: number;
    features: Record<string, number>;
}

interface TrainingResult {
    symbol: string;
    accuracy: number;
    samples: number;
    features: string[];
    weights: number[];
    bias: number;
    timestamp: number;
}

const BRIDGE_URL = 'http://127.0.0.1:5555';
const PORT = process.env.PORT || 3015;

export class MLService {
    private static MODELS_PATH = path.resolve(process.cwd(), 'ml_models');
    private static HISTORY_PATH = path.resolve(process.cwd(), 'ml_prediction_history.json');

    private static config: MLConfig = {
        enabled: true,
        symbols: ['XAUUSD', 'BTCUSD', 'EURUSD'],
        timeframe: 'H1',
        minSamples: 100,
        retrainInterval: 3600000,
        confidenceThreshold: 0.55,
    };

    private static models: Map<string, {
        logistic: LogisticRegression;
        forest: RandomForest;
        regime: RegimeClassifier;
        lastTrain: number;
        accuracy: number;
        samples: number;
        featureStats?: { mean: number[]; std: number[] };
    }> = new Map();

    private static predictionHistory: Array<{
        symbol: string;
        prediction: number;
        actual: number;
        confidence: number;
        timestamp: number;
        resolved: boolean;
    }> = [];

    private static retrainTimer: ReturnType<typeof setInterval> | null = null;

    static init() {
        if (!fs.existsSync(this.MODELS_PATH)) {
            fs.mkdirSync(this.MODELS_PATH, { recursive: true });
        }
        this.loadPredictionHistory();
        this.loadAllModels();

        if (this.config.enabled) {
            this.retrainTimer = setInterval(() => this.retrainAll(), this.config.retrainInterval);
        }
    }

    static stop() {
        if (this.retrainTimer) {
            clearInterval(this.retrainTimer);
            this.retrainTimer = null;
        }
    }

    static getConfig(): MLConfig {
        return { ...this.config };
    }

    static updateConfig(c: Partial<MLConfig>) {
        this.config = { ...this.config, ...c };
        if (this.retrainTimer) clearInterval(this.retrainTimer);
        this.retrainTimer = setInterval(() => this.retrainAll(), this.config.retrainInterval);
    }

    private static async fetchSentimentScore(symbol: string): Promise<number> {
        try {
            const PORT = process.env.PORT || 3015;
            await axios.get(`http://127.0.0.1:${PORT}/api/mt5/nlp/news?symbols=${symbol}&limit=5`, { timeout: 4000 }).catch(() => {});
            const resp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/nlp/sentiment/${symbol}`, { timeout: 3000 }).catch(() => ({ data: null }));
            if (resp?.data?.sentiment != null) return resp.data.sentiment;
        } catch {}
        return 0;
    }

    static async predict(symbol: string): Promise<Prediction | null> {
        try {
            const candles = await this.fetchCandles(symbol, 250);
            if (!candles || candles.length < 200) return null;

            const features = MLFeatureExtractor.extract(candles);
            const latest = features[features.length - 1];
            if (!latest) return null;

            const vector = MLFeatureExtractor.featureVector(latest);

            let model = this.models.get(symbol);
            if (!model) {
                model = await this.train(symbol, candles, features);
                if (!model) return null;
            }

            const logisticProb = model.logistic.predict(vector);
            const forestProb = model.forest.predict(vector);
            const regimeResult = model.regime.predict(vector);

            const ensembleProb = (logisticProb * 0.4 + forestProb * 0.4 + regimeResult.confidence * 0.2);

            const sentimentScore = await this.fetchSentimentScore(symbol);
            const adjustedProb = ensembleProb + sentimentScore * 0.05;

            let direction: 'BUY' | 'SELL' | 'NEUTRAL';
            let confidence: number;

            if (adjustedProb > this.config.confidenceThreshold) {
                direction = 'BUY';
                confidence = adjustedProb;
            } else if (adjustedProb < 1 - this.config.confidenceThreshold) {
                direction = 'SELL';
                confidence = 1 - adjustedProb;
            } else {
                direction = 'NEUTRAL';
                confidence = Math.abs(adjustedProb - 0.5) * 2;
            }

            const prediction: Prediction = {
                symbol,
                direction,
                confidence: Math.round(confidence * 10000) / 100,
                regime: regimeResult.label,
                regimeConfidence: Math.round(regimeResult.confidence * 100) / 100,
                modelConfidence: Math.round(logisticProb * 10000) / 100,
                forestConfidence: Math.round(forestProb * 10000) / 100,
                timestamp: Date.now(),
                features: this.featuresToRecord(vector),
            };

            this.predictionHistory.push({
                symbol,
                prediction: ensembleProb >= 0.5 ? 1 : 0,
                actual: -1,
                confidence,
                timestamp: Date.now(),
                resolved: false,
            });
            this.trimHistory();
            this.savePredictionHistory();

            return prediction;
        } catch (e) {
            console.error(`❌ MLService: Erro predict ${symbol}:`, e);
            return null;
        }
    }

    static async retrainAll() {
        for (const symbol of this.config.symbols) {
            try {
                const candles = await this.fetchCandles(symbol, 500);
                if (!candles || candles.length < this.config.minSamples) continue;
                await this.train(symbol, candles);
            } catch (e) {
                console.error(`❌ MLService: Erro retrain ${symbol}:`, e);
            }
        }
    }

    static async train(symbol: string, candles?: Candle[], precomputed?: Features[]): Promise<any> {
        if (!candles) {
            const fetched = await this.fetchCandles(symbol, 500);
            if (!fetched || fetched.length < this.config.minSamples) return null;
            candles = fetched;
        }

        const allFeatures = precomputed || MLFeatureExtractor.extract(candles);
        const closes = candles.map(c => c.close);
        const targetHorizon = 5;
        const labels: number[] = [];

        for (let i = 0; i < allFeatures.length - targetHorizon; i++) {
            labels.push(closes[i + targetHorizon] > closes[i] ? 1 : 0);
        }

        while (labels.length < allFeatures.length) labels.push(0);

        const vectors = allFeatures.map(f => MLFeatureExtractor.featureVector(f));
        const normalized = this.normalizeVectors(vectors);

        const trainSize = Math.floor(normalized.length * 0.8);
        const trainX = normalized.slice(0, trainSize);
        const trainY = labels.slice(0, trainSize);
        const testX = normalized.slice(trainSize);
        const testY = labels.slice(trainSize);

        const logistic = new LogisticRegression();
        logistic.fit(trainX, trainY);

        const forest = new RandomForest();
        forest.fit(trainX, trainY);

        const regime = new RegimeClassifier();
        regime.fit(vectors);

        let correct = 0;
        for (let i = 0; i < testX.length; i++) {
            const pred = logistic.predictDirection(testX[i]);
            if (pred === testY[i]) correct++;
        }
        const accuracy = testX.length > 0 ? correct / testX.length : 0;

        const modelEntry = {
            logistic,
            forest,
            regime,
            lastTrain: Date.now(),
            accuracy,
            samples: trainX.length + testX.length,
        };

        this.models.set(symbol, modelEntry);
        this.saveModel(symbol, modelEntry);

        return modelEntry;
    }

    static getModelStatus(symbol: string): { trained: boolean; accuracy: number; samples: number; lastTrain: number } | null {
        const model = this.models.get(symbol);
        if (!model) return null;
        return {
            trained: true,
            accuracy: Math.round(model.accuracy * 10000) / 100,
            samples: model.samples,
            lastTrain: model.lastTrain,
        };
    }

    static getAllStatus(): Array<{ symbol: string; accuracy: number; samples: number; lastTrain: number; prediction: string }> {
        const result: any[] = [];
        for (const symbol of this.config.symbols) {
            const status = this.getModelStatus(symbol);
            result.push({
                symbol,
                trained: !!status,
                accuracy: status?.accuracy ?? 0,
                samples: status?.samples ?? 0,
                lastTrain: status?.lastTrain ?? 0,
            });
        }
        return result;
    }

    static getHistory(symbol?: string, limit = 50): any[] {
        let entries = this.predictionHistory;
        if (symbol) entries = entries.filter(e => e.symbol === symbol);
        return entries.slice(-limit).reverse();
    }

    static async resolvePrediction(symbol: string, timestamp: number, actualPriceChange: number) {
        for (const entry of this.predictionHistory) {
            if (entry.symbol === symbol && entry.timestamp === timestamp && !entry.resolved) {
                entry.actual = actualPriceChange > 0 ? 1 : 0;
                entry.resolved = true;
                break;
            }
        }
        this.savePredictionHistory();
    }

    static async resolveRecent() {
        for (const symbol of this.config.symbols) {
            const unresolved = this.predictionHistory.filter(e => e.symbol === symbol && !e.resolved);
            if (unresolved.length === 0) continue;

            const candles = await this.fetchCandles(symbol, 10);
            if (!candles || candles.length < 6) continue;
            const closes = candles.map(c => c.close);

            for (const entry of unresolved) {
                const age = (Date.now() - entry.timestamp) / 1000;
                if (age < 3600) continue;
                const futureIdx = Math.min(5, closes.length - 1);
                const actualChange = closes[futureIdx] - closes[0];
                entry.actual = actualChange > 0 ? 1 : 0;
                entry.resolved = true;
            }
        }
        this.savePredictionHistory();
    }

    private static async fetchCandles(symbol: string, count: number): Promise<Candle[] | null> {
        try {
            const resp = await axios.get(`${BRIDGE_URL}/candles`, {
                params: { symbol, timeframe: this.config.timeframe, count },
                timeout: 8000,
            });
            const data = resp.data;
            if (!Array.isArray(data) || data.length < 50) return null;
            return data.map((c: any) => ({
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                tick_volume: c.tick_volume || c.vol,
                time: c.time,
            }));
        } catch (e) {
            console.error(`❌ MLService: Erro fetch ${symbol}:`, e);
            return null;
        }
    }

    private static normalizeVectors(vectors: number[][]): number[][] {
        const m = vectors[0].length;
        const means = new Array(m).fill(0);
        const stds = new Array(m).fill(0);
        const n = vectors.length;

        for (let j = 0; j < m; j++) {
            for (let i = 0; i < n; i++) means[j] += vectors[i][j];
            means[j] /= n;
        }
        for (let j = 0; j < m; j++) {
            for (let i = 0; i < n; i++) stds[j] += (vectors[i][j] - means[j]) ** 2;
            stds[j] = Math.sqrt(stds[j] / n) || 1;
        }

        return vectors.map(v => v.map((val, j) => (val - means[j]) / stds[j]));
    }

    private static featuresToRecord(vector: number[]): Record<string, number> {
        const names = MLFeatureExtractor.featureNames();
        const record: Record<string, number> = {};
        for (let i = 0; i < vector.length; i++) {
            record[names[i]] = Math.round(vector[i] * 10000) / 10000;
        }
        return record;
    }

    private static saveModel(symbol: string, model: any) {
        try {
            const data = {
                logistic: model.logistic.exportModel(),
                forest: model.forest.exportModel(),
                regime: model.regime.exportModel(),
                lastTrain: model.lastTrain,
                accuracy: model.accuracy,
                samples: model.samples,
            };
            fs.writeFileSync(path.join(this.MODELS_PATH, `${symbol.toLowerCase()}.json`), JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`❌ MLService: Erro save model ${symbol}:`, e);
        }
    }

    private static loadAllModels() {
        try {
            const files = fs.readdirSync(this.MODELS_PATH).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const symbol = path.basename(file, '.json').toUpperCase();
                    const data = JSON.parse(fs.readFileSync(path.join(this.MODELS_PATH, file), 'utf-8'));

                    const logistic = new LogisticRegression();
                    if (data.logistic?.weights) logistic.load(data.logistic.weights, data.logistic.bias || 0);

                    const forest = new RandomForest();
                    if (data.forest?.trees) forest.load(data.forest.trees, data.forest.featureCount || 0);

                    const regime = new RegimeClassifier();
                    if (data.regime?.centroids) regime.load(data.regime.centroids);

                    this.models.set(symbol, {
                        logistic,
                        forest,
                        regime,
                        lastTrain: data.lastTrain || 0,
                        accuracy: data.accuracy || 0,
                        samples: data.samples || 0,
                    });
                } catch (e) {
                    console.error(`❌ MLService: Erro load model ${file}:`, e);
                }
            }
        } catch (e) {
            console.error('❌ MLService: Erro load models:', e);
        }
    }

    private static loadPredictionHistory() {
        try {
            if (fs.existsSync(this.HISTORY_PATH)) {
                this.predictionHistory = JSON.parse(fs.readFileSync(this.HISTORY_PATH, 'utf-8'));
            }
        } catch { this.predictionHistory = []; }
    }

    private static savePredictionHistory() {
        try {
            fs.writeFileSync(this.HISTORY_PATH, JSON.stringify(this.predictionHistory.slice(-1000), null, 2));
        } catch { /* ignore */ }
    }

    private static trimHistory() {
        if (this.predictionHistory.length > 1000) {
            this.predictionHistory = this.predictionHistory.slice(-1000);
        }
    }
}
