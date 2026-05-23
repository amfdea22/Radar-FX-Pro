export interface SystemAlert {
    id: string;
    timestamp: Date;
    type: 'DISCIPLINE' | 'INSTITUTIONAL' | 'GUARDIAN' | 'MARKET';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    details?: string;
}

import { TelegramService } from './TelegramService';

export class AlertEngine {
    private static alerts: SystemAlert[] = [];
    private static MAX_ALERTS = 50;
    private static alertCooldowns = new Map<string, number>();

    static addAlert(type: SystemAlert['type'], severity: SystemAlert['severity'], message: string, details?: string) {
        const newAlert: SystemAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            severity,
            message,
            details
        };

        this.alerts.unshift(newAlert);
        console.log(`📡 AlertEngine: Alert added [${type}] - ${message}`);

        // Disparo para o Telegram com dedup de 60s por tipo+mensagem
        const dedupKey = `${type}:${message}`;
        const lastSent = this.alertCooldowns.get(dedupKey) || 0;
        if (severity === 'CRITICAL' || severity === 'WARNING' || message.includes('Meta') || message.includes('Novo Trade')) {
            if (Date.now() - lastSent > 60000) {
                this.alertCooldowns.set(dedupKey, Date.now());
                const formatted = TelegramService.formatAlertMessage(type, severity, message, details);
                TelegramService.sendMessage(formatted);
            }
        }
        if (this.alerts.length > this.MAX_ALERTS) {
            this.alerts.pop();
        }
    }

    static getAlerts(): SystemAlert[] {
        return this.alerts;
    }
}
