const http = require('http');

async function monitorAlert() {
    console.log('\n🚀 [ALERTA RADAR-FX] Monitorando Primeiro Disparo (Limite 30%)...');
    console.log('Esperando o reinício do servidor e a primeira oportunidade de mercado.\n');
    
    let initialTradeCount = null;
    const startTime = Date.now();

    const check = () => {
        http.get('http://127.0.0.1:3015/api/mt5/gold-scalper/status', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    const history = status.history || [];
                    const currentCount = history.length;

                    if (initialTradeCount === null) {
                        initialTradeCount = currentCount;
                        console.log(`📡 Sincronizado. Histórico atual: ${currentCount} trades.`);
                        return;
                    }

                    if (currentCount > initialTradeCount) {
                        const lastTrade = history[0];
                        console.log('\n\n****************************************************');
                        console.log('🔥 [ALERTA] RADAR-FX TURBO v5.0 ATIVADO COM SUCESSO!');
                        console.log(`✅ TRADE DISPARADO: ${lastTrade.type} em ${lastTrade.entryPrice}`);
                        console.log(`🎯 SCORE DA IA: ${status.iaScore}% (Limite atual: 30%)`);
                        console.log('****************************************************\n');
                        process.exit(0); // Para o monitor após o sucesso
                    }

                    // Log de progresso silencioso
                    process.stdout.write(`\r⏳ Aguardando sinal... IA Score Atual: ${status.iaScore || 'N/A'}% | Limite: 30%    `);

                } catch (e) {}
            });
        }).on('error', () => {
            process.stdout.write('\r🔴 Servidor Offline. Por favor, execute INICIAR_RADAR_FX.bat...');
        });
    };

    setInterval(check, 3000);
}

monitorAlert();
