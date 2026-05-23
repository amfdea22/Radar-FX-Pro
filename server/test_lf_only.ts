
import axios from 'axios';

async function testLF() {
    const symbol = 'EURUSD';
    const to = Math.floor(Date.now() / 1000);
    const from = to - 3600; // 1 hora atrás
    const url = `https://my.litefinance.org/pt/chart/get-history?symbol=${symbol}&resolution=1&from=${from}&to=${to}`;

    console.log(`Testing URL: ${url}`);
    try {
        const resp = await axios.get(url, { timeout: 10000 });
        console.log('Status:', resp.status);
        console.log('Data Type:', typeof resp.data);
        if (resp.data.c) {
            console.log('Success! Bars found:', resp.data.c.length);
        } else {
            console.log('No bars in response data:', resp.data);
        }
    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Response Status:', e.response.status);
            console.error('Response Data:', e.response.data);
        }
    }
}

testLF();
