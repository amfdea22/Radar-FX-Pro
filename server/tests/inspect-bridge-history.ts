import axios from 'axios';

async function testRawHistory() {
    try {
        const BRIDGE_URL = 'http://127.0.0.1:5555';
        console.log('--- REQUISITANDO HISTÓRICO BRUTO DO BRIDGE ---');
        const response = await axios.get(`${BRIDGE_URL}/history`);
        const history = response.data;

        console.log('Total de registros:', history.length);
        if (history.length > 0) {
            console.log('Primeiros 3 registros:', JSON.stringify(history.slice(0, 3), null, 2));
            const entries = history.map((d: any) => d.entry);
            const entryCounts = entries.reduce((acc: any, curr: any) => {
                acc[curr] = (acc[curr] || 0) + 1;
                return acc;
            }, {});
            console.log('Contagem por tipo de Entry (0=IN, 1=OUT, 2=INOUT):', entryCounts);
        } else {
            console.log('WARN: O Bridge retornou 0 registros de histórico.');
        }
    } catch (error: any) {
        console.error('ERROR:', error.message);
    }
}

testRawHistory();
