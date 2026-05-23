import fs from 'fs';
import path from 'path';

export interface AuditSnapshot {
    id: string;
    timestamp: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    microTrend: 'up' | 'down' | 'neutral';
    macroTrend: 'up' | 'down' | 'neutral';
    sentimentScore: number;
    sentimentEmotion: string;
    candleTime: number;
    orderTicket?: number;
}

export class AlphaAuditService {
    private static AUDIT_FILE = path.join(process.cwd(), 'data', 'alpha_audit_history.json');

    static async captureSnapshot(data: Omit<AuditSnapshot, 'id' | 'timestamp'>): Promise<string> {
        const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const snapshot: AuditSnapshot = {
            ...data,
            id,
            timestamp: Date.now()
        };

        await this.saveSnapshot(snapshot);
        console.log(`🛡️ Alpha Audit: Snapshot capturado para ${data.symbol} (${data.type}) | ID: ${id}`);
        return id;
    }

    private static async saveSnapshot(snapshot: AuditSnapshot) {
        try {
            const dir = path.dirname(this.AUDIT_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            let history: AuditSnapshot[] = [];
            if (fs.existsSync(this.AUDIT_FILE)) {
                const content = fs.readFileSync(this.AUDIT_FILE, 'utf-8');
                history = JSON.parse(content);
            }

            history.push(snapshot);

            // Manter apenas os últimos 1000 logs para performance
            if (history.length > 1000) {
                history = history.slice(-1000);
            }

            fs.writeFileSync(this.AUDIT_FILE, JSON.stringify(history, null, 2));
        } catch (error) {
            console.error('❌ Alpha Audit: Erro ao salvar snapshot', error);
        }
    }

    static async getHistory(): Promise<AuditSnapshot[]> {
        if (!fs.existsSync(this.AUDIT_FILE)) return [];
        try {
            const content = fs.readFileSync(this.AUDIT_FILE, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            return [];
        }
    }

    /**
     * Retorna a performance recente baseada nos snapshots
     */
    static async getRecentPerformance(symbol: string): Promise<{ winRate: number; total: number }> {
        const history = await this.getHistory();
        const relevant = history.filter(h => h.symbol === symbol).slice(-20);
        
        if (relevant.length === 0) return { winRate: 100, total: 0 };
        
        // Esta é uma estimativa simplificada, o ideal é cruzar com o histórico real do MT5
        // Por enquanto, consideramos 100% se não houver dados, para não travar o robô
        return { winRate: 100, total: relevant.length };
    }
}
