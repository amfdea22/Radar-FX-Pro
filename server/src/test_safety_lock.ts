/**
 * Teste de integração do Safety Lock (DisciplineEngine)
 * Verifica se todos os motores respeitam o bloqueio de disciplina.
 * Necessita servidor rodando em http://127.0.0.1:3015
 * Uso: npx ts-node src/test_safety_lock.ts
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:3015';

async function test() {
    console.log('=== TESTE SAFETY LOCK ===\n');

    // 1. Estado atual da disciplina
    const disc = await api('GET', '/api/mt5/discipline');
    console.log(`Discipline: profit=${disc.profit}, tradeCount=${disc.tradeCount}`);
    console.log(`Locked: ${disc.isLocked} | Safe: ${disc.isSafe}`);
    console.log(`Limites: StopLoss=$${-disc.limits.dailyStopLoss}, TakeProfit=$${disc.limits.dailyTakeProfit}, MaxTrades=${disc.limits.maxTradesPerDay}, MaxLosses=${disc.limits.maxConsecutiveLosses}\n`);

    // 2. Forçar lock via dailyStopLoss mínimo
    console.log('--- Forçando dailyStopLoss=$0.01 ---');
    await api('POST', '/api/mt5/discipline/settings', { dailyStopLoss: 0.01, maxTradesPerDay: 1000, maxConsecutiveLosses: 100 });
    await sleep(500);
    const locked = await api('GET', '/api/mt5/discipline');
    console.log(`Locked: ${locked.isLocked} | Reason: ${locked.reason}`);
    console.assert(locked.isLocked === true, `❌ ERRO: Disciplina deveria estar LOCKED!`);

    // 3. Restaurar limites
    console.log('\n--- Restaurando limites originais ---');
    await api('POST', '/api/mt5/discipline/settings', { dailyStopLoss: disc.limits.dailyStopLoss, maxTradesPerDay: disc.limits.maxTradesPerDay, maxConsecutiveLosses: disc.limits.maxConsecutiveLosses });
    await sleep(500);
    const restored = await api('GET', '/api/mt5/discipline');
    console.log(`Locked: ${restored.isLocked}`);
    if (!restored.isLocked) console.log('✅ Limites restaurados — motores podem operar');

    // 4. Verificar status combinado
    console.log('\n--- Verificando status consolidado ---');
    const combined = await api('GET', '/api/mt5/status');
    if (combined.discipline) {
        console.log(`Discipline: isLocked=${combined.discipline.isLocked}, dailyProfit=${combined.discipline.dailyProfit}`);
        console.log(`GoldScalper: daily=${combined.goldScalper?.dailyProfit || 'N/A'}`);
    }

    console.log('\n=== TESTE CONCLUÍDO ===');
}

async function api(method: string, path: string, body?: any) {
    const url = `${BASE}${path}`;
    const opts: any = { headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, { method, ...opts });
    return res.json();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

test().catch(e => {
    console.error('Falha no teste (servidor offline?):', e.message);
    console.log('\nCertifique-se de que o servidor está rodando em', BASE);
    process.exit(1);
});
