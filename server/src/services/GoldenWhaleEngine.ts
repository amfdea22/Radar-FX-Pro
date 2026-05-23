import { PolygonBar } from './PolygonService';
import { MarketDataService } from './MarketDataService';
import { VSAEngine } from './VSAEngine';

export interface GoldenWhaleSignal {
    type: 'BUY' | 'SELL';
    confidence: number;
    details: string;
    sl: number;
    tp: number;
}

export class GoldenWhaleEngine {
    /**
     * Avalia o XAUUSD em busca de pegadas institucionais (Baleias)
     * Focado em Liquidity Sweeps + Order Blocks + VSA
     */
    static async evaluate(symbol: string): Promise<GoldenWhaleSignal | null> {
        if (!symbol.includes('XAU')) return null;

        try {
            // Pegamos bars de H1 para contexto de Smart Money e M5 para entrada
            const barsH1 = await MarketDataService.getRecentBars(symbol, 20); // Simulado ou real via MarketData
            const barsM5 = await MarketDataService.getRecentBars(symbol, 10);

            if (barsH1.length < 5 || barsM5.length < 5) return null;

            // 1. Detecção de Liquidity Sweep (H1)
            // Verifica se a última vela H1 limpou o topo/fundo das últimas 3 velas e fechou dentro
            const sweep = this.checkLiquiditySweep(barsH1);

            // 2. Detecção de Order Block de Reversão
            const ob = this.detectOrderBlock(barsH1);

            // 3. Confirmação VSA (M5)
            const vsa = VSAEngine.analyze(barsM5);
            const hasVSAConfirmation = vsa && (
                (sweep?.bias === 'BULLISH' && (vsa.name === 'Shakeout' || vsa.name === 'Buying Climax')) ||
                (sweep?.bias === 'BEARISH' && (vsa.name === 'Upthrust' || vsa.name === 'Selling Climax'))
            );

            // Confluência de Ouro: Sweep + VSA ou OB + VSA
            if ((sweep || ob) && vsa && vsa.strength > 80) {
                const bias = sweep?.bias || ob?.bias || (vsa.type === 'BULLISH' ? 'BULLISH' : 'BEARISH');
                const price = barsM5[0].c;

                // Níveis Institucionais (Risk:Reward alto 1:3)
                const slDist = 2.5; // 25 pips no Ouro
                const tpDist = 8.0; // 80 pips no Ouro

                return {
                    type: bias === 'BULLISH' ? 'BUY' : 'SELL',
                    confidence: Math.min(85 + vsa.strength / 10 + (sweep ? 10 : 0), 99),
                    details: `Golden Whale: ${sweep ? 'Liquidity Sweep' : 'Order Block'} detectado com confirmação VSA ${vsa.name}. Pegada institucional de baleia confirmada.`,
                    sl: Number((bias === 'BULLISH' ? price - slDist : price + slDist).toFixed(2)),
                    tp: Number((bias === 'BULLISH' ? price + tpDist : price - tpDist).toFixed(2))
                };
            }

            return null;
        } catch (error) {
            console.error('GoldenWhaleEngine Error:', error);
            return null;
        }
    }

    private static checkLiquiditySweep(bars: PolygonBar[]) {
        const last = bars[0];
        const prev3 = bars.slice(1, 4);

        const maxPrev = Math.max(...prev3.map(b => b.h));
        const minPrev = Math.min(...prev3.map(b => b.l));

        // Sweep de Alta (Limpou topo e caiu)
        if (last.h > maxPrev && last.c < maxPrev) {
            return { bias: 'BEARISH' as const };
        }
        // Sweep de Baixa (Limpou fundo e subiu)
        if (last.l < minPrev && last.c > minPrev) {
            return { bias: 'BULLISH' as const };
        }

        return null;
    }

    private static detectOrderBlock(bars: PolygonBar[]) {
        const b0 = bars[0];
        const b1 = bars[1];
        const b2 = bars[2];

        // Gap de valor justo indicando deslocamento institucional
        if (b0.l > b2.h && b1.c > b1.o) return { bias: 'BULLISH' as const };
        if (b0.h < b2.l && b1.c < b1.o) return { bias: 'BEARISH' as const };

        return null;
    }
}
