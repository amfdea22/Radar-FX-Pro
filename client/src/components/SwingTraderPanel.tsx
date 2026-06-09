import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Activity, Target, Shield, RefreshCw,
    DollarSign, Layers, Power, Settings, Timer,
    BarChart2, AlertTriangle, Crosshair, Gauge, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface SwingAnalysis {
    symbol: string;
    swingScore: number;
    direction: 'BUY' | 'SELL' | null;
    trendD1: string;
    trendH4: string;
    triggerH1: string | null;
    triggerPattern: string;
    rsi14: number;
    macdSignal: string;
    atrH4: number;
    volumeRatio: number;
    scores: {
        trendAlignment: number;
        pullbackQuality: number;
        patternTrigger: number;
        volumeConfirm: number;
        momentum: number;
    };
}

interface SwingStatus {
    settings: {
        enabled: boolean;
        symbols: string[];
        lotSize: number;
        minSwingScore: number;
        atrSlMultiplier: number;
        atrTpMultiplier: number;
        maxPositionsPerSymbol: number;
        maxDailyLoss: number;
        maxDailyProfit: number;
        cooldownMinutes: number;
    };
    analyses: Record<string, SwingAnalysis>;
    positions: any[];
    activePositions: number;
    dailyProfit: number;
    dailyLoss: number;
    watchlist: Record<string, {
        score: number;
        trend: string;
        message: string;
        lastUpdate: string;
    }>;
    logs: { time: string; msg: string; type: string }[];
}

function SwingLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="swg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <filter id="swglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#swg)" strokeWidth="2" filter="url(#swglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#swg)" fontSize="20" fontWeight="900" fontStyle="italic" filter="url(#swglow)">S</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#swg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

export const SwingTraderPanel: React.FC = () => {
    const [status, setStatus] = useState<SwingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [backtestResult, setBacktestResult] = useState<any | null>(null);
    const [isBacktesting, setIsBacktesting] = useState(false);

    const runBacktest = async (targetSymbol: string) => {
        setIsBacktesting(true);
        try {
            const resp = await axios.get(`/api/mt5/swing-trader/backtest?symbol=${targetSymbol}&days=60`);
            setBacktestResult(resp.data);
        } catch (err) {
            console.error('Backtest error:', err);
        } finally {
            setIsBacktesting(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/swing-trader/status');
            setStatus(resp.data);
            setLoading(false);
        } catch (err) {
            console.error('Swing Trader fetch error:', err);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const updateSetting = async (key: string, value: any) => {
        setUpdating(true);
        try {
            await axios.post('/api/mt5/swing-trader/settings', { [key]: value });
            await fetchStatus();
        } finally {
            setUpdating(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Resetar o dia do Swing Trader?')) return;
        await axios.post('/api/mt5/swing-trader/reset');
        await fetchStatus();
    };

    if (loading || !status) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando Swing IA...</p>
            </div>
        );
    }

    const s = status.settings;
    const trendColor = (t: string) =>
        t === 'BULLISH' ? 'text-emerald-400' :
            t === 'BEARISH' ? 'text-rose-400' : 'text-slate-500';

    const trendBg = (t: string) =>
        t === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/20' :
            t === 'BEARISH' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800 border-slate-700';

    const scoreColor = (score: number) =>
        score >= 80 ? 'text-emerald-400' :
            score >= 60 ? 'text-amber-400' :
                score >= 40 ? 'text-orange-400' : 'text-slate-500';

    const scoreGradient = (score: number) =>
        score >= 80 ? 'from-emerald-500 to-teal-500' :
            score >= 60 ? 'from-amber-500 to-orange-500' :
                score >= 40 ? 'from-orange-500 to-red-500' : 'from-slate-600 to-slate-700';

    const isActive = s.enabled;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <SwingLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Swing</span> IA
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${isActive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <TrendingUp size={12} className="text-amber-500" /> Multi-Asset | MTF Score | SwingScore™ v1.0
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button
                        onClick={() => updateSetting('enabled', !s.enabled)}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            isActive
                                ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                        }`}
                    >
                        {updating ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : isActive ? (
                            <><Power size={12} /> Desligar Swing</>
                        ) : (
                            <><Power size={12} /> Ligar Swing</>
                        )}
                    </button>
                </div>
            </div>

            {/* SWING ENGINE + BACKTEST */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Activity className="text-amber-500 animate-pulse" /> Simulador de <span className="text-amber-500">Assertividade</span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Valide a estratégia contra os últimos 60 dias de mercado real</p>
                    </div>
                    <div className="flex gap-3">
                        {s.symbols.map(sym => (
                            <button
                                key={sym}
                                onClick={() => runBacktest(sym)}
                                disabled={isBacktesting}
                                className={`px-5 py-2.5 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${isBacktesting
                                    ? 'bg-slate-800 text-slate-500 border-slate-700'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-white'}`}
                            >
                                {isBacktesting ? 'Processando...' : `Testar ${sym}`}
                            </button>
                        ))}
                    </div>
                </div>

                <AnimatePresence>
                    {backtestResult && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                        >
                            {[
                                { label: 'Assertividade', value: `${backtestResult.winRate.toFixed(1)}%`, sub: `de ${backtestResult.totalTrades} trades`, color: 'text-emerald-400' },
                                { label: 'Lucro Simulado', value: `$${backtestResult.totalProfit.toFixed(2)}`, sub: 'Result. Líquido', color: 'text-amber-400' },
                                { label: 'Profit Factor', value: backtestResult.profitFactor.toFixed(2), sub: 'Eficiência', color: 'text-trader-blue' },
                                { label: 'Drawdown Máx', value: `$${backtestResult.maxDrawdown.toFixed(2)}`, sub: 'Risco Histórico', color: 'text-rose-400' },
                            ].map((res, i) => (
                                <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{res.label}</p>
                                    <p className={`text-xl font-black italic ${res.color}`}>{res.value}</p>
                                    <p className="text-[9px] text-slate-500">{res.sub}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* STATS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <Layers size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Posições Ativas</p>
                            <p className="text-xl font-black text-white italic">{status.activePositions}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro do Dia</p>
                            <p className={`text-xl font-black italic ${status.dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ${status.dailyProfit.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <Gauge size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Score Mínimo</p>
                            <p className="text-xl font-black text-white italic">{s.minSwingScore}/100</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-slate-500/20 text-slate-500 rounded-xl">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Cooldown</p>
                            <p className="text-xl font-black text-white italic">{s.cooldownMinutes} min</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ANÁLISE POR ATIVO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {s.symbols.map(sym => {
                    const a = status.analyses[sym];
                    if (!a) return (
                        <div key={sym} className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-amber-500/10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                            <h3 className="text-white font-black italic uppercase tracking-tighter">{sym}</h3>
                            <p className="text-slate-500 text-sm mt-4">Aguardando primeira análise...</p>
                        </div>
                    );

                    return (
                        <motion.div
                            key={sym}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden space-y-5"
                        >
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-black italic uppercase tracking-tighter text-lg flex items-center gap-3">
                                        {sym === 'XAUUSD' ? '🥇' : '₿'} {sym}
                                    </h3>
                                    <span className="text-[10px] text-slate-500 font-bold">{a.triggerPattern}</span>
                                </div>
                                <div className="text-center">
                                    <div className={`text-3xl font-black italic ${scoreColor(a.swingScore)}`}>
                                        {a.swingScore}
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SwingScore</span>
                                </div>
                            </div>

                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(a.swingScore)}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${a.swingScore}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'D1', value: a.trendD1 },
                                    { label: 'H4', value: a.trendH4 },
                                    { label: 'H1', value: a.triggerH1 || 'FLAT' },
                                ].map((t, i) => (
                                    <div key={i} className={`p-3 rounded-2xl border text-center ${trendBg(t.value)}`}>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{t.label}</span>
                                        <span className={`text-xs font-black uppercase ${trendColor(t.value)}`}>{t.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">RSI 14</span>
                                    <span className={`text-sm font-black ${a.rsi14 > 70 ? 'text-rose-400' : a.rsi14 < 30 ? 'text-emerald-400' : 'text-slate-300'}`}>{a.rsi14}</span>
                                </div>
                                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">ATR H4</span>
                                    <span className="text-sm font-black text-amber-400">{a.atrH4}</span>
                                </div>
                                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">MACD</span>
                                    <span className={`text-sm font-black ${a.macdSignal === 'BUY' ? 'text-emerald-400' : a.macdSignal === 'SELL' ? 'text-rose-400' : 'text-slate-500'}`}>{a.macdSignal}</span>
                                </div>
                                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Volume</span>
                                    <span className={`text-sm font-black ${a.volumeRatio >= 1.2 ? 'text-emerald-400' : 'text-slate-400'}`}>{a.volumeRatio}x</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score Breakdown</span>
                                {[
                                    { label: 'Trend', val: a.scores.trendAlignment, max: 30 },
                                    { label: 'Pullback', val: a.scores.pullbackQuality, max: 25 },
                                    { label: 'Pattern', val: a.scores.patternTrigger, max: 25 },
                                    { label: 'Volume', val: a.scores.volumeConfirm, max: 10 },
                                    { label: 'Momentum', val: a.scores.momentum, max: 10 },
                                ].map((sc, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-500 w-16">{sc.label}</span>
                                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-amber-500"
                                                style={{ width: `${(sc.val / sc.max) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 w-8 text-right">{sc.val}/{sc.max}</span>
                                    </div>
                                ))}
                            </div>

                            {a.direction && a.swingScore >= 70 && (
                                <div className={`p-4 rounded-2xl border text-center ${a.direction === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                                    <span className={`text-sm font-black uppercase ${a.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        🎯 SINAL ATIVO: {a.direction}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* WATCHLIST IA */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>

                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Timer className="text-amber-500" size={18} /> Watchlist IA — Próximos Sinais
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(status.watchlist).length === 0 ? (
                        <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                            <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest italic">Nenhum sinal futuro em formação no momento...</p>
                        </div>
                    ) : Object.entries(status.watchlist).map(([sym, item]) => (
                        <motion.div
                            key={sym}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${item.trend === 'BULLISH' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                        <TrendingUp size={14} className={item.trend === 'BULLISH' ? 'text-emerald-500' : 'text-rose-500'} />
                                    </div>
                                    <span className="text-white font-black uppercase italic tracking-tighter">{sym}</span>
                                </div>
                                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
                                    {item.score}% Setup
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    <span>Confiança IA</span>
                                    <span>{item.score}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.score}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-900 mt-2">
                                    <Activity size={12} className="text-amber-500" />
                                    <span className="text-[10px] font-bold text-slate-300 italic">{item.message}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* POSIÇÕES */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Layers className="text-amber-500" size={18} /> Posições Swing
                        </h3>
                        <div className="bg-slate-950/60 rounded-[2rem] border border-white/5 overflow-hidden">
                            <div className="max-h-72 overflow-x-auto overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="sticky top-0 bg-slate-900 border-b border-white/5">
                                        <tr className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-6 py-4">Ticket</th>
                                            <th className="px-6 py-4">Ativo</th>
                                            <th className="px-6 py-4">Tipo</th>
                                            <th className="px-6 py-4">Lote</th>
                                            <th className="px-6 py-4 text-right">Lucro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {status.positions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                                        <Target size={40} />
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Aguardando setup com SwingScore ≥ {s.minSwingScore}...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : status.positions.map((pos: any, i: number) => (
                                            <motion.tr key={pos.ticket || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group hover:bg-white/5 transition-all">
                                                <td className="px-6 py-4 text-xs font-mono text-slate-400">#{pos.ticket}</td>
                                                <td className="px-6 py-4 font-black text-white text-xs italic">{pos.symbol}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${pos.type === 0
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                                                        {pos.type === 0 ? 'BUY' : 'SELL'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-black text-white">{pos.volume}</td>
                                                <td className={`px-6 py-4 text-xs font-black italic text-right ${pos.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    ${pos.profit?.toFixed(2)}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TERMINAL IA */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Timer className="text-amber-500" size={18} /> Terminal IA
                        </h3>

                        <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5 min-h-[200px]">
                            {status.logs.length === 0 ? (
                                <p className="text-slate-700 italic">Iniciando Swing Analysis...</p>
                            ) : status.logs.map((log, i) => (
                                <div key={i} className="flex gap-3 opacity-90">
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span className={
                                        log.type === 'TRADE' ? 'text-amber-400 font-bold' :
                                            log.type === 'SCORE' ? 'text-emerald-400 font-bold' :
                                                log.type === 'WARN' ? 'text-rose-500' : 'text-slate-400'
                                    }>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button onClick={handleReset} className="flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20">
                                Reset Dia
                            </button>
                            <button onClick={fetchStatus} className="p-3 bg-slate-800 text-slate-400 rounded-xl border border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 transition-all">
                                <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* PARÂMETROS DA IA */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Settings className="text-amber-500" size={18} /> Parâmetros da IA
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Score Mínimo', key: 'minSwingScore', value: s.minSwingScore, min: 30, max: 95, step: 5 },
                        { label: 'SL (ATR x)', key: 'atrSlMultiplier', value: s.atrSlMultiplier, min: 0.5, max: 3, step: 0.25 },
                        { label: 'TP (ATR x)', key: 'atrTpMultiplier', value: s.atrTpMultiplier, min: 1, max: 6, step: 0.5 },
                        { label: 'Cooldown (min)', key: 'cooldownMinutes', value: s.cooldownMinutes, min: 5, max: 120, step: 5 },
                    ].map((param, i) => (
                        <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{param.label}</span>
                                <span className="text-sm font-black text-amber-400">{param.value}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <button onClick={() => updateSetting(param.key, Math.max(param.min, Number((param.value - param.step).toFixed(2))))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                <span className="text-lg font-black text-white">{param.value}</span>
                                <button onClick={() => updateSetting(param.key, Math.min(param.max, Number((param.value + param.step).toFixed(2))))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FOOTER */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-6 relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">
                    Swing Trader IA <span className="mx-2">|</span> Multi-Timeframe D1→H4→H1 <span className="mx-2">|</span> SwingScore™ Engine v1.0
                </p>
            </div>
        </div>
    );
};
