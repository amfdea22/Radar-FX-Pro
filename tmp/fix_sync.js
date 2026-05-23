const fs = require('fs');
const filePath = 'c:/Users/Deah/Desktop/Radar-FX/server/src/services/GoldScalperEngine.ts';

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// ===== FIX 1: Reduzir intervalo de sync de 120s para 30s =====
const oldSyncInterval = 'now - this.lastSyncTime > 120000';
const newSyncInterval = 'now - this.lastSyncTime > 30000';
if (content.includes(oldSyncInterval)) {
    content = content.replace(oldSyncInterval, newSyncInterval);
    changes++;
    console.log('✅ FIX 1: Intervalo de sync reduzido de 120s para 30s');
} else {
    console.log('⚠️ FIX 1: Intervalo já alterado ou não encontrado');
}

// ===== FIX 2: Adicionar variável de lucro flutuante =====
const oldMetrics = '// Métricas Globais da Conta (MT5)\r\n    private static globalDailyProfit = 0;\r\n    private static globalDailyLoss = 0;';
const newMetrics = '// Métricas Globais da Conta (MT5)\r\n    private static globalDailyProfit = 0;\r\n    private static globalDailyLoss = 0;\r\n\r\n    // Lucro Flutuante (posições abertas de Ouro)\r\n    private static floatingProfit = 0;\r\n    private static openPositionsCount = 0;';
if (content.includes(oldMetrics)) {
    content = content.replace(oldMetrics, newMetrics);
    changes++;
    console.log('✅ FIX 2: Variáveis de lucro flutuante adicionadas');
} else {
    console.log('⚠️ FIX 2: Tentando sem \\r...');
    const oldMetricsLF = oldMetrics.replace(/\r\n/g, '\n');
    const newMetricsLF = newMetrics.replace(/\r\n/g, '\n');
    if (content.includes(oldMetricsLF)) {
        content = content.replace(oldMetricsLF, newMetricsLF);
        changes++;
        console.log('✅ FIX 2: Variáveis de lucro flutuante adicionadas (LF)');
    } else {
        console.log('❌ FIX 2: Não encontrado');
    }
}

// ===== FIX 3: Atualizar getStatus() para incluir lucro flutuante e buscar posições abertas =====
// Substituir o início do getStatus para:
// 1. Buscar posições abertas do MT5
// 2. Calcular lucro flutuante real
// 3. Incluir no retorno

const oldGetStatus = `    static async getStatus() {
        await this.recalculateDailyStats();
        return {`;

const newGetStatus = `    static async getStatus() {
        await this.recalculateDailyStats();

        // Sincronizar lucro flutuante das posições abertas de Ouro no MT5
        try {
            const posResp = await axios.get(\`\${this.BRIDGE_URL}/positions\`);
            const allPositions = posResp.data || [];
            const goldPositions = allPositions.filter((p: any) =>
                this.GOLD_SYMBOLS.some(gs => (p.symbol || '').toUpperCase().includes(gs.toUpperCase())) &&
                (p.magic === this.MAGIC || !p.magic)
            );
            this.openPositionsCount = goldPositions.length;
            this.floatingProfit = Number(goldPositions.reduce((sum: number, p: any) => sum + (p.profit || 0), 0).toFixed(2));
        } catch (e) {
            // Mantém últimos valores se a bridge falhar
        }

        return {`;

if (content.includes(oldGetStatus)) {
    content = content.replace(oldGetStatus, newGetStatus);
    changes++;
    console.log('✅ FIX 3: getStatus() agora sincroniza posições abertas do MT5');
} else {
    console.log('⚠️ FIX 3: Tentando variação...');
    // Try with \r\n
    const oldCRLF = oldGetStatus.replace(/\n/g, '\r\n');
    const newCRLF = newGetStatus.replace(/\n/g, '\r\n');
    if (content.includes(oldCRLF)) {
        content = content.replace(oldCRLF, newCRLF);
        changes++;
        console.log('✅ FIX 3: getStatus() agora sincroniza posições abertas do MT5 (CRLF)');
    } else {
        console.log('❌ FIX 3: Não encontrado');
    }
}

// ===== FIX 4: Adicionar floatingProfit e openPositions no retorno do getStatus =====
const oldReturn = `            lastSyncTime: this.lastSyncTime,`;
const newReturn = `            floatingProfit: this.floatingProfit,
            openPositions: this.openPositionsCount,
            netDailyProfit: Number((this.dailyProfit - this.dailyLoss + this.floatingProfit).toFixed(2)),
            lastSyncTime: this.lastSyncTime,`;

if (content.includes(oldReturn)) {
    content = content.replace(oldReturn, newReturn);
    changes++;
    console.log('✅ FIX 4: floatingProfit, openPositions e netDailyProfit adicionados ao status');
} else {
    console.log('❌ FIX 4: Não encontrado');
}

// ===== FIX 5: Atualizar comentário do sync interval =====
const oldComment = 'Auto-sync com a Bridge a cada 2 minutos para manter lucros atualizados';
const newComment = 'Auto-sync com a Bridge a cada 30 segundos para manter lucros atualizados';
if (content.includes(oldComment)) {
    content = content.replace(oldComment, newComment);
    changes++;
    console.log('✅ FIX 5: Comentário de intervalo atualizado');
}

if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎯 Total: ${changes} correções aplicadas com sucesso!`);
} else {
    console.log('\n❌ Nenhuma correção aplicada');
}
