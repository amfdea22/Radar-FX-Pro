import dotenv from 'dotenv';
dotenv.config();
import { SwingTraderSimulator } from '../server/src/services/SwingTraderSimulator';

async function test() {
    try {
        console.log('--- BACKTEST XAUUSD (60 DIAS) ---');
        const gold = await SwingTraderSimulator.runBacktest('XAUUSD', 60);
        console.log(`Trades: ${gold.totalTrades}`);
        console.log(`Win Rate: ${gold.winRate.toFixed(2)}%`);
        console.log(`Profit: $${gold.totalProfit.toFixed(2)}`);
        console.log(`Profit Factor: ${gold.profitFactor.toFixed(2)}`);
        console.log(`Max DD: $${gold.maxDrawdown.toFixed(2)}`);

        console.log('\n--- BACKTEST BTCUSD (60 DIAS) ---');
        const btc = await SwingTraderSimulator.runBacktest('BTCUSD', 60);
        console.log(`Trades: ${btc.totalTrades}`);
        console.log(`Win Rate: ${btc.winRate.toFixed(2)}%`);
        console.log(`Profit: $${btc.totalProfit.toFixed(2)}`);
        console.log(`Profit Factor: ${btc.profitFactor.toFixed(2)}`);
        console.log(`Max DD: $${btc.maxDrawdown.toFixed(2)}`);
    } catch (err) {
        console.error('Erro no teste:', err);
    }
}

test();
