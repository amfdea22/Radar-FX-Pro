import axios from 'axios';

async function testOrderError() {
    try {
        console.log('🚀 Iniciando teste de ERRO forçado (SL inválido)...');
        // Usando um SL impossível (ex: SL de 0.01 para um BUY em 1.08)
        const response = await axios.post('http://127.0.0.1:3001/api/mt5/order', {
            symbol: 'EURUSD',
            action: 'BUY',
            lot: 0.1,
            sl: 0.01,
            tp: 2.0
        });
        console.log('✅ Sucesso (Inesperado):', response.data);
    } catch (error: any) {
        console.log('❌ Erro Capturado pelo Teste:');
        console.log('Status:', error.response?.status);
        console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testOrderError();
