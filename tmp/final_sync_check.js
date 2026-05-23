const http = require('http');

async function final_check() {
    console.log('🚀 VALIDANDO SINCRONIZAÇÃO FINAL (Deep Sync)');
    
    // Simular o que o novo calculateStrategyRanking fará no backend
    try {
        const history = await new Promise((resolve) => {
            http.get('http://127.0.0.1:5555/history', res => {
                let d = ''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d)));
            });
        });

        const strategies = { MHI1: 0, MHI2: 0, MHI3: 0 };
        const profit = { MHI1: 0, MHI2: 0, MHI3: 0 };

        history.forEach(t => {
            let matched = false;
            // Padrão novo
            if (t.magic === 999111 || (t.comment || '').toUpperCase().includes('OMNI')) matched = true;
            
            // Padrão legado (Deep Match)
            if (!matched && t.magic === 7777) {
                const min = new Date(t.time * 1000).getMinutes();
                const mod5 = min % 5;
                let s = '';
                if (mod5 === 0) s = 'MHI1';
                else if (mod5 === 1) s = 'MHI2';
                else if (mod5 === 2) s = 'MHI3';
                
                if (s) {
                    strategies[s]++;
                    profit[s] += t.profit;
                }
            }
        });

        console.log('\n📊 Projeção de Ranking (Pós-Sincronização):');
        Object.keys(strategies).forEach(s => {
            console.log(`${s}: ${strategies[s]} Trades | Profit: $${profit[s].toFixed(2)}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}

final_check();
