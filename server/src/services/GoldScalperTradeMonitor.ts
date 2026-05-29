import axios from 'axios';
import { GoldScalperEngine } from './GoldScalperEngine';

interface PositionSnapshot {
    ticket: number;
    type: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    currentPrice: number;
    sl: number;
    tp: number;
    profit: number;
    gridLevel: number;
    openTime: string;
    duration: string;
    hasPartialClose: boolean;
    trailingActive: boolean;
    watermark: number;
}

interface PositionEvent {
    time: string;
    ticket: number;
    type: 'OPENED' | 'PARTIAL_CLOSE' | 'TRAILING_UPDATE' | 'BREAKEVEN' | 'CLOSED';
    details: string;
    profit?: number;
}

interface MonitorData {
    summary: {
        openPositions: number;
        totalVolume: number;
        floatingPL: number;
        dailyTrades: number;
        dailyProfit: number;
        dailyLoss: number;
        gridLevelsUsed: number;
    };
    positions: PositionSnapshot[];
    events: PositionEvent[];
}

export class GoldScalperTradeMonitor {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 9999;
    private static events: PositionEvent[] = [];
    private static MAX_EVENTS = 200;
    private static previousTickets: Set<number> = new Set();
    private static tickData: Record<number, { profit: number; sl: number; tp: number; price: number }> = {};
    private static isRunning = false;

    static start(intervalMs = 3000) {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('📊 GoldScalperTradeMonitor: Iniciado (polling a cada ' + intervalMs + 'ms)');
        const poll = async () => {
            try {
                await this.pollPositions();
            } catch { /* silently retry next cycle */ }
            if (this.isRunning) setTimeout(poll, intervalMs);
        };
        setTimeout(poll, 1000);
    }

    static stop() {
        this.isRunning = false;
        console.log('📊 GoldScalperTradeMonitor: Parado');
    }

    private static async pollPositions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const all: any[] = Array.isArray(resp.data) ? resp.data : [];
            const goldPositions = all.filter(
                (p: any) => p.magic === this.MAGIC && p.symbol?.toUpperCase().includes('XAU')
            );

            const currentTickets = new Set(goldPositions.map(p => p.ticket));

            // Detecta novas posições abertas
            for (const pos of goldPositions) {
                if (!this.previousTickets.has(pos.ticket)) {
                    this.addEvent({
                        ticket: pos.ticket,
                        type: 'OPENED',
                        details: `${pos.type === 0 ? 'BUY' : 'SELL'} ${pos.volume} lote${pos.volume > 1 ? 's' : ''} a $${pos.price_open?.toFixed(2)}`,
                    });
                }
                this.tickData[pos.ticket] = {
                    profit: pos.profit,
                    sl: pos.sl,
                    tp: pos.tp,
                    price: pos.price_current,
                };
            }

            // Detecta posições fechadas
            const closedTickets = [...this.previousTickets].filter(t => !currentTickets.has(t));
            for (const ticket of closedTickets) {
                const prev = this.tickData[ticket];
                try {
                    const hist = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 5000 });
                    const trades: any[] = Array.isArray(hist.data) ? hist.data : [];
                    const closed = trades.find((t: any) => t.ticket === ticket || t.order === ticket);
                    const profit = closed ? (closed.profit || 0) + (closed.commission || 0) + (closed.swap || 0) : (prev?.profit || 0);
                    this.addEvent({
                        ticket,
                        type: 'CLOSED',
                        details: closed ? `Fechado em $${closed.price?.toFixed(2) || '?'} | Resultado: ${profit >= 0 ? 'WIN' : 'LOSS'}` : 'Fechado',
                        profit: Math.round(profit * 100) / 100,
                    });
                } catch {
                    this.addEvent({ ticket, type: 'CLOSED', details: 'Fechado (profit não disponível)', profit: prev?.profit });
                }
                delete this.tickData[ticket];
            }

            // Detecta mudanças em posições existentes (trailing, breakeven, parcial)
            for (const pos of goldPositions) {
                const prev = this.tickData[pos.ticket];
                if (prev) {
                    if (pos.sl !== prev.sl) {
                        if (pos.sl > prev.sl || pos.sl < prev.sl) {
                            const label = pos.sl >= pos.price_open ? 'Breakeven' : 'Trailing';
                            this.addEvent({
                                ticket: pos.ticket,
                                type: pos.sl >= pos.price_open ? 'BREAKEVEN' : 'TRAILING_UPDATE',
                                details: `${label}: SL movido de $${prev.sl?.toFixed(2)} → $${pos.sl?.toFixed(2)}`,
                            });
                        }
                    }
                }
            }

            this.previousTickets = currentTickets;
        } catch { /* bridge unavailable */ }
    }

    static getMonitorData(): MonitorData {
        const summary = this.calcSummary();
        return {
            summary,
            positions: [], // populated by refresh()
            events: this.events.slice(-this.MAX_EVENTS),
        };
    }

    static async refresh(): Promise<MonitorData> {
        try {
            const [posRes, status] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/positions`),
                GoldScalperEngine.getStatus(),
            ]);
            const allPositions: any[] = Array.isArray(posRes.data) ? posRes.data : [];
            const goldPositions = allPositions.filter(
                (p: any) => p.magic === this.MAGIC && p.symbol?.toUpperCase().includes('XAU')
            );

            const positions: PositionSnapshot[] = goldPositions.map((p: any) => ({
                ticket: p.ticket,
                type: p.type === 0 ? 'BUY' : 'SELL',
                volume: p.volume,
                entryPrice: p.price_open,
                currentPrice: p.price_current,
                sl: p.sl,
                tp: p.tp,
                profit: p.profit,
                gridLevel: this.detectGridLevel(p),
                openTime: p.time ? new Date((p.time > 100000000000 ? p.time : p.time * 1000)).toISOString() : '',
                duration: this.calcDuration(p.time),
                hasPartialClose: false,
                trailingActive: false,
                watermark: 0,
            }));

            return {
                summary: {
                    openPositions: positions.length,
                    totalVolume: positions.reduce((s, p) => s + p.volume, 0),
                    floatingPL: Number(positions.reduce((s, p) => s + p.profit, 0).toFixed(2)),
                    dailyTrades: status.report?.totalTrades || 0,
                    dailyProfit: status.dailyProfit || 0,
                    dailyLoss: status.dailyLoss || 0,
                    gridLevelsUsed: positions.length,
                },
                positions,
                events: this.events.slice(-this.MAX_EVENTS),
            };
        } catch {
            return {
                summary: { openPositions: 0, totalVolume: 0, floatingPL: 0, dailyTrades: 0, dailyProfit: 0, dailyLoss: 0, gridLevelsUsed: 0 },
                positions: [],
                events: this.events.slice(-this.MAX_EVENTS),
            };
        }
    }

    private static addEvent(event: Omit<PositionEvent, 'time'>) {
        this.events.push({ ...event, time: new Date().toISOString() });
        if (this.events.length > this.MAX_EVENTS * 2) {
            this.events = this.events.slice(-this.MAX_EVENTS);
        }
    }

    private static calcSummary() {
        return { openPositions: 0, totalVolume: 0, floatingPL: 0, dailyTrades: 0, dailyProfit: 0, dailyLoss: 0, gridLevelsUsed: 0 };
    }

    private static detectGridLevel(pos: any): number {
        const comment = pos.comment || '';
        const match = comment.match(/Grid\s*(\d+)/i);
        if (match) return parseInt(match[1], 10);
        return 1;
    }

    private static calcDuration(openTimestamp: number): string {
        if (!openTimestamp) return '';
        const ms = openTimestamp > 100000000000 ? openTimestamp : openTimestamp * 1000;
        const elapsed = Date.now() - ms;
        if (elapsed < 0) return '0m';
        const mins = Math.floor(elapsed / 60000);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
    }
}
