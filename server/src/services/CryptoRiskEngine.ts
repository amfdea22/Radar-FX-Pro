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

    private static currentDailyLoss: number = 0;
    private static isBlocked: boolean = false;
    private static engineDailyLoss: Map<string, number> = new Map();
    private static engineBlocked: Set<string> = new Set();

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
            isBlocked: this.isBlocked,
            engineBlocked: Array.from(this.engineBlocked),
            engineDailyLoss: Object.fromEntries(this.engineDailyLoss)
        };
    }

    static registerTradeResult(profit: number, engineName?: string): boolean {
        if (!this.settings.isActive) return false;

        if (profit < 0) {
            this.currentDailyLoss += Math.abs(profit);
            console.log(`🛡️ CryptoRiskGuard: Perda registrada: $${Math.abs(profit)}. Acumulado: $${this.currentDailyLoss}/${this.settings.dailyStopLoss}`);

            if (engineName) {
                const engLoss = (this.engineDailyLoss.get(engineName) || 0) + Math.abs(profit);
                this.engineDailyLoss.set(engineName, engLoss);
                if (engLoss >= this.settings.dailyStopLoss * 0.5 && !this.engineBlocked.has(engineName)) {
                    this.engineBlocked.add(engineName);
                    console.warn(`🚨 CryptoRiskGuard: ${engineName} bloqueado por perda de $${engLoss.toFixed(2)}`);
                    AlertEngine.addAlert('GUARDIAN', 'WARNING', `${engineName} Bloqueado`, `Perda de $${engLoss.toFixed(2)}. Motor bloqueado.`);
                }
            }

            if (this.currentDailyLoss >= this.settings.dailyStopLoss && !this.isBlocked) {
                this.triggerDailyStop();
                return true;
            }
        } else {
            this.currentDailyLoss = Math.max(0, this.currentDailyLoss - profit);
        }

        return false;
    }

    static canOpenCryptoTrade(engineName?: string): boolean {
        if (!this.settings.isActive) return true;

        if (this.isBlocked) {
            console.warn(`🛑 CryptoRiskGuard: Operação bloqueada. Stop Diário Cripto Atingido ($${this.settings.dailyStopLoss}).`);
            return false;
        }

        if (engineName && this.engineBlocked.has(engineName)) {
            console.warn(`🛑 CryptoRiskGuard: Motor ${engineName} bloqueado por perda.`);
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
        this.engineDailyLoss.clear();
        this.engineBlocked.clear();
        console.log("🛡️ CryptoRiskGuard: Limites diários resetados.");
    }
}
