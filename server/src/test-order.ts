import axios from 'axios';

async function testOrder() {
    try {
        console.log('🚀 Iniciando teste de ordem Alpha...');
        const response = await axios.post('http://127.0.0.1:3001/api/mt5/order', {
            symbol: 'EURUSD',
            action: 'BUY',
            lot: 0.01
        });
        console.log('✅ Sucesso:', response.data);
    } catch (error: any) {
        console.log('❌ Erro Detectado:');
        console.log('Status:', error.response?.status);
        console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testOrder();
