import axios from 'axios';

interface LiteFinanceQuote {
    symbol: string;
    bid: number;
    ask: number;
    change: number;
    changePercent: number;
    changePercent5m: number;
    changePercent1h: number;
    is_open: boolean;
}

// Mapeamento de símbolos internos para LiteFinance
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
    'GOLD': 'XAUUSD',
    'XAGUSD': 'XAGUSD',
    'BTCUSD': 'BTCUSD',
    'ETHUSD': 'ETHUSD',
    'SOLUSD': 'SOLUSD',
    'NAS100': 'NASDAQ',
    'US100Cash': 'NASDAQ',
    'US30': 'DOWJONES',
    'US30Cash': 'DOWJONES',
    'US500': 'SPX',
    'GER40': 'DAX',
    'GER40Cash': 'DAX',
    'UK100': 'FTSE',
    'FRA40': 'CAC',
    'JPN225': 'NI225',
    'HK50': 'HK50'
};

export class LiteFinanceService {
    private static BASE_URL = 'https://my.litefinance.org';
    private static cache: Record<string, LiteFinanceQuote> = {};
    private static lastFetch = 0;
    private static CACHE_TTL = 3000; // 3 segundos

    /**
     * Busca cotações de uma lista de símbolos da LiteFinance.
     * Usa a API de histórico para obter o último preço.
     */
    static async getQuotes(symbols: string[]): Promise<Record<string, { bid: number; ask: number; is_open: boolean; change: number; changePercent: number }>> {
        const now = Date.now();

        // Retornar cache se ainda válido
        if (now - this.lastFetch < this.CACHE_TTL && Object.keys(this.cache).length > 0) {
            const result: Record<string, any> = {};
            for (const sym of symbols) {
                if (this.cache[sym]) {
                    result[sym] = this.cache[sym];
                }
            }
            return result;
        }

        const result: Record<string, any> = {};
        const now_unix = Math.floor(now / 1000);
        const from_unix = now_unix - 86400; // últimas 24h

        // Buscar em paralelo (batches de 5 para não sobrecarregar)
        const batchSize = 5;
        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const promises = batch.map(async (symbol) => {
                try {
                    const lfSymbol = SYMBOL_MAP[symbol] || symbol;
                    const url = `${this.BASE_URL}/pt/chart/get-history?symbol=${lfSymbol}&resolution=1&from=${from_unix}&to=${now_unix}`;

                    const response = await axios.get(url, {
                        timeout: 5000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            'Accept': 'application/json'
                        }
                    });

                    const rawData = response.data;
                    // A API retorna {status: "success", data: {o:[], c:[], h:[], l:[]}}
                    const data = rawData.data || rawData;

                    if (data && data.c && data.c.length > 0) {
                        const lastClose = data.c[data.c.length - 1];
                        const firstOpen = data.o[0];

                        // 5 min ago (resolution=1)
                        const idx5m = Math.max(0, data.c.length - 5);
                        const open5m = data.o[idx5m];

                        // 1 hour ago (resolution=1)
                        const idx1h = Math.max(0, data.c.length - 60);
                        const open1h = data.o[idx1h];

                        // Calcular spread estimado baseado no tipo de ativo
                        const spreadMultiplier = this.getSpreadMultiplier(symbol);
                        const spread = lastClose * spreadMultiplier;

                        const quote: LiteFinanceQuote = {
                            symbol,
                            bid: Number(lastClose.toFixed(this.getDecimals(symbol))),
                            ask: Number((lastClose + spread).toFixed(this.getDecimals(symbol))),
                            change: Number((lastClose - firstOpen).toFixed(this.getDecimals(symbol))),
                            changePercent: Number((((lastClose - firstOpen) / firstOpen) * 100).toFixed(2)),
                            changePercent5m: Number((((lastClose - open5m) / open5m) * 100).toFixed(2)),
                            changePercent1h: Number((((lastClose - open1h) / open1h) * 100).toFixed(2)),
                            is_open: true,
                        };

                        this.cache[symbol] = quote;
                        result[symbol] = quote;
                    }
                } catch (error: any) {
                    // Se falhar, usar cache anterior
                    if (this.cache[symbol]) {
                        result[symbol] = this.cache[symbol];
                    }
                    console.error(`⚠️ LiteFinance: Failed to fetch ${symbol}:`, error.message);
                }
            });

            await Promise.all(promises);
        }

        this.lastFetch = now;
        return result;
    }

    private static getSpreadMultiplier(symbol: string): number {
        if (symbol.includes('XAU')) return 0.00015;
        if (symbol.includes('XAG')) return 0.001;
        if (symbol.includes('BTC')) return 0.0003;
        if (symbol.includes('ETH') || symbol.includes('SOL')) return 0.0005;
        if (['NAS100', 'US30', 'US500', 'GER40'].includes(symbol)) return 0.0001;
        return 0.00008; // Forex padrão
    }

    private static getDecimals(symbol: string): number {
        if (symbol.includes('JPY')) return 3;
        if (symbol.includes('XAU')) return 2;
        if (symbol.includes('XAG')) return 3;
        if (['BTCUSD', 'ETHUSD', 'SOLUSD'].includes(symbol)) return 2;
        if (['NAS100', 'US30', 'US500', 'GER40'].includes(symbol)) return 1;
        return 5;
    }
}
