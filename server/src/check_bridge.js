
const axios = require('axios');

async function check() {
    const BRIDGE_URL = 'http://127.0.0.1:5555';
    try {
        console.log('--- Symbols ---');
        const symbols = await axios.get(`${BRIDGE_URL}/symbols`);
        console.log(symbols.data);

        const goldSymbols = ['GOLD', 'XAUUSD', 'XAUUSD.v', 'GOLD.v'];
        const resolved = symbols.data.filter(s => goldSymbols.includes(s) || s.includes('GOLD') || s.includes('XAU'));
        console.log('Resolved Gold Symbols:', resolved);

        if (resolved.length > 0) {
            const sym = resolved[0];
            console.log(`--- Ticks for ${sym} ---`);
            const ticks = await axios.post(`${BRIDGE_URL}/ticks`, { symbols: [sym] });
            console.log(ticks.data);

            console.log(`--- Candles for ${sym} (M1) ---`);
            const candles = await axios.get(`${BRIDGE_URL}/candles?symbol=${sym}&timeframe=M1&count=5`);
            console.log(candles.data);
        }

        console.log('--- Positions ---');
        const pos = await axios.get(`${BRIDGE_URL}/positions`);
        console.log(pos.data);

    } catch (e) {
        console.error('Error connecting to bridge:', e.message);
    }
}

check();
