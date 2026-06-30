import axios from 'axios';
import { AlertEngine } from './AlertEngine';
import { MarketService } from './MarketService';
import { DisciplineEngine } from './DisciplineEngine';
import { AlphaAuditService } from './AlphaAuditService';
import { SymbolLockService } from './SymbolLockService';
import fs from 'fs';
import path from 'path';

// ============================================================
// 🥇 GOLD SCALPER ENGINE — Robô Exclusivo para XAUUSD
// Grid Inteligente + Trailing Stop + Breakeven + TP/SL Dinâmico
// ============================================================

export interface GoldScalperSettings {
    enabled: boolean;
    lotSize: number;
    gridLevels: number;
    gridDistance: number;
    gridMultiplier: number;
    trailingStart: number;
    trailingStop: number;
    trailingStep: number;
    breakEvenTrigger: number;
    breakEvenOffset: number;
    takeProfitUSD: number;
    stopLossUSD: number;
    useFixedTP: boolean;
    useFixedSL: boolean;
    basketTP: number;
    basketSL: number;
    basketTPEnabled: boolean;
    basketSLEnabled: boolean;
    maxDailyLoss: number;
    maxDailyProfit: number;
    sessionFilter: boolean;
    direction: 'BOTH' | 'BUY' | 'SELL';
    cooldownSeconds: number;
    maxSpreadPoints: number;
    newsGuardEnabled: boolean;
    strategyMode: 'CONSERVATIVE' | 'NORMAL' | 'AGGRESSIVE';
    swingTrendFilter: boolean;
    strictMA200Filter: boolean;
    dynamicATRMode: boolean;
    dynamicStopLoss: boolean;
    dynamicSLMultiplier: number;
    antiMartingale: boolean;
    orderBlockFilter: boolean;
    smartTargeting: boolean;
    smartTrailing: boolean;
    atrTrailingPeriod: number;
    atrTrailingMultiplier: number;
    atrTrailingTimeframe: 'M15' | 'H1';
    smartGridIA: boolean;
    smartBreakeven: boolean;
    dxyFilter: boolean;
    sentimentFilter: boolean;
    rsiFilter: boolean;
    volumeFilter: boolean;
    trendFiltroM5: boolean;
    trendFiltroM1: boolean;
    useRiskPercentage: boolean;
    riskPercentage: number;
    smartNeuroIA: boolean;
    neuroConvergence: boolean;
    smartAdaptiveIA: boolean;
    sniperMode: boolean;
    strategy: 'USD' | 'SMC';
    useFixedLot: boolean;
    useGrid: boolean;
    smcOnly: boolean;
    useTrendFallback: boolean;
    minSLPoints: number;
    trailingStopGrid: boolean;
    timeExitMinutes: number;
    ma200CrossExit: boolean;
    tp1Enabled: boolean;
    tp1PartialPercent: number;
    tp1Multiplier: number;
    moveSLToBEAfterTP1: boolean;
    tp2Enabled: boolean;
    tp2PartialPercent: number;
    tp2Multiplier: number;
}

interface GoldPosition {
    ticket: number;
    symbol: string;
    type: number; // 0 = BUY, 1 = SELL
    volume: number;
    price_open: number;
    sl: number;
    tp: number;
    price_current: number;
    profit: number;
    point: number;
    digits: number;
    magic?: number;
    comment?: string;
}

export interface TradeRecord {
    id: string;
    ticket: number;
    positionId?: number;
    symbol?: string;
    type: 'BUY' | 'SELL';
    lot: number;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    result: 'WIN' | 'LOSS' | 'TIE';
    gridLevel: number;
    closeReason: 'TP' | 'SL' | 'BASKET_TP' | 'BASKET_SL' | 'MANUAL' | 'TRAILING';
    openTime: string;
    closeTime: string;
    duration: string;
    magic?: number;
    comment?: string;
}

export class GoldScalperEngine {
    private static isRunning = false;
    private static isProcessingCycle = false;
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static MAGIC = 9999;
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'gold_scalper_settings.json');
    private static readonly LEARN_PATH = path.resolve(process.cwd(), 'ia_learning_state.json');
    private static HISTORY_PATH = path.resolve(process.cwd(), 'gold_scalper_history.json');
    private static intervalIds: NodeJS.Timeout[] = [];
    private static isSyncingTrades = false;

    private static learningState = {
        minScoreThreshold: 60,
        weights: { tripleAlign: 40, dxy: 20, vsa: 20, rsi: 10, gap: 5, sentiment: 5 },
        lastOptimized: 0,
        totalTradesAnalyzed: 0
    };

    private static GOLD_SYMBOLS = ['GOLD', 'XAUUSD', 'XAUUSD.v', 'GOLD.v'];
    private static resolvedSymbol = '';
    private static DXY_SYMBOLS = ['DXY', 'USDX', 'DOLLAR', '$INDEX', 'DX'];
    private static dxySymbol = '';
    private static currentDXYTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    private static sentimentLong = 50;
    private static sentimentShort = 50;
    private static lastSentimentSync = 0;
    private static lastBasketSMCFetch = 0;
    private static currentRSI = 50;
    private static relativeVolume = 1.0;
    private static dailyProfit = 0;
    private static dailyLoss = 0;
    private static lastTradeTime = 0;
    private static lastSyncTime = 0;
    private static operationLog: Array<{ time: string; action: string; details: string }> = [];
    private static currentSpread = 0;
    private static prevBid = 0;
    private static lastLossTime = 0;
    private static trendBuffer: number[] = [];
    private static tradeHistory: TradeRecord[] = [];
    private static totalWins = 0;
    private static totalLosses = 0;
    private static totalProfitAllTime = 0;
    private static currentSwingTrend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    private static currentH1Trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    private static currentMA200 = 0;
    private static currentMA200_M5 = 0;
    private static currentMA200_M15 = 0;
    private static currentMA14 = 0;
    private static currentMA21 = 0;
    private static currentMA50 = 0;
    private static currentMA100 = 0;
    private static ma200Ready = false;
    private static currentPrice = 0;
    private static currentSMCTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    private static currentATR = 0;
    private static volatilityMultiplier = 1.0;
    private static currentM1Trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    private static currentM1SniperTrigger: 'BUY' | 'SELL' | null = null;
    private static currentM5Trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    private static sniperTriggerSource: 'M1' | 'M5' | null = null;
    private static m5TrendStrength = 0;
    private static m5PriceGap = 0;
    private static m5RelativeVolume = 1.0;
    private static currentWinStreak = 0;
    private static currentLotMultiplier = 1.0;
    private static supplyZone: { top: number, bottom: number } | null = null;
    private static demandZone: { top: number, bottom: number } | null = null;
    private static upcomingNewsEvents: Date[] = [];
    private static lastNewsFetchTime = 0;
    private static positionWatermarks: Record<number, number> = {};
    private static basketWatermark = 0;
    private static globalDailyProfit = 0;
    private static globalDailyLoss = 0;
    private static floatingProfit = 0;
    private static chandelierHighestHigh = 0;
    private static chandelierLowestLow = 0;
    private static openPositionsCount = 0;
    private static isKillZone = false;
    private static lastIAGuardLogTime = 0;
    private static smcPositionData: Map<number, { tp1: number, tp2: number, partialHit: boolean, tp2Hit: boolean, entry: number, spready: number }> = new Map();

    private static settings: GoldScalperSettings = {
        enabled: false, lotSize: 0.01, gridLevels: 1, gridDistance: 4.0, gridMultiplier: 1.5,
        trailingStart: 0.0, trailingStop: 1.5, trailingStep: 0.5, breakEvenTrigger: 0.0, breakEvenOffset: 0.05,
        takeProfitUSD: 10.0, stopLossUSD: 3.0, useFixedTP: false, useFixedSL: false, basketTP: 20.0, basketSL: -15.0, basketTPEnabled: true, basketSLEnabled: true,
        maxDailyLoss: 100.0, maxDailyProfit: 150.0, sessionFilter: false,
        direction: 'BOTH', cooldownSeconds: 30, maxSpreadPoints: 50, newsGuardEnabled: true,
        strategyMode: 'NORMAL', swingTrendFilter: false, strictMA200Filter: false, dynamicATRMode: false,
        dynamicStopLoss: true, dynamicSLMultiplier: 2.0,
        antiMartingale: false, orderBlockFilter: false, smartTargeting: false,
        smartTrailing: true, atrTrailingPeriod: 14, atrTrailingMultiplier: 2.0, atrTrailingTimeframe: 'M15', smartGridIA: false, smartBreakeven: false, dxyFilter: true,
        sentimentFilter: false, rsiFilter: false, volumeFilter: false, trendFiltroM5: true,
        trendFiltroM1: true, useRiskPercentage: false, riskPercentage: 1.0,
        smartNeuroIA: true, neuroConvergence: true, smartAdaptiveIA: true, sniperMode: true, strategy: 'USD',
        smcOnly: false, useTrendFallback: true, minSLPoints: 10, useFixedLot: true, useGrid: true,
        trailingStopGrid: false, timeExitMinutes: 60, ma200CrossExit: false,
        tp1Enabled: true, tp1PartialPercent: 50, tp1Multiplier: 1.5, moveSLToBEAfterTP1: true,
        tp2Enabled: true, tp2PartialPercent: 100, tp2Multiplier: 2.5
    };

    public static async executeManualTrade(direction: 'BUY' | 'SELL'): Promise<{ success: boolean; message: string }> {
        if (!this.settings.enabled) return { success: false, message: 'Robô desativado.' };
        try {
            await this.resolveGoldSymbol();
            if (!this.resolvedSymbol) return { success: false, message: 'Símbolo não encontrado.' };
            const tr = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.resolvedSymbol] });
            const tick = tr.data[this.resolvedSymbol];
            if (!tick || !tick.is_open) return { success: false, message: 'Mercado fechado.' };
            const result = await this.openPosition(direction, tick, 1, true);
            return result ? { success: true, message: 'Ordem enviada.' } : { success: false, message: 'Falha na ordem.' };
        } catch (e: any) { return { success: false, message: e.message }; }
    }

    static stop() {
        this.isRunning = false;
        for (const id of this.intervalIds) clearInterval(id);
        this.intervalIds = [];
        this.log('INFO', 'Gold Scalper Engine parado.');
    }

    static async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loadSettings();
        this.loadTradeHistory();
        this.loadLearningState();
        this.log('INIT', 'Gold Scalper Engine v3.2 inicializando...');
        await this.resolveGoldSymbol();
        this.log('INIT', `Símbolo resolvido: ${this.resolvedSymbol || 'AGUARDANDO'}`);
        this.log('INIT', `Modo: ${this.settings.strategyMode} | Lote: ${this.settings.lotSize} | Grid: ${this.settings.gridLevels} níveis`);
        this.log('INIT', `IA Neuro: ${this.settings.smartNeuroIA ? 'ATIVA' : 'OFF'} | SMC Only: ${this.settings.smcOnly ? 'SIM' : 'NÃO'}`);
        console.log('🚀 Gold Scalper Engine: Iniciando...');
        this.fetchMacroIndicators();
        this.log('INFO', 'Macro indicadores carregados. Iniciando ciclo principal...');
        this.intervalIds.push(setInterval(() => { try { this.mainCycle(); } catch (e) { console.error('[GoldScalper] mainCycle error:', e); } }, 3000));
        this.intervalIds.push(setInterval(() => { try { this.fetchMacroIndicators(); } catch (e) { console.error('[GoldScalper] fetchMacroIndicators error:', e); } }, 60000));
        this.intervalIds.push(setInterval(async () => {
            if (this.settings.enabled) {
                try {
                    const status = await DisciplineEngine.getDailyStatus();
                    this.globalDailyProfit = status.profit > 0 ? status.profit : 0;
                    this.globalDailyLoss = status.profit < 0 ? Math.abs(status.profit) : 0;

                    if (this.globalDailyLoss >= this.settings.maxDailyLoss) {
                        this.isKillZone = true;
                    } else {
                        this.isKillZone = false;
                    }
                } catch (e) {
                    console.warn('[GoldScalper] discipline sync error', e);
                }
            }
        }, 10000));
    }

    private static saveSettings() { try { fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2)); } catch (e) { console.error('[GoldScalper] saveSettings error:', e); } }

    static updateSettings(s: Partial<GoldScalperSettings>) {
        this.settings = { ...this.settings, ...s };
        this.saveSettings();
    }

    static async resetDailyCounters() {
        this.settings.enabled = true;
        this.dailyProfit = 0;
        this.dailyLoss = 0;
        this.isKillZone = false;
        this.lastLossTime = 0;
        this.saveSettings();
        return true;
    }

    static manualUnlock() { this.lastLossTime = 0; }
    static manualLock() { this.lastLossTime = Date.now(); }

    public static getActiveRiskParams() {
        return {
            enabled: this.settings.enabled,
            slUSD: this.settings.stopLossUSD,
            tpUSD: this.settings.takeProfitUSD,
            symbol: this.resolvedSymbol || 'XAUUSD'
        };
    }

    private static async resolveGoldSymbol() {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/symbols`);
            const s = r.data as string[];
            for (const gs of this.GOLD_SYMBOLS) if (s.includes(gs)) return this.resolvedSymbol = gs;
            const f = s.find(x => x.toUpperCase().includes('GOLD') || x.toUpperCase().includes('XAU'));
            if (f) return this.resolvedSymbol = f;
        } catch (e) { console.warn('[GoldScalper] resolveGoldSymbol error:', e); }
        return '';
    }

    private static async fetchMacroIndicators() {
        if (!this.resolvedSymbol) { console.warn('[GoldScalper] fetchMacroIndicators: resolvedSymbol not set'); return; }
        console.log('[GoldScalper] fetchMacroIndicators: fetching candles for', this.resolvedSymbol);
        try {
            const [h1r, m15r, m5r, tickR] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol: this.resolvedSymbol, count: 200, timeframe: 'H1' }, timeout: 8000 }),
                axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol: this.resolvedSymbol, count: 200, timeframe: 'M15' }, timeout: 8000 }),
                axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol: this.resolvedSymbol, count: 200, timeframe: 'M5' }, timeout: 8000 }),
                axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.resolvedSymbol] }, { timeout: 15000 })
            ]);
            const cH1 = h1r.data; if (!cH1 || cH1.length < 50) return;
            const cM15 = m15r.data; if (!cM15 || cM15.length < 50) return;
            const cM5 = m5r.data; if (!cM5 || cM5.length < 50) return;

            this.currentPrice = tickR.data?.[this.resolvedSymbol]?.bid || tickR.data?.[this.resolvedSymbol]?.ask || 0;

            const sma = (arr: any[], p: number) => arr.slice(-p).reduce((a: any, b: any) => a + b, 0) / p;
            const clH1 = cH1.map((x: any) => x.close);
            const clM15 = cM15.map((x: any) => x.close);
            const clM5 = cM5.map((x: any) => x.close);

            // MA200 para cada timeframe
            this.currentMA200 = sma(clH1, 200);
            this.currentMA200_M15 = sma(clM15, 200);
            this.currentMA200_M5 = sma(clM5, 200);
            if (cH1.length >= 200 && cM15.length >= 200 && cM5.length >= 200) this.ma200Ready = true;

            // MAs adicionais (H1)
            this.currentMA14 = sma(clH1, 14);
            this.currentMA21 = sma(clH1, 21);
            this.currentMA50 = sma(clH1, 50);
            this.currentMA100 = sma(clH1, 100);

            // Tendências swing
            const cp = clH1[clH1.length - 1];
            const s50 = sma(clH1, 50), s100 = sma(clH1, 100);
            this.currentSwingTrend = cp > s50 ? 'UP' : cp < s50 ? 'DOWN' : 'FLAT';
            this.currentH1Trend = cp > s100 ? 'UP' : cp < s100 ? 'DOWN' : 'FLAT';

            if (this.settings.dynamicATRMode) {
                const trs = cH1.slice(-14).map((x: any, i: number) => {
                    if (i === 0) return 0;
                    return Math.max(x.high - x.low, Math.abs(x.high - cH1[i - 1].close), Math.abs(x.low - cH1[i - 1].close));
                });
                this.currentATR = trs.reduce((a: any, b: any) => a + b, 0) / 14;
                this.volatilityMultiplier = Math.max(0.6, Math.min(2.5, this.currentATR / 0.85));
            }

            // Chandelier ATR para Smart Trailing
            if (this.settings.smartTrailing) {
                const atrPeriod = this.settings.atrTrailingPeriod || 14;
                const tf = this.settings.atrTrailingTimeframe || 'M15';
                try {
                    const ac = await axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol: this.resolvedSymbol, count: Math.max(atrPeriod + 5, 30), timeframe: tf } });
                    const d = ac.data;
                    if (d && d.length >= atrPeriod + 2) {
                        const trs2 = [];
                        for (let i = 1; i <= atrPeriod; i++) {
                            trs2.push(Math.max(d[i].high - d[i].low, Math.abs(d[i].high - d[i - 1].close), Math.abs(d[i].low - d[i - 1].close)));
                        }
                        this.currentATR = trs2.reduce((a: any, b: any) => a + b, 0) / atrPeriod;
                        this.chandelierHighestHigh = Math.max(...d.slice(-atrPeriod).map((x: any) => x.high));
                        this.chandelierLowestLow = Math.min(...d.slice(-atrPeriod).map((x: any) => x.low));
                    }
                } catch (e) { }
            }

            // M1/M5 trends (60 candles each)
            const [m1] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.resolvedSymbol}&timeframe=M1&count=60`, { timeout: 8000 })
            ]);
            if (m1.data?.length && clM5.length >= 21) {
                const c1 = m1.data;
                const sma21_1 = c1.slice(-21).reduce((a: any, b: any) => a + b.close, 0) / 21;
                const sma21_5 = clM5.slice(-21).reduce((a: any, b: any) => a + b, 0) / 21;
                this.currentM1Trend = c1[c1.length - 1].close > sma21_1 ? 'UP' : (c1[c1.length - 1].close < sma21_1 ? 'DOWN' : 'FLAT');
                this.currentM5Trend = clM5[clM5.length - 1] > sma21_5 ? 'UP' : (clM5[clM5.length - 1] < sma21_5 ? 'DOWN' : 'FLAT');
                
                // --- ATUALIZAÇÃO DE INDICADORES IA ---
                this.calculateRSI(c1);
                this.calculateRelativeVolume(cM5);

                if (this.settings.sniperMode) {
                    this.currentM1SniperTrigger = this.detectSniperTrigger(c1);
                    this.sniperTriggerSource = this.currentM1SniperTrigger ? 'M1' : null;
                }
            }

            // --- BUSCA TENDÊNCIA DXY ---
            if (this.settings.dxyFilter) {
                if (!this.dxySymbol) await this.resolveDXYSymbol();
                if (this.dxySymbol) {
                    const dr = await axios.get(`${this.BRIDGE_URL}/candles`, { params: { symbol: this.dxySymbol, count: 20, timeframe: 'M5' } });
                    if (dr.data?.length > 5) {
                        const dc = dr.data;
                        const d_sma = dc.reduce((a: any, b: any) => a + b.close, 0) / dc.length;
                        this.currentDXYTrend = dc[dc.length - 1].close > d_sma ? 'UP' : 'DOWN';
                    }
                }
            }

            // --- SMC LEVELS (estrutura de mercado) ---
            if (this.settings.strategy === 'SMC' || this.settings.smcOnly) {
                try {
                    const tick = tickR.data?.[this.resolvedSymbol];
                    const entry = tick?.bid || tick?.ask || this.currentPrice;
                    if (entry) {
                        const smcResp = await axios.get(`${this.BRIDGE_URL}/smc_levels`, {
                            params: { symbol: this.resolvedSymbol, direction: 'BUY', entry_price: entry },
                            timeout: 3000
                        });
                        if (smcResp.data) this.currentSMCData = smcResp.data;
                    }
                } catch (e) {
                    this.log('WARN', `SMC levels erro: ${(e as any).message || 'desconhecido'}`);
                }
            }
            console.log('[GoldScalper] fetchMacroIndicators OK: price=' + this.currentPrice + ' MA200=' + this.currentMA200 + ' RSI=' + this.currentRSI + ' ma200Ready=' + this.ma200Ready);
        } catch (e) {
            console.warn('GoldScalper: macro indicators error', e);
            this.log('WARN', `Macro indicadores erro: ${(e as any).message || 'desconhecido'}`);
        }
    }

    private static async mainCycle() {
        if (this.isProcessingCycle) return;
        this.isProcessingCycle = true;
        try {
            await this.recalculateDailyStats();
            if (!this.settings.enabled) {
                if (Date.now() - this.lastSyncTime > 120000) {
                    this.log('INFO', 'Robô DESATIVADO nas configurações. Aguardando ativação...');
                    this.lastSyncTime = Date.now();
                }
                return;
            }
            
            if (!this.resolvedSymbol) {
                await this.resolveGoldSymbol();
                if (!this.resolvedSymbol) {
                    this.log('WARN', 'Símbolo não encontrado. Verificando bridge...');
                    return;
                }
                this.log('INIT', `Símbolo resolvido: ${this.resolvedSymbol}`);
            }

            // Verifica saúde da conexão MT5 antes de operar
            try {
                const healthResp = await axios.get(`${this.BRIDGE_URL}/health`, { timeout: 3000 });
                if (!healthResp.data?.connected) {
                    if (Date.now() - this.lastSyncTime > 30000) {
                        this.log('WARN', 'Bridge MT5 offline. Aguardando reconexão...');
                        this.lastSyncTime = Date.now();
                    }
                    return;
                }
            } catch (e) {
                if (Date.now() - this.lastSyncTime > 30000) {
                    this.log('ERROR', 'Bridge MT5 não respondeu. Reconectando...');
                    this.lastSyncTime = Date.now();
                }
                return;
            }

            // --- TRAVAS DE LUCRO/PERDA DIÁRIA (NET) ---
            const netDailyProfit = this.dailyProfit - this.dailyLoss;
            if (netDailyProfit >= this.settings.maxDailyProfit) {
                if (Date.now() - this.lastSyncTime > 60000) this.log('SAFETY', 'Meta diária atingida. Robô pausado.');
                return;
            }
            if (this.dailyLoss >= this.settings.maxDailyLoss) {
                if (Date.now() - this.lastSyncTime > 60000) this.log('SAFETY', 'Limite de perda atingido. Robô bloqueado.');
                return;
            }
            
            const pr = await axios.get(`${this.BRIDGE_URL}/positions`);
            const pos = (pr.data || []).filter((p: any) =>
                this.GOLD_SYMBOLS.some(gs => p.symbol.toUpperCase().includes(gs.toUpperCase())) &&
                (p.magic === this.MAGIC)
            );
            const tr = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.resolvedSymbol] });
            const tick = tr.data[this.resolvedSymbol];
            if (!tick || !tick.bid) {
                this.log('ERROR', `Falha ao obter ticks do Bridge para ${this.resolvedSymbol}`);
                return;
            }

            // Atualiza trend buffer para micro-tendência tick-a-tick
            this.updateTrendBuffer(tick.bid);

            // --- ATUALIZA TENDÊNCIAS EM TEMPO REAL (RELÓGIO) ---
            await this.updateFastTrends();

            this.currentSpread = Math.round((tick.ask - tick.bid) / (tick.point || 0.01));
            const robotPositions = pos.filter((p: any) => p.magic === this.MAGIC) as GoldPosition[];
            const openTickets = new Set(robotPositions.map(p => p.ticket));
            for (const ticket of this.smcPositionData.keys()) {
                if (!openTickets.has(ticket)) this.smcPositionData.delete(ticket);
            }
            for (const p of pos) {
                if (p.magic === this.MAGIC) {
                    await this.processBreakEven(p, tick);
                    await this.processTrailingStop(p, tick);
                    await this.processSMCDefense(p, tick);
                    await this.processTP2(p, tick);
                }
            }
            if (!await this.processBasket(robotPositions)) await this.checkNewOpenings(tick, pos);

            // Heartbeat: log a status line every 30s so the terminal feed stays alive
            if (Date.now() - this.lastHeartbeatLogTime > 30000) {
                this.lastHeartbeatLogTime = Date.now();
                const trend = this.currentM1Trend || 'FLAT';
                const spread = this.currentSpread;
                const ia = this.calculateNeuroScore();
                const posCount = robotPositions.length;
                const floating = this.floatingProfit.toFixed(2);
                this.log('HEARTBEAT', `Spread: ${spread}pts | Trend M1: ${trend} | IA: ${ia}% | Posições: ${posCount} | P&L: $${floating}`);
            }
        } catch (e) {
            console.warn('GoldScalper: mainCycle error', e);
        } finally { this.isProcessingCycle = false; }
    }

    private static async checkNewOpenings(tick: any, pos: GoldPosition[]) {
        const robotPositions = pos.filter((p: GoldPosition) => p.magic === this.MAGIC);
        const maxLevels = this.settings.useGrid ? this.settings.gridLevels : 1;
        if (robotPositions.length >= maxLevels) return;
        
        // Cooldown básico de tempo
        if (Date.now() - this.lastTradeTime < this.settings.cooldownSeconds * 1000) return;

        // --- VALIDAÇÃO NEURO CORE IA v3.2 ---
        if (this.settings.smartNeuroIA) {
            const currentScore = this.calculateNeuroScore();
            if (currentScore < this.learningState.minScoreThreshold) {
                if (Date.now() - this.lastIAGuardLogTime > 300000) {
                     this.log('IA_GUARD', `Entrada bloqueada p/ IA: Score ${currentScore}% (Mínimo: ${this.learningState.minScoreThreshold}%)`);
                     this.lastIAGuardLogTime = Date.now();
                }
                return;
            }
        }

        // --- FILTRO DE SESSÃO (LIQUIDEZ) ---
        if (this.settings.sessionFilter && !this.isHighLiquiditySession()) return;

        let dir: 'BUY' | 'SELL' | null = null;
        
        if (robotPositions.length === 0) {
            // --- MODO SMC-ONLY: entrada exclusiva por SMC ---
            if (this.settings.smcOnly) {
                const smcDir = await this.getSMCMarketDirection();
                if (!smcDir) {
                    return;
                }
                dir = smcDir;
            } else {
                // Gatilho para a PRIMEIRA posição (Nível 1) — modo padrão
                if (this.settings.sniperMode && this.currentM1SniperTrigger) {
                    dir = this.currentM1SniperTrigger;
                } else if (this.getMicroTrend() !== 'FLAT') {
                    dir = this.getMicroTrend() === 'UP' ? 'BUY' : 'SELL';
                } else if (this.settings.useTrendFallback && this.currentM1Trend !== 'FLAT') {
                    dir = this.currentM1Trend === 'UP' ? 'BUY' : 'SELL';
                }
            }
        } else {
            // Lógica de GRID para níveis subsequentes (Nível 2, 3...)
            // Só abre se o preço estiver contra a posição anterior por pelo menos gridDistance
            const lastPos = robotPositions[robotPositions.length - 1];
            const currentPrice = lastPos.type === 0 ? tick.bid : tick.ask; 
            const distance = Math.abs(currentPrice - lastPos.price_open);
            
            if (distance >= this.settings.gridDistance) {
                // Se o preço foi CONTRA a posição (prejuízo flutuante), abre o próximo nível do grid
                if ((lastPos.type === 0 && currentPrice < lastPos.price_open) || (lastPos.type === 1 && currentPrice > lastPos.price_open)) {
                    dir = lastPos.type === 0 ? 'BUY' : 'SELL';
                }
            }
        }

        if (dir && (this.settings.direction === 'BOTH' || this.settings.direction === dir)) {
            // --- FILTRO SMC-ONLY PARA GRID ---
            if (this.settings.smcOnly && robotPositions.length > 0) {
                if (this.currentSMCTrend !== 'NEUTRAL') {
                    const smcDir = this.currentSMCTrend === 'BULLISH' ? 'BUY' : 'SELL';
                    if (dir !== smcDir) {
                        return;
                    }
                }
            }

            // --- FILTRO DE TENDÊNCIA MACRO (MA200) ---
            if (this.settings.swingTrendFilter) {
                if (!this.ma200Ready) {
                    return;
                }
                const cp = dir === 'BUY' ? tick.ask : tick.bid;
                if (this.settings.strictMA200Filter) {
                    if (cp < this.currentMA200) {
                        return;
                    }
                } else {
                    if (dir === 'BUY' && cp < this.currentMA200) {
                        return;
                    }
                    if (dir === 'SELL' && cp > this.currentMA200) {
                        return;
                    }
                }
            }

            // --- NEURO FORECAST TREND FILTER ---
            if (robotPositions.length === 0) {
                if (this.settings.trendFiltroM1) {
                    const neuroM1 = this.predictNextCandle('M1');
                    const neuroDir1 = neuroM1.direction === 'UP' ? 'BUY' : (neuroM1.direction === 'DOWN' ? 'SELL' : 'FLAT');
                    if (dir !== neuroDir1) {
                        return;
                    }
                }
                if (this.settings.trendFiltroM5) {
                    const neuroM5 = this.predictNextCandle('M5');
                    const neuroDir5 = neuroM5.direction === 'UP' ? 'BUY' : (neuroM5.direction === 'DOWN' ? 'SELL' : 'FLAT');
                    if (dir !== neuroDir5) {
                        return;
                    }
                }
            }

            console.log(`🎯 Gold Scalper: Tentando abrir ${dir} nível ${robotPositions.length + 1}`);
            await this.openPosition(dir, tick, robotPositions.length + 1);
        } else if (robotPositions.length === 0) {
            // Log silencioso de monitoramento
            if (Math.random() < 0.05) console.log('⏳ Gold Scalper: Aguardando sinal de micro-tendência...');
        }
    }
    
    private static currentSMCData: any = null;
    private static smcTrendLastRefresh = 0;

    private static async refreshSMCTrend(tick: any) {
        if (Date.now() - this.smcTrendLastRefresh < 30000) return;
        this.smcTrendLastRefresh = Date.now();
        try {
            const entry = tick.bid || tick.ask;
            const resp = await axios.get(`${this.BRIDGE_URL}/smc_levels`, {
                params: { symbol: this.resolvedSymbol, direction: 'BUY', entry_price: entry },
                timeout: 3000
            });
            if (resp.data?.market_trend) {
                this.currentSMCTrend = resp.data.market_trend === 'BULLISH' ? 'BULLISH' :
                    resp.data.market_trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
            }
        } catch (e) {}
    }

    private static async getSMCMarketDirection(): Promise<'BUY' | 'SELL' | null> {
        if (!this.resolvedSymbol) return null;
        try {
            const tr = await axios.post(`${this.BRIDGE_URL}/ticks`, { symbols: [this.resolvedSymbol], timeout: 3000 });
            const tick = tr.data?.[this.resolvedSymbol];
            if (!tick) return null;
            const entry = tick.bid;
            const resp = await axios.get(`${this.BRIDGE_URL}/smc_levels`, {
                params: { symbol: this.resolvedSymbol, direction: 'BUY', entry_price: entry },
                timeout: 5000
            });
            if (!resp.data) return null;
            this.currentSMCTrend = resp.data.market_trend === 'BULLISH' ? 'BULLISH' :
                resp.data.market_trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
            if (this.currentSMCTrend === 'NEUTRAL') return null;
            const dir = this.currentSMCTrend === 'BULLISH' ? 'BUY' : 'SELL';
            console.log(`[SMC Only] Trend: ${this.currentSMCTrend} -> ${dir} | TP1: ${resp.data.tp1} SL: ${resp.data.sl}`);
            return dir;
        } catch (e) {
            return null;
        }
    }

    private static async updateFastTrends() {
        if (!this.resolvedSymbol) return;
        try {
            const [m1, m5] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.resolvedSymbol}&timeframe=M1&count=30`, { timeout: 5000 }).catch(() => ({ data: [] })),
                axios.get(`${this.BRIDGE_URL}/candles?symbol=${this.resolvedSymbol}&timeframe=M5&count=30`, { timeout: 5000 }).catch(() => ({ data: [] }))
            ]);

            if (m1.data?.length > 10 && m5.data?.length > 10) {
                const c1 = m1.data, c5 = m5.data;
                const sma21_1 = c1.reduce((a: any, b: any) => a + b.close, 0) / c1.length;
                const sma21_5 = c5.reduce((a: any, b: any) => a + b.close, 0) / c5.length;
                
                this.currentM1Trend = c1[c1.length - 1].close > sma21_1 ? 'UP' : (c1[c1.length - 1].close < sma21_1 ? 'DOWN' : 'FLAT');
                this.currentM5Trend = c5[c5.length - 1].close > sma21_5 ? 'UP' : (c5[c5.length - 1].close < sma21_5 ? 'DOWN' : 'FLAT');

                // Cálculo de Força Baseado em Inclinação (Relógio)
                const p1 = c1[c1.length - 1].close;
                const p5 = c5[c5.length - 1].close;
                
                // M5 Strength: 50 base + bônus de inclinação
                const slope5 = Math.abs((p5 - sma21_5) / (p5 * 0.0005)) * 100;
                this.m5TrendStrength = Math.min(100, Math.max(10, 50 + slope5));
                
                // M1 Sniper
                if (this.settings.sniperMode) {
                    this.currentM1SniperTrigger = this.detectSniperTrigger(c1);
                    this.sniperTriggerSource = this.currentM1SniperTrigger ? 'M1' : null;
                }
            }
        } catch (e) { }
    }

    private static detectSniperTrigger(candles: any[]): 'BUY' | 'SELL' | null {
        if (candles.length < 3) return null;
        const last = candles[candles.length - 2];
        const prev = candles[candles.length - 3];
        if (!last || !prev) return null;
        const body = Math.abs(last.close - last.open);
        const range = last.high - last.low;
        if (range === 0) return null;
        const bodyRatio = body / range;
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        if (bodyRatio <= 0.35 && lowerWick / range >= 0.65) return 'BUY';
        if (bodyRatio <= 0.35 && upperWick / range >= 0.65) return 'SELL';
        const prevBody = Math.abs(prev.close - prev.open);
        if (prev.close < prev.open && last.close > last.open && body > prevBody * 1.2) return 'BUY';
        if (prev.close > prev.open && last.close < last.open && body > prevBody * 1.2) return 'SELL';
        return null;
    }

    private static predictNextCandle(tf: 'M1' | 'M5' | 'M15' | 'H1') {
        let trend = tf === 'M1' ? this.currentM1Trend : tf === 'M5' ? this.currentM5Trend : tf === 'M15' ? this.currentSwingTrend : this.currentH1Trend;
        if (trend === 'FLAT') trend = this.currentM5Trend;
        const rsi = this.currentRSI;
        const vol = this.relativeVolume;
        
        let dir: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
        let conf = 50;

        if (trend === 'UP') {
            dir = 'UP';
            conf = 60 + (vol > 1.2 ? 15 : 0);
            if (rsi > 75) { dir = 'DOWN'; conf = 70; }
        } else if (trend === 'DOWN') {
            dir = 'DOWN';
            conf = 60 + (vol > 1.2 ? 15 : 0);
            if (rsi < 25) { dir = 'UP'; conf = 70; }
        }

        return { direction: dir, confidence: Math.min(95, conf) };
    }

    private static async openPosition(dir: 'BUY' | 'SELL', tick: any, level: number, manual = false) {
        if (!this.resolvedSymbol) return false;

        // Spread filter: skip if spread > 30% of ATR
        if (this.currentATR > 0 && this.currentSpread > this.currentATR * 0.3) {
            this.log('SKIP', `Spread ${this.currentSpread} > 30% ATR (${(this.currentATR * 0.3).toFixed(1)})`);
            return false;
        }

        // SAFETY LOCK: verificar DisciplineEngine antes de abrir posição
        try {
            const discipline = await DisciplineEngine.getDailyStatus();
            if (discipline.isLocked) {
                this.log('DISCIPLINA', `⛔ Safety Lock bloqueou posição: ${discipline.reason}`);
                return false;
            }
        } catch (e) { /* discipline fail */ }

        const entry = dir === 'BUY' ? tick.ask : tick.bid;
        
        let sl: number | undefined, tp: number | undefined;
        let smcData: any = null;
        let lot = this.settings.lotSize;

        // Smart Money Concept v2: buscar níveis TP/SL do bridge (assimétrico)
        if (this.settings.strategy === 'SMC') {
            try {
                const smcResp = await axios.get(`${this.BRIDGE_URL}/smc_levels`, {
                    params: { symbol: this.resolvedSymbol, direction: dir, entry_price: entry },
                    timeout: 5000
                });
                if (smcResp.data && smcResp.data.sl && smcResp.data.tp1) {
                    sl = smcResp.data.sl as number;
                    tp = smcResp.data.tp1 as number;
                    const riskDist = smcResp.data.risk_distance || Math.abs(entry - sl);
                    const partialLvl = smcResp.data.partial_level || tp;
                    const spreadEst = this.currentSpread || 20;
                    smcData = {
                        tp2: smcResp.data.tp2,
                        atr: smcResp.data.atr,
                        risk_distance: riskDist,
                        partial_level: partialLvl,
                        market_trend: smcResp.data.market_trend,
                        bos_count: smcResp.data.bos_count
                    };
                    // Calcular lote baseado em % de risco da banca
                    const riskPct = this.settings.riskPercentage || 1;
                    let balance = 1000;
                    try { const acc = await axios.get(`${this.BRIDGE_URL}/account`, { timeout: 2000 }); if (acc.data?.balance) balance = acc.data.balance; } catch (e) {}
                    const riskUSD = (balance * riskPct) / 100;
                    const slDistPrice = Math.max(1, Math.abs(entry - sl));
                    if (!this.settings.useFixedLot) {
                        const calcLot = riskUSD / (slDistPrice * 100);
                        lot = Number(Math.max(0.01, Math.min(50, calcLot)).toFixed(2));
                    }
                    // Piso mínimo de SL para evitar stops muito apertados
                    const minDist = this.settings.minSLPoints || 10;
                    if (slDistPrice < minDist && minDist > 0) {
                        const oldSl = sl;
                        sl = dir === 'BUY' ? entry - minDist : entry + minDist;
                        this.log('SMC', `SL expandido de ${slDistPrice.toFixed(2)}pts para ${minDist}pts (mínimo configurado)`);
                        // Recalcular lote com a nova distância
                        if (!this.settings.useFixedLot) {
                            const newSlDist = Math.abs(entry - (sl as number));
                            if (newSlDist > 0) {
                                const calcLot = riskUSD / (newSlDist * 100);
                                lot = Number(Math.max(0.01, Math.min(50, calcLot)).toFixed(2));
                            }
                        }
                    }
                    this.log('SMC_v2', `SL=${(sl as number).toFixed(2)} TP1=${(tp as number).toFixed(2)} TP2=${smcResp.data.tp2} SL_dist=${Math.abs(entry - (sl as number)).toFixed(2)} Lote=${lot} (1% risco=$ ${riskUSD.toFixed(2)})`);
                }
            } catch (e: any) {
                this.log('WARN', `SMC indisponível, usando fallback: ${e.message}`);
            }
        }

        // Fallback: SL — Dinâmico (ATR) ou Fixo (USD)
        if (!sl) {
            if (this.settings.dynamicStopLoss && this.currentATR > 0) {
                const dist = this.currentATR * this.settings.dynamicSLMultiplier;
                sl = dir === 'BUY' ? entry - dist : entry + dist;
                this.log('DYN_SL', `SL Dinâmico: ATR=${this.currentATR.toFixed(2)} x ${this.settings.dynamicSLMultiplier} = ${dist.toFixed(2)} pts`);
            } else if (this.settings.useFixedSL) {
                let finalSL = this.settings.stopLossUSD;
                if (this.settings.dynamicATRMode) {
                    const factor = Math.max(0.7, Math.min(2.0, (this.currentSpread / 20)));
                    finalSL = Number((this.settings.stopLossUSD * factor).toFixed(2));
                }
                const dist = finalSL / (lot * 100);
                sl = dir === 'BUY' ? entry - dist : entry + dist;
            }
        }

        // Fallback: TP — Fixo (USD)
        if (!tp && this.settings.useFixedTP) {
            let finalTP = this.settings.takeProfitUSD;
            if (this.settings.dynamicATRMode) {
                const factor = Math.max(0.7, Math.min(2.0, (this.currentSpread / 20)));
                finalTP = Number((this.settings.takeProfitUSD * factor).toFixed(2));
                if (factor > 1.2) this.log('IA_DYNAMICS', `Volatilidade Alta. Expandindo TP: $${finalTP}`);
            }
            const dist = finalTP / (lot * 100);
            tp = dir === 'BUY' ? entry + dist : entry - dist;
        }
        
        // Fallback SL absoluto
        if (sl === undefined) {
            const defaultSL_USD = this.settings.stopLossUSD || 15;
            const dist = defaultSL_USD / (lot * 100);
            sl = dir === 'BUY' ? entry - dist : entry + dist;
        }

        // --- TP1 / TP2: Calcular para todos os modos (SMC ou USD) ---
        let tp1Price = 0;
        let tp2Price = 0;
        if (this.settings.tp1Enabled || this.settings.tp2Enabled) {
            const slDist = Math.abs(entry - (sl as number));
            if (slDist > 0) {
                if (this.settings.tp1Enabled) {
                    const mult = this.settings.tp1Multiplier || 1.5;
                    tp1Price = dir === 'BUY' ? entry + (slDist * mult) : entry - (slDist * mult);
                }
                if (this.settings.tp2Enabled) {
                    const mult = this.settings.tp2Multiplier || 3.0;
                    tp2Price = dir === 'BUY' ? entry + (slDist * mult) : entry - (slDist * mult);
                }
            }
        }
        
        // Fallback TP absoluto
        if (tp === undefined) {
            const defaultTP_USD = this.settings.takeProfitUSD || 10;
            const dist = defaultTP_USD / (lot * 100);
            tp = dir === 'BUY' ? entry + dist : entry - dist;
            this.log('FALLBACK_TP', `TP padrão $${defaultTP_USD}: ${(tp as number).toFixed(2)}`);
        }

        try {
            const r = await axios.post(`${this.BRIDGE_URL}/order`, {
                symbol: this.resolvedSymbol, 
                action: dir, 
                lot, 
                sl: Number((sl as number).toFixed(2)), 
                tp: Number((tp as number).toFixed(2)),
                magic: this.MAGIC, 
                comment: `GSL${level}${manual ? 'M' : ''}`
            });
            
                if (r.data?.ticket || r.data?.status === 'success') { 
                    this.lastTradeTime = Date.now(); 
                    const ticket = r.data.order_id || r.data.ticket || 0;
                    SymbolLockService.acquire(this.resolvedSymbol, 'Gold Scalper', ticket, dir);
                    if (smcData || this.settings.tp1Enabled || this.settings.tp2Enabled) {
                        this.smcPositionData.set(ticket, {
                            tp1: tp1Price || smcData?.partial_level || tp,
                            tp2: tp2Price || smcData?.tp2 || tp,
                            partialHit: false,
                            tp2Hit: false,
                            entry: entry,
                            spready: this.currentSpread || 20
                        });
                    }
                    const modo = smcData ? 'SMC_v2' : 'USD';
                    const tpInfo = (tp1Price > 0 || tp2Price > 0) ? ` TP1:${tp1Price > 0 ? tp1Price.toFixed(2) : '-'} TP2:${tp2Price > 0 ? tp2Price.toFixed(2) : '-'}` : '';
                    this.log('OPEN', `Sucesso #${ticket} ${dir} Lote:${lot} SL:${(sl as number).toFixed(2)} TP:${(tp as number).toFixed(2)}${tpInfo} [${modo}]`);
                return true; 
            }
        } catch (e: any) { 
            const isNetworkError = e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET' || e.message?.includes('10031') || e.message?.includes('network');
            if (isNetworkError) {
                this.log('WARN', `🔌 Rede MT5 indisponível ao abrir ${dir}. Tentando religar bridge...`);
                try { await axios.get(`${this.BRIDGE_URL}/health`, { timeout: 2000 }); } catch (e2) {
                    this.log('ERROR', `Bridge MT5 offline. Ordens automáticas pausadas.`);
                }
            } else {
                this.log('ERROR', `Falha ao abrir ${dir} nível ${level}: ${e.message}`);
            }
        }
        return false;
    }

    private static async processBreakEven(p: GoldPosition, tick: any) {
        if (this.currentATR <= 0) return;
        const isBuy = p.type === 0;
        const profitDistance = isBuy
            ? (tick.bid - p.price_open)
            : (p.price_open - tick.ask);
        const atrBETrigger = this.currentATR * 1.0;
        const atrBEOffset = this.currentATR * 0.2;
        if (profitDistance >= atrBETrigger) {
            const newSl = isBuy ? p.price_open + atrBEOffset : p.price_open - atrBEOffset;
            if (isBuy ? (p.sl < newSl) : (p.sl > newSl || p.sl === 0)) {
                await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket: p.ticket, sl: Number(newSl.toFixed(2)) });
                this.log('BE_ATR', `SL movido para BE+ATR #${p.ticket} trigger=${atrBETrigger.toFixed(2)} novoSL=${newSl.toFixed(2)}`);
            }
        }
    }

    private static async processTrailingStop(p: GoldPosition, tick: any) {
        const isBuy = p.type === 0;
        const profitDistance = isBuy
            ? (tick.bid - p.price_open)
            : (p.price_open - tick.ask);
        const atrTrailStart = this.currentATR * 1.5;
        if (profitDistance < atrTrailStart) return;
        let newSl: number;

        if (this.settings.smartTrailing) {
            const mult = this.settings.atrTrailingMultiplier || 2.5;
            const atr = this.currentATR || 0.5;
            // Chandelier Exit: stop abaixo do highest high (BUY) ou acima do lowest low (SELL)
            const chandelierBase = isBuy ? this.chandelierHighestHigh : this.chandelierLowestLow;
            if (chandelierBase <= 0) return;
            newSl = isBuy ? (chandelierBase - mult * atr) : (chandelierBase + mult * atr);
        } else {
            newSl = isBuy ? (tick.bid - this.settings.trailingStop) : (tick.ask + this.settings.trailingStop);
        }

        const improved = isBuy ? (newSl > p.sl) : (newSl < p.sl || p.sl === 0);
        if (!improved) return;
        const diff = Math.abs(newSl - p.sl);
        if (diff >= this.settings.trailingStep) {
            await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket: p.ticket, sl: Number(newSl.toFixed(2)) });
        }
    }

    private static async processSMCDefense(p: GoldPosition, tick: any) {
        const data = this.smcPositionData.get(p.ticket);
        if (!data || data.partialHit) return;
        const isBuy = p.type === 0;
        const currentPrice = isBuy ? tick.bid : tick.ask;
        // Verificar se atingiu o micro-alvo (TP1 / partial_level)
        const hitTarget = isBuy ? (currentPrice >= data.tp1) : (currentPrice <= data.tp1);
        if (!hitTarget) return;

        // Usar configuração TP1 do usuário se habilitado, senão usar 50% fixo
        const partialPercent = this.settings.tp1Enabled ? (this.settings.tp1PartialPercent || 50) : 50;
        const closeLot = Number(((p.volume * partialPercent) / 100).toFixed(2));
        if (closeLot >= 0.01) {
            try {
                await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: p.ticket, lot: closeLot });
                this.log('TP1', `Parcial ${partialPercent}% fechada #${p.ticket} lucro≈$${p.profit.toFixed(2)} (${closeLot} lotes)`);
            } catch (e: any) {
                this.log('WARN', `Falha TP1 #${p.ticket}: ${e.message}`);
            }
        }
        // Mover SL para BE+spread após TP1 (se habilitado)
        if (this.settings.moveSLToBEAfterTP1) {
            const newSl = isBuy ? (data.entry + data.spready * 2 * 0.01) : (data.entry - data.spready * 2 * 0.01);
            const improved = isBuy ? (newSl > p.sl) : (newSl < p.sl);
            if (improved) {
                try {
                    await axios.post(`${this.BRIDGE_URL}/update_order`, { ticket: p.ticket, sl: Number(newSl.toFixed(2)) });
                    this.log('BE_MOVE', `SL movido para BE+spread #${p.ticket} novoSL=${newSl.toFixed(2)}`);
                } catch (e: any) {
                    this.log('WARN', `Falha BE move #${p.ticket}: ${e.message}`);
                }
            }
        }
        data.partialHit = true;
    }

    private static async processTP2(p: GoldPosition, tick: any) {
        if (!this.settings.tp2Enabled) return;
        const data = this.smcPositionData.get(p.ticket);
        if (!data || !data.partialHit || data.tp2Hit) return;
        const isBuy = p.type === 0;
        const currentPrice = isBuy ? tick.bid : tick.ask;
        const hitTP2 = isBuy ? (currentPrice >= data.tp2) : (currentPrice <= data.tp2);
        if (!hitTP2) return;

        // Fechar todo o restante no TP2
        const remainingLot = p.volume;
        if (remainingLot >= 0.01) {
            try {
                await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: p.ticket, lot: Number(remainingLot.toFixed(2)) });
                this.log('TP2', `Posição fechada #${p.ticket} lucro≈$${p.profit.toFixed(2)} (${remainingLot} lotes)`);
            } catch (e: any) {
                this.log('WARN', `Falha TP2 #${p.ticket}: ${e.message}`);
            }
        }
        data.tp2Hit = true;
    }

    private static async processBasket(pos: GoldPosition[]) {
        if (!pos.length) return false;
        const net = pos.reduce((s, x) => s + x.profit, 0);
        let basketTP = this.settings.basketTP;
        let basketSL = this.settings.basketSL;
        // SMC: calcular TP da cesta baseado na estrutura de mercado (com cache de 30s)
        if (this.settings.strategy === 'SMC' && this.resolvedSymbol && pos.length > 0) {
            if (Date.now() - this.lastBasketSMCFetch > 30000) {
                this.lastBasketSMCFetch = Date.now();
                try {
                    const firstPos = pos[0];
                    const dir = firstPos.type === 0 ? 'BUY' : 'SELL';
                    const entry = firstPos.price_open;
                    const smcResp = await axios.get(`${this.BRIDGE_URL}/smc_levels`, {
                        params: { symbol: this.resolvedSymbol, direction: dir, entry_price: entry },
                        timeout: 3000
                    });
                    if (smcResp.data && smcResp.data.tp2) {
                        const tp2Price = smcResp.data.tp2;
                        const priceDist = Math.abs(tp2Price - entry);
                        const totalLot = pos.reduce((s, p) => s + p.volume, 0);
                        const tpUSD = Number((priceDist * totalLot * 100).toFixed(2));
                        if (tpUSD > 0) {
                            basketTP = Math.max(tpUSD, 0.5);
                            this.log('SMC', `Basket TP ajustado para $${basketTP} (TP2 SMC: ${tp2Price})`);
                        }
                        if (smcResp.data.atr && smcResp.data.atr > 0) {
                            const slPrice = dir === 'BUY' ? tp2Price - smcResp.data.atr * 2 : tp2Price + smcResp.data.atr * 2;
                            const slDist = Math.abs(slPrice - entry);
                            const slUSD = -Number((slDist * totalLot * 100).toFixed(2));
                            basketSL = Math.max(slUSD, this.settings.basketSL);
                        }
                    }
                } catch (e: any) {
                    // Fallback: usar valores fixos
                }
            }
        }
        if (this.settings.basketTPEnabled && net >= basketTP) {
            for (const p of pos) await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: p.ticket });
            this.log('PROFIT', `Cesta finalizada com lucro de $${net.toFixed(2)}`);
            this.log('BASKET_TP', `Basket TP batido em $${net.toFixed(2)}`);
            return true;
        } else if (this.settings.basketSLEnabled && net <= basketSL) {
            for (const p of pos) await axios.post(`${this.BRIDGE_URL}/close_order`, { ticket: p.ticket });
            this.log('STOP', `Cesta finalizada com perda de $${net.toFixed(2)}`);
            this.lastLossTime = Date.now();
            return true;
        }
        return false;
    }

    private static updateTrendBuffer(b: number) {
        if (this.prevBid > 0) { this.trendBuffer.push(b - this.prevBid); if (this.trendBuffer.length > 10) this.trendBuffer.shift(); }
        this.prevBid = b;
    }

    private static getMicroTrend() {
        if (this.trendBuffer.length < 3) return 'FLAT';
        const sum = this.trendBuffer.slice(-5).reduce((a, b) => a + b, 0);
        if (sum > 0.015) return 'UP';
        if (sum < -0.015) return 'DOWN';
        return 'FLAT';
    }

    private static async recalculateDailyStats() {
        // Auto-sync a cada 60s (não mais a cada 1.5s)
        if (Date.now() - this.lastSyncTime > 60000) { this.lastSyncTime = Date.now(); await this.syncTradesFromMT5(); }
        
        // RETROACTIVE FIX: Corrige trades antigos que foram registrados como LOSS ou WIN mesmo sendo $0.00
        let historyModified = false;
        for (const t of this.tradeHistory) {
            if (t.result !== 'TIE' && t.profit >= -0.01 && t.profit <= 0.01) {
                t.result = 'TIE';
                historyModified = true;
            }
        }
        if (historyModified) this.saveTradeHistory();
        
        const today = new Date().toISOString().split('T')[0];
        const allToday = this.tradeHistory.filter(x => x.closeTime.startsWith(today));
        
        // Apenas trades do Robô (Magic 9999 ou comentário GSL)
        const robotToday = allToday.filter(t => t.magic === this.MAGIC || (t.comment || '').includes('GSL'));
        
        this.dailyProfit = Number(robotToday.filter(x => x.result === 'WIN').reduce((s: number, x) => s + x.profit, 0).toFixed(2));
        this.dailyLoss = Number(robotToday.filter(x => x.result === 'LOSS').reduce((s: number, x) => s + Math.abs(x.profit), 0).toFixed(2));
        
        // Lucro Diário Total da Conta (Exibido no frontend como Saldo Diário Conta)
        this.globalDailyProfit = Number(allToday.reduce((s, t) => s + t.profit, 0).toFixed(2));
    }

    static async getTradeReport() {
        await this.recalculateDailyStats();
        const wins = this.tradeHistory.filter(t => t.result === 'WIN');
        const losses = this.tradeHistory.filter(t => t.result === 'LOSS');
        const totalProfit = this.tradeHistory.reduce((s, t) => s + t.profit, 0);
        const grossWin = wins.reduce((s, t) => s + t.profit, 0);
        const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
        const avgWin = wins.length > 0 ? Number((grossWin / wins.length).toFixed(2)) : 0;
        const avgLoss = losses.length > 0 ? Number((grossLoss / losses.length).toFixed(2)) : 0;
        const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? 99.9 : 0);
        const bestTrade = this.tradeHistory.length > 0 ? Number(Math.max(...this.tradeHistory.map(t => t.profit)).toFixed(2)) : 0;
        const worstTrade = this.tradeHistory.length > 0 ? Number(Math.min(...this.tradeHistory.map(t => t.profit)).toFixed(2)) : 0;

        // Calculate current streak
        let currentStreak = 0;
        let streakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
        if (this.tradeHistory.length > 0) {
            streakType = this.tradeHistory[0].result === 'WIN' ? 'WIN' : 'LOSS';
            for (const t of this.tradeHistory) {
                if ((t.result === 'WIN' && streakType === 'WIN') || (t.result === 'LOSS' && streakType === 'LOSS')) {
                    currentStreak++;
                } else break;
            }
        }

        const robotTrades = this.tradeHistory.filter(t => t.magic === this.MAGIC || (t.comment || '').includes('GSL'));
        const robotWins = robotTrades.filter(t => t.result === 'WIN');
        const robotLosses = robotTrades.filter(t => t.result === 'LOSS');

        return {
            summary: {
                totalTrades: this.tradeHistory.length,
                wins: wins.length,
                losses: losses.length,
                winRate: this.tradeHistory.length > 0 ? Number(((wins.length / this.tradeHistory.length) * 100).toFixed(1)) : 0,
                totalProfit: Number(totalProfit.toFixed(2)),
                avgWin,
                avgLoss,
                profitFactor,
                bestTrade,
                worstTrade,
                currentStreak,
                streakType
            },
            robotSummary: {
                totalTrades: robotTrades.length,
                wins: robotWins.length,
                losses: robotLosses.length,
                ties: robotTrades.filter(t => t.result === 'TIE').length,
                winRate: robotTrades.length > 0 ? Number(((robotWins.length / robotTrades.length) * 100).toFixed(1)) : 0,
                totalProfit: Number(robotTrades.reduce((s, t) => s + t.profit, 0).toFixed(2)),
                avgWin: robotWins.length > 0 ? Number((robotWins.reduce((s, t) => s + t.profit, 0) / robotWins.length).toFixed(2)) : 0,
                avgLoss: robotLosses.length > 0 ? Number((Math.abs(robotLosses.reduce((s, t) => s + t.profit, 0)) / robotLosses.length).toFixed(2)) : 0,
                profitFactor: (() => {
                    const gw = robotWins.reduce((s, t) => s + t.profit, 0);
                    const gl = Math.abs(robotLosses.reduce((s, t) => s + t.profit, 0));
                    return gl > 0 ? Number((gw / gl).toFixed(2)) : (gw > 0 ? 99.9 : 0);
                })(),
                bestTrade: robotTrades.length > 0 ? Number(Math.max(...robotTrades.map(t => t.profit)).toFixed(2)) : 0,
                worstTrade: robotTrades.length > 0 ? Number(Math.min(...robotTrades.map(t => t.profit)).toFixed(2)) : 0,
                currentStreak: (() => {
                    if (robotTrades.length === 0) return 0;
                    let streak = 0;
                    const st = robotTrades[0].result === 'WIN' ? 'WIN' : 'LOSS';
                    for (const t of robotTrades) {
                        if ((t.result === 'WIN' && st === 'WIN') || (t.result === 'LOSS' && st === 'LOSS')) streak++;
                        else break;
                    }
                    return streak;
                })(),
                streakType: robotTrades.length > 0 ? (robotTrades[0].result === 'WIN' ? 'WIN' : 'LOSS') : 'NONE'
            },
            trades: robotTrades.slice(0, 50)
        };
    }

    static getTradesForStats() {
        return this.tradeHistory.slice();
    }

    static getHistory() {
        return {
            trades: this.tradeHistory,
            stats: {
                totalTrades: this.tradeHistory.length,
                wins: this.tradeHistory.filter(t => t.result === 'WIN').length,
                losses: this.tradeHistory.filter(t => t.result === 'LOSS').length,
                winRate: this.tradeHistory.length > 0
                    ? Number((this.tradeHistory.filter(t => t.result === 'WIN').length / this.tradeHistory.length * 100).toFixed(1))
                    : 0,
                closedPnL: Number(this.tradeHistory.reduce((s, t) => s + t.profit, 0).toFixed(2)),
                avgProfit: this.tradeHistory.length > 0
                    ? Number((this.tradeHistory.reduce((s, t) => s + t.profit, 0) / this.tradeHistory.length).toFixed(2))
                    : 0,
            }
        };
    }

    static async getStatistics() {
        await this.recalculateDailyStats();
        const trades = this.tradeHistory;

        // Curva de equity sequencial (últimos 200 trades)
        const recentTrades = trades.slice(0, 200).reverse();
        let running = 0;
        const equityCurve = recentTrades.map((t, i) => {
            running += t.profit;
            return {
                trade: i + 1,
                equity: Number(running.toFixed(2)),
                date: t.closeTime ? t.closeTime.substring(0, 10) : ''
            };
        });

        // Daily P&L (agrupa por data, fallback para sequencial se tudo for hoje)
        const dailyMap: Record<string, number> = {};
        for (const t of trades) {
            const day = t.closeTime ? t.closeTime.substring(0, 10) : '';
            if (day) dailyMap[day] = (dailyMap[day] || 0) + t.profit;
        }
        let dailyPL = Object.entries(dailyMap)
            .map(([date, profit]) => ({ date, profit: Number(profit.toFixed(2)) }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30);

        // Se só tem 1 dia, distribui os trades nos últimos 30 dias para o gráfico
        if (dailyPL.length <= 1) {
            const chunkSize = Math.max(1, Math.floor(trades.length / 30));
            dailyPL = [];
            for (let i = 0; i < 30 && i * chunkSize < trades.length; i++) {
                const chunk = trades.slice(i * chunkSize, (i + 1) * chunkSize);
                const profit = chunk.reduce((s, t) => s + t.profit, 0);
                dailyPL.push({ date: `Dia ${i + 1}`, profit: Number(profit.toFixed(2)) });
            }
        }

        // Win/Loss distribution
        const wins = trades.filter(t => t.result === 'WIN');
        const losses = trades.filter(t => t.result === 'LOSS');

        // Profit ranges for histogram
        const ranges = [
            { min: -9999, max: -50, label: '< -$50' },
            { min: -50, max: -20, label: '-$50 a -$20' },
            { min: -20, max: -5, label: '-$20 a -$5' },
            { min: -5, max: 0, label: '-$5 a $0' },
            { min: 0, max: 5, label: '$0 a $5' },
            { min: 5, max: 20, label: '$5 a $20' },
            { min: 20, max: 50, label: '$20 a $50' },
            { min: 50, max: 9999, label: '> $50' }
        ];
        const profitHistogram = ranges.map(r => ({
            label: r.label,
            count: trades.filter(t => t.profit > r.min && t.profit <= r.max).length,
            direction: r.min >= 0 ? 'win' : 'loss'
        }));

        // By day of week
        const dowNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dowMap: Record<number, { trades: number, wins: number, profit: number }> = {};
        const uniqueDates = new Set(trades.map(t => t.closeTime ? t.closeTime.substring(0, 10) : ''));
        // Se todos os trades têm a mesma data, distribui sequencialmente pelos 7 dias
        if (uniqueDates.size <= 1) {
            for (let i = 0; i < trades.length; i++) {
                const d = i % 7;
                if (!dowMap[d]) dowMap[d] = { trades: 0, wins: 0, profit: 0 };
                dowMap[d].trades++;
                if (trades[i].result === 'WIN') dowMap[d].wins++;
                dowMap[d].profit += trades[i].profit;
            }
        } else {
            for (const t of trades) {
                const d = t.closeTime ? new Date(t.closeTime).getDay() : -1;
                if (d < 0) continue;
                if (!dowMap[d]) dowMap[d] = { trades: 0, wins: 0, profit: 0 };
                dowMap[d].trades++;
                if (t.result === 'WIN') dowMap[d].wins++;
                dowMap[d].profit += t.profit;
            }
        }
        const byDayOfWeek = Object.entries(dowMap).map(([d, data]) => ({
            day: dowNames[parseInt(d)] || d,
            trades: data.trades,
            winRate: data.trades > 0 ? Number(((data.wins / data.trades) * 100).toFixed(1)) : 0,
            profit: Number(data.profit.toFixed(2))
        }));

        // Win/Loss pie
        const winLossPie = [
            { name: 'Wins', value: wins.length, color: '#16A34A' },
            { name: 'Losses', value: losses.length, color: '#EF4444' },
            { name: 'Ties', value: trades.filter(t => t.result === 'TIE').length, color: '#6B7280' }
        ];

        // Robot summary
        const report = await this.getTradeReport();

        return {
            equityCurve,
            dailyPL,
            profitHistogram,
            byDayOfWeek,
            winLossPie,
            summary: report.robotSummary,
            totalTrades: trades.length
        };
    }

    static resetTrades() {
        this.tradeHistory = [];
        this.saveTradeHistory();
    }

    static async syncTradesFromMT5() {
        if (this.isSyncingTrades) return { synced: 0, total: this.tradeHistory.length };
        this.isSyncingTrades = true;
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/history`);
            const h = r.data || [];

            // Remove trades corrompidos (entry deals com profit zero, sem positionId)
            const oldCount = this.tradeHistory.length;
            this.tradeHistory = this.tradeHistory.filter(t => t.profit !== 0 || t.positionId);
            this.totalProfitAllTime = this.tradeHistory.length > 0
                ? Number(this.tradeHistory.filter(t => t.magic === this.MAGIC || (t.comment || '').includes('GSL')).reduce((s, t) => s + t.profit, 0).toFixed(2))
                : 0;

            const seenTickets = new Set(this.tradeHistory.map(x => x.ticket));
            const seenPositions = new Set(this.tradeHistory.filter(x => x.positionId).map(x => x.positionId));

            // Agrupa deals por position_id
            const entriesByPos = new Map<number, any>();
            const exitsByPos = new Map<number, any>();

            for (const t of h) {
                const sym = (t.symbol || '').toUpperCase();
                const isGold = this.GOLD_SYMBOLS.some(gs => sym.includes(gs.toUpperCase()));
                if (!isGold) continue;
                if (!t.position_id) continue;

                if (t.entry === 0) {
                    entriesByPos.set(t.position_id, t);
                } else if (t.entry === 1) {
                    exitsByPos.set(t.position_id, t);
                }
            }

            let added = 0;
            for (const [posId, entry] of entriesByPos) {
                const exit = exitsByPos.get(posId);
                if (!exit) continue;

                const ticket = exit.ticket || entry.ticket;
                if (seenTickets.has(ticket)) continue;
                if (seenPositions.has(posId)) continue;

                const netProfit = Number(((exit.profit || 0) + (exit.commission || 0) + (exit.swap || 0)).toFixed(2));
                const direction = entry.type === 0 ? 'BUY' : 'SELL';
                const isRobot = entry.magic === this.MAGIC || exit.magic === this.MAGIC ||
                    (entry.comment || '').includes('GSL') || (exit.comment || '').includes('GSL');

                const closeTime = exit.time ? new Date(exit.time * 1000).toISOString() : new Date().toISOString();
                const openTime = entry.time ? new Date(entry.time * 1000).toISOString() : closeTime;
                const comment = (entry.comment || exit.comment || '').toLowerCase();

                let closeReason: TradeRecord['closeReason'] = 'TP';
                if (comment.includes('[sl') || comment.includes('stop loss') || comment.includes('sl ')) closeReason = 'SL';
                else if (comment.includes('trailing') || comment.includes('[tr')) closeReason = 'TRAILING';
                else if (comment.includes('manual')) closeReason = 'MANUAL';

                const trade: TradeRecord = {
                    id: `mt5_${ticket}`,
                    ticket,
                    positionId: posId,
                    symbol: entry.symbol,
                    type: direction,
                    lot: entry.volume || 0,
                    entryPrice: entry.price || 0,
                    exitPrice: exit.price || 0,
                    profit: netProfit,
                    result: netProfit > 0.01 ? 'WIN' : (netProfit < -0.01 ? 'LOSS' : 'TIE'),
                    gridLevel: 1,
                    closeReason,
                    openTime,
                    closeTime,
                    duration: '-',
                    magic: entry.magic || exit.magic,
                    comment: (entry.comment || exit.comment || '').trim()
                };

                if (!isRobot) continue;
                this.tradeHistory.push(trade);
                this.totalProfitAllTime += netProfit;
                
                // Log closed trade to operation feed
                this.log('CLOSE', `Posição #${ticket} ${direction} ${entry.symbol} fechada. Lucro: $${netProfit.toFixed(2)} | Motivo: ${closeReason}`);
                
                if (this.settings.enabled) {
                }
                added++;
            }

            // Ordenar por closeTime decrescente
            this.tradeHistory.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());

            // Salva sempre que houver mudanças
            if (added > 0 || oldCount !== this.tradeHistory.length) {
                this.saveTradeHistory();
            }
            return { synced: added, total: this.tradeHistory.length };
        } catch (e) {
            console.error('[GoldScalper] syncTradesFromMT5 error:', e);
            return { synced: 0, total: this.tradeHistory.length };
        } finally {
            this.isSyncingTrades = false;
        }
    }

    private static lastHeartbeatLogTime = 0;

    private static log(action: string, details: string) {
        this.operationLog.unshift({ time: new Date().toLocaleTimeString('pt-BR'), action, details });
        if (this.operationLog.length > 100) this.operationLog.pop();
        if (action !== 'IA_GUARD' && action !== 'HEARTBEAT') console.log(`🥇 Gold Scalper [${action}]: ${details}`);
    }

    private static isHighLiquiditySession(): boolean {
        const hour = new Date().getUTCHours();
        // Sessões de Londres e NY (07:00 as 20:00 UTC)
        return hour >= 7 && hour <= 20;
    }

    private static loadTradeHistory() {
        if (fs.existsSync(this.HISTORY_PATH)) {
            try {
                const d = JSON.parse(fs.readFileSync(this.HISTORY_PATH, 'utf-8'));
                this.tradeHistory = (d.trades || []).filter((t: TradeRecord) => {
                    const isOur = t.magic === this.MAGIC || (t.comment || '').toUpperCase().includes('GSL');
                    if (!isOur) return false;
                    if (t.symbol) {
                        const sym = t.symbol.toUpperCase();
                        return this.GOLD_SYMBOLS.some(gs => sym.includes(gs.toUpperCase()));
                    }
                    return true;
                });
                this.totalProfitAllTime = this.tradeHistory.reduce((s, t) => s + t.profit, 0);
            } catch (e) {
                console.warn('GoldScalper: load trade history error', e);
            }
        }
    }

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try { this.settings = { ...this.settings, ...JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf-8')) }; } catch (e) {
                console.warn('GoldScalper: load settings error', e);
            }
        }
    }
    private static saveTradeHistory() { try { fs.writeFileSync(this.HISTORY_PATH, JSON.stringify({ trades: this.tradeHistory, totalProfitAllTime: this.totalProfitAllTime }, null, 2)); } catch (e) { console.error('[GoldScalper] saveTradeHistory error:', e); } }
    private static loadLearningState() { if (fs.existsSync(this.LEARN_PATH)) try { this.learningState = JSON.parse(fs.readFileSync(this.LEARN_PATH, 'utf-8')); } catch (e) { console.warn('[GoldScalper] loadLearningState error:', e); } }
    private static async resolveDXYSymbol() {
        try {
            const r = await axios.get(`${this.BRIDGE_URL}/symbols`);
            const s = r.data as string[];
            for (const ds of this.DXY_SYMBOLS) if (s.includes(ds)) return this.dxySymbol = ds;
            const f = s.find(x => x.toUpperCase().includes('DXY') || x.toUpperCase().includes('USDX'));
            if (f) return this.dxySymbol = f;
        } catch (e) { }
    }
    private static fetchNewsEvents() { }
    private static isNewsPeriod() { return false; }
    private static calculateNeuroScore() {
        let score = 0;
        const w = this.learningState.weights;
        
        // 1. Alinhamento de Tendência (Peso 40)
        if (this.currentM1Trend === this.currentM5Trend && this.currentM1Trend !== 'FLAT') score += w.tripleAlign;
        else if (this.currentM1Trend !== 'FLAT' || this.currentM5Trend !== 'FLAT') score += w.tripleAlign / 2;

        // 2. Correlação DXY (Peso 20)
        if (this.settings.dxyFilter) {
            const trend = (this.currentM1Trend === 'UP' ? 'BUY' : 'SELL');
            if ((trend === 'BUY' && this.currentDXYTrend === 'DOWN') || (trend === 'SELL' && this.currentDXYTrend === 'UP')) score += w.dxy;
        } else score += w.dxy;

        // 3. RSI / Exaustão (Peso 10)
        if (this.currentRSI > 30 && this.currentRSI < 70) score += w.rsi;
        else if ((this.currentM1Trend === 'UP' && this.currentRSI < 30) || (this.currentM1Trend === 'DOWN' && this.currentRSI > 70)) score += w.rsi;

        // 4. Volume / VSA (Peso 20)
        if (this.relativeVolume > 1.2) score += w.vsa;
        else score += w.vsa * 0.7;

        return Math.min(100, Math.round(score));
    }

    private static async analyzeAndOptimizeIA() {
        if (!this.settings.smartAdaptiveIA || this.tradeHistory.length < 10) return;
        
        const recentTrades = this.tradeHistory.slice(0, 50);
        const winRate = (recentTrades.filter(t => t.result === 'WIN').length / recentTrades.length) * 100;
        
        if (winRate < 70) {
            // Se a assertividade cair, aumentamos o rigor da IA
            this.learningState.minScoreThreshold = Math.min(90, this.learningState.minScoreThreshold + 2);
            this.log('IA_LEARNING', `Assertividade baixa (${winRate.toFixed(1)}%). Elevando critério de entrada p/ ${this.learningState.minScoreThreshold}%`);
        } else if (winRate > 85) {
            // Se estiver excelente, podemos permitir entradas mais agressivas
            this.learningState.minScoreThreshold = Math.max(70, this.learningState.minScoreThreshold - 1);
        }
        
        this.learningState.lastOptimized = Date.now();
        this.learningState.totalTradesAnalyzed = this.tradeHistory.length;
        fs.writeFileSync(this.LEARN_PATH, JSON.stringify(this.learningState, null, 2));
    }

    private static calculateRSI(c: any[]) { 
        if (!c || c.length < 14) return;
        const changes = [];
        for (let i = 1; i < c.length; i++) changes.push(c[i].close - c[i - 1].close);
        const gains = changes.map(x => x > 0 ? x : 0);
        const losses = changes.map(x => x < 0 ? Math.abs(x) : 0);
        const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
        const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
        if (avgLoss === 0) this.currentRSI = 100;
        else {
            const rs = avgGain / avgLoss;
            this.currentRSI = 100 - (100 / (1 + rs));
        }
    }
    private static calculateRelativeVolume(c: any[]) { 
        if (!c || c.length < 20) return;
        const volumes = c.map(x => x.tick_volume || x.real_volume || 0);
        const avgVol = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
        this.relativeVolume = avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1.0;
    }
    private static async fetchH4OrderBlocks() { }

    static async getRiskReport() {
        await this.recalculateDailyStats();
        let accountData: any = {};
        let pos: GoldPosition[] = [];
        try {
            const [accRes, posRes] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 }),
                axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 })
            ]);
            accountData = accRes.data || {};
            pos = (posRes.data || []).filter((p: any) => p.symbol?.includes('XAU'));
        } catch (e) {}

        const balance = accountData.balance || 0;
        const equity = accountData.equity || 0;
        const margin = accountData.margin || 0;
        const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;
        const floatingPL = pos.reduce((s, p) => s + (p.profit || 0), 0);

        // Drawdown estimado
        const totalEquity = equity || balance;
        const peakRef = Math.max(this.totalProfitAllTime + balance * 0.1, balance);
        const drawdown = peakRef > 0 ? Math.min(100, ((peakRef - totalEquity) / peakRef) * 100) : 0;

        const riskPerTradePct = this.settings.riskPercentage || 1;
        const riskPerTradeUSD = balance * (riskPerTradePct / 100);
        const dailyLossRemaining = Math.max(0, this.settings.maxDailyLoss - this.dailyLoss);
        const dailyProfitRemaining = Math.max(0, this.settings.maxDailyProfit - this.dailyProfit);

        const report = await this.getTradeReport();
        const s = report.robotSummary;

        // Cálculo do Score de Disciplina (0-100)
        let score = 100;
        if (s.totalTrades > 0) {
            if (s.winRate < 40) score -= 20;
            else if (s.winRate < 50) score -= 10;
            if (s.profitFactor < 1.0) score -= 25;
            else if (s.profitFactor < 1.2) score -= 15;
            if (s.streakType === 'LOSS' && s.currentStreak > 5) score -= 15;
            if (drawdown > 20) score -= 20;
            else if (drawdown > 10) score -= 10;
            if (this.globalDailyLoss >= this.settings.maxDailyLoss * 0.8) score -= 10;
            if (riskPerTradePct > 3) score -= 15;
            else if (riskPerTradePct > 2) score -= 5;
        }
        score = Math.max(0, Math.min(100, score));

        // Breakdown mensal
        const months: Record<string, { trades: number, wins: number, losses: number, profit: number }> = {};
        for (const t of this.tradeHistory) {
            const m = t.closeTime ? t.closeTime.substring(0, 7) : '';
            if (!m) continue;
            if (!months[m]) months[m] = { trades: 0, wins: 0, losses: 0, profit: 0 };
            months[m].trades++;
            if (t.result === 'WIN') months[m].wins++;
            else if (t.result === 'LOSS') months[m].losses++;
            months[m].profit += t.profit;
        }
        const monthly = Object.entries(months)
            .map(([month, d]) => ({
                month,
                trades: d.trades,
                wins: d.wins,
                losses: d.losses,
                winRate: d.trades > 0 ? Number(((d.wins / d.trades) * 100).toFixed(1)) : 0,
                profit: Number(d.profit.toFixed(2))
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Tabela de dimensionamento de lote
        const avgSLDist = this.currentATR > 0 ? this.currentATR * 1.5 : 10;
        const sizing = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(pct => {
            const riskUSD = balance * (pct / 100);
            const lot = avgSLDist > 0 ? Number((riskUSD / (avgSLDist * 100)).toFixed(2)) : 0.01;
            return { riskPct: pct, riskUSD: Number(riskUSD.toFixed(2)), lot: Math.max(0.01, lot) };
        });

        return {
            account: {
                balance: Number(balance.toFixed(2)),
                equity: Number(equity.toFixed(2)),
                margin: Number(margin.toFixed(2)),
                marginLevel: Number(marginLevel.toFixed(2)),
                leverage: accountData.leverage || 0,
                currency: accountData.currency || 'USD',
                login: accountData.login || 0,
                broker: accountData.company || '',
                floatingPL: Number(floatingPL.toFixed(2)),
                openPositions: pos.length
            },
            risk: {
                riskPerTradePct,
                riskPerTradeUSD: Number(riskPerTradeUSD.toFixed(2)),
                dailyLossRemaining: Number(dailyLossRemaining.toFixed(2)),
                dailyProfitRemaining: Number(dailyProfitRemaining.toFixed(2)),
                maxDailyLoss: this.settings.maxDailyLoss,
                maxDailyProfit: this.settings.maxDailyProfit,
                drawdown: Number(drawdown.toFixed(1)),
                consecutiveLosses: s.streakType === 'LOSS' ? s.currentStreak : 0,
                winStreak: s.streakType === 'WIN' ? s.currentStreak : 0,
                totalTrades: s.totalTrades
            },
            discipline: {
                score,
                breakdown: {
                    winRate: s.winRate,
                    profitFactor: s.profitFactor,
                    avgWin: s.avgWin,
                    avgLoss: s.avgLoss,
                    bestTrade: s.bestTrade,
                    worstTrade: s.worstTrade,
                    totalProfit: s.totalProfit
                }
            },
            monthly,
            sizing
        };
    }

    static async getStatus() {
        await this.recalculateDailyStats();
        if (this.settings.smartAdaptiveIA && this.tradeHistory.length > this.learningState.totalTradesAnalyzed + 10) await this.analyzeAndOptimizeIA();
        
        let pos: GoldPosition[] = [];
        let accountData: any = null;
        try {
            const [posRes, accRes] = await Promise.all([
                axios.get(`${this.BRIDGE_URL}/positions`, { timeout: 5000 }),
                axios.get(`${this.BRIDGE_URL}/account`, { timeout: 5000 })
            ]);
            pos = (posRes.data || []).filter((p: any) =>
                this.GOLD_SYMBOLS.some(gs => p.symbol.toUpperCase().includes(gs.toUpperCase())) &&
                (p.magic === this.MAGIC)
            );
            accountData = accRes.data;
        } catch (e) { }

        this.floatingProfit = pos.reduce((s: number, p: GoldPosition) => s + p.profit, 0);
        this.openPositionsCount = pos.length;
        const rpt = await this.getTradeReport();
        const isCoolingOff = this.lastLossTime > 0 && (Date.now() - this.lastLossTime < 15 * 60 * 1000);
        const coolOffRemainingMs = isCoolingOff ? Math.max(0, (this.lastLossTime + 15 * 60 * 1000) - Date.now()) : 0;
        const iaScore = this.calculateNeuroScore();

        // Determinar Humor do Córtex
        let cortexHumor = 'ANALÍTICO';
        if (isCoolingOff || this.isKillZone) cortexHumor = 'PROTEÇÃO';
        else if (this.currentSpread > this.settings.maxSpreadPoints || (this.settings.smartNeuroIA && iaScore < this.learningState.minScoreThreshold)) cortexHumor = 'CAUTELOSO';
        else if (iaScore > 85) cortexHumor = 'AGRESSIVO';

        // Detalhamento dos Pilares (Decisão)
        const decisionPillars = {
            trend: (this.currentM1Trend === this.currentM5Trend && this.currentM1Trend !== 'FLAT') ? 100 : (this.currentM1Trend !== 'FLAT' || this.currentM5Trend !== 'FLAT' ? 50 : 0),
            dxy: (this.settings.dxyFilter && ((this.currentM1Trend === 'UP' && this.currentDXYTrend === 'DOWN') || (this.currentM1Trend === 'DOWN' && this.currentDXYTrend === 'UP'))) ? 100 : 50,
            rsi: (this.currentRSI > 30 && this.currentRSI < 70) ? 100 : 30,
            volume: (this.relativeVolume > 1.2) ? 100 : 70
        };

        // Cálculo de Divergência Crítica (XAU vs DXY)
        let dxyDivergence = { status: 'NORMAL', correlation: 50 };
        if (this.currentM1Trend !== 'FLAT' && this.currentDXYTrend !== 'NEUTRAL') {
            const isGoldUp = this.currentM1Trend === 'UP';
            const isDxyUp = this.currentDXYTrend === 'UP';
            if (isGoldUp !== isDxyUp) {
                dxyDivergence = { status: 'SAUDÁVEL', correlation: 100 };
            } else {
                dxyDivergence = { status: 'CRÍTICA', correlation: 0 };
            }
        }

        // Cálculo de Heatmap de Drawdown (Floating vs Max Loss)
        const ddFloating = this.floatingProfit < 0 ? Math.abs(this.floatingProfit) : 0;
        const ddPercent = this.settings.maxDailyLoss > 0 ? Math.min(100, (ddFloating / this.settings.maxDailyLoss) * 100) : 0;
        let heatmapStatus = 'NORMAL';
        if (ddPercent > 75) heatmapStatus = 'CRÍTICO';
        else if (ddPercent > 40) heatmapStatus = 'ALERTA';

        return {
            isRunning: this.isRunning,
            enabled: this.settings.enabled, settings: this.settings, resolvedSymbol: this.resolvedSymbol,
            dailyProfit: this.dailyProfit, dailyLoss: this.dailyLoss, totalProfit: this.totalProfitAllTime,
            floatingProfit: Number(this.floatingProfit.toFixed(2)), openPositions: this.openPositionsCount,
            netDailyProfit: Number((this.dailyProfit - this.dailyLoss + this.floatingProfit).toFixed(2)),
            accountBalance: accountData?.balance || 0,
            accountDailyProfit: this.globalDailyProfit,
            report: rpt.summary, trades: rpt.trades, currentSpread: this.currentSpread, isKillZone: this.isKillZone,
            microTrend: this.getMicroTrend() as 'UP' | 'DOWN' | 'FLAT',
            m1Trend: this.currentM1Trend || 'FLAT',
            m5Trend: this.currentM5Trend || 'FLAT',
            ma200: this.currentMA200,
            ma200_M15: this.currentMA200_M15,
            ma200_M5: this.currentMA200_M5,
            ma14: this.currentMA14,
            ma21: this.currentMA21,
            ma50: this.currentMA50,
            ma100: this.currentMA100,
            currentPrice: this.currentPrice,
            ma200Ready: this.ma200Ready,
            smcTrend: this.currentSMCTrend,
            m5Strength: this.m5TrendStrength || 50,
            predictions: {
                m1: this.predictNextCandle('M1'),
                m5: this.predictNextCandle('M5'),
                m15: this.predictNextCandle('M15'),
                h1: this.predictNextCandle('H1')
            },
            m5Gap: this.m5PriceGap,
            m5Vol: this.m5RelativeVolume,
            dxyTrend: this.settings.dxyFilter ? this.currentDXYTrend : 'OFF',
            sentiment: { long: this.sentimentLong, short: this.sentimentShort },
            rsi: this.currentRSI,
            volume: this.relativeVolume,
            iaScore,
            cortexHumor, decisionPillars,
            iaLearning: {
                minScore: this.learningState.minScoreThreshold,
                totalAnalyzed: this.learningState.totalTradesAnalyzed,
                lastOptimized: this.learningState.lastOptimized
            },
            dxyDivergence,
            drawdownHeatmap: {
                percent: Number(ddPercent.toFixed(1)),
                status: heatmapStatus,
                floating: Number(ddFloating.toFixed(2))
            },
            isCoolingOff,
            coolOffRemainingMs,
            operationLog: this.operationLog,
            basket: {
                net: Number(this.floatingProfit.toFixed(2)),
                tp: this.settings.basketTP,
                sl: this.settings.basketSL,
                progress: this.settings.maxDailyLoss > 0 ? Number(((this.floatingProfit / this.settings.basketTP) * 100).toFixed(0)) : 0
            },
            smcLevels: this.currentSMCData ? {
                market_trend: this.currentSMCData.market_trend || 'NEUTRAL',
                tp1: this.currentSMCData.tp1,
                tp2: this.currentSMCData.tp2,
                sl: this.currentSMCData.sl,
                bos_count: this.currentSMCData.bos_count || 0,
                atr: this.currentSMCData.atr || 0,
                partial_level: this.currentSMCData.partial_level,
                risk_distance: this.currentSMCData.risk_distance
            } : null,
        };
    }
}
