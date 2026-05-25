import axios from 'axios';
import { SignalEngine, TradingSignal } from './SignalEngine';
import { AlertEngine } from './AlertEngine';
import { DisciplineEngine } from './DisciplineEngine';
import { SentimentService } from './SentimentService';
import { MarketService } from './MarketService';
import { SymbolLockService } from './SymbolLockService';

export class CopyTraderEngine {
    private static isRunning = false;
    private static processedSignals = new Set<string>();
    private static activeMasterId: string | null = null;
    private static defaultLot = 0.01;
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    static start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('📡 CopyTrader Engine: Institutional Replication ACTIVE');

        // Loop de monitoramento de sinais (a cada 7 segundos para não sobrecarregar)
        setInterval(() => this.processCycle(), 7000);
    }

    static followMaster(id: string | null) {
        this.activeMasterId = id;
        console.log(`📡 CopyTrader: Now following Master ID: ${id || 'NONE'}`);
    }

    static getStatus() {
        return {
            activeMasterId: this.activeMasterId,
            processedCount: this.processedSignals.size
        };
    }

    private static async processCycle() {
        if (!this.activeMasterId) return;

        try {
            // 1. Verificar restrições de disciplina
            const discipline = await DisciplineEngine.getDailyStatus();
            if (discipline.isLocked) {
                console.warn('📡 CopyTrader: Safety Lock active. Skipping replication.');
                return;
            }

            // 2. Buscar sinais ativos
            const signals = await SignalEngine.getActiveSignals();

            for (const signal of signals) {
                if (this.processedSignals.has(signal.id)) continue;

                // 3. Buscar sentimento institucional para este símbolo
                const sentiment = await SentimentService.getInstitutionalSentiment(signal.symbol);

                // 4. Lógica de filtro baseada no Master selecionado e Sentimento Real
                if (sentiment && await this.isMasterSignal(signal, sentiment)) {
                    await this.executeReplication(signal);
                }
            }
        } catch (error) {
            console.error('❌ CopyTrader: Cycle Error', error);
        }
    }

    private static async isMasterSignal(signal: TradingSignal, sentiment: any): Promise<boolean> {
        switch (this.activeMasterId) {
            case '1': // Jim Simons: Foco em Pure Quant & Alta Confiança
                return signal.confidence >= 91;

            case '2': // George Soros: Global Macro - Segue o viés institucional forte
                const matchesBias = (signal.type === 'BUY' && sentiment.institutionalBias === 'BULLISH') ||
                    (signal.type === 'SELL' && sentiment.institutionalBias === 'BEARISH');
                return matchesBias && signal.confidence >= 80;

            case '3': // Ray Dalio: Estabilidade - Confiança equilibrada + Sentimento Médio
                return signal.confidence >= 85 && sentiment.strength > 50;

            case 'c1': // Alpha Nakamoto: Foco BTC/ETH com altíssima confiança
                const isMajorCrypto = ['BTCUSD', 'ETHUSD'].includes(signal.symbol);
                return isMajorCrypto && signal.confidence >= 90;

            case 'c2': // Altcoin Sniper: Foco em Altcoins Voláteis e pullbacks (Breakout/Squeeze)
                const isAltcoin = !['BTCUSD', 'ETHUSD'].includes(signal.symbol) && ['SOLUSD', 'XRPUSD', 'ADAUSD', 'BNBUSD', 'DOGEUSD'].includes(signal.symbol);
                const isVolSetup = ['Breakout Flash', 'Momentum Exhaustion', 'Squeeze Breakout', 'Breakout'].includes(signal.setup);
                return isAltcoin && isVolSetup && signal.confidence >= 85;

            default:
                return false;
        }
    }

    private static getValidLot(symbol: string): number {
        const s = symbol.toUpperCase();
        // Índices: lote mínimo geralmente 1.0
        if (['NAS100', 'US30', 'US500', 'GER40', 'UK100', 'JPN225'].some(idx => s.includes(idx))) return 1.0;
        // Crypto: lote mínimo geralmente 0.01
        if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'].some(c => s.includes(c))) return 0.01;
        // Ouro/Prata: 0.01
        if (s.includes('XAU') || s.includes('XAG')) return 0.01;
        // Forex padrão: 0.01
        return 0.01;
    }

    private static async executeReplication(signal: TradingSignal) {
        try {
            const masterMap: Record<string, string> = {
                '1': 'Jim Simons',
                '2': 'George Soros',
                '3': 'Ray Dalio',
                'c1': 'Alpha Nakamoto',
                'c2': 'Altcoin Sniper'
            };
            const masterName = masterMap[this.activeMasterId || ''] || 'Unknown Master';
            const lot = this.getValidLot(signal.symbol);
            console.log(`📡 CopyTrader: Replicating trade from ${masterName} for ${signal.symbol} (lot: ${lot})`);

            // Executar com retry inteligente via MarketService
            const orderResult = await MarketService.retryWhenOpen(signal.symbol, async () => {
                const response = await axios.post(`${this.BRIDGE_URL}/order`, {
                    symbol: signal.symbol,
                    action: signal.type,
                    lot: lot,
                    sl: signal.sl,
                    tp: signal.tp,
                    comment: `CopyTrader | ${masterName} Replication`.substring(0, 31)
                });
                return response.data;
            });

            if (orderResult && (orderResult.status === 'success' || orderResult.order_id)) {
                const ticket = orderResult.ticket || orderResult.order_id || 0;
                SymbolLockService.acquire(signal.symbol, 'Copy Trader', ticket, signal.type);
                this.processedSignals.add(signal.id);
                AlertEngine.addAlert('GUARDIAN', 'INFO', `Cópia Executada: ${masterName}`, `${signal.symbol}: ${signal.type} replicado com sucesso.`);
            }
        } catch (error: any) {
            console.error(`❌ CopyTrader: Replication failed for ${signal.symbol}`, error.message);
        }
    }
}
