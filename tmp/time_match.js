const http = require('http');

async function validate() {
    console.log('🕒 VALIDANDO SINCRONIZAÇÃO POR TEMPO (Time-Based Match)');
    
    try {
        const history = await new Promise((resolve) => {
            http.get('http://127.0.0.1:5555/history', res => {
                let d = ''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d)));
            });
        });

        const trades7777 = history.filter(t => t.magic === 7777);
        const patterns = { MHI1: 0, MHI2: 0, MHI3: 0 };

        trades7777.forEach(t => {
            const date = new Date(t.time * 1000);
            const min = date.getMinutes();
            const sec = date.getSeconds();
            
            // MHI1 geralmente entra no min 00, 05...
            if (min % 5 === 0) patterns.MHI1++;
            else if (min % 5 === 1) patterns.MHI2++;
            else if (min % 5 === 2) patterns.MHI3++;
        });

        console.log('Resultados da Projeção Baseada em Tempo:');
        console.table(patterns);

    } catch (e) {
        console.error(e.message);
    }
}

validate();
