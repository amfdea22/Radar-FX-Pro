
import axios from 'axios';

async function testDisciplineLogic() {
    console.log('🧪 Iniciando Teste de Lógica de Disciplina...');

    // Mock de dados que o MT5 costuma retornar
    const mockHistory = [
        { ticket: 1, symbol: 'EURUSD', type: 0, volume: 0.1, price_open: 1.0850, time: Math.floor(Date.now() / 1000) - 3600, profit: -10, entry: 1 },
        { ticket: 2, symbol: 'EURUSD', type: 1, volume: 0.1, price_open: 1.0860, time: Math.floor(Date.now() / 1000) - 1800, profit: -15, entry: 1 },
        { ticket: 3, symbol: 'GBPUSD', type: 0, volume: 0.1, price_open: 1.2650, time: Math.floor(Date.now() / 1000) - 600, profit: -10, entry: 1 }
    ];

    const settings = {
        dailyStopLoss: 30,
        dailyTakeProfit: 50,
        maxTradesPerDay: 10,
        maxConsecutiveLosses: 3
    };

    const now = Math.floor(Date.now() / 1000);
    const startTime24h = now - (24 * 60 * 60);

    const todayTrades = mockHistory
        .filter((d: any) => d.time >= startTime24h && d.entry === 1)
        .sort((a: any, b: any) => b.time - a.time);

    const dailyNetProfit = todayTrades.reduce((sum: number, t: any) => sum + t.profit, 0);
    const tradeCount = todayTrades.length;

    let consecutiveLosses = 0;
    for (const trade of todayTrades) {
        if (trade.profit < 0) {
            consecutiveLosses++;
        } else if (trade.profit > 0) {
            break;
        }
    }

    console.log('📊 Resultados Simulados:');
    console.log(`- Lucro Líquido: ${dailyNetProfit}`);
    console.log(`- Total de Trades: ${tradeCount}`);
    console.log(`- Perdas Consecutivas: ${consecutiveLosses}`);

    const isDailyStopHit = dailyNetProfit <= -settings.dailyStopLoss;
    const isMaxConsecutiveLossesHit = consecutiveLosses >= settings.maxConsecutiveLosses;

    console.log(`- Stop Diário Atingido? ${isDailyStopHit}`);
    console.log(`- Máximo Loss Consecutivo? ${isMaxConsecutiveLossesHit}`);
    console.log(`- BLOQUEAR CONTA? ${isDailyStopHit || isMaxConsecutiveLossesHit}`);
}

testDisciplineLogic();
