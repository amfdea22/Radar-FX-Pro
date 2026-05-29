export interface ModelData {
    type: string;
    weights?: number[];
    bias?: number;
    trees?: DecisionTree[];
    centroids?: number[][];
    featureCount?: number;
    featureNames?: string[];
    trainedAt?: number;
    accuracy?: number;
    totalSamples?: number;
}

interface DecisionTree {
    threshold: number;
    featureIndex: number;
    left: DecisionTree | null;
    right: DecisionTree | null;
    prediction: number;
    confidence: number;
}

export class LogisticRegression {
    private weights: number[] = [];
    private bias = 0;
    private learningRate = 0.01;
    private epochs = 300;
    private lambda = 0.01;

    fit(features: number[][], labels: number[]) {
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;

        for (let epoch = 0; epoch < this.epochs; epoch++) {
            let totalLoss = 0;
            for (let i = 0; i < n; i++) {
                const z = this.dot(features[i], this.weights) + this.bias;
                const pred = this.sigmoid(z);
                const error = pred - labels[i];
                totalLoss += error * error;
                for (let j = 0; j < m; j++) {
                    this.weights[j] -= this.learningRate * (error * features[i][j] + this.lambda * this.weights[j]);
                }
                this.bias -= this.learningRate * error;
            }
            if (totalLoss / n < 0.001) break;
        }
    }

    predict(features: number[]): number {
        const z = this.dot(features, this.weights) + this.bias;
        return this.sigmoid(z);
    }

    predictDirection(features: number[]): number {
        return this.predict(features) >= 0.5 ? 1 : 0;
    }

    getWeights(): number[] {
        return [...this.weights];
    }

    getBias(): number {
        return this.bias;
    }

    load(weights: number[], bias: number) {
        this.weights = weights;
        this.bias = bias;
    }

    exportModel(): ModelData {
        return {
            type: 'logistic_regression',
            weights: this.weights,
            bias: this.bias,
            featureCount: this.weights.length,
        };
    }

    private sigmoid(z: number): number {
        if (z > 20) return 1;
        if (z < -20) return 0;
        return 1 / (1 + Math.exp(-z));
    }

    private dot(a: number[], b: number[]): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }
}

export class RandomForest {
    private trees: DecisionTree[] = [];
    private nTrees = 50;
    private maxDepth = 5;
    private featureCount = 0;

    fit(features: number[][], labels: number[]) {
        this.featureCount = features[0].length;
        this.trees = [];
        const n = features.length;

        for (let t = 0; t < this.nTrees; t++) {
            const sample: number[][] = [];
            const sampleLabels: number[] = [];
            for (let i = 0; i < n; i++) {
                const idx = Math.floor(Math.random() * n);
                sample.push(features[idx]);
                sampleLabels.push(labels[idx]);
            }
            const tree = this.buildTree(sample, sampleLabels, 0);
            this.trees.push(tree);
        }
    }

    predict(features: number[]): number {
        if (this.trees.length === 0) return 0.5;
        let sum = 0;
        for (const tree of this.trees) {
            sum += this.traverse(tree, features);
        }
        return sum / this.trees.length;
    }

    predictDirection(features: number[]): number {
        return this.predict(features) >= 0.5 ? 1 : 0;
    }

    exportModel(): ModelData {
        return {
            type: 'random_forest',
            trees: this.trees,
            featureCount: this.featureCount,
        };
    }

    load(trees: DecisionTree[], featureCount: number) {
        this.trees = trees;
        this.featureCount = featureCount;
    }

    private buildTree(features: number[][], labels: number[], depth: number): DecisionTree {
        if (depth >= this.maxDepth || features.length < 5 || labels.every(l => l === labels[0])) {
            const wins = labels.filter(l => l === 1).length;
            return {
                threshold: 0, featureIndex: 0,
                left: null, right: null,
                prediction: wins / labels.length >= 0.5 ? 1 : 0,
                confidence: Math.max(wins, labels.length - wins) / labels.length,
            };
        }

        let bestGini = Infinity;
        let bestFeature = 0;
        let bestThreshold = 0;

        const nFeatures = Math.min(5, features[0].length);
        const subsetFeatures = this.shuffle([...Array(features[0].length).keys()]).slice(0, nFeatures);

        for (const fi of subsetFeatures) {
            const values = features.map(f => f[fi]).sort((a, b) => a - b);
            const step = Math.max(1, Math.floor(values.length / 10));
            for (let i = step; i < values.length; i += step) {
                const threshold = values[i];
                const gini = this.giniIndex(features, labels, fi, threshold);
                if (gini < bestGini) {
                    bestGini = gini;
                    bestFeature = fi;
                    bestThreshold = threshold;
                }
            }
        }

        if (bestGini === Infinity || bestGini >= 0.5) {
            const wins = labels.filter(l => l === 1).length;
            return {
                threshold: 0, featureIndex: 0,
                left: null, right: null,
                prediction: wins / labels.length >= 0.5 ? 1 : 0,
                confidence: Math.max(wins, labels.length - wins) / labels.length,
            };
        }

        const leftIdx: number[] = [];
        const rightIdx: number[] = [];
        for (let i = 0; i < features.length; i++) {
            if (features[i][bestFeature] <= bestThreshold) leftIdx.push(i);
            else rightIdx.push(i);
        }

        if (leftIdx.length === 0 || rightIdx.length === 0) {
            const wins = labels.filter(l => l === 1).length;
            return {
                threshold: 0, featureIndex: 0,
                left: null, right: null,
                prediction: wins / labels.length >= 0.5 ? 1 : 0,
                confidence: Math.max(wins, labels.length - wins) / labels.length,
            };
        }

        return {
            threshold: bestThreshold,
            featureIndex: bestFeature,
            left: this.buildTree(leftIdx.map(i => features[i]), leftIdx.map(i => labels[i]), depth + 1),
            right: this.buildTree(rightIdx.map(i => features[i]), rightIdx.map(i => labels[i]), depth + 1),
            prediction: 0,
            confidence: 0,
        };
    }

    private traverse(tree: DecisionTree, features: number[]): number {
        if (tree.left === null || tree.right === null) return tree.prediction;
        if (features[tree.featureIndex] <= tree.threshold) return this.traverse(tree.left, features);
        return this.traverse(tree.right, features);
    }

    private giniIndex(features: number[][], labels: number[], featureIdx: number, threshold: number): number {
        let left1 = 0, leftTotal = 0, right1 = 0, rightTotal = 0;
        for (let i = 0; i < features.length; i++) {
            if (features[i][featureIdx] <= threshold) {
                if (labels[i] === 1) left1++;
                leftTotal++;
            } else {
                if (labels[i] === 1) right1++;
                rightTotal++;
            }
        }
        if (leftTotal === 0 || rightTotal === 0) return 1;
        const giniLeft = 1 - (left1 / leftTotal) ** 2 - ((leftTotal - left1) / leftTotal) ** 2;
        const giniRight = 1 - (right1 / rightTotal) ** 2 - ((rightTotal - right1) / rightTotal) ** 2;
        return (leftTotal * giniLeft + rightTotal * giniRight) / (leftTotal + rightTotal);
    }

    private shuffle(arr: number[]): number[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

export class RegimeClassifier {
    private centroids: number[][] = [];
    private readonly nClusters = 3;

    fit(features: number[][]) {
        this.centroids = [];
        const n = features.length;
        if (n === 0) return;

        for (let k = 0; k < this.nClusters; k++) {
            this.centroids.push([...features[Math.floor(Math.random() * n)]]);
        }

        const labels = new Array(n).fill(0);
        for (let iter = 0; iter < 20; iter++) {
            for (let i = 0; i < n; i++) {
                let minDist = Infinity;
                for (let k = 0; k < this.nClusters; k++) {
                    const dist = this.euclidean(features[i], this.centroids[k]);
                    if (dist < minDist) { minDist = dist; labels[i] = k; }
                }
            }
            for (let k = 0; k < this.nClusters; k++) {
                const cluster = features.filter((_, i) => labels[i] === k);
                if (cluster.length === 0) continue;
                this.centroids[k] = cluster[0].map((_, j) => cluster.reduce((s, p) => s + p[j], 0) / cluster.length);
            }
        }
    }

    predict(features: number[]): { regime: number; label: string; confidence: number } {
        if (this.centroids.length === 0) return { regime: 1, label: 'Ranging', confidence: 0.5 };
        let minDist = Infinity;
        let closest = 0;
        const dists: number[] = [];
        for (let k = 0; k < this.centroids.length; k++) {
            const dist = this.euclidean(features, this.centroids[k]);
            dists.push(dist);
            if (dist < minDist) { minDist = dist; closest = k; }
        }
        const totalDist = dists.reduce((a, b) => a + b, 0);
        const confidence = totalDist > 0 ? 1 - minDist / totalDist : 0.5;
        const labels = ['Trending Alta', 'Ranging', 'Trending Baixa'];
        return { regime: closest, label: labels[closest] || 'Ranging', confidence };
    }

    exportModel(): ModelData {
        return { type: 'regime_classifier', centroids: this.centroids };
    }

    load(centroids: number[][]) {
        this.centroids = centroids;
    }

    private euclidean(a: number[], b: number[]): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
        return Math.sqrt(sum);
    }
}
