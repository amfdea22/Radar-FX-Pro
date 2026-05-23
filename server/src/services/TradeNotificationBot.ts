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

    static notifyTradeOpened(engine: string, symbol: string, dir: string, lot: number, price: number, sl: number, tp: number) {
        if (!this.settings.enabled || !this.settings.notifyTradeOpen) return;

        TelegramService.sendDice('🏀');

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
            TelegramService.sendDice('🎰');
        } else if (result === 'LOSS') {
            TelegramService.sendDice('🎳');
        } else {
            TelegramService.sendDice('🎲');
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
            const [gold] = await Promise.all([
                axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report').catch(() => ({ data: null }))
            ]);
            const g = gold?.data?.summary;
            const gRobot = gold?.data?.robotSummary;

            const lines = ['<b>📊 RADAR FX | RESUMO DIÁRIO</b>', ''];

            if (g) {
                const dd = new Date().toLocaleDateString('pt-BR');
                lines.push(`<b>📅 Data:</b> ${dd}`);
                lines.push('');
                lines.push(`<b>🥇 GOLD SCALPER</b>`);
                lines.push(`   Trades: ${g.totalTrades || 0}`);
                lines.push(`   Wins: ${g.wins || 0} | Losses: ${g.losses || 0}`);
                lines.push(`   Win Rate: ${g.winRate || 0}%`);
                lines.push(`   P&L: <b>${(g.totalProfit || 0) >= 0 ? '+' : ''}$${(g.totalProfit || 0).toFixed(2)}</b>`);
                lines.push(`   Profit Factor: ${g.profitFactor || 0}`);
            }

            if (gRobot) {
                lines.push('');
                lines.push(`<b>🤖 Apenas Robô:</b>`);
                lines.push(`   Trades: ${gRobot.totalTrades || 0}`);
                lines.push(`   Win Rate: ${gRobot.winRate || 0}%`);
                lines.push(`   P&L: <b>${(gRobot.totalProfit || 0) >= 0 ? '+' : ''}$${(gRobot.totalProfit || 0).toFixed(2)}</b>`);
            }

            lines.push('');
            lines.push(`<i>Bot gerado às ${new Date().toLocaleTimeString('pt-BR')}</i>`);

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
        try {
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report', { timeout: 5000 });
            const trades = resp.data?.trades || [];
            for (const t of trades) {
                const key = t.ticket || t.id;
                if (!key) continue;
                if (!this.seenTrades.some(s => s.ticket === key && s.engine === 'gold')) {
                    this.seenTrades.push({ ticket: key, engine: 'gold' });
                    this.saveSeenTrades();
                    if (t.result !== 'TIE') {
                        this.notifyTradeClosed(
                            'Gold Scalper',
                            'XAUUSD',
                            t.type || 'N/A',
                            t.profit || 0,
                            t.result || 'TIE',
                            t.closeReason || 'N/A',
                            t.lot || 0
                        );
                    }
                }
            }
        } catch (e) {}
    }

    private static async checkRisk() {
        if (!this.settings.enabled || !this.settings.notifyRiskAlerts) return;
        try {
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/risk-report', { timeout: 5000 });
            const data = resp.data;
            if (data?.risk) {
                const dd = data.risk.drawdown || 0;
                if (dd > 20) {
                    this.sendRiskAlert('Gold Scalper', 'Drawdown Alto', `Drawdown de ${dd.toFixed(1)}% — atenção à gestão de risco.`);
                }
                const consecLosses = data.risk.consecutiveLosses || 0;
                if (consecLosses >= 5) {
                    this.sendRiskAlert('Gold Scalper', 'Perdas Consecutivas', `${consecLosses} perdas seguidas — considere pausar.`);
                }
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
                await this.cmdStatus(reply);
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
            '📊 <b>/status</b> — Status do Gold Scalper',
            '💼 <b>/positions</b> — Posições abertas',
            '📅 <b>/summary</b> — Resumo diário',
            '📈 <b>/stats</b> — Estatísticas completas',
            '📋 <b>/trades</b> — Histórico de trades (WIN/LOSS)',
            '🔔 <b>/alerts</b> — Últimos alertas',
            '',
            'O bot também envia notificações automáticas:',
            '• 📈 Abertura de trades',
            '• 📊 Fechamento com P&L',
            '• 🚨 Alertas de risco (drawdown, perdas consecutivas)',
            '• 📅 Resumo diário às 18:00',
            '',
            '<i>Bot v1.1 — Radar FX</i>'
        ].join('\n');
    }

    private static async cmdStatus(reply: (t: string) => Promise<boolean>) {
        try {
            const [s, risk] = await Promise.all([
                axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/status', { timeout: 5000 }).catch(() => ({ data: null })),
                axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/risk-report', { timeout: 5000 }).catch(() => ({ data: null }))
            ]);
            const status = s?.data;
            const acct = risk?.data?.account;
            const rsk = risk?.data?.risk;

            const lines = ['<b>📊 RADAR FX | STATUS</b>', ''];

            if (acct) {
                lines.push(`<b>💰 Conta:</b> ${acct.login} (${acct.broker || 'Pepperstone'})`);
                lines.push(`   Saldo: <b>$${acct.balance?.toFixed(2) || '0.00'}</b>`);
                lines.push(`   Equity: $${acct.equity?.toFixed(2) || '0.00'}`);
                lines.push(`   Margem: ${acct.marginLevel?.toFixed(1) || '0'}%`);
                if (acct.floatingPL !== undefined) {
                    const fl = acct.floatingPL;
                    lines.push(`   Flutuante: <b>${fl >= 0 ? '+' : ''}$${fl.toFixed(2)}</b>`);
                }
            }

            if (status) {
                lines.push('');
                lines.push(`<b>⚙️ Gold Scalper:</b> ${status.enabled ? '✅ ATIVO' : '❌ DESATIVADO'}`);
                if (status.locked) lines.push(`   🔒 Bloqueado`);
            }

            if (rsk) {
                lines.push('');
                lines.push(`<b>📈 Risco:</b>`);
                lines.push(`   Drawdown: ${rsk.drawdown?.toFixed(1) || '0'}%`);
                lines.push(`   Perdas seguidas: ${rsk.consecutiveLosses || 0}`);
                lines.push(`   Trades: ${rsk.totalTrades || 0}`);
                lines.push(`   Limite diário: $${(rsk.dailyLossRemaining || 0).toFixed(2)} restantes`);
            }

            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter status.');
        }
    }

    private static async cmdPositions(reply: (t: string) => Promise<boolean>) {
        try {
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/risk-report', { timeout: 5000 });
            const acct = resp.data?.account;
            const qtd = acct?.openPositions || 0;
            const fl = acct?.floatingPL || 0;

            if (qtd === 0) {
                await reply('📭 Nenhuma posição aberta no momento.');
                return;
            }

            const lines = ['<b>💼 RADAR FX | POSIÇÕES ABERTAS</b>', ''];
            lines.push(`<b>Total:</b> ${qtd} posições`);
            lines.push(`<b>Flutuante:</b> <b>${fl >= 0 ? '+' : ''}$${fl.toFixed(2)}</b>`);
            lines.push(`<b>Equity:</b> $${acct.equity?.toFixed(2) || '0.00'}`);
            lines.push(`<b>Margem:</b> ${acct.marginLevel?.toFixed(1) || '0'}%`);

            if (resp.data?.account?.balance) {
                const pct = (fl / resp.data.account.balance) * 100;
                lines.push(`<b>% Conta:</b> ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`);
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
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report', { timeout: 5000 });
            const s = resp.data?.summary;
            const r = resp.data?.robotSummary;

            if (!s) {
                await reply('❌ Erro ao obter estatísticas.');
                return;
            }

            const lines = ['<b>📈 RADAR FX | ESTATÍSTICAS</b>', ''];

            lines.push(`<b>🥇 GOLD SCALPER</b>`);
            lines.push(`   Trades: ${s.totalTrades}`);
            lines.push(`   Wins: ${s.wins} | Losses: ${s.losses}`);
            lines.push(`   Win Rate: ${s.winRate}%`);
            lines.push(`   P&L Total: <b>${s.totalProfit >= 0 ? '+' : ''}$${s.totalProfit.toFixed(2)}</b>`);
            lines.push(`   Avg Win: $${s.avgWin?.toFixed(2) || '0.00'}`);
            lines.push(`   Avg Loss: -$${s.avgLoss?.toFixed(2) || '0.00'}`);
            lines.push(`   Profit Factor: ${s.profitFactor}`);
            lines.push(`   Best Trade: $${s.bestTrade?.toFixed(2) || '0.00'}`);
            lines.push(`   Worst Trade: -$${Math.abs(s.worstTrade || 0).toFixed(2)}`);

            if (r) {
                lines.push('');
                lines.push(`<b>🤖 Apenas Robô:</b>`);
                lines.push(`   Trades: ${r.totalTrades}`);
                lines.push(`   Wins: ${r.wins} | Losses: ${r.losses}`);
                lines.push(`   Win Rate: ${r.winRate}%`);
                lines.push(`   P&L: <b>${r.totalProfit >= 0 ? '+' : ''}$${r.totalProfit.toFixed(2)}</b>`);
                lines.push(`   Profit Factor: ${r.profitFactor}`);
            }

            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter estatísticas.');
        }
    }

    private static async cmdTrades(reply: (t: string) => Promise<boolean>) {
        try {
            const resp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/report', { timeout: 5000 });
            const trades = resp.data?.trades || [];
            if (trades.length === 0) {
                await reply('📭 Nenhum trade registrado no histórico.');
                return;
            }

            const recent = trades.slice(-30).reverse();
            const lines = ['<b>📋 RADAR FX | HISTÓRICO DE TRADES</b>', ''];

            let lastDate = '';
            let wins = 0, losses = 0, totalPnl = 0;

            for (const t of recent) {
                const d = new Date(t.closeTime || t.openTime);
                const dateStr = d.toLocaleDateString('pt-BR');
                const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                if (dateStr !== lastDate) {
                    lines.push('');
                    lines.push(`<b>━━━ ${dateStr} ━━━</b>`);
                    lastDate = dateStr;
                }

                const emoji = t.result === 'WIN' ? '✅' : t.result === 'LOSS' ? '💣' : '➖';
                const signal = t.profit >= 0 ? '+' : '';
                const dir = t.type === 'BUY' ? '🟢' : '🔴';
                const motivo = t.closeReason || '';
                lines.push(`${emoji} ${dir} ${timeStr} | ${signal}$${t.profit?.toFixed(2) || '0.00'} | ${t.result}${motivo ? ` (${motivo})` : ''}`);

                if (t.result === 'WIN') { wins++; totalPnl += t.profit || 0; }
                else if (t.result === 'LOSS') { losses++; totalPnl += t.profit || 0; }
            }

            lines.push('');
            lines.push(`<b>📊 Resumo (30 trades):</b>`);
            lines.push(`✅ Wins: ${wins} | 💣 Losses: ${losses} | Win Rate: ${(wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : 0}%`);
            lines.push(`<b>P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>`);
            lines.push('');
            lines.push(`<i>${new Date().toLocaleString('pt-BR')}</i>`);

            await reply(lines.join('\n'));
        } catch (e) {
            await reply('❌ Erro ao obter histórico de trades.');
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
