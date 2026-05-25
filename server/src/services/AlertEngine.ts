export interface SystemAlert {
    id: string;
    timestamp: Date;
    type: 'DISCIPLINE' | 'INSTITUTIONAL' | 'GUARDIAN' | 'MARKET';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    details?: string;
}

import { TelegramService } from './TelegramService';
import { DatabaseService } from './DatabaseService';

export class AlertEngine {
    private static alerts: SystemAlert[] = [];
    private static MAX_ALERTS = 200;
    private static MAX_ALERT_AGE_MS = 24 * 60 * 60 * 1000;
    private static alertCooldowns = new Map<string, number>();
    private static pruneInterval: ReturnType<typeof setInterval> | null = null;

    static init() {
        this.pruneInterval = setInterval(() => this.pruneOldAlerts(), 30 * 60 * 1000);
    }

    private static pruneOldAlerts() {
        const cutoff = Date.now() - this.MAX_ALERT_AGE_MS;
        const before = this.alerts.length;
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
        if (this.alerts.length < before) {
            this.cleanupCooldowns();
            console.log(`📡 AlertEngine: Limpeza de alertas antigos — ${before - this.alerts.length} removidos`);
        }
    }

    private static cleanupCooldowns() {
        const cutoff = Date.now() - 120000;
        for (const [key, ts] of this.alertCooldowns) {
            if (ts < cutoff) this.alertCooldowns.delete(key);
        }
    }

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
        console.log(`📡 AlertEngine: Alert added [${type}] ${severity} - ${message}`);

        // Dual-write to Prisma (async, non-blocking)
        DatabaseService.saveAlert({
            type, severity, source: type, message,
            symbol: details?.includes(':') ? details.split(':')[0].trim() : undefined,
        }).catch(() => {});

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
            this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
        }
    }

    static getAlerts(): SystemAlert[] {
        return this.alerts;
    }

    static getStats() {
        return {
            total: this.alerts.length,
            bySeverity: {
                CRITICAL: this.alerts.filter(a => a.severity === 'CRITICAL').length,
                WARNING: this.alerts.filter(a => a.severity === 'WARNING').length,
                INFO: this.alerts.filter(a => a.severity === 'INFO').length,
            },
            byType: {
                DISCIPLINE: this.alerts.filter(a => a.type === 'DISCIPLINE').length,
                INSTITUTIONAL: this.alerts.filter(a => a.type === 'INSTITUTIONAL').length,
                GUARDIAN: this.alerts.filter(a => a.type === 'GUARDIAN').length,
                MARKET: this.alerts.filter(a => a.type === 'MARKET').length,
            }
        };
    }
}
