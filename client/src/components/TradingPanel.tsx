import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    TrendingUp, TrendingDown, Star, DollarSign,
    Bitcoin, Globe, BarChart3, Minus, Plus,
    ArrowUpRight, ArrowDownRight, Activity, Loader2,
    ArrowUp, ArrowDown, Clock, ShieldAlert, CheckCircle2, AlertCircle,
    Zap, Target, Eye, History, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface Instrument {
    symbol: string;
    name: string;
    category: string;
    icon?: 'gold' | 'crypto' | 'index' | 'forex';
}

interface TickData {
    bid: number;
    ask: number;
    is_open: boolean;
    change?: number;
    changePercent?: number;
    changePercent5m?: number;
    changePercent1h?: number;
}

interface SentimentData {
    symbol: string;
    institutionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    emotion: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
    score: number;
    strength: number;
    source: string;
}

const INSTRUMENTS: Instrument[] = [
    // Forex
    { symbol: 'EURUSD', name: 'EUR/USD', category: 'Moedas', icon: 'forex' },
    { symbol: 'GBPUSD', name: 'GBP/USD', category: 'Moedas', icon: 'forex' },
    { symbol: 'USDJPY', name: 'USD/JPY', category: 'Moedas', icon: 'forex' },
    { symbol: 'AUDUSD', name: 'AUD/USD', category: 'Moedas', icon: 'forex' },
    { symbol: 'USDCAD', name: 'USD/CAD', category: 'Moedas', icon: 'forex' },
    { symbol: 'NZDUSD', name: 'NZD/USD', category: 'Moedas', icon: 'forex' },
    { symbol: 'USDCHF', name: 'USD/CHF', category: 'Moedas', icon: 'forex' },
    { symbol: 'EURGBP', name: 'EUR/GBP', category: 'Moedas', icon: 'forex' },
    { symbol: 'EURJPY', name: 'EUR/JPY', category: 'Moedas', icon: 'forex' },
    { symbol: 'GBPJPY', name: 'GBP/JPY', category: 'Moedas', icon: 'forex' },
    // Metais
    { symbol: 'GOLD', name: 'Ouro (XAUUSD)', category: 'Metais', icon: 'gold' },
    { symbol: 'XAGUSD', name: 'Prata (XAGUSD)', category: 'Metais', icon: 'gold' },
    // Crypto
    { symbol: 'BTCUSD', name: 'BTC/USD', category: 'Criptomoedas', icon: 'crypto' },
    { symbol: 'ETHUSD', name: 'ETH/USD', category: 'Criptomoedas', icon: 'crypto' },
    { symbol: 'SOLUSD', name: 'SOL/USD', category: 'Criptomoedas', icon: 'crypto' },
    // Índices
    { symbol: 'US100Cash', name: 'NASDAQ 100', category: 'Índices', icon: 'index' },
    { symbol: 'US30Cash', name: 'Dow Jones', category: 'Índices', icon: 'index' },
    { symbol: 'US500', name: 'S&P 500', category: 'Índices', icon: 'index' },
    { symbol: 'GER40Cash', name: 'DAX 40', category: 'Índices', icon: 'index' },
];

const getInstrumentIcon = (icon?: string) => {
    switch (icon) {
        case 'forex':
            return <DollarSign size={16} className="text-indigo-400" />;
        case 'gold':
            return <Star size={16} className="text-yellow-400" />;
        case 'crypto':
            return <Bitcoin size={16} className="text-orange-400" />;
        case 'index':
            return <BarChart3 size={16} className="text-cyan-400" />;
        default:
            return <Globe size={16} className="text-slate-400" />;
    }
};

function TradeLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="trg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="trglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#trg)" strokeWidth="2" filter="url(#trglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#trg)" fontSize="18" fontWeight="900" fontStyle="italic" filter="url(#trglow)">T</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#trg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

const CATEGORIES = ['Todos', 'Moedas', 'Metais', 'Criptomoedas', 'Índices'];

export const TradingPanel: React.FC = () => {
    const [ticks, setTicks] = useState<Record<string, TickData>>({});
    const [prevTicks, setPrevTicks] = useState<Record<string, TickData>>({});
    const [sentiments, setSentiments] = useState<Record<string, SentimentData>>({});
    const [candleTime, setCandleTime] = useState(300);
    const [volumes, setVolumes] = useState<Record<string, number>>({});
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [orderResult, setOrderResult] = useState<{ symbol: string; success: boolean; message: string } | null>(null);
    const [isDisciplineLocked, setIsDisciplineLocked] = useState(false);
    const [disciplineReason, setDisciplineReason] = useState<string | null>(null);
    const [executedTrades, setExecutedTrades] = useState<any[]>([]);
    const isExecutingRef = useRef(false);
    const ticksRef = useRef<Record<string, TickData>>({});

    useEffect(() => {
        ticksRef.current = ticks;
    }, [ticks]);

    // Inicializar volumes padrão
    useEffect(() => {
        const defaultVols: Record<string, number> = {};
        INSTRUMENTS.forEach(inst => {
            if (['NAS100', 'US30', 'US500', 'GER40', 'US100Cash', 'US30Cash', 'GER40Cash'].includes(inst.symbol)) {
                defaultVols[inst.symbol] = 1.0;
            } else if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'GOLD', 'XAGUSD'].includes(inst.symbol)) {
                defaultVols[inst.symbol] = 0.02;
            } else {
                defaultVols[inst.symbol] = 0.02;
            }
        });
        setVolumes(defaultVols);
    }, []);

    // Buscar ticks em tempo real
    const fetchTicks = useCallback(async () => {
        try {
            const symbols = INSTRUMENTS.map(i => i.symbol);
            const resp = await axios.post('/api/mt5/ticks', { symbols });
            const newData = resp.data;

            setTicks(current => {
                setPrevTicks(current);
                return newData;
            });
        } catch (error) {
            // Fallback
        }
    }, []);

    const fetchSentiments = useCallback(async () => {
        try {
            const symbolsInfo = INSTRUMENTS.map(i => {
                const tick = ticksRef.current[i.symbol];
                return {
                    symbol: i.symbol,
                    change: (tick as any)?.changePercent || 0
                };
            });
            const [sentResp, discResp] = await Promise.all([
                axios.post('/api/mt5/sentiment', { symbols: symbolsInfo }),
                axios.get('/api/mt5/discipline')
            ]);
            setSentiments(sentResp.data);
            setIsDisciplineLocked(discResp.data.isLocked);
            setDisciplineReason(discResp.data.reason);
        } catch (error) { }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const seconds = 300 - (Math.floor(Date.now() / 1000) % 300);
            setCandleTime(seconds);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchTicks();
        fetchSentiments();
        const tickInterval = setInterval(fetchTicks, 1500);
        const sentimentInterval = setInterval(fetchSentiments, 30000);
        return () => {
            clearInterval(tickInterval);
            clearInterval(sentimentInterval);
        };
    }, [fetchTicks, fetchSentiments]);

    const adjustVolume = (symbol: string, delta: number) => {
        setVolumes(prev => {
            const current = prev[symbol] || 0.01;
            const step = ['NAS100', 'US30', 'US500', 'GER40', 'US100Cash', 'US30Cash', 'GER40Cash'].includes(symbol) ? 1.0 : 0.01;
            const newVal = Math.max(step, Math.round((current + delta * step) * 100) / 100);
            return { ...prev, [symbol]: newVal };
        });
    };

    const executeOrder = async (symbol: string, action: 'BUY' | 'SELL') => {
        if (isExecutingRef.current) return;

        isExecutingRef.current = true;
        const lot = volumes[symbol] || 0.02;
        setExecutingId(`${symbol}-${action}`);
        setOrderResult(null);

        try {
            const response = await axios.post('/api/mt5/order', {
                symbol,
                action,
                lot,
                comment: `MANUAL ${action} ${symbol}`
            });

            const trade = {
                id: Date.now().toString(),
                symbol, action, lot,
                price: action === 'BUY' ? (ticks[symbol]?.ask || 0) : (ticks[symbol]?.bid || 0),
                time: new Date().toLocaleTimeString('pt-BR'),
                status: 'EXECUTADO'
            };
            setExecutedTrades(prev => [trade, ...prev]);
            setOrderResult({
                symbol,
                success: true,
                message: `${action} ${lot} lot ${symbol} executado!`
            });
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message;
            setOrderResult({
                symbol,
                success: false,
                message: msg
            });
        } finally {
            setExecutingId(null);
            isExecutingRef.current = false;
            setTimeout(() => setOrderResult(null), 4000);
        }
    };

    const resetDiscipline = async () => {
        if (!window.confirm("DESTREVAR SISTEMA: Você tem certeza que deseja ignorar as travas de segurança e continuar operando hoje?")) return;
        try {
            await axios.post('/api/mt5/discipline/reset');
            setIsDisciplineLocked(false);
            setOrderResult({
                symbol: 'ALL',
                success: true,
                message: 'Trava de Disciplina removida! Boas operações.'
            });
            setTimeout(() => setOrderResult(null), 3000);
        } catch (error) {
            alert("Falha ao destravar sistema.");
        }
    };

    const filteredInstruments = activeCategory === 'Todos'
        ? INSTRUMENTS
        : INSTRUMENTS.filter(i => i.category === activeCategory);

    const getDecimals = (symbol: string): number => {
        if (symbol.includes('JPY')) return 3;
        if (symbol.includes('XAU') || symbol === 'GOLD') return 2;
        if (symbol.includes('XAG')) return 3;
        if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL')) return 2;
        if (['NAS100', 'US30', 'US500', 'GER40', 'US100Cash', 'US30Cash', 'GER40Cash'].includes(symbol)) return 1;
        return 5;
    };

    const getPriceDirection = (symbol: string, field: 'bid' | 'ask' | 'micro' | 'macro'): 'up' | 'down' | 'neutral' => {
        const tick = ticks[symbol];
        if (!tick) return 'neutral';

        if (field === 'micro') {
            const val = (tick as any).changePercent5m || 0;
            if (val > 0.01) return 'up';
            if (val < -0.01) return 'down';
            return 'neutral';
        }

        if (field === 'macro') {
            const val = (tick as any).changePercent1h || 0;
            if (val > 0.01) return 'up';
            if (val < -0.01) return 'down';
            return 'neutral';
        }

        const curr = tick[field];
        const prev = prevTicks[symbol]?.[field];

        if (!curr || !prev) return 'neutral';
        if (curr > prev) return 'up';
        if (curr < prev) return 'down';
        return 'neutral';
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 shadow-xl shadow-emerald-500/10">
                        <TradeLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Operar</span>
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">Ao Vivo</span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-emerald-500" /> Cotações em tempo real · Execução instantânea
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    {isDisciplineLocked && (
                        <button
                            onClick={resetDiscipline}
                            className="px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 animate-pulse"
                        >
                            <ShieldAlert size={12} /> Destravar Sistema
                        </button>
                    )}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase">Mercado ao Vivo</span>
                    </div>
                </div>
            </div>

            {/* Order Result Toast */}
            <AnimatePresence>
                {orderResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`p-4 rounded-2xl border ${orderResult.success
                            ? 'bg-trader-green/10 border-trader-green/30 text-trader-green'
                            : 'bg-trader-red/10 border-trader-red/30 text-trader-red'
                            }`}
                    >
                        <p className="text-xs font-black uppercase tracking-widest">{orderResult.message}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Categorias */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${activeCategory === cat
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Tabela de Instrumentos */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                {/* Discipline Lock Overlay */}
                <AnimatePresence>
                    {isDisciplineLocked && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
                            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/40"
                        >
                            <div className="p-4 bg-trader-red/20 rounded-full border border-trader-red/40 mb-4 animate-pulse">
                                <ShieldAlert size={48} className="text-trader-red" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Safety Lock Active</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 bg-slate-900 px-4 py-1.5 rounded-full border border-slate-800">
                                {disciplineReason || 'Meta Diária Alcançada'}
                            </p>
                            <button
                                onClick={resetDiscipline}
                                className="mt-8 px-8 py-3 bg-trader-red text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-trader-red/80 shadow-xl shadow-trader-red/20 transition-all active:scale-95"
                            >
                                Ignorar Bloqueio e Operar
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table Header */}
                <div className="overflow-x-auto -mx-4 md:mx-0 scrollbar-none">
                    <div className="grid grid-cols-12 gap-1 md:gap-2 px-4 md:px-6 py-4 border-b border-white/5 min-w-[650px]">
                    <div className="col-span-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Instrumento</p>
                    </div>
                    <div className="col-span-2 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cotação & Tempo</p>
                    </div>
                    <div className="col-span-2 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tendência Alpha</p>
                    </div>
                    <div className="col-span-2 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Radar de Emoções</p>
                    </div>
                    <div className="col-span-1 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lote</p>
                    </div>
                    <div className="col-span-3 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 border-l border-white/5">Operação Alpha (Vender / Comprar)</p>
                    </div>
                </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5 overflow-x-auto -mx-4 md:mx-0 scrollbar-none">
                    <div className="min-w-[650px]">
                    {filteredInstruments.map((inst, i) => {
                        const tick = ticks[inst.symbol];
                        const bid = tick?.bid || 0;
                        const ask = tick?.ask || 0;
                        const isOpen = tick?.is_open !== false;
                        const decimals = getDecimals(inst.symbol);
                        const microTrendDir = getPriceDirection(inst.symbol, 'micro');
                        const macroTrendDir = getPriceDirection(inst.symbol, 'macro');
                        const bidTrend = getPriceDirection(inst.symbol, 'bid');
                        const vol = volumes[inst.symbol] || 0.02;
                        const changePercent = (tick as any)?.changePercent || 0;

                        return (
                            <motion.div
                                key={inst.symbol}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                                className="grid grid-cols-12 gap-1 md:gap-2 px-4 md:px-6 py-3 items-center hover:bg-white/[0.02] transition-colors"
                            >
                                {/* Instrumento */}
                                <div className="col-span-2 flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-white/5 flex items-center justify-center">
                                            {getInstrumentIcon(inst.icon)}
                                        </div>
                                        {/* Status Dot Integrated */}
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${isOpen ? 'bg-trader-green animate-pulse shadow-[0_0_5px_#22C55E]' : 'bg-slate-600'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white uppercase">{inst.symbol}</p>
                                        <p className="text-[8px] font-bold text-slate-400">{inst.name}</p>
                                    </div>
                                </div>

                                {/* Cotação & Candle Time combined */}
                                <div className="col-span-2 flex flex-col items-center justify-center">
                                    <p className={`text-[12px] font-black transition-colors duration-300 ${bid ? (bidTrend === 'up' ? 'text-trader-green' : bidTrend === 'down' ? 'text-trader-red' : 'text-slate-200') : 'text-slate-500'}`}>
                                        {bid ? bid.toFixed(decimals) : '---'}
                                    </p>
                                    <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-white/5 rounded-full">
                                        <Clock size={8} className={`${candleTime < 15 ? 'text-trader-red animate-pulse' : 'text-slate-500'}`} />
                                        <span className={`text-[8px] font-bold ${candleTime < 15 ? 'text-trader-red' : 'text-slate-400'}`}>
                                            0{Math.floor(candleTime / 60)}:{(candleTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>

                                {/* Alpha Dual Trends (Micro & Macro) */}
                                <div className="col-span-2 flex justify-center items-center gap-3">
                                    {/* Micro Trend (5m) */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-tighter">M5 (Micro)</span>
                                        <div className="relative">
                                            <AnimatePresence mode="wait">
                                                {(microTrendDir === 'up' || microTrendDir === 'down') && (
                                                    <motion.div
                                                        key={`micro-${inst.symbol}-${microTrendDir}`}
                                                        initial={{ scale: 0.8, opacity: 0 }}
                                                        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.5, 0.3] }}
                                                        transition={{ duration: 1, repeat: Infinity }}
                                                        className={`absolute inset-0 blur-md rounded-full ${microTrendDir === 'up' ? 'bg-trader-green/30' : 'bg-trader-red/30'}`}
                                                    />
                                                )}
                                            </AnimatePresence>
                                            <div className={`relative z-10 p-1 rounded-full border transition-all duration-300 ${microTrendDir === 'up' ? 'bg-trader-green/20 border-trader-green/30 text-trader-green' : microTrendDir === 'down' ? 'bg-trader-red/20 border-trader-red/30 text-trader-red' : 'bg-slate-800 border-white/5 text-slate-600'}`}>
                                                {microTrendDir === 'up' ? <ArrowUp size={8} className="stroke-[3]" /> : microTrendDir === 'down' ? <ArrowDown size={8} className="stroke-[3]" /> : <Minus size={8} className="stroke-[3]" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Macro Trend (1h) */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-tighter">H1 (Macro)</span>
                                        <div className="relative">
                                            <AnimatePresence mode="wait">
                                                {(macroTrendDir === 'up' || macroTrendDir === 'down') && (
                                                    <motion.div
                                                        key={`macro-${inst.symbol}-${macroTrendDir}`}
                                                        initial={{ scale: 0.8, opacity: 0 }}
                                                        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.7, 0.4] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                        className={`absolute inset-0 blur-lg rounded-full ${macroTrendDir === 'up' ? 'bg-trader-green/50' : 'bg-trader-red/50'}`}
                                                    />
                                                )}
                                            </AnimatePresence>
                                            <div className={`relative z-10 p-1.5 rounded-full border transition-all duration-300 ${macroTrendDir === 'up' ? 'bg-trader-green/20 border-trader-green/40 text-trader-green shadow-[0_0_10px_rgba(34,197,94,0.3)]' : macroTrendDir === 'down' ? 'bg-trader-red/20 border-trader-red/40 text-trader-red shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-white/5 text-slate-600'}`}>
                                                {macroTrendDir === 'up' ? <ArrowUp size={10} className="stroke-[3]" /> : macroTrendDir === 'down' ? <ArrowDown size={10} className="stroke-[3]" /> : <Minus size={10} className="stroke-[3]" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Radar de Emoções Premium */}
                                <div className="col-span-2 px-2">
                                    {sentiments[inst.symbol] ? (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className={`text-[7px] font-black tracking-widest uppercase flex items-center gap-1 ${sentiments[inst.symbol].score < 30 ? 'text-red-400' :
                                                    sentiments[inst.symbol].score < 45 ? 'text-orange-400' :
                                                        sentiments[inst.symbol].score > 70 ? 'text-emerald-400' :
                                                            sentiments[inst.symbol].score > 55 ? 'text-green-400' : 'text-slate-400'
                                                    }`}>
                                                    <span className={`w-1 h-1 rounded-full animate-ping ${sentiments[inst.symbol].score < 30 ? 'bg-red-500' :
                                                        sentiments[inst.symbol].score < 45 ? 'bg-orange-500' :
                                                            sentiments[inst.symbol].score > 70 ? 'bg-emerald-500' :
                                                                sentiments[inst.symbol].score > 55 ? 'bg-green-500' : 'bg-slate-500'
                                                        }`} />
                                                    {sentiments[inst.symbol].emotion.replace('_', ' ')}
                                                </span>
                                                <span className="text-[7px] font-black text-slate-500">{sentiments[inst.symbol].score}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden border border-white/5 relative group/radar">
                                                {/* Background segments hint */}
                                                <div className="absolute inset-0 flex divide-x divide-white/5 opacity-20">
                                                    <div className="flex-1 bg-red-900/20" />
                                                    <div className="flex-1 bg-orange-900/20" />
                                                    <div className="flex-1 bg-slate-900/20" />
                                                    <div className="flex-1 bg-green-900/20" />
                                                    <div className="flex-1 bg-emerald-900/20" />
                                                </div>

                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${sentiments[inst.symbol].score}%` }}
                                                    transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                                                    className={`h-full rounded-full relative overflow-hidden ${sentiments[inst.symbol].score < 30 ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]' :
                                                        sentiments[inst.symbol].score < 45 ? 'bg-gradient-to-r from-orange-600 to-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' :
                                                            sentiments[inst.symbol].score > 70 ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                                                                sentiments[inst.symbol].score > 55 ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-gradient-to-r from-slate-600 to-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.2)]'
                                                        }`}
                                                >
                                                    {/* Animated Loading Stripe */}
                                                    <motion.div
                                                        animate={{ x: ['0%', '100%'] }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                                        className="absolute inset-y-0 w-1/2 bg-white/20 skew-x-[45deg] -translate-x-full blur-sm"
                                                    />
                                                </motion.div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 animate-pulse">
                                            <div className="h-1 w-12 bg-slate-800 rounded mx-auto" />
                                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden" />
                                        </div>
                                    )}
                                </div>

                                {/* Volume Selector */}
                                <div className="col-span-1 flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => adjustVolume(inst.symbol, -1)}
                                        className="w-4 h-4 rounded-md bg-slate-800 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                                    >
                                        <Minus size={8} />
                                    </button>
                                    <span className="text-[9px] font-black text-white w-6 text-center">{vol}</span>
                                    <button
                                        onClick={() => adjustVolume(inst.symbol, 1)}
                                        className="w-4 h-4 rounded-md bg-slate-800 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                                    >
                                        <Plus size={8} />
                                    </button>
                                </div>

                                {/* Botões Alpha Lado a Lado */}
                                <div className="col-span-3 flex items-center gap-1 justify-center pl-2 border-l border-white/5">
                                    {/* Botão Vender */}
                                    <button
                                        onClick={() => executeOrder(inst.symbol, 'SELL')}
                                        disabled={!isOpen || executingId !== null}
                                        className={`group relative flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 ${!isOpen
                                            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                            : 'bg-trader-red/10 border border-trader-red/20 text-trader-red hover:bg-trader-red/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)] active:scale-95'
                                            }`}
                                    >
                                        {executingId === `${inst.symbol}-SELL` ? (
                                            <Loader2 size={10} className="animate-spin" />
                                        ) : (
                                            <>
                                                <ArrowDownRight size={10} />
                                                <span className={`font-black ${bid ? (microTrendDir === 'down' ? 'text-trader-red' : microTrendDir === 'up' ? 'text-trader-green' : '') : 'text-slate-500'}`}>
                                                    {bid ? bid.toFixed(decimals) : '---'}
                                                </span>
                                            </>
                                        )}
                                    </button>

                                    {/* Botão Comprar */}
                                    <button
                                        onClick={() => executeOrder(inst.symbol, 'BUY')}
                                        disabled={!isOpen || executingId !== null}
                                        className={`group relative flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 ${!isOpen
                                            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                            : 'bg-trader-green/10 border border-trader-green/20 text-trader-green hover:bg-trader-green/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] active:scale-95'
                                            }`}
                                    >
                                        {executingId === `${inst.symbol}-BUY` ? (
                                            <Loader2 size={10} className="animate-spin" />
                                        ) : (
                                            <>
                                                <span className={`font-black ${ask ? (microTrendDir === 'up' ? 'text-trader-green' : microTrendDir === 'down' ? 'text-trader-red' : '') : 'text-slate-500'}`}>
                                                    {ask ? ask.toFixed(decimals) : '---'}
                                                </span>
                                                <ArrowUpRight size={10} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                    </div>
                </div>
            </div>

            {/* MONITORAMENTO DE TRADES */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <div className="flex items-center gap-3 mb-5">
                    <Eye size={18} className="text-emerald-400" />
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Monitoramento de Trades</h3>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-700/50">
                        {executedTrades.length} execução(ões)
                    </span>
                </div>
                <div className="space-y-2">
                    {executedTrades.length > 0 ? executedTrades.map(trade => (
                        <div key={trade.id}
                            className="flex items-center gap-4 p-3 bg-slate-950/40 rounded-xl border border-white/5 group">
                            <div className={`w-1 h-10 rounded-full ${trade.action === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-base font-black text-white italic">{trade.symbol}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {trade.action}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">{trade.lot}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                                <span>{trade.price > 0 ? trade.price.toFixed(5) : '---'}</span>
                                <span className="font-mono text-slate-600">{trade.time}</span>
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                    {trade.status}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="py-12 text-center">
                            <History size={36} className="mx-auto mb-3 text-slate-700" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum trade manual executado</p>
                            <p className="text-[10px] text-slate-600 mt-1">Trades feitos pelos botões acima aparecerão aqui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
