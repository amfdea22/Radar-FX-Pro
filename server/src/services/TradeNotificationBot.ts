import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TelegramService } from './TelegramService';
import { AlertEngine } from './AlertEngine';
import { MAGIC_MAP, getEngineName } from './MagicMap';
import { escapeHtml, replyWithSplit, formatSparkline } from './MessageFormatter';
import { BotSessionManager } from './BotSessionManager';

interface BotSettings {
    enabled: boolean;
    notifyTradeOpen: boolean;
    notifyTradeClose: boolean;
    notifyDailySummary: boolean;
    notifyRiskAlerts: boolean;
    dailySummaryHour: number;
    dailySummaryMinute: number;
}

interface SeenTrade {
    ticket: number;
    engine: string;
}

interface EngineInfo {
    id: string;
    name: string;
    emoji: string;
    symbol?: string;
    statusUrl?: string;
}

interface EngineStatusResult {
    name: string;
    emoji: string;
    enabled: boolean | null;
    dailyProfit: number;
    openPositions: number;
    winRate: number | null;
    totalTrades: number | null;
    symbol?: string;
    lastResults?: string[];
}

const PORT = process.env.PORT || 3015;
const ADMIN_IDS_ENV = process.env.TELEGRAM_ADMIN_IDS || '';

const ENGINES: EngineInfo[] = [
    { id: 'gold-scalper', name: 'Gold Scalper', emoji: '🥇', symbol: 'XAUUSD' },
    { id: 'micro-scalper', name: 'Micro Sniper', emoji: '🎯', symbol: 'BTCUSD' },
    { id: 'forex-scalper', name: 'Speed Scalper', emoji: '⚡', symbol: 'EURUSD/GBPUSD' },
    { id: 'swing-trader', name: 'Swing IA', emoji: '🌊' },
    { id: 'robot', name: 'Alpha Robot', emoji: '🤖' },
    { id: 'supreme', name: 'Supreme', emoji: '👑' },
    { id: 'bitcoin-pro', name: 'Bitcoin Pro', emoji: '₿' },
    { id: 'shark-bot', name: 'Shark Bot', emoji: '🦈' },
    { id: 'crypto-ia', name: 'Crypto IA', emoji: '🔮' },
    { id: 'omni', name: 'Omni Probabilistic', emoji: '🧠' },
    { id: 'motor-ia', name: 'Motor IA', emoji: '🧠' },
    { id: 'agent-ia', name: 'Agent IA', emoji: '🤖', statusUrl: '/api/agent-ia/status' },
    { id: 'recovery', name: 'Recovery Engine', emoji: '🔄' },
    { id: 'guardian', name: 'Trade Guardian', emoji: '🛡️' },
    { id: 'copy-trader', name: 'CopyTrader', emoji: '📋' },
];

const REPORT_ENGINES = [
    { id: 'gold-scalper', name: 'Gold Scalper', reportUrl: '/api/mt5/gold-scalper/report', symbol: 'XAUUSD' },
    { id: 'robot', name: 'Alpha Robot', reportUrl: '/api/mt5/robot/report', symbol: '' },
    { id: 'supreme', name: 'Supreme', reportUrl: '/api/mt5/supreme/report', symbol: '' },
    { id: 'motor-ia', name: 'Motor IA', reportUrl: '/api/mt5/motor-ia/status', symbol: '' },
    { id: 'recovery', name: 'Recovery Engine', reportUrl: '/api/mt5/recovery/status', symbol: '' },
];

const ENGINE_MENU_ORDER = ['gold-scalper', 'micro-scalper', 'forex-scalper', 'swing-trader', 'robot', 'supreme', 'bitcoin-pro', 'shark-bot', 'crypto-ia', 'omni', 'motor-ia', 'agent-ia', 'recovery', 'guardian', 'copy-trader'];

export class TradeNotificationBot {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'bot_settings.json');
    private static SEEN_TRADES_PATH = path.resolve(process.cwd(), 'seen_trades.json');
    private static settings: BotSettings = {
        enabled: false,
        notifyTradeOpen: false,
        notifyTradeClose: false,
        notifyDailySummary: true,
        notifyRiskAlerts: false,
        dailySummaryHour: 18,
        dailySummaryMinute: 0,
    };
    private static seenTrades: SeenTrade[] = [];
    private static allowedChatIds: Set<string> = new Set();
    private static adminChatIds: Set<string> = new Set();
    private static riskCooldown: Map<string, number> = new Map();
    private static readonly RISK_COOLDOWN_MS = 300000;
    private static isRunning = false;
    private static dailySummaryTimer: ReturnType<typeof setTimeout> | null = null;
    private static lastUpdateId = 0;
    private static heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private static commandsReRegTimer: ReturnType<typeof setInterval> | null = null;
    private static lastHeartbeatMsg: string | null = null;
    private static engineHistoryCache: Map<string, string[]> = new Map();
    private static engineEnabledCache: Map<string, boolean> = new Map();
    private static lastEngineStatusRefresh = 0;

    static getSettings(): BotSettings {
        return { ...this.settings };
    }

    static updateSettings(s: Partial<BotSettings>) {
        this.settings = { ...this.settings, ...s };
        this.saveSettings();
        if (this.settings.enabled && this.settings.notifyDailySummary) {
            this.scheduleDailySummary();
        }
    }

    static start() {
        if (this.isRunning) return;
        this.loadSettings();
        this.loadSeenTrades();
        this.loadAdminIds();

        const tgSettings = TelegramService.getSettings();
        if (!this.settings.enabled && tgSettings.enabled && tgSettings.botToken && tgSettings.chatId) {
            this.settings.enabled = true;
            this.saveSettings();
        }

        this.isRunning = true;
        TelegramService.startQueue();
        console.log(`📱 TradeNotificationBot: Iniciado (${this.settings.enabled ? 'ativo' : 'inativo'})`);

        TelegramService.setMyCommands(this.adminChatIds.size > 0 ? [...this.adminChatIds] : undefined);

        if (this.settings.enabled && this.settings.notifyDailySummary) {
            this.scheduleDailySummary();
        }

        setInterval(() => this.pollNewTrades(), 600000);
        setInterval(() => this.checkRisk(), 30000);
        setInterval(() => this.pollCommands(), 1000);

        // Heartbeat automático desabilitado (use /heartbeat manualmente)

        this.commandsReRegTimer = setInterval(() => TelegramService.setMyCommands(this.adminChatIds.size > 0 ? [...this.adminChatIds] : undefined), 24 * 60 * 60 * 1000);

        setInterval(() => BotSessionManager.cleanup(), 60 * 1000);

        console.log(`📱 TradeNotificationBot: Admin IDs: ${[...this.adminChatIds].join(', ') || 'auto-registro'}`);

        // Popula cache de status dos motores imediatamente para evitar notificações de engines desligados
        this.refreshEngineEnabledCache().catch(() => {});
    }

    static stop() {
        this.isRunning = false;
        if (this.dailySummaryTimer) { clearTimeout(this.dailySummaryTimer); this.dailySummaryTimer = null; }
        if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
        if (this.commandsReRegTimer) { clearInterval(this.commandsReRegTimer); this.commandsReRegTimer = null; }
        console.log('📱 TradeNotificationBot: Parado');
    }

    static async sendTestMessage(): Promise<boolean> {
        const tgSettings = TelegramService.getSettings();
        if (!tgSettings.enabled && tgSettings.botToken && tgSettings.chatId) {
            TelegramService.updateSettings({ enabled: true });
        }
        const msg = [
            '<b>🤖 RADAR FX | TRADE BOT</b>',
            '',
            '✅ Conexão estabelecida com sucesso!',
            '',
            'Você receberá notificações de:',
            '📈 Aberturas de trades',
            '📊 Fechamentos com P&L',
            '📅 Resumo diário de performance',
            '🚨 Alertas de risco',
            '',
            '<i>Bot v3.0 ativo e monitorando...</i>'
        ].join('\n');
        return TelegramService.sendMessage(msg);
    }

    private static loadAdminIds() {
        this.adminChatIds.clear();
        if (ADMIN_IDS_ENV) {
            for (const id of ADMIN_IDS_ENV.split(',')) {
                const trimmed = id.trim();
                if (trimmed) this.adminChatIds.add(trimmed);
            }
        }
    }

    private static isAdmin(chatId: number | string): boolean {
        const key = String(chatId);
        if (this.adminChatIds.size === 0) return true;
        return this.adminChatIds.has(key);
    }

    private static async fetchAllEngineStatuses(): Promise<EngineStatusResult[]> {
        const results: EngineStatusResult[] = [];
        for (const eng of ENGINES) {
            try {
                const url = eng.statusUrl || `/api/mt5/${eng.id}/status`;
                const resp = await axios.get(`http://127.0.0.1:${PORT}${url}`, { timeout: 4000 });
                const d = resp.data;
                let dailyProfit = 0;
                if (typeof d.dailyProfit === 'number') dailyProfit = d.dailyProfit;
                else if (d.state && typeof d.state.dailyProfit === 'number') dailyProfit = d.state.dailyProfit;
                else if (typeof d.totalProfit === 'number') dailyProfit = d.totalProfit;
                else if (d.performance && typeof d.performance.totalProfit === 'number') dailyProfit = d.performance.totalProfit;
                else if (d.stats && typeof d.stats.totalProfit === 'number') dailyProfit = d.stats.totalProfit;

                let openPositions = 0;
                if (typeof d.openPositions === 'number') openPositions = d.openPositions;
                else if (d.activePositions && Array.isArray(d.activePositions)) openPositions = d.activePositions.length;
                else if (d.state?.activePositions && Array.isArray(d.state.activePositions)) openPositions = d.state.activePositions.length;

                const winRate = d.report?.summary?.winRate ?? d.summary?.winRate ?? d.performance?.winRate ?? d.stats?.winRate ?? null;
                const totalTrades = d.report?.summary?.totalTrades ?? d.summary?.totalTrades ?? d.performance?.totalTrades ?? d.stats?.totalTrades ?? null;
                const enabled = typeof d.enabled === 'boolean' ? d.enabled : null;

                let lastResults: string[] | undefined;
                const cached = this.engineHistoryCache.get(eng.id);
                if (cached) lastResults = cached;

                results.push({ name: eng.name, emoji: eng.emoji, enabled, dailyProfit, openPositions, winRate, totalTrades, symbol: eng.symbol, lastResults });
            } catch (e) {
                results.push({ name: eng.name, emoji: eng.emoji, enabled: null, dailyProfit: 0, openPositions: 0, winRate: null, totalTrades: null, symbol: eng.symbol });
            }
        }
        return results;
    }

    private static async isEngineEnabled(engineId: string): Promise<boolean> {
        if (Date.now() - this.lastEngineStatusRefresh > 30000) {
            await this.refreshEngineEnabledCache();
        }
        return this.engineEnabledCache.get(engineId) ?? true;
    }

    private static async refreshEngineEnabledCache() {
        this.lastEngineStatusRefresh = Date.now();
        for (const eng of REPORT_ENGINES) {
            try {
                const url = `/api/mt5/${eng.id}/status`;
                const resp = await axios.get(`http://127.0.0.1:${PORT}${url}`, { timeout: 3000 });
                const enabled = resp.data?.enabled;
                this.engineEnabledCache.set(eng.id, enabled !== false);
            } catch {
                this.engineEnabledCache.set(eng.id, true);
            }
        }
    }

    static notifyTradeOpened(engine: string, symbol: string, dir: string, lot: number, price: number, sl: number, tp: number) {
        if (!this.settings.enabled || !this.settings.notifyTradeOpen) return;

        const engInfo = ENGINES.find(e => e.name === engine);
        if (engInfo && this.engineEnabledCache.get(engInfo.id) === false) return;
        setTimeout(() => {
            const msg = [
                '<b>📈 RADAR FX | TRADE ABERTO</b>',
                '',
                `<b>Motor:</b> ${escapeHtml(engine)}`,
                `<b>Ativo:</b> ${escapeHtml(symbol)}`,
                `<b>Direção:</b> ${dir === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'}`,
                `<b>Lote:</b> ${lot}`,
                price ? `<b>Entrada:</b> ${price}` : '',
                sl ? `<b>SL:</b> ${sl}` : '',
                tp ? `<b>TP:</b> ${tp}` : '',
                '',
                `<i>${new Date().toLocaleString('pt-BR')}</i>`
            ].filter(l => l).join('\n');
            TelegramService.sendMessage(msg);
        }, 500);
    }

    static notifyTradeClosed(engine: string, symbol: string, dir: string, profit: number, result: string, reason: string, lots: number) {
        if (!this.settings.enabled || !this.settings.notifyTradeClose) return;

        const engInfo = ENGINES.find(e => e.name === engine);
        if (engInfo && this.engineEnabledCache.get(engInfo.id) === false) return;
        const signal = profit >= 0 ? '+' : '';

        const engineInfo = ENGINES.find(e => e.name === engine);
        if (engineInfo) {
            const key = engineInfo.id;
            const arr = this.engineHistoryCache.get(key) || [];
            arr.push(result);
            if (arr.length > 50) arr.shift();
            this.engineHistoryCache.set(key, arr);
        }

        setTimeout(() => {
            const emoji = result === 'WIN' ? '🟢' : result === 'LOSS' ? '💣' : '⚪';
            const msg = [
                `<b>${emoji} RADAR FX | TRADE FECHADO</b>`,
                '',
                `<b>Motor:</b> ${escapeHtml(engine)}`,
                `<b>Ativo:</b> ${escapeHtml(symbol)}`,
                `<b>Direção:</b> ${dir === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'}`,
                `<b>Lotes:</b> ${lots}`,
                `<b>Resultado:</b> ${signal}$${profit.toFixed(2)}`,
                `<b>Status:</b> ${result === 'WIN' ? '✅ WIN' : result === 'LOSS' ? '💣 LOSS' : '➖ TIE'}`,
                `<b>Motivo:</b> ${escapeHtml(reason || 'N/A')}`,
                '',
                `<i>${new Date().toLocaleString('pt-BR')}</i>`
            ].join('\n');
            TelegramService.sendMessage(msg);
        }, 500);
    }

    static async sendDailySummary() {
        try {
            const dateStr = new Date().toLocaleDateString('pt-BR');
            const timeStr = new Date().toLocaleTimeString('pt-BR');

            const [accResp, engines] = await Promise.all([
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/account`, { timeout: 4000 }).catch(() => ({ data: null })),
                this.fetchAllEngineStatuses()
            ]);
            const acc = accResp?.data;

            const lines: string[] = [];
            lines.push('<b>📊 RADAR FX | RESUMO DIÁRIO</b>');
            lines.push(`<b>📅 ${dateStr}</b>`);
            lines.push('');

            if (acc) {
                const fl = acc.profit || 0;
                lines.push(`💰 <b>Conta:</b> $${acc.balance?.toFixed(2) || '0.00'} | Equity: $${acc.equity?.toFixed(2) || '0.00'} | Margem Livre: $${acc.margin_free?.toFixed(2) || '0.00'}`);
                if (acc.leverage) lines.push(`   Alavancagem: 1:${acc.leverage} | Servidor: ${escapeHtml(acc.server || 'N/A')}`);
                lines.push('');
            }

            lines.push('<b>🤖 ROBÔS ATIVOS:</b>');
            const active = engines.filter(e => e.enabled === true);
            const inactive = engines.filter(e => e.enabled === false);

            if (active.length === 0) {
                lines.push('   ❌ Nenhum robô ativo no momento.');
            } else {
                for (const e of active) {
                    const profitStr = `${e.dailyProfit >= 0 ? '+' : ''}$${e.dailyProfit.toFixed(2)}`;
                    const posStr = e.openPositions > 0 ? ` | Pos: ${e.openPositions}` : '';
                    const wrStr = e.winRate !== null ? ` | WR: ${e.winRate}%` : '';
                    const symStr = e.symbol ? ` | ${e.symbol}` : '';
                    const spark = e.lastResults ? ` | ${formatSparkline(e.lastResults, 10)}` : '';
                    lines.push(`   🟢 ${e.emoji} <b>${e.name}</b> | P&L: ${profitStr}${posStr}${wrStr}${symStr}${spark}`);
                }
            }

            if (inactive.length > 0) {
                lines.push('');
                lines.push('<b>💤 INATIVOS:</b>');
                for (const e of inactive) {
                    lines.push(`   🔴 ${e.emoji} ${e.name}`);
                }
            }

            const topEngines = active.filter(e => e.dailyProfit !== 0).sort((a, b) => b.dailyProfit - a.dailyProfit);
            if (topEngines.length > 0) {
                lines.push('');
                lines.push('<b>🏆 TOP PERFORMERS HOJE:</b>');
                const medals = ['🥇', '🥈', '🥉'];
                topEngines.slice(0, 3).forEach((e, i) => {
                    const profitStr = `${e.dailyProfit >= 0 ? '+' : ''}$${e.dailyProfit.toFixed(2)}`;
                    lines.push(`   ${medals[i] || '•'} ${e.name}: <b>${profitStr}</b>`);
                });
            }

            if (acc) {
                const totalFloating = engines.reduce((s, e) => s + e.dailyProfit, 0);
                lines.push('');
                lines.push(`<b>📈 P&L Flutuante Total:</b> ${totalFloating >= 0 ? '+' : ''}$${totalFloating.toFixed(2)}`);
            }

            lines.push('');
            lines.push(`<i>Gerado às ${timeStr}</i>`);

            await replyWithSplit((t) => TelegramService.sendMessage(t), lines.join('\n'));
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro no resumo diário', e);
        }
    }

    static async sendRiskAlert(engine: string, type: string, message: string) {
        if (!this.settings.enabled || !this.settings.notifyRiskAlerts) return;
        const cooldownKey = `${engine}:${type}`;
        const lastSent = this.riskCooldown.get(cooldownKey) || 0;
        if (Date.now() - lastSent < this.RISK_COOLDOWN_MS) return;
        this.riskCooldown.set(cooldownKey, Date.now());
        const msg = [
            '<b>🚨 RADAR FX | ALERTA DE RISCO</b>',
            '',
            `<b>Motor:</b> ${escapeHtml(engine)}`,
            `<b>Tipo:</b> ${escapeHtml(type)}`,
            `<b>Mensagem:</b> ${escapeHtml(message)}`,
            '',
            `<i>${new Date().toLocaleString('pt-BR')}</i>`
        ].join('\n');
        TelegramService.sendMessage(msg);
    }

    private static isGroupChat(msg: any): boolean {
        const chat = msg?.chat;
        if (!chat) return false;
        return chat.type === 'group' || chat.type === 'supergroup';
    }

    private static async sendHeartbeat() {
        if (!this.settings.enabled) return;
        try {
            const accResp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/account`, { timeout: 4000 }).catch(() => ({ data: null }));
            const acc = accResp?.data;
            const posResp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/positions`, { timeout: 4000 }).catch(() => ({ data: [] }));
            const positions = posResp?.data || [];

            const msg = [
                '<b>🟢 RADAR FX | HEARTBEAT</b>',
                '',
                `🤖 <b>Status:</b> Online`,
                `💼 <b>Posições:</b> ${positions.length}`,
                acc ? `💰 <b>Equity:</b> $${acc.equity?.toFixed(2) || '0.00'}` : '',
                acc ? `📊 <b>Flutuante:</b> ${(acc.profit || 0) >= 0 ? '+' : ''}$${(acc.profit || 0).toFixed(2)}` : '',
                '',
                `<i>${new Date().toLocaleString('pt-BR')}</i>`
            ].filter(l => l).join('\n');

            await TelegramService.sendMessage(msg);
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro no heartbeat', e);
        }
    }

    private static async pollNewTrades() {
        if (!this.settings.enabled) return;
        for (const eng of REPORT_ENGINES) {
            try {
                if (!(await this.isEngineEnabled(eng.id))) continue;

                const resp = await axios.get(`http://127.0.0.1:${PORT}${eng.reportUrl}`, { timeout: 5000 });
                const trades = resp.data?.trades || resp.data?.recentTrades || [];
                for (const t of trades) {
                    const key = t.ticket || t.id;
                    if (!key) continue;
                    if (!this.seenTrades.some(s => s.ticket === key && s.engine === eng.id)) {
                        this.seenTrades.push({ ticket: key, engine: eng.id });
                        this.saveSeenTrades();
                        if (t.result && t.result !== 'TIE') {
                            this.notifyTradeClosed(
                                eng.name,
                                t.symbol || eng.symbol || 'N/A',
                                t.type || 'N/A',
                                t.profit || 0,
                                t.result,
                                t.closeReason || t.comment || 'N/A',
                                t.lot || t.volume || 0
                            );
                        }
                    }
                }
            } catch (e: any) {
                console.error(`📱 TradeNotificationBot: Erro polling ${eng.id}: ${e.message}`);
            }
        }
    }

    private static async checkRisk() {
        if (!this.settings.enabled || !this.settings.notifyRiskAlerts) return;
        try {
            const [accResp, goldRisk, engines] = await Promise.all([
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/account`, { timeout: 4000 }).catch(() => ({ data: null })),
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/gold-scalper/risk-report`, { timeout: 4000 }).catch(() => ({ data: null })),
                this.fetchAllEngineStatuses()
            ]);
            const acc = accResp?.data;
            if (acc) {
                const marginLevel = acc.margin_level || 0;
                if (marginLevel > 0 && marginLevel < 200) {
                    this.sendRiskAlert('Conta', 'Margem Baixa', `Nível de margem: ${marginLevel.toFixed(1)}% — risco de stop out.`);
                }
                const totalLoss = engines.reduce((s, e) => s + (e.dailyProfit < 0 ? e.dailyProfit : 0), 0);
                if (totalLoss < -50) {
                    this.sendRiskAlert('Geral', 'Perda Agregada', `Perda total combinada: $${totalLoss.toFixed(2)} — todos os robôs.`);
                }
            }
            if (goldRisk?.data?.risk) {
                const dd = goldRisk.data.risk.drawdown || 0;
                if (dd > 20) {
                    this.sendRiskAlert('Gold Scalper', 'Drawdown Alto', `Drawdown de ${dd.toFixed(1)}% — atenção à gestão de risco.`);
                }
                const consecLosses = goldRisk.data.risk.consecutiveLosses || 0;
                if (consecLosses >= 5) {
                    this.sendRiskAlert('Gold Scalper', 'Perdas Consecutivas', `${consecLosses} perdas seguidas — considere pausar.`);
                }
            }
            const highLossEngines = engines.filter(e => e.enabled && e.dailyProfit < -20);
            for (const e of highLossEngines) {
                this.sendRiskAlert(e.name, 'Perda Elevada', `${e.name} com perda de $${Math.abs(e.dailyProfit).toFixed(2)} hoje.`);
            }
        } catch (e: any) {
            console.error(`📱 TradeNotificationBot: Erro checkRisk: ${e.message}`);
        }
    }

    private static async pollCommands() {
        if (!this.settings.enabled) return;
        const tg = TelegramService.getSettings();
        if (!tg.enabled && tg.botToken && tg.chatId) {
            TelegramService.updateSettings({ enabled: true });
        }

        const updates = await TelegramService.getUpdates(this.lastUpdateId);
        for (const upd of updates) {
            this.lastUpdateId = upd.update_id + 1;

            if (upd.callback_query) {
                await this.handleCallbackQuery(upd.callback_query);
                continue;
            }

            const msg = upd.message;
            if (!msg || !msg.text) continue;
            const chatId = msg.chat?.id;
            if (!chatId) continue;

            this.allowedChatIds.add(String(chatId));

            if (!this.isAdmin(chatId)) {
                await this.replyTo(chatId, '⛔ Acesso não autorizado. Seu chatId não está na lista de administradores.');
                continue;
            }

            const text = msg.text.trim();
            if (!text.startsWith('/')) continue;
            TelegramService.trackCommand(text.split(' ')[0]);
            await this.handleCommand(chatId, text);
        }
    }

    private static replyTo(chatId: number | string, text: string) {
        return TelegramService.sendToChatId(chatId, text);
    }

    private static async handleCommand(chatId: number | string, rawCmd: string) {
        const cmd = rawCmd.toLowerCase();
        const reply = (txt: string) => this.replyTo(chatId, txt);

        const session = BotSessionManager.getSession(chatId);

        if (cmd === '/cancel') {
            BotSessionManager.clearSession(chatId);
            await reply('✅ Operação cancelada. Comando anterior descartado.');
            return;
        }

        if (session.state === 'AWAITING_CONFIRM_CLOSE_ALL' && !cmd.startsWith('/')) {
            if (cmd === 'sim' || cmd === 'yes' || cmd === 'confirmar') {
                BotSessionManager.clearSession(chatId);
                await this.cmdCloseAll(reply);
                return;
            }
            BotSessionManager.clearSession(chatId);
            await reply('❌ Fechamento cancelado.');
            return;
        }

        switch (true) {
            case cmd === '/start' || cmd === '/menu' || cmd === '/help':
                BotSessionManager.clearSession(chatId);
                await reply(this.getMenuText(chatId));
                break;

            case cmd === '/status' || cmd === '/allstatus':
                await this.cmdAllStatus(chatId);
                break;

            case cmd === '/positions':
                await this.cmdPositions(chatId);
                break;

            case cmd === '/summary':
                await this.sendDailySummary();
                await reply('📊 Resumo enviado acima.');
                break;

            case cmd === '/stats':
                await this.cmdStats(chatId);
                break;

            case cmd === '/alerts':
                await this.cmdAlerts(chatId);
                break;

            case cmd === '/trades':
                await this.cmdTrades(chatId, 0);
                break;

            case cmd.startsWith('/trades '):
                {
                    const offset = parseInt(cmd.split(' ')[1]) || 0;
                    await this.cmdTrades(chatId, offset);
                }
                break;

            case cmd === '/relatorio':
                await this.cmdRelatorio(chatId);
                break;

            case cmd === '/comprar' || cmd === '/buy':
                await this.cmdOpenTrade(chatId, 'BUY', rawCmd);
                break;

            case cmd === '/vender' || cmd === '/sell':
                await this.cmdOpenTrade(chatId, 'SELL', rawCmd);
                break;

            case cmd === '/fechar' || cmd === '/close':
                await this.cmdCloseTrade(chatId, rawCmd);
                break;

            case cmd.startsWith('/fechar ') || cmd.startsWith('/close '):
                await this.cmdCloseTrade(chatId, rawCmd);
                break;

            case cmd === '/fechartudo' || cmd === '/fechartudo sim' || cmd === '/closeall' || cmd === '/closeall sim':
                {
                    const parts = rawCmd.split(/\s+/);
                    if (parts[1] === 'sim' || parts[1] === 'confirmar' || parts[1] === 'yes') {
                        await this.cmdCloseAll(reply);
                    } else {
                        BotSessionManager.setState(chatId, 'AWAITING_CONFIRM_CLOSE_ALL');
                        const kbd = { inline_keyboard: [[{ text: '✅ Sim, fechar tudo', callback_data: 'confirm_closeall' }, { text: '❌ Não', callback_data: 'cancel' }]] };
                        const lines = ['<b>⚠️ CONFIRMAÇÃO NECESSÁRIA</b>', '',
                            'Deseja realmente fechar <b>TODAS</b> as posições?',
                            '',
                            'Envie <b>sim</b> ou clique no botão abaixo:',
                            '',
                            '<i>Esta ação não pode ser desfeita.</i>'];
                        await TelegramService.sendToChatId(chatId, lines.join('\n'));
                    }
                }
                break;

            case cmd.startsWith('/setdaily '):
                {
                    const timeStr = rawCmd.split(' ')[1];
                    await this.cmdSetDaily(chatId, timeStr);
                }
                break;

            case cmd === '/setdaily':
                await reply('❌ Use: <b>/setdaily HH:MM</b>\n   Ex: /setdaily 18:00');
                break;

            case cmd === '/ml':
                await this.cmdMLPrediction(chatId);
                break;

            case cmd === '/news':
                await this.cmdNews(chatId);
                break;

            case cmd === '/heartbeat':
                await this.sendHeartbeat();
                await reply('🟢 Heartbeat enviado.');
                break;

            default:
                await reply(`❌ Comando não reconhecido.\n\nUse /menu para ver os comandos disponíveis.`);
        }
    }

    static async processUpdate(upd: any) {
        if (upd.callback_query) {
            await this.handleCallbackQuery(upd.callback_query);
        }
    }

    private static async handleCallbackQuery(cq: any) {
        const chatId = cq.message?.chat?.id;
        const data = cq.data || '';
        const cqId = cq.id;
        if (!chatId) return;

        if (!this.isAdmin(chatId)) {
            await TelegramService.answerCallbackQuery(cqId, '⛔ Não autorizado');
            return;
        }

        const reply = (txt: string) => this.replyTo(chatId, txt);

        switch (data) {
            case 'confirm_closeall':
                await TelegramService.answerCallbackQuery(cqId, '🔒 Fechando todas as posições...');
                BotSessionManager.clearSession(chatId);
                await this.cmdCloseAll(reply);
                break;

            case 'cancel':
                await TelegramService.answerCallbackQuery(cqId, '✅ Cancelado');
                BotSessionManager.clearSession(chatId);
                await reply('✅ Operação cancelada.');
                break;

            default:
                await TelegramService.answerCallbackQuery(cqId);
        }
    }

    private static getMenuText(chatId?: number | string): string {
        const lines = [
            '<b>🤖 RADAR FX | BOT DE TRADING</b>',
            '',
            'Comandos disponíveis:',
            '',
            '📋 <b>/menu</b> — Exibir este menu',
            '📊 <b>/allstatus</b> — Status de TODOS os robôs',
            '💼 <b>/positions</b> — Posições abertas (todos)',
            '📅 <b>/summary</b> — Resumo diário completo',
            '📈 <b>/stats</b> — Estatísticas de todos os robôs',
            '📋 <b>/trades [N]</b> — Trades (com paginação: /trades 20)',
            '📑 <b>/relatorio</b> — Relatório detalhado por robô',
            '🟢 <b>/comprar SYMBOL LOT</b> — Abrir COMPRA manual',
            '🔴 <b>/vender SYMBOL LOT</b> — Abrir VENDA manual',
            '❌ <b>/fechar TICKET</b> — Fechar trade específico',
            '🛑 <b>/fechartudo</b> — Fechar TODAS as posições',
            '🔔 <b>/alerts</b> — Últimos alertas',
            '⏰ <b>/setdaily HH:MM</b> — Configurar horário do resumo',
            '🧠 <b>/ml</b> — Previsão IA para todos os símbolos',
            '📰 <b>/news</b> — Sentimento de notícias (XAUUSD, BTCUSD, EURUSD)',
            '🟢 <b>/heartbeat</b> — Solicitar heartbeat agora',
            '❌ <b>/cancel</b> — Cancelar operação atual',
            '',
            'Robôs monitorados:',
            ...ENGINE_MENU_ORDER.map(id => {
                const e = ENGINES.find(x => x.id === id);
                if (!e) return '';
                return `   ${e.emoji} ${e.name}${e.symbol ? ` (${e.symbol})` : ''}`;
            }).filter(Boolean),
            '',
            'Notificações automáticas:',
            '• 📈 Abertura de trades (todos os robôs)',
            '• 📊 Fechamento com P&L (todos os robôs)',
            '• 🚨 Alertas de risco (drawdown, perdas, margem)',
            '• 📅 Resumo diário às ' +
                `${String(this.settings.dailySummaryHour).padStart(2, '0')}:${String(this.settings.dailySummaryMinute).padStart(2, '0')}`,
            '',
            '<i>Bot v3.0 — Radar FX Multi-Robô</i>'
        ];
        return lines.join('\n');
    }

    private static async cmdAllStatus(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const [accResp, engines, goldRisk] = await Promise.all([
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/account`, { timeout: 5000 }).catch(() => ({ data: null })),
                this.fetchAllEngineStatuses(),
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/gold-scalper/risk-report`, { timeout: 5000 }).catch(() => ({ data: null }))
            ]);
            const acc = accResp?.data;

            const lines = ['<b>📊 RADAR FX | STATUS GERAL</b>', ''];

            if (acc) {
                lines.push(`<b>💰 Conta:</b> $${acc.balance?.toFixed(2) || '0.00'} | Equity: $${acc.equity?.toFixed(2) || '0.00'}`);
                lines.push(`   Margem: $${acc.margin?.toFixed(2) || '0.00'} | Livre: $${acc.margin_free?.toFixed(2) || '0.00'}`);
                if (acc.margin && acc.equity) {
                    const level = (acc.equity / acc.margin) * 100;
                    lines.push(`   Nível Margem: ${level.toFixed(1)}%`);
                }
                lines.push('');
            }

            lines.push('<b>🤖 ROBÔS:</b>');
            for (const e of engines) {
                const icon = e.enabled === true ? '🟢' : e.enabled === false ? '🔴' : '⚪';
                const profitStr = `${e.dailyProfit >= 0 ? '+' : ''}$${e.dailyProfit.toFixed(2)}`;
                const posStr = e.openPositions > 0 ? ` | Pos: ${e.openPositions}` : '';
                const wrStr = e.winRate !== null ? ` | WR: ${e.winRate}%` : '';
                const spark = e.lastResults ? ` | ${formatSparkline(e.lastResults, 10)}` : '';
                lines.push(`${icon} ${e.emoji} <b>${e.name}</b> ${profitStr}${posStr}${wrStr}${spark}`);
            }

            if (goldRisk?.data?.risk) {
                const rsk = goldRisk.data.risk;
                lines.push('');
                lines.push('<b>⚠️ Risco Gold Scalper:</b>');
                lines.push(`   Drawdown: ${rsk.drawdown?.toFixed(1) || 0}%`);
                lines.push(`   Perdas seguidas: ${rsk.consecutiveLosses || 0}`);
            }

            const totalPnl = engines.reduce((s, e) => s + e.dailyProfit, 0);
            lines.push('');
            lines.push(`<b>📈 P&L Total:</b> ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter status geral.');
        }
    }

    private static async cmdPositions(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const [posResp, accResp] = await Promise.all([
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/positions`, { timeout: 5000 }).catch(() => ({ data: [] })),
                axios.get(`http://127.0.0.1:${PORT}/api/mt5/account`, { timeout: 5000 }).catch(() => ({ data: null }))
            ]);
            const positions = posResp?.data || [];
            const acc = accResp?.data;

            if (positions.length === 0) {
                await reply('📭 Nenhuma posição aberta no momento.');
                return;
            }

            const lines = ['<b>💼 RADAR FX | POSIÇÕES ABERTAS</b>', ''];
            lines.push(`<b>Total:</b> ${positions.length} posições`);

            if (acc) {
                const fl = acc.profit || 0;
                lines.push(`<b>Flutuante:</b> ${fl >= 0 ? '+' : ''}$${fl.toFixed(2)}`);
                lines.push(`<b>Equity:</b> $${acc.equity?.toFixed(2) || '0.00'}`);
                lines.push(`<b>Margem:</b> $${acc.margin?.toFixed(2) || '0.00'}`);
                if (acc.balance && acc.balance > 0) {
                    const pct = (fl / acc.balance) * 100;
                    lines.push(`<b>% Conta:</b> ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`);
                }
                lines.push('');
            }

            for (const p of positions) {
                const emoji = p.type === 0 ? '🟢' : '🔴';
                const dir = p.type === 0 ? 'BUY' : 'SELL';
                const engine = getEngineName(p.magic);
                lines.push(`${emoji} <b>${escapeHtml(p.symbol)}</b> ${dir} | Lote: ${p.volume} | P&L: $${(p.profit || 0).toFixed(2)} | ${escapeHtml(engine)}`);
                if (p.price_open) lines.push(`   Entry: ${p.price_open} | SL: ${p.sl || '—'} | TP: ${p.tp || '—'}`);
            }

            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter posições.');
        }
    }

    private static async cmdStats(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const engines = await this.fetchAllEngineStatuses();
            const lines = ['<b>📈 RADAR FX | ESTATÍSTICAS POR ROBÔ</b>', ''];

            for (const e of engines) {
                const icon = e.enabled === true ? '🟢' : '🔴';
                const profitStr = `${e.dailyProfit >= 0 ? '+' : ''}$${e.dailyProfit.toFixed(2)}`;
                lines.push(`${icon} ${e.emoji} <b>${e.name}</b>`);
                if (e.enabled !== null) lines.push(`   Status: ${e.enabled ? 'Ativo' : 'Inativo'}`);
                lines.push(`   P&L Diário: <b>${profitStr}</b>`);
                lines.push(`   Posições: ${e.openPositions}`);
                if (e.winRate !== null) lines.push(`   Win Rate: ${e.winRate}%`);
                if (e.totalTrades !== null) lines.push(`   Total Trades: ${e.totalTrades}`);
                if (e.lastResults && e.lastResults.length > 0) {
                    lines.push(`   Sequência: ${formatSparkline(e.lastResults, 10)}`);
                }
                lines.push('');
            }

            const totalPnl = engines.reduce((s, e) => s + e.dailyProfit, 0);
            const totalPositions = engines.reduce((s, e) => s + e.openPositions, 0);
            lines.push(`<b>📊 TOTAIS GLOBAIS:</b>`);
            lines.push(`   P&L Combinado: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
            lines.push(`   Posições Abertas: ${totalPositions}`);
            lines.push(`   Robôs Ativos: ${engines.filter(e => e.enabled === true).length}/${engines.length}`);

            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter estatísticas.');
        }
    }

    private static async cmdTrades(chatId: number | string, offset: number = 0) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        const PAGE_SIZE = 20;
        try {
            const allTrades: any[] = [];
            for (const eng of REPORT_ENGINES) {
                try {
                    const resp = await axios.get(`http://127.0.0.1:${PORT}${eng.reportUrl}`, { timeout: 4000 });
                    const trades = resp.data?.trades || resp.data?.recentTrades || [];
                    for (const t of trades) {
                        allTrades.push({ ...t, _engine: eng.name, _emoji: '🤖' });
                    }
                } catch (e: any) {
                    console.error(`📱 TradeNotificationBot: Erro trades ${eng.id}: ${e.message}`);
                }
            }
            allTrades.sort((a, b) => {
                const ta = a.closeTime || a.openTime || 0;
                const tb = b.closeTime || b.openTime || 0;
                return tb - ta;
            });

            if (allTrades.length === 0) {
                await reply('📭 Nenhum trade registrado no histórico.');
                return;
            }

            const page = allTrades.slice(offset, offset + PAGE_SIZE);
            if (page.length === 0 && offset > 0) {
                await reply(`📭 Offset ${offset} excede total de ${allTrades.length} trades.`);
                return;
            }

            const totalPages = Math.ceil(allTrades.length / PAGE_SIZE);
            const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

            const lines = ['<b>📋 RADAR FX | ÚLTIMOS TRADES</b>', ''];
            let wins = 0, losses = 0, pagePnl = 0;

            for (const t of page) {
                const d = new Date(t.closeTime || t.openTime);
                const dateStr = d.toLocaleDateString('pt-BR');
                const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const emoji = t.result === 'WIN' ? '✅' : t.result === 'LOSS' ? '💣' : '➖';
                const signal = t.profit >= 0 ? '+' : '';
                const dir = t.type === 'BUY' ? '🟢' : '🔴';
                const motivo = t.closeReason || t.comment || '';
                lines.push(`${emoji} ${dir} <b>${t._engine}</b> ${escapeHtml(t.symbol || '')} | ${signal}$${(t.profit || 0).toFixed(2)} | ${dateStr} ${timeStr}${motivo ? ` (${escapeHtml(motivo)})` : ''}`);

                if (t.result === 'WIN') { wins++; pagePnl += t.profit || 0; }
                else if (t.result === 'LOSS') { losses++; pagePnl += t.profit || 0; }
            }

            lines.push('');
            lines.push(`<b>📊 Página ${currentPage}/${totalPages} (${page.length} trades):</b>`);
            lines.push(`✅ Wins: ${wins} | 💣 Losses: ${losses} | WR: ${(wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : 0}%`);
            lines.push(`<b>P&L: ${pagePnl >= 0 ? '+' : ''}$${pagePnl.toFixed(2)}</b>`);

            if (offset + PAGE_SIZE < allTrades.length) {
                lines.push('');
                lines.push(`📌 Para ver mais: /trades ${offset + PAGE_SIZE}`);
            }

            lines.push('');
            lines.push(`<i>Total: ${allTrades.length} trades</i>`);

            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter histórico de trades.');
        }
    }

    private static async cmdRelatorio(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const resp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/global-report`, { timeout: 8000 });
            const data = resp.data;
            if (!data || !data.engines) {
                await reply('❌ Erro ao gerar relatório.');
                return;
            }

            const lines: string[] = [];
            lines.push('<b>📑 RADAR FX | RELATÓRIO DE DESEMPENHO</b>');
            lines.push(`<b>📅 ${data.date} às ${data.time}</b>`);
            lines.push('');

            const sorted = [...data.engines].sort((a, b) => b.totalProfit - a.totalProfit);
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

            for (let i = 0; i < sorted.length; i++) {
                const e = sorted[i];
                const medal = medals[i] || '•';
                const profitStr = `${e.totalProfit >= 0 ? '+' : ''}$${e.totalProfit.toFixed(2)}`;

                lines.push(`${medal} <b>${escapeHtml(e.name)}</b>`);
                lines.push(`   💰 P&L Total: <b>${profitStr}</b>`);

                if (e.summary) {
                    const s = e.summary;
                    lines.push(`   📊 Trades: ${s.totalTrades} | ✅ ${s.wins} | 💣 ${s.losses}`);
                    lines.push(`   📈 Win Rate: ${s.winRate}%`);
                    if (s.avgWin) lines.push(`   🟢 Avg Win: +$${s.avgWin.toFixed(2)}`);
                    if (s.avgLoss) lines.push(`   🔴 Avg Loss: -$${s.avgLoss.toFixed(2)}`);
                    if (s.profitFactor) lines.push(`   ⚖️ Profit Factor: ${s.profitFactor}`);
                    if (s.bestTrade) lines.push(`   🏆 Best Trade: +$${s.bestTrade.toFixed(2)}`);
                    if (s.worstTrade) lines.push(`   🪦 Worst Trade: -$${Math.abs(s.worstTrade).toFixed(2)}`);
                    if (s.currentStreak && s.currentStreak > 1) {
                        const streakEmoji = s.streakType === 'WIN' ? '🔥' : '❄️';
                        lines.push(`   ${streakEmoji} Sequência: ${s.currentStreak} ${s.streakType === 'WIN' ? 'vitórias' : 'derrotas'}`);
                    }
                } else {
                    lines.push(`   📊 Trades: ${e.totalTrades}`);
                    if (e.winRate) lines.push(`   📈 Win Rate: ${e.winRate}%`);
                }
                lines.push('');
            }

            const totalPnl = data.summary?.totalProfitAllTime || sorted.reduce((s, e) => s + e.totalProfit, 0);
            const totalTrades = data.summary?.totalTradesAllTime || sorted.reduce((s, e) => s + e.totalTrades, 0);

            lines.push(`<b>📊 TOTAIS GLOBAIS:</b>`);
            lines.push(`   🤖 Robôs: ${data.summary?.totalEngines || sorted.length}`);
            lines.push(`   📊 Total Trades: ${totalTrades}`);
            lines.push(`   💰 P&L Total: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>`);
            lines.push(`   📅 Trades Hoje: ${data.summary?.todayTradesCount || 0}`);
            lines.push(`   📌 Posições Abertas: ${data.summary?.openPositionsCount || 0}`);

            if (data.recentTrades && data.recentTrades.length > 0) {
                lines.push('');
                lines.push('<b>🕐 Últimos trades fechados (2h):</b>');
                const last5 = data.recentTrades.slice(0, 5);
                for (const t of last5) {
                    const d = new Date(t.closeTime || t.openTime);
                    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const emoji = t.result === 'WIN' ? '✅' : t.result === 'LOSS' ? '💣' : '➖';
                    const signal = t.profit >= 0 ? '+' : '';
                    const dir = t.type === 'BUY' ? '🟢' : '🔴';
                    lines.push(`   ${emoji} ${dir} ${escapeHtml(t.engine || '')} ${escapeHtml(t.symbol || '')} ${signal}$${(t.profit || 0).toFixed(2)} ${timeStr}`);
                }
            }

            if (data.openPositions && data.openPositions.length > 0) {
                lines.push('');
                lines.push('<b>📌 Posições abertas AGORA:</b>');
                for (const p of data.openPositions) {
                    const dirEmoji = p.type === 'BUY' ? '🟢' : '🔴';
                    const profitStr = `${p.profit >= 0 ? '+' : ''}$${(p.profit || 0).toFixed(2)}`;
                    lines.push(`   ${dirEmoji} <b>${escapeHtml(p.symbol)}</b> ${p.type} | ${escapeHtml(p.engine)} | ${profitStr} | Lote: ${p.volume}`);
                }
            }

            lines.push('');
            lines.push(`<i>Relatório completo · Radar FX</i>`);

            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao gerar relatório de desempenho.');
        }
    }

    private static async cmdAlerts(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const alerts = AlertEngine.getAlerts();
            if (!alerts || alerts.length === 0) {
                await reply('🔔 Nenhum alerta registrado.');
                return;
            }

            const lines = ['<b>🔔 RADAR FX | ÚLTIMOS ALERTAS</b>', ''];
            const recent = alerts.slice(0, 10);
            for (const a of recent) {
                const emoji = a.severity === 'CRITICAL' ? '🚨' : a.severity === 'WARNING' ? '⚠️' : 'ℹ️';
                const time = new Date(a.timestamp).toLocaleTimeString('pt-BR');
                lines.push(`${emoji} <b>[${escapeHtml(a.type)}]</b> ${escapeHtml(a.message)}`);
                if (a.details) lines.push(`   <i>${escapeHtml(a.details)}</i>`);
                lines.push(`   🕐 ${time}`);
                lines.push('');
            }

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter alertas.');
        }
    }

    private static async cmdOpenTrade(chatId: number | string, direction: 'BUY' | 'SELL', fullCmd: string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        const parts = fullCmd.split(/\s+/);
        if (parts.length < 3) {
            await reply(`❌ Use: <b>/${direction === 'BUY' ? 'comprar' : 'vender'} SYMBOL LOT</b>\n   Ex: /comprar BTCUSD 0.01`);
            return;
        }
        const symbol = parts[1].toUpperCase();
        const lot = parseFloat(parts[2]);
        if (!lot || lot <= 0) {
            await reply('❌ Lote inválido. Use números positivos (ex: 0.01).');
            return;
        }
        try {
            const resp = await axios.post(`http://127.0.0.1:${PORT}/api/mt5/trade/open`,
                { symbol, direction, lot, comment: 'Telegram_Manual' },
                { timeout: 10000 });
            if (resp.data?.status === 'success' || resp.data?.order_id) {
                await reply(`✅ <b>ORDEM ENVIADA</b>\n   ${direction === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'} ${escapeHtml(symbol)}\n   Lote: ${lot}\n   Ticket: #${resp.data.order_id}`);
                try {
                    const { TradeNotificationBot: Bot } = require('./TradeNotificationBot');
                    Bot.notifyTradeOpened('Manual (Telegram)', symbol, direction, lot, 0, 0, 0);
                } catch (e) {
                    console.error('Erro ao notificar trade manual', e);
                }
            } else {
                await reply(`❌ Erro ao enviar ordem: ${resp.data?.error || 'Resposta inválida'}`);
            }
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            await reply(`❌ Falha ao abrir ordem: ${escapeHtml(msg)}`);
        }
    }

    private static async cmdCloseTrade(chatId: number | string, fullCmd: string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        const parts = fullCmd.split(/\s+/);
        if (parts.length < 2) {
            await reply('❌ Use: <b>/fechar TICKET</b>\n   Ex: /fechar 310888771');
            return;
        }
        const ticket = parseInt(parts[1]);
        if (!ticket) {
            await reply('❌ Ticket inválido. Use o número do ticket (ex: 310888771).');
            return;
        }
        try {
            const resp = await axios.post(`http://127.0.0.1:${PORT}/api/mt5/trade/close`,
                { ticket },
                { timeout: 5000 });
            await reply(`✅ <b>POSIÇÃO FECHADA</b>\n   Ticket: #${ticket}`);
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            await reply(`❌ Falha ao fechar #${ticket}: ${escapeHtml(msg)}`);
        }
    }

    private static async cmdCloseAll(reply: (txt: string) => Promise<boolean>) {
        try {
            const resp = await axios.post(`http://127.0.0.1:${PORT}/api/mt5/trade/close-all`, {}, { timeout: 15000 });
            const data = resp.data;
            await reply(`🛑 <b>TODAS POSIÇÕES FECHADAS</b>\n   Fechadas: ${data.closed || 0}\n   Erros: ${data.errors || 0}\n   Total: ${data.total || 0}`);
        } catch (err: any) {
            await reply(`❌ Erro ao fechar posições: ${escapeHtml(err.message)}`);
        }
    }

    private static async cmdMLPrediction(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const symbols = ['XAUUSD', 'BTCUSD', 'EURUSD'];
            const lines = ['<b>🧠 RADAR FX | PREVISÃO IA</b>', ''];

            for (const symbol of symbols) {
                try {
                    const resp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/ml/predict?symbol=${symbol}`, { timeout: 8000 });
                    const p = resp.data;
                    if (!p || p.direction === 'NEUTRAL') {
                        lines.push(`   ${symbol}: ⚪ NEUTRO (${p?.confidence || 0}%)`);
                        continue;
                    }
                    const dirEmoji = p.direction === 'BUY' ? '🟢' : '🔴';
                    lines.push(`${dirEmoji} <b>${symbol}</b> | ${p.direction} | Conf: ${p.confidence}%`);
                    lines.push(`   📊 Regime: <b>${p.regime}</b> (${(p.regimeConfidence * 100).toFixed(0)}%)`);
                    lines.push(`   📈 Modelo: ${p.modelConfidence}% | RF: ${p.forestConfidence}%`);
                } catch {
                    lines.push(`   ⚪ ${symbol}: ⏳ Indisponível`);
                }
                lines.push('');
            }

            lines.push('<i>Modelos: Regressão Logística + Random Forest + K-Means</i>');
            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter previsão IA.');
        }
    }

    private static async cmdNews(chatId: number | string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        try {
            const symbols = ['XAUUSD', 'BTCUSD', 'EURUSD'];
            const resp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/nlp/news?symbols=${symbols.join(',')}&limit=5`, { timeout: 10000 });
            const articles = resp.data || [];
            const lines = ['<b>📰 RADAR FX | NOTÍCIAS & SENTIMENTO</b>', ''];

            for (const sym of symbols) {
                try {
                    const sentResp = await axios.get(`http://127.0.0.1:${PORT}/api/mt5/nlp/sentiment/${sym}`, { timeout: 5000 });
                    const s = sentResp.data;
                    if (!s) { lines.push(`   ${sym}: ⏳ Sem dados`); continue; }
                    const icon = s.label === 'POSITIVE' ? '🟢' : s.label === 'NEGATIVE' ? '🔴' : '⚪';
                    lines.push(`${icon} <b>${sym}</b> → ${s.label} (${s.sentiment}) | ${s.articleCount} notícias`);
                    lines.push(`   👍 ${s.positiveCount} positivas | 👎 ${s.negativeCount} negativas`);
                } catch {
                    lines.push(`   ⚪ ${sym}: ⏳ Indisponível`);
                }
                lines.push('');
            }

            if (articles.length > 0) {
                lines.push('<b>📰 Últimas notícias:</b>');
                for (const a of articles.slice(0, 5)) {
                    const label = a.sentiment?.label === 'POSITIVE' ? '🟢' : a.sentiment?.label === 'NEGATIVE' ? '🔴' : '⚪';
                    const title = escapeHtml(a.title || '').substring(0, 100);
                    lines.push(`${label} ${title}`);
                }
            }

            lines.push('');
            lines.push('<i>Análise via NLP (AFINN + léxico financeiro + pt-BR)</i>');
            await replyWithSplit(reply, lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter notícias.');
        }
    }

    private static async cmdSetDaily(chatId: number | string, timeStr: string) {
        const reply = (txt: string) => this.replyTo(chatId, txt);
        const match = timeStr?.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
            await reply('❌ Formato inválido. Use <b>/setdaily HH:MM</b>\n   Ex: /setdaily 18:00');
            return;
        }
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            await reply('❌ Horário inválido. Hora: 0-23, Minuto: 0-59.');
            return;
        }
        this.updateSettings({ dailySummaryHour: hour, dailySummaryMinute: minute });
        await reply(`✅ Resumo diário configurado para <b>${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}</b>`);
    }

    private static scheduleDailySummary() {
        if (this.dailySummaryTimer) clearTimeout(this.dailySummaryTimer);
        const now = new Date();
        const target = new Date(now);
        target.setHours(this.settings.dailySummaryHour, this.settings.dailySummaryMinute, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        const ms = target.getTime() - now.getTime();
        this.dailySummaryTimer = setTimeout(() => {
            this.sendDailySummary();
            this.scheduleDailySummary();
        }, ms);
        console.log(`📱 TradeNotificationBot: Resumo diário agendado para ${target.toLocaleString('pt-BR')}`);
    }

    private static loadSettings() {
        try {
            if (fs.existsSync(this.SETTINGS_PATH)) {
                const fileData = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8'));
                this.settings = { ...this.settings, ...fileData };
            }
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro ao carregar settings', e);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro ao salvar settings', e);
        }
    }

    private static loadSeenTrades() {
        try {
            if (fs.existsSync(this.SEEN_TRADES_PATH)) {
                this.seenTrades = JSON.parse(fs.readFileSync(this.SEEN_TRADES_PATH, 'utf-8'));
            }
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro ao carregar seenTrades', e);
        }
    }

    private static saveSeenTrades() {
        try {
            this.seenTrades = this.seenTrades.slice(-500);
            fs.writeFileSync(this.SEEN_TRADES_PATH, JSON.stringify(this.seenTrades));
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro ao salvar seenTrades', e);
        }
    }
}
