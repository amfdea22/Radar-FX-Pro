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
            <div className="flex items-center justify-center p-20">
                <RefreshCw className="animate-spin text-amber-500" size={32} />
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

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Simulador de Assertividade (Backtest) */}
            <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-amber-500/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-50" />
                <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex-1">
                        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                            <Activity className="text-amber-500" size={24} /> Simulador de Assertividade
                        </h2>
                        <p className="text-xs text-slate-400 mt-2 max-w-lg">
                            Valide a estratégia da IA contra os últimos 60 dias de movimentação real do mercado.
                            O motor testará o <span className="text-amber-500 font-bold">SwingScore™</span> vela por vela.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        {s.symbols.map(sym => (
                            <button
                                key={sym}
                                onClick={() => runBacktest(sym)}
                                disabled={isBacktesting}
                                className={`px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${isBacktesting
                                    ? 'bg-slate-800 text-slate-500 border-slate-700'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-black'}`}
                            >
                                {isBacktesting ? 'Processando...' : `Testar ${sym}`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Backtest Results Display */}
                <AnimatePresence>
                    {backtestResult && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10"
                        >
                            {[
                                { label: 'Assertividade', value: `${backtestResult.winRate.toFixed(1)}%`, sub: `de ${backtestResult.totalTrades} trades`, color: 'text-emerald-400' },
                                { label: 'Lucro Simulado', value: `$${backtestResult.totalProfit.toFixed(2)}`, sub: 'Result. Líquido', color: 'text-amber-400' },
                                { label: 'Profit Factor', value: backtestResult.profitFactor.toFixed(2), sub: 'Eficiência', color: 'text-trader-blue' },
                                { label: 'Drawdown Máx', value: `$${backtestResult.maxDrawdown.toFixed(2)}`, sub: 'Risco Histórico', color: 'text-rose-400' },
                            ].map((res, i) => (
                                <div key={i} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{res.label}</span>
                                    <span className={`text-2xl font-black italic tracking-tighter ${res.color} block`}>{res.value}</span>
                                    <span className="text-[10px] text-slate-500">{res.sub}</span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-8 rounded-[2.5rem] border border-amber-500/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp size={120} className="text-amber-400" />
                </div>

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                            <Crosshair className="text-white animate-pulse" size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                                Swing Trader IA <span className="text-[10px] bg-amber-500 px-2 py-0.5 rounded italic not-italic font-black text-black">Multi-Asset v1.0</span>
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Estratégia: MTF Score</span>
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${s.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                                    {s.enabled ? '⚡ Analisando' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => updateSetting('enabled', !s.enabled)}
                        className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all shadow-xl border ${s.enabled
                            ? 'bg-amber-500 text-black border-white/20 shadow-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                    >
                        <Power size={18} />
                        {s.enabled ? 'swing active' : 'engage swing'}
                    </button>
                </div>
            </div>

            {/* Resumo Global */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Posições Ativas', value: `${status.activePositions}`, icon: <Layers size={16} />, color: 'text-amber-400' },
                    { label: 'Lucro do Dia', value: `$${status.dailyProfit.toFixed(2)}`, icon: <DollarSign size={16} />, color: status.dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                    { label: 'Score Mínimo', value: `${s.minSwingScore}/100`, icon: <Gauge size={16} />, color: 'text-amber-400' },
                    { label: 'Cooldown', value: `${s.cooldownMinutes} min`, icon: <Clock size={16} />, color: 'text-slate-400' },
                ].map((item, i) => (
                    <div key={i} className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-800 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                        <div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{item.label}</span>
                            <span className={`text-lg font-black italic tracking-tighter ${item.color}`}>{item.value}</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-amber-500/10 transition-colors">
                            <span className={item.color}>{item.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Análise por Ativo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {s.symbols.map(sym => {
                    const a = status.analyses[sym];
                    if (!a) return (
                        <div key={sym} className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800">
                            <h3 className="text-white font-black italic uppercase tracking-tighter">{sym}</h3>
                            <p className="text-slate-500 text-sm mt-4">Aguardando primeira análise...</p>
                        </div>
                    );

                    return (
                        <motion.div
                            key={sym}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-xl space-y-5"
                        >
                            {/* Symbol Header + SwingScore */}
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

                            {/* Score Bar */}
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(a.swingScore)}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${a.swingScore}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                />
                            </div>

                            {/* Trend Badges */}
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

                            {/* Indicadores */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">RSI 14</span>
                                    <span className={`text-sm font-black ${a.rsi14 > 70 ? 'text-rose-400' : a.rsi14 < 30 ? 'text-emerald-400' : 'text-slate-300'}`}>{a.rsi14}</span>
                                </div>
                                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">ATR H4</span>
                                    <span className="text-sm font-black text-amber-400">{a.atrH4}</span>
                                </div>
                                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">MACD</span>
                                    <span className={`text-sm font-black ${a.macdSignal === 'BUY' ? 'text-emerald-400' : a.macdSignal === 'SELL' ? 'text-rose-400' : 'text-slate-500'}`}>{a.macdSignal}</span>
                                </div>
                                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Volume</span>
                                    <span className={`text-sm font-black ${a.volumeRatio >= 1.2 ? 'text-emerald-400' : 'text-slate-400'}`}>{a.volumeRatio}x</span>
                                </div>
                            </div>

                            {/* Score Breakdown */}
                            <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score Breakdown</span>
                                {[
                                    { label: 'Trend', val: a.scores.trendAlignment, max: 30 },
                                    { label: 'Pullback', val: a.scores.pullbackQuality, max: 25 },
                                    { label: 'Pattern', val: a.scores.patternTrigger, max: 25 },
                                    { label: 'Volume', val: a.scores.volumeConfirm, max: 10 },
                                    { label: 'Momentum', val: a.scores.momentum, max: 10 },
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-500 w-16">{s.label}</span>
                                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-amber-500"
                                                style={{ width: `${(s.val / s.max) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 w-8 text-right">{s.val}/{s.max}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Sinal */}
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

            {/* Watchlist IA: Sinais Futuros */}
            <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-amber-500/10 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Timer size={80} className="text-amber-500" />
                </div>

                <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3 mb-6 relative z-10">
                    <Timer className="text-amber-500" size={24} /> Watchlist IA — Próximos Sinais
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    {Object.entries(status.watchlist).length === 0 ? (
                        <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                            <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest italic">Nenhum sinal futuro em formação no momento...</p>
                        </div>
                    ) : Object.entries(status.watchlist).map(([sym, item]) => (
                        <motion.div
                            key={sym}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-950/50 p-5 rounded-3xl border border-slate-800 hover:border-amber-500/30 transition-all group"
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Posições */}
                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                    <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3 mb-4">
                        <Layers className="text-amber-500" size={20} /> Posições Swing
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket</th>
                                    <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ativo</th>
                                    <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                    <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lote</th>
                                    <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Lucro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {status.positions.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Aguardando setup com SwingScore ≥ {s.minSwingScore}...</td></tr>
                                ) : status.positions.map((pos: any) => (
                                    <motion.tr key={pos.ticket} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                                        <td className="py-3 text-xs font-mono text-slate-400">#{pos.ticket}</td>
                                        <td className="py-3 text-xs font-bold text-white">{pos.symbol}</td>
                                        <td className="py-3">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${pos.type === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {pos.type === 0 ? 'BUY' : 'SELL'}
                                            </span>
                                        </td>
                                        <td className="py-3 text-xs font-bold text-white">{pos.volume}</td>
                                        <td className={`py-3 text-xs font-black text-right ${pos.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            ${pos.profit?.toFixed(2)}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Terminal de Logs */}
                <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-xl flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3">
                            <Timer className="text-amber-500" size={18} /> Terminal IA
                        </h3>
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    </div>

                    <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5 max-h-64">
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
                        <button onClick={handleReset} className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            Reset Dia
                        </button>
                        <button onClick={fetchStatus} className="p-3 bg-slate-800 text-slate-400 rounded-xl border border-slate-700">
                            <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Row */}
            <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3 mb-5">
                    <Settings className="text-amber-500" size={20} /> Parâmetros da IA
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Score Mínimo', key: 'minSwingScore', value: s.minSwingScore, min: 30, max: 95, step: 5 },
                        { label: 'SL (ATR x)', key: 'atrSlMultiplier', value: s.atrSlMultiplier, min: 0.5, max: 3, step: 0.25 },
                        { label: 'TP (ATR x)', key: 'atrTpMultiplier', value: s.atrTpMultiplier, min: 1, max: 6, step: 0.5 },
                        { label: 'Cooldown (min)', key: 'cooldownMinutes', value: s.cooldownMinutes, min: 5, max: 120, step: 5 },
                    ].map((param, i) => (
                        <div key={i} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col gap-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{param.label}</span>
                            <div className="flex items-center justify-between">
                                <button onClick={() => updateSetting(param.key, Math.max(param.min, Number((param.value - param.step).toFixed(2))))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                <span className="text-sm font-black text-amber-400">{param.value}</span>
                                <button onClick={() => updateSetting(param.key, Math.min(param.max, Number((param.value + param.step).toFixed(2))))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 text-center">
                <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">
                    Swing Trader IA <span className="mx-2">|</span> Multi-Timeframe D1→H4→H1 <span className="mx-2">|</span> SwingScore™ Engine v1.0
                </p>
            </div>
        </div>
    );
};
