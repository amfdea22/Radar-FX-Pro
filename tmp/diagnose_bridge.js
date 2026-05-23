const axios = require('axios');
const fs = require('fs');

async function diagnose() {
    const symbols = ['GOLD', 'XAUUSD', 'XAUUSD.v', 'GOLD.v'];
    const results = [];
    const BRIDGE_URL = 'http://localhost:8000'; 

    console.log('🔍 Iniciando Diagnóstico de Bridge (JS Version)...');

    for (const sym of symbols) {
        try {
            console.log(`Testing ${sym}...`);
            const response = await axios.post(`${BRIDGE_URL}/order`, {
                symbol: sym,
                action: 'BUY',
                lot: 0.01,
                magic: 999999,
                comment: 'DIAGNOSTIC'
            }, { timeout: 3000 });
            results.push({ symbol: sym, status: 'success', data: response.data });
        } catch (error) {
            results.push({ 
                symbol: sym, 
                status: 'error', 
                message: error.message,
                data: error.response?.data 
            });
        }
    }

    fs.writeFileSync('c:/Users/Deah/Desktop/Radar-FX/tmp/bridge_diagnostic_js.json', JSON.stringify(results, null, 2));
    console.log('✅ Diagnóstico concluído.');
}

diagnose();
