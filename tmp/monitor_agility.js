const axios = require('axios');

async function monitorGoldScalper() {
    console.log('📡 [MONITOR] Iniciando Observação de Agilidade - Neuro Core IA');
    console.log('---------------------------------------------------------');
    
    let lastLogCount = 0;
    const startTime = Date.now();

    const check = async () => {
        try {
            const statusResp = await axios.get('http://127.0.0.1:3015/api/mt5/gold-scalper/status');
            const status = statusResp.data;
            
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

            process.stdout.write(`\r⏱️ Decorrido: ${elapsedMin.toFixed(1)}min | Trades: ${tradesCount} | Ritmo: ${frequency} trades/min | IA Score: ${status.lastNeuroScore || 'N/A'}%    `);

        } catch (e) {
            // console.error('Aguardando servidor Radar-FX...');
        }
    };

    setInterval(check, 2000);
}

monitorGoldScalper();
