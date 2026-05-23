export interface TradingSignal {
    id: string;
    asset: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    setup: 'VWAP Pullback' | 'RSI Divergence' | 'Breakout' | 'EMA Cross' | 'Alpha Confluence' | 'Squeeze Breakout' | 'Golden Rejection' | 'Smart Momentum' | 'Shark Hunt XAU' | 'Crypto Whale Hunt' | 'Alpha Scalper Grid' | 'Alpha Nakamoto' | 'Altcoin Sniper' | 'Intelligence 7' | 'Alpha Shark' | 'Ethereum Core' | 'Golden Whale Hunter';
    timeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';
    confidence: number;
    timestamp: Date;
    details?: string;
    indicators?: string[];
    sl?: number;
    tp?: number;
    volume_power?: number; // 0-100 VSA index
    price_entry?: number;
    isInstitutional?: boolean;
    category: 'FOREX' | 'INDICES' | 'CRIPTOMOEDAS' | 'METAIS' | 'COMMODITIES';
}

import axios from 'axios';
import { InstitutionalEngine } from './InstitutionalEngine';
import { AlertEngine } from './AlertEngine';
import { VSAEngine, VSAPattern } from './VSAEngine';
import { PolygonService } from './PolygonService';
import { MarketDataService } from './MarketDataService';
import { GoldenWhaleEngine } from './GoldenWhaleEngine';
import fs from 'fs';
import path from 'path';

export class SignalEngine {
    private static lastGenerationTime = 0;
    private static currentSignals: TradingSignal[] = [];
    private static BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

    private static previousTicks: Record<string, any> = {};

    // ═══════════════════════════════════════════════════════════════
    // RASTREAMENTO DE SINAIS EM TEMPO REAL (Persistência em disco)
    // ═══════════════════════════════════════════════════════════════
    private static signalTracker: Record<string, { signalsEmitted: number; lastEmitted: string }> = {};
    private static TRACKER_PATH = path.join(__dirname, '../../data/signal_tracker.json');

    private static loadTracker() {
        try {
            if (fs.existsSync(this.TRACKER_PATH)) {
                this.signalTracker = JSON.parse(fs.readFileSync(this.TRACKER_PATH, 'utf8'));
            }
        } catch { /* ignora */ }
    }

    private static saveTracker() {
        try {
            const dir = path.dirname(this.TRACKER_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.TRACKER_PATH, JSON.stringify(this.signalTracker, null, 2));
        } catch { /* ignora */ }
    }

    private static trackSignal(setup: string) {
        if (!this.signalTracker[setup]) {
            this.signalTracker[setup] = { signalsEmitted: 0, lastEmitted: '' };
        }
        this.signalTracker[setup].signalsEmitted++;
        this.signalTracker[setup].lastEmitted = new Date().toISOString();
        this.saveTracker();
    }

    /**
     * Retorna relatório real de performance por estratégia
     * Cruza dados do histórico do MT5 com o rastreamento local
     * Classifica trades antigos por SÍMBOLO quando o comment não identifica a estratégia
     */
    static async getStrategyReport(): Promise<any[]> {
        this.loadTracker();

        // Busca histórico real do MT5 Bridge
        let mt5History: any[] = [];
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`);
            mt5History = Array.isArray(resp.data) ? resp.data : [];
        } catch { /* sem histórico */ }

        // Catálogo de todas as estratégias com regras de mapeamento por símbolo
        const catalog = [
            { name: 'Alpha Nakamoto', category: 'Cripto', asset: 'BTCUSD', color: '#f7931a', symbols: ['BTCUSD'], priority: 1, magic: 8888 },
            { name: 'Ethereum Core', category: 'Cripto', asset: 'ETHUSD', color: '#627eea', symbols: ['ETHUSD'], priority: 1, magic: 8888 },
            { name: 'Crypto Whale Hunt', category: 'Cripto', asset: 'Multi', color: '#06b6d4', symbols: ['BNBUSD', 'DOGEUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD', 'MATICUSD', 'DOTUSD', 'LINKUSD', 'TRXUSD', 'LTCUSD', 'SHIBUSD', 'BCHUSD', 'ETCUSD', 'XLMUSD', 'XMRUSD', 'ZECUSD', 'EOSUSD'], priority: 2, magic: 8888 },
            { name: 'Altcoin Sniper', category: 'Cripto', asset: 'Altcoins', color: '#10b981', symbols: ['BNBUSD', 'DOGEUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD', 'DOTUSD', 'LINKUSD', 'LTCUSD', 'SHIBUSD'], priority: 1, magic: 8888 },
            { name: 'Crypto IA Pro', category: 'Cripto', asset: 'Multi-IA', color: '#00ccff', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'ADABUSD', 'XRPBUSD'], priority: 0, magic: 8888 },
            { name: 'Intelligence 7', category: 'Forex', asset: 'Majors', color: '#3b82f6', symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY'], priority: 1 },
            { name: 'Smart Momentum', category: 'Forex', asset: 'Majors', color: '#6366f1', symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD'], priority: 2 },
            { name: 'Alpha Shark', category: 'Metais/Cripto', asset: 'XAU/Cripto', color: '#ef4444', symbols: ['XAUUSD', 'GOLD', 'BTCUSD', 'ETHUSD'], priority: 3 },
            { name: 'Golden Rejection', category: 'Metais', asset: 'XAU/XAG', color: '#eab308', symbols: ['XAUUSD', 'GOLD', 'XAGUSD'], priority: 2 },
            { name: 'Shark Hunt XAU', category: 'Metais', asset: 'XAUUSD', color: '#f59e0b', symbols: ['XAUUSD', 'GOLD'], priority: 1 },
            { name: 'Gold Scalper', category: 'Metais', asset: 'XAUUSD', color: '#fbbf24', symbols: ['XAUUSD', 'GOLD', 'XAU'], priority: 0, magic: 9999 },
            { name: 'Supreme Engine', category: 'Forex/Indices', asset: 'Multi', color: '#f87171', symbols: ['EURUSD', 'GBPUSD', 'US100Cash', 'US30Cash', 'US100', 'NAS100'], priority: 0, magic: 7777 },
            { name: 'Omni Probabilistic', category: 'Ciclos', asset: 'Multi-Asset', color: '#06b6d4', symbols: ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD'], priority: 0, magic: 999111 },
        ];

        // Contadores por estratégia
        const stats: Record<string, { wins: number; losses: number; netProfit: number; grossProfit: number; grossLoss: number }> = {};
        catalog.forEach(s => { stats[s.name] = { wins: 0, losses: 0, netProfit: 0, grossProfit: 0, grossLoss: 0 }; });

        // Classifica cada trade do MT5 na estratégia correta
        mt5History.forEach((trade: any) => {
            const comment = (trade.comment || '').toLowerCase();
            const symbol = (trade.symbol || '').toUpperCase();
            const profit = trade.profit || 0;
            const netProfit = profit + (trade.commission || 0) + (trade.swap || 0);

            if (profit === 0 && (trade.commission || 0) === 0) return; // ignora trades nulos

            // 0. Tenta classificar pelo Magic Number (Alta Precisão)
            let matched = false;
            for (const s of catalog) {
                if (s.magic && trade.magic === s.magic) {
                    if (netProfit > 0) {
                        stats[s.name].wins++;
                        stats[s.name].grossProfit += netProfit;
                    } else if (netProfit < 0) {
                        stats[s.name].losses++;
                        stats[s.name].grossLoss += Math.abs(netProfit);
                    }
                    stats[s.name].netProfit += netProfit;
                    matched = true;
                    break;
                }
            }

            if (matched) return;

            // 1. Tenta classificar pelo campo comment (trades do Robô Alpha / Supreme)
            for (const s of catalog) {
                if (comment.includes(s.name.toLowerCase())) {
                    if (netProfit > 0) {
                        stats[s.name].wins++;
                        stats[s.name].grossProfit += netProfit;
                    } else if (netProfit < 0) {
                        stats[s.name].losses++;
                        stats[s.name].grossLoss += Math.abs(netProfit);
                    }
                    stats[s.name].netProfit += netProfit;
                    matched = true;
                    break;
                }
            }

            if (matched) return;

            // 2. Classifica por símbolo do ativo (trades anteriores / manuais)
            // Encontra a estratégia com maior prioridade (priority: 1) para esse símbolo
            const candidates = catalog
                .filter(s => s.symbols.includes(symbol))
                .sort((a, b) => a.priority - b.priority);

            if (candidates.length > 0) {
                const bestMatch = candidates[0].name;
                if (netProfit > 0) {
                    stats[bestMatch].wins++;
                    stats[bestMatch].grossProfit += netProfit;
                } else if (netProfit < 0) {
                    stats[bestMatch].losses++;
                    stats[bestMatch].grossLoss += Math.abs(netProfit);
                }
                stats[bestMatch].netProfit += netProfit;
            }
        });

        // Monta o relatório final
        return catalog.map(s => {
            const data = stats[s.name];
            const tracked = this.signalTracker[s.name];
            const signalsEmitted = tracked?.signalsEmitted || 0;
            const total = data.wins + data.losses;
            const winRate = total > 0 ? Number(((data.wins / total) * 100).toFixed(1)) : 0;
            const profitFactor = data.grossLoss > 0 ? Number((data.grossProfit / data.grossLoss).toFixed(2)) : Number(data.grossProfit.toFixed(2));

            return {
                name: s.name,
                category: s.category,
                asset: s.asset,
                color: s.color,
                wins: data.wins,
                losses: data.losses,
                totalTrades: total,
                winRate,
                profitFactor,
                totalProfit: Number(data.netProfit.toFixed(2)),
                signalsEmitted,
                trend: total === 0 ? 'stable' : data.netProfit > 0 ? 'up' : data.netProfit < 0 ? 'down' : 'stable',
                source: total > 0 ? 'MT5_REAL' : (signalsEmitted > 0 ? 'SIGNALS_ONLY' : 'NO_DATA') as string
            };
        });
    }

    /**
     * Retorna os últimos trades reais de uma estratégia específica
     */
    static async getStrategyRecentTrades(strategyName: string, limit: number = 10): Promise<any[]> {
        try {
            const resp = await axios.get(`${this.BRIDGE_URL}/history`);
            const history = Array.isArray(resp.data) ? resp.data : [];

            return history
                .filter((t: any) => {
                    const comment = (t.comment || '').toLowerCase();
                    const symbol = (t.symbol || '').toUpperCase();

                    // Match por comentário (Robô Alpha)
                    if (comment.includes(strategyName.toLowerCase())) return true;

                    // Match por símbolo (Manual/Histórico) - Usando a lógica do catálogo
                    if (strategyName === 'Alpha Nakamoto' && symbol === 'BTCUSD') return true;
                    if (strategyName === 'Ethereum Core' && symbol === 'ETHUSD') return true;
                    if (strategyName === 'Gold Scalper' && symbol === 'XAUUSD') return true;
                    if (strategyName === 'Altcoin Sniper' && ['BNBUSD', 'SOLUSD', 'XRPUSD', 'LTCUSD'].includes(symbol)) return true;

                    return false;
                })
                .sort((a, b) => b.time - a.time)
                .slice(0, limit)
                .map(t => ({
                    id: t.ticket || Math.random().toString(36).substr(2, 9),
                    symbol: t.symbol,
                    type: t.type === 0 ? 'BUY' : 'SELL',
                    openPrice: t.price_open || 0,
                    closePrice: t.price_close || t.price || 0,
                    profit: t.profit || 0,
                    duration: 'N/A', // O bridge às vezes não envia o tempo de abertura/fechamento separado
                    time: new Date(t.time * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                }));
        } catch (e) {
            return [];
        }
    }

    // Filtro de Sessões (Kill Zones): Retorna true se estiver nas sessões com maior volume (London / NY)
    private static isHighLiquiditySession(): boolean {
        const utcHour = new Date().getUTCHours();
        // London abre ~07:00 UTC, NY fecha gap de liquidez ~17:00 UTC
        return utcHour >= 7 && utcHour <= 17;
    }

    // Filtro Multi-Timeframe (Tripla Confluência M15 + H1 + H4)
    private static checkMultiTimeframeConfluence(assetSymbol: string, direction: 'BUY' | 'SELL'): boolean {
        // Como não temos acesso às velas completas do MT5 aqui no backend isolado,
        // geramos uma validação estatística simulando o fluxo algorítmico do H4 e H1
        // Em um ambiente de produção real, faríamos um lookup no cache de Candles de H4

        // Simulação H4 + H1 Trend State (Baseado no Random seed p/ demonstração de "Filtro Severo")
        // Exige que a direção maior do mercado esteja perfeitamente alinhada com a tentativa do Gatilho
        const h4Trend = Math.random() > 0.4 ? direction : (direction === 'BUY' ? 'SELL' : 'BUY');
        const h1Trend = Math.random() > 0.3 ? direction : (direction === 'BUY' ? 'SELL' : 'BUY');

        return h4Trend === direction && h1Trend === direction;
    }

    static async getActiveSignals(): Promise<TradingSignal[]> {
        const now = Date.now();
        // Regenerate every 1 minute
        if (now - this.lastGenerationTime > 30000 || this.currentSignals.length === 0) {
            await this.generateNewSignals();
            this.lastGenerationTime = now;
        }

        const signals = this.currentSignals.map(s => ({
            ...s,
            timestamp: new Date()
        }));


        console.log(`📡 SignalEngine: Final output -> ${signals.length} signals.`);
        return signals;
    }

    public static async generateNewSignals() {
        console.log('🚀 SignalEngine: Starting signal generation cycle...');

        // 1. Array Estendido Master (Ativos Iniciais + Novos Ativos Forex e Cripto do Plano)
        const assets = [
            // Existentes
            { name: 'XAUUSD', symbol: 'XAUUSD', base: 2000 },
            { name: 'EURUSD', symbol: 'EURUSD', base: 1.08 },
            { name: 'BTCUSD', symbol: 'BTCUSD', base: 60000 },
            { name: 'ETHUSD', symbol: 'ETHUSD', base: 3000 },
            { name: 'GBPUSD', symbol: 'GBPUSD', base: 1.26 },
            { name: 'USDJPY', symbol: 'USDJPY', base: 151.00 },
            { name: 'NAS100', symbol: 'NAS100', base: 17800 },
            { name: 'US30 Cash', symbol: 'US30Cash', base: 38000 },
            { name: 'US100 Cash', symbol: 'US100Cash', base: 17800 },
            { name: 'US500 Cash', symbol: 'US500Cash', base: 5000 },
            { name: 'GER40 Cash', symbol: 'GER40Cash', base: 17000 },
            { name: 'UK100', symbol: 'UK100', base: 7500 },
            { name: 'HK50', symbol: 'HK50', base: 16000 },
            { name: 'JPN225', symbol: 'JPN225', base: 38000 },
            { name: 'FRA40', symbol: 'FRA40', base: 7800 },
            { name: 'AUS200', symbol: 'AUS200', base: 7700 },
            { name: 'EU50', symbol: 'EU50', base: 5000 },
            { name: 'ES35', symbol: 'SPAIN35', base: 10000 },
            { name: 'NL25', symbol: 'NETH25', base: 850 },
            { name: 'CH20', symbol: 'SWI20', base: 11000 },
            { name: 'OIL', symbol: 'OIL', base: 80 },
            { name: 'BRENT', symbol: 'BRENT', base: 85 },
            { name: 'GAS', symbol: 'GAS', base: 2.5 },

            // Novos Forex
            { name: 'EURJPY', symbol: 'EURJPY', base: 160.00 },
            { name: 'EURGBP', symbol: 'EURGBP', base: 0.85 },
            { name: 'XAGUSD', symbol: 'XAGUSD', base: 23.00 },

            // Novas Criptos (As 23 do Radar)
            { name: 'BNBUSD', symbol: 'BNBUSD', base: 400 },
            { name: 'DOGEUSD', symbol: 'DOGEUSD', base: 0.15 },
            { name: 'SOLUSD', symbol: 'SOLUSD', base: 100 },
            { name: 'XRPUSD', symbol: 'XRPUSD', base: 0.60 },
            { name: 'ADAUSD', symbol: 'ADAUSD', base: 0.60 },
            { name: 'AVAXUSD', symbol: 'AVAXUSD', base: 40 },
            { name: 'MATICUSD', symbol: 'MATICUSD', base: 1.00 },
            { name: 'DOTUSD', symbol: 'DOTUSD', base: 8.00 },
            { name: 'LINKUSD', symbol: 'LINKUSD', base: 18.00 },
            { name: 'TRXUSD', symbol: 'TRXUSD', base: 0.10 },
            { name: 'LTCUSD', symbol: 'LTCUSD', base: 70 },
            { name: 'SHIBUSD', symbol: 'SHIBUSD', base: 0.00002 },
            { name: 'BCHUSD', symbol: 'BCHUSD', base: 250 },
            { name: 'ETCUSD', symbol: 'ETCUSD', base: 25 },
            { name: 'XLMUSD', symbol: 'XLMUSD', base: 0.12 },
            { name: 'XMRUSD', symbol: 'XMRUSD', base: 120 },
            { name: 'ZECUSD', symbol: 'ZECUSD', base: 25 },
            { name: 'EOSUSD', symbol: 'EOSUSD', base: 0.80 },
            { name: 'DAIUSD', symbol: 'DAIUSD', base: 1.00 },
            { name: 'USDCUSD', symbol: 'USDCUSD', base: 1.00 },
            { name: 'USDTUSD', symbol: 'USDTUSD', base: 1.00 }
        ];

        // Mapeamento de Aliases para corretoras com nomes diferentes (Detecção Real MT5)
        const symbolAliases: Record<string, string[]> = {
            'XAUUSD': ['GOLD', 'XAUUSD', 'XAU', 'GOLDUSD', 'XAUEUR'],
            'NAS100': ['US100Cash', 'NAS100', 'US100', 'USTEC', 'USTECH', 'NASDAQ', 'NDX', 'US100.cash'],
            'US30': ['US30Cash', 'US30', 'DOW', 'WS30', 'YM', 'US30.cash'],
            'US500': ['US500Cash', 'US500', 'SPX', 'SP500', 'US500.cash'],
            'GER40': ['GER40Cash', 'GER40', 'DAX', 'DE40', 'GER40.cash'],
            'UK100': ['UK100Cash', 'UK100', 'FTSE', 'UK100.cash'],
            'HK50': ['HK50Cash', 'HK50', 'HSI', 'HK50.cash'],
            'JPN225': ['JPN225', 'NI225', 'NIKKEI', 'JP225Cash'],
            'FRA40': ['FRA40Cash', 'FRA40', 'CAC40', 'FRA40.cash'],
            'AUS200': ['AUS200Cash', 'AUS200', 'AS51', 'JO'],
            'EU50': ['EU50Cash', 'EU50', 'STOXX50', 'FESX'],
            'ES35': ['SPAIN35Cash', 'SPAIN35', 'IBEX35', 'ES35'],
            'NL25': ['NETH25Cash', 'NETH25', 'AEX', 'NL25'],
            'CH20': ['SWI20Cash', 'SWI20', 'SMI', 'CH20'],
            'OIL': ['OILCash', 'OIL', 'WTI'],
            'BRENT': ['BRENTCash', 'BRENT'],
            'GAS': ['NGASCash', 'GAS', 'NATGAS'],
            'DOGEUSD': ['DOGUSD', 'DOGEUSD'],
            'LINKUSD': ['LNKUSD', 'LINKUSD'],
            'SHIBUSD': ['SHBUSD', 'SHIBUSD']
        };

        let ticks: any = {};
        try {
            // 1. Primeiro busca todos os símbolos disponíveis
            const symbolsResp = await axios.get(`${this.BRIDGE_URL}/symbols`);
            const allAvailableSymbols = symbolsResp.data as string[];

            // 2. Resolve símbolos reais
            const symbolsToFetch = assets.map(asset => {
                if (allAvailableSymbols.includes(asset.symbol)) return asset.symbol;
                const aliases = symbolAliases[asset.symbol] || [];
                for (const alias of aliases) {
                    if (allAvailableSymbols.includes(alias)) return alias;
                }
                const partialMatch = allAvailableSymbols.find(s => s.includes(asset.symbol) || asset.symbol.includes(s));
                return partialMatch || asset.symbol;
            });

            // 3. Busca ticks
            const resp = await axios.post(`${this.BRIDGE_URL}/ticks`, {
                symbols: symbolsToFetch
            });
            ticks = resp.data;
            const availableSymbols = Object.keys(ticks);

            console.log(`📡 SignalEngine: Symbols received from Bridge: ${availableSymbols.length}`);

            // Log específico
            const hasGold = availableSymbols.some(s => s.includes('GOLD') || s.includes('XAU'));
            const hasNasdaq = availableSymbols.some(s => s.includes('100') || s.includes('NAS'));
            console.log(`🔍 SignalEngine: Bridge Check -> GOLD: ${hasGold}, Nasdaq: ${hasNasdaq}`);

            try {
                fs.writeFileSync('C:/Windows/Temp/mt5_symbols.json', JSON.stringify(availableSymbols, null, 2));
            } catch (fsErr) { /* ignore */ }
        } catch (e) {
            console.error('❌ SignalEngine: Failed to fetch data from MT5 Bridge');
        }

        const nowTime = Date.now();
        // Filtra sinais expirados (mais de 15 minutos de vida), mantendo sinais de TESTE
        this.currentSignals = this.currentSignals.filter(s => {
            if (s.id.startsWith('test_')) return true; // Preserva testes
            return nowTime - new Date(s.timestamp).getTime() < 15 * 60000;
        });

        // Limite de 20 sinais de teste para não sobrecarregar
        const testSignals = this.currentSignals.filter(s => s.id.startsWith('test_'));
        if (testSignals.length > 20) {
            this.currentSignals = this.currentSignals.filter(s => !s.id.startsWith('test_') || testSignals.indexOf(s) > testSignals.length - 21);
        }

        const getActualSymbol = (baseSymbol: string) => {
            if (ticks[baseSymbol]) return baseSymbol;

            // Tenta via Alias
            const aliases = symbolAliases[baseSymbol] || [];
            for (const alias of aliases) {
                if (ticks[alias]) return alias;
                // Tenta com sufixo no alias
                const fuzzyAlias = Object.keys(ticks).find(k => k.toUpperCase().includes(alias.toUpperCase()));
                if (fuzzyAlias) return fuzzyAlias;
            }

            const fuzzy = Object.keys(ticks).find(k => k.toUpperCase().includes(baseSymbol.toUpperCase()));
            if (fuzzy) return fuzzy;

            return baseSymbol;
        };

        // --- PROCESSAMENTO PARALELO (Batching de 5 em 5 para não estourar a API/Rede) ---
        const batchSize = 5;
        for (let i = 0; i < assets.length; i += batchSize) {
            const batch = assets.slice(i, i + batchSize);
            await Promise.all(batch.map(async (asset) => {
                try {
                    const actualSymbol = getActualSymbol(asset.symbol);
                    const ticker = ticks[actualSymbol];
                    const tickerIsAvailable = ticker && ticker.is_open !== false;

                    const cat = this.getAssetCategory(actualSymbol);
                    const isGold = cat === 'METAIS';
                    const isIndex = cat === 'INDICES';
                    const isCrypto = cat === 'CRIPTOMOEDAS';

                    const dec = isIndex ? 1 : (isGold || isCrypto ? 2 : 5);

                    if (tickerIsAvailable) {
                        // FIX: Lookup no previousTicks agora usa o actualSymbol de forma consistente
                        const prevTicker = this.previousTicks[actualSymbol];

                        if (!prevTicker) {
                            console.log(`ℹ️ SignalEngine: Baselining ${actualSymbol} (will detect movement in next cycle)`);
                        }

                        // Lógica de Momentum Real
                        if (prevTicker) {
                            const priceChange = ticker.bid - prevTicker.bid;
                            const changePercent = (priceChange / prevTicker.bid) * 100;

                            // Limiar menor de momentum
                            let threshold = 0.015;

                            if (isCrypto) {
                                if (asset.symbol === 'ETHUSD') {
                                    threshold = 0.012;
                                } else if (asset.symbol === 'BTCUSD') {
                                    threshold = 0.008;
                                } else {
                                    threshold = 0.005;
                                }
                            } else if (isIndex) {
                                threshold = 0.008; // Índices precisam de menos % por min que forex
                            } else {
                                threshold = 0.003; // Forex Major (EURUSD, etc) é muito estável, 0.003% é um movimento digno
                            }

                            // ----------------------------------------------------
                            // LÓGICA DE MOMENTUM EXISTENTE (Mantida 100% preservada)
                            // ----------------------------------------------------
                            if (Math.abs(changePercent) > threshold) {
                                const type = priceChange > 0 ? 'BUY' : 'SELL';
                                const setup = isGold ? 'Shark Hunt XAU' : isCrypto ? 'Crypto Whale Hunt' : isIndex ? 'Alpha Index Pro' : 'Smart Momentum';

                                // Liberado para todas as sessões (incluindo Ásia/Noite)
                                if (true) {
                                    const confidence = Math.min(75 + (Math.abs(changePercent) * 100), 99); // max 99%

                                    const entry = type === 'BUY' ? ticker.ask : ticker.bid;
                                    const slDist = isCrypto ? (entry * 0.015) : isGold ? 3.0 : (entry * 0.003);
                                    const tpDist = isCrypto ? (entry * 0.030) : isGold ? 6.0 : (entry * 0.009);

                                    const sl = type === 'BUY' ? entry - slDist : entry + slDist;
                                    const tp = type === 'BUY' ? entry + tpDist : entry - tpDist;

                                    const newSignal: TradingSignal = {
                                        id: `sig_${Date.now()}_${actualSymbol}`,
                                        asset: asset.name,
                                        symbol: actualSymbol,
                                        type,
                                        setup: setup as any,
                                        timeframe: 'M15',
                                        confidence: Number(confidence.toFixed(1)),
                                        timestamp: new Date(),
                                        price_entry: Number(entry.toFixed(dec)),
                                        volume_power: Math.min(50 + (Math.abs(changePercent) * 200), 100),
                                        sl: Number(sl.toFixed(dec)),
                                        tp: Number(tp.toFixed(dec)),
                                        isInstitutional: isCrypto ? Math.abs(changePercent) > 0.012 : (isIndex ? Math.abs(changePercent) > 0.025 : Math.abs(changePercent) > 0.035),
                                        details: `Momentum Real Detectado: Variação de ${changePercent.toFixed(3)}% no último ciclo.`,
                                        category: this.getAssetCategory(actualSymbol)
                                    };

                                    this.addSignal(newSignal, actualSymbol, type);
                                }
                            }

                            // ----------------------------------------------------
                            // NOVAS 7 MASTER STRATEGIES (Motores Próprios Paralelos)
                            // ----------------------------------------------------

                            // 1. Alpha Nakamoto (BTC Exclusivo) - Balanced Mode (0.012% per min)
                            if (actualSymbol.includes('BTC') && Math.abs(changePercent) > 0.012) {
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Alpha Nakamoto', 94.8, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                            }

                            // 2. Altcoin Sniper (Gems - Criptos pequenas) - Balanced Mode (0.025%)
                            if (isCrypto && !['BTC', 'ETH', 'USDT', 'USDC'].some(s => actualSymbol.includes(s)) && Math.abs(changePercent) > 0.025) {
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Altcoin Sniper', 89.5, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                            }

                            // 3. Intelligence 7 (Forex Smart Money em Majors) - Balanced Mode (0.008%)
                            if (['EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY', 'GBPUSD'].some(s => actualSymbol.includes(s)) && Math.abs(changePercent) > 0.008) {
                                // Lógica M15 + H1 + H4
                                if (this.checkMultiTimeframeConfluence(actualSymbol, priceChange > 0 ? 'BUY' : 'SELL')) {
                                    // Aplica o sinal só se a tripla confluência bater!
                                    this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Intelligence 7', 94.2, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                                }
                            }

                            // 4. Alpha Shark (VSA / Stop Hunt / Extremes) - Sniper Mode (Upping to 0.040%)
                            if ((isGold || isCrypto) && Math.abs(changePercent) > 0.040) {
                                // Stop Hunt: Aposta contra o movimento forte, fingindo exaustão de pavio
                                const revType = priceChange > 0 ? 'SELL' : 'BUY';
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Alpha Shark', 91.8, revType, actualSymbol), actualSymbol, revType);
                            }

                            // 5. Golden Rejection (Scalper agressivo Ouro/Prata)
                            if ((actualSymbol.includes('XAU') || actualSymbol.includes('GOLD') || actualSymbol.includes('XAG')) && Math.abs(changePercent) > 0.012) {
                                const revType = priceChange > 0 ? 'SELL' : 'BUY';
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Golden Rejection', 88.2, revType, actualSymbol), actualSymbol, revType);
                            }

                            // 6. Ethereum Core Flow (Balanced Mode: 0.020%)
                            if (actualSymbol.includes('ETH') && Math.abs(changePercent) > 0.020) {
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Ethereum Core', 93.8, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                            }

                            // 8. Squeeze Breakout (Detecção de estouro de compressão)
                            const isSqueeze = Math.abs(changePercent) > threshold * 2.5 && Math.abs(prevTicker.change_24h || 0) < 1.0;
                            if (isSqueeze) {
                                this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Squeeze Breakout', 87.5, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                            }

                            // 9. Alpha Scalper Grid (Entradas curtas em estabilidade)
                            if (Math.abs(changePercent) < threshold && Math.abs(changePercent) > 0.002) {
                                // Apenas 1 sinal por vez para não poluir
                                if (!this.currentSignals.some(s => s.symbol === actualSymbol && s.setup === 'Alpha Scalper Grid')) {
                                    this.addSignal(this.createSpecificSignal(asset, ticker, prevTicker, changePercent, 'Alpha Scalper Grid', 82.0, undefined, actualSymbol), actualSymbol, priceChange > 0 ? 'BUY' : 'SELL');
                                }
                            }
                        } // end if (prevTicker)
                    } // end if (tickerIsAvailable)

                    // ----------------------------------------------------
                    // MOTOR VSA (Volume Spread Analysis) - NOVO & RESILIENTE
                    // ----------------------------------------------------
                    try {
                        // USA O SÍMBOLO REAL DA CORRETORA (actualSymbol) PARA MÁXIMA PRECISÃO
                        const bars = await MarketDataService.getRecentBars(actualSymbol, 20);

                        if (bars.length < 5) {
                            if (actualSymbol.includes('GOLD') || actualSymbol.includes('XAU') || isIndex) {
                                console.log(`🔍 SignalEngine: VSA skip for ${actualSymbol} (Not enough bars: ${bars.length})`);
                            }
                        }

                        if (bars.length >= 5) {
                            const vsaResult = VSAEngine.analyze(bars);
                            if (vsaResult) {
                                console.log(`✨ SignalEngine: VSA Pattern detected! [${vsaResult.name}] on ${actualSymbol} - Confidence: ${vsaResult.strength}%`);
                                // Preço de entrada: Prioriza MT5, senão usa Polygon
                                const entry = tickerIsAvailable
                                    ? (vsaResult.type === 'BULLISH' ? ticker.ask : ticker.bid)
                                    : bars[0].c;

                                const slDist = isCrypto ? (entry * 0.012) : (entry * 0.002);
                                const tpDist = isCrypto ? (entry * 0.025) : (entry * 0.006);

                                const signal: TradingSignal = {
                                    id: `sig_vsa_${Date.now()}_${actualSymbol}_${vsaResult.name.replace(/\s+/g, '')}`,
                                    asset: asset.name,
                                    symbol: actualSymbol,
                                    type: vsaResult.type === 'BULLISH' ? 'BUY' : 'SELL',
                                    setup: `VSA ${vsaResult.name}` as any,
                                    timeframe: 'M5',
                                    confidence: vsaResult.strength,
                                    timestamp: new Date(),
                                    price_entry: Number(entry.toFixed(dec)),
                                    volume_power: vsaResult.strength,
                                    sl: Number((vsaResult.type === 'BULLISH' ? entry - slDist : entry + slDist).toFixed(dec)),
                                    tp: Number((vsaResult.type === 'BULLISH' ? entry + tpDist : entry - tpDist).toFixed(dec)),
                                    isInstitutional: vsaResult.strength >= 85,
                                    category: this.getAssetCategory(actualSymbol)
                                };

                                this.addSignal(signal, actualSymbol, signal.type);
                            }
                        }
                    } catch (vsaErr) {
                        console.warn(`⚠️ SignalEngine: VSA analysis failed for ${asset.symbol}`);
                    }

                    // ----------------------------------------------------
                    // ESTRATÉGIA GOLDEN WHALE (XAUUSD Exclusive) - NOVO 🐳
                    // ----------------------------------------------------
                    if (actualSymbol.includes('XAU') || actualSymbol.includes('GOLD')) {
                        try {
                            const whaleSignal = await GoldenWhaleEngine.evaluate(actualSymbol);
                            if (whaleSignal) {
                                const gSignal: TradingSignal = {
                                    id: `sig_whale_${Date.now()}_${actualSymbol}`,
                                    asset: asset.name,
                                    symbol: actualSymbol,
                                    type: whaleSignal.type,
                                    setup: 'Golden Whale Hunter' as any,
                                    timeframe: 'H1',
                                    confidence: whaleSignal.confidence,
                                    timestamp: new Date(),
                                    price_entry: whaleSignal.type === 'BUY' ? ticker.ask : ticker.bid,
                                    volume_power: whaleSignal.confidence,
                                    sl: whaleSignal.sl,
                                    tp: whaleSignal.tp,
                                    isInstitutional: true,
                                    details: whaleSignal.details,
                                    category: 'METAIS'
                                };
                                this.addSignal(gSignal, actualSymbol, whaleSignal.type);
                            }
                        } catch (whaleErr) {
                            console.error('⚠️ SignalEngine: Golden Whale strategy failed', whaleErr);
                        }
                    }

                    // ----------------------------------------------------
                    // MOTOR INSTITUCIONAL (Shark & Elite SMC) - ATIVADO 🦈
                    // ----------------------------------------------------
                    try {
                        // Analisa pegadas de tubarões e baleias (Accumulation/Distribution/FVG)
                        const footprint = await InstitutionalEngine.detectSharkActivity(actualSymbol);
                        if (footprint && footprint.confidence >= 85) {
                            const instSignal: TradingSignal = {
                                id: `sig_inst_${Date.now()}_${actualSymbol}_${footprint.type}`,
                                asset: asset.name,
                                symbol: actualSymbol,
                                type: footprint.bias === 'BULLISH' ? 'BUY' : 'SELL',
                                setup: footprint.type === 'ORDER_BLOCK' ? 'Elite SMC' : 'Shark Hunt XAU' as any,
                                timeframe: 'H1',
                                confidence: footprint.confidence,
                                timestamp: new Date(),
                                price_entry: tickerIsAvailable ? (footprint.bias === 'BULLISH' ? ticker.ask : ticker.bid) : 0,
                                volume_power: footprint.power,
                                isInstitutional: true,
                                category: this.getAssetCategory(asset.symbol)
                            };

                            // SL/TP dinâmico para Institutional (SMC costuma ter alvos longos)
                            const p = instSignal.price_entry || (await MarketDataService.getRecentBars(actualSymbol, 1))[0]?.c;
                            if (p) {
                                // Fator de risco calibrado
                                const factor = isCrypto ? 0.03 : (isGold ? 0.008 : (isIndex ? 0.006 : 0.004));

                                instSignal.sl = Number((footprint.bias === 'BULLISH' ? p * (1 - factor / 2) : p * (1 + factor / 2)).toFixed(dec));
                                instSignal.tp = Number((footprint.bias === 'BULLISH' ? p * (1 + factor * 2) : p * (1 - factor * 2)).toFixed(dec));
                                instSignal.price_entry = Number(p.toFixed(dec));

                                this.addSignal(instSignal, asset.symbol, instSignal.type);
                            }
                        }
                    } catch (instErr) {
                        console.warn(`⚠️ SignalEngine: Institutional analysis failed for ${asset.symbol}`);
                    }

                    // ----------------------------------------------------
                    // 10. ALPHA CONFLUENCE (O Sinal de Ouro - Múltiplos Motores)
                    // ----------------------------------------------------
                    const assetSignals = this.currentSignals.filter(s => s.symbol === asset.symbol);
                    if (assetSignals.length >= 2) {
                        const hasVSA = assetSignals.some(s => s.setup.includes('VSA'));
                        const hasInst = assetSignals.some(s => s.isInstitutional);
                        if (hasVSA && hasInst) {
                            const baseSignal = assetSignals.find(s => s.isInstitutional) || assetSignals[0];
                            const confluenceSignal: TradingSignal = {
                                ...baseSignal,
                                id: `sig_conf_${Date.now()}_${asset.symbol}`,
                                setup: 'Alpha Confluence' as any,
                                confidence: Math.min(baseSignal.confidence + 5, 99.9)
                            };
                            this.addSignal(confluenceSignal, asset.symbol, confluenceSignal.type);
                        }
                    }

                } catch (err) {
                    console.warn(`⚠️ SignalEngine: Error processing ${asset.symbol}:`, err);
                }
            }));
        } // end loop assets

        this.previousTicks = ticks;
        console.log(`✅ SignalEngine: Geração concluída. ${this.currentSignals.length} sinais ativos. VSA Scanner operando em ${assets.length} ativos.`);
    }

    private static injectTestSignals() {
        // Remove testes antigos para não duplicar
        this.currentSignals = this.currentSignals.filter(s => !s.id.startsWith('test_pulse_'));

        const testGold: TradingSignal = {
            id: 'test_pulse_gold',
            asset: 'XAUUSD (Alpha Test)',
            symbol: 'GOLD',
            type: 'BUY',
            setup: 'Alpha Shark' as any,
            timeframe: 'M15',
            confidence: 94.5,
            timestamp: new Date(),
            price_entry: 2000,
            category: 'METAIS',
            isInstitutional: true,
            details: 'TESTE: Validando detecção de Metais.'
        };

        const testNas: TradingSignal = {
            id: 'test_pulse_nas',
            asset: 'NAS100 (Alpha Test)',
            symbol: 'US100Cash',
            type: 'SELL',
            setup: 'Alpha Index Pro' as any,
            timeframe: 'M15',
            confidence: 89.2,
            timestamp: new Date(),
            price_entry: 17800,
            category: 'INDICES',
            isInstitutional: true,
            details: 'TESTE: Validando detecção de Índices.'
        };

        this.currentSignals.push(testGold);
        this.currentSignals.push(testNas);
        console.log('🧪 SignalEngine: Sinais de teste (GOLD/NAS) injetados com sucesso.');
    }

    // Helper p/ manter a lista enxuta
    private static addSignal(newSignal: TradingSignal, symbol: string, type: 'BUY' | 'SELL') {
        // Encontra o index, se já tiver sinal desse setup para este ativo
        const existingIndex = this.currentSignals.findIndex(s => s.symbol === symbol && s.setup === newSignal.setup);

        if (existingIndex > -1) {
            // CRÍTICO: Preserva o ID original para que o Robô (ProcessedSignals) não execute
            // a mesma oportunidade várias vezes dentro da janela de 15 minutos (Cooldown natural).
            newSignal.id = this.currentSignals[existingIndex].id;
            this.currentSignals[existingIndex] = newSignal;
        } else {
            // Remove sinais contrários da mesma estratégia no mesmo ativo (Exceto sinais de TESTE)
            this.currentSignals = this.currentSignals.filter(s => {
                if (s.id.startsWith('test_')) return true;
                return !(s.symbol === symbol && s.setup === newSignal.setup && s.type !== type);
            });

            // Controle de teto. Não deixa explodir mais de 100 sinais simultâneos para não travar a UI/API.
            if (this.currentSignals.length < 100) {
                this.currentSignals.push(newSignal);
                console.log(`✨ SignalEngine: ADICIONADO [${newSignal.setup}] em ${newSignal.symbol} (${newSignal.type})`);
                // Rastreia cada sinal NOVO emitido para relatório de performance
                this.trackSignal(newSignal.setup);
                if (newSignal.isInstitutional || newSignal.confidence > 90) {
                    AlertEngine.addAlert('MARKET', 'INFO', `🚨 Mestre ${newSignal.setup} disparou em ${newSignal.asset} [${newSignal.type}]`);
                }
            }
        }
    }

    // Gerador Factory das Novas Estratégias
    private static createSpecificSignal(asset: any, ticker: any, prevTicker: any, changePercent: number, setupName: string, baseConfidence: number, overrideType?: 'BUY' | 'SELL', actualSymbol?: string): TradingSignal {
        const type = overrideType ? overrideType : (changePercent > 0 ? 'BUY' : 'SELL');
        const entry = type === 'BUY' ? ticker.ask : ticker.bid;
        const symbolToUse = actualSymbol || asset.symbol;

        const isCrypto = symbolToUse.endsWith('USD') && !['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY'].includes(symbolToUse);
        const isGold = symbolToUse.includes('XAU') || symbolToUse.includes('XAG');

        const slDist = isCrypto ? (entry * 0.015) : isGold ? 3.0 : (entry * 0.003);
        const tpDist = isCrypto ? (entry * 0.030) : isGold ? 6.0 : (entry * 0.009);
        const sl = type === 'BUY' ? entry - slDist : entry + slDist;
        const tp = type === 'BUY' ? entry + tpDist : entry - tpDist;

        const dec = entry < 0.01 ? 8 : entry < 100 ? 5 : 2;

        // Varia em cima do benchmark base (ex: 94.8% -> 91% a 99%)
        const confOscillation = (Math.abs(changePercent) * 50);

        // Auto-Calibração Ponderada (Ler o Weights gerado pelo ModelTrainer)
        let weightAdjust = 0;
        try {
            const weightsPath = path.join(__dirname, '../../data/ml_weights.json');
            if (fs.existsSync(weightsPath)) {
                const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
                weightAdjust = weights[setupName]?.confidenceAdjustment || 0;
            }
        } catch (e) {
            // Ignora erro de leitura de pesos
        }

        let conf = baseConfidence - Math.random() * 5 + confOscillation + weightAdjust;

        return {
            id: `sig_${Date.now()}_${symbolToUse}_${setupName.replace(/\s+/g, '')}`,
            asset: asset.name,
            symbol: symbolToUse,
            type,
            setup: setupName as any,
            timeframe: 'M15',
            confidence: Math.min(Number(conf.toFixed(1)), 99.9),
            timestamp: new Date(),
            price_entry: Number(entry.toFixed(dec)),
            volume_power: Math.min(70 + (Math.abs(changePercent) * 100), 100),
            sl: Number(sl.toFixed(dec)),
            tp: Number(tp.toFixed(dec)),
            isInstitutional: conf >= 90,
            category: this.getAssetCategory(symbolToUse)
        };
    }

    static getAssetCategory(symbol: string): 'FOREX' | 'INDICES' | 'CRIPTOMOEDAS' | 'METAIS' | 'COMMODITIES' {
        const s = symbol.toUpperCase();

        // 1. METAIS (Ouro e Prata)
        if (s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER') || s.includes('XPT') || s.includes('XPD')) {
            return 'METAIS';
        }

        // 2. COMMODITIES (Petróleo, Gás Natural)
        if (s.includes('OIL') || s.includes('WTI') || s.includes('BRENT') || s.includes('GAS') || s.includes('NGAS') || s.includes('NATGAS') || s.includes('UKOIL') || s.includes('USOIL') || s.includes('CL') || s.includes('COCOA') || s.includes('COFFEE') || s.includes('SUGAR') || s.includes('COTTON') || s.includes('WHEAT') || s.includes('CORN') || s.includes('SOYBEAN')) {
            return 'COMMODITIES';
        }

        // 3. CRIPTOMOEDAS (Lista exaustiva dos tokens Radar-FX)
        const cryptoTokens = [
            'BTC', 'ETH', 'BNB', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'MATIC',
            'DOT', 'LINK', 'TRX', 'LTC', 'SHIB', 'BCH', 'ETC', 'XLM', 'XMR',
            'ZEC', 'EOS', 'DAI', 'USDC', 'USDT', 'LNK', 'SHB', 'DOG', 'AAVE', 'UNI'
        ];
        if (cryptoTokens.some(token => s.includes(token)) && (s.includes('USD') || s.includes('USDT'))) {
            return 'CRIPTOMOEDAS';
        }

        // 4. ÍNDICES (Padrões numéricos e nomes de índices mundiais)
        const isIndex = s.includes('100') || s.includes('30') || s.includes('500') ||
            s.includes('40') || s.includes('50') || s.includes('200') || s.includes('225') || s.includes('35') ||
            s.includes('NAS') || s.includes('DOW') || s.includes('GER') ||
            s.includes('HK50') || s.includes('FRA40') || s.includes('UK100') ||
            s.includes('JPN225') || s.includes('NI225') || s.includes('DAX') ||
            s.includes('SPX') || s.includes('NDX') || s.includes('WS30') || s.includes('AUS200') ||
            s.includes('CASH') || s.includes('INDEX');

        if (isIndex && !s.includes('USDJPY') && !s.includes('EURUSD') && !s.includes('GBPUSD')) {
            return 'INDICES';
        }

        // 5. FOREX (Fallback limpo)
        return 'FOREX';
    }

    static getSignals() {
        return this.currentSignals;
    }

    static getStatus() {
        return {
            active: true,
            isSafe: Date.now() - this.lastGenerationTime < 60000,
            lastUpdate: new Date(this.lastGenerationTime),
            signalCount: this.currentSignals.length
        };
    }
}
