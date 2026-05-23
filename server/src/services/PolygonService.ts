import axios from 'axios';

export interface PolygonTick {
    p: number; // Price
    s: number; // Size/Volume
    t: number; // Timestamp
}

export interface PolygonBar {
    o: number; // Open
    h: number; // High
    l: number; // Low
    c: number; // Close
    v: number; // Volume
    t: number; // Timestamp
}

export class PolygonService {
    private static get API_KEY() {
        return process.env.POLYGON_API_KEY || 'YOUR_POLYGON_API_KEY';
    }
    private static BASE_URL = 'https://api.polygon.io';

    /**
     * Busca os candles M1 mais recentes para análise de SMC
     */
    static async getRecentBars(symbol: string, limit: number = 50): Promise<PolygonBar[]> {
        try {
            if (!this.API_KEY || this.API_KEY === 'YOUR_POLYGON_API_KEY') {
                console.error('❌ PolygonService: API KEY MISSING OR PLACEHOLDER. Please check .env and restart server.');
                return [];
            }

            const polygonSymbol = this.formatSymbol(symbol);
            console.log(`🌐 Polygon: Fetching M1 bars for ${polygonSymbol}...`);
            const to = Date.now();
            const from = to - (limit * 60 * 1000 * 2);

            const url = `${this.BASE_URL}/v2/aggs/ticker/${polygonSymbol}/range/1/minute/${from}/${to}?adjusted=true&sort=desc&limit=${limit}&apiKey=${this.API_KEY}`;
            console.log(`📡 Polygon: API Call -> ${polygonSymbol}`);
            const response = await axios.get(url);

            if (response.data && response.data.results) {
                return response.data.results.map((r: any) => ({
                    o: r.o,
                    h: r.h,
                    l: r.l,
                    c: r.c,
                    v: r.v,
                    t: r.t
                }));
            }
            return [];
        } catch (error: any) {
            const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro desconhecido';
            console.error(`❌ PolygonService: Erro ao buscar bars para ${symbol} -> ${msg}`);
            return [];
        }
    }

    /**
     * Busca dados tick-by-tick (Trades/Quotes)
     */
    static async getRecentTicks(symbol: string, limit: number = 100): Promise<PolygonTick[]> {
        try {
            const polygonSymbol = this.formatSymbol(symbol);
            const cryptoList = ['BTC', 'ETH', 'BNB', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'DOT', 'LINK', 'TRX', 'LTC', 'SHIB', 'BCH', 'ETC', 'XLM', 'XMR', 'ZEC', 'EOS', 'DAI', 'USDC', 'USDT'];
            const isCrypto = cryptoList.some(c => symbol.includes(c));

            // Endpoint diferente para Crypto vs Forex
            const type = isCrypto ? 'crypto/trades' : 'forex/quotes';
            const url = `${this.BASE_URL}/v3/trades/${polygonSymbol}?limit=${limit}&apiKey=${this.API_KEY}`;
            // Nota: v3 trades é para stocks/crypto. Para forex usa v3/quotes.
            const finalUrl = isCrypto
                ? `${this.BASE_URL}/v3/trades/${polygonSymbol}?limit=${limit}&apiKey=${this.API_KEY}`
                : `${this.BASE_URL}/v3/quotes/${polygonSymbol}?limit=${limit}&apiKey=${this.API_KEY}`;

            const response = await axios.get(finalUrl);

            if (response.data && response.data.results) {
                return response.data.results.map((r: any) => ({
                    p: r.p || r.bp, // Price (or bid price for forex)
                    s: r.s || r.bs, // Size
                    t: r.t
                }));
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    private static formatSymbol(symbol: string): string {
        // Mapeamento de Índices Master
        const indicesMap: Record<string, string> = {
            'NAS100': 'I:NDX',
            'US30': 'I:DJI',
            'US500': 'I:SPX',
            'GER40': 'I:DAX',
            'UK100': 'I:UKX',
            'FRA40': 'I:CAC',
            'JPN225': 'I:N225',
            'HK50': 'I:HSI',
            'US100Cash': 'I:NDX',
            'US30Cash': 'I:DJI',
            'US500Cash': 'I:SPX',
            'GER40Cash': 'I:DAX'
        };

        if (indicesMap[symbol]) {
            return indicesMap[symbol];
        }

        const cryptoList = ['BTC', 'ETH', 'BNB', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC', 'DOT', 'LINK', 'TRX', 'LTC', 'SHIB', 'BCH', 'ETC', 'XLM', 'XMR', 'ZEC', 'EOS', 'DAI', 'USDC', 'USDT'];
        if (cryptoList.some(c => symbol.includes(c))) {
            return `X:${symbol.replace('/', '')}`;
        }

        // Padrão Forex/Metais
        let cleanSymbol = symbol.replace('/', '');
        if (cleanSymbol === 'GOLD') cleanSymbol = 'XAUUSD';
        if (cleanSymbol === 'SILVER') cleanSymbol = 'XAGUSD';

        return `C:${cleanSymbol}`;
    }
}
