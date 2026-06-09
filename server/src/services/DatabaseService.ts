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
        asset?: string; volumePower?: number; timeframe?: string; category?: string;
        isInstitutional?: boolean; details?: string;
    }) {
        return prisma.signal.create({
            data: {
                symbol: signal.symbol, setup: signal.setup, type: signal.type,
                confidence: signal.confidence, entryPrice: signal.entryPrice,
                sl: signal.sl, tp: signal.tp, strategy: signal.strategy, engine: signal.engine,
                asset: signal.asset, volumePower: signal.volumePower,
                timeframe: signal.timeframe, category: signal.category,
                isInstitutional: signal.isInstitutional || false, details: signal.details,
                status: 'active'
            }
        });
    }

    static async saveSignalBatch(signals: {
        symbol: string; asset?: string; setup: string; type: string; confidence: number;
        entryPrice?: number; sl?: number; tp?: number; volumePower?: number;
        timeframe?: string; category?: string; isInstitutional?: boolean; details?: string;
    }[]) {
        if (!signals.length) return 0;
        const created = await prisma.$transaction(
            signals.map(s =>
                prisma.signal.create({
                    data: {
                        symbol: s.symbol, setup: s.setup, type: s.type,
                        confidence: s.confidence, entryPrice: s.entryPrice,
                        sl: s.sl, tp: s.tp, asset: s.asset, volumePower: s.volumePower,
                        timeframe: s.timeframe, category: s.category,
                        isInstitutional: s.isInstitutional || false, details: s.details,
                        status: 'active'
                    }
                })
            )
        );
        return created.length;
    }

    static async getActiveSignals(limit = 100) {
        return prisma.signal.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'desc' }, take: limit });
    }

    static async getSignalHistory(options: {
        symbol?: string; setup?: string; category?: string; type?: string;
        limit?: number; offset?: number; fromDate?: Date; toDate?: Date;
    } = {}) {
        const where: any = {};
        if (options.symbol) where.symbol = options.symbol;
        if (options.setup) where.setup = options.setup;
        if (options.category) where.category = options.category;
        if (options.type) where.type = options.type;
        if (options.fromDate || options.toDate) {
            where.createdAt = {};
            if (options.fromDate) where.createdAt.gte = options.fromDate;
            if (options.toDate) where.createdAt.lte = options.toDate;
        }
        const [signals, total] = await Promise.all([
            prisma.signal.findMany({
                where, orderBy: { createdAt: 'desc' },
                take: options.limit || 100,
                skip: options.offset || 0,
            }),
            prisma.signal.count({ where }),
        ]);
        return { signals, total };
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

    static async saveBacktest(data: {
        jobId: string; strategy: string; symbol?: string; timeframe?: string;
        initialCapital: number; finalBalance: number; totalTrades: number;
        winTrades: number; lossTrades: number; winRate: number;
        totalPnl: number; totalReturn: number; profitFactor: number;
        maxDrawdown: number; config?: any; status?: string; error?: string;
    }) {
        return prisma.backtestRun.upsert({
            where: { jobId: data.jobId },
            update: { ...data, config: JSON.stringify(data.config || {}) },
            create: { ...data, config: JSON.stringify(data.config || {}) },
        });
    }

    static async getBacktestHistory(limit = 20) {
        return prisma.backtestRun.findMany({ orderBy: { runAt: 'desc' }, take: limit });
    }

    static async getBacktestByJobId(jobId: string) {
        return prisma.backtestRun.findUnique({ where: { jobId } });
    }

    static async saveHistoricalBars(bars: {
        symbol: string; timeframe: string; time: Date;
        open: number; high: number; low: number; close: number; volume: number;
        tickVolume?: number; spread?: number; source?: string;
    }[]) {
        if (!bars.length) return 0;
        const created = await prisma.$transaction(
            bars.map(bar =>
                prisma.historicalBar.upsert({
                    where: {
                        symbol_timeframe_time: {
                            symbol: bar.symbol,
                            timeframe: bar.timeframe,
                            time: bar.time,
                        }
                    },
                    update: {
                        open: bar.open, high: bar.high, low: bar.low,
                        close: bar.close, volume: bar.volume,
                        tickVolume: bar.tickVolume, spread: bar.spread, source: bar.source,
                    },
                    create: {
                        symbol: bar.symbol, timeframe: bar.timeframe, time: bar.time,
                        open: bar.open, high: bar.high, low: bar.low,
                        close: bar.close, volume: bar.volume,
                        tickVolume: bar.tickVolume, spread: bar.spread, source: bar.source,
                    },
                })
            )
        );
        return created.length;
    }

    static async getHistoricalBars(symbol: string, timeframe: string, limit = 500, offset = 0) {
        return prisma.historicalBar.findMany({
            where: { symbol, timeframe },
            orderBy: { time: 'asc' },
            take: limit,
            skip: offset,
        });
    }

    static async disconnect() {
        await prisma.$disconnect();
    }
}
