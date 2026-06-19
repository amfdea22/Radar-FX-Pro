import express from 'express';
import axios from 'axios';

const app = express();

// Custom body parser (compatibilidade Node.js v24)
const readBody = (req: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
        req.resume();
    });
};

app.use(async (req: any, res, next) => {
    if (req.method === 'POST' && Number(req.headers['content-length'] || '0') > 0) {
        try {
            const raw = await readBody(req);
            const ct = (req.headers['content-type'] || '').toLowerCase();
            if (ct.includes('application/json')) {
                try { req.body = JSON.parse(raw); } catch { req.body = raw; }
            } else if (ct.includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(raw);
                req.body = Object.fromEntries(params.entries());
            } else {
                req.body = raw;
            }
        } catch { req.body = {}; }
    }
    next();
});

const PORT = 5555;
const LITEFINANCE_BASE = 'https://api.litefinance.com/api/v1';

const SYMBOLS = [
    'XAUUSD', 'GBPUSD', 'EURUSD', 'BTCUSD', 'ETHUSD', 'USDJPY',
    'US30Cash', 'US100Cash', 'US500Cash', 'GER40Cash', 'UK100',
    'AUS200', 'EURJPY', 'EURGBP', 'OIL', 'BRENT'
];

const CACHE: Record<string, any> = {};
let mockAccount = {
    balance: 159.00,
    equity: 154.00,
    margin: 5.00,
    freeMargin: 149.00,
    profit: -5.00,
    leverage: 100,
    currency: 'USD',
    name: 'Radar-FX Demo'
};

// --- HELPERS ---

async function fetchFromLiteFinance(symbol: string, timeframe: string = 'M1', count: number = 10): Promise<any[]> {
    const tfMap: Record<string, string> = { 'M1': '1', 'M5': '5', 'M15': '15', 'H1': '60', 'H4': '240', 'D1': '1440' };
    const period = tfMap[timeframe] || '1';
    try {
        const resp = await axios.get(`${LITEFINANCE_BASE}/getCandles`, {
            params: { symbol, timeframe: period, count },
            timeout: 8000
        });
        const data = resp.data;
        if (Array.isArray(data) && data.length > 0) {
            return data.map((c: any) => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                tick_volume: c.volume || c.tick_volume || 0
            }));
        }
    } catch { }
    // Fallback: gerar candles sintéticos baseados no último preço conhecido
    return generateSyntheticCandles(symbol, count);
}

function generateSyntheticCandles(symbol: string, count: number): any[] {
    const basePrice = CACHE[`tick_${symbol}`]?.bid || 2300;
    const now = Math.floor(Date.now() / 1000);
    const tfSeconds: Record<string, number> = { '1': 60, '5': 300, '15': 900, '60': 3600, '240': 14400, '1440': 86400 };
    const interval = 60; // M1 default
    const candles: any[] = [];
    for (let i = count; i > 0; i--) {
        const time = now - (i * interval);
        const drift = (Math.random() - 0.5) * 2;
        const open = basePrice + drift;
        const close = basePrice + drift + (Math.random() - 0.5) * 1;
        const high = Math.max(open, close) + Math.random() * 0.5;
        const low = Math.min(open, close) - Math.random() * 0.5;
        candles.push({ time, open, high, low, close, tick_volume: Math.floor(Math.random() * 100) + 10 });
    }
    return candles;
}

async function getCurrentTick(symbol: string): Promise<any> {
    const cacheKey = `tick_${symbol}`;
    const candles = await fetchFromLiteFinance(symbol, 'M1', 1);
    if (candles.length > 0) {
        const c = candles[0];
        const tick = { symbol, bid: c.close, ask: c.close + 0.01, point: 0.01, time: Math.floor(Date.now() / 1000) };
        CACHE[cacheKey] = tick;
        return tick;
    }
    return CACHE[cacheKey] || { symbol, bid: 2300.00, ask: 2300.01, point: 0.01, time: Math.floor(Date.now() / 1000) };
}

// --- ROTAS ---

app.get('/account', (_req, res) => {
    res.json(mockAccount);
});

app.get('/positions', (_req, res) => {
    res.json([]);
});

app.post('/ticks', async (req, res) => {
    const { symbols } = req.body || {};
    const result: Record<string, any> = {};
    const list = symbols || ['XAUUSD'];
    for (const sym of list) {
        result[sym] = await getCurrentTick(sym);
    }
    res.json(result);
});

app.get('/candles', async (req, res) => {
    const { symbol, timeframe, count } = req.query as any;
    if (!symbol) return res.json([]);
    const candles = await fetchFromLiteFinance(symbol, timeframe || 'M1', parseInt(count) || 60);
    res.json(candles);
});

app.get('/history', (_req, res) => {
    res.json([]);
});

app.get('/symbols', (_req, res) => {
    res.json(SYMBOLS);
});

app.get('/smc_levels', (req, res) => {
    const { symbol, direction } = req.query as any;
    res.json({
        symbol: symbol || 'XAUUSD',
        market_trend: 'BULLISH',
        tp1: 2350.00,
        tp2: 2360.00,
        sl: 2320.00,
        bos_count: 3,
        atr: 12.5,
        partial_level: 2340.00,
        risk_distance: 20.0
    });
});

app.post('/order', (req, res) => {
    const order = req.body;
    console.log('📤 Bridge: Ordem recebida:', JSON.stringify(order));
    res.json({ success: true, ticket: Math.floor(Math.random() * 1000000), ...order });
});

app.post('/close_order', (req, res) => {
    console.log('📤 Bridge: Fechar ordem:', JSON.stringify(req.body));
    res.json({ success: true });
});

app.post('/update_order', (req, res) => {
    console.log('📤 Bridge: Atualizar ordem:', JSON.stringify(req.body));
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    res.json({ success: true, message: 'Simulated login OK' });
});

app.listen(PORT, () => {
    console.log(`🔧 MT5 Bridge Simulator running on :${PORT}`);
    // Inicializa cache de ticks
    CACHE['tick_XAUUSD'] = { symbol: 'XAUUSD', bid: 2300.00, ask: 2300.01, point: 0.01, time: Math.floor(Date.now() / 1000) };
    CACHE['tick_GBPUSD'] = { symbol: 'GBPUSD', bid: 1.2620, ask: 1.2621, point: 0.0001, time: Math.floor(Date.now() / 1000) };
    CACHE['tick_EURUSD'] = { symbol: 'EURUSD', bid: 1.0850, ask: 1.0851, point: 0.0001, time: Math.floor(Date.now() / 1000) };
    CACHE['tick_BTCUSD'] = { symbol: 'BTCUSD', bid: 67000, ask: 67001, point: 1, time: Math.floor(Date.now() / 1000) };
});
