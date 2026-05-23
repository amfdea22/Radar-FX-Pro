import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart3, DollarSign, TrendingUp, TrendingDown, Cpu,
    Brain, Target, Radio, Layers, Crown, Zap, Shield,
    ArrowUpDown, Calendar, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, Legend
} from 'recharts';
import axios from 'axios';

interface ModelCost {
    id: string;
    name: string;
    icon: React.ElementType;
    color: string;
    costPer1k: number;
    dailyRequests: number;
    active: boolean;
}

const DEFAULT_MODELS: ModelCost[] = [
    { id: 'gold', name: 'Gold Scalper', icon: Target, color: '#F59E0B', costPer1k: 0.50, dailyRequests: 57600, active: true },
    { id: 'crypto', name: 'Crypto IA', icon: Brain, color: '#8B5CF6', costPer1k: 0.80, dailyRequests: 28800, active: true },
    { id: 'swing', name: 'Swing Trader', icon: TrendingUp, color: '#06B6D4', costPer1k: 0.40, dailyRequests: 14400, active: true },
    { id: 'omni', name: 'Omni Prob.', icon: Layers, color: '#EC4899', costPer1k: 0.30, dailyRequests: 7200, active: true },
    { id: 'supreme', name: 'Supreme AI', icon: Crown, color: '#10B981', costPer1k: 1.20, dailyRequests: 9600, active: true },
    { id: 'robot', name: 'Alpha Robot', icon: Radio, color: '#6366F1', costPer1k: 0.60, dailyRequests: 3600, active: true },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl">
                <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} className="text-xs font-black" style={{ color: p.fill }}>
                        {p.name}: ${p.value.toFixed(2)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export const CostEstimator: React.FC = () => {
    const [models, setModels] = useState<ModelCost[]>(DEFAULT_MODELS);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [sortBy, setSortBy] = useState<'cost' | 'name'>('cost');
    const [goldStatus, setGoldStatus] = useState<any>(null);

    useEffect(() => {
        axios.get('/api/mt5/gold-scalper/status').then(r => setGoldStatus(r.data)).catch(() => {});
    }, []);

    const handleCostChange = (id: string, val: number) => {
        setModels(prev => prev.map(m => m.id === id ? { ...m, costPer1k: Math.max(0.01, val) } : m));
    };

    const handleRequestsChange = (id: string, val: number) => {
        setModels(prev => prev.map(m => m.id === id ? { ...m, dailyRequests: Math.max(0, val) } : m));
    };

    const toggleModel = (id: string) => {
        setModels(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
    };

    const dailyData = useMemo(() => {
        return models
            .filter(m => m.active)
            .map(m => ({
                name: m.name,
                daily: Number(((m.dailyRequests / 1000) * m.costPer1k).toFixed(2)),
                monthly: Number(((m.dailyRequests / 1000) * m.costPer1k * 22).toFixed(2)),
                color: m.color,
                costPer1k: m.costPer1k,
                requests: m.dailyRequests
            }));
    }, [models]);

    const sortedDaily = useMemo(() => {
        const sorted = [...dailyData];
        if (sortBy === 'cost') sorted.sort((a, b) => b.daily - a.daily);
        else sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sorted;
    }, [dailyData, sortBy]);

    const totalDaily = useMemo(() => dailyData.reduce((s, m) => s + m.daily, 0), [dailyData]);
    const totalMonthly = useMemo(() => dailyData.reduce((s, m) => s + m.monthly, 0), [dailyData]);
    const totalRequests = useMemo(() => dailyData.reduce((s, m) => s + m.requests, 0), [dailyData]);

    const chartData = useMemo(() => {
        const days = viewMode === 'daily' ? 1 : 22;
        const data = [];
        for (let i = 1; i <= (viewMode === 'daily' ? 24 : 22); i++) {
            const entry: any = { name: viewMode === 'daily' ? `${i}h` : `Dia ${i}` };
            for (const m of dailyData) {
                entry[m.name] = viewMode === 'daily'
                    ? Number((m.daily / 24).toFixed(2))
                    : Number((m.monthly / 22).toFixed(2));
            }
            data.push(entry);
        }
        return data;
    }, [dailyData, viewMode]);

    const cheapest = useMemo(() => {
        if (dailyData.length === 0) return null;
        return dailyData.reduce((a, b) => a.costPer1k < b.costPer1k ? a : b);
    }, [dailyData]);

    const mostExpensive = useMemo(() => {
        if (dailyData.length === 0) return null;
        return dailyData.reduce((a, b) => a.costPer1k > b.costPer1k ? a : b);
    }, [dailyData]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                        <DollarSign size={22} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Estimativa de Custos</h1>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Consumo financeiro por modelo de IA</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode('daily')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>
                        <Calendar size={14} className="inline mr-1" />Diário
                    </button>
                    <button onClick={() => setViewMode('monthly')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>
                        <Calendar size={14} className="inline mr-1" />Mensal
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Custo Diário', value: `$${totalDaily.toFixed(2)}`, color: 'text-emerald-400', icon: DollarSign },
                    { label: 'Custo Mensal', value: `$${totalMonthly.toFixed(2)}`, color: 'text-emerald-400', icon: DollarSign },
                    { label: 'Total Requisições/Dia', value: totalRequests.toLocaleString(), color: 'text-blue-400', icon: BarChart3 },
                    { label: 'Modelos Ativos', value: `${dailyData.length}/${models.length}`, color: 'text-violet-400', icon: Cpu },
                ].map((kpi, i) => (
                    <div key={i} className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                            <kpi.icon size={16} className={kpi.color} />
                        </div>
                        <span className={`text-2xl font-black italic ${kpi.color}`}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            Consumo {viewMode === 'daily' ? 'Horário (24h)' : 'Diário (22 dias úteis)'}
                        </span>
                    </div>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                            {dailyData.map(m => (
                                <Bar key={m.name} dataKey={m.name} stackId="a" fill={m.color} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Model Table + Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Model Configuration Table */}
                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Configuração por Modelo</span>
                        <button onClick={() => setSortBy(sortBy === 'cost' ? 'name' : 'cost')}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                            <ArrowUpDown size={12} />Ordenar por {sortBy === 'cost' ? 'nome' : 'custo'}
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="pb-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelo</th>
                                    <th className="pb-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Req./Dia</th>
                                    <th className="pb-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">$/1k</th>
                                    <th className="pb-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Custo/Dia</th>
                                    <th className="pb-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Custo/Mês</th>
                                    <th className="pb-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Ativo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDaily.map(m => {
                                    const model = models.find(x => x.name === m.name)!;
                                    return (
                                        <tr key={m.name} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                                                    <span className="font-bold text-white text-xs">{m.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <input type="number" value={m.requests}
                                                    onChange={e => handleRequestsChange(model.id, parseInt(e.target.value) || 0)}
                                                    className="w-24 bg-slate-800 text-right text-xs font-mono text-white rounded-lg px-2 py-1 border border-slate-700 focus:border-emerald-500 outline-none" />
                                            </td>
                                            <td className="py-3">
                                                <input type="number" step="0.01" value={m.costPer1k}
                                                    onChange={e => handleCostChange(model.id, parseFloat(e.target.value) || 0)}
                                                    className="w-20 bg-slate-800 text-right text-xs font-mono text-white rounded-lg px-2 py-1 border border-slate-700 focus:border-emerald-500 outline-none" />
                                            </td>
                                            <td className="py-3 text-right text-xs font-mono font-bold text-emerald-400">${m.daily.toFixed(2)}</td>
                                            <td className="py-3 text-right text-xs font-mono font-bold text-emerald-400">${m.monthly.toFixed(2)}</td>
                                            <td className="py-3 text-center">
                                                <button onClick={() => toggleModel(model.id)}
                                                    className={`w-8 h-5 rounded-full transition-colors relative ${model.active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${model.active ? 'left-3.5' : 'left-0.5'}`} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cost Comparison */}
                <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowUpDown size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Comparativo de Custo</span>
                    </div>
                    <div className="space-y-4">
                        {sortedDaily.map(m => {
                            const maxCost = sortedDaily.length > 0 ? Math.max(...sortedDaily.map(x => x.costPer1k)) : 1;
                            const barWidth = (m.costPer1k / maxCost) * 100;
                            return (
                                <div key={m.name} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                            <span className="font-bold text-slate-300">{m.name}</span>
                                        </div>
                                        <span className="font-mono font-bold text-slate-400">${m.costPer1k.toFixed(2)}/1k</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: m.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Resumo</span>
                        {cheapest && (
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <TrendingDown size={12} className="text-emerald-400" />
                                <span>Mais econômico: <span className="font-bold text-emerald-400">{cheapest.name}</span> (${cheapest.costPer1k.toFixed(2)}/1k)</span>
                            </div>
                        )}
                        {mostExpensive && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <TrendingUp size={12} className="text-red-400" />
                                <span>Mais caro: <span className="font-bold text-red-400">{mostExpensive.name}</span> (${mostExpensive.costPer1k.toFixed(2)}/1k)</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Savings Tip */}
            {dailyData.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Otimização de Custos</span>
                    </div>
                    <p className="text-sm text-slate-300">
                        {cheapest && mostExpensive && cheapest.id !== mostExpensive.id
                            ? `Trocar ${mostExpensive.name} por ${cheapest.name} pode reduzir o custo de ${mostExpensive.costPer1k > 0 ? `$${((mostExpensive.daily / mostExpensive.costPer1k) * cheapest.costPer1k).toFixed(2)}/dia` : 'N/A'} para $${cheapest.daily.toFixed(2)}/dia — economia de até $${((mostExpensive.daily || 0) - cheapest.daily || 0).toFixed(2)}/dia.`
                            : 'Distribua as requisições entre modelos mais econômicos para reduzir custos operacionais.'}
                    </p>
                </div>
            )}
        </div>
    );
};
