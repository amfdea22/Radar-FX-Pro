import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TelegramService } from './TelegramService';
import { AlertEngine } from './AlertEngine';

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
}

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
];

export class TradeNotificationBot {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'bot_settings.json');
    private static SEEN_TRADES_PATH = path.resolve(process.cwd(), 'seen_trades.json');
    private static settings: BotSettings = {
        enabled: false,
        notifyTradeOpen: true,
        notifyTradeClose: true,
        notifyDailySummary: true,
        notifyRiskAlerts: true,
        dailySummaryHour: 18,
        dailySummaryMinute: 0,
    };
    private static seenTrades: SeenTrade[] = [];
    private static isRunning = false;
    private static dailySummaryTimer: any = null;
    private static lastUpdateId = 0;
    private static lastCommandsReg = 0;

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

        // Auto-ativa se TelegramService já estiver configurado e ativo
        const tgSettings = TelegramService.getSettings();
        if (!this.settings.enabled && tgSettings.enabled && tgSettings.botToken && tgSettings.chatId) {
            this.settings.enabled = true;
            this.saveSettings();
        }

        this.isRunning = true;
        console.log(`📱 TradeNotificationBot: Iniciado (${this.settings.enabled ? 'ativo' : 'inativo'})`);

        TelegramService.setMyCommands();

        if (this.settings.enabled && this.settings.notifyDailySummary) {
            this.scheduleDailySummary();
        }

        setInterval(() => this.pollNewTrades(), 10000);
        setInterval(() => this.checkRisk(), 30000);
        setInterval(() => this.pollCommands(), 5000);
    }

    static stop() {
        this.isRunning = false;
        if (this.dailySummaryTimer) {
            clearTimeout(this.dailySummaryTimer);
            this.dailySummaryTimer = null;
        }
        console.log('📱 TradeNotificationBot: Parado');
    }

    static async sendTestMessage(): Promise<boolean> {
        // Garante que o TelegramService esteja habilitado com as credenciais atuais
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
            '<i>Bot v1.0 ativo e monitorando...</i>'
        ].join('\n');
        return TelegramService.sendMessage(msg);
    }

    private static async fetchAllEngineStatuses(): Promise<EngineStatusResult[]> {
        const results: EngineStatusResult[] = [];
        for (const eng of ENGINES) {
            try {
                const resp = await axios.get(`http://127.0.0.1:3015/api/mt5/${eng.id}/status`, { timeout: 4000 });
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
                else if (d.state && d.state.activePositions && Array.isArray(d.state.activePositions)) openPositions = d.state.activePositions.length;

                const winRate = d.report?.summary?.winRate ?? d.summary?.winRate ?? d.performance?.winRate ?? d.stats?.winRate ?? null;
                const totalTrades = d.report?.summary?.totalTrades ?? d.summary?.totalTrades ?? d.performance?.totalTrades ?? d.stats?.totalTrades ?? null;

                const enabled = typeof d.enabled === 'boolean' ? d.enabled : null;
                results.push({ name: eng.name, emoji: eng.emoji, enabled, dailyProfit, openPositions, winRate, totalTrades, symbol: eng.symbol });
            } catch (e) {
                results.push({ name: eng.name, emoji: eng.emoji, enabled: null, dailyProfit: 0, openPositions: 0, winRate: null, totalTrades: null, symbol: eng.symbol });
            }
        }
        return results;
    }

    static notifyTradeOpened(engine: string, symbol: string, dir: string, lot: number, price: number, sl: number, tp: number) {
        if (!this.settings.enabled || !this.settings.notifyTradeOpen) return;

        setTimeout(() => {
            const msg = [
                '<b>📈 RADAR FX | TRADE ABERTO</b>',
                '',
                `<b>Motor:</b> ${engine}`,
                `<b>Ativo:</b> ${symbol}`,
                `<b>Direção:</b> ${dir === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'}`,
                `<b>Lote:</b> ${lot}`,
                `<b>Entrada:</b> ${price}`,
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
        const emoji = result === 'WIN' ? '🟢' : result === 'LOSS' ? '💣' : '⚪';
        const signal = profit >= 0 ? '+' : '';

        if (result === 'WIN') {
        } else if (result === 'LOSS') {
        } else {
        }

        setTimeout(() => {
            const msg = [
                `<b>${emoji} RADAR FX | TRADE FECHADO</b>`,
                '',
                `<b>Motor:</b> ${engine}`,
                `<b>Ativo:</b> ${symbol}`,
                `<b>Direção:</b> ${dir === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'}`,
                `<b>Lotes:</b> ${lots}`,
                `<b>Resultado:</b> ${signal}$${profit.toFixed(2)}`,
                `<b>Status:</b> ${result === 'WIN' ? '✅ WIN' : result === 'LOSS' ? '💣 LOSS' : '➖ TIE'}`,
                `<b>Motivo:</b> ${reason || 'N/A'}`,
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
                axios.get('http://127.0.0.1:3015/api/mt5/account', { timeout: 4000 }).catch(() => ({ data: null })),
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
                if (acc.leverage) lines.push(`   Alavancagem: 1:${acc.leverage} | Servidor: ${acc.server || 'N/A'}`);
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
                    const enabledIcon = e.enabled ? '🟢' : '🔴';
                    lines.push(`   ${enabledIcon} ${e.emoji} <b>${e.name}</b> | P&L: ${profitStr}${posStr}${wrStr}${symStr}`);
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

            TelegramService.sendMessage(lines.join('\n'));
        } catch (e) {
            console.error('📱 TradeNotificationBot: Erro no resumo diário', e);
        }
    }

    static async sendRiskAlert(engine: string, type: string, message: string) {
        if (!this.settings.enabled || !this.settings.notifyRiskAlerts) return;
        const msg = [
            '<b>🚨 RADAR FX | ALERTA DE RISCO</b>',
            '',
            `<b>Motor:</b> ${engine}`,
            `<b>Tipo:</b> ${type}`,
            `<b>Mensagem:</b> ${message}`,
            '',
            `<i>${new Date().toLocaleString('pt-BR')}</i>`
        ].join('\n');
        TelegramService.sendMessage(msg);
    }

    private static async pollNewTrades() {
        if (!this.settings.enabled) return;
        const reportEngines = [
            { id: 'gold-scalper', name: 'Gold Scalper', reportUrl: '/api/mt5/gold-scalper/report', symbol: 'XAUUSD' },
            { id: 'robot', name: 'Alpha Robot', reportUrl: '/api/mt5/robot/report', symbol: '' },
            { id: 'supreme', name: 'Supreme', reportUrl: '/api/mt5/supreme/report', symbol: '' },
        ];
        for (const eng of reportEngines) {
            try {
                const resp = await axios.get(`http://127.0.0.1:3015${eng.reportUrl}`, { timeout: 5000 });
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
            } catch (e) {}
        }
    }

    private static async checkRisk() {
        if (!this.settings.enabled || !this.settings.notifyRiskAlerts) return;
        try {
            const [accResp, goldRisk, engines] = await Promise.all([
                axios.get('http://127.0.0.1:3015/api/mt5/account', { timeout: 4000 }).catch(() => ({ data: null })),
                axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/risk-report', { timeout: 4000 }).catch(() => ({ data: null })),
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
                    this.sendRiskAlert('Geral', 'Perda Agregada', `Perda total combinada: ${totalLoss.toFixed(2)} — todos os robôs.`);
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
        } catch (e) {}
    }

    private static async pollCommands() {
        if (!this.settings.enabled) return;
        // Garante que TelegramService esteja ativo para responder comandos
        const tg = TelegramService.getSettings();
        if (!tg.enabled && tg.botToken && tg.chatId) {
            TelegramService.updateSettings({ enabled: true });
        }
        // Re-registrar comandos periodicamente para garantir que novos comandos apareçam
        if (Date.now() - this.lastCommandsReg > 300000) {
            this.lastCommandsReg = Date.now();
            TelegramService.setMyCommands().catch(() => {});
        }
        const updates = await TelegramService.getUpdates(this.lastUpdateId);
        for (const upd of updates) {
            this.lastUpdateId = upd.update_id + 1;
            const msg = upd.message;
            if (!msg || !msg.text) continue;
            const chatId = msg.chat?.id;
            if (!chatId) continue;
            const text = msg.text.trim();
            if (!text.startsWith('/')) continue;
            await this.handleCommand(chatId, text.toLowerCase());
        }
    }

    private static async handleCommand(chatId: number | string, cmd: string) {
        const reply = (txt: string) => TelegramService.sendToChatId(chatId, txt);

        switch (cmd) {
            case '/start':
            case '/menu':
            case '/help':
                await reply(this.getMenuText());
                break;

            case '/status':
            case '/allstatus':
                await this.cmdAllStatus(reply);
                break;

            case '/positions':
                await this.cmdPositions(reply);
                break;

            case '/summary':
                await this.sendDailySummary();
                await reply('📊 Resumo enviado acima.');
                break;

            case '/stats':
                await this.cmdStats(reply);
                break;

            case '/alerts':
                await this.cmdAlerts(reply);
                break;

            case '/trades':
                await this.cmdTrades(reply);
                break;

            case '/relatorio':
                await this.cmdRelatorio(reply);
                break;

            case '/comprar':
            case '/buy':
                await this.cmdOpenTrade(reply, 'BUY', cmd);
                break;

            case '/vender':
            case '/sell':
                await this.cmdOpenTrade(reply, 'SELL', cmd);
                break;

            case '/fechar':
            case '/close':
                await this.cmdCloseTrade(reply, cmd);
                break;

            case '/fechartudo':
            case '/closeall':
                await this.cmdCloseAll(reply, cmd);
                break;

            default:
                await reply(`❌ Comando não reconhecido.\n\nUse /menu para ver os comandos disponíveis.`);
        }
    }

    private static getMenuText(): string {
        return [
            '<b>🤖 RADAR FX | BOT DE TRADING</b>',
            '',
            'Comandos disponíveis:',
            '',
            '📋 <b>/menu</b> — Exibir este menu',
            '📊 <b>/allstatus</b> — Status de TODOS os robôs',
            '💼 <b>/positions</b> — Posições abertas (todos)',
            '📅 <b>/summary</b> — Resumo diário completo',
            '📈 <b>/stats</b> — Estatísticas de todos os robôs',
            '📋 <b>/trades</b> — Últimos trades fechados',
            '📑 <b>/relatorio</b> — Relatório detalhado por robô',
            '🟢 <b>/comprar SYMBOL LOT</b> — Abrir COMPRA manual',
            '🔴 <b>/vender SYMBOL LOT</b> — Abrir VENDA manual',
            '❌ <b>/fechar TICKET</b> — Fechar trade específico',
            '🛑 <b>/fechartudo</b> — Fechar TODAS as posições (requer confirmação)',
            '🔔 <b>/alerts</b> — Últimos alertas',
            '',
            'Robôs monitorados:',
            ...ENGINES.map(e => `   ${e.emoji} ${e.name}${e.symbol ? ` (${e.symbol})` : ''}`),
            '',
            'Notificações automáticas:',
            '• 📈 Abertura de trades (todos os robôs)',
            '• 📊 Fechamento com P&L (todos os robôs)',
            '• 🚨 Alertas de risco (drawdown, perdas, margem)',
            '• 📅 Resumo diário às 18:00',
            '',
            '<i>Bot v2.0 — Radar FX Multi-Robô</i>'
        ].join('\n');
    }

    private static async cmdAllStatus(reply: (t: string) => Promise<boolean>) {
        try {
            const [accResp, engines, goldRisk] = await Promise.all([
                axios.get('http://127.0.0.1:3015/api/mt5/account', { timeout: 5000 }).catch(() => ({ data: null })),
                this.fetchAllEngineStatuses(),
                axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/risk-report', { timeout: 5000 }).catch(() => ({ data: null }))
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
                lines.push(`${icon} ${e.emoji} <b>${e.name}</b> ${profitStr}${posStr}${wrStr}`);
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

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter status geral.');
        }
    }

    private static async cmdPositions(reply: (t: string) => Promise<boolean>) {
        try {
            const [posResp, accResp] = await Promise.all([
                axios.get('http://127.0.0.1:3015/api/mt5/positions', { timeout: 5000 }).catch(() => ({ data: [] })),
                axios.get('http://127.0.0.1:3015/api/mt5/account', { timeout: 5000 }).catch(() => ({ data: null }))
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

            const magicMap: Record<number, string> = { 888111: 'Micro Sniper', 777111: 'Speed Scalper', 9999: 'Gold Scalper', 444111: 'Bitcoin Pro', 8888: 'Crypto IA', 88881: 'Alpha Robot', 7777: 'Supreme', 999111: 'Omni', 9876: 'Shark Bot', 777222: 'Swing Trader', 202605: 'Agent IA' };
            for (const p of positions) {
                const emoji = p.type === 0 ? '🟢' : '🔴';
                const dir = p.type === 0 ? 'BUY' : 'SELL';
                const engine = magicMap[p.magic] || `Magic ${p.magic}`;
                lines.push(`${emoji} <b>${p.symbol}</b> ${dir} | Lote: ${p.volume} | P&L: $${(p.profit || 0).toFixed(2)} | ${engine}`);
                if (p.price_open) lines.push(`   Entry: ${p.price_open} | SL: ${p.sl || '—'} | TP: ${p.tp || '—'}`);
            }

            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter posições.');
        }
    }

    private static async cmdStats(reply: (t: string) => Promise<boolean>) {
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

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter estatísticas.');
        }
    }

    private static async cmdTrades(reply: (t: string) => Promise<boolean>) {
        try {
            const reportEngines = [
                { id: 'gold-scalper', name: '🥇 Gold Scalper', url: '/api/mt5/gold-scalper/report' },
                { id: 'robot', name: '🤖 Alpha Robot', url: '/api/mt5/robot/report' },
                { id: 'supreme', name: '👑 Supreme', url: '/api/mt5/supreme/report' },
            ];
            const allTrades: any[] = [];
            for (const eng of reportEngines) {
                try {
                    const resp = await axios.get(`http://127.0.0.1:3015${eng.url}`, { timeout: 4000 });
                    const trades = resp.data?.trades || resp.data?.recentTrades || [];
                    for (const t of trades) {
                        allTrades.push({ ...t, _engine: eng.name });
                    }
                } catch (e) {}
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

            const recent = allTrades.slice(0, 30);
            const lines = ['<b>📋 RADAR FX | ÚLTIMOS TRADES</b>', ''];
            let wins = 0, losses = 0, totalPnl = 0;

            for (const t of recent) {
                const d = new Date(t.closeTime || t.openTime);
                const dateStr = d.toLocaleDateString('pt-BR');
                const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const emoji = t.result === 'WIN' ? '✅' : t.result === 'LOSS' ? '💣' : '➖';
                const signal = t.profit >= 0 ? '+' : '';
                const dir = t.type === 'BUY' ? '🟢' : '🔴';
                const motivo = t.closeReason || t.comment || '';
                lines.push(`${emoji} ${dir} <b>${t._engine}</b> ${t.symbol || ''} | ${signal}$${(t.profit || 0).toFixed(2)} | ${timeStr}${motivo ? ` (${motivo})` : ''}`);

                if (t.result === 'WIN') { wins++; totalPnl += t.profit || 0; }
                else if (t.result === 'LOSS') { losses++; totalPnl += t.profit || 0; }
            }

            lines.push('');
            lines.push(`<b>📊 Resumo (${recent.length} trades):</b>`);
            lines.push(`✅ Wins: ${wins} | 💣 Losses: ${losses} | WR: ${(wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : 0}%`);
            lines.push(`<b>P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>`);
            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter histórico de trades.');
        }
    }

    private static async cmdRelatorio(reply: (t: string) => Promise<boolean>) {
        try {
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/global-report', { timeout: 8000 });
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
                const profitColor = e.totalProfit >= 0 ? '' : '';

                lines.push(`${medal} <b>${e.name}</b>`);
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
                    lines.push(`   ${emoji} ${dir} ${t.engine || ''} ${t.symbol || ''} ${signal}$${(t.profit || 0).toFixed(2)} ${timeStr}`);
                }
            }

            if (data.openPositions && data.openPositions.length > 0) {
                lines.push('');
                lines.push('<b>📌 Posições abertas AGORA:</b>');
                for (const p of data.openPositions) {
                    const dirEmoji = p.type === 'BUY' ? '🟢' : '🔴';
                    const profitStr = `${p.profit >= 0 ? '+' : ''}$${(p.profit || 0).toFixed(2)}`;
                    lines.push(`   ${dirEmoji} <b>${p.symbol}</b> ${p.type} | ${p.engine} | ${profitStr} | Lote: ${p.volume}`);
                }
            }

            lines.push('');
            lines.push(`<i>Relatório completo · Radar FX</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao gerar relatório de desempenho.');
        }
    }

    private static async cmdAlerts(reply: (t: string) => Promise<boolean>) {
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
                lines.push(`${emoji} <b>[${a.type}]</b> ${a.message}`);
                if (a.details) lines.push(`   <i>${a.details}</i>`);
                lines.push(`   🕐 ${time}`);
                lines.push('');
            }

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter alertas.');
        }
    }

    private static async cmdOpenTrade(reply: (t: string) => Promise<boolean>, direction: 'BUY' | 'SELL', fullCmd: string) {
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
            const resp = await axios.post('http://127.0.0.1:3015/api/mt5/trade/open',
                { symbol, direction, lot, comment: 'Telegram_Manual' },
                { timeout: 10000 });
            if (resp.data?.status === 'success' || resp.data?.order_id) {
                await reply(`✅ <b>ORDEM ENVIADA</b>\n   ${direction === 'BUY' ? '🟢 COMPRA' : '🔴 VENDA'} ${symbol}\n   Lote: ${lot}\n   Ticket: #${resp.data.order_id}`);
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Manual (Telegram)', symbol, direction, lot, 0, 0, 0);
                } catch (e) {}
            } else {
                await reply(`❌ Erro ao enviar ordem: ${resp.data?.error || 'Resposta inválida'}`);
            }
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            await reply(`❌ Falha ao abrir ordem: ${msg}`);
        }
    }

    private static async cmdCloseTrade(reply: (t: string) => Promise<boolean>, fullCmd: string) {
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
            const resp = await axios.post('http://127.0.0.1:3015/api/mt5/trade/close',
                { ticket },
                { timeout: 5000 });
            await reply(`✅ <b>POSIÇÃO FECHADA</b>\n   Ticket: #${ticket}`);
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            await reply(`❌ Falha ao fechar #${ticket}: ${msg}`);
        }
    }

    private static async cmdCloseAll(reply: (t: string) => Promise<boolean>, fullCmd?: string) {
        const parts = (fullCmd || '').split(/\s+/);
        const isConfirmed = parts[1] === 'sim' || parts[1] === 'confirmar' || parts[1] === 'yes';

        if (!isConfirmed) {
            try {
                const posResp = await axios.get('http://127.0.0.1:3015/api/mt5/positions', { timeout: 5000 });
                const positions = posResp?.data || [];
                const lines = ['<b>⚠️ CONFIRMAÇÃO NECESSÁRIA</b>', '',
                    `Deseja realmente fechar <b>TODAS</b> as ${positions.length} posições?`, '',
                    '<b>Posições atuais:</b>'];
                for (const p of positions.slice(0, 10)) {
                    const dir = p.type === 0 ? '🟢 BUY' : '🔴 SELL';
                    lines.push(`   ${dir} ${p.symbol} | Lote: ${p.volume} | P&L: $${(p.profit || 0).toFixed(2)}`);
                }
                if (positions.length > 10) lines.push(`   ... e mais ${positions.length - 10} posições`);
                lines.push('', 'Para confirmar, envie:');
                lines.push('<b>/fechartudo sim</b>');
                lines.push('', '<i>Esta ação não pode ser desfeita.</i>');
                await reply(lines.join('\n'));
            } catch (e) {
                await reply('⚠️ Deseja fechar TODAS as posições? Envie: <b>/fechartudo sim</b>');
            }
            return;
        }

        try {
            const resp = await axios.post('http://127.0.0.1:3015/api/mt5/trade/close-all', {}, { timeout: 15000 });
            const data = resp.data;
            await reply(`🛑 <b>TODAS POSIÇÕES FECHADAS</b>\n   Fechadas: ${data.closed || 0}\n   Erros: ${data.errors || 0}\n   Total: ${data.total || 0}`);
        } catch (err: any) {
            await reply(`❌ Erro ao fechar posições: ${err.message}`);
        }
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
                this.settings = { ...this.settings, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) };
            }
        } catch (e) {}
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {}
    }

    private static loadSeenTrades() {
        try {
            if (fs.existsSync(this.SEEN_TRADES_PATH)) {
                this.seenTrades = JSON.parse(fs.readFileSync(this.SEEN_TRADES_PATH, 'utf-8'));
            }
        } catch (e) {}
    }

    private static saveSeenTrades() {
        try {
            this.seenTrades = this.seenTrades.slice(-500);
            fs.writeFileSync(this.SEEN_TRADES_PATH, JSON.stringify(this.seenTrades));
        } catch (e) {}
    }
}
