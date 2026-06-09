import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, Zap, Clock, Award, Activity, BarChart3, RefreshCw, Cpu, Users, Crosshair } from 'lucide-react';
import axios from 'axios';

interface Trader {
    name: string;
    category: string;
    asset: string;
    color: string;
    winRate: number;
    totalTrades: number;
    totalProfit: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    trend: 'up' | 'down' | 'neutral';
    lastTradeTime: number;
}

const TraderClock: React.FC<{ trend: 'up' | 'down' | 'neutral'; winRate: number; color: string }> = ({ trend, winRate, color }) => {
    const rotation = trend === 'up' ? 90 : trend === 'down' ? -90 : 0;
    const handColor = trend === 'up' ? '#16a34a' : trend === 'down' ? '#ef4444' : '#64748b';
    return (
        <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
            <circle cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
            <circle cx="26" cy="26" r="23" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={`${(winRate / 100) * 144.5} 144.5`} strokeLinecap="round" opacity="0.4" />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => {
                const angle = (h * 30 - 90) * (Math.PI / 180);
                const inner = h % 3 === 0 ? 18 : 21;
                return <line key={h} x1={26 + inner * Math.cos(angle)} y1={26 + inner * Math.sin(angle)} x2={26 + 23 * Math.cos(angle)} y2={26 + 23 * Math.sin(angle)} stroke="rgba(255,255,255,0.08)" strokeWidth={h % 3 === 0 ? 1.5 : 0.8} />;
            })}
            <line x1="26" y1="26" x2={26 + 14 * Math.cos(rotation * Math.PI / 180)} y2={26 + 14 * Math.sin(rotation * Math.PI / 180)} stroke={handColor} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${handColor}40)` }} />
            <circle cx="26" cy="26" r="2.5" fill={handColor} />
            <text x="26" y="40" textAnchor="middle" fill={handColor} fontSize="6" fontWeight="900" letterSpacing="0.5">{trend === 'up' ? '\u25B2' : trend === 'down' ? '\u25BC' : '\u25C6'}</text>
        </svg>
    );
};

export const StrategyPerformancePanel: React.FC = () => {
    const [traders, setTraders] = React.useState<Trader[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState('all');

    const fetchTraders = React.useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/mt5/reports/strategies');
            const mapped: Trader[] = (data || []).map((s: any) => ({
                name: s.name || 'Unknown',
                category: s.category || 'N/A',
                asset: s.asset || 'N/A',
                color: s.color || '#3b82f6',
                winRate: s.winRate || 0,
                totalTrades: s.totalTrades || 0,
                totalProfit: s.totalProfit || 0,
                avgWin: s.avgWin || 0,
                avgLoss: s.avgLoss || 0,
                profitFactor: s.profitFactor || 0,
                trend: (s.totalProfit || 0) > 0 ? 'up' : (s.totalProfit || 0) < 0 ? 'down' : 'neutral',
                lastTradeTime: s.lastTrade ? new Date(s.lastTrade).getTime() : 0,
            }));
            setTraders(mapped);
        } catch {
            setTraders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchTraders(); const iv = setInterval(fetchTraders, 15000); return () => clearInterval(iv); }, [fetchTraders]);

    const categories = React.useMemo(() => {
        const set = new Set(traders.map(t => t.category).filter(Boolean));
        return Array.from(set).sort();
    }, [traders]);

    const filtered = filter === 'all' ? traders : traders.filter(t => t.category === filter);
    const sorted = [...filtered].sort((a, b) => Math.abs(b.totalProfit) - Math.abs(a.totalProfit));

    const stats = React.useMemo(() => {
        const up = traders.filter(t => t.trend === 'up').length;
        const down = traders.filter(t => t.trend === 'down').length;
        const total = traders.reduce((sum, t) => sum + t.totalProfit, 0);
        return { total: traders.length, up, down, netProfit: total };
    }, [traders]);

    if (loading && traders.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={28} className="text-violet-400 animate-spin" style={{ filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5))' }} />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Carregando traders...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <Users size={40} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-600">Performance</span> de Estratégias
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${stats.netProfit >= 0 ? 'bg-trader-green/10 border border-trader-green/20 text-trader-green' : 'bg-trader-red/10 border border-trader-red/20 text-trader-red'}`}>
                                {stats.netProfit >= 0 ? 'Lucro Líq.' : 'Prejuízo Líq.'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-violet-500" /> Performance de Estratégias — Relógio de Tendências
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={fetchTraders} className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-2xl hover:bg-violet-500/20 transition-all group" title="Recarregar">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-violet-500/10 border-violet-500/20">
                        <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">{traders.length} Traders</span>
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-violet-500/20 text-violet-400 rounded-xl"><Users size={20} /></div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Estratégias</p>
                        <p className="text-xl font-black text-white italic">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-trader-green/20 text-trader-green rounded-xl"><TrendingUp size={20} /></div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tendência Alta</p>
                        <p className="text-xl font-black text-trader-green italic">{stats.up}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-trader-red/20 text-trader-red rounded-xl"><TrendingDown size={20} /></div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tendência Baixa</p>
                        <p className="text-xl font-black text-trader-red italic">{stats.down}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className={`p-3 ${stats.netProfit >= 0 ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-red/20 text-trader-red'} rounded-xl`}><Award size={20} /></div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Resultado Líquido</p>
                        <p className={`text-xl font-black italic ${stats.netProfit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                            ${stats.netProfit.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* FILTRO POR CATEGORIA */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Crosshair size={14} className="text-violet-400" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Filtrar por Categoria</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', ...categories].map(cat => (
                        <button key={cat} onClick={() => setFilter(cat)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${filter === cat ? 'bg-violet-500/20 text-violet-400 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-slate-950/40 text-slate-500 border-white/5 hover:text-slate-300 hover:border-slate-700'}`}>
                            {cat === 'all' ? 'Todos' : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* TRADERS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.length === 0 && (
                    <div className="col-span-full bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-12 text-center">
                        <Users size={40} className="text-slate-700 mx-auto mb-3" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum trader encontrado</p>
                    </div>
                )}
                {sorted.map((trader, i) => (
                    <motion.div key={trader.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 shadow-2xl relative overflow-hidden group hover:border-violet-500/20 transition-all">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[${trader.color}]/40 to-transparent" style={{ background: `linear-gradient(90deg, transparent, ${trader.color}40, transparent)` }} />
                        
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-black" style={{ backgroundColor: `${trader.color}20`, color: trader.color, border: `1px solid ${trader.color}30` }}>
                                    {trader.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-white italic truncate">{trader.name}</h3>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">{trader.asset}</p>
                                </div>
                            </div>
                            <TraderClock trend={trader.trend} winRate={trader.winRate} color={trader.color} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Win Rate</p>
                                <p className={`text-base font-black italic ${trader.winRate >= 60 ? 'text-trader-green' : trader.winRate >= 40 ? 'text-amber-400' : 'text-trader-red'}`}>
                                    {trader.winRate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Profit Factor</p>
                                <p className={`text-base font-black italic ${trader.profitFactor >= 1.5 ? 'text-trader-green' : trader.profitFactor >= 1 ? 'text-amber-400' : 'text-trader-red'}`}>
                                    {trader.profitFactor === 999 ? '\u221E' : trader.profitFactor.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Trades</span>
                                <span className="text-xs font-black text-slate-300">{trader.totalTrades}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro Total</span>
                                <span className={`text-xs font-black italic ${trader.totalProfit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                    ${trader.totalProfit.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Média Win</span>
                                <span className="text-xs font-black text-trader-green">${trader.avgWin.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Média Loss</span>
                                <span className="text-xs font-black text-trader-red">${trader.avgLoss.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Activity size={10} className="text-slate-600" />
                                {trader.category}
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mr-1">Tendência</span>
                                {trader.trend === 'up' ? (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-trader-green uppercase tracking-wider"><TrendingUp size={12} /> Alta</span>
                                ) : trader.trend === 'down' ? (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-trader-red uppercase tracking-wider"><TrendingDown size={12} /> Baixa</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider"><Activity size={12} /> Neutro</span>
                                )}
                            </div>
                        </div>

                        {trader.lastTradeTime > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[7px] font-bold text-slate-600">
                                <Clock size={9} />
                                Último trade: {new Date(trader.lastTradeTime).toLocaleString('pt-BR')}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
