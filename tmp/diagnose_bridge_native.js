const fs = require('fs');

async function diagnose() {
    const symbols = ['GOLD', 'XAUUSD', 'XAUUSD.v', 'GOLD.v'];
    const results = [];
    const BRIDGE_URL = 'http://localhost:8000'; 

    console.log('🔍 Iniciando Diagnóstico de Bridge (Native Fetch)...');

    for (const sym of symbols) {
        try {
            console.log(`Testing ${sym}...`);
            const response = await fetch(`${BRIDGE_URL}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: sym,
                    action: 'BUY',
                    lot: 0.01,
                    magic: 999999,
                    comment: 'DIAGNOSTIC'
                })
            });
            const data = await response.json();
            results.push({ symbol: sym, status: response.ok ? 'success' : 'fail', data });
        } catch (error) {
            results.push({ 
                symbol: sym, 
                status: 'error', 
                message: error.message
            });
        }
    }

    fs.writeFileSync('c:/Users/Deah/Desktop/Radar-FX/tmp/bridge_diagnostic_native.json', JSON.stringify(results, null, 2));
    console.log('✅ Diagnóstico concluído.');
}

diagnose();
