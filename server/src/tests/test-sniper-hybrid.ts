/**
 * TESTE DE SOBERANIA SNIPER HÍBRIDO (v14.0)
 * Este teste simula os dados da Bridge MT5 e valida a lógica de decisão.
 */

interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
}

function detectSignal(candles: Candle[], ma21: number) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const body = Math.max(0.001, Math.abs(last.open - last.close));
    const lw = Math.min(last.open, last.close) - last.low;
    const uw = last.high - Math.max(last.open, last.close);

    const isRejBuy = lw >= (body * 1.1);
    const isRejSell = uw >= (body * 1.1);
    const isEngBuy = (last.close > prev.high);
    const isEngSell = (last.close < prev.low);
    const isTouchBuy = last.low <= ma21 && last.close >= ma21;
    const isTouchSell = last.high >= ma21 && last.close <= ma21;

    if ((isRejBuy || isEngBuy || isTouchBuy) && last.close > ma21) return 'BUY';
    if ((isRejSell || isEngSell || isTouchSell) && last.close < ma21) return 'SELL';
    return null;
}

function runSimulation(m1Candles: Candle[], m5Candles: Candle[], currentM5Trend: 'UP' | 'DOWN' | 'FLAT') {
    console.log(`\n--- Simulação Sniper [M5 Trend: ${currentM5Trend}] ---`);
    
    // Calcula Médias 21 (Simplificado p/ teste)
    const ma21M1 = m1Candles.map(c => c.close).reduce((a,b) => a+b, 0) / m1Candles.length;
    const ma21M5 = m5Candles.map(c => c.close).reduce((a,b) => a+b, 0) / m5Candles.length;

    const m1Sig = detectSignal(m1Candles, ma21M1);
    const m5Sig = detectSignal(m5Candles, ma21M5);

    console.log(`>> Sinal detectado em M1: ${m1Sig || 'NONE'}`);
    console.log(`>> Sinal detectado em M5: ${m5Sig || 'NONE'}`);

    let decision = { trigger: null as string | null, source: null as string | null, status: '' };

    if (m5Sig) {
        decision = { trigger: m5Sig, source: 'M5', status: '✅ SOBERANIA M5: Gatilho Direto!' };
    } else if (m1Sig) {
        const conflict = (m1Sig === 'BUY' && currentM5Trend === 'DOWN') || 
                         (m1Sig === 'SELL' && currentM5Trend === 'UP');
        if (!conflict) {
            decision = { trigger: m1Sig, source: 'M1', status: '✅ ALINHADO: Entrada M1 Permitida pelo M5.' };
        } else {
            decision = { trigger: null, source: null, status: '🚫 BLOQUEADO: M1 tentando ir contra a tendência de M5!' };
        }
    } else {
        decision = { trigger: null, source: null, status: '⏳ AGUARDANDO: Sem sinais claros.' };
    }

    console.log(`RESULTADO: ${decision.status}`);
    if (decision.trigger) {
        const tp = decision.source === 'M5' ? 15.00 : 6.00;
        const sl = decision.source === 'M5' ? 5.00 : 2.50;
        console.log(`DADOS DA ORDEM: Lote 0.10 | TP: $${tp} | SL: $${sl}`);
    }
}

// MOCK DATA
const ma21Base = 2380.00;

// CENÁRIO 1: CONFLITO - M1 quer comprar, mas M5 está em queda
const m1Conflict = [
    { open: 2381.0, high: 2382.5, low: 2380.5, close: 2382.0 }, // Bullish Engulfing em M1
];
const m5DownTrend = [
    { open: 2385.0, high: 2385.5, low: 2375.0, close: 2378.0 }, // Preço abaixo da MA21 (2380)
];
runSimulation(m1Conflict, m5DownTrend, 'DOWN');

// CENÁRIO 2: ALINHAMENTO - M1 e M5 em alta
const m5UpTrend = [
    { open: 2380.0, high: 2385.5, low: 2380.0, close: 2384.0 }, // Preço acima da MA21
];
runSimulation(m1Conflict, m5UpTrend, 'UP');

// CENÁRIO 3: GATILHO SOBERANO - M5 detecta Rejeição
const m5Rejection = [
    { open: 2382.0, high: 2383.0, low: 2375.0, close: 2381.0 }, // Wick longa inferior em M5
];
runSimulation(m1Conflict, m5Rejection, 'UP');
