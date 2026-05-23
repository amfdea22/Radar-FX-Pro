const http = require('http');

async function inspect() {
    console.log('🔍 INSPEÇÃO DE COMENTÁRIOS - MAGIC 7777');
    
    try {
        const history = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:5555/history', (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const trades7777 = history.filter(t => t.magic === 7777);
        console.log(`Total trades Magic 7777: ${trades7777.length}`);

        if (trades7777.length > 0) {
            const comments = [...new Set(trades7777.map(t => t.comment))];
            console.log('\n📋 Comentários Únicos Encontrados:');
            comments.forEach(c => console.log(`   - "${c}"`));

            const strategies = ['MHI1', 'MHI2', 'MHI3', 'TWIN_TOWERS', 'CYCLE_OF_3'];
            console.log('\n🧪 Testando Filtros:');
            strategies.forEach(s => {
                const count = trades7777.filter(t => (t.comment || '').toUpperCase().includes(s.toUpperCase().replace('_', ''))).length;
                console.log(`   - ${s}: ${count} matches`);
            });
        }

    } catch (e) {
        console.error('Erro:', e.message);
    }
}

inspect();
