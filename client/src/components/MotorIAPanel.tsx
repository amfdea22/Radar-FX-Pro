import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Zap, Shield, DollarSign, BarChart3, Target, Activity, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Cpu, Sigma, PieChart, Clock, Filter, Layers } from 'lucide-react';
import axios from 'axios';

interface MotorIAStatus {
    settings: {
        enabled: boolean; activeSymbols: string[]; timeframe: string;
        maxDailyTrades: number; baseLot: number; maxLotMultiplier: number;
        minConfidence: number; useAdaptiveLearning: boolean;
        useRegimeDetection: boolean; useSentimentAnalysis: boolean;
        maxConsecutiveLosses: number; dailyStopLoss: number;
        dailyTakeProfit: number; telegramAlerts: boolean; cooldownMinutes: number;
    };
    state: {
        isReady: boolean; marketRegime: string; dailyTrades: number;
        dailyPnl: number; consecutiveWins: number; consecutiveLosses: number;
        activePositions: number; totalTrades: number; totalWins: number;
        totalLosses: number; totalProfit: number;
    };
    isRunning: boolean;
    executions: Array<{
        id: string; time: number; symbol: string; direction: string;
        lotSize: number; entryPrice: number; stopLoss: number;
        takeProfit: number; exitPrice: number | null; exitTime: number | null;
        profit: number | null; result: string; confidence: number;
        strategy: string; marketRegime: string; tags: string[]; exitReason: string;
    }>;
    regime: Array<{ regime: string; volatility: number; trend: string; strength: number }>;
    learningStats: { totalSamples: number; overallWinRate?: number; byRegime?: Array<{ regime: string; winRate: number; samples: number }> };
    performance: { totalTrades: number; wins: number; losses: number; winRate: number; netProfit: number };
}

const REGIME_COLORS: Record<string, string> = {
    BULLISH: '#22c55e', BEARISH: '#ef4444', NEUTRAL: '#a78bfa',
    HIGH_VOLATILITY: '#f97316', LOW_VOLATILITY: '#22d3ee', UNKNOWN: '#64748b',
};

export const MotorIAPanel: React.FC = () => {
    const [status, setStatus] = useState<MotorIAStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedExecutions, setExpandedExecutions] = useState(true);
    const [expandedSettings, setExpandedSettings] = useState(false);
    const [expandedRegime, setExpandedRegime] = useState(true);
    const [expandedLearning, setExpandedLearning] = useState(true);
    const [filterResult, setFilterResult] = useState<string>('ALL');

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/motor-ia/status');
            setStatus(res.data);
        } catch { }
    };

    useEffect(() => {
        fetchStatus();
        const iv = setInterval(fetchStatus, 4000);
        return () => clearInterval(iv);
    }, []);

    const toggle = async () => {
        setLoading(true);
        try {
            await axios.post('/api/mt5/motor-ia/settings', { enabled: !status?.settings?.enabled });
            await fetchStatus();
        } catch { }
        setLoading(false);
    };

    const updateSetting = async (key: string, value: any) => {
        await axios.post('/api/mt5/motor-ia/settings', { [key]: value });
        await fetchStatus();
    };

    const s = status?.state;
    const perf = status?.performance;
    const execs = status?.executions || [];
    const regimes = status?.regime || [];
    const learn = status?.learningStats;

    const filteredExecs = filterResult === 'ALL' ? execs : execs.filter(e => e.result === filterResult);

    const getRegimeColor = (regime: string) => REGIME_COLORS[regime] || '#64748b';

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-xl shadow-blue-500/10">
                        <Brain size={44} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Motor IA</span>
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${status?.settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {status?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Sigma size={12} className="text-blue-500" /> Recuperação Inteligente c/ Machine Learning
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={toggle} disabled={loading}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${status?.settings?.enabled ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20' : 'bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20'}`}>
                        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                        {status?.settings?.enabled ? 'Desligar' : 'Ligar'}
                    </button>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                    { label: 'Regime', value: s?.marketRegime || '—', color: `text-[${getRegimeColor(s?.marketRegime || 'UNKNOWN')}]`, icon: Activity },
                    { label: 'Confiança', value: `${status?.settings?.minConfidence || 0}%`, color: 'text-blue-400', icon: Target },
                    { label: 'Diário', value: `${s?.dailyTrades || 0}/${status?.settings?.maxDailyTrades || 10}`, color: 'text-cyan-400', icon: Clock },
                    { label: 'P&L Diário', value: `$${(s?.dailyPnl || 0).toFixed(2)}`, color: (s?.dailyPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', icon: DollarSign },
                    { label: 'Wins Cons.', value: `${s?.consecutiveWins || 0}x`, color: 'text-emerald-400', icon: TrendingUp },
                    { label: 'Losses Cons.', value: `${s?.consecutiveLosses || 0}x`, color: (s?.consecutiveLosses || 0) >= 3 ? 'text-red-400' : 'text-slate-300', icon: TrendingDown },
                    { label: 'Total Execs', value: `${perf?.totalTrades || 0}`, color: 'text-violet-400', icon: Layers },
                ].map((m, i) => (
                    <div key={i} className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <m.icon size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                            <p className={`text-lg font-black italic ${m.color}`}>{m.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* MARKET REGIME */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedRegime(!expandedRegime)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Activity className="text-blue-400" size={18} /> Detecção de Regime de Mercado
                    </h3>
                    {expandedRegime ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>
                <AnimatePresence>
                    {expandedRegime && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6">
                                {regimes.length === 0 ? (
                                    <p className="text-slate-600 text-sm font-bold text-center py-4">Aguardando dados de mercado...</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {regimes.map((r, i) => (
                                            <div key={i} className="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                                style={{ borderColor: `${getRegimeColor(r.regime)}30`, backgroundColor: `${getRegimeColor(r.regime)}10`, color: getRegimeColor(r.regime) }}>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRegimeColor(r.regime) }} />
                                                {r.regime}
                                                <span className="text-slate-500">vol {r.volatility.toFixed(2)}</span>
                                                <span className="text-slate-500">{r.trend}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* LEARNING INSIGHTS */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedLearning(!expandedLearning)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Brain className="text-blue-400" size={18} /> Aprendizado Adaptativo
                    </h3>
                    {expandedLearning ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>
                <AnimatePresence>
                    {expandedLearning && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6">
                                {(!learn || learn.totalSamples === 0) ? (
                                    <p className="text-slate-600 text-sm font-bold text-center py-4">Nenhum dado de aprendizado ainda. O Motor IA precisa executar trades para aprender.</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amostras</p>
                                                <p className="text-2xl font-black text-white">{learn.totalSamples}</p>
                                            </div>
                                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Win Rate Global</p>
                                                <p className={`text-2xl font-black ${(learn.overallWinRate || 0) >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {(learn.overallWinRate || 0).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                        {learn.byRegime && learn.byRegime.length > 0 && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                                            <th className="py-3 pr-4">Regime</th>
                                                            <th className="py-3 pr-4">Win Rate</th>
                                                            <th className="py-3 pr-4">Amostras</th>
                                                            <th className="py-3 pr-4">Barra</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {learn.byRegime.map((r, i) => (
                                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                <td className="py-3 pr-4 font-black text-white flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRegimeColor(r.regime) }} />
                                                                    {r.regime}
                                                                </td>
                                                                <td className="py-3 pr-4">
                                                                    <span className={`font-black ${r.winRate >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>{r.winRate.toFixed(1)}%</span>
                                                                </td>
                                                                <td className="py-3 pr-4 text-slate-400 font-bold">{r.samples}</td>
                                                                <td className="py-3 pr-4">
                                                                    <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all duration-500"
                                                                            style={{ width: `${Math.min(100, r.winRate)}%`, backgroundColor: getRegimeColor(r.regime) }} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* PERFORMANCE */}
            {perf && perf.totalTrades > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <PieChart className="text-blue-400" size={18} /> Desempenho do Motor IA
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Win Rate', value: `${perf.winRate.toFixed(1)}%`, color: perf.winRate >= 55 ? 'text-emerald-400' : perf.winRate >= 40 ? 'text-amber-400' : 'text-red-400' },
                            { label: 'Total Trades', value: `${perf.totalTrades}`, color: 'text-white' },
                            { label: 'Wins', value: `${perf.wins}`, color: 'text-emerald-400' },
                            { label: 'Losses', value: `${perf.losses}`, color: 'text-red-400' },
                            { label: 'Lucro Líquido', value: `$${perf.netProfit.toFixed(2)}`, color: perf.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
                        ].map((m, i) => (
                            <div key={i} className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{m.label}</p>
                                <p className={`text-3xl font-black italic ${m.color}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* EXECUTIONS TABLE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedExecutions(!expandedExecutions)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <BarChart3 className="text-blue-400" size={18} /> Histórico de Execuções
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 bg-slate-800 rounded-xl p-0.5" onClick={e => e.stopPropagation()}>
                            {['ALL', 'WIN', 'LOSS', 'PENDING'].map(f => (
                                <button key={f} onClick={() => setFilterResult(f)}
                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${filterResult === f ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                        {expandedExecutions ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                    </div>
                </button>
                <AnimatePresence>
                    {expandedExecutions && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6 overflow-x-auto">
                                {filteredExecs.length === 0 ? (
                                    <p className="text-slate-600 text-sm font-bold text-center py-8">Nenhuma execução encontrada.</p>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                                <th className="py-3 pr-4">ID</th>
                                                <th className="py-3 pr-4">Hora</th>
                                                <th className="py-3 pr-4">Símbolo</th>
                                                <th className="py-3 pr-4">Direção</th>
                                                <th className="py-3 pr-4">Lote</th>
                                                <th className="py-3 pr-4">Preço</th>
                                                <th className="py-3 pr-4">SL</th>
                                                <th className="py-3 pr-4">TP</th>
                                                <th className="py-3 pr-4">Resultado</th>
                                                <th className="py-3 pr-4">P&L</th>
                                                <th className="py-3 pr-4">Confiança</th>
                                                <th className="py-3 pr-4">Regime</th>
                                                <th className="py-3 pr-4">Tags</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredExecs.map((e, i) => {
                                                const isWin = e.result === 'WIN';
                                                const isLoss = e.result === 'LOSS';
                                                const timeStr = new Date(e.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                return (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <td className="py-3 pr-4 text-[10px] font-mono text-slate-500">{e.id.slice(-8)}</td>
                                                        <td className="py-3 pr-4 text-xs text-slate-400 font-bold">{timeStr}</td>
                                                        <td className="py-3 pr-4 font-black text-white">{e.symbol}</td>
                                                        <td className="py-3 pr-4">
                                                            <span className={`font-black ${e.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{e.direction}</span>
                                                        </td>
                                                        <td className="py-3 pr-4 font-bold text-slate-300">{e.lotSize.toFixed(2)}</td>
                                                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">{e.entryPrice.toFixed(2)}</td>
                                                        <td className="py-3 pr-4 font-mono text-xs text-red-400">{e.stopLoss.toFixed(2)}</td>
                                                        <td className="py-3 pr-4 font-mono text-xs text-emerald-400">{e.takeProfit.toFixed(2)}</td>
                                                        <td className="py-3 pr-4">
                                                            {isWin && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">WIN</span>}
                                                            {isLoss && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-500 border border-red-500/30">LOSS</span>}
                                                            {e.result === 'PENDING' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">PENDING</span>}
                                                        </td>
                                                        <td className={`py-3 pr-4 font-black ${isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-400'}`}>
                                                            {e.profit !== null ? `$${e.profit.toFixed(2)}` : '—'}
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                                                        style={{ width: `${e.confidence}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-300">{e.confidence.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                                style={{ color: getRegimeColor(e.marketRegime), backgroundColor: `${getRegimeColor(e.marketRegime)}15` }}>
                                                                {e.marketRegime}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {e.tags.map((t, ti) => (
                                                                    <span key={ti} className="text-[7px] font-bold text-slate-500 bg-slate-800 px-1 py-0.5 rounded">{t}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* SETTINGS */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedSettings(!expandedSettings)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Cpu className="text-blue-400" size={18} /> Configurações do Motor IA
                    </h3>
                    {expandedSettings ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>
                <AnimatePresence>
                    {expandedSettings && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <SettingSlider label="Confiança Mínima (%)" value={status?.settings?.minConfidence || 55} min={10} max={95} step={5} onChange={v => updateSetting('minConfidence', v)} />
                                <SettingSlider label="Lote Base" value={status?.settings?.baseLot || 0.01} min={0.01} max={0.1} step={0.01} onChange={v => updateSetting('baseLot', v)} />
                                <SettingSlider label="Max Lote Multiplier" value={status?.settings?.maxLotMultiplier || 2} min={1} max={5} step={0.5} onChange={v => updateSetting('maxLotMultiplier', v)} />
                                <SettingSlider label="Trades/Dia" value={status?.settings?.maxDailyTrades || 10} min={1} max={50} step={1} onChange={v => updateSetting('maxDailyTrades', v)} />
                                <SettingSlider label="Stop Loss Diário ($)" value={status?.settings?.dailyStopLoss || 50} min={10} max={500} step={10} onChange={v => updateSetting('dailyStopLoss', v)} />
                                <SettingSlider label="Take Profit Diário ($)" value={status?.settings?.dailyTakeProfit || 100} min={10} max={1000} step={10} onChange={v => updateSetting('dailyTakeProfit', v)} />
                                <SettingSlider label="Cooldown (min)" value={status?.settings?.cooldownMinutes || 15} min={1} max={120} step={5} onChange={v => updateSetting('cooldownMinutes', v)} />
                                <SettingSlider label="Max Perdas Cons." value={status?.settings?.maxConsecutiveLosses || 3} min={1} max={10} step={1} onChange={v => updateSetting('maxConsecutiveLosses', v)} />
                                <SettingSlider label="Timeframe" value={['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].indexOf(status?.settings?.timeframe || 'H1')} min={0} max={6} step={1}
                                    onChange={v => updateSetting('timeframe', ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'][v])}
                                    displayValue={status?.settings?.timeframe || 'H1'} />
                                <SettingToggle label="Aprendizado Adaptativo" value={status?.settings?.useAdaptiveLearning || false} onChange={v => updateSetting('useAdaptiveLearning', v)} />
                                <SettingToggle label="Detecção de Regime" value={status?.settings?.useRegimeDetection || false} onChange={v => updateSetting('useRegimeDetection', v)} />
                                <SettingToggle label="Análise de Sentimento" value={status?.settings?.useSentimentAnalysis || false} onChange={v => updateSetting('useSentimentAnalysis', v)} />
                                <SettingToggle label="Alertas Telegram" value={status?.settings?.telegramAlerts || false} onChange={v => updateSetting('telegramAlerts', v)} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const SettingSlider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; displayValue?: string }> = ({ label, value, min, max, step, onChange, displayValue }) => (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className="text-sm font-black text-blue-400">{displayValue ?? value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
    </div>
);

const SettingToggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        <button onClick={() => onChange(!value)}
            className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-md ${value ? 'left-6' : 'left-0.5'}`} />
        </button>
    </div>
);
