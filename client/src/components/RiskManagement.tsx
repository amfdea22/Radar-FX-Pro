import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Shield, Target, DollarSign, TrendingUp, TrendingDown, Activity,
    Wallet, BarChart3, Layers, AlertTriangle, Minus, Plus, Brain, Info, Cpu,
    Lock, Unlock, Volume2, Flag, CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

interface RiskData {
    account: {
        balance: number;
        equity: number;
        margin: number;
        marginLevel: number;
        leverage: number;
        currency: string;
        broker: string;
        login: number;
        floatingPL: number;
        openPositions: number;
    };
    discipline: {
        dailyProfit: number;
        tradeCount: number;
        consecutiveLosses: number;
        isSafe: boolean;
        isLocked: boolean;
        limits: any;
    } | null;
    robots: Array<{
        name: string;
        id: string;
        active: boolean;
        report: any;
    }>;
}

const InfoTooltip: React.FC<{ header: string; content: React.ReactNode; children: React.ReactNode }> = ({ header, content, children }) => (
    <div className="group relative">
        {children}
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] backdrop-blur-xl pointer-events-none">
            <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <Brain size={14} className="text-blue-400" />
                    <span className="text-xs font-black text-white uppercase tracking-tighter">{header}</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed font-medium">{content}</div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
        </div>
    </div>
);

export const RiskManagement: React.FC = () => {
    const [data, setData] = useState<RiskData | null>(null);
    const [selectedRobot, setSelectedRobot] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [riskRes, goldRes] = await Promise.all([
                axios.get('/api/mt5/risk-management'),
                axios.get('/api/mt5/gold-scalper/risk-report').catch(() => null)
            ]);
            const riskData = riskRes.data;
            if (goldRes?.data) {
                const gr = goldRes.data;
                riskData.robots = riskData.robots || [];
                const idx = riskData.robots.findIndex((r: any) => r.id === 'gold_scalper');
                if (idx >= 0) {
                    riskData.robots[idx].report = gr;
                } else {
                    riskData.robots.push({ name: 'Gold Scalper', id: 'gold_scalper', active: true, report: gr });
                }
                riskData.account.floatingPL = gr.account?.floatingPL || 0;
                riskData.account.openPositions = gr.account?.openPositions || 0;
            }
            setData(riskData);
            setLoading(false);
        } catch (err) {
            console.error('Risk management fetch error:', err);
            setLoading(false);
        }
    };

    const [dailyGoal, setDailyGoal] = useState(50);
    const [goalLock, setGoalLock] = useState(false);
    const [goalSound, setGoalSound] = useState(true);
    const [prevReached, setPrevReached] = useState(false);
    const [editValues, setEditValues] = useState<Record<string, string>>({
        dailyLoss: '250', maxDrawdown: '15', lotSize: '0.01', freeMargin: '50',
    });
    const dailyProfit = data?.discipline?.dailyProfit || 0;
    const goalReached = dailyProfit >= dailyGoal;

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (goalReached && !prevReached && goalSound) {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const play = (freq: number, time: number) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.3, time);
                    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(time);
                    osc.stop(time + 0.3);
                };
                play(880, ctx.currentTime);
                play(1100, ctx.currentTime + 0.15);
                play(1320, ctx.currentTime + 0.3);
            } catch {}
        }
        setPrevReached(goalReached);
    }, [goalReached, goalSound, prevReached]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">Carregando gestão de risco...</span>
                </div>
            </div>
        );
    }

    const goldReport = data?.robots?.find(r => r.id === 'gold_scalper')?.report;

    const configLimits = [
        { key: 'dailyLoss', label: 'Limite de Perda Diária', value: '250', suffix: 'USD', color: 'text-rose-400', icon: TrendingDown, desc: 'Máximo de perda permitida por dia antes de parar todas as operações.' },
        { key: 'maxDrawdown', label: 'Drawdown Máximo', value: '15', suffix: '%', color: 'text-amber-400', icon: Activity, desc: 'Percentual máximo de drawdown em relação ao saldo total da conta.' },
        { key: 'lotSize', label: 'Tamanho de Lote', value: '0.01', suffix: 'lote', color: 'text-blue-400', icon: Target, desc: 'Volume padrão para cada ordem executada pelos robôs.' },
        { key: 'freeMargin', label: 'Margem Livre Mínima', value: '50', suffix: '%', color: 'text-emerald-400', icon: Wallet, desc: 'Percentual mínimo de margem livre recomendado para segurança.' },
    ];
    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 shadow-xl shadow-emerald-500/10">
                        <Shield size={40} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Gestão</span> de Risco
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${data?.discipline?.isSafe ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'}`}>
                                {data?.discipline?.isSafe ? 'Seguro' : 'Atenção'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-emerald-400" /> Visão consolidada de todas as estratégias
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    {data?.account && (
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{data.account.broker}</span>
                            <span className="text-slate-700">|</span>
                            <span className="text-[10px] font-black text-slate-400">Login: {data.account.login}</span>
                            <span className="text-slate-700">|</span>
                            <span className="text-[10px] font-black text-emerald-400">1:{data.account.leverage}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Configurações de Risco */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <div className="flex items-center gap-2 mb-5">
                    <Shield size={18} className="text-amber-400" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Configure a Gestão de Risco</span>
                </div>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                    Defina limites de perda diária, drawdown máximo e tamanho de lote. Mantenha a margem livre acima de 50%.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {configLimits.map((cfg) => (
                        <div key={cfg.key} className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <cfg.icon size={16} className={cfg.color} />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="text"
                                    value={editValues[cfg.key]}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                                    className={`w-20 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic ${cfg.color} focus:border-amber-500/50 focus:outline-none`}
                                />
                                <span className="text-xs text-slate-500 font-bold uppercase">{cfg.suffix}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">{cfg.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Meta Diária */}
            <div className={`bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border shadow-2xl relative overflow-hidden transition-all duration-500 ${goalReached ? 'border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.15)]' : 'border-white/5'}`}>
                <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-current to-transparent ${goalReached ? 'text-emerald-400' : 'text-amber-500/40'}`}></div>
                {goalReached && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] animate-pulse"></div>
                    </div>
                )}
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Flag size={18} className={goalReached ? 'text-emerald-400' : 'text-amber-400'} />
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Meta Diária</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setGoalSound(!goalSound)} className={`p-2 rounded-xl border transition-all ${goalSound ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`} title="Sinal Sonoro">
                                <Volume2 size={14} />
                            </button>
                            <button onClick={() => setGoalLock(!goalLock)} className={`p-2 rounded-xl border transition-all ${goalLock ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`} title="Travar ao Atingir Meta">
                                {goalLock ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                        <div className="lg:col-span-1">
                            <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">Meta de Lucro</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={dailyGoal}
                                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                                    className="w-28 bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-2xl font-black text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                                <span className="text-xs text-slate-500 font-bold uppercase">USD</span>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Progresso</span>
                                <span className={`text-sm font-black italic ${goalReached ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    ${dailyProfit.toFixed(2)} / ${dailyGoal}
                                </span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${goalReached ? 'bg-gradient-to-r from-emerald-400 to-green-300 shadow-[0_0_30px_rgba(52,211,153,0.8),0_0_60px_rgba(52,211,153,0.3)]' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                                    style={{ width: `${Math.min(100, (dailyProfit / dailyGoal) * 100)}%` }}
                                />
                            </div>
                            {goalReached && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                                >
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                                        Meta Atingida! {goalLock ? 'Travado — operações pausadas.' : 'Operações ativas.'}
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Health */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                        { label: 'Saldo', value: `$${data?.account.balance.toFixed(2) || '0'}`, color: 'text-trader-blue', icon: <Wallet size={16} />, tip: 'Saldo total disponível na conta MT5.' },
                        { label: 'Equity', value: `$${data?.account.equity.toFixed(2) || '0'}`, color: 'text-emerald-400', icon: <TrendingUp size={16} />, tip: 'Saldo + lucro/prejuízo flutuante das posições abertas.' },
                        { label: 'Margem', value: `${data?.account.marginLevel.toFixed(1) || '0'}%`, color: (data?.account.marginLevel || 0) > 200 ? 'text-trader-green' : 'text-trader-red', icon: <BarChart3 size={16} />, tip: 'Nível de margem (equity / margem). >200% = saudável.' },
                        { label: 'Flutuante', value: `$${(data?.account.floatingPL || 0).toFixed(2)}`, color: (data?.account.floatingPL || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Activity size={16} />, tip: 'Lucro/prejuízo não realizado das posições em aberto.' },
                        { label: 'Posições', value: `${data?.account.openPositions || 0}`, color: 'text-slate-300', icon: <Layers size={16} />, tip: 'Total de posições abertas em todos os robôs.' },
                        { label: 'Trades Hoje', value: `${data?.discipline?.tradeCount || 0}`, color: 'text-amber-400', icon: <Target size={16} />, tip: 'Total de trades executados hoje (todos os robôs).' },
                        { label: 'Consec. Loss', value: `${data?.discipline?.consecutiveLosses || 0}`, color: (data?.discipline?.consecutiveLosses || 0) > 3 ? 'text-trader-red' : 'text-slate-400', icon: <AlertTriangle size={16} />, tip: 'Perdas consecutivas atuais. Limite configurável no Guardião.' }
                    ].map((kpi, i) => (
                        <InfoTooltip key={i} header={kpi.label} content={kpi.tip}>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all cursor-help h-full">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                                    <span className={`${kpi.color} opacity-60`}>{kpi.icon}</span>
                                </div>
                                <span className={`text-2xl font-black italic ${kpi.color}`}>{kpi.value}</span>
                            </div>
                        </InfoTooltip>
                    ))}
                </div>
            </div>

            {/* Gráficos Estatísticos */}
            {goldReport?.monthly?.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={16} className="text-blue-400" />
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Histograma — Lucro Mensal</span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={goldReport.monthly.map((m: any) => ({ ...m, profit: Number(m.profit.toFixed(2)) }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#ffffff', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#ffffff', fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12, color: '#fff' }}
                                    labelStyle={{ color: '#fff', fontWeight: 700 }}
                                    formatter={(value: number) => [`$${value}`, 'Lucro']}
                                />
                                <Bar dataKey="profit" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                    {goldReport.monthly.map((m: any, idx: number) => (
                                        <Cell key={idx} fill={m.profit >= 0 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={16} className="text-emerald-400" />
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Distribuição — Win / Loss</span>
                        </div>
                        <div className="flex items-center justify-center h-[220px]">
                            <ResponsiveContainer width="60%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Wins', value: goldReport.discipline.breakdown.wins || goldReport.monthly.reduce((a: number, m: any) => a + m.wins, 0), color: '#10b981' },
                                            { name: 'Losses', value: goldReport.discipline.breakdown.losses || goldReport.monthly.reduce((a: number, m: any) => a + m.losses, 0), color: '#ef4444' },
                                        ]}
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                        paddingAngle={4} dataKey="value"
                                    >
                                        {[{ color: '#10b981' }, { color: '#ef4444' }].map((e, idx) => (
                                            <Cell key={idx} fill={e.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                                        formatter={(value: number) => [value, 'Trades']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col gap-2 text-[10px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                    <span className="text-slate-400">Wins: <strong className="text-emerald-400">{goldReport.discipline.breakdown.wins || goldReport.monthly.reduce((a: number, m: any) => a + m.wins, 0)}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-red-500" />
                                    <span className="text-slate-400">Losses: <strong className="text-red-400">{goldReport.discipline.breakdown.losses || goldReport.monthly.reduce((a: number, m: any) => a + m.losses, 0)}</strong></span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-3 h-3 rounded-sm bg-slate-700" />
                                    <span className="text-slate-400">Win Rate: <strong className="text-white">{goldReport.discipline.breakdown.winRate || 0}%</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Risk Limits + Discipline Score row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Discipline Score */}
                {goldReport && (
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                        <div className="relative w-24 h-24 mb-3">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="30" fill="none" stroke="#1e293b" strokeWidth="6" />
                                <circle cx="36" cy="36" r="30" fill="none" stroke={goldReport.discipline.score >= 70 ? '#10b981' : goldReport.discipline.score >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(goldReport.discipline.score / 100) * 188.5} 188.5`} strokeLinecap="round" />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center text-4xl font-black italic ${goldReport.discipline.score >= 70 ? 'text-emerald-400' : goldReport.discipline.score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{goldReport.discipline.score}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score Gold Scalper</span>
                    </div>
                )}

                {/* Risk Limits */}
                {[
                    { label: 'Risco por Trade', value: goldReport ? `${goldReport.risk.riskPerTradePct}% ($${goldReport.risk.riskPerTradeUSD})` : '-', color: (goldReport?.risk.riskPerTradePct || 0) > 2 ? 'text-amber-400' : 'text-trader-green' },
                    { label: 'Drawdown Atual', value: goldReport ? `${goldReport.risk.drawdown}%` : '-', color: (goldReport?.risk.drawdown || 0) > 15 ? 'text-trader-red' : (goldReport?.risk.drawdown || 0) > 5 ? 'text-amber-400' : 'text-trader-green' },
                    { label: 'Perda Diária', value: goldReport ? `$${goldReport.risk.dailyLossRemaining} restante` : '-', color: (goldReport?.risk.dailyLossRemaining || 0) < 10 ? 'text-trader-red' : 'text-trader-green' }
                ].map((item, i) => (
                    <div key={i} className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</span>
                        <span className={`text-xl font-black italic ${item.color}`}>{item.value}</span>
                        {item.label === 'Perda Diária' && goldReport && (
                            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500" style={{ width: `${Math.min(100, ((goldReport.risk.maxDailyLoss - goldReport.risk.dailyLossRemaining) / goldReport.risk.maxDailyLoss) * 100)}%` }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detailed Reports per Robot */}
            {data?.robots.map(robot => {
                const r = robot.report;
                if (!r) return null;
                return (
                    <div key={robot.id} className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-2.5 h-2.5 rounded-full ${robot.active ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                            <span className="text-lg font-black text-white uppercase tracking-tighter">{robot.name}</span>
                            <span className="text-[10px] text-slate-600 font-bold bg-slate-950/40 px-3 py-1 rounded-lg border border-white/5">Total Trades: {r.risk.totalTrades}</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Breakdown */}
                            <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Detalhamento</span>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                                    {[
                                        { label: '% Acerto', value: `${r.discipline.breakdown.winRate}%`, color: r.discipline.breakdown.winRate >= 50 ? 'text-trader-green' : 'text-trader-red' },
                                        { label: 'Profit Factor', value: r.discipline.breakdown.profitFactor.toFixed(2), color: r.discipline.breakdown.profitFactor >= 1.2 ? 'text-trader-green' : 'text-trader-red' },
                                        { label: 'Méd G', value: `$${r.discipline.breakdown.avgWin}`, color: 'text-trader-green' },
                                        { label: 'Méd P', value: `-$${r.discipline.breakdown.avgLoss}`, color: 'text-trader-red' },
                                        { label: 'Melhor Trade', value: `$${r.discipline.breakdown.bestTrade}`, color: 'text-emerald-400' },
                                        { label: 'Pior Trade', value: `-$${Math.abs(r.discipline.breakdown.worstTrade)}`, color: 'text-red-400' },
                                        { label: 'Perdas Consec', value: r.risk.consecutiveLosses, color: r.risk.consecutiveLosses > 3 ? 'text-trader-red' : 'text-slate-300' },
                                        { label: 'Seq Vitórias', value: r.risk.winStreak, color: r.risk.winStreak > 3 ? 'text-emerald-400' : 'text-slate-300' }
                                    ].map((d, i) => (
                                        <div key={i} className="flex items-center justify-between border-b border-slate-800/50 pb-1.5">
                                            <span className="text-[10px] text-slate-500 font-bold">{d.label}</span>
                                            <span className={`text-sm font-black italic ${d.color}`}>{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Position Sizing */}
                            <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Dimensionamento de Lote</span>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-600 font-black uppercase tracking-widest border-b border-slate-800">
                                                <th className="text-left pb-2 pr-4">Risco</th>
                                                <th className="text-right pb-2 pr-4">USD</th>
                                                <th className="text-right pb-2">Lote</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {r.sizing?.map((s: any, i: number) => (
                                                <tr key={i} className={`border-b border-slate-800/50 ${s.riskPct === r.risk.riskPerTradePct ? 'bg-emerald-500/5' : ''}`}>
                                                    <td className={`py-2 pr-4 font-black ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>{s.riskPct}%</td>
                                                    <td className={`text-right py-2 pr-4 font-bold ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>${s.riskUSD}</td>
                                                    <td className={`text-right py-2 font-mono font-black ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>{s.lot}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Performance */}
                        {r.monthly && r.monthly.length > 0 && (
                            <div className="mt-6 bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Performance Mensal</span>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-600 font-black uppercase tracking-widest border-b border-slate-800">
                                                <th className="text-left pb-2 pr-4">Mês</th>
                                                <th className="text-right pb-2 pr-4">Trades</th>
                                                <th className="text-right pb-2 pr-4">Ganhos</th>
                                                <th className="text-right pb-2 pr-4">Perdas</th>
                                                <th className="text-right pb-2 pr-4">% Acerto</th>
                                                <th className="text-right pb-2">Lucro</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {r.monthly.map((m: any, i: number) => (
                                                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                                    <td className="py-2 pr-4 font-black text-slate-300">{m.month}</td>
                                                    <td className="text-right py-2 pr-4 text-slate-400 font-bold">{m.trades}</td>
                                                    <td className="text-right py-2 pr-4 text-trader-green font-bold">{m.wins}</td>
                                                    <td className="text-right py-2 pr-4 text-trader-red font-bold">{m.losses}</td>
                                                    <td className={`text-right py-2 pr-4 font-black ${m.winRate >= 50 ? 'text-trader-green' : 'text-trader-red'}`}>{m.winRate}%</td>
                                                    <td className={`text-right py-2 font-black font-mono ${m.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>{m.profit >= 0 ? '+' : ''}${m.profit.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Legend */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                <div className="flex items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disciplina Boa (&ge;70)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Atenção (40-69)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Crítico (&lt;40)</span>
                    <span className="flex items-center gap-1 ml-auto"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Robô Ativo</span>
                </div>
            </div>
        </div>
    );
};
