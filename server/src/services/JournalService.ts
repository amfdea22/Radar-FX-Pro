import fs from 'fs';
import path from 'path';

export interface ManualTrade {
    id: string;
    category: string;
    asset: string;
    symbol: string;
    type: 'COMPRA' | 'VENDA';
    contracts: number;
    entryPrice: number;
    exitPrice: number;
    stopLoss?: number;
    capitalRiskPct?: number; // percentual arriscado
    value: number; // Resultado financeiro
    status: 'GAIN' | 'LOSS';
    timestamp: Date | string;
    followedPlan: boolean;
}

export class JournalService {
    private static DB_PATH = path.resolve(process.cwd(), 'trading_journal.json');
    private static trades: ManualTrade[] = [];

    static init() {
        if (!fs.existsSync(this.DB_PATH)) {
            this.save();
        } else {
            try {
                const data = fs.readFileSync(this.DB_PATH, 'utf-8');
                this.trades = JSON.parse(data);
            } catch (error) {
                console.error('❌ JournalService: Erro ao carregar trading_journal.json', error);
                this.trades = [];
            }
        }
    }

    private static save() {
        try {
            fs.writeFileSync(this.DB_PATH, JSON.stringify(this.trades, null, 2));
        } catch (error) {
            console.error('❌ JournalService: Erro ao salvar trading_journal.json', error);
        }
    }

    static getTrades(): ManualTrade[] {
        // Retorna ordenado pelo mais recente
        return [...this.trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    static addTrade(trade: Omit<ManualTrade, 'id' | 'timestamp'>): ManualTrade {
        const newTrade: ManualTrade = {
            ...trade,
            id: `trd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString()
        };
        this.trades.push(newTrade);
        this.save();
        return newTrade;
    }

    static deleteTrade(id: string): boolean {
        const initialLen = this.trades.length;
        this.trades = this.trades.filter(t => t.id !== id);
        if (this.trades.length !== initialLen) {
            this.save();
            return true;
        }
        return false;
    }
}

JournalService.init();
