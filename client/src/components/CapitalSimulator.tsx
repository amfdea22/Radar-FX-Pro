import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, AlertTriangle, ArrowRight, Zap, Crown, Target, ShieldAlert, MousePointer2, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface SimulationResult {
    day: number;
    balance: number;
    dailyProfit: number;
}

export const CapitalSimulator: React.FC = () => {
    const [initialCapital, setInitialCapital] = useState<number>(1000);
    const [dailyGainPct, setDailyGainPct] = useState<number>(3);
    const [durationDays, setDurationDays] = useState<number>(30);
    const [riskProfile, setRiskProfile] = useState<'cons' | 'mod' | 'agg'>('mod');
    const [omniData, setOmniData] = useState<any>(null);
    const [loadingOmni, setLoadingOmni] = useState(true);
    const [currency, setCurrency] = useState<string>('R$');
    const [locale, setLocale] = useState<string>('pt-BR');
    const [mt5Synced, setMt5Synced] = useState(false);

    const fetchDatas = async () => {
        try {
            const [omniResp, accountResp] = await Promise.all([
                axios.get('/api/mt5/omni/status').catch(() => null),
                axios.get('/api/mt5/account').catch(() => null)
            ]);

            if (omniResp?.data) {
                setOmniData(omniResp.data);
            }
            if (accountResp?.data) {
                setInitialCapital(accountResp.data.balance);
                setCurrency(accountResp.data.currency === 'USD' ? '$' : 'R$');
                setLocale(accountResp.data.currency === 'USD' ? 'en-US' : 'pt-BR');
                setMt5Synced(true);
            }
            setLoadingOmni(false);
        } catch (e) {
            console.error('Fetch failed for simulator', e);
        }
    };

    useEffect(() => {
        fetchDatas();
    }, []);

    const bestStrategy = omniData?.ranking?.[0];

    const importOmniPerformance = () => {
        if (!bestStrategy) return;
        const suggestedMeta = Number((bestStrategy.winRate / 20).toFixed(1));
        setDailyGainPct(suggestedMeta);
        setRiskProfile(suggestedMeta > 5 ? 'agg' : suggestedMeta > 2 ? 'mod' : 'cons');
    };

    const handleProfileChange = (profile: 'cons' | 'mod' | 'agg') => {
        setRiskProfile(profile);
        if (profile === 'cons') setDailyGainPct(1);
        if (profile === 'mod') setDailyGainPct(3);
        if (profile === 'agg') setDailyGainPct(7);
    };

    const profileLabel = { cons: 'Conservador', mod: 'Moderado', agg: 'Agressivo' };

    const simulationData = useMemo(() => {
        const winRate = bestStrategy?.winRate ? bestStrategy.winRate / 100 : (riskProfile === 'cons' ? 0.85 : riskProfile === 'mod' ? 0.70 : 0.55);
        const iterations = 1000;
        const resultsPerDay: number[][] = Array.from({ length: durationDays + 1 }, () => []);

        const galeMultiplier = omniData?.settings?.martingaleMultiplier || 2.0;
        const galeLevels = omniData?.settings?.martingaleLevels || 1;

        for (let iter = 0; iter < iterations; iter++) {
            let currentBalance = initialCapital;
            resultsPerDay[0].push(currentBalance);

            for (let day = 1; day <= durationDays; day++) {
                const isWin = Math.random() <= winRate;
                const riskRewardRatio = riskProfile === 'agg' ? 1.5 : 2.0;
                const dailyChange = isWin ? (dailyGainPct / 100) : -(dailyGainPct / riskRewardRatio / 100);

                currentBalance *= (1 + dailyChange);
                if (currentBalance < initialCapital * 0.2) currentBalance = initialCapital * 0.2;
                resultsPerDay[day].push(currentBalance);
            }
        }

        const finalData = resultsPerDay.map((dayResults, index) => {
            const sorted = dayResults.sort((a, b) => a - b);
            const p10 = sorted[Math.floor(iterations * 0.1)];
            const p50 = sorted[Math.floor(iterations * 0.5)];
            const p90 = sorted[Math.floor(iterations * 0.9)];

            const riskFactor = (dailyGainPct * (Math.pow(galeMultiplier, galeLevels))) / 4;
            const projectedRisk = p50 * (riskFactor / 100);

            return {
                day: index,
                balance: parseFloat(p50.toFixed(2)),
                p10: parseFloat(p10.toFixed(2)),
                p90: parseFloat(p90.toFixed(2)),
                confidenceBand: [parseFloat(p10.toFixed(2)), parseFloat(p90.toFixed(2))],
                risk: parseFloat((p50 - projectedRisk).toFixed(2))
            };
        });

        const survivalCount = resultsPerDay[durationDays].filter(b => b > initialCapital * 0.5).length;
        const survivalRate = (survivalCount / iterations) * 100;

        return { data: finalData, survivalRate };
    }, [initialCapital, dailyGainPct, durationDays, omniData, riskProfile, bestStrategy]);

    const simulationStats = simulationData;
    const finalBalance = simulationStats.data[simulationStats.data.length - 1].balance;
    const totalProfit = finalBalance - initialCapital;
    const totalReturnPct = (totalProfit / initialCapital) * 100;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-purple-500/10 rounded-3xl border border-purple-500/20 shadow-xl shadow-purple-500/10">
                        <Calculator size={40} className="text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-600">Simulador</span>
                            de Capital
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-purple-500/10 border border-purple-500/20 text-purple-500">
                                Monte Carlo v2
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-purple-400" /> Projeção Alpha com simulação estocástica
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                    {mt5Synced && (
                        <>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">MT5 Sync</span>
                            <span className="text-slate-600 mx-1">|</span>
                        </>
                    )}
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{profileLabel[riskProfile]}</span>
                </div>
            </div>

            {/* MAIN CONTENT — 2 COLUMNS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN — Inputs + Projection + Omni */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>

                        {/* Profile selector */}
                        <div className="flex gap-2 mb-6">
                            {[
                                { id: 'cons', label: 'Conservador', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { id: 'mod', label: 'Moderado', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                                { id: 'agg', label: 'Agressivo', color: 'text-rose-400', bg: 'bg-rose-500/10' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleProfileChange(p.id as any)}
                                    className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                                        riskProfile === p.id
                                        ? `border-white/20 ${p.bg} ${p.color} shadow-lg`
                                        : 'border-transparent bg-slate-950/50 text-slate-500 hover:border-slate-700'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Inicial ({currency})</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-purple-500 outline-none transition-all font-bold text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Diária (%)</label>
                                <input
                                    type="number"
                                    value={dailyGainPct}
                                    onChange={(e) => setDailyGainPct(Number(e.target.value))}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-purple-500 outline-none transition-all font-bold text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Período (Dias)</label>
                                <input
                                    type="number"
                                    value={durationDays}
                                    onChange={(e) => setDurationDays(Number(e.target.value))}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-purple-500 outline-none transition-all font-bold text-white"
                                />
                            </div>
                        </div>

                        {/* Projection result */}
                        <motion.div
                            layout
                            className="mt-6 p-6 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp size={60} />
                            </div>
                            <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest">Projeção Final</p>
                            <motion.p
                                key={finalBalance}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-3xl font-black text-white italic"
                            >
                                {currency} {finalBalance.toLocaleString(locale, { minimumFractionDigits: 2 })}
                            </motion.p>
                            <p className="text-sm text-emerald-400 font-bold mt-1">+{totalReturnPct.toFixed(1)}% de lucro</p>
                        </motion.div>

                        {/* Omni Intelligence Card */}
                        {bestStrategy && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-6 p-5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-3xl relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                                    <Crown size={60} className="text-amber-500" />
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-500">
                                        <Zap size={14} />
                                    </div>
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Estratégia Elite Omni</span>
                                </div>

                                <h4 className="text-lg font-black text-white italic uppercase tracking-tighter mb-1">{bestStrategy.name}</h4>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-[10px] font-bold text-slate-400 capitalize">{bestStrategy.winRate}% % Acerto</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                    <span className="text-[10px] font-bold text-emerald-400">Importável</span>
                                </div>

                                <button
                                    onClick={importOmniPerformance}
                                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                                >
                                    <MousePointer2 size={12} />
                                    Importar Performance
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* Risk warning */}
                    <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <AlertTriangle size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Risco & Realidade</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">
                            Juros compostos são poderosos, mas o mercado é soberano. Nunca opere capital que você não possa perder.
                        </p>
                    </div>
                </div>

                {/* RIGHT COLUMN — Chart + Stats */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Chart */}
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Curva de Crescimento</h3>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">Projeção Radar</span>
                            </div>
                        </div>

                        <div className="h-[420px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={simulationStats.data}>
                                    <defs>
                                        <linearGradient id="colorSimulator" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                    <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        stroke="#475569"
                                        tick={{ fontSize: 10, fontWeight: 900 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(val) => `${currency}${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5 5' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', color: '#f1f5f9' }}
                                        itemStyle={{ color: '#a855f7', fontWeight: '900' }}
                                        formatter={(value: any, name: string) => {
                                            const labels: any = { balance: 'Mediana (P50)', p10: 'Mínimo (P10)', p90: 'Máximo (P90)', risk: 'Zona de Risco', confidenceBand: 'Intervalo Fiscal' };
                                            if (name === 'confidenceBand') return [`${currency}${value[0]} - ${currency}${value[1]}`, labels[name]];
                                            return [`${currency} ${value.toLocaleString(locale, { minimumFractionDigits: 2 })}`, labels[name] || name];
                                        }}
                                        labelFormatter={(label) => `DIA ${label}`}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="confidenceBand"
                                        stroke="none"
                                        fill="#a855f7"
                                        fillOpacity={0.15}
                                        name="confidenceBand"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        stroke="#a855f7"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorSimulator)"
                                        animationDuration={1500}
                                        name="balance"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="risk"
                                        stroke="#EF4444"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        fillOpacity={0.05}
                                        fill="#EF4444"
                                        name="risk"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all flex items-center justify-between"
                        >
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Lucro Estimado</p>
                                <p className="text-2xl font-black text-emerald-400 italic">+{currency} {totalProfit.toLocaleString(locale, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400">
                                <TrendingUp size={28} />
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all flex items-center justify-between"
                        >
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Sobrevivência</p>
                                <p className={`text-2xl font-black italic ${simulationStats.survivalRate > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {simulationStats.survivalRate.toFixed(1)}%
                                </p>
                            </div>
                            <div className={`p-4 rounded-2xl ${simulationStats.survivalRate > 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                <ShieldAlert size={28} />
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all flex items-center justify-between cursor-pointer group"
                        >
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Análise de Risco</p>
                                <p className="text-xl font-black text-white italic uppercase">Monte Carlo v2</p>
                            </div>
                            <div className="text-slate-600 group-hover:text-purple-400 transition-colors">
                                <ArrowRight size={28} />
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>

        </div>
    );
};
