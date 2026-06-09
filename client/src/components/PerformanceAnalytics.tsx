import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
    TrendingUp, Activity, Target, Zap, History, Calendar,
    ShieldCheck, Sparkles, Brain, Clock, BarChart3, ArrowUpRight,
    Info, HelpCircle, CheckCircle2, AlertTriangle, User, Cpu,
    RefreshCw, CircleDot, Eye, Bot, Crown, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AdvancedAnalytics {
    assets: { name: string; profit: number; winRate: number; trades: number }[];
    setups: { name: string; profit: number; winRate: number; trades: number }[];
    origins: { name: string; profit: number; winRate: number; trades: number; profitFactor: number }[];
    hourly: { hour: string; winRate: number; trades: number }[];
    daily: { day: string; winRate: number; trades: number }[];
    periods: {
        today: { profit: number; winRate: number; totalTrades: number; winTrades: number; lossTrades: number; profitFactor: number };
        threeDays: { profit: number; winRate: number; totalTrades: number; winTrades: number; lossTrades: number; profitFactor: number };
        weekly: { profit: number; winRate: number; totalTrades: number; winTrades: number; lossTrades: number; profitFactor: number };
        monthly: { profit: number; winRate: number; totalTrades: number; winTrades: number; lossTrades: number; profitFactor: number };
    };
    elite: { name: string; winRate: number; benchmark: number; status: string; description: string; tag: string }[];
    aiInsights: string[];
    equityCurve: { name: string; equity: number; time: number }[];
    neuralMatrix: { active: string; setup: string; hour: string; winRate: number; score: number }[];
}

function AnalyticsLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="ang" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <filter id="anglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
                </filter>
            </defs>
            <path d="M6 32 L14 16 L22 24 L30 10 L38 18 L36 34 L30 36 L22 38 L14 36 L8 34 Z"
                fill="none" stroke="url(#ang)" strokeWidth="2" filter="url(#anglow)" />
            <circle cx="14" cy="20" r="2.5" fill="url(#ang)" />
            <circle cx="22" cy="24" r="2.5" fill="url(#ang)" />
            <circle cx="30" cy="16" r="2.5" fill="url(#ang)" />
            <circle cx="38" cy="22" r="2" fill="url(#ang)" opacity="0.5" />
            <circle cx="10" cy="30" r="2" fill="url(#ang)" opacity="0.5" />
            <circle cx="34" cy="30" r="2" fill="url(#ang)" opacity="0.5" />
        </svg>
    );
}

export const PerformanceAnalytics: React.FC = () => {
    const [data, setData] = useState<AdvancedAnalytics | null>(null);
    const [liveData, setLiveData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [analytics, live] = await Promise.all([
                axios.get('/api/mt5/analytics/advanced'),
                axios.get('/api/mt5/ai-monitoring').catch(() => ({ data: null }))
            ]);
            setData(analytics.data);
            if (live.data) setLiveData(live.data);
            setLoading(false);
        } catch (error) {
            console.error('Radar Intelligence sync failed:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4 min-h-[600px]">
            <div className="relative">
                <Brain className="text-indigo-500 animate-pulse" size={64} />
                <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full"></div>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-bounce">Sintonizando I.A. de Performance...</p>
        </div>
    );

    const totalProfit = data.assets.reduce((sum, a) => sum + a.profit, 0);
    const totalTrades = data.assets.reduce((sum, a) => sum + a.trades, 0);
    const avgWinRate = data.assets.length > 0
        ? (data.assets.reduce((sum, a) => sum + a.winRate, 0) / data.assets.length).toFixed(1)
        : '0';

    const hasData = data.assets.length > 0;

    const ORIGIN_CONFIG: Record<string, { icon: any; color: string; gradient: string }> = {
        'Manual': { icon: User, color: '#94A3B8', gradient: 'from-slate-500 to-slate-400' },
        'Alpha Robot': { icon: Brain, color: '#818CF8', gradient: 'from-indigo-500 to-purple-600' },
        'Gold Scalper': { icon: TrendingUp, color: '#F59E0B', gradient: 'from-amber-500 to-orange-600' },
        'Supreme Engine': { icon: Crown, color: '#10B981', gradient: 'from-emerald-500 to-teal-600' },
        'Omni Probabilistic': { icon: Activity, color: '#EC4899', gradient: 'from-pink-500 to-rose-600' },
        'Social Trading': { icon: Users, color: '#06B6D4', gradient: 'from-cyan-500 to-blue-600' },
        'Sinais': { icon: Zap, color: '#FBBF24', gradient: 'from-amber-500 to-yellow-600' },
    };

    const groupedOrigins = data.origins
        .filter(o => o.trades > 0 || o.name === 'Manual' || o.name === 'Sinais')
        .map(o => {
            const cfg = ORIGIN_CONFIG[o.name] || { icon: Bot, color: '#64748b', gradient: 'from-slate-600 to-slate-500' };
            return { ...o, ...cfg };
        });

    const totalWinsCount = data.assets.reduce((sum, a) => sum + Math.round((a.winRate / 100) * a.trades), 0);
    const totalLossesCount = Math.max(0, totalTrades - totalWinsCount);
    const pieData = [
        { name: 'Vitórias', value: totalWinsCount, color: '#10b981' },
        { name: 'Derrotas', value: totalLossesCount, color: '#ef4444' }
    ];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
                        <AnalyticsLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Radar</span> Intelligence
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${hasData ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {hasData ? 'Live' : 'Standby'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-indigo-500" /> Análise Avançada de Performance & Métricas em Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={() => { setLoading(true); fetchData(); }}
                        className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-2xl hover:bg-indigo-500/20 transition-all flex items-center gap-2 group" title="Recarregar">
                        <RefreshCw size={16} className="group-hover:rotate-90 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Sincronizar</span>
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status da Rede</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${hasData ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${hasData ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            <span className="text-[10px] font-black uppercase">{hasData ? 'Analisando' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ENGINE STATUS */}
            {liveData && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <Bot className="text-indigo-500" size={18} /> Status dos Motores
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { id: 'gold', name: 'Gold Scalper', active: liveData.gold?.enabled, color: '#F59E0B', score: liveData.gold?.iaScore },
                            { id: 'crypto', name: 'Crypto IA', active: liveData.crypto?.settings?.enabled, color: '#8B5CF6', score: liveData.crypto?.neuroScores?.overall },
                            { id: 'swing', name: 'Swing Trader', active: liveData.swing?.settings?.enabled, color: '#06B6D4' },
                            { id: 'omni', name: 'Omni Prob.', active: liveData.omni?.settings?.enabled, color: '#EC4899' },
                            { id: 'supreme', name: 'Supreme AI', active: liveData.supreme?.status === 'ACTIVE', color: '#10B981', score: liveData.supreme?.confluencePower },
                            { id: 'robot', name: 'Alpha Robot', active: liveData.robot?.enabled, color: '#6366F1', score: liveData.robot?.totalWins ? Math.round(liveData.robot.totalWins / ((liveData.robot.totalWins || 0) + (liveData.robot.totalLosses || 0)) * 100) : 0 },
                        ].map(eng => (
                            <motion.div key={eng.id} whileHover={{ y: -3 }} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{eng.name}</span>
                                    <span className={`w-2 h-2 rounded-full ${eng.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                                </div>
                                {eng.score != null && (
                                    <p className="text-lg font-black italic tabular-nums" style={{ color: eng.color }}>{eng.score}%</p>
                                )}
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mt-1">{eng.active ? 'Ativo' : 'Inativo'}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI INSIGHTS + CORE METRICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Brain size={120} className="text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <Activity className="text-indigo-500" size={18} /> Insights do Analista Virtual
                    </h3>
                    <div className="space-y-3">
                        {data.aiInsights.map((insight, idx) => (
                            <motion.div key={idx} whileHover={{ x: 4 }}
                                className="flex items-start gap-4 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl hover:bg-indigo-500/10 transition-all">
                                <div className="mt-0.5 p-1.5 bg-indigo-500/20 rounded-lg shrink-0">
                                    <Target className="text-indigo-400" size={12} />
                                </div>
                                <p className="text-sm font-bold text-slate-300 leading-relaxed italic">{insight}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/15 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Acumulado Total</p>
                        <p className={`text-3xl font-black italic ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <TrendingUp size={28} className={`mt-2 ${totalProfit >= 0 ? 'text-emerald-400/30' : 'text-red-400/30'}`} />
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/15 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Taxa Média Win</p>
                        <p className="text-3xl font-black text-amber-400 italic">{avgWinRate}%</p>
                        <Target size={28} className="mt-2 text-amber-400/30" />
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/15 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Volume de Trades</p>
                        <p className="text-3xl font-black text-white italic">{totalTrades}</p>
                        <History size={28} className="mt-2 text-indigo-400/30" />
                    </div>
                    {liveData?.gold && (
                        <>
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/15 p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">Neuro Score</p>
                                <p className="text-3xl font-black italic tabular-nums" style={{ color: (liveData.gold.iaScore || 0) >= 60 ? '#34d399' : '#F59E0B' }}>
                                    {liveData.gold.iaScore || 0}%
                                </p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-1">{liveData.gold.cortexHumor || 'ANALÍTICO'}</p>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/15 p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Predição 5M</p>
                                <p className="text-xl font-black italic" style={{ color: liveData.gold.predictions?.m5?.direction === 'UP' ? '#34d399' : '#ef4444' }}>
                                    {liveData.gold.predictions?.m5?.direction || 'FLAT'} ({liveData.gold.predictions?.m5?.confidence || 0}%)
                                </p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-1">
                                    15M: {liveData.gold.predictions?.m15?.direction || 'FLAT'} ({liveData.gold.predictions?.m15?.confidence || 0}%)
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ALPHA PREDICT ENGINE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Brain size={150} className="text-indigo-500" />
                </div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="max-w-xl">
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                            <Sparkles size={14} className="animate-pulse" /> Alpha Predict Engine v3.0
                        </h3>
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">Matriz de Probabilidade de Confluência</h2>
                        <p className="text-slate-500 text-xs font-bold leading-relaxed mb-6">
                            Nossa I.A. cruzou <span className="text-white">Ativos + Setups + Ciclos de Horários</span> para identificar estas oportunidades de alta assertividade.
                        </p>
                        <div className="flex flex-wrap gap-3 mb-8">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <CheckCircle2 size={10} className="text-emerald-400" />
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Altíssima Confiança (+85%)</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                <Brain size={10} className="text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Cálculo Neural Ativo</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-white/5 rounded-full">
                                <HelpCircle size={10} className="text-slate-400" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Baseado em Volume + WinRate</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 w-full lg:w-auto overflow-x-auto pb-6 lg:pb-0 alpha-scrollbar">
                        {data.neuralMatrix.slice(0, 3).map((item, idx) => (
                            <motion.div key={idx} whileHover={{ y: -5 }} className="min-w-[240px] bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all relative overflow-hidden">
                                {item.score >= 85 && (
                                    <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
                                )}
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex flex-col gap-1">
                                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[7px] font-black uppercase tracking-widest w-fit">Ativo</span>
                                        <span className="text-sm font-black text-white italic tracking-tight">{item.active}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center justify-end gap-1 mb-1">
                                            <Brain size={12} className={item.score >= 85 ? 'text-emerald-400' : 'text-indigo-400'} />
                                            <span className={`text-base font-black ${item.score >= 85 ? 'text-emerald-400' : 'text-white'}`}>{item.score}%</span>
                                        </div>
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Confiança Alpha</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-xl group-hover:bg-indigo-500/10 transition-colors">
                                            <Zap size={12} className="text-indigo-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-bold text-slate-500 uppercase">Estratégia Base</span>
                                            <span className="text-[10px] font-black text-white italic">{item.setup}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-xl group-hover:bg-amber-500/10 transition-colors">
                                            <Clock size={12} className="text-amber-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-bold text-slate-500 uppercase">Janela de Assertividade</span>
                                            <span className="text-[10px] font-black text-white italic">{item.hour} (±30m)</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Aderência Histórica</span>
                                        <span className="text-[8px] font-black text-white">{item.winRate}% Win</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${item.score}%` }}
                                            className={`h-full shadow-[0_0_15px_rgba(99,102,241,0.3)] ${item.score >= 85 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {data.neuralMatrix.length === 0 && (
                            <div className="p-8 text-center border border-dashed border-white/10 rounded-3xl w-full">
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Aguardando Padrões de Confluência...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {hasData ? (
                <>
                    {/* CHARTS GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* EQUITY CURVE */}
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Caminho do Patrimônio</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.equityCurve}>
                                        <defs>
                                            <linearGradient id="colorEquityAI" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" hide />
                                        <YAxis stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem' }} itemStyle={{ color: '#818CF8', fontWeight: 'bold' }} />
                                        <Area type="monotone" dataKey="equity" stroke="#818CF8" strokeWidth={4} fillOpacity={1} fill="url(#colorEquityAI)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* WIN/LOSS PIE */}
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Eficiência de Estratégia</h3>
                                <span className={`px-3 py-1 ${Number(avgWinRate) >= 60 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} rounded-full text-[8px] font-black uppercase tracking-widest border`}>
                                    {Number(avgWinRate) >= 60 ? 'Excelente Performance' : 'Performance Regular'}
                                </span>
                            </div>
                            <div className="h-[300px] flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem', fontSize: '12px', fontWeight: 'bold' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-black text-white italic">{avgWinRate}%</span>
                                    <span className="text-[8px] font-black text-slate-500 uppercase">% Acerto</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-center">
                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Vitórias</p>
                                    <p className="text-xl font-black text-white italic">{totalWinsCount}</p>
                                </div>
                                <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 text-center">
                                    <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Derrotas</p>
                                    <p className="text-xl font-black text-white italic">{totalLossesCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TEMPORAL SUMMARY */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['today', 'weekly', 'monthly'].map((period) => {
                            const pData = data.periods[period as keyof typeof data.periods];
                            const label = period === 'today' ? 'Hoje (24h)' : period === 'weekly' ? 'Semana (7d)' : 'Mês (30d)';
                            const iconColor = period === 'today' ? 'text-indigo-400' : period === 'weekly' ? 'text-purple-400' : 'text-emerald-400';
                            const iconBg = period === 'today' ? 'bg-indigo-500/10' : period === 'weekly' ? 'bg-purple-500/10' : 'bg-emerald-500/10';
                            return (
                                <motion.div key={period} whileHover={{ y: -4 }} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-2 rounded-xl ${iconBg} ${iconColor}`}>
                                            <Calendar size={18} />
                                        </div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lucro Líquido</span>
                                            <span className={`text-xl font-black italic ${pData.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                ${pData.profit.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                                                <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5 tracking-widest">Assertiv.</p>
                                                <p className="text-sm font-black text-white">{pData.winRate}%</p>
                                            </div>
                                            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                                                <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5 tracking-widest">Operações</p>
                                                <p className="text-sm font-black text-white">{pData.totalTrades}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <div className="flex gap-2 text-[8px] font-black">
                                                <span className="text-emerald-400">W: {pData.winTrades}</span>
                                                <span className="text-red-400">L: {pData.lossTrades}</span>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-500 uppercase">PF: {pData.profitFactor}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* ORIGIN COMPARISON */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-2">
                            <Zap className="text-amber-400" size={20} /> Comparativo de Origem
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                            {groupedOrigins.map((origin, idx) => {
                                const IconEl = origin.icon;
                                const avgTrade = origin.trades > 0 ? (origin.profit / origin.trades) : 0;
                                const bestOrigin = [...groupedOrigins].sort((a, b) => b.profit - a.profit)[0];
                                const isBest = origin.profit >= bestOrigin.profit && origin.trades > 0;
                                return (
                                    <motion.div key={origin.name} whileHover={{ y: -4 }} className="relative group">
                                        <div className={`absolute -inset-0.5 bg-gradient-to-r ${origin.gradient} rounded-2xl opacity-10 group-hover:opacity-25 transition duration-500 blur-sm`} />
                                        <div className="relative bg-slate-950/60 p-5 rounded-2xl border border-white/5 backdrop-blur-sm h-full">
                                            {isBest && (
                                                <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[7px] font-black text-emerald-400 uppercase tracking-widest">
                                                    Líder
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${origin.color}15`, color: origin.color }}>
                                                    <IconEl size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-black italic uppercase tracking-tighter text-sm">{origin.name}</h4>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                        {origin.trades > 0 ? origin.trades + ' trades' : 'Sem dados'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-end justify-between">
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">P&L</span>
                                                    <span className="text-xl font-black italic" style={{ color: origin.trades === 0 ? '#64748b' : origin.profit >= 0 ? '#34d399' : '#ef4444' }}>
                                                        {origin.trades > 0 ? '$' + origin.profit.toFixed(2) : '---'}
                                                    </span>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Médio/Trade</span>
                                                    <span className="text-xs font-black" style={{ color: origin.trades === 0 ? '#64748b' : avgTrade >= 0 ? '#34d399' : '#ef4444' }}>
                                                        {origin.trades > 0 ? '$' + avgTrade.toFixed(2) : '---'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Acerto</p>
                                                        <p className={`text-sm font-black ${origin.trades === 0 ? 'text-slate-500' : origin.winRate >= 50 ? 'text-emerald-400' : origin.winRate > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                                            {origin.trades > 0 ? origin.winRate.toFixed(1) + '%' : '---'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">PF</p>
                                                        <p className={`text-sm font-black ${origin.trades === 0 || origin.profitFactor === 0 ? 'text-slate-500' : origin.profitFactor >= 1.5 ? 'text-emerald-400' : origin.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                                                            {origin.trades > 0 ? origin.profitFactor.toFixed(2) : '---'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[...groupedOrigins].sort((a, b) => b.profit - a.profit)} layout="vertical" margin={{ left: 60, right: 60 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} fontWeight="bold" width={90} />
                                    <Tooltip cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem' }}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Lucro']} />
                                    <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={20}>
                                        {[...groupedOrigins].sort((a, b) => b.profit - a.profit).map((entry) => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ASSET RANKING */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-2">
                            <BarChart3 className="text-indigo-500" size={20} /> Ranking de Ativos Dominantes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {data.assets.slice(0, 4).map((asset, idx) => (
                                <motion.div key={idx} whileHover={{ y: -4 }} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 hover:border-indigo-500/20 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-base font-black text-white italic">{asset.name}</span>
                                        <ArrowUpRight size={14} className="text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform shrink-0" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro</span>
                                            <span className="text-sm font-black text-emerald-400">${asset.profit}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assertiv.</span>
                                            <span className="text-sm font-black text-white">{asset.winRate}%</span>
                                        </div>
                                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500" style={{ width: `${asset.winRate}%` }} />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-16 text-center relative overflow-hidden">
                    <div className="p-6 bg-indigo-500/10 rounded-full mb-6 inline-block">
                        <Activity className="text-indigo-500 animate-pulse" size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Aguardando Operações</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                        Seus gráficos de performance serão gerados assim que você fechar seu primeiro trade.
                    </p>
                    <div className="mt-8 flex gap-4 justify-center">
                        <span className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronização OK</span>
                        <span className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bridge Ativa</span>
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
                <div className="flex items-center gap-4">
                    <ShieldCheck size={24} className="text-indigo-500 shrink-0" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                        Sincronização Institucional Ativa: <span className="text-white font-black">Alpha Discovery v2.0</span> processando fluxos de ordens e liquidez internacional.
                        <span className="text-amber-400 font-black ml-2">RECOMENDAÇÃO: Siga os insights da I.A. acima para maximizar sua eficiência operacional.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
