const fs = require('fs');
const path = require('path');

async function importGoldHistory() {
    try {
        const resp = await fetch('http://127.0.0.1:5555/history');
        const history = await resp.json();
        const arr = Array.isArray(history) ? history : [];

        console.log('Total trades in history:', arr.length);

        // Filter Gold trades
        const goldTrades = arr.filter(t => {
            const symbol = (t.symbol || '').toUpperCase();
            return symbol.includes('GOLD') || symbol.includes('XAU');
        });

        console.log('Gold trades found:', goldTrades.length);

        if (goldTrades.length === 0) {
            console.log('No Gold trades found.');
            const symbols = [...new Set(arr.map(t => t.symbol))];
            console.log('Available symbols:', symbols.join(', '));
            return;
        }

        // Convert to TradeRecord format
        const trades = goldTrades.map(t => {
            const profit = Number((t.profit || 0).toFixed(2));
            const comment = (t.comment || '').toUpperCase();

            let closeReason = 'MANUAL';
            if (comment.includes('BASKET TP') || comment.includes('BASKET_TP')) closeReason = 'BASKET_TP';
            else if (comment.includes('BASKET')) closeReason = 'BASKET_SL';
            else if (comment.includes('[TP]') || comment.includes('TAKE PROFIT')) closeReason = 'TP';
            else if (comment.includes('[SL]') || comment.includes('STOP LOSS')) closeReason = 'SL';
            else if (comment.includes('TRAIL')) closeReason = 'TRAILING';
            else if (comment.includes('BREAKEVEN') || comment.includes('BE')) closeReason = 'TP';

            const gridMatch = (t.comment || '').match(/L(\d+)/i);

            return {
                id: 'mt5_' + (t.ticket || t.deal) + '_' + (t.time || Date.now()),
                ticket: t.ticket || t.deal || 0,
                type: t.type === 0 ? 'BUY' : 'SELL',
                lot: t.volume || 0.01,
                entryPrice: Number((t.price_open || t.price || 0).toFixed(2)),
                exitPrice: Number((t.price_current || t.price || 0).toFixed(2)),
                profit: profit,
                result: profit >= 0 ? 'WIN' : 'LOSS',
                gridLevel: gridMatch ? parseInt(gridMatch[1]) : 1,
                closeReason: closeReason,
                openTime: t.time ? new Date(t.time * 1000).toISOString() : new Date().toISOString(),
                closeTime: t.time ? new Date(t.time * 1000).toISOString() : new Date().toISOString(),
                duration: '-'
            };
        });

        trades.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());

        const wins = trades.filter(t => t.result === 'WIN');
        const losses = trades.filter(t => t.result === 'LOSS');
        const totalProfit = trades.reduce((s, t) => s + t.profit, 0);

        console.log('\nResults:');
        console.log('  Wins:', wins.length);
        console.log('  Losses:', losses.length);
        console.log('  Total Profit: $' + totalProfit.toFixed(2));

        trades.forEach(t => {
            const icon = t.result === 'WIN' ? 'WIN ' : 'LOSS';
            console.log('  ' + icon + ' #' + t.ticket + ' ' + t.type + ' ' + t.lot + ' @ ' + t.entryPrice + ' -> ' + t.exitPrice + ' | P&L: $' + t.profit + ' | ' + t.closeReason);
        });

        const historyPath = path.resolve(__dirname, 'gold_scalper_history.json');
        fs.writeFileSync(historyPath, JSON.stringify({
            trades: trades,
            totalWins: wins.length,
            totalLosses: losses.length,
            totalProfitAllTime: Number(totalProfit.toFixed(2))
        }, null, 2));
        console.log('\nSaved ' + trades.length + ' trades to ' + historyPath);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

importGoldHistory();
