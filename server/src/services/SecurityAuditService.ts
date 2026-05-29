import fs from 'fs';
import path from 'path';

export interface AuditLogEntry {
    id: number;
    timestamp: string;
    nivel: string;
    ativo: string;
    trava_acionada: string;
    acao_executada: string;
    detalhe_tecnico: string;
}

export class SecurityAuditService {
    private static AUDIT_FILE = path.join(process.cwd(), 'security_audit_logs.json');
    private static logs: AuditLogEntry[] = [];
    private static nextId = 1;
    private static initialized = false;

    static init() {
        if (this.initialized) return;
        this.loadFromFile();
        if (this.logs.length === 0) this.seedDemoLogs();
        this.initialized = true;
    }

    private static seedDemoLogs() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        this.registrar('🔴', 'XAUUSD', 'Trava de Spread', '🚫 Ordem Cancelada', `Spread de 35 pontos excedeu o limite máximo (25).`);
        this.registrar('🟡', 'XAUUSD', 'Limite de Posições', '⏸️ Sinal Ignorado', 'Sinal de Compra do Shark Bot rejeitado. Limite de 3 posições atingido.');
        this.registrar('🔴', 'Sistema', 'Botão de Pânico', '💥 Plataforma Zerada', 'Acionamento manual do usuário. 2 posições a mercado fechadas.');
        this.registrar('🟢', 'Sistema', 'Hard Lock', '🔒 Modificações Bloqueadas', 'Edição de limites suspensa até 00:00 do servidor.');
        this.registrar('🔴', 'Sistema', 'Monitor de Latência', '🔌 Entradas Pausadas', 'Ping com a corretora atingiu 210ms. Comunicação instável.');
        this.registrar('🟡', 'BTCUSD', 'Confiança da IA', '🚫 Ordem Ignorada', 'Probabilidade 45% abaixo do mínimo 60%.');
        this.registrar('🟢', 'XAUUSD', 'Meta Batida', '✅ Operação Bloqueada', 'Lucro diário de $127 atingiu a meta de $100. Robô pausado.');
        this.registrar('🔴', 'EURUSD', 'Correlation Guard', '🚫 Ordem Bloqueada', 'EURUSD ⇄ GBPUSD: posição oposta já aberta. Risco de hedge indesejado.');
        this.registrar('🟡', 'XAUUSD', 'Filtro MA200', '⏸️ Sinal Ignorado', 'Preço ($4505) abaixo da MA200 ($4513). Modo estrito: BUY e SELL bloqueados.');
        this.registrar('🟢', 'Sistema', 'Perda Diária', '🔒 Robô Pausado', 'Drawdown de $153 excedeu o limite de $250. Trading interrompido até próximo dia.');
        this.saveToFile();
    }

    static registrar(
        nivel: string,
        ativo: string,
        trava: string,
        acao: string,
        detalhe: string
    ) {
        const entry: AuditLogEntry = {
            id: this.nextId++,
            timestamp: new Date().toISOString().replace('T', ' ').split('.')[0] + ',' + String(new Date().getMilliseconds()).padStart(3, '0'),
            nivel,
            ativo,
            trava_acionada: trava,
            acao_executada: acao,
            detalhe_tecnico: detalhe,
        };
        this.logs.unshift(entry);
        if (this.logs.length > 500) this.logs = this.logs.slice(0, 500);
        this.saveToFile();
        return entry;
    }

    static getLogs(filtro?: { nivel?: string; ativo?: string; trava?: string }): AuditLogEntry[] {
        let result = this.logs;
        if (filtro?.nivel && filtro.nivel !== 'all') {
            result = result.filter(l => l.nivel === filtro.nivel);
        }
        if (filtro?.ativo) {
            const atv = filtro.ativo.toLowerCase();
            result = result.filter(l => l.ativo.toLowerCase().includes(atv));
        }
        if (filtro?.trava) {
            const trv = filtro.trava.toLowerCase();
            result = result.filter(l => l.trava_acionada.toLowerCase().includes(trv));
        }
        return result;
    }

    static getLogsByNivel(nivel: string): AuditLogEntry[] {
        return this.logs.filter(l => l.nivel === nivel);
    }

    static getResumoDiario(): string {
        const hoje = new Date().toISOString().split('T')[0];
        const hojeLogs = this.logs.filter(l => l.timestamp.startsWith(hoje));
        const bloqueios = hojeLogs.filter(l => l.acao_executada.includes('🚫') || l.acao_executada.includes('⏸️') || l.acao_executada.includes('Bloquead'));
        const spreadAlto = hojeLogs.filter(l => l.trava_acionada.includes('Spread'));
        const ordensDuplicadas = hojeLogs.filter(l => l.trava_acionada.includes('Posi'));
        const panico = hojeLogs.filter(l => l.trava_acionada.includes('Pânico'));
        const partes: string[] = [];
        if (bloqueios.length > 0) partes.push(`bloqueou ${bloqueios.length} tentativas de entrada`);
        if (spreadAlto.length > 0) partes.push(`${spreadAlto.length} por spread alto`);
        if (ordensDuplicadas.length > 0) partes.push(`evitou ${ordensDuplicadas.length} ordens duplicadas`);
        if (panico.length > 0) partes.push(`Pânico foi acionado ${panico.length} vez(es)`);
        if (partes.length === 0) return 'Nenhum evento de segurança registrado hoje.';
        return `Hoje o sistema ${partes.join(', ')}.`;
    }

    static exportarCSV(): string {
        const header = 'id;timestamp;nivel;ativo;trava_acionada;acao_executada;detalhe_tecnico';
        const rows = this.logs.map(l =>
            `${l.id};${l.timestamp};${l.nivel};${l.ativo};${l.trava_acionada};${l.acao_executada};"${l.detalhe_tecnico.replace(/"/g, '""')}"`
        );
        return [header, ...rows].join('\n');
    }

    static limpar() {
        this.logs = [];
        this.nextId = 1;
        this.saveToFile();
    }

    private static loadFromFile() {
        try {
            if (!fs.existsSync(this.AUDIT_FILE)) return;
            const data = JSON.parse(fs.readFileSync(this.AUDIT_FILE, 'utf-8'));
            if (Array.isArray(data)) {
                this.logs = data;
                this.nextId = data.length > 0 ? Math.max(...data.map(l => l.id)) + 1 : 1;
            }
        } catch { this.logs = []; this.nextId = 1; }
    }

    private static saveToFile() {
        try {
            const dir = path.dirname(this.AUDIT_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.AUDIT_FILE, JSON.stringify(this.logs, null, 2));
        } catch {}
    }
}
