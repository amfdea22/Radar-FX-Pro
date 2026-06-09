import { PolygonService, PolygonBar } from './PolygonService';
import axios from 'axios';

// Mapeamento de símbolos internos para LiteFinance (espelhado do LiteFinanceService)
const SYMBOL_MAP: Record<string, string> = {
    'EURUSD': 'EURUSD',
    'GBPUSD': 'GBPUSD',
    'USDJPY': 'USDJPY',
    'AUDUSD': 'AUDUSD',
    'USDCAD': 'USDCAD',
    'NZDUSD': 'NZDUSD',
    'USDCHF': 'USDCHF',
    'EURGBP': 'EURGBP',
    'EURJPY': 'EURJPY',
    'GBPJPY': 'GBPJPY',
    'XAUUSD': 'XAUUSD',
    'XAGUSD': 'XAGUSD',
    'BTCUSD': 'BTCUSD',
    'ETHUSD': 'ETHUSD',
    'SOLUSD': 'SOLUSD',
    'NAS100': 'US100Cash',
    'US30': 'US30Cash',
    'US500': 'US500Cash',
    'GER40': 'DAX',
    'UK100': 'FTSE',
    'FRA40': 'CAC',
    'JPN225': 'NI225',
    'HK50': 'HK50',
    // New mappings for VSA stability
    'US100Cash': 'US100Cash',
    'US30Cash': 'US30Cash',
    'US500Cash': 'US500Cash',
    'GER40Cash': 'DAX',
    'GOLD': 'XAUUSD',
    'SILVER': 'XAGUSD'
};

export class MarketDataService {
    private static barCache: Record<string, { bars: PolygonBar[], timestamp: number }> = {};
    private static CACHE_TTL = 45000; // 45 segundos para evitar estouro da Polygon mas manter frescor
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static LF_BASE_URL = 'https://my.litefinance.org';

    /**
     * Busca candles M1 com Volume (VSA-ready)
     * Ordem de prioridade para máxima resiliência:
     * 1. MT5 Bridge (Preço local da corretora do usuário)
     * 2. Polygon (Dados institucionais) - Fallback
     * 3. LiteFinance (Dados globais) - Último recurso
     */
    static async getRecentBars(symbol: string, limit: number = 10, timeframe: string = 'M1'): Promise<PolygonBar[]> {
        const now = Date.now();
        const cached = this.barCache[symbol + '_' + timeframe];

        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.bars;
        }

        // 1. Tentar MT5 Bridge (Mais confiável pois é o preço real da conta)
        try {
            const bridgeBars = await this.getBridgeBars(symbol, limit, timeframe);
            if (bridgeBars && bridgeBars.length >= 5) {
                console.log(`✅ MarketData: MT5 Bridge success for ${symbol} ${timeframe} (${bridgeBars.length} bars)`);
                this.barCache[symbol + '_' + timeframe] = { bars: bridgeBars, timestamp: now };
                return bridgeBars;
            }
        } catch (err) {
            console.warn(`⚠️ MarketData: MT5 Bridge failed for ${symbol} ${timeframe}`);
        }

        // 2. Tentar Polygon
        try {
            const bars = await PolygonService.getRecentBars(symbol, limit);
            if (bars && bars.length >= 5) {
                this.barCache[symbol + '_' + timeframe] = { bars, timestamp: now };
                return bars;
            }
        } catch (err) {
            console.warn(`⚠️ MarketData: Polygon failed for ${symbol}`);
        }

        // 3. Fallback para LiteFinance
        try {
            const lfBars = await this.getLiteFinanceBars(symbol, limit);
            if (lfBars && lfBars.length >= 5) {
                this.barCache[symbol + '_' + timeframe] = { bars: lfBars, timestamp: now };
                return lfBars;
            }
        } catch (err) {
            console.error(`❌ MarketData: LiteFinance failed for ${symbol} ${timeframe}`, (err as any)?.message || '');
        }

        return [];
    }

    private static async getBridgeBars(symbol: string, limit: number, timeframe: string = 'M1'): Promise<PolygonBar[]> {
        const url = `${this.BRIDGE_URL}/candles?symbol=${symbol}&count=${limit}&timeframe=${timeframe}`;
        const response = await axios.get(url, { timeout: 3000 });
        const data = response.data;

        if (Array.isArray(data) && data.length > 0) {
            // MT5 Bridge retorna cronológico (antigo -> novo). Invertemos para desc (novo -> antigo)
            return data.map((b: any) => ({
                o: b.open,
                h: b.high,
                l: b.low,
                c: b.close,
                v: b.tick_volume || b.volume || 100,
                t: (b.time * 1000)
            })).reverse();
        }
        return [];
    }

    private static async getLiteFinanceBars(symbol: string, limit: number): Promise<PolygonBar[]> {
        const lfSymbol = SYMBOL_MAP[symbol] || symbol;
        const to = Math.floor(Date.now() / 1000);
        const from = to - (limit * 120); // Janela de segurança (2x o limit em minutos)

        const url = `${this.LF_BASE_URL}/pt/chart/get-history?symbol=${lfSymbol}&resolution=1&from=${from}&to=${to}`;
        console.log(`🌐 MarketData: LiteFinance Fetch -> ${lfSymbol}`);

        const response = await axios.get(url, { timeout: 8000 });
        const data = response.data.data || response.data;

        if (data && data.c && data.c.length > 0) {
            const result: PolygonBar[] = [];
            const len = data.c.length;
            for (let i = len - 1; i >= Math.max(0, len - limit); i--) {
                const o = data.o?.[i], h = data.h?.[i], l = data.l?.[i], c = data.c[i], t = data.t?.[i];
                if (o == null || h == null || l == null || c == null || t == null) continue;
                result.push({
                    o, h, l, c,
                    v: data.v?.[i] || (Math.random() * 100 + 50),
                    t: t * 1000
                });
            }
            return result;
        }

        return [];
    }
}
