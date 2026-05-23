
import axios from 'axios';

async function testEndpoint() {
    try {
        console.log('🔍 Testando endpoint /api/mt5/discipline...');
        const response = await axios.get('http://localhost:3005/api/mt5/discipline');
        console.log('✅ Resposta Recebida:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error('❌ Erro no Teste:', error.response?.status, error.response?.data || error.message);
    }
}

testEndpoint();
