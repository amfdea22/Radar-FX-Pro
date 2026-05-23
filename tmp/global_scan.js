const http = require('http');

async function scan() {
    console.log('🌍 GLOBAL SCAN - BUSCANDO OMNI...');
    
    try {
        const history = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:5555/history', (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const magicGroups = {};
        history.forEach(t => {
            if (!magicGroups[t.magic]) magicGroups[t.magic] = new Set();
            magicGroups[t.magic].add(t.comment || 'EMPTY');
        });

        console.log('\n🔍 Grupos de Magic e Comentários:');
        Object.keys(magicGroups).forEach(m => {
            console.log(`\nMagic: ${m}`);
            [...magicGroups[m]].slice(0, 5).forEach(c => console.log(`   - "${c}"`));
        });

        const omniFound = history.filter(t => (t.comment || '').toUpperCase().includes('OMNI'));
        console.log(`\n💎 Total de trades com "OMNI" no comentário (qualquer Magic): ${omniFound.length}`);
        if (omniFound.length > 0) {
            const magics = [...new Set(omniFound.map(t => t.magic))];
            console.log(`   Magics onde "OMNI" foi encontrado: ${magics.join(', ')}`);
        } else {
            console.log('❌ NENHUM trade com "OMNI" no comentário em TODO o histórico.');
        }

    } catch (e) {
        console.error('Erro:', e.message);
    }
}

scan();
