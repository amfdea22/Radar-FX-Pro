const http = require('http');

async function monitorGoldScalper() {
    console.log('📡 [MONITOR] Observação de Agilidade Ativa (Native Bridge)');
    console.log('---------------------------------------------------------');
    
    let lastLogCount = 0;
    const startTime = Date.now();

    const check = () => {
        http.get('http://127.0.0.1:3015/api/mt5/gold-scalper/status', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    
                    // Analisar Logs Recentes
                    const recentLogs = status.logs || [];
                    if (recentLogs.length > lastLogCount) {
                        const news = recentLogs.slice(0, recentLogs.length - lastLogCount);
                        news.reverse().forEach(log => {
                            console.log(`[${new Date().toLocaleTimeString()}] ${log}`);
                        });
                        lastLogCount = recentLogs.length;
                    }

                    // Estatísticas de Frequência
                    const elapsedMin = (Date.now() - startTime) / 60000;
                    const tradesCount = status.history?.length || 0;
                    const frequency = (tradesCount / (elapsedMin || 1)).toFixed(2);

                    process.stdout.write(`\r⏱️ Decorrido: ${elapsedMin.toFixed(1)}min | Trades/min: ${frequency} | IA Score: ${status.lastNeuroScore || 'N/A'}%    `);

                } catch (e) {}
            });
        }).on('error', () => {
            // Silencioso se o servidor estiver reiniciando
        });
    };

    setInterval(check, 2000);
}

monitorGoldScalper();
