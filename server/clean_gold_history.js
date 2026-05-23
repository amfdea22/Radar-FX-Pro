const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, 'gold_scalper_history.json');
if (!fs.existsSync(historyPath)) {
    console.log('History file NOT found at:', historyPath);
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    const trades = data.trades || [];

    // Filtro rigoroso: Magic 9999 ou comentário com GOLD SCALPER
    const MAGIC = 9999;
    const cleanTrades = trades.filter(t => {
        // Trades vindos da engine costumam ter comentário 'GOLD SCALPER | Grid L...'
        // Trades sincronizados do MT5 podem ter magic
        const comment = (t.comment || '').toUpperCase();
        return t.magic === MAGIC || comment.includes('GOLD SCALPER');
    });

    console.log(`🧹 Limpeza: ${trades.length} trades reduzidos para ${cleanTrades.length} trades válidos.`);

    // Recalcular totais
    let totalWins = 0;
    let totalLosses = 0;
    let totalProfitAllTime = 0;

    cleanTrades.forEach(t => {
        if (t.result === 'WIN') totalWins++;
        else totalLosses++;
        totalProfitAllTime += (t.profit || 0);
    });

    const result = {
        trades: cleanTrades,
        totalWins,
        totalLosses,
        totalProfitAllTime: Number(totalProfitAllTime.toFixed(2))
    };

    fs.writeFileSync(historyPath, JSON.stringify(result, null, 2));
    console.log('✅ Histórico limpo e persistido com sucesso.');

} catch (e) {
    console.error('❌ Erro durante a limpeza:', e.message);
}
