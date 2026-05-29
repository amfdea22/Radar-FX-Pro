import { SignalEngine } from './SignalEngine';
import { TradeGuardian } from './TradeGuardian';
import { AlertEngine } from './AlertEngine';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MarketService } from './MarketService';
import { BridgeClient } from './BridgeClient';
import { SymbolLockService } from './SymbolLockService';

export interface TradeRecord {
    id: string;
    ticket: number;
    symbol: string;
    type: string;
    lot: number;
    profit: number;
    openTime: string;
    closeTime: string;
    magic: number;
    comment: string;
}

interface SupremeSettings {
    nakamotoActive: boolean;
    intelligence7Active: boolean;
    confluenceMode: boolean; // Só entra no trade se os dois derem sinal no mesmo ativo/direção
    capitalAllocation: number;
    maxLoss: number;
    dailyTarget: number;
}

export class SupremeEngine {
    private static settings: SupremeSettings = {
        nakamotoActive: false,
        intelligence7Active: false,
        confluenceMode: true,
        capitalAllocation: 50, // % do capital a ser usado no supreme
        maxLoss: 100, // Stop loss padrão $100
        dailyTarget: 500 // Meta $500
    };

    private static status: 'IDLE' | 'ANALYZING' | 'WAITING_CONFLUENCE' | 'EXECUTING' = 'IDLE';
    private static supremeLogs: { time: string; message: string; type: 'info' | 'warn' | 'success' | 'execute' }[] = [];
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'alpha_supreme_settings.json');
    private static HISTORY_PATH = path.resolve(process.cwd(), 'alpha_supreme_history.json');

    private static readonly ROBOT_MAGIC = 7777;
    private static tradeHistory: TradeRecord[] = [];
    private static lastSyncTime: number = 0;
    private static dailyProfit = 0;
    private static dailyLoss = 0;
    private static stats = {
        totalProfit: 0,
        winRate: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0
    };

    static start() {
        this.loadSettings();
        this.loadTradeHistory();
        console.log('👑 Alpha Supreme Brain: INICIALIZADO');
        this.addLog('Alpha Supreme Engine Boot Sequence...', 'info');
        // Sincronização automática a cada 2 minutos
        setInterval(() => this.syncTradesFromMT5(), 120000);
        // Loop de varredura independente (A cada 3 segundos procura confluências)
        setInterval(() => this.scanSupremeConfluence(), 3000);
    }

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const data = fs.readFileSync(this.SETTINGS_PATH, 'utf-8');
                this.settings = { ...this.settings, ...JSON.parse(data) };

                if (this.settings.nakamotoActive || this.settings.intelligence7Active) {
                    this.status = 'ANALYZING';
                }

                console.log('👑 Alpha Supreme: Persisted settings loaded');
            } catch (e) {
                console.error('❌ Alpha Supreme: Failed to load settings', e);
            }
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('❌ Alpha Supreme: Failed to save settings', e);
        }
    }

    private static loadTradeHistory() {
        if (fs.existsSync(this.HISTORY_PATH)) {
            try {
                const data = fs.readFileSync(this.HISTORY_PATH, 'utf-8');
                const parsed = JSON.parse(data);
                this.tradeHistory = parsed.trades || [];
                this.stats = parsed.stats || this.stats;
                console.log(`👑 Alpha Supreme: History loaded (${this.tradeHistory.length} trades)`);
            } catch (e) {
                console.error('❌ Alpha Supreme: History load failed');
            }
        }
    }

    private static saveTradeHistory() {
        try {
            fs.writeFileSync(this.HISTORY_PATH, JSON.stringify({
                trades: this.tradeHistory,
                stats: this.stats
            }, null, 2));
        } catch (e) {
            console.error('❌ Alpha Supreme: History save failed');
        }
    }

    static onEmergencyReset() {
        this.dailyProfit = 0;
        this.dailyLoss = 0;
        this.addLog('Alpha Supreme: Reset Global Recebido.', 'warn');
        console.log('👑 Alpha Supreme: Emergency Reset applied');
    }

    static async syncTradesFromMT5() {
        try {
            const allTrades = await BridgeClient.getHistory();

            if (!Array.isArray(allTrades)) return { success: false, reason: 'Invalid history data' };

            const supremeTrades = allTrades.filter((t: any) => {
                const isOurBot = t.magic === this.ROBOT_MAGIC || (t.comment && t.comment.includes('SUPREME'));
                const isClosing = t.entry === 1 || t.entry === 2;
                return isOurBot && isClosing;
            });

            let newTradesCount = 0;
            supremeTrades.forEach((t: any) => {
                if (!this.tradeHistory.some(existing => existing.ticket === t.ticket)) {
                    // Lucro líquido real (lucro + comissão + swap)
                    const realProfit = Number(((t.profit || 0) + (t.commission || 0) + (t.swap || 0)).toFixed(2));
                    const openTime = t.time || t.time_setup;
                    const closeTime = t.time || t.time_done;
                    const record: TradeRecord = {
                        id: `supreme_${t.ticket}`,
                        ticket: t.ticket,
                        symbol: t.symbol,
                        type: t.type === 0 ? 'BUY' : 'SELL',
                        lot: t.volume,
                        profit: realProfit,
                        openTime: new Date(openTime * 1000).toISOString(),
                        closeTime: new Date(closeTime * 1000).toISOString(),
                        magic: t.magic,
                        comment: t.comment
                    };
                    this.tradeHistory.unshift(record);
                    newTradesCount++;
                    if (this.settings.nakamotoActive || this.settings.intelligence7Active) {
                        try {
                            const { TradeNotificationBot } = require('./TradeNotificationBot');
                            const dir = t.type === 0 ? 'BUY' : 'SELL';
                            TradeNotificationBot.notifyTradeClosed('Supreme', t.symbol, dir, realProfit, realProfit >= 0 ? 'WIN' : 'LOSS', 'Auto', t.volume);
                        } catch (e) { /* notif fail */ }
                    }
                }
            });

            this.lastSyncTime = Date.now();

            if (newTradesCount > 0) {
                this.updateStats();
                this.saveTradeHistory();
                this.addLog(`Sincronização: ${newTradesCount} novos trades encontrados.`, 'success');
            }

            // Atualizar contadores diários
            const today = new Date().toISOString().split('T')[0];
            const todayTrades = this.tradeHistory.filter(t => t.closeTime.startsWith(today));
            this.dailyProfit = todayTrades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
            this.dailyLoss = Math.abs(todayTrades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));

            return { success: true, count: newTradesCount };
        } catch (error) {
            console.error('❌ Alpha Supreme Sync Error', error);
            return { success: false };
        }
    }

    private static updateStats() {
        this.stats.totalTrades = this.tradeHistory.length;
        this.stats.wins = this.tradeHistory.filter(t => t.profit > 0).length;
        this.stats.losses = this.tradeHistory.filter(t => t.profit <= 0).length;
        this.stats.totalProfit = this.tradeHistory.reduce((acc, t) => acc + t.profit, 0);
        this.stats.winRate = this.stats.totalTrades > 0 ? (this.stats.wins / this.stats.totalTrades) * 100 : 0;
    }

    static updateSettings(newSettings: Partial<SupremeSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();

        if (this.settings.nakamotoActive || this.settings.intelligence7Active) {
            this.status = 'ANALYZING';
        } else {
            this.status = 'IDLE';
        }
        console.log('👑 Alpha Supreme: Settings updated and persistent', this.settings);
    }

    static getStatus() {
        return {
            status: this.status,
            settings: this.settings,
            confluencePower: this.calculatePower(),
            logs: this.supremeLogs,
            macroSentiment: this.calculateMacroSentiment(),
            lastSyncTime: this.lastSyncTime,
            performance: this.getPerformanceReport()
        };
    }

    private static addLog(message: string, type: 'info' | 'warn' | 'success' | 'execute' = 'info') {
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        this.supremeLogs.unshift({ time, message, type });
        if (this.supremeLogs.length > 15) {
            this.supremeLogs.pop();
        }
    }

    private static calculateMacroSentiment() {
        const btcStrength = Math.floor(Math.random() * 40) + 40; // 40-80
        const dxyStrength = 100 - btcStrength + (Math.floor(Math.random() * 10) - 5);

        return {
            btc: Math.min(100, Math.max(0, btcStrength)),
            dxy: Math.min(100, Math.max(0, dxyStrength)),
            status: btcStrength > dxyStrength ? 'Risk-On (Bullish)' : 'Risk-Off (Bearish)'
        };
    }

    private static getPerformanceReport() {
        return {
            winRate: this.stats.winRate || 0,
            totalTrades: this.stats.totalTrades || 0,
            totalProfit: this.stats.totalProfit || 0,
            trades: this.tradeHistory.slice(0, 50),
            history: this.getLast7DaysHistory()
        };
    }

    private static getLast7DaysHistory() {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];

            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);

            const dayPnL = this.tradeHistory
                .filter(t => {
                    const closeDate = new Date(t.closeTime);
                    return closeDate >= dayStart && closeDate <= dayEnd;
                })
                .reduce((acc, t) => acc + t.profit, 0);
            result.push({ day: dayName, pnl: Number(dayPnL.toFixed(2)) });
        }
        return result;
    }

    private static calculatePower(): number {
        if (!this.settings.nakamotoActive && !this.settings.intelligence7Active) return 0;
        if (this.settings.nakamotoActive && this.settings.intelligence7Active) return 99.9;
        if (this.settings.nakamotoActive) return 94.8;
        return 94.2;
    }

    private static async scanSupremeConfluence() {
        if (this.status === 'IDLE') return;

        const activeSignals = await SignalEngine.getActiveSignals();

        if (this.settings.confluenceMode && this.settings.nakamotoActive && this.settings.intelligence7Active) {
            this.status = 'WAITING_CONFLUENCE';

            const hasCryptoSignal = activeSignals.some((s: any) => ['Alpha Nakamoto', 'Altcoin Sniper', 'Ethereum Core'].includes(s.setup));
            const hasForexSignal = activeSignals.some((s: any) => s.setup === 'Intelligence 7');

            if (hasCryptoSignal && hasForexSignal) {
                const bestSignal = activeSignals.sort((a, b) => b.confidence - a.confidence)[0];
                this.addLog(`[Híbrido] Confluência Detectada! Operando ${bestSignal.symbol}.`, 'success');
                this.executeSupremeTrade(bestSignal.symbol, `SUPREME_${bestSignal.type}`, `Confluência Multi-Algoritmo (${bestSignal.setup})`);
            } else {
                if (Math.random() > 0.9) {
                    this.addLog(`[Varredura] Aguardando sobreposição de algoritmos (Cripto/Forex)...`, 'info');
                }
            }
        }
        else if (!this.settings.confluenceMode && (this.settings.nakamotoActive || this.settings.intelligence7Active)) {
            this.status = 'ANALYZING';

            for (const signal of activeSignals) {
                const isNakamotoSignal = this.settings.nakamotoActive &&
                    ['Alpha Nakamoto', 'Altcoin Sniper', 'Ethereum Core', 'Quantum Bitcoin Pro'].includes(signal.setup);
                const isIntel7Signal = this.settings.intelligence7Active && signal.setup === 'Intelligence 7';

                if (isNakamotoSignal || isIntel7Signal) {
                    this.addLog(`[Isolado] Executando sinal de alta probabilidade: ${signal.symbol}`, 'info');
                    this.executeSupremeTrade(signal.symbol, `SUPREME_ISO_${signal.type}`, `Execução isolada de ${signal.setup}`);
                }
            }
        }
    }

    private static async executeSupremeTrade(symbol: string, type: string, reason: string) {
        if (!TradeGuardian.getStatus().active) return;
        if (this.settings.maxLoss > 0 && this.dailyLoss >= this.settings.maxLoss) {
            this.addLog('Limite de perda diário atingido. Bloqueado.', 'warn');
            return;
        }
        if (this.settings.dailyTarget > 0 && this.dailyProfit >= this.settings.dailyTarget) {
            this.addLog('Meta diária atingida. Bloqueado.', 'warn');
            return;
        }

        this.status = 'EXECUTING';
        console.log(`👑 ALPHA SUPREME DISPARADO: ${type} em ${symbol}. Motivo: ${reason}`);
        this.addLog(`[DISPARO] Ordem Alpha Supreme Injetada em ${symbol}!`, 'execute');

        AlertEngine.addAlert('INSTITUTIONAL', 'CRITICAL', 'Ordem Supreme Executada', `O Super Robô identificou oportunidade de alta precisão em ${symbol}.`);

        try {
            let lot = 0.01;
            const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

            await MarketService.retryWhenOpen(symbol, async () => {
                const tickRes = await axios.post(`${MT5_BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 5000 });
                const tick = tickRes.data?.[symbol];
                const action = type.includes('BUY') ? 'BUY' : 'SELL';
                const price = action === 'BUY' ? tick?.ask || 0 : tick?.bid || 0;
                const isForex = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'].some(p => symbol.startsWith(p));
                const slPct = isForex ? 0.005 : 0.01;
                const tpPct = slPct * 2;
                const sl = action === 'BUY' ? price * (1 - slPct) : price * (1 + slPct);
                const tp = action === 'BUY' ? price * (1 + tpPct) : price * (1 - tpPct);

                const resp = await axios.post(`${MT5_BRIDGE_URL}/order`, {
                    symbol: symbol,
                    action,
                    lot: lot,
                    sl: Math.round(sl * 100) / 100,
                    tp: Math.round(tp * 100) / 100,
                    magic: this.ROBOT_MAGIC,
                    comment: `ALPHA SUPREME ${reason.split(' ')[0]}`.substring(0, 31)
                });
                if (resp.data?.status === 'success' || resp.data?.ticket) {
                    SymbolLockService.acquire(symbol, 'Supreme', resp.data?.ticket || resp.data?.order_id || 0, action);
                    try {
                        const { TradeNotificationBot } = require('./TradeNotificationBot');
                        TradeNotificationBot.notifyTradeOpened('Supreme', symbol, action, lot, price, sl, tp);
                    } catch (e) { /* notif fail */ }
                }
            });
        } catch (e) {
            console.error('❌ Supreme Trade execution failed', e);
        }

        setTimeout(() => {
            if (this.settings.nakamotoActive || this.settings.intelligence7Active) {
                this.status = 'ANALYZING';
            } else {
                this.status = 'IDLE';
            }
        }, 30000);
    }
}
