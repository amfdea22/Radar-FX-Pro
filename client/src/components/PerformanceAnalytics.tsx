import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
    TrendingUp, Activity, Target, Zap, History, Calendar,
    ShieldCheck, Sparkles, Brain, Clock, BarChart3, ArrowUpRight,
    Info, HelpCircle, CheckCircle2, AlertTriangle, User, Cpu
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
                <Brain className="text-trader-blue animate-pulse" size={64} />
                <div className="absolute -inset-4 bg-trader-blue/20 blur-xl rounded-full"></div>
            </div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-bounce">Sintonizando I.A. de Performance...</p>
        </div>
    );

    const totalProfit = data.assets.reduce((sum, a) => sum + a.profit, 0);
    const totalTrades = data.assets.reduce((sum, a) => sum + a.trades, 0);
    const avgWinRate = data.assets.length > 0
        ? (data.assets.reduce((sum, a) => sum + a.winRate, 0) / data.assets.length).toFixed(1)
        : '0';

    const hasData = data.assets.length > 0;

    // Agrupar origens em Manual vs Robô vs Sinais
    const groupedOrigins = (() => {
        const robotOrigins = ['Alpha Robot', 'Gold Scalper', 'Supreme Engine', 'Omni Probabilistic', 'Social Trading'];
        const robo = data.origins.filter(o => robotOrigins.includes(o.name));
        const sinais = data.origins.filter(o => o.name === 'Sinais');
        const manual = data.origins.filter(o => o.name === 'Manual');

        const aggregate = (items: typeof data.origins) => {
            const profit = items.reduce((s, o) => s + o.profit, 0);
            const trades = items.reduce((s, o) => s + o.trades, 0);
            const totalWins = items.reduce((s, o) => s + (o.winRate / 100) * o.trades, 0);
            const winRate = trades > 0 ? Number(((totalWins / trades) * 100).toFixed(1)) : 0;
            const profitFactor = items.length > 0 ? Number((items.reduce((s, o) => s + o.profitFactor, 0) / items.length).toFixed(2)) : 0;
            return { profit, trades, winRate, profitFactor };
        };

        return [
            { name: 'Manual', icon: User, color: '#94A3B8', gradient: 'from-slate-500 to-slate-400', ...aggregate(manual) },
            { name: 'Robô', icon: Brain, color: '#00A3FF', gradient: 'from-trader-blue to-purple-600', ...aggregate(robo) },
            { name: 'Sinais', icon: Zap, color: '#FBBF24', gradient: 'from-trader-amber to-orange-600', ...aggregate(sinais) },
        ];
    })();

    // Cálculo para o Gráfico de Pizza
    const totalWinsCount = data.assets.reduce((sum, a) => sum + Math.round((a.winRate / 100) * a.trades), 0);
    const totalLossesCount = Math.max(0, totalTrades - totalWinsCount);
    const pieData = [
        { name: 'Vitórias', value: totalWinsCount, color: '#10b981' },
        { name: 'Derrotas', value: totalLossesCount, color: '#ef4444' }
    ];

    return (
        <div className="p-8 space-y-8 bg-slate-950/20 rounded-[3rem] border border-white/5 backdrop-blur-3xl min-h-screen relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-trader-blue/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-trader-blue/10 rounded-xl border border-trader-blue/20">
                            <Sparkles className="text-trader-blue" size={24} />
                        </div>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Radar Intelligence</h2>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-1">Análise Avançada de Performance | Motores IA & Métricas em Tempo Real</p>
                </div>

                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setLoading(true);
                            fetchData();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 hover:bg-trader-blue/10 border border-white/5 hover:border-trader-blue/30 rounded-xl transition-all group"
                    >
                        <Activity className={`text-trader-blue ${loading ? 'animate-spin' : 'group-hover:animate-pulse'}`} size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sincronizar Gráficos</span>
                    </motion.button>
                </div>
            </div>

            {/* Live Radar FX Engine Status */}
            {liveData && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 relative z-10">
                    {[
                        { id: 'gold', name: 'Gold Scalper', active: liveData.gold?.enabled, color: '#F59E0B', score: liveData.gold?.iaScore },
                        { id: 'crypto', name: 'Crypto IA', active: liveData.crypto?.settings?.enabled, color: '#8B5CF6', score: liveData.crypto?.neuroScores?.overall },
                        { id: 'swing', name: 'Swing Trader', active: liveData.swing?.settings?.enabled, color: '#06B6D4' },
                        { id: 'omni', name: 'Omni Prob.', active: liveData.omni?.settings?.enabled, color: '#EC4899' },
                        { id: 'supreme', name: 'Supreme AI', active: liveData.supreme?.status === 'ACTIVE', color: '#10B981', score: liveData.supreme?.confluencePower },
                        { id: 'robot', name: 'Alpha Robot', active: liveData.robot?.enabled, color: '#6366F1', score: liveData.robot?.totalWins ? Math.round(liveData.robot.totalWins / ((liveData.robot.totalWins || 0) + (liveData.robot.totalLosses || 0)) * 100) : 0 },
                    ].map(eng => (
                        <div key={eng.id} className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 hover:border-violet-500/20 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{eng.name}</span>
                                <span className={`w-2 h-2 rounded-full ${eng.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                            </div>
                            {eng.score != null && (
                                <div className="text-sm font-black font-mono" style={{ color: eng.color }}>{eng.score}%</div>
                            )}
                            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mt-1">
                                {eng.active ? 'Ativo' : 'Inativo'}
                            </div>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* AI Insights Panel - THE BRAIN */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10"
            >
                <div className="lg:col-span-2 bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-trader-blue/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Brain size={120} className="text-trader-blue" />
                    </div>

                    <h3 className="text-xs font-black text-trader-blue uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Activity size={14} /> Insights do Analista Virtual
                    </h3>

                    <div className="space-y-4">
                        {data.aiInsights.map((insight, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.2 }}
                                className="flex items-start gap-4 p-4 bg-trader-blue/5 border border-trader-blue/10 rounded-2xl group hover:bg-trader-blue/10 transition-all"
                            >
                                <div className="mt-1 p-1 bg-trader-blue/20 rounded-md">
                                    <Target className="text-trader-blue" size={12} />
                                </div>
                                <p className="text-sm font-bold text-slate-300 leading-relaxed italic">{insight}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Core Metrics Quick View + Live Radar FX */}
                <div className="space-y-4">
                    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-trader-green/30 transition-all shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Acumulado Total</p>
                            <p className={`text-2xl font-black italic ${totalProfit >= 0 ? 'text-trader-green drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-trader-red'}`}>
                                ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <TrendingUp size={32} className="text-trader-green opacity-20" />
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-trader-amber/30 transition-all shadow-[0_0_15px_rgba(251,191,36,0.05)] hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Taxa Média Win</p>
                            <p className="text-2xl font-black text-trader-amber italic drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{avgWinRate}%</p>
                        </div>
                        <Target size={32} className="text-trader-amber opacity-20" />
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-trader-blue/30 transition-all shadow-[0_0_15px_rgba(0,163,255,0.05)] hover:shadow-[0_0_20px_rgba(0,163,255,0.1)]">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Volume de Trades</p>
                            <p className="text-2xl font-black text-trader-blue italic drop-shadow-[0_0_8px_rgba(0,163,255,0.3)]">{totalTrades}</p>
                        </div>
                        <History size={32} className="text-trader-blue opacity-20" />
                    </div>
                    {liveData?.gold && (
                        <>
                            <div className="bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 p-6 rounded-3xl">
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">Neuro Score</p>
                                <p className="text-3xl font-black font-mono" style={{ color: (liveData.gold.iaScore || 0) >= 60 ? '#10B981' : '#F59E0B' }}>
                                    {liveData.gold.iaScore || 0}%
                                </p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{liveData.gold.cortexHumor || 'ANALÍTICO'}</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-6 rounded-3xl">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Predição 5M</p>
                                <p className="text-lg font-black" style={{ color: liveData.gold.predictions?.m5?.direction === 'UP' ? '#10B981' : '#EF4444' }}>
                                    {liveData.gold.predictions?.m5?.direction || 'FLAT'} ({liveData.gold.predictions?.m5?.confidence || 0}%)
                                </p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                                    15M: {liveData.gold.predictions?.m15?.direction || 'FLAT'} ({liveData.gold.predictions?.m15?.confidence || 0}%)
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {/* ALPHA PREDICT: NEW PREDICTIVE ENGINE WIDGET */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10"
            >
                <div className="bg-gradient-to-r from-trader-blue/10 via-purple-500/10 to-transparent p-1 rounded-[2.5rem]">
                    <div className="bg-slate-950/80 backdrop-blur-2xl p-8 rounded-[2.4rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Brain size={150} className="text-trader-blue" />
                        </div>

                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                            <div className="max-w-xl">
                                <h3 className="text-xs font-black text-trader-blue uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                                    <Sparkles size={14} className="animate-pulse" /> Alpha Predict Engine v3.0
                                </h3>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">Matriz de Probabilidade de Confluência</h2>
                                <p className="text-slate-500 text-xs font-bold leading-relaxed mb-6">
                                    Nossa I.A. cruzou <span className="text-white">Ativos + Setups + Ciclos de Horários</span> para identificar estas oportunidades de alta assertividade. Filtre seus trades pelos sinais abaixo.
                                </p>

                                {/* Explainer Tags */}
                                <div className="flex flex-wrap gap-3 mb-8">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-trader-green/10 border border-trader-green/20 rounded-full">
                                        <CheckCircle2 size={10} className="text-trader-green" />
                                        <span className="text-[9px] font-black text-trader-green uppercase tracking-wider">Altíssima Confiança (+85%)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-trader-blue/10 border border-trader-blue/20 rounded-full">
                                        <Brain size={10} className="text-trader-blue" />
                                        <span className="text-[9px] font-black text-trader-blue uppercase tracking-wider">Cálculo Neural Ativo</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-white/5 rounded-full">
                                        <HelpCircle size={10} className="text-slate-400" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Baseado em Volume + WinRate</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full lg:w-auto overflow-x-auto pb-6 lg:pb-0 alpha-scrollbar">
                                {data.neuralMatrix.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="min-w-[240px] bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 hover:border-trader-blue/40 transition-all group relative overflow-hidden backdrop-blur-sm">
                                        {/* Background Pulse for High Scores */}
                                        {item.score >= 85 && (
                                            <div className="absolute inset-0 bg-trader-green/5 animate-pulse pointer-events-none" />
                                        )}

                                        <div className="flex justify-between items-start mb-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[7px] font-black uppercase tracking-widest w-fit">Ativo</span>
                                                <span className="text-sm font-black text-white italic tracking-tight">{item.active}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-1 mb-1">
                                                    <Brain size={12} className={item.score >= 85 ? 'text-trader-green' : 'text-trader-blue'} />
                                                    <span className={`text-base font-black ${item.score >= 85 ? 'text-trader-green' : 'text-white'}`}>{item.score}%</span>
                                                </div>
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none">Confiança Alpha</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-900 rounded-xl group-hover:bg-trader-blue/10 transition-colors">
                                                    <Zap size={12} className="text-trader-blue" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">Estratégia Base</span>
                                                    <span className="text-[10px] font-black text-white italic">{item.setup}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-900 rounded-xl group-hover:bg-trader-amber/10 transition-colors">
                                                    <Clock size={12} className="text-trader-amber" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">Janela de Assertividade</span>
                                                    <span className="text-[10px] font-black text-white italic">{item.hour} (±30m)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <div className="flex justify-between items-center mb-1.5 px-0.5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Aderência Histórica</span>
                                                <span className="text-[8px] font-black text-white">{item.winRate}% Win</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${item.score}%` }}
                                                    className={`h-full shadow-[0_0_15px_rgba(0,163,255,0.5)] ${item.score >= 85 ? 'bg-trader-green shadow-trader-green/20' : 'bg-trader-blue'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {data.neuralMatrix.length === 0 && (
                                    <div className="p-8 text-center border border-dashed border-white/10 rounded-3xl w-full">
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Aguardando Padrões de Confluência...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {hasData ? (
                <>
                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                        {/* Equity Path */}
                        <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-white text-lg font-black uppercase tracking-tighter italic">Caminho do Patrimônio</h3>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Equity Evolution Curve</p>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.equityCurve}>
                                        <defs>
                                            <linearGradient id="colorEquityAI" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#00A3FF" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#00A3FF" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" hide />
                                        <YAxis stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem' }}
                                            itemStyle={{ color: '#00A3FF', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="equity" stroke="#00A3FF" strokeWidth={4} fillOpacity={1} fill="url(#colorEquityAI)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Win/Loss Efficiency (Pie Chart) */}
                        <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6">
                                <span className={`px-3 py-1 ${Number(avgWinRate) >= 60 ? 'bg-trader-green/20 text-trader-green border-trader-green/30' : 'bg-trader-amber/20 text-trader-amber border-trader-amber/30'} rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse`}>
                                    {Number(avgWinRate) >= 60 ? '💎 Excelente Performance' : '⚖️ Performance Regular'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-white text-lg font-black uppercase tracking-tighter italic">Eficiência de Estratégia</h3>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Proporção Global Win vs Loss</p>
                                </div>
                            </div>
                            <div className="h-[300px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #1e293b',
                                                borderRadius: '1rem',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white italic">{avgWinRate}%</span>
                                    <span className="text-[8px] font-black text-slate-500 uppercase">% Acerto</span>
                                </div>
                            </div>

                            {/* Win/Loss Numerical Details */}
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-trader-green/10 p-4 rounded-2xl border border-trader-green/20 text-center">
                                    <p className="text-[8px] font-black text-trader-green uppercase tracking-widest mb-1">Vitórias</p>
                                    <p className="text-xl font-black text-white italic">{totalWinsCount}</p>
                                </div>
                                <div className="bg-trader-red/10 p-4 rounded-2xl border border-trader-red/20 text-center">
                                    <p className="text-[8px] font-black text-trader-red uppercase tracking-widest mb-1">Derrotas</p>
                                    <p className="text-xl font-black text-white italic">{totalLossesCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Temporal Summary Row (New Section requested) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                        {['today', 'weekly', 'monthly'].map((period) => {
                            const pData = data.periods[period as keyof typeof data.periods];
                            const label = period === 'today' ? 'Hoje (24h)' : period === 'weekly' ? 'Semana (7d)' : 'Mês (30d)';
                            const iconColor = period === 'today' ? 'text-trader-blue' : period === 'weekly' ? 'text-purple-500' : 'text-emerald-500';

                            return (
                                <div key={period} className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-white/10 transition-all">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-2 bg-white/5 rounded-xl ${iconColor}`}>
                                            <Calendar size={18} />
                                        </div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Lucro Líquido</p>
                                            <p className={`text-lg font-black italic ${pData.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                ${pData.profit.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5">Assertiv.</p>
                                                <p className="text-xs font-black text-white">{pData.winRate}%</p>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5">Operações</p>
                                                <p className="text-xs font-black text-white">{pData.totalTrades}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <div className="flex gap-2">
                                                <span className="text-[7px] font-black text-trader-green">W: {pData.winTrades}</span>
                                                <span className="text-[7px] font-black text-trader-red">L: {pData.lossTrades}</span>
                                            </div>
                                            <span className="text-[7px] font-black text-slate-500 uppercase">PF: {pData.profitFactor}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Origin Performance Comparison — Manual vs Robô vs Sinais */}
                    <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl relative z-10 overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-white text-lg font-black uppercase tracking-tighter italic flex items-center gap-2">
                                    <Zap size={20} className="text-trader-amber" /> Comparativo de Origem
                                </h3>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Manual vs Robô vs Sinais</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {groupedOrigins.map((origin, idx) => {
                                const Icon = origin.icon;
                                return (
                                    <div key={origin.name} className="relative group">
                                        <div className={`absolute -inset-0.5 bg-gradient-to-r ${origin.gradient} rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500`}></div>
                                        <div className="relative bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
                                            <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${origin.color}15`, color: origin.color }}>
                                                <Icon size={24} />
                                            </div>
                                            <h4 className="text-white font-black italic uppercase tracking-tighter">{origin.name}</h4>
                                            <div className="mt-4 space-y-2 w-full">
                                                <div className="text-3xl font-black" style={{ color: origin.profit >= 0 ? '#10B981' : '#EF4444' }}>
                                                    ${origin.profit.toFixed(2)}
                                                </div>
                                                <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase">
                                                    <span className={origin.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                                                        {origin.winRate}% Acerto
                                                    </span>
                                                    <span className="text-slate-600">|</span>
                                                    <span className="text-slate-400">{origin.trades} Trades</span>
                                                    <span className="text-slate-600">|</span>
                                                    <span className="text-slate-400">PF {origin.profitFactor}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={groupedOrigins} layout="vertical" margin={{ left: 50, right: 60 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} fontWeight="black" width={80} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem' }}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Lucro']}
                                    />
                                    <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={24}>
                                        {groupedOrigins.map((entry) => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Assets Table/Ranking Mini */}
                    <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl relative z-10">
                        <h3 className="text-white text-lg font-black uppercase tracking-tighter italic mb-8 flex items-center gap-2">
                            <BarChart3 size={20} className="text-trader-blue" /> Ranking de Ativos Dominantes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {data.assets.slice(0, 4).map((asset, idx) => (
                                <div key={idx} className="bg-slate-950/60 p-5 rounded-3xl border border-slate-800 hover:border-trader-blue/30 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-sm font-black text-white italic">{asset.name}</span>
                                        <ArrowUpRight size={14} className="text-trader-green group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro</span>
                                            <span className="text-md font-black text-trader-green">${asset.profit}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assertiv.</span>
                                            <span className="text-md font-black text-white">{asset.winRate}%</span>
                                        </div>
                                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-trader-blue" style={{ width: `${asset.winRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center p-20 bg-slate-900/40 border border-slate-800 rounded-[3rem] text-center relative z-10"
                >
                    <div className="p-6 bg-trader-blue/10 rounded-full mb-6 relative">
                        <Activity className="text-trader-blue animate-pulse" size={48} />
                        <div className="absolute inset-0 bg-trader-blue/20 blur-2xl rounded-full"></div>
                    </div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Aguardando Operações</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                        Seus gráficos de performance serão gerados assim que você fechar seu primeiro trade no MetaTrader 5.
                        Nossa I.A. está de prontidão para analisar cada detalhe da sua jornada.
                    </p>
                    <div className="mt-8 flex gap-4">
                        <div className="px-4 py-2 bg-slate-800 rounded-xl border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Sincronização OK
                        </div>
                        <div className="px-4 py-2 bg-slate-800 rounded-xl border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Bridge Ativa
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Heatmap/Daily Status Footer */}
            <div className="flex items-center gap-4 p-6 bg-trader-blue/5 border border-trader-blue/20 rounded-[2rem] relative z-10">
                <ShieldCheck size={24} className="text-trader-blue shrink-0" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                    Sincronização Institucional Ativa: <span className="text-white font-black">Alpha Discovery v2.0</span> processando fluxos de ordens e liquidez internacional.
                    <span className="text-trader-amber font-black ml-2">RECOMENDAÇÃO: Siga os insights da I.A. acima para maximizar sua eficiência operacional.</span>
                </p>
            </div>
        </div>
    );
};
