import fs from 'fs';
import path from 'path';
import axios from 'axios';

interface BackupEntry {
    file: string;
    timestamp: string;
    size: number;
}

export class InfraService {
    private static BACKUP_DIR = path.resolve(process.cwd(), 'backups');
    private static MAX_BACKUP_DAYS = 7;
    private static CRITICAL_FILES = [
        'alpha_robot_settings.json', 'alpha_robot_history.json',
        'gold_scalper_settings.json', 'gold_scalper_history.json',
        'crypto_ia_settings.json', 'crypto_ia_data.json',
        'supreme_ia_settings.json', 'alpha_supreme_history.json',
        'shark_bot_settings.json', 'forex_scalper_settings.json',
        'micro_scalper_settings.json', 'omni_probabilistic_settings.json',
        'telegram_settings.json', 'trading_journal.json',
        'motor_ia_settings.json', 'motor_ia_history.json', 'motor_ia_learning.json',
        'discipline_settings.json', 'guardian_settings.json',
        'data/alpha_audit_history.json', 'data/signal_tracker.json', 'data/ml_weights.json',
    ];
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static isRunning = false;

    static init() {
        if (this.isRunning) return;
        this.isRunning = true;
        if (!fs.existsSync(this.BACKUP_DIR)) fs.mkdirSync(this.BACKUP_DIR, { recursive: true });

        setInterval(() => this.dailyBackup(), 60 * 60 * 1000);
        setInterval(() => this.pruneOldBackups(), 6 * 60 * 60 * 1000);
        setInterval(() => this.checkBridgeHealth(), 60 * 1000);
        setInterval(() => this.cleanupSignalTracker(), 30 * 60 * 1000);

        this.dailyBackup();
        console.log('🏗️ InfraService: Rotação de logs, backups e monitoramento ativos');
    }

    private static dailyBackup() {
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const backupLogPath = path.join(this.BACKUP_DIR, 'backup_log.json');
            let log: BackupEntry[] = [];
            try { log = JSON.parse(fs.readFileSync(backupLogPath, 'utf-8')); } catch { }

            for (const relPath of this.CRITICAL_FILES) {
                const srcPath = path.resolve(process.cwd(), relPath);
                if (!fs.existsSync(srcPath)) continue;
                const dir = path.dirname(relPath);
                const backupDest = dir !== '.'
                    ? path.join(this.BACKUP_DIR, dateStr, dir)
                    : path.join(this.BACKUP_DIR, dateStr);
                if (!fs.existsSync(backupDest)) fs.mkdirSync(backupDest, { recursive: true });
                const destFile = path.join(backupDest, path.basename(relPath));
                fs.copyFileSync(srcPath, destFile);
                log.push({ file: relPath, timestamp: new Date().toISOString(), size: fs.statSync(srcPath).size });
            }

            if (log.length > 1000) log = log.slice(-1000);
            fs.writeFileSync(backupLogPath, JSON.stringify(log, null, 2));
            console.log(`🏗️ InfraService: Backup diário concluído — ${dateStr} (${this.CRITICAL_FILES.filter(f => fs.existsSync(path.resolve(process.cwd(), f))).length} arquivos)`);
        } catch (e) {
            console.error('🏗️ InfraService: Erro no backup diário', e);
        }
    }

    private static pruneOldBackups() {
        try {
            const cutoff = Date.now() - this.MAX_BACKUP_DAYS * 24 * 60 * 60 * 1000;
            const items = fs.readdirSync(this.BACKUP_DIR);
            let pruned = 0;
            for (const item of items) {
                if (item === 'backup_log.json') continue;
                const itemPath = path.join(this.BACKUP_DIR, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory() && stat.mtimeMs < cutoff) {
                    this.rmRecursive(itemPath);
                    pruned++;
                }
            }
            if (pruned > 0) console.log(`🏗️ InfraService: Backup antigo removido — ${pruned} pasta(s)`);
        } catch (e) {
            console.error('🏗️ InfraService: Erro ao limpar backups antigos', e);
        }
    }

    private static rmRecursive(dir: string) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) this.rmRecursive(full);
                else fs.unlinkSync(full);
            }
            fs.rmdirSync(dir);
        } catch { }
    }

    private static async checkBridgeHealth() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/health`, { timeout: 5000 });
            if (resp.data?.status === 'connected') return;
        } catch {
            console.warn('🏗️ InfraService: Bridge MT5 desconectada — tentando reconexão...');
            try {
                const loginData = this.getStoredLogin();
                if (loginData) {
                    await axios.post(`${this.BRIDGE_URL}/login`, loginData, { timeout: 10000 });
                    console.log('🏗️ InfraService: Bridge MT5 reconectada com sucesso!');
                }
            } catch (e2) {
                console.error('🏗️ InfraService: Falha na reconexão da Bridge', e2);
            }
        }
    }

    private static getStoredLogin(): any | null {
        try {
            const envPath = path.resolve(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                const env = fs.readFileSync(envPath, 'utf-8');
                const login = env.split('\n').find(l => l.startsWith('MT5_LOGIN='))?.split('=')[1]?.trim();
                const password = env.split('\n').find(l => l.startsWith('MT5_PASSWORD='))?.split('=')[1]?.trim();
                const server = env.split('\n').find(l => l.startsWith('MT5_SERVER='))?.split('=')[1]?.trim();
                if (login && password) return { login, password, server: server || '' };
            }
        } catch { }
        return null;
    }

    private static cleanupSignalTracker() {
        try {
            const trackerPath = path.resolve(process.cwd(), 'data', 'signal_tracker.json');
            if (!fs.existsSync(trackerPath)) return;
            const data = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
            if (!Array.isArray(data)) return;
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const filtered = data.filter((e: any) => {
                const ts = e.timestamp || e.time || e.date || 0;
                return new Date(ts).getTime() > cutoff;
            });
            if (filtered.length < data.length) {
                fs.writeFileSync(trackerPath, JSON.stringify(filtered, null, 2));
                console.log(`🏗️ InfraService: signal_tracker.json podado — ${data.length - filtered.length} entradas removidas`);
            }
        } catch (e) {
            console.error('🏗️ InfraService: Erro ao limpar signal_tracker.json', e);
        }
    }

    static getBackupInfo() {
        try {
            const backupLogPath = path.join(this.BACKUP_DIR, 'backup_log.json');
            if (!fs.existsSync(backupLogPath)) return { lastBackup: null, totalBackups: 0, totalFiles: 0 };
            const log: BackupEntry[] = JSON.parse(fs.readFileSync(backupLogPath, 'utf-8'));
            const lastBackup = log.length > 0 ? log[log.length - 1].timestamp : null;
            return { lastBackup, totalBackups: log.length, totalFiles: new Set(log.map(e => e.file)).size };
        } catch {
            return { lastBackup: null, totalBackups: 0, totalFiles: 0 };
        }
    }
}
