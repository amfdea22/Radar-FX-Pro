import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { SymbolLockService } from './SymbolLockService';

// ========== INTERFACES ==========
interface SwingSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    useRiskPercentage: boolean;
    riskPercentage: number;
    minSwingScore: number;       // Mínimo SwingScore para abrir trade (0-100)
    atrSlMultiplier: number;     // SL = ATR * multiplier (ex: 1.5)
    atrTpMultiplier: number;     // TP = ATR * multiplier (ex: 3.0)
    trailingActivation: number;  // Ativar trailing após Nx risco alcançado
    maxPositionsPerSymbol: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    cooldownMinutes: number;
    magic: number;
}

interface SwingAnalysis {
    symbol: string;
    swingScore: number;
    direction: 'BUY' | 'SELL' | null;
    trendD1: 'BULLISH' | 'BEARISH' | 'FLAT';
    trendH4: 'BULLISH' | 'BEARISH' | 'FLAT';
    triggerH1: 'BUY' | 'SELL' | null;
    triggerPattern: string;
    rsi14: number;
    macdSignal: 'BUY' | 'SELL' | 'NEUTRAL';
    atrH4: number;
    volumeRatio: number;
    // Breakdown do SwingScore
    scores: {
        trendAlignment: number;   // 0-30
        pullbackQuality: number;  // 0-25
        patternTrigger: number;   // 0-25
        volumeConfirm: number;    // 0-10
        momentum: number;         // 0-10
    };
}

interface SwingPosition {
    ticket: number;
    symbol: string;
    type: number; // 0=BUY, 1=SELL
    volume: number;
    price_open: number;
    sl: number;
    tp: number;
    profit: number;
    comment: string;
}

const SETTINGS_PATH = path.join(process.cwd(), 'swing_trader_settings.json');

export class SwingTraderEngine {
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static settings: SwingSettings = {
        enabled: false,
        symbols: ['XAUUSD', 'BTCUSD'],
        lotSize: 0.01,
        useRiskPercentage: true,
        riskPercentage: 1.0,
        minSwingScore: 70,
        atrSlMultiplier: 1.5,
        atrTpMultiplier: 3.0,
        trailingActivation: 1.5,
        maxPositionsPerSymbol: 2,
        maxDailyLoss: 50,
        maxDailyProfit: 200,
        cooldownMinutes: 30,
        magic: 777222
    };

    private static state = {
        analyses: {} as Record<string, SwingAnalysis>,
        watchlist: {} as { [symbol: string]: any },
        positions: [] as SwingPosition[],
        dailyProfit: 0,
        dailyLoss: 0,
        lastTradeTime: {} as Record<string, number>,
        isProcessing: false,
        lastResetDay: '',
        logs: [] as { time: string; msg: string; type: 'INFO' | 'TRADE' | 'WARN' | 'SCORE' }[]
    };

    // ========== INIT ==========
    static init() {
        this.loadSettings();
        console.log('📈 Swing Trader IA v1.0 ONLINE (60s Cycle) | Symbols:', this.settings.symbols.join(', '));
        setInterval(() => this.mainCycle(), 60000); // 1 minuto
        // Primeira análise imediata após 5s
        setTimeout(() => this.mainCycle(), 5000);
    }

    // ========== SETTINGS ==========
    private static loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
            }
        } catch (err) {
            console.error('SwingTrader: Error loading settings:', err);
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (err) {
            console.error('SwingTrader: Error saving settings:', err);
        }
    }

    static updateSettings(newSettings: Partial<SwingSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    static getStatus() {
        return {
            settings: this.settings,
            analyses: this.state.analyses,
            watchlist: this.state.watchlist,
            positions: this.state.positions,
            activePositions: this.state.positions.length,
            dailyProfit: this.state.dailyProfit,
            dailyLoss: this.state.dailyLoss,
            logs: this.state.logs.slice(0, 30)
        };
    }

    // ========== LOGGING ==========
    private static addLog(msg: string, type: 'INFO' | 'TRADE' | 'WARN' | 'SCORE' = 'INFO') {
        const time = new Date().toLocaleTimeString('pt-BR');
        this.state.logs.unshift({ time, msg, type });
        if (this.state.logs.length > 60) this.state.logs.pop();
        console.log(`[SwingTrader] ${msg}`);
    }

    // ========== CICLO PRINCIPAL (60s) ==========
    private static async mainCycle() {
        if (!this.settings.enabled || this.state.isProcessing) return;
        this.state.isProcessing = true;

        try {
            // Reset diário
            this.checkDailyReset();

            // Travas de risco
            if (this.state.dailyLoss >= this.settings.maxDailyLoss) {
                this.addLog(`🛑 Limite de perda diária ($${this.settings.maxDailyLoss}) atingido. Operações suspensas.`, 'WARN');
                this.state.isProcessing = false;
                return;
            }
            if (this.state.dailyProfit >= this.settings.maxDailyProfit) {
                this.addLog(`💰 Limite de lucro diário ($${this.settings.maxDailyProfit}) atingido. Operações suspensas.`, 'INFO');
                this.state.isProcessing = false;
                return;
            }

            // Sync posições
            await this.syncPositions();

            this.addLog('🔍 Iniciando Swing Analysis MTF...', 'INFO');
            const newAnalyses: { [symbol: string]: SwingAnalysis } = {};
            const newWatchlist: { [symbol: string]: any } = {};

            // Analisar cada símbolo
            for (const symbol of this.settings.symbols) {
                try {
                    const analysis = await this.analyzeSymbol(symbol);
                    newAnalyses[symbol] = analysis;

                    // Watchlist: Sinais Futuros (Score 40-69 ou Tendência OK mas sem gatilho)
                    if (analysis.swingScore >= 40 && analysis.swingScore < this.settings.minSwingScore) {
                        newWatchlist[symbol] = {
                            score: analysis.swingScore,
                            trend: analysis.trendD1,
                            message: analysis.swingScore < 55 ? "Aguardando Pullback" : "Aguardando Gatilho H1",
                            lastUpdate: new Date().toLocaleTimeString()
                        };
                    }

                    // Lógica de abertura permanece a mesma (Score >= min)
                    // Verificar se deve abrir trade
                    if (analysis.swingScore >= this.settings.minSwingScore && analysis.direction) {
                        await this.evaluateEntry(symbol, analysis);
                    }
                } catch (err) {
                    // Silencioso por ativo
                    this.addLog(`⚠️ Erro ao analisar ${symbol}: ${(err as any).message}`, 'WARN');
                }
            }

            this.state.analyses = newAnalyses;
            this.state.watchlist = newWatchlist;
            this.addLog(`✅ Análise concluída: ${Object.keys(newAnalyses).length} ativos monitorados.`, 'INFO');

            // Gerenciar trailing das posições
            await this.manageTrailing();

        } catch (err) {
            console.error('SwingTrader Cycle Error:', (err as any).message);
            this.addLog(`❌ Erro no ciclo principal: ${(err as any).message}`, 'WARN');
        } finally {
            this.state.isProcessing = false;
        }
    }

    // ========== RESET DIÁRIO ==========
    private static checkDailyReset() {
        const today = new Date().toISOString().slice(0, 10);
        if (this.state.lastResetDay !== today) {
            this.state.dailyProfit = 0;
            this.state.dailyLoss = 0;
            this.state.lastResetDay = today;
            this.state.lastTradeTime = {}; // Clear cooldowns
            this.state.watchlist = {}; // Clear watchlist
            this.addLog('🔄 Reset diário executado.', 'INFO');
        }
    }

    // ========== SYNC POSIÇÕES ==========
    private static async syncPositions() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions?magic=${this.settings.magic}`, { timeout: 10000 });
            this.state.positions = Array.isArray(resp.data) ? resp.data : [];

            let profit = 0;
            let loss = 0;
            for (const pos of this.state.positions) {
                if (pos.profit >= 0) profit += pos.profit;
                else loss += Math.abs(pos.profit);
            }
            this.state.dailyProfit = profit;
            this.state.dailyLoss = loss;
        } catch {
            this.state.positions = [];
            this.addLog('⚠️ Falha ao sincronizar posições com a Bridge.', 'WARN');
        }
    }

    // ========== ANÁLISE MULTI-TIMEFRAME ==========
    private static async analyzeSymbol(symbol: string): Promise<SwingAnalysis> {
        // Normalizar símbolos
        if (symbol === 'GOLD') symbol = 'XAUUSD';
        // Fetch candles de 3 timeframes (H4 real da Bridge)
        const [d1Candles, h4Candles, h1Candles] = await Promise.all([
            this.fetchCandles(symbol, 'D1', 60),
            this.fetchCandles(symbol, 'H4', 50),
            this.fetchCandles(symbol, 'H1', 50)
        ]);

        // Validar dados mínimos
        if (d1Candles.length < 50 || h4Candles.length < 40 || h1Candles.length < 40) {
            throw new Error(`Dados insuficientes para ${symbol}`);
        }

        // Calcular indicadores
        const ema50D1 = this.calcEMA(d1Candles.map(c => c.close), 50);
        const ema200D1 = this.calcEMA(d1Candles.map(c => c.close), 200);
        const ema21H4 = this.calcEMA(h4Candles.map(c => c.close), 21);

        const lastD1 = d1Candles[d1Candles.length - 1];
        const lastH4 = h4Candles[h4Candles.length - 1];
        const lastH1 = h1Candles[h1Candles.length - 2]; // Vela FECHADA

        // Trend D1
        const trendD1: 'BULLISH' | 'BEARISH' | 'FLAT' =
            ema50D1 > ema200D1 * 1.001 ? 'BULLISH' :
                ema50D1 < ema200D1 * 0.999 ? 'BEARISH' : 'FLAT';

        // Trend H4
        const lastH4Close = lastH4?.close || 0;
        const trendH4: 'BULLISH' | 'BEARISH' | 'FLAT' =
            lastH4Close > ema21H4 * 1.0005 ? 'BULLISH' :
                lastH4Close < ema21H4 * 0.9995 ? 'BEARISH' : 'FLAT';

        // RSI 14 (H4)
        const rsi14 = this.calcRSI(h4Candles.map(c => c.close), 14);

        // MACD (H4)
        const macd = this.calcMACD(h4Candles.map(c => c.close));

        // ATR 14 (H4)
        const atrH4 = this.calcATR(h4Candles, 14);

        // Volume Ratio (H4)
        const volumes = h4Candles.slice(-20).map(c => c.tick_volume || 0);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const lastVolume = h4Candles[h4Candles.length - 1]?.tick_volume || 0;
        const volumeRatio = avgVolume > 0 ? lastVolume / avgVolume : 1;

        // Trigger H1 (Padrões)
        const trigger = this.detectH1Trigger(h1Candles);

        // ========== CALCULAR SWING SCORE ==========
        const scores = this.calculateSwingScore(trendD1, trendH4, rsi14, macd, trigger, volumeRatio);
        const swingScore = scores.trendAlignment + scores.pullbackQuality + scores.patternTrigger + scores.volumeConfirm + scores.momentum;

        // Direção final
        let direction: 'BUY' | 'SELL' | null = null;
        if (swingScore >= this.settings.minSwingScore) {
            if (trendD1 === 'BULLISH' && trigger.direction === 'BUY') direction = 'BUY';
            else if (trendD1 === 'BEARISH' && trigger.direction === 'SELL') direction = 'SELL';
            // Flat D1: seguir H4
            else if (trendD1 === 'FLAT' && trendH4 !== 'FLAT' && trigger.direction) {
                if (trendH4 === 'BULLISH' && trigger.direction === 'BUY') direction = 'BUY';
                else if (trendH4 === 'BEARISH' && trigger.direction === 'SELL') direction = 'SELL';
            }
        }

        return {
            symbol,
            swingScore: Math.round(swingScore),
            direction,
            trendD1,
            trendH4,
            triggerH1: trigger.direction,
            triggerPattern: trigger.pattern,
            rsi14: Math.round(rsi14 * 10) / 10,
            macdSignal: macd.signal,
            atrH4: Math.round(atrH4 * 100) / 100,
            volumeRatio: Math.round(volumeRatio * 100) / 100,
            scores
        };
    }

    // ========== SWING SCORE (0-100) ==========
    private static calculateSwingScore(
        trendD1: string, trendH4: string, rsi: number,
        macd: { signal: string; histogram: number },
        trigger: { direction: 'BUY' | 'SELL' | null; pattern: string },
        volumeRatio: number
    ) {
        let trendAlignment = 0;   // Max 30
        let pullbackQuality = 0;  // Max 25
        let patternTrigger = 0;   // Max 25
        let volumeConfirm = 0;    // Max 10
        let momentum = 0;         // Max 10

        // 1. TREND ALIGNMENT (30pts)
        if (trendD1 === 'BULLISH' || trendD1 === 'BEARISH') trendAlignment += 15;
        if (trendH4 === trendD1) trendAlignment += 15; // Alinhamento perfeito
        else if (trendH4 !== 'FLAT') trendAlignment += 5;

        // 2. PULLBACK QUALITY (25pts) — RSI na zona ideal
        if (trendD1 === 'BULLISH' || trendH4 === 'BULLISH') {
            // Para compra: RSI ideal entre 35-55 (pullback saudável)
            if (rsi >= 35 && rsi <= 55) pullbackQuality = 25;
            else if (rsi >= 30 && rsi <= 60) pullbackQuality = 15;
            else if (rsi < 30) pullbackQuality = 20; // Oversold = bom para compra
            else pullbackQuality = 5;
        } else if (trendD1 === 'BEARISH' || trendH4 === 'BEARISH') {
            // Para venda: RSI ideal entre 45-65 (pullback saudável)
            if (rsi >= 45 && rsi <= 65) pullbackQuality = 25;
            else if (rsi >= 40 && rsi <= 70) pullbackQuality = 15;
            else if (rsi > 70) pullbackQuality = 20; // Overbought = bom para venda
            else pullbackQuality = 5;
        }

        // 3. PATTERN TRIGGER (25pts)
        if (trigger.direction) {
            const alignedWithTrend =
                (trendD1 === 'BULLISH' && trigger.direction === 'BUY') ||
                (trendD1 === 'BEARISH' && trigger.direction === 'SELL');

            if (alignedWithTrend) {
                if (trigger.pattern.includes('Engolfo')) patternTrigger = 25;
                else if (trigger.pattern.includes('Pin Bar')) patternTrigger = 22;
                else if (trigger.pattern.includes('BoS')) patternTrigger = 20;
                else patternTrigger = 15;
            } else {
                patternTrigger = 5; // Contra tendência = pouca pontuação
            }
        }

        // 4. VOLUME CONFIRMATION (10pts)
        if (volumeRatio >= 1.5) volumeConfirm = 10;
        else if (volumeRatio >= 1.2) volumeConfirm = 7;
        else if (volumeRatio >= 0.8) volumeConfirm = 4;

        // 5. MOMENTUM — MACD (10pts)
        if (trendD1 === 'BULLISH' && macd.signal === 'BUY') momentum = 10;
        else if (trendD1 === 'BEARISH' && macd.signal === 'SELL') momentum = 10;
        else if (macd.signal !== 'NEUTRAL') momentum = 5;

        return { trendAlignment, pullbackQuality, patternTrigger, volumeConfirm, momentum };
    }

    // ========== AVALIAR ENTRADA ==========
    private static async evaluateEntry(symbol: string, analysis: SwingAnalysis) {
        if (!analysis.direction) return;

        // Cooldown
        const lastTrade = this.state.lastTradeTime[symbol] || 0;
        const cooldownMs = this.settings.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastTrade < cooldownMs) {
            this.addLog(`⏳ ${symbol}: Em cooldown. Próxima entrada em ${Math.ceil((cooldownMs - (Date.now() - lastTrade)) / 60000)} min.`, 'INFO');
            return;
        }

        // Max posições por símbolo
        const symbolPositions = this.state.positions.filter(p =>
            p.symbol === symbol || p.symbol === symbol.replace('USD', '') + 'USD'
        );
        if (symbolPositions.length >= this.settings.maxPositionsPerSymbol) {
            this.addLog(`🚫 ${symbol}: Limite de posições (${this.settings.maxPositionsPerSymbol}) atingido.`, 'INFO');
            return;
        }

        // Calcular SL e TP baseados no ATR
        const atr = analysis.atrH4;
        if (atr <= 0) {
            this.addLog(`⚠️ ${symbol}: ATR inválido (${atr}). Não é possível calcular SL/TP.`, 'WARN');
            return;
        }

        const sl = atr * this.settings.atrSlMultiplier;
        const tp = atr * this.settings.atrTpMultiplier;

        this.addLog(
            `🎯 SWING SIGNAL [${symbol}] ${analysis.direction} | Score: ${analysis.swingScore}/100 | ` +
            `D1:${analysis.trendD1} H4:${analysis.trendH4} | ${analysis.triggerPattern} | ` +
            `SL:$${sl.toFixed(2)} TP:$${tp.toFixed(2)}`,
            'SCORE'
        );

        // Abrir ordem
        await this.placeOrder(symbol, analysis.direction, sl, tp, analysis.swingScore);
    }

    // ========== ABRIR ORDEM ==========
    private static async placeOrder(symbol: string, side: 'BUY' | 'SELL', slDistance: number, tpDistance: number, score: number) {
        try {
            // Buscar preço atual
            const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 10000 });
            const tick = tickResp.data[symbol];
            if (!tick) {
                this.addLog(`❌ Falha ao obter tick para ${symbol}.`, 'WARN');
                return;
            }

            const price = side === 'BUY' ? tick.ask : tick.bid;
            const sl = side === 'BUY' ? price - slDistance : price + slDistance;
            const tp = side === 'BUY' ? price + tpDistance : price - tpDistance;

            // Calcular lote por % de risco ou usar lote fixo
            let lot = this.settings.lotSize;
            if (this.settings.useRiskPercentage && slDistance > 0) {
                let balance = 1000;
                try {
                    const acc = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 2000 });
                    if (acc.data?.balance) balance = acc.data.balance;
                } catch (e) { /* usa saldo padrão */ }
                const riskUSD = (balance * this.settings.riskPercentage) / 100;
                const calcLot = riskUSD / (slDistance * 100);
                lot = Number(Math.max(0.01, Math.min(50, calcLot)).toFixed(2));
                this.addLog(`📊 Lote calculado por risco: ${lot} (${this.settings.riskPercentage}% de $${balance.toFixed(2)})`, 'INFO');
            }

            const resp = await axios.post(`${this.BRIDGE_URL}/order`, {
                action: side,
                symbol: symbol,
                lot: lot,
                sl: sl,
                tp: tp,
                magic: this.settings.magic,
                comment: `Swing_IA_${score}`
            }, { timeout: 15000 });

            if (resp.data?.status === 'success') {
                const ticket = resp.data?.ticket || resp.data?.order_id || 0;
                SymbolLockService.acquire(symbol, 'Swing IA', ticket, side);
                this.state.lastTradeTime[symbol] = Date.now();
                this.addLog(`✅ SWING TRADE ABERTO [${symbol}] ${side} @ ${price.toFixed(2)} | SL:${sl.toFixed(2)} TP:${tp.toFixed(2)} | Score:${score}`, 'TRADE');
                try {
                    const { TradeNotificationBot } = require('./TradeNotificationBot');
                    TradeNotificationBot.notifyTradeOpened('Swing IA', symbol, side, lot, price, sl, tp);
                } catch (e) {}
            } else {
                this.addLog(`❌ Falha ao abrir ordem para ${symbol}: ${resp.data?.error || 'Unknown'}`, 'WARN');
            }
        } catch (err: any) {
            this.addLog(`❌ Erro ao abrir ordem para ${symbol}: ${err.response?.data?.error || err.message}`, 'WARN');
        }
    }

    // ========== TRAILING STOP + PROTEÇÃO PARCIAL ==========
    private static async manageTrailing() {
        for (const pos of this.state.positions) {
            try {
                const analysis = this.state.analyses[pos.symbol];
                if (!analysis || analysis.atrH4 <= 0) continue;

                const slDist = analysis.atrH4 * this.settings.atrSlMultiplier;
                const tpDist = analysis.atrH4 * this.settings.atrTpMultiplier;
                const activationDist = slDist * this.settings.trailingActivation;
                const partialTPDist = tpDist * 0.5; // 50% do TP

                const tickResp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [pos.symbol] }, { timeout: 5000 });
                const tick = tickResp.data[pos.symbol];
                if (!tick) continue;

                const currentPrice = pos.type === 0 ? tick.bid : tick.ask;
                const priceMove = pos.type === 0
                    ? currentPrice - pos.price_open
                    : pos.price_open - currentPrice;

                // Proteção parcial: mover SL para breakeven ao atingir 50% do TP
                if (priceMove >= partialTPDist && pos.sl !== pos.price_open) {
                    const breakevenSl = pos.type === 0
                        ? pos.price_open + (slDist * 0.1)
                        : pos.price_open - (slDist * 0.1);
                    const shouldMoveBE = pos.type === 0
                        ? breakevenSl > (pos.sl || 0)
                        : breakevenSl < (pos.sl || 999999);
                    if (shouldMoveBE) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: breakevenSl,
                            magic: this.settings.magic
                        }, { timeout: 10000 });
                        this.addLog(`🔒 Proteção parcial #${pos.ticket}: SL movido para breakeven (${breakevenSl.toFixed(2)})`, 'INFO');
                    }
                }

                // Trailing stop ativado após 1.5x SL
                if (priceMove >= activationDist) {
                    const newSl = pos.type === 0
                        ? currentPrice - slDist
                        : currentPrice + slDist;

                    const shouldMove = pos.type === 0
                        ? newSl > (pos.sl || 0)
                        : newSl < (pos.sl || 999999);

                    if (shouldMove) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket,
                            sl: newSl,
                            magic: this.settings.magic
                        }, { timeout: 10000 });
                        this.addLog(`🔄 Trailing #${pos.ticket} SL → ${newSl.toFixed(2)}`, 'INFO');
                    }
                }
            } catch (err: any) {
                this.addLog(`⚠️ Erro no trailing para #${pos.ticket}: ${err.message}`, 'WARN');
            }
        }
    }

    // ========== RESET ==========
    static async resetDay() {
        this.state.dailyProfit = 0;
        this.state.dailyLoss = 0;
        this.state.lastTradeTime = {};
        this.state.watchlist = {};
        this.addLog('🔄 Reset manual executado.', 'INFO');
    }

    // ========== HELPERS: FETCH CANDLES ==========
    private static async fetchCandles(symbol: string, timeframe: string, count: number): Promise<any[]> {
        try {
            const resp = await axios.get(
                `${this.BRIDGE_URL}/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`,
                { timeout: 10000 }
            );
            return Array.isArray(resp.data) ? resp.data : [];
        } catch {
            return [];
        }
    }

    // ========== HELPERS: INDICADORES ==========
    private static calcEMA(data: number[], period: number): number {
        if (data.length < period) return data[data.length - 1] || 0;
        const k = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private static calcRSI(closes: number[], period: number): number {
        if (closes.length < period + 1) return 50;
        let avgGain = 0, avgLoss = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) avgGain += diff;
            else avgLoss += Math.abs(diff);
        }
        avgGain /= period;
        avgLoss /= period;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }

    private static calcMACD(closes: number[]): { signal: 'BUY' | 'SELL' | 'NEUTRAL'; histogram: number } {
        if (closes.length < 35) return { signal: 'NEUTRAL', histogram: 0 };

        // Calcular EMA12 e EMA26 incrementalmente para todas as barras
        const k12 = 2 / 13;
        const k26 = 2 / 27;
        const macdLine: number[] = [];
        let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
        let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

        for (let i = 0; i < closes.length; i++) {
            if (i >= 12) ema12 = closes[i] * k12 + ema12 * (1 - k12);
            if (i >= 26) {
                ema26 = closes[i] * k26 + ema26 * (1 - k26);
                macdLine.push(ema12 - ema26);
            }
        }

        if (macdLine.length < 2) return { signal: 'NEUTRAL', histogram: 0 };

        const currentMacd = macdLine[macdLine.length - 1];
        const prevMacd = macdLine[macdLine.length - 2];

        // Signal line = EMA9 da linha MACD
        const k9 = 2 / 10;
        let signalLine = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
        for (let i = 9; i < macdLine.length; i++) {
            signalLine = macdLine[i] * k9 + signalLine * (1 - k9);
        }

        const histogram = currentMacd - signalLine;

        // Sinal BUY: histograma > 0 e MACD subindo, SELL: histograma < 0 e MACD caindo
        const signal: 'BUY' | 'SELL' | 'NEUTRAL' =
            histogram > 0 && currentMacd > prevMacd ? 'BUY' :
                histogram < 0 && currentMacd < prevMacd ? 'SELL' : 'NEUTRAL';

        return { signal, histogram };
    }

    private static calcATR(candles: any[], period: number): number {
        if (candles.length < period + 1) return 0;
        const trs: number[] = [];
        for (let i = 1; i < candles.length; i++) {
            const hl = candles[i].high - candles[i].low;
            const hc = Math.abs(candles[i].high - candles[i - 1].close);
            const lc = Math.abs(candles[i].low - candles[i - 1].close);
            trs.push(Math.max(hl, hc, lc));
        }
        const slice = trs.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    }

    // ========== HELPERS: PADRÕES H1 ==========
    private static detectH1Trigger(candles: any[]): { direction: 'BUY' | 'SELL' | null; pattern: string } {
        if (candles.length < 4) return { direction: null, pattern: 'Sem dados' };

        const last = candles[candles.length - 2]; // Vela FECHADA
        const prev = candles[candles.length - 3];
        const prev2 = candles[candles.length - 4];

        if (!last || !prev) return { direction: null, pattern: 'Sem dados' };

        const body = Math.abs(last.close - last.open);
        const range = last.high - last.low;
        if (range === 0) return { direction: null, pattern: 'Doji' };
        const bodyRatio = body / range;

        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        const prevBody = Math.abs(prev.close - prev.open);

        // Pin Bar COMPRA: pavio inferior longo
        if (bodyRatio <= 0.35 && lowerWick / range >= 0.60) {
            return { direction: 'BUY', pattern: '📌 Pin Bar Bullish (H1)' };
        }

        // Pin Bar VENDA: pavio superior longo
        if (bodyRatio <= 0.35 && upperWick / range >= 0.60) {
            return { direction: 'SELL', pattern: '📌 Pin Bar Bearish (H1)' };
        }

        // Engolfo COMPRA
        if (prev.close < prev.open && last.close > last.open && body > prevBody * 1.3) {
            return { direction: 'BUY', pattern: '🔥 Engolfo Bullish (H1)' };
        }

        // Engolfo VENDA
        if (prev.close > prev.open && last.close < last.open && body > prevBody * 1.3) {
            return { direction: 'SELL', pattern: '🔥 Engolfo Bearish (H1)' };
        }

        // Break of Structure (BoS) COMPRA: último high > prev2 high após falling
        if (prev2.close < prev2.open && prev.close < prev.open && last.close > last.open) {
            if (last.high > prev.high && last.high > prev2.high) {
                return { direction: 'BUY', pattern: '⚡ Break of Structure ↑ (H1)' };
            }
        }

        // Break of Structure (BoS) VENDA
        if (prev2.close > prev2.open && prev.close > prev.open && last.close < last.open) {
            if (last.low < prev.low && last.low < prev2.low) {
                return { direction: 'SELL', pattern: '⚡ Break of Structure ↓ (H1)' };
            }
        }
        return { direction: null, pattern: 'Aguardando padrão...' };
    }

    // ========== TERMINAL COMMANDS ==========
    static async executeCommand(cmd: string): Promise<string> {
        const parts = cmd.trim().toLowerCase().split(' ');
        const base = parts[0];
        const args = parts.slice(1);

        this.addLog(`💻 CLI Command: ${cmd}`, 'INFO');

        switch (base) {
            case 'help':
                return 'Comandos disponíveis:\n' +
                    '- status: Resumo atual\n' +
                    '- enable/disable: Liga/Desliga o robô\n' +
                    '- set lot <valor>: Ajusta lote fixo\n' +
                    '- set score <valor>: Ajusta score mínimo (30-95)\n' +
                    '- buy/sell <symbol>: Ordem manual (ex: buy gold)\n' +
                    '- reset: Reseta o dia\n' +
                    '- symbols: Lista ativos';

            case 'status':
                return `[STATUS] Active:${this.settings.enabled} | ScoreMin:${this.settings.minSwingScore} | Lot:${this.settings.lotSize} | Pos:${this.state.positions.length} | DailyProfit:$${this.state.dailyProfit.toFixed(2)}`;

            case 'enable':
                this.updateSettings({ enabled: true });
                return '⚡ Swing Trader IA ATIVADO.';

            case 'disable':
                this.updateSettings({ enabled: false });
                return '🛑 Swing Trader IA DESATIVADO.';

            case 'set':
                if (args[0] === 'lot' && args[1]) {
                    const lot = parseFloat(args[1]);
                    if (isNaN(lot)) return 'Erro: Lote inválido.';
                    this.updateSettings({ lotSize: lot });
                    return `✅ Lote: ${lot}`;
                }
                if (args[0] === 'score' && args[1]) {
                    const score = parseInt(args[1]);
                    if (score < 30 || score > 95) return 'Erro: Score 30-95.';
                    this.updateSettings({ minSwingScore: score });
                    return `✅ Score Mín: ${score}`;
                }
                return 'Use: set lot <X> ou set score <X>';

            case 'reset':
                await this.resetDay();
                return '🔄 Reset diário concluído.';

            case 'symbols':
                return `Ativos: ${this.settings.symbols.join(', ')}`;

            case 'buy':
            case 'sell':
                let symbol = args[0]?.toUpperCase();
                if (!symbol) return 'Uso: buy <symbol>';
                if (symbol === 'GOLD') symbol = 'XAUUSD';
                if (symbol === 'BITCOIN') symbol = 'BTCUSD';
                const side = base === 'buy' ? 'BUY' : 'SELL';
                const analysis = this.state.analyses[symbol];
                const sl = (analysis?.atrH4 || 10) * this.settings.atrSlMultiplier;
                const tp = (analysis?.atrH4 || 10) * this.settings.atrTpMultiplier;
                await this.placeOrder(symbol, side, sl, tp, 100);
                return `🚀 Executando ${side} ${symbol}...`;

            default:
                return `Comando desconhecido: ${base}`;
        }
    }
}
