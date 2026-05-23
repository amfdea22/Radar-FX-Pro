import axios from 'axios';

async function testAnalytics() {
    try {
        console.log('--- TESTANDO ALPHA ANALYTICS ENDPOINT ---');
        const response = await axios.get('http://127.0.0.1:3005/api/mt5/analytics/advanced');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data.assets.length === 0) {
            console.log('WARN: Nenhum dado de ativo retornado. O histórico do MT5 pode estar vazio.');
        } else {
            console.log('SUCCESS: Dados recebidos com sucesso.');
        }
    } catch (error: any) {
        console.error('ERROR:', error.message);
        if (error.response) {
            console.error('Response details:', error.response.data);
        }
    }
}

testAnalytics();
