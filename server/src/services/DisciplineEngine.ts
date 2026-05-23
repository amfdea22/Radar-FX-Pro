import fs from 'fs';
import path from 'path';
import { BridgeClient } from './BridgeClient';
import { TradeGuardian } from './TradeGuardian';
import { SignalEngine } from './SignalEngine';
import { InstitutionalEngine } from './InstitutionalEngine';
import { AlertEngine } from './AlertEngine';
import { AlphaRobotEngine } from './AlphaRobotEngine';
import { SupremeEngine } from './SupremeEngine';

interface DisciplineSettings {
    dailyStopLoss: number;
    dailyTakeProfit: number;
    maxTradesPerDay: number;
    maxConsecutiveLosses: number;
    resetTimestamp?: number; // Timestamp para ignorar trades anteriores
    manualStopLossUSD: number;
    manualTakeProfitUSD: number;
}

export class DisciplineEngine {
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'discipline_settings.json');
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static lastAlertState = false;

    // Configurações padrão: Eficiência Acadêmica
    private static settings: DisciplineSettings = this.loadSettings();

    private static loadSettings(): DisciplineSettings {
        const defaults: DisciplineSettings = {
            dailyStopLoss: 30,    // 3% de R$ 1000
            dailyTakeProfit: 50,  // 5% de R$ 1000
            maxTradesPerDay: 10,
            maxConsecutiveLosses: 3,
            resetTimestamp: 0,
            manualStopLossUSD: 5.0,  // Proteção padrão de $5 para ordens manuais
            manualTakeProfitUSD: 10.0 // Alvo padrão de $10 para ordens manuais
        };

        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                return { ...defaults, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) };
            } catch (e) {
                console.error('DisciplineEngine: Erro ao carregar settings');
            }
        }
        return defaults;
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('DisciplineEngine: Erro ao salvar settings');
        }
    }

    static updateSettings(newSettings: Partial<DisciplineSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    static async getDailyStatus() {
        try {
            const history = await BridgeClient.getHistory();
            const now = BridgeClient.getServerTime();

            const calculateStats = (days: number) => {
                const startTime = now - (days * 24 * 60 * 60);
                const trades = history
                    .filter((d: any) => d.time >= startTime && d.entry === 1);

                const profit = trades.reduce((sum: number, t: any) => sum + t.profit, 0);
                const winTrades = trades.filter((t: any) => t.profit > 0).length;
                const winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;

                return {
                    profit: Number(profit.toFixed(2)),
                    tradeCount: trades.length,
                    winRate: Number(winRate.toFixed(1))
                };
            };

            const dayStart = now - (now % 86400);
            const filterStart = Math.max(dayStart, this.settings.resetTimestamp || 0);
            const todayTrades = history
                .filter((d: any) => d.time >= filterStart && d.entry === 1)
                .sort((a: any, b: any) => b.time - a.time);

            const dailyNetProfit = todayTrades.reduce((sum: number, t: any) => sum + t.profit, 0);
            const tradeCount = todayTrades.length;

            let consecutiveLosses = 0;
            for (const trade of todayTrades) {
                if (trade.profit < 0) {
                    consecutiveLosses++;
                } else if (trade.profit > 0) {
                    break;
                }
            }

            const isDailyStopHit = dailyNetProfit <= -this.settings.dailyStopLoss;
            const isDailyTargetHit = dailyNetProfit >= this.settings.dailyTakeProfit;
            const isMaxTradesHit = tradeCount >= this.settings.maxTradesPerDay;
            const isMaxConsecutiveLossesHit = consecutiveLosses >= this.settings.maxConsecutiveLosses;

            const isLocked = isDailyStopHit || isMaxTradesHit || isMaxConsecutiveLossesHit || isDailyTargetHit;
            const reason = isLocked ? (isDailyStopHit ? 'STOP LOSS DIÁRIO ATINGIDO' :
                isDailyTargetHit ? 'META DIÁRIA BATIDA (STOP WIN)' :
                    isMaxTradesHit ? 'LIMITE DE OPERAÇÕES ATINGIDO' :
                        isMaxConsecutiveLossesHit ? 'SEQUÊNCIA DE PERDAS (DISCIPLINA)' : 'BLOQUEIO DE SEGURANÇA') : null;

            if (isLocked && !this.lastAlertState && reason) {
                AlertEngine.addAlert('DISCIPLINE', 'CRITICAL', reason, `Resultado: ${dailyNetProfit} / Meta: ${this.settings.dailyTakeProfit}`);
            }
            this.lastAlertState = isLocked;

            return {
                profit: Number(dailyNetProfit.toFixed(2)),
                tradeCount,
                consecutiveLosses,
                limits: this.settings,
                isSafe: !isLocked,
                isLocked: isLocked,
                reason: reason,
                history: {
                    today: calculateStats(1),
                    d3: calculateStats(3),
                    w1: calculateStats(7),
                    m1: calculateStats(30)
                },
                pulse: {
                    guardian: TradeGuardian.getStatus(),
                    signals: SignalEngine.getStatus(),
                    intelligence: InstitutionalEngine.getStatus()
                }
            };
        } catch (error: any) {
            console.error('❌ DisciplineEngine Error:', error.message);
            const now = BridgeClient.getServerTime();
            const isRecentReset = this.settings.resetTimestamp && (now - this.settings.resetTimestamp < 60);

            return {
                profit: 0,
                tradeCount: 0,
                consecutiveLosses: 0,
                limits: this.settings,
                isSafe: isRecentReset,
                isLocked: !isRecentReset,
                reason: isRecentReset ? null : 'ERRO DE SINCRONIZAÇÃO MT5',
                history: { today: { profit: 0, tradeCount: 0, winRate: 0 }, d3: { profit: 0, tradeCount: 0, winRate: 0 }, w1: { profit: 0, tradeCount: 0, winRate: 0 }, m1: { profit: 0, tradeCount: 0, winRate: 0 } }
            };
        }
    }

    static async reset() {
        console.log('🔓 Alpha Discipline: Iniciando Reset Atômico...');
        const now = BridgeClient.getServerTime();

        // PASSO 1: RESET INSTANTÂNEO (now+1 para excluir trades do mesmo segundo)
        this.settings.resetTimestamp = now + 1;
        this.saveSettings();

        // PASSO 2: PROPAGAÇÃO PARA ROBÔS
        try {
            AlphaRobotEngine.onEmergencyReset();
            SupremeEngine.onEmergencyReset();
        } catch (e) { }

        // PASSO 3: SINCRONIA COM O BROKER
        try {
            const history = await BridgeClient.getHistory();
            let maxBrokerTime = 0;
            if (history && history.length > 0) {
                for (let i = 0; i < history.length; i++) {
                    if (history[i].time > maxBrokerTime) maxBrokerTime = history[i].time;
                }
            }
            this.settings.resetTimestamp = Math.max(maxBrokerTime, now) + 1;
            this.saveSettings();
        } catch (e) { }

        console.log('🔓 Alpha Discipline: Reset persistido com sucesso.');
    }
}
