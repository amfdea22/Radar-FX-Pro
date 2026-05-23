import { SignalEngine, TradingSignal } from './src/services/SignalEngine';

async function testFilters() {
    console.log('--- INICIANDO TESTE DE FILTROS ALPHA STATION ---');

    // 1. Criar sinais falsos para cada categoria
    const testAssets = [
        { symbol: 'EURUSD', name: 'Euro Dollar' },
        { symbol: 'NAS100', name: 'Nasdaq 100' },
        { symbol: 'BTCUSD', name: 'Bitcoin' },
        { symbol: 'XAUUSD', name: 'Gold' }
    ];

    testAssets.forEach(asset => {
        const category = SignalEngine.getAssetCategory(asset.symbol);
        console.log(`Injecting test signal for ${asset.symbol} -> Category: ${category}`);

        const signal: TradingSignal = {
            id: `test_sig_${asset.symbol}_${Date.now()}`,
            asset: asset.name,
            symbol: asset.symbol,
            type: 'BUY',
            setup: 'Alpha Confluence',
            timeframe: 'M5',
            confidence: 95,
            timestamp: new Date(),
            price_entry: 0,
            sl: 0,
            tp: 0,
            isInstitutional: true,
            category: category
        };

        // Forçar a adição do sinal
        (SignalEngine as any).addSignal(signal, asset.symbol, 'BUY');
    });

    console.log('--- SINAIS INJETADOS COM SUCESSO ---');
    console.log('Total de sinais ativos:', SignalEngine.getSignals().length);
    SignalEngine.getSignals().forEach(s => console.log(`- [${s.category}] ${s.symbol}`));
}

testFilters();
