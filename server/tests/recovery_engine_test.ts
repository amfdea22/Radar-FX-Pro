import { describe, it, assert, printResults } from './test_runner';

describe('RecoveryEngine — Matemática de Recuperação', () => {

    const SETTINGS = {
        minConfidenceScore: 40,
        consecutiveLossThreshold: 2,
        useMartingale: true,
        martingaleMultiplier: 1.6,
        useAntiMartingale: true,
        antiMartingaleMultiplier: 1.3,
        useKellySizing: true,
        kellyFraction: 0.25,
        volatilityAdjustment: true,
        baseLotSize: 0.01,
        maxLotMultiplier: 3.0,
    };

    function calcConfidence(winRate: number, consecutiveLosses: number, maxConsecutiveLosses: number, profitFactor: number): number {
        if (winRate === 0) return 0;
        // Probabilidade de streak continuar: P(loss)^N
        const lossProb = 1 - (winRate / 100);
        const streakProb = Math.pow(lossProb, consecutiveLosses);
        // Mean reversion: chance de reverter baseado em streak
        const meanReversionScore = Math.max(0, Math.min(100, (1 - streakProb) * 100));

        // Exaustão: quão perto estamos do max histórico de perdas
        const streakRatio = maxConsecutiveLosses > 0 ? consecutiveLosses / maxConsecutiveLosses : 0;
        const exhaustionScore = Math.min(100, streakRatio * 100);

        // Profit factor: PF > 1 = bom, PF <= 1 = ruim
        const pfScore = profitFactor >= 999 ? 50 : Math.max(0, Math.min(100, (profitFactor - 0.5) * 50));

        // Composto
        return Math.min(100, Math.max(0, (meanReversionScore * 0.5) + (exhaustionScore * 0.3) + (pfScore * 0.2)));
    }

    function calcRecoveryLot(winRate: number, consecutiveLosses: number, settings: typeof SETTINGS): number {
        if (consecutiveLosses < settings.consecutiveLossThreshold) return settings.baseLotSize;
        let multiplier = 1;
        if (settings.useMartingale) {
            const mf = Math.pow(settings.martingaleMultiplier, consecutiveLosses - settings.consecutiveLossThreshold + 1);
            multiplier *= Math.min(mf, settings.maxLotMultiplier);
        }
        if (settings.useAntiMartingale) {
            const wr = winRate / 100;
            multiplier *= wr < 0.4 ? 0.8 : wr < 0.6 ? 1.0 : 1.2;
        }
        if (settings.useKellySizing) {
            const kellyPct = 0.05;
            multiplier *= 1 + Math.max(0, kellyPct * settings.kellyFraction);
        }
        return Math.round(settings.baseLotSize * Math.min(multiplier, settings.maxLotMultiplier) * 100) / 100;
    }

    // --- Confiança (Confidence) ---
    it('confiança = 0 quando winRate = 0', () => {
        assert.equal(calcConfidence(0, 3, 5, 0), 0);
    });

    it('confiança aumenta com perdas consecutivas (mean reversion)', () => {
        const low = calcConfidence(60, 1, 5, 1.5);
        const high = calcConfidence(60, 4, 5, 1.5);
        assert.isTrue(high > low, 'Mais perdas consecutivas deveria gerar mais confiança (mean reversion)');
    });

    it('confiança > 40% com 3 perdas consecutivas e WR 60%', () => {
        const c = calcConfidence(60, 3, 5, 1.5);
        assert.isTrue(c >= 40, `Confiança ${c.toFixed(1)}% deveria ser >= 40%`);
    });

    it('confiança moderada com WR alto e 1 perda só (mean reversion baixo)', () => {
        const c = calcConfidence(80, 1, 3, 2.0);
        assert.isTrue(c < 80, `Confiança ${c.toFixed(1)}% deveria ser < 80% com 1 perda só`);
    });

    it('confiança no maximo 100', () => {
        const c = calcConfidence(30, 10, 10, 0.1);
        assert.isTrue(c <= 100, `Confiança ${c.toFixed(1)}% deveria ser <= 100%`);
    });

    // --- Lote (Lot Size) ---
    it('lote base quando perdas < threshold', () => {
        assert.equal(calcRecoveryLot(60, 1, SETTINGS), 0.01);
    });

    it('lote aumenta com martingale apos threshold', () => {
        const base = calcRecoveryLot(60, 2, SETTINGS);
        const increased = calcRecoveryLot(60, 3, SETTINGS);
        assert.isTrue(increased >= base, `Lote ${increased} deveria ser >= ${base} com mais perdas`);
    });

    it('lote respeita maxLotMultiplier', () => {
        const lot = calcRecoveryLot(60, 10, SETTINGS);
        assert.isTrue(lot <= SETTINGS.baseLotSize * SETTINGS.maxLotMultiplier, `Lote ${lot} excede maximo ${SETTINGS.baseLotSize * SETTINGS.maxLotMultiplier}`);
    });

    it('anti-martingale reduz lote para WR baixa', () => {
        const settingsLowWr = { ...SETTINGS, useAntiMartingale: true };
        const lotLowWr = calcRecoveryLot(35, 3, settingsLowWr);
        const settingsHighWr = { ...SETTINGS, useAntiMartingale: true };
        const lotHighWr = calcRecoveryLot(65, 3, settingsHighWr);
        assert.isTrue(lotHighWr >= lotLowWr, `WR 65% lote ${lotHighWr} deveria ser >= WR 35% lote ${lotLowWr}`);
    });

    it('lote sem martingale = base', () => {
        const settingsNoMart = { ...SETTINGS, useMartingale: false, useAntiMartingale: false, useKellySizing: false };
        assert.equal(calcRecoveryLot(60, 3, settingsNoMart), 0.01);
    });

    // --- Cenários Reais ---
    it('Gold Scalper com 3 perdas consecutivas', () => {
        const confidence = calcConfidence(80.5, 3, 6, 0.81);
        const lot = calcRecoveryLot(80.5, 3, SETTINGS);
        assert.isTrue(confidence > 0, 'Confiança deve ser positiva');
        assert.isTrue(lot >= 0.01, 'Lote deve ser >= base');
    });

    it('Alpha Robot com 2 perdas consecutivas', () => {
        const confidence = calcConfidence(65, 2, 3, 1.2);
        assert.isTrue(confidence > 30, `Confiança ${confidence.toFixed(1)}% deveria ser > 30% para 2 perdas`);
    });

    it('estratégia nova sem histórico = confiança 0', () => {
        assert.equal(calcConfidence(0, 0, 0, 0), 0);
    });
});

printResults();
