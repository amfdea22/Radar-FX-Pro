import axios from 'axios';
import fs from 'fs';

async function diagnose() {
    const symbols = ['GOLD', 'XAUUSD', 'XAUUSD.v', 'GOLD.v'];
    const results: any[] = [];
    const BRIDGE_URL = 'http://localhost:8000'; // URL padrão da Bridge

    console.log('🔍 Iniciando Diagnóstico de Bridge...');

    for (const sym of symbols) {
        try {
            console.log(`Testing ${sym}...`);
            const response = await axios.post(`${BRIDGE_URL}/order`, {
                symbol: sym,
                action: 'BUY',
                lot: 0.01,
                magic: 999999,
                comment: 'DIAGNOSTIC'
            }, { timeout: 5000 });
            results.push({ symbol: sym, status: 'success', data: response.data });
        } catch (error: any) {
            results.push({ 
                symbol: sym, 
                status: 'error', 
                message: error.message,
                data: error.response?.data 
            });
        }
    }

    fs.writeFileSync('c:/Users/Deah/Desktop/Radar-FX/tmp/bridge_diagnostic.json', JSON.stringify(results, null, 2));
    console.log('✅ Diagnóstico concluído. Verifique tmp/bridge_diagnostic.json');
}

diagnose();
