import axios from 'axios';
import { AlertEngine } from './AlertEngine';
import { MarketService } from './MarketService';
import { DisciplineEngine } from './DisciplineEngine';
import { SymbolLockService } from './SymbolLockService';
import fs from 'fs';
import path from 'path';

export type ProbabilisticStrategy = 'MHI1' | 'MHI2' | 'MHI3' | 'TWIN_TOWERS' | 'CYCLE_OF_3' | 'SEVEN';

export interface OmniSettings {
    enabled: boolean;
    symbols: string[];
    strategy: ProbabilisticStrategy;
    timeframe: 'M1' | 'M5';
    defaultLot: number;
    useMartingale: boolean;
    martingaleLevels: number;
    martingaleMultiplier: number;
    useTrendFilter: boolean;
    useRSIFilter: boolean;
    minRSITreshold: number;
    maxRSITreshold: number;
    magic: number;
    // Dynamic entry
    useDynamicEntry: boolean;
    atrMultiplier: number;
    minPipsFromLastEntry: number;
    cooldownMinutesAfterLoss: number;
    maxEntriesPerHour: number;
    // Breakeven & trailing
    useBreakeven: boolean;
    useTrailing: boolean;
    breakevenThreshold: number;
    trailingLevel1Pct: number;
    trailingLevel1Trail: number;
    trailingLevel2Pct: number;
    trailingLevel2Trail: number;
    trailingLevel3Pct: number;
    trailingLevel3Trail: number;
    lockProfitPct: number;
    lockProfitLockPct: number;
    // Filters
    maxSpread: number;
    elephantCandleMultiplier: number;
}

export class OmniProbabilisticEngine {
    private static isRunning = false;
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'omni_probabilistic_settings.json');
    
    // Telemetria e Rastreamento
    private static processedQuadrants = new Set<string>();
    private static lastTickets = new Map<string, { ticket: number, level: number, action: 'BUY' | 'SELL' }>();
    private static lastEntryPrices = new Map<string, { price: number, time: number }>();
    private static cooldowns = new Map<string, number>();
    private static entryCounters = new Map<string, { hour: number, count: number }>();
    private static logs: { time: string, msg: string, type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' }[] = [];

    private static settings: OmniSettings = {
        enabled: false,
        symbols: ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD'],
        strategy: 'MHI1',
        timeframe: 'M1',
        defaultLot: 0.01,
        useMartingale: false,
        martingaleLevels: 1,
        martingaleMultiplier: 2.0,
        useTrendFilter: true,
        useRSIFilter: true,
        minRSITreshold: 30,
        maxRSITreshold: 70,
        magic: 999111,
        useDynamicEntry: false,
        atrMultiplier: 0.5,
        minPipsFromLastEntry: 50,
        cooldownMinutesAfterLoss: 240,
        maxEntriesPerHour: 2,
        breakevenThreshold: 0.015,
        useBreakeven: true,
        useTrailing: true,
        trailingLevel1Pct: 0.05,
        trailingLevel1Trail: 0.02,
        trailingLevel2Pct: 0.10,
        trailingLevel2Trail: 0.04,
        trailingLevel3Pct: 0.15,
        trailingLevel3Trail: 0.06,
        lockProfitPct: 0.08,
        lockProfitLockPct: 0.03,
        maxSpread: 30,
        elephantCandleMultiplier: 3
    };

    private static cycleTimer: NodeJS.Timeout | null = null;

    static onEmergencyReset() {
        this.processedQuadrants.clear();
        console.log('[Omni] Emergency Reset — quadrantes zerados.');
    }

    static start() {
        if (this.isRunning) return;
        this.loadSettings();
        this.isRunning = true;
        console.log('[Omni] Engine INICIADO. Enabled:', this.settings.enabled, 'Strategy:', this.settings.strategy, 'Symbols:', this.settings.symbols);
        this.addLog('Omni Engine: Serviço Probabilístico Universal INICIADO', 'SUCCESS');

        const runCycle = async () => {
            if (!this.isRunning) return;
            try {
                await this.processCycle();
            } catch (e: any) {
                console.log('[Omni] ERRO no ciclo:', e.message || e);
                this.addLog(`Erro no ciclo: ${e.message || e}`, 'ERROR');
            }
            this.cycleTimer = setTimeout(runCycle, 5000);
        };
        this.cycleTimer = setTimeout(runCycle, 5000);
    }

    static stop() {
        this.isRunning = false;
        if (this.cycleTimer) {
            clearTimeout(this.cycleTimer);
            this.cycleTimer = null;
        }
        this.addLog('Omni Engine: Parado', 'INFO');
    }

    private static addLog(msg: string, type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' = 'INFO') {
        const time = new Date().toLocaleTimeString();
        this.logs.unshift({ time, msg, type });
        if (this.logs.length > 50) this.logs.pop();
        console.log(`[${time}] 🌌 Omni [${type}]: ${msg}`);
    }

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const data = fs.readFileSync(this.SETTINGS_PATH, 'utf-8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
            } catch (e) {
                console.error('❌ Omni: Failed to load settings', e);
            }
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('❌ Omni: Failed to save settings', e);
        }
    }

    static updateSettings(newSettings: Partial<OmniSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    private static async processCycle() {
        if (!this.settings.enabled) {
            console.log('[Omni] processCycle: disabled, skipping');
            return;
        }

        await this.manageTrailingStops();

        // Verificar Disciplina Global
        const discipline = await DisciplineEngine.getDailyStatus();
        console.log('[Omni] Discipline:', discipline.isSafe, 'locked:', discipline.isLocked);
        if (!discipline.isSafe) {
            if (this.settings.enabled) {
                this.settings.enabled = false;
                console.log('[Omni] Disabled by discipline');
                AlertEngine.addAlert('GUARDIAN', 'CRITICAL', 'Motor Omni Pausado', 'Limite de disciplina atingido. Operações cessadas.');
            }
            return;
        }

        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Determinar se estamos em um ponto de entrada para MHI1, MHI2 ou MHI3
        // MHI1: Final do minuto 4, 9, 14... (Entra na vela 1)
        // MHI2: Final do minuto 0, 5, 10... (Entra na vela 2)
        // MHI3: Final do minuto 1, 6, 11... (Entra na vela 3)
        
        let targetVersion = 0;
        const mod5 = minutes % 5;

        if (mod5 === 4 && seconds >= 55) targetVersion = 1;
        else if (mod5 === 0 && seconds >= 55) targetVersion = 2;
        else if (mod5 === 1 && seconds >= 55) targetVersion = 3;

        console.log('[Omni] Timing: mod5=' + mod5 + ' sec=' + seconds + ' targetVer=' + targetVersion);

        // Se a estratégia selecionada for MHI e não for o tempo dela, ignora
        if (this.settings.strategy.startsWith('MHI')) {
            const stratVersion = parseInt(this.settings.strategy.replace('MHI', ''));
            if (targetVersion !== stratVersion) {
                console.log('[Omni] Wrong MHI version, need ' + stratVersion + ' got ' + targetVersion);
                return;
            }
        } else if (targetVersion === 0) {
            if (!(mod5 === 4 && seconds >= 55)) {
                console.log('[Omni] Not entry time for non-MHI, returning');
                return;
            }
        }

        const quadrantId = `${now.getHours()}:${minutes}:${Math.floor(seconds / 55)}`;
        console.log('[Omni] Entering! quadrantId=' + quadrantId + ' symbols=' + this.settings.symbols);
        if (this.processedQuadrants.has(quadrantId)) {
            console.log('[Omni] Quadrant already processed');
            return;
        }

        // Limpeza de cooldowns expirados
        const nowMs = Date.now();
        for (const [sym, expiry] of this.cooldowns) {
            if (nowMs >= expiry) this.cooldowns.delete(sym);
        }

        // Verificar perdas recentes para ativar cooldowns
        await this.checkRecentLosses();

        for (const symbol of this.settings.symbols) {
            // Verificar cooldown por perda
            const cooldownUntil = this.cooldowns.get(symbol);
            if (cooldownUntil && nowMs < cooldownUntil) {
                const remaining = Math.round((cooldownUntil - nowMs) / 1000);
                console.log(`[Omni] ${symbol} em cooldown por mais ${remaining}s`);
                continue;
            }

            // Verificar limite de entradas por hora
            if (!this.checkEntryRateLimit(symbol)) {
                this.addLog(`[${symbol}] Limite de entradas por hora atingido`, 'WARN');
                continue;
            }

            console.log('[Omni] Analyzing symbol:', symbol);
            await this.analyzeSymbol(symbol, quadrantId);
        }
    }

    private static async analyzeSymbol(symbol: string, quadrantId: string) {
        try {
            // 1. Buscar Histórico
            const resp = await axios.get(`${this.BRIDGE_URL}/candles`, {
                params: { symbol, count: 200, timeframe: this.settings.timeframe }
            });
            const candles = resp.data;
            if (!candles || candles.length < 5) return;

            const last5 = candles.slice(-5);
            const colors = last5.map((c: any) => c.close > c.open ? 'G' : 'R');

            // 2. Filtro dinâmico ATR (apenas se habilitado)
            if (this.settings.useDynamicEntry) {
                const atr = this.calculateATR(candles, 14);
                const currentClose = candles[candles.length - 1].close;
                const atrPct = atr / currentClose;
                // Entra apenas se ATR indicar volatilidade suficiente (pelo menos atrMultiplier %)
                if (atrPct < this.settings.atrMultiplier * 0.001) {
                    console.log(`[Omni] ${symbol} ATR muito baixo (${(atrPct * 100).toFixed(3)}%), ignorando`);
                    return;
                }
            }

            let signal: 'BUY' | 'SELL' | null = null;

            // 3. Aplicar Lógica por Estratégia
            switch (this.settings.strategy) {
                case 'MHI1':
                    signal = this.calculateMHI(colors, 1);
                    break;
                case 'MHI2':
                    signal = this.calculateMHI(colors, 2);
                    break;
                case 'MHI3':
                    signal = this.calculateMHI(colors, 3);
                    break;
                case 'TWIN_TOWERS':
                    signal = colors[0] === 'G' ? 'BUY' : 'SELL';
                    break;
                case 'CYCLE_OF_3':
                    if (colors[2] === colors[3] && colors[3] === colors[4]) {
                        signal = colors[4] === 'G' ? 'SELL' : 'BUY';
                    }
                    break;
            }

            if (!signal) return;

            // 4. Verificar distância mínima da última entrada
            const lastCandleClose = candles[candles.length - 1].close;
            if (!this.isDistanceOk(symbol, lastCandleClose)) {
                this.addLog(`[${symbol}] Distância mínima não atingida (${this.settings.minPipsFromLastEntry} pips)`, 'INFO');
                return;
            }

            // 5. Filtros de Segurança
            const isSafe = await this.applyFilters(symbol, candles, signal);
            if (!isSafe) return;

            // 6. Executar Ordem com suporte a Recuperação (Gale)
            const activeGale = this.lastTickets.get(symbol);
            let currentLot = this.settings.defaultLot;
            let currentLevel = 0;

            if (activeGale && this.settings.useMartingale && activeGale.level < this.settings.martingaleLevels) {
                try {
                    const history = await axios.get(`${this.BRIDGE_URL}/history`, { params: { ticket: activeGale.ticket } });
                    const trade = Array.isArray(history.data) ? history.data.find((t: any) => t.ticket === activeGale.ticket) : null;
                    
                    if (trade && trade.profit < 0) {
                        currentLevel = activeGale.level + 1;
                        currentLot = Number((activeGale.level === 0 ? this.settings.defaultLot * this.settings.martingaleMultiplier : currentLot * this.settings.martingaleMultiplier).toFixed(2));
                        this.addLog(`[Martingale] Perda detectada em ${symbol}. Aplicando Nível ${currentLevel} (Lote: ${currentLot})`, 'WARN');
                    }
                } catch (e) {
                    this.addLog(`Erro ao verificar histórico de Gale para ${symbol}`, 'ERROR');
                }
            }

            this.addLog(`${symbol}: Sinal [${this.settings.strategy}] -> ${signal} | Executando...`, 'INFO');
            const ticket = await this.executeTrade(symbol, signal, currentLot, currentLevel);
            
            if (ticket) {
                this.lastTickets.set(symbol, { ticket, level: currentLevel, action: signal });
                this.lastEntryPrices.set(symbol, { price: lastCandleClose, time: Date.now() });
                this.incrementEntryCounter(symbol);
            }
            
            this.processedQuadrants.add(quadrantId);

        } catch (e: any) {
            this.addLog(`[${symbol}] Erro em analyzeSymbol: ${e?.message || e}`, 'ERROR');
        }
    }

    private static calculateMHI(colors: string[], version: number): 'BUY' | 'SELL' | null {
        // Para MHI, analisamos as 3 últimas velas do quadrante de 5 velas.
        // Se colors[] tem 5 (ou mais), pegamos as 3 que precedem a entrada.
        
        let sample: string[] = [];
        if (version === 1) {
            // MHI1: Analisa velas 3, 4, 5 do quadrante anterior para entrar na 1 do atual
            // No array de 5, as 3 ultimas sao indices 2, 3, 4
            sample = colors.slice(-3);
        } else if (version === 2) {
            // MHI2: Analisa velas 4, 5, 1 para entrar na 2
            sample = [colors[colors.length-2], colors[colors.length-1], colors[0]];
        } else if (version === 3) {
            // MHI3: Analisa velas 5, 1, 2 para entrar na 3
            sample = [colors[colors.length-1], colors[0], colors[1]];
        }

        if (sample.length < 3) return null;

        const redCount = sample.filter(c => c === 'R').length;
        const greenCount = sample.filter(c => c === 'G').length;

        // Se houver empate (Doij), MHI geralmente não entra
        if (redCount === greenCount) return null;

        const minority = redCount < greenCount ? 'SELL' : 'BUY';
        return minority; 
    }

    private static async applyFilters(symbol: string, candles: any[], signal: 'BUY' | 'SELL'): Promise<boolean> {
        if (this.settings.useTrendFilter) {
            const closes = candles.map((c: any) => c.close);
            const sma200 = closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200;
            const currentPrice = closes[closes.length - 1];

            if (signal === 'BUY' && currentPrice < sma200) return false;
            if (signal === 'SELL' && currentPrice > sma200) return false;
        }

        // Filtro de spread
        const spreadOk = await this.checkSpread(symbol);
        if (!spreadOk) {
            this.addLog(`[${symbol}] Blocked by Spread filter`, 'WARN');
            return false;
        }

        // Filtro de Marubozu (Vela de força gigante - perigosa para probabilística)
        const lastCandle = candles[candles.length - 1];
        const body = Math.abs(lastCandle.open - lastCandle.close);
        const avgBody = candles.slice(-20).reduce((s: number, c: any) => s + Math.abs(c.open - c.close), 0) / 20;
        
        if (body > avgBody * this.settings.elephantCandleMultiplier) {
            console.log(`⚠️ Omni Filter: [${symbol}] Blocked by Elephant Candle (Volatility Spike)`);
            return false;
        }

        return true;
    }

    private static async checkSpread(symbol: string): Promise<boolean> {
        try {
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 3000 });
            const tick = resp.data?.[symbol];
            if (!tick || !tick.ask || !tick.bid) return true;
            const isForex = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'].some(p => symbol.startsWith(p));
            const spread = isForex ? (tick.ask - tick.bid) * 10000 : (tick.ask - tick.bid) * 100;
            return spread <= this.settings.maxSpread;
        } catch {
            return true;
        }
    }

    private static checkEntryRateLimit(symbol: string): boolean {
        const now = new Date();
        const currentHour = now.getHours();
        const counter = this.entryCounters.get(symbol);
        if (!counter || counter.hour !== currentHour) {
            this.entryCounters.set(symbol, { hour: currentHour, count: 0 });
            return true;
        }
        return counter.count < this.settings.maxEntriesPerHour;
    }

    private static incrementEntryCounter(symbol: string) {
        const now = new Date();
        const currentHour = now.getHours();
        const counter = this.entryCounters.get(symbol);
        if (!counter || counter.hour !== currentHour) {
            this.entryCounters.set(symbol, { hour: currentHour, count: 1 });
        } else {
            counter.count++;
        }
    }

    private static calculateATR(candles: any[], period: number = 14): number {
        if (candles.length < period + 1) return 0;
        const trues: number[] = [];
        for (let i = candles.length - period; i < candles.length; i++) {
            const c = candles[i];
            const prev = candles[i - 1];
            const tr = Math.max(
                c.high - c.low,
                Math.abs(c.high - prev.close),
                Math.abs(c.low - prev.close)
            );
            trues.push(tr);
        }
        return trues.reduce((a, b) => a + b, 0) / trues.length;
    }

    private static async checkRecentLosses() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`, { timeout: 5000 });
            if (!Array.isArray(resp.data)) return;
            const nowMs = Date.now();
            const cooldownMs = this.settings.cooldownMinutesAfterLoss * 60 * 1000;
            for (const trade of resp.data) {
                if (!trade.symbol || trade.profit === undefined) continue;
                if ((trade.magic !== this.settings.magic && !(trade.comment || '').includes('Omni'))) continue;
                if (trade.profit < 0) {
                    const tradeCloseTime = (trade.time_close || trade.time) * 1000;
                    if (nowMs - tradeCloseTime < 60000) {
                        const expiry = nowMs + cooldownMs;
                        if (!this.cooldowns.has(trade.symbol) || this.cooldowns.get(trade.symbol)! < expiry) {
                            this.cooldowns.set(trade.symbol, expiry);
                            this.addLog(`[${trade.symbol}] Perda detectada. Cooldown de ${this.settings.cooldownMinutesAfterLoss}min ativado.`, 'WARN');
                        }
                    }
                }
            }
        } catch { /* fail silencioso */ }
    }

    private static isDistanceOk(symbol: string, currentPrice: number): boolean {
        const last = this.lastEntryPrices.get(symbol);
        if (!last) return true;
        const diff = Math.abs(currentPrice - last.price);
        const isForex = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'].some(p => symbol.startsWith(p));
        const pipMultiplier = isForex ? 10000 : 100;
        const distPips = diff * pipMultiplier;
        return distPips >= this.settings.minPipsFromLastEntry;
    }

    private static async executeTrade(symbol: string, action: 'BUY' | 'SELL', lot: number, level: number = 0): Promise<number | null> {
        try {
            return await MarketService.retryWhenOpen(symbol, async () => {
                const tickRes = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [symbol] }, { timeout: 5000 });
                const tick = tickRes.data?.[symbol];
                const price = action === 'BUY' ? tick?.ask || 0 : tick?.bid || 0;
                const isForex = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'].some(p => symbol.startsWith(p));
                const slPct = isForex ? 0.005 : 0.01;
                const tpPct = slPct * 2;
                const sl = action === 'BUY' ? price * (1 - slPct) : price * (1 + slPct);
                const tp = action === 'BUY' ? price * (1 + tpPct) : price * (1 - tpPct);

                const response = await axios.post(`${this.BRIDGE_URL}/order`, {
                    symbol,
                    action,
                    lot,
                    sl: Math.round(sl * 100) / 100,
                    tp: Math.round(tp * 100) / 100,
                    magic: this.settings.magic,
                    comment: `Omni ${this.settings.strategy} G${level}`.substring(0, 31)
                });
                const ticket = response.data?.ticket || response.data?.deal || null;
                if (ticket) {
                    SymbolLockService.acquire(symbol, 'Omni', ticket, action);
                    this.addLog(`Ordem EXECUTADA #${ticket} ${symbol} ${action} ${lot}`, 'SUCCESS');
                } else {
                    this.addLog(`Ordem enviada mas sem ticket retornado (${symbol} ${action})`, 'WARN');
                }
                return ticket;
            });
        } catch (e: any) {
            this.addLog(`Falha na execução em ${symbol}: ${e.message}`, 'ERROR');
            return null;
        }
    }

    private static async manageTrailingStops() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 });
            const positions: any[] = resp.data || [];
            for (const pos of positions) {
                if (!pos.ticket || !pos.price_open || !pos.symbol) continue;
                if (pos.comment && !pos.comment.includes('Omni') && pos.magic !== this.settings.magic) continue;
                const isBuy = pos.type === 0;
                const entry = pos.price_open;
                const current = pos.price_current;
                const profitPct = isBuy ? (current - entry) / entry : (entry - current) / entry;

                // Breakeven em 1.5% com trailing após BE
                if (this.settings.useBreakeven && profitPct >= this.settings.breakevenThreshold) {
                    const bePrice = isBuy ? entry + 0.0001 : entry - 0.0001;
                    if ((isBuy && (pos.sl || 0) < entry) || (!isBuy && (pos.sl || 0) > entry)) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, sl: bePrice,
                        }, { timeout: 3000 });
                        this.addLog(`🔒 Omni: Breakeven #${pos.ticket} (${(profitPct * 100).toFixed(1)}%)`, 'INFO');
                    } else {
                        // Após BE ativado, pequeno trailing de proteção
                        const trailAfterBe = isBuy ? current * 0.995 : current * 1.005;
                        if ((isBuy && trailAfterBe > (pos.sl || 0)) || (!isBuy && trailAfterBe < (pos.sl || 999))) {
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket, sl: trailAfterBe,
                            }, { timeout: 3000 });
                            this.addLog(`📐 Omni: BE Trailing #${pos.ticket} -> ${trailAfterBe.toFixed(5)}`, 'INFO');
                        }
                    }
                }

                // Multi-level trailing
                if (this.settings.useTrailing) {
                    let trailDistance = 0;
                    if (profitPct >= this.settings.trailingLevel3Pct) {
                        trailDistance = this.settings.trailingLevel3Trail;
                    } else if (profitPct >= this.settings.trailingLevel2Pct) {
                        trailDistance = this.settings.trailingLevel2Trail;
                    } else if (profitPct >= this.settings.trailingLevel1Pct) {
                        trailDistance = this.settings.trailingLevel1Trail;
                    }

                    if (trailDistance > 0) {
                        const trailSl = isBuy ? current * (1 - trailDistance) : current * (1 + trailDistance);
                        if ((isBuy && trailSl > (pos.sl || 0)) || (!isBuy && trailSl < (pos.sl || 999))) {
                            await axios.post(`${this.BRIDGE_URL}/update_order`, {
                                ticket: pos.ticket, sl: trailSl,
                            }, { timeout: 3000 });
                            this.addLog(`📐 Omni: Trail L${trailDistance === this.settings.trailingLevel1Trail ? 1 : trailDistance === this.settings.trailingLevel2Trail ? 2 : 3} #${pos.ticket} -> ${trailSl.toFixed(5)}`, 'INFO');
                        }
                    }
                }

                // Lock profit: se profit >= lockProfitPct, ajusta SL para travar lockProfitLockPct (respeita useTrailing)
                if (this.settings.useTrailing && profitPct >= this.settings.lockProfitPct) {
                    const lockSl = isBuy ? entry * (1 + this.settings.lockProfitLockPct) : entry * (1 - this.settings.lockProfitLockPct);
                    if ((isBuy && lockSl > (pos.sl || 0)) || (!isBuy && lockSl < (pos.sl || 999))) {
                        await axios.post(`${this.BRIDGE_URL}/update_order`, {
                            ticket: pos.ticket, sl: lockSl,
                        }, { timeout: 3000 });
                        this.addLog(`🔐 Omni: Lock Profit #${pos.ticket} -> ${lockSl.toFixed(5)}`, 'INFO');
                    }
                }

                // Verificar se trade foi fechado como perda → ativar cooldown
                if (pos.comment && pos.comment.includes('Omni') && pos.profit !== undefined && pos.profit < 0) {
                    // Só seta cooldown se o trade já foi fechado (position não está mais aberta)
                    // Isso é tratado quando olhamos o histórico, não via positions abertas
                }
            }
        } catch (e) { /* trailing fail */ }
    }

    static async getRecentTrades() {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`);
            if (!Array.isArray(resp.data)) return [];
            
            // Filtro: magic 999111 (novo) ou qualquer trade com "Omni" no comentário
            // Se o bridge não retorna campo magic, usa fallback por comment
            const hasMagicField = resp.data.length > 0 && resp.data[0].magic !== undefined;
            const filtered = hasMagicField
                ? resp.data.filter((t: any) =>
                    t.magic === this.settings.magic ||
                    (t.comment || '').toUpperCase().includes('OMNI')
                  )
                : resp.data.filter((t: any) =>
                    (t.comment || '').toUpperCase().includes('OMNI')
                  );
            
            return filtered.sort((a: any, b: any) => b.time - a.time);
        } catch (e) {
            return [];
        }
    }

    static async calculateStrategyRanking(history?: any[]) {
        const fullHistory = history || await this.getRecentTrades();
        const strategies: Record<string, { trades: number, wins: number, profit: number, grossProfit: number, grossLoss: number }> = {};
        
        // Inicializar todas as estratégias conhecidas
        const knownStrats: ProbabilisticStrategy[] = ['MHI1', 'MHI2', 'MHI3', 'TWIN_TOWERS', 'CYCLE_OF_3'];
        knownStrats.forEach(s => strategies[s] = { trades: 0, wins: 0, profit: 0, grossProfit: 0, grossLoss: 0 });

        fullHistory.forEach((t: any) => {
            let stratName: ProbabilisticStrategy | undefined;
            const comment = (t.comment || '').toUpperCase().replace(/[\s_]/g, '');
            
            // 1. Tentar Match por Comentário Expresso (Novo Padrão)
            stratName = knownStrats.find(s => {
                const normalizedStrat = s.toUpperCase().replace(/[\s_]/g, '');
                return comment.includes(normalizedStrat);
            });

            // 2. Deep Match: Tentar Match por Horário (Padrão de Ciclo Legado no Magic 7777)
            if (!stratName && t.magic === 7777) {
                const date = new Date(t.time * 1000);
                const min = date.getMinutes();
                const mod5 = min % 5;
                
                if (mod5 === 0) stratName = 'MHI1';
                else if (mod5 === 1) stratName = 'MHI2';
                else if (mod5 === 2) stratName = 'MHI3';
            }
            
            if (stratName) {
                strategies[stratName].trades++;
                strategies[stratName].profit += t.profit;
                if (t.profit > 0) {
                    strategies[stratName].wins++;
                    strategies[stratName].grossProfit += t.profit;
                } else {
                    strategies[stratName].grossLoss += Math.abs(t.profit);
                }
            }
        });

        return Object.entries(strategies).map(([name, stats]) => {
            const pf = stats.grossLoss === 0 ? (stats.grossProfit > 0 ? 9.99 : 0) : Number((stats.grossProfit / stats.grossLoss).toFixed(2));
            return {
                name,
                trades: stats.trades,
                winRate: stats.trades > 0 ? Number(((stats.wins / stats.trades) * 100).toFixed(1)) : 0,
                profit: Number(stats.profit.toFixed(2)),
                profitFactor: pf,
                status: stats.trades === 0 ? 'Emerging' : (stats.wins / stats.trades >= 0.8 ? 'High' : 'Solid')
            };
        }).sort((a, b) => b.winRate - a.winRate || b.profit - a.profit);
    }

    static async getScoreboard(history?: any[]) {
        const fullHistory = history || await this.getRecentTrades();
        const now = new Date();
        
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const calculate = (since: number) => {
            const stats = { 
                wins: 0, 
                gales: 0, 
                stops: 0, 
                directWins: 0, 
                g1Wins: 0, 
                g2Wins: 0,
                grossProfit: 0,
                grossLoss: 0,
                netProfit: 0
            };
            const filtered = fullHistory.filter(t => (t.time * 1000) >= since);
            
            filtered.forEach(t => {
                const comment = t.comment || '';
                if (t.profit > 0) {
                    stats.wins++;
                    stats.grossProfit += t.profit;
                    if (comment.includes('G0')) stats.directWins++;
                    else if (comment.includes('G1')) { stats.g1Wins++; stats.gales++; }
                    else if (comment.includes('G2')) { stats.g2Wins++; stats.gales++; }
                    else stats.directWins++;
                } else {
                    stats.stops++;
                    stats.grossLoss += Math.abs(t.profit);
                }
            });

            stats.netProfit = Number((stats.grossProfit - stats.grossLoss).toFixed(2));
            stats.grossProfit = Number(stats.grossProfit.toFixed(2));
            stats.grossLoss = Number(stats.grossLoss.toFixed(2));
            
            return stats;
        };

        return {
            daily: calculate(startOfDay),
            weekly: calculate(startOfWeek),
            monthly: calculate(startOfMonth)
        };
    }

    static async getStatus() {
        const history = await this.getRecentTrades();
        
        // Calcular Telemetria de Quadrante
        const now = new Date();
        const min = now.getMinutes();
        const quadrantVela = (min % 5) + 1;
        const secondsInVela = now.getSeconds();
        
        let actionMsg = 'Monitorando Quadrante...';
        if (quadrantVela === 5 && secondsInVela >= 50) actionMsg = 'Preparando Entrada...';
        else if (quadrantVela === 1 && secondsInVela < 10) actionMsg = 'Ciclo Iniciado';

        return {
            enabled: this.settings.enabled,
            settings: this.settings,
            processedCycles: this.processedQuadrants.size,
            logs: this.logs.slice(0, 30),
            history: history.slice(0, 10),
            ranking: await this.calculateStrategyRanking(history),
            scoreboard: await this.getScoreboard(history),
            telemetry: {
                currentVela: quadrantVela,
                secondsInVela,
                actionMsg,
                robotVersion: 'OMNI CORE v1.5 [NEURO]',
                activeStrategy: this.settings.strategy
            }
        };
    }
}
