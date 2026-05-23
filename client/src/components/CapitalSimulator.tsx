import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, AlertTriangle, ArrowRight, Zap, Crown, Target, ShieldAlert, MousePointer2 } from 'lucide-react';
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
        // Lógica: Assertividade / 20 = Meta Diária
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

    const simulationData = useMemo(() => {
        // Parametros base
        const winRate = bestStrategy?.winRate ? bestStrategy.winRate / 100 : (riskProfile === 'cons' ? 0.85 : riskProfile === 'mod' ? 0.70 : 0.55);
        const iterations = 1000;
        const resultsPerDay: number[][] = Array.from({ length: durationDays + 1 }, () => []);

        // Fatores de Risco Alpha
        const galeMultiplier = omniData?.settings?.martingaleMultiplier || 2.0;
        const galeLevels = omniData?.settings?.martingaleLevels || 1;
        
        // Simulação Monte Carlo - 1000 caminhos aleatórios
        for (let iter = 0; iter < iterations; iter++) {
            let currentBalance = initialCapital;
            resultsPerDay[0].push(currentBalance);

            for (let day = 1; day <= durationDays; day++) {
                const isWin = Math.random() <= winRate;
                // Se ganhar, ganha a meta cheia. Se perder, perde o equivalente ao risco do perfil (simplificado)
                const riskRewardRatio = riskProfile === 'agg' ? 1.5 : 2.0; 
                const dailyChange = isWin ? (dailyGainPct / 100) : -(dailyGainPct / riskRewardRatio / 100);
                
                currentBalance *= (1 + dailyChange);
                if (currentBalance < initialCapital * 0.2) currentBalance = initialCapital * 0.2; // Stop Out Simulado
                resultsPerDay[day].push(currentBalance);
            }
        }

        // Calcular Percentis P10, P50 (Mediana), P90
        const finalData = resultsPerDay.map((dayResults, index) => {
            const sorted = dayResults.sort((a, b) => a - b);
            const p10 = sorted[Math.floor(iterations * 0.1)];
            const p50 = sorted[Math.floor(iterations * 0.5)];
            const p90 = sorted[Math.floor(iterations * 0.9)];

            // Risco de Martingale (Cálculo auxiliar para a zona vermelha)
            const riskFactor = (dailyGainPct * (Math.pow(galeMultiplier, galeLevels))) / 4;
            const projectedRisk = p50 * (riskFactor / 100);

            return {
                day: index,
                balance: parseFloat(p50.toFixed(2)), // Linha principal é a Mediana
                p10: parseFloat(p10.toFixed(2)),
                p90: parseFloat(p90.toFixed(2)),
                confidenceBand: [parseFloat(p10.toFixed(2)), parseFloat(p90.toFixed(2))],
                risk: parseFloat((p50 - projectedRisk).toFixed(2))
            };
        });

        // Calcular Probabilidade de Sobrevivência (Caminhos que terminaram acima de 50% do capital inicial)
        const survivalCount = resultsPerDay[durationDays].filter(b => b > initialCapital * 0.5).length;
        const survivalRate = (survivalCount / iterations) * 100;

        return { data: finalData, survivalRate };
    }, [initialCapital, dailyGainPct, durationDays, omniData, riskProfile, bestStrategy]);

    const simulationStats = simulationData;
    const finalBalance = simulationStats.data[simulationStats.data.length - 1].balance;
    const totalProfit = finalBalance - initialCapital;
    const totalReturnPct = (totalProfit / initialCapital) * 100;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 bg-slate-950 min-h-screen text-slate-100">
            {/* Coluna de Inputs */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-1 space-y-6"
            >
                <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl relative">
                    <div className="flex items-center gap-2 mb-6 justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="text-trader-blue" size={24} />
                            <h2 className="text-xl font-bold uppercase tracking-wider italic">Projeção Alpha</h2>
                        </div>
                        {mt5Synced && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-trader-green/10 border border-trader-green/20 rounded-md">
                                <div className="w-1.5 h-1.5 bg-trader-green rounded-full animate-pulse"></div>
                                <span className="text-[8px] font-black uppercase text-trader-green tracking-widest">MT5 Sync</span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mb-8">
                        {[
                            { id: 'cons', label: 'Conservador', color: 'text-trader-green', bg: 'bg-trader-green/10' },
                            { id: 'mod', label: 'Moderado', color: 'text-trader-blue', bg: 'bg-trader-blue/10' },
                            { id: 'agg', label: 'Agressivo', color: 'text-trader-red', bg: 'bg-trader-red/10' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleProfileChange(p.id as any)}
                                className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                                    riskProfile === p.id 
                                    ? `border-white/20 ${p.bg} ${p.color} shadow-lg` 
                                    : 'border-transparent bg-slate-950 text-slate-500 hover:border-slate-800'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <div className="group space-y-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Capital Inicial ({currency})</label>
                            <input
                                type="number"
                                value={initialCapital}
                                onChange={(e) => setInitialCapital(Number(e.target.value))}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-trader-blue outline-none transition-all font-bold"
                            />
                        </div>

                        <div className="group space-y-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Diária (%)</label>
                            <input
                                type="number"
                                value={dailyGainPct}
                                onChange={(e) => setDailyGainPct(Number(e.target.value))}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-trader-blue outline-none transition-all font-bold"
                            />
                        </div>

                        <div className="group space-y-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Período (Dias)</label>
                            <input
                                type="number"
                                value={durationDays}
                                onChange={(e) => setDurationDays(Number(e.target.value))}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:border-trader-blue outline-none transition-all font-bold"
                            />
                        </div>
                    </div>

                    <motion.div
                        layout
                        className="mt-8 p-6 bg-trader-blue/10 border border-trader-blue/20 rounded-[2rem] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp size={60} />
                        </div>
                        <p className="text-[10px] text-trader-blue font-black uppercase tracking-widest">Projeção Final</p>
                        <motion.p
                            key={finalBalance}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-3xl font-black text-white italic"
                        >
                            {currency} {finalBalance.toLocaleString(locale, { minimumFractionDigits: 2 })}
                        </motion.p>
                        <p className="text-sm text-trader-green font-bold mt-1">+{totalReturnPct.toFixed(1)}% de lucro</p>
                    </motion.div>

                    {/* Omni Intelligence Card */}
                    {bestStrategy && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-3xl relative overflow-hidden group"
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
                                <span className="text-[10px] font-bold text-trader-green">Importável</span>
                            </div>

                            <button 
                                onClick={importOmniPerformance}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                            >
                                <MousePointer2 size={12} />
                                Importar Performance
                            </button>
                        </motion.div>
                    )}
                </div>

                <div className="bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                        <AlertTriangle size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Risco & Realidade</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">
                        Juros compostos são poderosos, mas o mercado é soberano. Nunca opere capital que você não possa perder.
                    </p>
                </div>
            </motion.div>

            {/* Coluna do Gráfico */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-2 space-y-6"
            >
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl h-[500px]">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black uppercase tracking-[0.2em] italic">Curva de Crescimento</h2>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 px-3 py-1 bg-trader-blue/10 rounded-full border border-trader-blue/20">
                                <div className="w-1.5 h-1.5 bg-trader-blue rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black text-trader-blue uppercase tracking-tighter">Projeção Radar</span>
                            </div>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={simulationStats.data}>
                            <defs>
                                <linearGradient id="colorSimulator" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
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
                                cursor={{ stroke: '#2563EB', strokeWidth: 2, strokeDasharray: '5 5' }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', color: '#f1f5f9' }}
                                itemStyle={{ color: '#2563EB', fontWeight: '900' }}
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
                                fill="#2563EB"
                                fillOpacity={0.15}
                                name="confidenceBand"
                            />
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#2563EB"
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Lucro Estimado</p>
                            <p className="text-2xl font-black text-trader-green italic">+{currency} {totalProfit.toLocaleString(locale, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-trader-green/20 p-4 rounded-2xl text-trader-green shadow-xl shadow-trader-green/10">
                            <TrendingUp size={28} />
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Sobrevivência</p>
                            <p className={`text-2xl font-black italic ${simulationStats.survivalRate > 80 ? 'text-trader-green' : 'text-trader-amber'}`}>
                                {simulationStats.survivalRate.toFixed(1)}%
                            </p>
                        </div>
                        <div className={`p-4 rounded-2xl shadow-xl ${simulationStats.survivalRate > 80 ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-amber/20 text-trader-amber'}`}>
                            <ShieldAlert size={28} />
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 flex items-center justify-between cursor-pointer group hover:border-trader-blue/50 transition-all font-black"
                    >
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Análise de Risco</p>
                            <p className="text-xl font-black text-white italic uppercase">Monte Carlo v2</p>
                        </div>
                        <div className="text-slate-600 group-hover:text-trader-blue transition-colors">
                            <ArrowRight size={28} />
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};
