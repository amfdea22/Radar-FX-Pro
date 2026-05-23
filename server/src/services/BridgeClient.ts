import axios from 'axios';

export class BridgeClient {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    /**
     * Busca o histórico do MT5 e normaliza todos os timestamps para segundos.
     */
    static async getHistory(): Promise<any[]> {
        try {
            const response = await axios.get(`${this.BRIDGE_URL}/history?t=${Date.now()}`, { timeout: 60000 });
            const data = response.data;

            if (!Array.isArray(data)) return [];

            return data.map(trade => ({
                ...trade,
                time: this.normalizeTime(trade.time || trade.time_done || trade.time_setup)
            }));
        } catch (error) {
            console.error('❌ BridgeClient Error:', error);
            throw error;
        }
    }

    /**
     * Normaliza um timestamp para o formato de segundos (10 dígitos).
     */
    static normalizeTime(t: any): number {
        const val = Number(t);
        if (isNaN(val) || val === 0) return 0;
        // Se for maior que 10^12, provavelmente são milissegundos (13 dígitos)
        return val > 100000000000 ? Math.floor(val / 1000) : val;
    }

    /**
     * Retorna o timestamp atual do servidor em segundos.
     */
    static getServerTime(): number {
        return Math.floor(Date.now() / 1000);
    }
}
