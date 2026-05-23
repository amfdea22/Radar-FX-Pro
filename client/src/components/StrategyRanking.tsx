import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Target, Zap, Waves,
    TrendingUp, Shield, BarChart3,
    MousePointer2, Bot, SignalHigh,
    ChevronRight, Sparkles, Calendar, Filter, ArrowUpRight, Crown, Star, Clock, Coins, Cpu
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, AreaChart, Area,
    CartesianGrid
} from 'recharts';

interface StrategyStats {
    name: string;
    winRate: number;
    trades: number;
    profitFactor: number;
    profit: number;
    status: 'High' | 'Solid' | 'Emerging';
}

interface RankingSection {
    id: 'robot' | 'manual' | 'signals' | 'setups' | 'assets' | 'temporal' | 'elite';
    label: string;
    icon: React.ReactNode;
    color: string;
    data?: any[];
}

export const StrategyRanking: React.FC = () => {
    const [activeSection, setActiveSection] = useState<RankingSection['id']>('elite');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const response = await axios.get('/api/mt5/analytics/advanced');
            setData(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Ranking sync failed:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading || !data) return (
        <div className="flex justify-center p-20">
            <div className="w-8 h-8 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
        </div>
    );

    const sections: RankingSection[] = [
        {
            id: 'setups',
            label: 'Setups',
            icon: <Zap size={16} />,
            color: 'amber-500',
            data: data.setups.map((s: any) => ({
                name: s.name,
                winRate: s.winRate,
                trades: s.trades,
                profitFactor: s.profitFactor,
                profit: s.profit,
                status: s.winRate >= 80 ? 'High' : s.winRate >= 60 ? 'Solid' : 'Emerging'
            }))
        },
        {
            id: 'assets',
            label: 'Ativos',
            icon: <Coins size={16} />,
            color: 'emerald-500',
            data: data.assets.map((a: any) => ({
                name: a.name,
                winRate: a.winRate,
                trades: a.trades,
                profitFactor: a.profitFactor,
                profit: a.profit,
                status: a.winRate >= 80 ? 'High' : a.winRate >= 60 ? 'Solid' : 'Emerging'
            }))
        },
        {
            id: 'elite',
            label: 'Radar Elite',
            icon: <Star size={16} />,
            color: 'yellow-500',
            data: data.elite
        },
        {
            id: 'temporal',
            label: 'Horários/Dias',
            icon: <Clock size={16} />,
            color: 'purple-500'
        }
    ];

    const currentData = sections.find(s => s.id === activeSection);
    const hourlyData = data.hourly;
    const dailyData = data.daily || [];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-yellow-500/10 rounded-3xl border border-yellow-500/20 shadow-xl shadow-yellow-500/10">
                        <Trophy size={40} className="text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">Ranking</span> de Assertividade
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                                Mercado Ativo
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-yellow-400" /> Inteligência de Mercado Ativa | Últimos 30 dias
                        </p>
                    </div>
                </div>
            </div>

            {/* NAV SECTIONS */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-2 rounded-[2rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {sections.map(section => {
                        const colorMap: Record<string, string> = {
                            'setups': 'amber-500',
                            'assets': 'emerald-500',
                            'elite': 'yellow-500',
                            'temporal': 'purple-500'
                        };
                        const bgMap: Record<string, string> = {
                            'setups': 'rgba(251,191,36,0.2)',
                            'assets': 'rgba(16,185,129,0.2)',
                            'elite': 'rgba(234,179,8,0.2)',
                            'temporal': 'rgba(139,92,246,0.2)'
                        };
                        const activeColor = colorMap[section.id];
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center ${
                                    activeSection === section.id
                                        ? `text-white shadow-[0_0_15px_rgba(var(--glow-color),0.3)]`
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                                style={{
                                    backgroundColor: activeSection === section.id ? bgMap[section.id] : 'transparent',
                                    borderColor: activeSection === section.id ? `var(--tw-border-opacity)` : 'transparent',
                                    borderWidth: activeSection === section.id ? '1px' : '0px',
                                    borderStyle: 'solid',
                                    ['--glow-color' as string]: activeColor.replace('500', '200')
                                }}
                            >
                                {section.icon}
                                {section.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTENT */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                >
                    {activeSection === 'elite' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {data.elite.sort((a: any, b: any) => (b.winRate || b.benchmark) - (a.winRate || a.benchmark)).map((strategy: any, index: number) => {
                                const isBest = index === 0;
                                return (
                                    <motion.div
                                        key={strategy.name}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border shadow-2xl relative overflow-hidden group ${isBest
                                            ? (strategy.winRate >= 85 ? 'border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/20' : 'border-yellow-500/50 shadow-[0_0_50px_rgba(234,179,8,0.2)] ring-1 ring-yellow-500/20')
                                            : 'border-white/5 hover:border-yellow-500/30'
                                        }`}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"></div>
                                        {isBest && (
                                            <motion.div
                                                animate={{
                                                    opacity: [0.1, 0.3, 0.1],
                                                    scale: [1, 1.05, 1]
                                                }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                                className={`absolute inset-0 pointer-events-none blur-[60px] opacity-20 ${strategy.winRate >= 85 ? 'bg-emerald-500' : 'bg-yellow-500'
                                                    }`}
                                            />
                                        )}
                                        {/* Ranking Badge */}
                                        <div className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center font-black text-xs z-20 ${index === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/40' :
                                            index === 1 ? 'bg-slate-300 text-black' :
                                                index === 2 ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            {index + 1}º
                                        </div>

                                        {isBest && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/5 to-transparent pointer-events-none"></div>
                                        )}

                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                            {isBest ? <Star size={80} className="text-yellow-500 animate-pulse" /> : <Trophy size={80} className="text-yellow-500" />}
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-[8px] font-black text-yellow-500 uppercase tracking-[0.2em]">
                                                    {strategy.tag}
                                                </div>
                                                {isBest && (
                                                    <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-[8px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Star size={8} className="fill-yellow-500" /> TOP ESTRATÉGIA
                                                    </div>
                                                )}
                                            </div>

                                            <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-2 ${isBest ? 'text-yellow-500' : 'text-white'}`}>{strategy.name}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-8">{strategy.description}</p>

                                            <div className="grid grid-cols-2 gap-4 mb-8">
                                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Benchmark</p>
                                                    <p className="text-xl font-black text-yellow-400 italic">{strategy.benchmark}%</p>
                                                </div>
                                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Sua Performance</p>
                                                    <p className={`text-xl font-black italic ${strategy.winRate > 0 ? 'text-emerald-500' : 'text-slate-700'}`}>
                                                        {strategy.winRate > 0 ? `${strategy.winRate}%` : '---'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aderência ao Modelo</span>
                                                    <span className="text-xs font-black text-white">{strategy.winRate > 0 ? `${Math.min(100, (strategy.winRate / strategy.benchmark * 100)).toFixed(0)}%` : '0%'}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${strategy.winRate > 0 ? Math.min(100, (strategy.winRate / strategy.benchmark * 100)) : 0}%` }}
                                                        className={`h-full bg-gradient-to-r ${isBest ? 'from-yellow-400 to-amber-600' : 'from-yellow-500 to-yellow-600'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : activeSection === 'temporal' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Hourly Chart */}
                            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Clock size={14} /> Ciclo Intraday
                                        </h3>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Assertividade por Horário</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-emerald-500 italic">92%</p>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pico (10:00h)</p>
                                    </div>
                                </div>
                                <div className="h-64 relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={hourlyData}>
                                            <defs>
                                                <linearGradient id="colorWin" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis
                                                dataKey="hour"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                            />
                                            <Area type="monotone" dataKey="winRate" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorWin)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Daily Chart */}
                            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Calendar size={14} /> Ciclo Semanal
                                        </h3>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Performance Diária</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white italic">Qua</p>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Melhor Dia</p>
                                    </div>
                                </div>
                                <div className="h-64 relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyData}>
                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            />
                                            <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                                                {dailyData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.winRate > 90 ? '#10b981' : '#eab308'} fillOpacity={0.8} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {currentData?.data?.sort((a, b) => b.winRate - a.winRate).map((stat: any, index: number) => {
                                const isLowConfidence = stat.trades < 3;
                                return (
                                    <div
                                        key={stat.name}
                                        className={`bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border relative overflow-hidden transition-all group ${
                                            index === 0
                                                ? (stat.winRate >= 85 ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/20' : 'border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.2)] ring-1 ring-yellow-500/20')
                                                : 'border-white/5 hover:border-yellow-500/30'
                                        }`}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"></div>
                                        {index === 0 && (
                                            <motion.div
                                                animate={{
                                                    opacity: [0.05, 0.2, 0.05],
                                                    scale: [1, 1.1, 1]
                                                }}
                                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                                className={`absolute inset-0 pointer-events-none blur-[80px] opacity-10 ${stat.winRate >= 85 ? 'bg-emerald-500' : 'bg-yellow-500'
                                                }`}
                                            />
                                        )}

                                        <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity`}>
                                            <span className="text-9xl font-black italic">#{index + 1}</span>
                                        </div>

                                        <div className="flex flex-col lg:flex-row lg:items-center gap-8 relative z-10">
                                            <div className="flex items-center gap-6 lg:w-1/3">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl italic relative ${
                                                    index === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/40' :
                                                    index === 1 ? 'bg-slate-300 text-black border border-slate-400/20' :
                                                        'bg-orange-700 text-white border border-orange-400/20'
                                                }`}>
                                                    {index + 1}º
                                                    {index === 0 && (
                                                        <div className="absolute -top-3 -left-3 rotate-[-30deg]">
                                                            <Crown size={24} className="text-yellow-500 drop-shadow-md" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className={`text-lg font-black italic tracking-tight ${index === 0 ? 'text-yellow-500' : 'text-white'}`}>{stat.name}</h3>
                                                        {index === 0 && <Star size={14} className="text-yellow-500 fill-yellow-500 animate-pulse" />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                                            stat.status === 'High' ? 'bg-emerald-500/20 text-emerald-500' :
                                                            stat.status === 'Solid' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-purple-500/20 text-purple-400'
                                                        }`}>
                                                            Status: {stat.status}
                                                        </span>
                                                        {isLowConfidence && (
                                                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest bg-slate-800 text-slate-500 border border-white/5">
                                                                Sinal em Observação
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Taxa de Acerto</span>
                                                    <span className="text-xl font-black text-white italic">{stat.winRate}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${stat.winRate}%` }}
                                                        transition={{ duration: 1, delay: 0.2 }}
                                                        className={`h-full rounded-full bg-gradient-to-r ${stat.winRate > 90 ? 'from-emerald-500 to-emerald-400' :
                                                            stat.winRate > 80 ? 'from-yellow-500 to-yellow-400' :
                                                                'from-amber-400 to-orange-500'
                                                        }`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:w-1/4">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Operações</p>
                                                    <p className="text-md font-black text-white">{stat.trades}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Fator Lucro</p>
                                                    <p className={`text-md font-black ${stat.profitFactor >= 1.5 ? 'text-emerald-500' : stat.profitFactor >= 1.0 ? 'text-yellow-500' : 'text-rose-500'}`}>
                                                        {stat.profitFactor}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Resultado</p>
                                                    <p className={`text-sm font-black ${stat.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'} flex items-center justify-center gap-1`}>
                                                        ${stat.profit}
                                                        {stat.profit >= 0 ? <ArrowUpRight size={12} /> : <ArrowUpRight size={12} className="rotate-90" />}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Footer Alert */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <Shield size={20} className="text-yellow-500" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                        Sincronização Institucional: Os dados temporais refletem a liquidez das bolsas globais. Opere preferencialmente nos <span className="text-white font-black">Ciclos de Alta Assertividade (90%+)</span> para maximizar lucros.
                    </p>
                </div>
            </div>
        </div>
    );
};
