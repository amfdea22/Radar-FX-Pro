import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface TelegramSettings {
    enabled: boolean;
    botToken: string;
    chatId: string;
}

export class TelegramService {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'telegram_settings.json');
    private static settings: TelegramSettings = TelegramService.loadSettings();

    private static loadSettings(): TelegramSettings {
        const defaults = { enabled: false, botToken: '', chatId: '' };
        const envToken = process.env.TELEGRAM_BOT_TOKEN;
        const envChatId = process.env.TELEGRAM_CHAT_ID;
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const fileSettings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8'));
                const merged = { ...defaults, ...fileSettings };
                if (envToken) { merged.botToken = envToken; }
                if (envChatId) { merged.chatId = envChatId; }
                if (envToken || envChatId) {
                    const toSave = { ...merged };
                    delete (toSave as any).botToken;
                    delete (toSave as any).chatId;
                    fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify({ ...fileSettings, _tokenFromEnv: true }, null, 2));
                }
                return merged;
            } catch (e) {
                console.error('TelegramService: Erro ao carregar configurações');
            }
        }
        if (envToken) defaults.botToken = envToken;
        if (envChatId) defaults.chatId = envChatId;
        return defaults;
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('TelegramService: Erro ao salvar configurações');
        }
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

        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: this.settings.chatId,
                text: text,
                parse_mode: 'HTML'
            });
            return true;
        } catch (error: any) {
            console.error('❌ TelegramService: Falha ao enviar mensagem', error.response?.data || error.message);
            return false;
        }
    }

    static async sendToChatId(chatId: string | number, text: string): Promise<boolean> {
        if (!this.settings.enabled || !this.settings.botToken) return false;
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/sendMessage`;
            await axios.post(url, { chat_id: chatId, text, parse_mode: 'HTML' });
            return true;
        } catch (e: any) {
            return false;
        }
    }

    static async getUpdates(offset?: number): Promise<any[]> {
        if (!this.settings.enabled || !this.settings.botToken) return [];
        try {
            const url = `https://api.telegram.org/bot${this.settings.botToken}/getUpdates`;
            const params: any = { timeout: 30 };
            if (offset) params.offset = offset;
            const resp = await axios.get(url, { params, timeout: 35000 });
            return resp.data?.result || [];
        } catch (e) {
            return [];
        }
    }

    static async setMyCommands(): Promise<boolean> {
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
            ];
            await axios.post(url, { commands });
            return true;
        } catch (e: any) {
            console.error('❌ TelegramService: setMyCommands falhou', e.response?.data || e.message);
            return false;
        }
    }

    // Função para formatar o alerta dependendo do tipo
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

        if (details) {
            text += `\n<i>${details}</i>`;
        }

        return text;
    }
}
