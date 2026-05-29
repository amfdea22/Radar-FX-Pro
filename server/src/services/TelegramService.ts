import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface TelegramSettings {
    enabled: boolean;
    botToken: string;
    chatId: string;
}

interface QueuedMessage {
    id: number;
    chatId: string | number;
    text: string;
    retries: number;
    lastAttempt: number;
}

interface TelegramAnalytics {
    totalSent: number;
    totalFailed: number;
    byErrorType: Record<string, number>;
    byCommand: Record<string, number>;
    startedAt: number;
}

export class TelegramService {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'telegram_settings.json');
    private static QUEUE_PATH = path.resolve(process.cwd(), 'telegram_queue.json');
    private static ANALYTICS_PATH = path.resolve(process.cwd(), 'telegram_analytics.json');
    private static settings: TelegramSettings = TelegramService.loadSettings();

    private static messageQueue: QueuedMessage[] = [];
    private static queueIdCounter = 0;
    private static isProcessing = false;
    private static lastSendTime = 0;
    private static readonly MIN_INTERVAL_MS = 1200;
    private static consecutive429 = 0;
    private static backoffUntil = 0;
    private static readonly MAX_BACKOFF_MS = 300000;
    private static readonly MAX_QUEUE_SIZE = 1000;
    private static queueTimer: ReturnType<typeof setInterval> | null = null;

    private static analytics: TelegramAnalytics = {
        totalSent: 0,
        totalFailed: 0,
        byErrorType: {},
        byCommand: {},
        startedAt: Date.now(),
    };

    static startQueue() {
        if (this.queueTimer) return;
        TelegramService.loadAnalytics();
        TelegramService.loadQueue();
        this.queueTimer = setInterval(() => this.processQueue(), 1000);
    }

    static stopQueue() {
        if (this.queueTimer) {
            clearInterval(this.queueTimer);
            this.queueTimer = null;
        }
        TelegramService.saveQueue();
        TelegramService.saveAnalytics();
    }

    static getAnalytics(): TelegramAnalytics {
        return { ...this.analytics };
    }

    static trackCommand(cmd: string) {
        this.analytics.byCommand[cmd] = (this.analytics.byCommand[cmd] || 0) + 1;
    }

    static resetBackoff() {
        this.consecutive429 = 0;
        this.backoffUntil = 0;
    }

    static async setWebhook(): Promise<boolean> {
        const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
        if (!webhookUrl || !this.settings.botToken) return false;
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/setWebhook`;
            await axios.post(url, {
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query'],
            }, { timeout: 10000 });
            return true;
        } catch (e: any) {
            console.error('❌ TelegramService: setWebhook falhou', e.response?.data || e.message);
            return false;
        }
    }

    static async deleteWebhook(): Promise<boolean> {
        if (!this.settings.botToken) return false;
        try {
            await axios.get(`https://api.telegram.org/bot${this.settings.botToken}/deleteWebhook`, { timeout: 5000 });
            return true;
        } catch { return false; }
    }

    static async processWebhookUpdate(body: any): Promise<any[]> {
        const updates = body?.callback_query ? [body] : body?.message ? [body] : [];
        return updates;
    }

    private static loadSettings(): TelegramSettings {
        const defaults = { enabled: false, botToken: '', chatId: '' };
        const envToken = process.env.TELEGRAM_BOT_TOKEN || '';
        const envChatId = process.env.TELEGRAM_CHAT_ID || '';

        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const fileSettings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8'));
                const merged = { ...defaults, ...fileSettings };
                if (envToken) merged.botToken = envToken;
                if (envChatId) merged.chatId = envChatId;
                if (envToken || envChatId) {
                    const toSave: any = { ...fileSettings };
                    delete toSave.botToken;
                    delete toSave.chatId;
                    toSave._tokenFromEnv = true;
                    fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(toSave, null, 2));
                }
                return merged;
            } catch (e) {
                console.error('❌ TelegramService: Erro ao carregar configurações');
            }
        }
        if (envToken) defaults.botToken = envToken;
        if (envChatId) defaults.chatId = envChatId;
        return defaults;
    }

    private static saveSettings() {
        try {
            const toSave: any = { ...this.settings };
            const envToken = process.env.TELEGRAM_BOT_TOKEN || '';
            const envChatId = process.env.TELEGRAM_CHAT_ID || '';
            if (envToken) { delete toSave.botToken; toSave._tokenFromEnv = true; }
            if (envChatId) { delete toSave.chatId; }
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(toSave, null, 2));
        } catch (e) {
            console.error('❌ TelegramService: Erro ao salvar configurações');
        }
    }

    private static loadAnalytics() {
        try {
            if (fs.existsSync(this.ANALYTICS_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.ANALYTICS_PATH, 'utf-8'));
                if (data && typeof data.totalSent === 'number') {
                    this.analytics = data;
                }
            }
        } catch { /* ignore */ }
    }

    private static saveAnalytics() {
        try {
            fs.writeFileSync(this.ANALYTICS_PATH, JSON.stringify(this.analytics, null, 2));
        } catch { /* ignore */ }
    }

    private static loadQueue() {
        try {
            if (fs.existsSync(this.QUEUE_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.QUEUE_PATH, 'utf-8'));
                if (Array.isArray(data)) {
                    this.messageQueue = data;
                    this.queueIdCounter = this.messageQueue.reduce((max, m) => Math.max(max, m.id), 0) + 1;
                }
            }
        } catch (e) {
            this.messageQueue = [];
        }
    }

    private static saveQueue() {
        try {
            const toSave = this.messageQueue.slice(0, this.MAX_QUEUE_SIZE);
            fs.writeFileSync(this.QUEUE_PATH, JSON.stringify(toSave, null, 2));
        } catch { /* ignore */ }
    }

    static getSettings(): TelegramSettings {
        return this.settings;
    }

    static updateSettings(newSettings: Partial<TelegramSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        console.log('📱 TelegramService: Configurações atualizadas', { enabled: this.settings.enabled, chatId: this.settings.chatId });
    }

    static async sendMessage(text: string): Promise<boolean> {
        if (!this.settings.enabled) {
            console.error('❌ TelegramService: sendMessage falhou - serviço desabilitado');
            return false;
        }
        if (!this.settings.botToken || this.settings.botToken.length < 10) {
            console.error('❌ TelegramService: sendMessage falhou - token inválido');
            return false;
        }
        if (!this.settings.chatId) {
            console.error('❌ TelegramService: sendMessage falhou - chatId vazio');
            return false;
        }

        this.messageQueue.push({
            id: this.queueIdCounter++,
            chatId: this.settings.chatId,
            text,
            retries: 0,
            lastAttempt: 0
        });
        if (this.messageQueue.length > this.MAX_QUEUE_SIZE) {
            this.messageQueue = this.messageQueue.slice(-this.MAX_QUEUE_SIZE);
        }
        this.saveQueue();
        return true;
    }

    static async sendToChatId(chatId: string | number, text: string): Promise<boolean> {
        if (!this.settings.enabled || !this.settings.botToken) return false;
        this.messageQueue.push({
            id: this.queueIdCounter++,
            chatId,
            text,
            retries: 0,
            lastAttempt: 0
        });
        if (this.messageQueue.length > this.MAX_QUEUE_SIZE) {
            this.messageQueue = this.messageQueue.slice(-this.MAX_QUEUE_SIZE);
        }
        this.saveQueue();
        return true;
    }

    private static async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) return;

        if (Date.now() < this.backoffUntil) return;
        if (Date.now() - this.lastSendTime < this.MIN_INTERVAL_MS) return;

        this.isProcessing = true;
        try {
            const msg = this.messageQueue[0];
            const elapsed = Date.now() - msg.lastAttempt;
            const delay = 5000 * Math.pow(2, msg.retries);
            if (msg.retries > 0 && elapsed < delay) {
                this.isProcessing = false;
                return;
            }

            const ok = await this.doSend(msg.chatId, msg.text);
            if (ok) {
                this.messageQueue.shift();
                this.consecutive429 = 0;
                this.analytics.totalSent++;
                this.saveQueue();
                this.saveAnalytics();
            } else {
                msg.retries++;
                msg.lastAttempt = Date.now();
                this.analytics.totalFailed++;
                this.analytics.byErrorType['retry'] = (this.analytics.byErrorType['retry'] || 0) + 1;
                this.saveAnalytics();
                if (msg.retries >= 10) {
                    this.messageQueue.shift();
                    this.saveQueue();
                }
            }
        } catch (e) {
            console.error('❌ TelegramService: Erro no processQueue', e);
        } finally {
            this.isProcessing = false;
        }
    }

    private static async doSend(chatId: string | number, text: string): Promise<boolean> {
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }, { timeout: 10000 });
            this.lastSendTime = Date.now();
            return true;
        } catch (error: any) {
            const status = error.response?.status;
            const data = error.response?.data;
            const desc = data?.description || error.message;

            if (status === 429) {
                this.consecutive429++;
                const retryAfter = data?.parameters?.retry_after || (5 * Math.pow(2, Math.min(this.consecutive429, 5)));
                this.backoffUntil = Date.now() + Math.min(retryAfter * 1000, this.MAX_BACKOFF_MS);
                console.error(`⏳ Telegram 429: aguardando ${retryAfter}s (backoff #${this.consecutive429})`);
                this.analytics.byErrorType['429'] = (this.analytics.byErrorType['429'] || 0) + 1;
                this.saveAnalytics();
                return false;
            }

            if (status === 403) {
                console.error('❌ Telegram 403: Bot bloqueado pelo usuário. Desativando Telegram.');
                this.analytics.byErrorType['403'] = (this.analytics.byErrorType['403'] || 0) + 1;
                this.saveAnalytics();
                this.updateSettings({ enabled: false });
                this.messageQueue = [];
                this.saveQueue();
                return false;
            }

            if (status === 400) {
                console.error(`❌ Telegram 400: ${desc}`);
                this.analytics.byErrorType['400'] = (this.analytics.byErrorType['400'] || 0) + 1;
                this.saveAnalytics();
                this.messageQueue.shift();
                this.saveQueue();
                return false;
            }

            if (status && status >= 500) {
                console.error(`❌ Telegram ${status}: erro no servidor Telegram. ${desc}`);
                this.analytics.byErrorType[`${status}`] = (this.analytics.byErrorType[`${status}`] || 0) + 1;
                this.saveAnalytics();
                return false;
            }

            console.error(`❌ Telegram: erro ${status || 'desconhecido'} - ${desc}`);
            this.analytics.byErrorType['unknown'] = (this.analytics.byErrorType['unknown'] || 0) + 1;
            this.saveAnalytics();
            return false;
        }
    }

    static async getUpdates(offset?: number): Promise<any[]> {
        if (!this.settings.enabled || !this.settings.botToken) return [];
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/getUpdates`;
            const resp = await axios.get(url, {
                params: { offset, timeout: 10, allowed_updates: ['message', 'callback_query'] },
                timeout: 15000
            });
            return resp.data?.result || [];
        } catch (e: any) {
            if (e.response?.status === 429) {
                const retryAfter = e.response?.data?.parameters?.retry_after || 5;
                this.backoffUntil = Date.now() + Math.min(retryAfter * 1000, this.MAX_BACKOFF_MS);
            }
            return [];
        }
    }

    static async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
        if (!this.settings.botToken) return false;
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/answerCallbackQuery`;
            await axios.post(url, { callback_query_id: callbackQueryId, text }, { timeout: 5000 });
            return true;
        } catch { return false; }
    }

    static async setMyCommands(adminChatIds?: string[]): Promise<boolean> {
        if (!this.settings.enabled || !this.settings.botToken) return false;
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/setMyCommands`;
            const commands = [
                { command: 'start', description: 'Iniciar bot e ver menu' },
                { command: 'menu', description: 'Exibir lista de comandos' },
                { command: 'status', description: 'Status geral de todos os robos' },
                { command: 'positions', description: 'Posicoes abertas' },
                { command: 'summary', description: 'Resumo diario de performance' },
                { command: 'stats', description: 'Estatisticas por robo' },
                { command: 'relatorio', description: 'Relatorio detalhado de desempenho' },
                { command: 'comprar', description: 'Abrir COMPRA manual: /comprar SYMBOL LOT' },
                { command: 'vender', description: 'Abrir VENDA manual: /vender SYMBOL LOT' },
                { command: 'fechar', description: 'Fechar trade por ticket: /fechar TICKET' },
                { command: 'fechartudo', description: 'Fechar todas as posicoes' },
                { command: 'alerts', description: 'Ultimos alertas' },
                { command: 'trades', description: 'Historico WIN/LOSS de todos robos' },
                { command: 'setdaily', description: 'Configurar horario resumo diario: /setdaily HH:MM' },
                { command: 'cancel', description: 'Cancelar operacao atual' },
                { command: 'ml', description: 'Previsao IA para todos os simbolos' },
            ];

            const payload: any = { commands };

            if (adminChatIds && adminChatIds.length > 0) {
                payload.scope = {
                    type: 'chat',
                    chat_id: isNaN(Number(adminChatIds[0])) ? adminChatIds[0] : Number(adminChatIds[0]),
                };
            }

            await axios.post(url, payload, { timeout: 10000 });
            return true;
        } catch (e: any) {
            console.error('❌ TelegramService: setMyCommands falhou', e.response?.data || e.message);
            return false;
        }
    }

    static formatAlertMessage(type: string, severity: string, message: string, details?: string): string {
        const emojis: Record<string, string> = {
            'INFO': 'ℹ️',
            'WARNING': '⚠️',
            'CRITICAL': '🚨'
        };
        const severityEmoji = emojis[severity] || '🔔';
        let text = `<b>${severityEmoji} RADAR FX | ALERTA</b>\n\n`;
        text += `<b>Módulo:</b> ${type}\n`;
        text += `<b>Status:</b> ${message}\n`;
        if (details) text += `\n<i>${details}</i>`;
        return text;
    }

    static buildInlineKeyboard(buttons: { text: string; callback_data: string }[][]): any {
        return { inline_keyboard: buttons };
    }
}
