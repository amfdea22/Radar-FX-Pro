import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, Activity, PieChart as PieChartIcon, BarChart3, ShieldCheck, Target, ArrowUpRight } from 'lucide-react';
import axios from 'axios';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F43F5E'];

export const CryptoReport: React.FC = () => {
    const [perfData, setPerfData] = useState<any[]>([]);
    const [assetDistribution, setAssetDistribution] = useState<any[]>([]);
    const [dailyProfitData, setDailyProfitData] = useState<any[]>([]);
    const [kpis, setKpis] = useState({ totalProfit: 0, winRate: 0, maxDrawdown: 0, topAsset: '-' });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await axios.get('/api/mt5/reports/crypto');
                setPerfData(res.data.performance);
                setAssetDistribution(res.data.distribution);
                setDailyProfitData(res.data.dailyProfit);
                setKpis(res.data.kpis);
            } catch (error) {
                console.error("Failed to fetch crypto report data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
        const iv = setInterval(fetchReport, 15000); // Atualiza a cada 15s
        return () => clearInterval(iv);
    }, []);

    if (isLoading) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando Cripto Analytics...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 mt-12">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                    <BarChart3 className="text-amber-500" /> Cripto <span className="text-amber-400">Analytics & Report</span>
                </h3>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-trader-green/5 rounded-full blur-2xl group-hover:bg-trader-green/20 transition-all"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><ArrowUpRight size={12} className="text-trader-green" /> Total Profit</span>
                    <span className="text-2xl font-black text-white">${kpis.totalProfit.toLocaleString()}<span className="text-sm text-trader-green/50">.00</span></span>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-trader-blue/5 rounded-full blur-2xl group-hover:bg-trader-blue/20 transition-all"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Target size={12} className="text-trader-blue" /> % Acerto Global</span>
                    <span className="text-2xl font-black text-white">{kpis.winRate.toFixed(1)}<span className="text-sm text-trader-blue/50">%</span></span>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-trader-red/5 rounded-full blur-2xl group-hover:bg-trader-red/20 transition-all"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} className="text-trader-red" /> Max Drawdown</span>
                    <span className="text-2xl font-black text-white">{kpis.maxDrawdown.toFixed(1)}<span className="text-sm text-trader-red/50">%</span></span>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck size={12} className="text-amber-500" /> Top Asset</span>
                    <span className="text-2xl font-black text-amber-500/90">{kpis.topAsset}</span>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Principal: Curve/Area */}
                <div className="xl:col-span-2 bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={14} className="text-trader-green" /> Evolução Patrimonial (Curve)</h4>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={perfData}>
                                <defs>
                                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="balance" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secundário: Pie */}
                <div className="xl:col-span-1 bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><PieChartIcon size={14} className="text-amber-400" /> Distribuição de Lucros</h4>
                    <div className="h-64 w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {assetDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                                    formatter={(value: number) => [`${value}%`, 'Relevância']}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Terciário: Bar Daily */}
                <div className="xl:col-span-3 bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><BarChart3 size={14} className="text-trader-blue" /> Lucro Diário (P/L)</h4>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyProfitData} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                    formatter={(value: number) => [`$${value}`, 'Profit/Loss']}
                                />
                                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                                    {dailyProfitData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.profit > 0 ? '#10B981' : entry.profit < 0 ? '#EF4444' : '#64748B'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
