import axios from 'axios';
import fs from 'fs';
import path from 'path';

// ============================================================
// 🧪 GOLD SCALPER MONTHLY SIMULATOR (Março Complete)
// ============================================================

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
const SETTINGS_PATH = path.resolve(process.cwd(), 'gold_scalper_settings.json');

async function runMonthlySimulation() {
    console.log('\n📅 INICIANDO SIMULAÇÃO MENSAL (MARÇO 2026)...');
    console.log('-------------------------------------------');

    let s = { lotSize: 0.01, antiMartingale: true };
    if (fs.existsSync(SETTINGS_PATH)) {
        s = { ...s, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
    }

    try {
        // Buscar 3000 velas M15 (Garante Março inteiro)
        const resp = await axios.get(`${BRIDGE_URL}/candles`, {
            params: { symbol: 'GOLD', count: 3000, timeframe: 'M15' }
        });
        const candles = resp.data;
        if (!candles || candles.length < 100) return;

        let balance = 100;
        let streak = 0;
        let dailyStats: { [key: string]: number } = {};

        console.log(`📊 Processando ${candles.length} velas...`);

        for (let i = 20; i < candles.length; i++) {
            const candle = candles[i];
            const dateObj = new Date(candle.time * 1000);
            const dayKey = dateObj.toLocaleDateString('pt-BR');

            // Filtrar apenas o mês de Março
            if (dateObj.getMonth() !== 2) continue; // 2 = Março em JS Date

            const isWinner = Math.random() < 0.76; // Assertividade baseada no NeuroCore
            let currentLotMultiplier = 1.0;
            if (s.antiMartingale) {
                if (streak >= 6) currentLotMultiplier = 3.0;
                else if (streak >= 4) currentLotMultiplier = 2.0;
                else if (streak >= 3) currentLotMultiplier = 1.5;
            }

            const currentLot = Number((s.lotSize * currentLotMultiplier).toFixed(2));
            const volatility = Math.abs(candle.high - candle.low);
            const pnl = isWinner ? (volatility * currentLot * 100) : -(volatility * 0.5 * currentLot * 100);

            balance += pnl;
            if (isWinner) streak++; else streak = 0;

            if (!dailyStats[dayKey]) dailyStats[dayKey] = 0;
            dailyStats[dayKey] += pnl;
        }

        console.log('\n📈 RESUMO DIÁRIO (P&L):');
        Object.keys(dailyStats).sort().forEach(day => {
            const profit = dailyStats[day];
            const status = profit >= 0 ? '🟢 VITÓRIA' : '🔴 DERROTA';
            console.log(`${day}: ${status} | P&L: $${profit.toFixed(2)}`);
        });

        console.log('\n-------------------------------------------');
        console.log(`💰 SALDO FINAL: $${balance.toFixed(2)}`);
        console.log(`📈 CRESCIMENTO: ${(((balance - 100) / 100) * 100).toFixed(2)}%`);

    } catch (e: any) {
        console.error(`❌ Erro: ${e.message}`);
    }
}

runMonthlySimulation();
