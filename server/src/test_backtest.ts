import dotenv from 'dotenv';
dotenv.config();
import { SwingTraderSimulator } from './services/SwingTraderSimulator';

async function test() {
    try {
        console.log('--- RELATÓRIO DE ASSERTIVIDADE SWING IA ---');

        const gold = await SwingTraderSimulator.runBacktest('XAUUSD', 60);
        console.log(`[GOLD] Trades: ${gold.totalTrades} | WinRate: ${gold.winRate.toFixed(1)}% | Profit: $${gold.totalProfit.toFixed(2)} | Factor: ${gold.profitFactor.toFixed(2)}`);

        const btc = await SwingTraderSimulator.runBacktest('BTCUSD', 60);
        console.log(`[BTC]  Trades: ${btc.totalTrades} | WinRate: ${btc.winRate.toFixed(1)}% | Profit: $${btc.totalProfit.toFixed(2)} | Factor: ${btc.profitFactor.toFixed(2)}`);

        console.log('\n--- FIM DO TESTE ---');
    } catch (err: any) {
        console.error('Erro no backtest:', err.message);
    }
}

test();
