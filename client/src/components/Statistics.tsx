import React, { useState, useEffect } from 'react';
import {
    BarChart2, TrendingUp, TrendingDown, Activity, PieChart as PieIcon,
    Calendar, DollarSign, Target, Layers, Percent, Cpu
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import axios from 'axios';

const COLORS = {
    win: '#16A34A',
    loss: '#EF4444',
    tie: '#6B7280',
    grid: '#1e293b',
    text: '#94a3b8'
};

export const Statistics: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const resp = await axios.get('/api/mt5/gold-scalper/statistics');
            setData(resp.data);
            setLoading(false);
        } catch (err) {
            console.error('Stats error:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">Carregando estatísticas...</span>
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const raw = payload[0]?.payload;
            return (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl">
                    <p className="text-xs font-bold text-slate-400 mb-1">
                        {raw?.date ? `${raw.date} — Trade ${label}` : label}
                    </p>
                    {payload.map((p: any, i: number) => (
                        <p key={i} className={`text-sm font-black ${p.fill || p.stroke || '#fff'}`}>
                            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const s = data?.summary || {};
    const totalTrades = data?.totalTrades || 0;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-sky-500/10 rounded-3xl border border-sky-500/20 shadow-xl shadow-sky-500/10">
                        <BarChart2 size={40} className="text-sky-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Estatísticas</span>
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-sky-500/10 border border-sky-500/20 text-sky-500">
                                Analítico
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-sky-400" /> Análise completa de performance
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                    <Activity size={14} className="text-sky-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{totalTrades.toLocaleString()} trades analisados</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                    { label: 'Total Trades', value: totalTrades.toLocaleString(), color: 'text-sky-400', icon: <Layers size={16} /> },
                    { label: 'Ganhos', value: s.wins?.toLocaleString() || '0', color: 'text-trader-green', icon: <TrendingUp size={16} /> },
                    { label: 'Perdas', value: s.losses?.toLocaleString() || '0', color: 'text-trader-red', icon: <TrendingDown size={16} /> },
                    { label: '% Acerto', value: `${s.winRate || 0}%`, color: (s.winRate || 0) >= 50 ? 'text-trader-green' : 'text-trader-red', icon: <Percent size={16} /> },
                    { label: 'Fator Lucro', value: (s.profitFactor || 0).toFixed(2), color: (s.profitFactor || 0) >= 1.2 ? 'text-trader-green' : 'text-trader-red', icon: <Target size={16} /> },
                    { label: 'Total P&L', value: `$${(s.totalProfit || 0).toFixed(2)}`, color: (s.totalProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <DollarSign size={16} /> },
                    { label: 'Méd Trade', value: totalTrades > 0 ? `$${((s.totalProfit || 0) / totalTrades).toFixed(2)}` : '$0', color: ((s.totalProfit || 0) / totalTrades) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <BarChart2 size={16} /> }
                ].map((kpi, i) => (
                    <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-sky-500/20 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                            <span className={`${kpi.color} opacity-60`}>{kpi.icon}</span>
                        </div>
                        <span className={`text-2xl font-black italic ${kpi.color}`}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Charts Row 1: Equity Curve + Win/Loss Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Equity Curve */}
                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Curva de Equity (últimos 200 trades)</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.equityCurve || []}>
                                <defs>
                                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                                <XAxis dataKey="trade" tick={{ fill: COLORS.text, fontSize: 10 }} />
                                <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#eqGrad)" strokeWidth={2} name="Equity" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Win/Loss Pie */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <PieIcon size={16} className="text-sky-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Distribuição Win/Loss</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <defs>
                                    {(data?.winLossPie || []).map((entry: any, idx: number) => (
                                        <linearGradient key={idx} id={`pieGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor={entry.color} stopOpacity={0.7} />
                                            <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <Pie
                                    data={data?.winLossPie || []}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={95}
                                    paddingAngle={4}
                                    dataKey="value"
                                    animationBegin={0}
                                    animationDuration={800}
                                    animationEasing="ease-out"
                                >
                                    {(data?.winLossPie || []).map((entry: any, idx: number) => (
                                        <Cell key={idx} fill={`url(#pieGrad${idx})`} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <text x="50%" y="47%" textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={800} fontFamily="monospace">
                                    Total
                                </text>
                                <text x="50%" y="60%" textAnchor="middle" fill="#fff" fontSize={22} fontWeight={900} fontFamily="monospace">
                                    {data?.winLossPie?.reduce((s: number, e: any) => s + e.value, 0) || 0}
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-5 text-xs font-bold mt-1">
                        {(data?.winLossPie || []).map((entry: any, idx: number) => {
                            const total = (data?.winLossPie || []).reduce((s: number, e: any) => s + e.value, 0);
                            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                            return (
                                <span key={idx} className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                                    <span className="text-slate-400">{entry.name}</span>
                                    <span className="text-white font-mono">{entry.value}</span>
                                    <span className="text-slate-600">({pct}%)</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Daily P&L + Profit Histogram */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily P&L Bars */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign size={16} className="text-amber-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">P&L Diário</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.dailyPL || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                                <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="profit" name="P&L">
                                    {(data?.dailyPL || []).map((entry: any, idx: number) => (
                                        <Cell key={idx} fill={entry.profit >= 0 ? '#16A34A' : '#EF4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Profit Histogram */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart2 size={16} className="text-violet-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Histograma de Resultados</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.profitHistogram || []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                                <XAxis type="number" tick={{ fill: COLORS.text, fontSize: 10 }} />
                                <YAxis type="category" dataKey="label" tick={{ fill: COLORS.text, fontSize: 9 }} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Trades">
                                    {(data?.profitHistogram || []).map((entry: any, idx: number) => (
                                        <Cell key={idx} fill={entry.direction === 'win' ? '#16A34A' : '#EF4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Day of Week Performance */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={16} className="text-sky-400" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Performance por Dia da Semana</span>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.byDayOfWeek || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                            <XAxis dataKey="day" tick={{ fill: COLORS.text, fontSize: 12 }} />
                            <YAxis yAxisId="left" tick={{ fill: COLORS.text, fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: COLORS.text, fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar yAxisId="left" dataKey="trades" fill="#3b82f6" name="Trades" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="winRate" fill="#10b981" name="Win Rate %" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Summary Stats Table */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-4">Resumo Geral</span>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <tbody>
                            {[
                                { label: 'Total de Trades', value: totalTrades.toLocaleString() },
                                { label: 'Total Ganhos', value: (s.wins || 0).toLocaleString(), color: 'text-trader-green' },
                                { label: 'Total Perdas', value: (s.losses || 0).toLocaleString(), color: 'text-trader-red' },
                                { label: '% Acerto', value: `${s.winRate || 0}%`, color: (s.winRate || 0) >= 50 ? 'text-trader-green' : 'text-trader-red' },
                                { label: 'Fator Lucro', value: (s.profitFactor || 0).toFixed(2), color: (s.profitFactor || 0) >= 1.2 ? 'text-trader-green' : 'text-trader-red' },
                                { label: 'Total P&L', value: `$${(s.totalProfit || 0).toFixed(2)}`, color: (s.totalProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red' },
                                { label: 'Méd G', value: `$${s.avgWin || '0'}`, color: 'text-trader-green' },
                                { label: 'Méd P', value: `-$${s.avgLoss || '0'}`, color: 'text-trader-red' },
                                { label: 'Melhor Trade', value: `$${s.bestTrade || '0'}`, color: 'text-emerald-400' },
                                { label: 'Pior Trade', value: `-$${Math.abs(s.worstTrade || 0)}`, color: 'text-red-400' },
                                { label: 'Sequência Atual', value: s.currentStreak > 0 ? `${s.currentStreak} ${s.streakType === 'WIN' ? 'Vitórias' : 'Perdas'}` : 'N/A', color: s.streakType === 'WIN' ? 'text-trader-green' : 'text-trader-red' }
                            ].map((row, i) => (
                                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                    <td className="py-2 pr-6 font-bold text-slate-400">{row.label}</td>
                                    <td className={`py-2 font-black text-right ${row.color || 'text-white'} font-mono`}>{row.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
