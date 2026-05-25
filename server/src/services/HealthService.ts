import axios from 'axios';
import { SymbolLockService } from './SymbolLockService';

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

interface ComponentStatus {
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    port?: number;
    uptime?: number;
    details?: string;
    lastCheck: string;
}

export class HealthService {
    private static startTime = Date.now();
    private static cache: { data: any; timestamp: number } | null = null;
    private static readonly CACHE_TTL = 10000;

    static async getFullReport() {
        if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
            return this.cache.data;
        }

        const components: ComponentStatus[] = [];
        const checks = await Promise.allSettled([
            this.checkBridge(),
            this.checkServer(),
            this.checkEngines(),
            this.checkLocks(),
        ]);

        for (const result of checks) {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (Array.isArray(data)) components.push(...data);
                else components.push(data);
            }
        }

        const allHealthy = components.every(c => c.status === 'healthy');
        const hasDown = components.some(c => c.status === 'down');
        const overallStatus = allHealthy ? 'healthy' : hasDown ? 'down' : 'degraded';

        const report = {
            server: {
                name: 'Radar-FX API',
                version: '1.1',
                status: overallStatus,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
                startedAt: new Date(this.startTime).toISOString(),
                now: new Date().toISOString(),
            },
            components,
            locks: SymbolLockService.getAllLocks().map(l => ({
                symbol: l.symbol,
                engine: l.engineName,
                ticket: l.ticket,
                direction: l.direction,
                acquiredAt: new Date(l.acquiredAt).toISOString(),
            })),
            summary: {
                total: components.length,
                healthy: components.filter(c => c.status === 'healthy').length,
                degraded: components.filter(c => c.status === 'degraded').length,
                down: components.filter(c => c.status === 'down').length,
            },
        };

        this.cache = { data: report, timestamp: Date.now() };
        return report;
    }

    private static async checkBridge(): Promise<ComponentStatus> {
        try {
            const resp = await axios.get(`${BRIDGE_URL}/health`, { timeout: 3000 });
            if (resp.data?.status === 'connected') {
                return { name: 'MT5 Bridge', status: 'healthy', port: 5555, details: `${resp.data.server} (conta ${resp.data.account})`, lastCheck: new Date().toISOString() };
            }
            return { name: 'MT5 Bridge', status: 'degraded', port: 5555, details: 'Bridge respondendo mas não conectada ao terminal', lastCheck: new Date().toISOString() };
        } catch {
            return { name: 'MT5 Bridge', status: 'down', port: 5555, details: 'Sem resposta na porta 5555', lastCheck: new Date().toISOString() };
        }
    }

    private static async checkServer(): Promise<ComponentStatus[]> {
        const results: ComponentStatus[] = [];
        try {
            const resp = await axios.get(`${BRIDGE_URL}/account`, { timeout: 3000 });
            const balance = parseFloat(resp.data?.balance || '0');
            const equity = parseFloat(resp.data?.equity || '0');
            const margin = parseFloat(resp.data?.margin || '0');
            const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;
            results.push({
                name: 'MT5 Account', status: balance > 0 ? 'healthy' : 'degraded', details: `Balance: $${balance.toFixed(2)} | Equity: $${equity.toFixed(2)} | MarginLevel: ${marginLevel.toFixed(1)}%`, lastCheck: new Date().toISOString(),
            });
        } catch {
            results.push({ name: 'MT5 Account', status: 'down', details: 'Não foi possível obter dados da conta', lastCheck: new Date().toISOString() });
        }
        return results;
    }

    private static async checkEngines(): Promise<ComponentStatus[]> {
        const engines = [
            { name: 'Alpha Robot', url: '/api/mt5/robot/status', port: 3015 },
            { name: 'Gold Scalper', url: '/api/mt5/gold-scalper/status', port: 3015 },
            { name: 'Shark Bot', url: '/api/mt5/shark-bot/status', port: 3015 },
            { name: 'Supreme Engine', url: '/api/mt5/supreme/status', port: 3015 },
            { name: 'Swing Trader', url: '/api/mt5/swing-trader/status', port: 3015 },
            { name: 'Speed Scalper', url: '/api/mt5/forex-scalper/status', port: 3015 },
            { name: 'Micro Sniper', url: '/api/mt5/micro-scalper/status', port: 3015 },
            { name: 'Bitcoin Pro', url: '/api/mt5/bitcoin-pro/status', port: 3015 },
            { name: 'Crypto IA', url: '/api/mt5/crypto-ia/status', port: 3015 },
            { name: 'Omni Prob', url: '/api/mt5/omni/status', port: 3015 },
            { name: 'Recovery Engine', url: '/api/mt5/recovery/status', port: 3015 },
        ];

        const baseUrl = `http://127.0.0.1:3015`;
        const results: ComponentStatus[] = [];

        for (const engine of engines) {
            try {
                const resp = await axios.get(`${baseUrl}${engine.url}`, { timeout: 2000 });
                const enabled = resp.data?.settings?.enabled ?? resp.data?.enabled ?? false;
                results.push({
                    name: engine.name, status: enabled ? 'healthy' : 'degraded', details: enabled ? 'Ativo' : 'Inativo', lastCheck: new Date().toISOString(),
                });
            } catch {
                results.push({ name: engine.name, status: 'degraded', details: 'Sem resposta', lastCheck: new Date().toISOString() });
            }
        }
        return results;
    }

    private static async checkLocks(): Promise<ComponentStatus> {
        const locks = SymbolLockService.getAllLocks();
        return {
            name: 'Symbol Lock Service', status: 'healthy', details: `${locks.length} lock(s) ativo(s)`, lastCheck: new Date().toISOString(),
        };
    }
}
