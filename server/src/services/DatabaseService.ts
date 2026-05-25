import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DatabaseService {

    static async saveTrade(trade: {
        ticket: number; symbol: string; direction: string; volume: number;
        priceOpen: number; sl?: number; tp?: number; magic: number; comment?: string;
        strategy?: string; engine?: string;
    }) {
        return prisma.trade.upsert({
            where: { ticket: trade.ticket },
            update: { closeTime: new Date(), ...trade },
            create: { ...trade, openTime: new Date() },
        });
    }

    static async getTrades(options?: { strategy?: string; symbol?: string; limit?: number; offset?: number }) {
        const where: any = {};
        if (options?.strategy) where.strategy = options.strategy;
        if (options?.symbol) where.symbol = options.symbol;
        return prisma.trade.findMany({
            where, orderBy: { createdAt: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0,
        });
    }

    static async getTradeStats(strategy?: string) {
        const where: any = {};
        if (strategy) where.strategy = strategy;
        const trades = await prisma.trade.findMany({ where, select: { profit: true, strategy: true } });
        const wins = trades.filter(t => (t.profit || 0) > 0).length;
        const losses = trades.filter(t => (t.profit || 0) < 0).length;
        const total = trades.length;
        return {
            total, wins, losses,
            winRate: total > 0 ? (wins / total) * 100 : 0,
            grossProfit: trades.filter(t => (t.profit || 0) > 0).reduce((s, t) => s + (t.profit || 0), 0),
            grossLoss: trades.filter(t => (t.profit || 0) < 0).reduce((s, t) => s + Math.abs(t.profit || 0), 0),
            netProfit: trades.reduce((s, t) => s + (t.profit || 0), 0),
        };
    }

    static async saveSignal(signal: {
        symbol: string; setup: string; type: string; confidence: number;
        entryPrice?: number; sl?: number; tp?: number; strategy?: string; engine?: string;
    }) {
        return prisma.signal.create({ data: { ...signal, status: 'active' } });
    }

    static async getActiveSignals() {
        return prisma.signal.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'desc' } });
    }

    static async closeSignal(id: number) {
        return prisma.signal.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } });
    }

    static async getSetting(key: string): Promise<string | null> {
        const entry = await prisma.setting.findUnique({ where: { key } });
        return entry?.value || null;
    }

    static async setSetting(key: string, value: string) {
        return prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    static async saveAlert(alert: { type: string; severity: string; source: string; message: string; symbol?: string }) {
        return prisma.alert.create({ data: alert });
    }

    static async getAlerts(limit = 50) {
        return prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    }

    static async getStrategyStats(name: string) {
        return prisma.strategyStats.findUnique({ where: { name } });
    }

    static async upsertStrategyStats(name: string, data: {
        category?: string; winRate?: number; totalTrades?: number;
        wins?: number; losses?: number; netProfit?: number;
    }) {
        return prisma.strategyStats.upsert({
            where: { name },
            update: data,
            create: { name, ...data },
        });
    }

    static async migrateFromJson(engineName: string, trades: any[]) {
        for (const t of trades) {
            await this.saveTrade({
                ticket: t.ticket || Math.floor(Math.random() * 999999999),
                symbol: t.symbol || 'UNKNOWN',
                direction: t.type || t.direction || 'BUY',
                volume: t.volume || t.lots || 0.01,
                priceOpen: t.price || t.price_open || 0,
                sl: t.sl,
                tp: t.tp,
                magic: t.magic || 0,
                comment: t.comment,
                strategy: engineName,
                engine: engineName,
            });
        }
        console.log(`📦 DatabaseService: ${trades.length} trades migrados para ${engineName}`);
    }

    static async disconnect() {
        await prisma.$disconnect();
    }
}
