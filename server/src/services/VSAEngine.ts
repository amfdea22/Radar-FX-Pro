import { PolygonBar } from './PolygonService';

export interface VSAPattern {
    name: string;
    type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-100
    description: string;
}

export class VSAEngine {
    /**
     * Analisa uma série de bars para detectar padrões VSA (Volume Spread Analysis)
     */
    static analyze(bars: PolygonBar[]): VSAPattern | null {
        if (bars.length < 5) return null;

        const current = bars[0];
        const previous = bars[1];
        const prev2 = bars[2];

        // Spread da barra (High - Low)
        const spread = current.h - current.l;
        const avgSpread = bars.slice(1, 10).reduce((acc, b) => acc + (b.h - b.l), 0) / 9;

        // Volume
        const volume = current.v;
        const avgVolume = bars.slice(1, 10).reduce((acc, b) => acc + b.v, 0) / 9;

        // Posição do fechamento (0 = Low, 1 = High)
        const closePos = (current.c - current.l) / (spread || 1);

        // 1. BUYING CLIMAX (Bearish Reversal)
        if (volume > avgVolume * 1.8 && spread > avgSpread * 1.5 && closePos < 0.4 && current.c > current.o) {
            return {
                name: 'Buying Climax',
                type: 'BEARISH',
                strength: 92,
                description: 'Volume de exaustão detectado em movimento de alta. Grande probabilidade de reversão.'
            };
        }

        // 2. SELLING CLIMAX (Bullish Reversal)
        if (volume > avgVolume * 1.8 && spread > avgSpread * 1.5 && closePos > 0.6 && current.c < current.o) {
            return {
                name: 'Selling Climax',
                type: 'BULLISH',
                strength: 92,
                description: 'Volume de pânico/absorção detectado. Institucionais comprando o fundo.'
            };
        }

        // 3. NO DEMAND (Bearish)
        if (volume < previous.v && volume < prev2.v && spread < avgSpread && closePos < 0.5) {
            return {
                name: 'No Demand',
                type: 'BEARISH',
                strength: 86,
                description: 'Falta de interesse profissional no lado da compra. Mercado fraco.'
            };
        }

        // 4. NO SUPPLY (Bullish)
        if (volume < previous.v && volume < prev2.v && spread < avgSpread && closePos > 0.5) {
            return {
                name: 'No Supply',
                type: 'BULLISH',
                strength: 86,
                description: 'Ausência de pressão vendedora. Profissionais testando a oferta.'
            };
        }

        // 5. UPTHRUST (Bearish Trap)
        const isUpthrust = current.h > previous.h && closePos < 0.3 && (current.h - current.c) > (spread * 0.6) && volume > avgVolume * 1.1;
        if (isUpthrust) {
            return {
                name: 'Upthrust',
                type: 'BEARISH',
                strength: 95,
                description: 'Armadilha de liquidez (Upthrust). Institucionais capturando stops antes de queda.'
            };
        }

        // 6. SHAKEOUT (Bullish Trap)
        const isShakeout = current.l < previous.l && closePos > 0.7 && (current.c - current.l) > (spread * 0.6) && volume > avgVolume * 1.1;
        if (isShakeout) {
            return {
                name: 'Shakeout',
                type: 'BULLISH',
                strength: 95,
                description: 'Shakeout detectado. Limpeza de vendedores fracos antes de alta forte.'
            };
        }

        return null;
    }
}
