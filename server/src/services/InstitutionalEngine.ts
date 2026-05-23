import { PolygonBar } from './PolygonService';
import { MarketDataService } from './MarketDataService';
import { AlertEngine } from './AlertEngine';

interface MarketData {
    symbol: string;
    bid: number;
    ask: number;
    last: number;
    volume: number;
    time: number;
}

export interface InstitutionalFootprint {
    symbol: string;
    power: number; // 0-100
    type: 'ACCUMULATION' | 'DISTRIBUTION' | 'LIQUIDITY_SWEEP' | 'ORDER_BLOCK';
    bias: 'BULLISH' | 'BEARISH';
    confidence: number;
}

export class InstitutionalEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static lastActivity = 0;

    /**
     * Analisa sinais de volume anômalo e padrões de Smart Money usando dados da Polygon.io
     */
    static async detectSharkActivity(symbol: string): Promise<InstitutionalFootprint | null> {
        try {
            this.lastActivity = Date.now();
            console.log(`🔍 Institutional: Analyzing ${symbol}...`);
            const isGold = symbol.includes('XAU');
            const isBTC = symbol.includes('BTC');
            const bars = await MarketDataService.getRecentBars(symbol, 10);

            if (bars.length < 3) {
                console.warn(`⚠️ Institutional: Data insufficient for ${symbol} (Bars: ${bars.length}). Skipping.`);
                return null;
            }

            // 1. Detecção de Fair Value Gap (FVG)
            const fvg = this.detectFVG(bars);

            // 2. Detecção de Liquidity Sweep
            const lastBar = bars[0];
            const prevBars = bars.slice(1, 4);
            const highSweep = prevBars.every(b => lastBar.h > b.h) && lastBar.c < lastBar.o;
            const lowSweep = prevBars.every(b => lastBar.l < b.l) && lastBar.c > lastBar.o;

            let strategy: InstitutionalFootprint['type'] = 'ACCUMULATION';
            let bias: InstitutionalFootprint['bias'] = 'BULLISH';
            let power = 70;

            if (fvg) {
                strategy = 'ORDER_BLOCK';
                bias = fvg.bias;
                power = 85;
            } else if (highSweep || lowSweep) {
                strategy = 'LIQUIDITY_SWEEP';
                bias = highSweep ? 'BEARISH' : 'BULLISH';
                power = 90;
            }

            // Normalização do Setup: Shark Hunt em Forex, Shark Hunt XAU em Ouro
            const setupName = strategy === 'ORDER_BLOCK'
                ? 'Elite SMC'
                : (isGold ? 'Shark Hunt XAU' : 'Shark Hunt');

            const now = new Date();
            const hour = now.getUTCHours();
            const isInstitutionalSession = (hour >= 7 && hour <= 11) || (hour >= 13 && hour <= 18);

            let confidence = power + (isInstitutionalSession ? 5 : 0);
            if (isGold || isBTC) confidence += 3;

            return {
                symbol,
                power: Math.min(power, 100),
                type: setupName as any,
                bias,
                confidence: Math.min(confidence, 99)
            };
        } catch (error) {
            console.error(`❌ Institutional: Error in ${symbol}`, error);
            return null;
        }
    }

    /**
     * Detecta Fair Value Gaps (FVG) em um conjunto de bars
     */
    private static detectFVG(bars: PolygonBar[]): { bias: 'BULLISH' | 'BEARISH' } | null {
        const b0 = bars[0]; // Recente
        const b1 = bars[1]; // Gap
        const b2 = bars[2]; // Antiga

        if (b0.l > b2.h) return { bias: 'BULLISH' };
        if (b0.h < b2.l) return { bias: 'BEARISH' };
        return null;
    }

    /**
     * Identifica zonas de Order Blocks baseadas no histórico da Polygon
     */
    static async getOrderBlocks(symbol: string) {
        try {
            this.lastActivity = Date.now();
            const bars = await MarketDataService.getRecentBars(symbol, 20);
            if (bars.length < 5) return [];

            const obs: { price: number, strength: number, type: 'SUPPLY' | 'DEMAND', zone: [number, number] }[] = [];

            // Um Order Block é a última vela contrária antes de um movimento forte (displacement)
            for (let i = 1; i < bars.length - 2; i++) {
                const current = bars[i];
                const next = bars[i - 1]; // Pipeline desc: [0] é a mais nova

                const displacement = Math.abs(next.c - next.o);
                const avgSize = (bars[i + 1].h - bars[i + 1].l + bars[i + 2].h - bars[i + 2].l) / 2;

                // Se houve um movimento forte (2x o tamanho médio)
                if (displacement > avgSize * 2) {
                    const isBullishOB = next.c > next.o && current.c < current.o; // Candle de baixa antes de alta forte
                    const isBearishOB = next.c < next.o && current.c > current.o; // Candle de alta antes de baixa forte

                    if (isBullishOB) {
                        obs.push({
                            price: current.l,
                            strength: Math.min(displacement / avgSize, 1),
                            type: 'DEMAND',
                            zone: [current.l, current.h]
                        });
                    } else if (isBearishOB) {
                        obs.push({
                            price: current.h,
                            strength: Math.min(displacement / avgSize, 1),
                            type: 'SUPPLY',
                            zone: [current.l, current.h]
                        });
                    }
                }
            }

            return obs.slice(0, 3); // Retorna os 3 OBs mais relevantes
        } catch (error) {
            return [];
        }
    }

    static getStatus() {
        return {
            active: true,
            isSafe: Date.now() - this.lastActivity < 120000,
            engines: ['VSA', 'Smart Money', 'Liquidity Scanner'],
            confidence: 'High'
        };
    }
}
