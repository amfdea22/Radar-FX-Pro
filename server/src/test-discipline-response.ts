import axios from 'axios';

async function test() {
    try {
        const resp = await axios.get('http://localhost:3005/api/mt5/discipline');
        console.log('RESPONSE:', JSON.stringify(resp.data, null, 2));
    } catch (e: any) {
        console.error('ERROR:', e.message);
        if (e.response) console.error('DATA:', e.response.data);
    }
}

test();
