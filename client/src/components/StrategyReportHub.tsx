import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    Trophy, TrendingUp, TrendingDown, Target, BarChart2, Award,
    Zap, Shield, Activity, RefreshCw, Cpu
} from 'lucide-react';

const API = '';

interface StrategyStats {
    name: string;
    category: string;
    asset: string;
    wins: number;
    losses: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
    color: string;
    trend: 'up' | 'down' | 'stable';
    totalProfit: number;
    signalsEmitted: number;
    source: 'MT5_REAL' | 'SIGNALS_ONLY' | 'NO_DATA';
}

const PieChart: React.FC<{ data: { label: string; value: number; color: string }[]; size?: number }> = ({ data, size = 220 }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;
    let currentAngle = -90;

    const slices = data.map((d, i) => {
        const percentage = d.value / total;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `Z`
        ].join(' ');

        const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
        const labelRadius = radius * 0.65;
        const labelX = cx + labelRadius * Math.cos(midAngle);
        const labelY = cy + labelRadius * Math.sin(midAngle);

        return (
            <g key={i}>
                <motion.path
                    d={pathData}
                    fill={d.color}
                    stroke="#0f172a"
                    strokeWidth="2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                />
                {percentage > 0.06 && (
                    <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                    >
                        {(percentage * 100).toFixed(0)}%
                    </text>
                )}
            </g>
        );
    });

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices}
            <circle cx={cx} cy={cy} r={radius * 0.38} fill="#0f172a" />
            <text x={cx} y={cy - 8} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">TOTAL</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{total}</text>
        </svg>
    );
};

export const StrategyReportHub: React.FC = () => {
    const [strategies, setStrategies] = useState<StrategyStats[]>([]);
    const [categories, setCategories] = useState<string[]>(['all']);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'winRate' | 'totalTrades' | 'profitFactor'>('winRate');

    const fetchData = async (forceSync = false) => {
        setLoading(true);
        try {
            const url = forceSync ? `/api/mt5/reports/sync` : `/api/mt5/reports/strategies`;
            const method = forceSync ? 'post' : 'get';

            const resp = await axios({ method, url });

            const reportData = forceSync ? resp.data.report : resp.data;
            const data = Array.isArray(reportData) ? reportData : [];

            setStrategies(data);
            setLastSync(new Date().toLocaleTimeString('pt-BR'));
        } catch (err) {
            console.error('❌ [Report] Erro ao buscar dados:', err);
            if (forceSync) fetchData(false);
        }
        setLoading(false);
    };

    const fetchCatalog = async () => {
        try {
            const resp = await axios.get('/api/mt5/reports/catalog');
            if (Array.isArray(resp.data)) {
                const cats = [...new Set(resp.data.map((s: any) => s.category).filter(Boolean))] as string[];
                setCategories(['all', ...cats]);
            }
        } catch {
            setCategories(['all', 'Cripto', 'Forex', 'Metais', 'Metais/Cripto', 'Ciclos']);
        }
    };

    useEffect(() => { fetchData(); fetchCatalog(); }, []);

    const filtered = strategies
        .filter(s => filter === 'all' || s.category === filter)
        .sort((a, b) => b[sortBy] - a[sortBy]);

    const totalWins = filtered.reduce((s, x) => s + x.wins, 0);
    const totalLosses = filtered.reduce((s, x) => s + x.losses, 0);
    const totalTrades = totalWins + totalLosses;
    const globalWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0';
    const totalProfit = filtered.reduce((s, x) => s + (x.totalProfit || 0), 0);

    const withTrades = filtered.filter(s => s.totalTrades > 0);
    const pieData = withTrades.map(s => ({ label: s.name, value: s.totalTrades, color: s.color }));
    const winLossPieData = [
        { label: 'Vitórias', value: totalWins, color: '#22c55e' },
        { label: 'Derrotas', value: totalLosses, color: '#ef4444' },
    ];



    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20 shadow-xl shadow-rose-500/10">
                        <BarChart2 size={40} className="text-rose-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-600">Relatório</span>
                            de Estratégias
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-rose-500/10 border border-rose-500/20 text-rose-500">
                                {strategies.length > 0 ? `${strategies.length} IAs` : 'CARREGANDO'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-rose-400" /> Performance completa de todas as I.A's do Radar FX
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                    <RefreshCw size={14} className={loading ? 'animate-spin text-rose-400' : 'text-rose-400'} />
                    <button
                        onClick={() => fetchData(true)}
                        disabled={loading}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        {loading ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                    {lastSync && (
                        <span className="text-[10px] text-slate-500 ml-2">· {lastSync}</span>
                    )}
                </div>
            </div>

            {/* FILTROS */}
            <div className="flex items-center gap-2 flex-wrap">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat as any)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filter === cat
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10'
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
                        }`}
                    >
                        {cat === 'all' ? 'Todas' : cat}
                    </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase">Ordenar:</span>
                    {([['winRate', '% Acerto'], ['totalTrades', 'Trades'], ['profitFactor', 'P. Factor']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key as any)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${sortBy === key
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800/30 text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total Trades', value: totalTrades, icon: Activity, color: 'from-blue-500 to-cyan-500', textColor: 'text-blue-400' },
                    { label: 'Vitórias', value: totalWins, icon: Trophy, color: 'from-emerald-500 to-green-500', textColor: 'text-emerald-400' },
                    { label: 'Perdas', value: totalLosses, icon: TrendingDown, color: 'from-red-500 to-rose-500', textColor: 'text-red-400' },
                    { label: '% Acerto', value: `${globalWinRate}%`, icon: Target, color: 'from-violet-500 to-purple-500', textColor: 'text-violet-400' },
                    {
                        label: 'Lucro Total',
                        value: `$${totalProfit.toFixed(2)}`,
                        icon: TrendingUp,
                        color: totalProfit >= 0 ? 'from-emerald-500 to-teal-500' : 'from-red-500 to-orange-500',
                        textColor: totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    },
                ].map((kpi, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-rose-500/20 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center opacity-60`}>
                                <kpi.icon size={14} className="text-white" />
                            </div>
                        </div>
                        <span className={`text-2xl font-black italic ${kpi.textColor}`}>{kpi.value}</span>
                    </motion.div>
                ))}
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Distribuição por Estratégia */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-rose-400" /> Distribuição por Estratégia
                    </h3>
                    <div className="flex items-center gap-6">
                        <PieChart data={pieData} size={220} />
                        <div className="flex-1 space-y-2 max-h-52 overflow-y-auto pr-2">
                            {pieData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                                    <span className="text-slate-300 flex-1 truncate">{d.label}</span>
                                    <span className="text-white font-bold">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Vitórias vs Derrotas */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Shield size={16} className="text-emerald-400" /> Vitórias vs Derrotas (Global)
                    </h3>
                    <div className="flex items-center gap-6">
                        <PieChart data={winLossPieData} size={220} />
                        <div className="flex-1 space-y-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-[10px] text-emerald-400 font-bold uppercase">Vitórias</p>
                                <p className="text-3xl font-black text-emerald-400">{totalWins}</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-[10px] text-red-400 font-bold uppercase">Derrotas</p>
                                <p className="text-3xl font-black text-red-400">{totalLosses}</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* TABELA DE ESTRATÉGIAS */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>

                <div className="flex items-center gap-2 mb-6">
                    <Award size={18} className="text-rose-400" />
                    <h3 className="text-sm font-bold text-white">Ranking de Performance — Todas as I.A's</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                                <th className="text-left p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estratégia</th>
                                <th className="text-left p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                                <th className="text-left p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ativo</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trades</th>
                                <th className="text-center p-4 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Vitórias</th>
                                <th className="text-center p-4 text-[10px] font-bold text-red-500 uppercase tracking-wider">Derrotas</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Acerto</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">P. Factor</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lucro</th>
                                <th className="text-center p-4 text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Sinais</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                                <th className="text-center p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s, i) => (
                                <motion.tr
                                    key={s.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`border-b border-white/5 transition-all ${i === 0
                                        ? 'bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent hover:from-rose-500/20 hover:via-pink-500/10 relative'
                                        : 'hover:bg-white/5'
                                    }`}
                                    style={i === 0 ? {
                                        boxShadow: '0 0 25px rgba(244, 63, 94, 0.12), 0 0 60px rgba(244, 63, 94, 0.06), inset 0 1px 0 rgba(244, 63, 94, 0.2)'
                                    } : {}}
                                >
                                    <td className="p-4">
                                        {i === 0 ? (
                                            <div className="flex items-center gap-1">
                                                <motion.div
                                                    animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                >
                                                    <Trophy size={18} className="text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                                                </motion.div>
                                                <span className="text-sm font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">1º</span>
                                            </div>
                                        ) : (
                                            <span className={`text-sm font-black ${i === 1 ? 'text-slate-300' : i === 2 ? 'text-rose-700' : 'text-slate-500'}`}>
                                                {i + 1}º
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-3 h-8 rounded-full ${i === 0 ? 'shadow-[0_0_10px_rgba(244,63,94,0.6)]' : ''}`}
                                                style={{ backgroundColor: s.color }}
                                            />
                                            <span className={`text-sm font-bold ${i === 0 ? 'text-rose-200 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]' : 'text-white'}`}>
                                                {i === 0 && '👑 '}{s.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${s.category === 'Cripto' ? 'bg-cyan-500/10 text-cyan-400' :
                                            s.category === 'Forex' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {s.category}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono">{s.asset}</td>
                                    <td className={`p-4 text-center text-sm font-bold ${i === 0 ? 'text-rose-200' : 'text-white'}`}>{s.totalTrades}</td>
                                    <td className="p-4 text-center text-sm font-bold text-emerald-400">{s.wins}</td>
                                    <td className="p-4 text-center text-sm font-bold text-red-400">{s.losses}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-sm font-black ${i === 0 ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                                                s.winRate >= 90 ? 'text-emerald-400' : s.winRate >= 85 ? 'text-blue-400' : 'text-amber-400'
                                            }`}>
                                                {s.winRate}%
                                            </span>
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-rose-500 to-pink-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]' :
                                                        s.winRate >= 90 ? 'bg-emerald-500' : s.winRate >= 85 ? 'bg-blue-500' : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${s.winRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`p-4 text-center text-sm font-bold ${i === 0 ? 'text-rose-300' : 'text-violet-400'}`}>{s.profitFactor}</td>
                                    <td className="p-4 text-center">
                                        <span className={`text-sm font-bold ${(s.totalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            ${(s.totalProfit || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-sm font-bold text-cyan-400">{s.signalsEmitted || 0}</td>
                                    <td className="p-4 text-center">
                                        <span className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase ${s.source === 'MT5_REAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            s.source === 'SIGNALS_ONLY' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                                'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                        }`}>
                                            {s.source === 'MT5_REAL' ? '● MT5 REAL' : s.source === 'SIGNALS_ONLY' ? '○ SINAIS' : '— SEM DADOS'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {s.trend === 'up' && <TrendingUp size={18} className="text-emerald-400 mx-auto" />}
                                        {s.trend === 'down' && <TrendingDown size={18} className="text-red-400 mx-auto" />}
                                        {s.trend === 'stable' && <Activity size={18} className="text-amber-400 mx-auto" />}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};
