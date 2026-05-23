import axios from 'axios';

export interface MarketStatus {
    isOpen: boolean;
    symbol: string;
    tradeMode?: number;
}

export class MarketService {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static cache: Record<string, { status: MarketStatus, timestamp: number }> = {};
    private static marketClosedCooldowns: Record<string, number> = {};
    private static CACHE_TTL = 30000; // 30 segundos de cache para status de mercado
    private static CLOSED_COOLDOWN = 300000; // 5 minutos de cooldown se o mercado estiver fechado (Error 10018)

    /**
     * Verifica se o mercado está em cooldown por fechamento (Error 10018)
     */
    static async isMarketTemporarilyClosed(symbol: string): Promise<boolean> {
        const cooldown = this.marketClosedCooldowns[symbol];
        if (cooldown && (Date.now() < cooldown)) {
            return true;
        }
        return false;
    }

    /**
     * Verifica se o mercado está aberto para um determinado símbolo
     */
    static async isMarketOpen(symbol: string): Promise<boolean> {
        if (await this.isMarketTemporarilyClosed(symbol)) return false;

        const now = Date.now();
        if (this.cache[symbol] && (now - this.cache[symbol].timestamp < this.CACHE_TTL)) {
            return this.cache[symbol].status.isOpen;
        }

        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 3000 });
            const data = resp.data?.[symbol];

            const isOpen = !!(data && data.is_open !== false && data.trade_mode !== 0);

            this.cache[symbol] = {
                status: { isOpen, symbol, tradeMode: data?.trade_mode },
                timestamp: now
            };

            return isOpen;
        } catch (error) {
            console.log(`⚠️ MarketService: Failed to check status for ${symbol}. Assuming open.`);
            return true; // Falha na verificação, assume aberto para não travar
        }
    }

    /**
     * Executa uma função com retentativa caso o mercado esteja fechado
     */
    static async retryWhenOpen<T>(symbol: string, action: () => Promise<T>, maxAttempts = 3): Promise<T> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (await this.isMarketTemporarilyClosed(symbol)) {
                throw new Error(`❌ MarketService: Cooldown ativo para ${symbol}. Mercado permanece fechado.`);
            }

            const isOpen = await this.isMarketOpen(symbol);
            if (isOpen) {
                try {
                    return await action();
                } catch (error: any) {
                    const errMsg = String(error.response?.data?.error || error.response?.data?.comment || error.message || '');
                    if (errMsg.includes('10018') || errMsg.toLowerCase().includes('market closed')) {
                        console.log(`🔄 MarketService: Market closed (10018) detected for ${symbol}. Setting 5min cooldown.`);
                        this.marketClosedCooldowns[symbol] = Date.now() + this.CLOSED_COOLDOWN;
                        throw new Error(`❌ MarketService: Mercado fechado para ${symbol}. Cooldown ativado.`);
                    } else {
                        throw error; // Outro erro, não tenta novamente aqui
                    }
                }
            }

            if (attempt < maxAttempts) {
                const delay = attempt * 5000; // 5s, 10s...
                console.log(`⏳ MarketService: Market closed for ${symbol}. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // Limpa cache para forçar nova verificação
                delete this.cache[symbol];
            }
        }

        throw new Error(`❌ MarketService: Max attempts reached for ${symbol}. Market remains closed.`);
    }
}
