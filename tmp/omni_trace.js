const http = require('http');

async function trace() {
    console.log('🌌 OMNI DEEP TRACE - DIAGNÓSTICO DE RANKING');
    
    const get = (path) => new Promise((resolve) => {
        http.get(`http://127.0.0.1:3015${path}`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });

    try {
        const status = await get('/api/mt5/omni/status');
        console.log('\n--- ENGINE STATUS ---');
        console.log(`Ativo: ${status.enabled}`);
        console.log(`Magic Number: ${status.settings.magic}`);
        console.log(`Trades Processados: ${status.processedCycles}`);
        
        console.log('\n--- RANKING ATUAL ---');
        if (status.ranking && status.ranking.length > 0) {
            console.table(status.ranking);
        } else {
            console.log('⚠️ RANKING VAZIO');
        }

        console.log('\n--- HISTÓRICO RECENTE (MAGIC 999111) ---');
        if (status.history && status.history.length > 0) {
            status.history.forEach(t => {
                console.log(`[${t.ticket}] ${t.symbol} | Profit: ${t.profit} | Comment: "${t.comment}"`);
            });
        } else {
            console.log('⚠️ NENHUM TRADE ENCONTRADO NO MAGIC 999111');
            console.log('Isso explica por que o ranking não atualiza.');
        }

        // Tentar ver se há trades no 7777 que deveriam ser Omni
        console.log('\n--- VERIFICAÇÃO DE RESIDUOS (MAGIC 777) ---');
        const bridgeHistory = await new Promise(r => {
            http.get('http://127.0.0.1:5555/history', res => {
                let d = ''; res.on('data', c => d+=c); res.on('end', () => r(JSON.parse(d)));
            });
        });
        
        const legacyTrades = bridgeHistory.filter(t => t.magic === 7777 && (t.comment || '').includes('Omni'));
        console.log(`Trades legados (Magic 7777 + "Omni"): ${legacyTrades.length}`);
        if (legacyTrades.length > 0) {
            console.log('Dica: O sistema parou de olhar para estes trades após a mudança do Magic.');
        }

    } catch (e) {
        console.error('Falha no trace:', e.message);
    }
}

trace();
