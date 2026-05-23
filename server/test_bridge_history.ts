import axios from 'axios';

async function test() {
    const BRIDGE_URL = 'http://127.0.0.1:5555';
    try {
        const response = await axios.get(`${BRIDGE_URL}/history`);
        console.log('Total trades:', response.data.length);
        if (response.data.length > 0) {
            console.log('First trade sample:', JSON.stringify(response.data[0], null, 2));
        }
    } catch (e) {
        console.error('Failed to connect to bridge');
    }
}

test();
