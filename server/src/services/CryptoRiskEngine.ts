import { AlertEngine } from './AlertEngine';
import fs from 'fs';
import path from 'path';

export type RiskProfile = 'conservative' | 'intermediate' | 'aggressive';
export type AccountSize = 'small' | 'medium' | 'large';

interface CryptoRiskSettings {
    capital: number;
    profile: RiskProfile;
    accountSize: AccountSize;
    dailyStopLoss: number;
    suggestedLots: number;
    isActive: boolean;
}

export class CryptoRiskEngine {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'crypto_risk_settings.json');

    private static settings: CryptoRiskSettings = this.loadSettings();

    private static currentDailyLoss: number = 0; // Perda acumulada no dia
    private static isBlocked: boolean = false; // Bloqueio ativo por stop diário

    private static loadSettings(): CryptoRiskSettings {
        const defaults: CryptoRiskSettings = {
            capital: 1000,
            profile: 'conservative',
            accountSize: 'small',
            dailyStopLoss: 50,
            suggestedLots: 0.01,
            isActive: true
        };

        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                return { ...defaults, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) };
            } catch (e) {
                console.error('CryptoRiskEngine: Erro ao carregar settings');
            }
        }
        return defaults;
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('CryptoRiskEngine: Erro ao salvar settings');
        }
    }

    /**
     * Atualiza as configurações de risco e recalcula
     */
    static updateSettings(newSettings: Partial<CryptoRiskSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();

        // Se mudou o stop loss e a perda já estourou
        if (this.currentDailyLoss >= this.settings.dailyStopLoss && !this.isBlocked) {
            this.triggerDailyStop();
        } else if (this.currentDailyLoss < this.settings.dailyStopLoss && this.isBlocked) {
            this.isBlocked = false;
            console.log("🛡️ CryptoRiskGuard: Risco ajustado, desbloqueio de operações Cripto.");
            AlertEngine.addAlert('GUARDIAN', 'INFO', 'Risk Guard Cripto', `Stop Diário estendido para $${this.settings.dailyStopLoss}. Criptos desbloqueadas.`);
        }
    }

    /**
     * Retorna estado atual das métricas de risco
     */
    static getStatus() {
        return {
            settings: this.settings,
            currentDailyLoss: this.currentDailyLoss,
            isBlocked: this.isBlocked
        };
    }

    /**
     * Registra o resultado financeiro de um trade Cripto fechado.
     * Retorna true se bloqueou a conta por bater no limite de prejuízo.
     */
    static registerTradeResult(profit: number): boolean {
        if (!this.settings.isActive) return false;

        // Se deu loss, acumula na contagem diária. (Se deu gain no dia, reduz o prejuízo acumulado)
        if (profit < 0) {
            this.currentDailyLoss += Math.abs(profit);
            console.log(`🛡️ CryptoRiskGuard: Perda registrada: $${Math.abs(profit)}. Acumulado: $${this.currentDailyLoss}/${this.settings.dailyStopLoss}`);

            if (this.currentDailyLoss >= this.settings.dailyStopLoss && !this.isBlocked) {
                this.triggerDailyStop();
                return true;
            }
        } else {
            // Profit diminui o loss acumulado (Drawdown recovery)
            this.currentDailyLoss = Math.max(0, this.currentDailyLoss - profit);
        }

        return false;
    }

    /**
     * Verifica se o sistema pode abrir nova ordem Cripto baseada no risco.
     */
    static canOpenCryptoTrade(): boolean {
        if (!this.settings.isActive) return true;

        if (this.isBlocked) {
            console.warn(`🛑 CryptoRiskGuard: Operação bloqueada. Stop Diário Cripto Atingido ($${this.settings.dailyStopLoss}).`);
            return false;
        }

        return true;
    }

    /**
     * Aciona o bloqueio de segurança
     */
    private static triggerDailyStop() {
        this.isBlocked = true;
        console.warn(`🚨 CryptoRiskGuard: STOP DIÁRIO ATINGIDO! ($${this.settings.dailyStopLoss}) - Operações Cripto Bloqueadas para proteger a conta.`);
        AlertEngine.addAlert('GUARDIAN', 'CRITICAL', 'Stop Cripto Atingido', `Limite de perda de $${this.settings.dailyStopLoss} alcançado. Bloqueio algorítmico ativado.`);
    }

    /**
     * Reseta as travas diárias (ex: meia-noite servidor)
     */
    static resetDailyLimits() {
        this.currentDailyLoss = 0;
        this.isBlocked = false;
        console.log("🛡️ CryptoRiskGuard: Limites diários resetados.");
    }
}
