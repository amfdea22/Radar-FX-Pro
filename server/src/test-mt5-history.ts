import axios from 'axios';

async function test() {
    try {
        const resp = await axios.get('http://127.0.0.1:5555/history');
        console.log('HISTORY SAMPLE:', JSON.stringify(resp.data.slice(0, 5), null, 2));
    } catch (e: any) {
        console.error('ERROR:', e.message);
    }
}

test();
