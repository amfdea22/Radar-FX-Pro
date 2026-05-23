import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Calculator, TrendingUp, TrendingDown, DollarSign, Calendar, Target,
    Download, RefreshCw, BarChart2, ShieldAlert, ArrowUpRight, ArrowDownRight,
    Wallet, Save, Plus, Trash2, Edit3, PieChart, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';

// --- Interfaces ---
interface DailyRecord {
    day: number;
    pnl: number;
    obs: string;
}

interface CompoundRow {
    day: number;
    investment: number;
    rate: number;
    profitPrev: number;
    forecast: number;
    real: number;
}

// --- Componente Principal ---
export const FinancialControl: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'compound'>('daily');
    const [serverData, setServerData] = useState<any>(null);
    const [serverLoading, setServerLoading] = useState(true);

    // --- Fetch real data from Radar FX ---
    useEffect(() => {
        const fetchServer = async () => {
            try {
                const [account, ai] = await Promise.all([
                    axios.get('/api/mt5/account').catch(() => ({ data: { balance: 0, equity: 0 } })),
                    axios.get('/api/mt5/ai-monitoring').catch(() => ({ data: null }))
                ]);
                setServerData({
                    balance: account.data.balance || 0,
                    equity: account.data.equity || 0,
                    dailyProfit: account.data.daily_profit ?? null,
                    dailyClosedProfit: account.data.daily_closed_profit ?? null,
                    gold: ai.data?.gold || null,
                    robot: ai.data?.robot || null,
                    goldReport: ai.data?.gold?.report || null,
                });
                setServerLoading(false);
            } catch (e) {
                setServerLoading(false);
            }
        };
        fetchServer();
        const interval = setInterval(fetchServer, 15000);
        return () => clearInterval(interval);
    }, []);

    // --- State: Configuração Global (Atualizado c/ Dados do Usuário) ---
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('gold_scalper_fin_config');
        if (saved) return JSON.parse(saved);
        return {
            initialBalance: 500.00,
            dailyGoal: 25.00,
            stake: 2.00,
            stopLoss: 50.00,
            dolarRate: 5.24,
            objective: 5.0
        };
    });

    // Sync initial balance from server when data arrives
    useEffect(() => {
        if (serverData?.balance && serverData.balance > 0) {
            setConfig(prev => {
                const saved = localStorage.getItem('gold_scalper_fin_config');
                if (saved) return prev;
                return { ...prev, initialBalance: serverData.balance };
            });
        }
    }, [serverData?.balance]);

    // --- State: Dados Diários (Preenchido com dados reais do servidor) ---
    const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(() => {
        const saved = localStorage.getItem('gold_scalper_daily_records');
        if (saved && saved !== '[]') return JSON.parse(saved);
        return Array.from({ length: 31 }, (_, i) => ({ day: i + 1, pnl: 0, obs: '' }));
    });

    // Sync daily PnL from server into day 1
    useEffect(() => {
        if (serverData?.gold?.accountDailyProfit != null && serverData) {
            setDailyRecords(prev => {
                const saved = localStorage.getItem('gold_scalper_daily_records');
                if (saved && saved !== '[]') return prev;
                const updated = [...prev];
                updated[0] = { day: 1, pnl: serverData.gold.accountDailyProfit, obs: 'Lucro Real MT5' };
                return updated;
            });
        }
    }, [serverData?.gold?.accountDailyProfit]);

    // --- State: Projeção Juros Compostos ---
    const [compoundConfig, setCompoundConfig] = useState(() => {
        const saved = localStorage.getItem('gold_scalper_compound_config');
        if (saved) return JSON.parse(saved);
        return {
            initial: 500.00,
            rate: 5.0 // Meta de 5% recomendada pelo Gold Scalper
        };
    });

    const [realizedCompound, setRealizedCompound] = useState<number[]>(() => {
        const saved = localStorage.getItem('gold_scalper_compound_realized');
        if (saved) return JSON.parse(saved);
        return Array(60).fill(0);
    });

    // Sync realized compound from server
    useEffect(() => {
        if (serverData?.gold?.accountDailyProfit != null && serverData) {
            setRealizedCompound(prev => {
                const saved = localStorage.getItem('gold_scalper_compound_realized');
                if (saved) return prev;
                const updated = [...prev];
                updated[0] = serverData.gold.accountDailyProfit;
                return updated;
            });
        }
    }, [serverData?.gold?.accountDailyProfit]);

    // --- Persistência ---
    useEffect(() => {
        localStorage.setItem('gold_scalper_fin_config', JSON.stringify(config));
        localStorage.setItem('gold_scalper_daily_records', JSON.stringify(dailyRecords));
        localStorage.setItem('gold_scalper_compound_config', JSON.stringify(compoundConfig));
        localStorage.setItem('gold_scalper_compound_realized', JSON.stringify(realizedCompound));
    }, [config, dailyRecords, compoundConfig, realizedCompound]);

    // --- Cálculos: Dados Diários ---
    const dailyAnalytics = useMemo(() => {
        let current = config.initialBalance;
        const processed = dailyRecords.map(r => {
            current += r.pnl;
            return { ...r, balance: current };
        });
        const totalPnl = dailyRecords.reduce((acc, r) => acc + r.pnl, 0);
        const growth = (totalPnl / config.initialBalance) * 100;

        return {
            processed,
            currentBalance: current,
            totalPnl,
            growth,
            totalPnlBRL: totalPnl * config.dolarRate
        };
    }, [dailyRecords, config]);

    // Real growth percentage from server
    const realGrowthPct = useMemo(() => {
        if (!serverData?.balance) return dailyAnalytics.growth;
        return ((serverData.balance - config.initialBalance) / config.initialBalance) * 100;
    }, [serverData?.balance, config.initialBalance, dailyAnalytics.growth]);

    // Real total profit from server (MT5 daily closed PnL - engine)
    const realTotalProfit = useMemo(() => {
        if (!serverData) return 0;
        if (serverData?.gold?.accountDailyProfit != null) return serverData.gold.accountDailyProfit;
        if (serverData.balance != null) return serverData.balance - config.initialBalance;
        return 0;
    }, [serverData?.gold?.accountDailyProfit, serverData?.balance, config.initialBalance]);

    // --- Cálculos: Juros Compostos ---
    const compoundData = useMemo(() => {
        let current = compoundConfig.initial;
        return Array.from({ length: 60 }, (_, i) => {
            const prev = current;
            const profitPrev = prev * (compoundConfig.rate / 100);
            const forecast = prev + profitPrev;
            current = forecast;
            return {
                day: i + 1,
                investment: prev,
                rate: compoundConfig.rate,
                profitPrev,
                forecast,
                real: realizedCompound[i] || 0
            };
        });
    }, [compoundConfig, realizedCompound]);

    // --- Render Helpers ---
    const formatCurrency = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="p-6 space-y-6 text-white min-h-screen bg-slate-950 font-sans selection:bg-emerald-500/30">
            {/* Header / Nav */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20">
                        <Calculator size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tighter text-white">Controle Financeiro <span className="text-emerald-500">VIP</span></h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gestão de Banca & Projeção HFT</p>
                        {serverData && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Sincronizado c/ Radar FX</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-stretch md:self-auto">
                    {[
                        { id: 'daily', label: 'Dados Diários', icon: Calendar },
                        { id: 'monthly', label: 'Mês a Mês', icon: BarChart2 },
                        { id: 'compound', label: 'Juros Compostos', icon: TrendingUp },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <tab.icon size={14} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'daily' && (
                    <motion.div
                        key="daily"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* Summary Tiles (Replica Excel) */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Banca Inicial', val: formatCurrency(config.initialBalance), color: 'text-amber-400', key: 'initialBalance' },
                                { label: 'Meta Diária', val: formatCurrency(config.dailyGoal), color: 'text-white', key: 'dailyGoal' },
                                { label: 'Banca Atual', val: serverData?.balance ? formatCurrency(serverData.balance) : formatCurrency(dailyAnalytics.currentBalance), color: 'text-emerald-400' },
                                { label: 'Stake', val: formatCurrency(config.stake), color: 'text-white', key: 'stake' },
                                { label: 'Dólar (BRL)', val: `R$ ${config.dolarRate.toFixed(2)}`, color: 'text-trader-blue', key: 'dolarRate' },
                                { label: 'Lucro Total', val: serverData ? formatCurrency(realTotalProfit) : formatCurrency(dailyAnalytics.totalPnl), color: realTotalProfit >= 0 ? 'text-emerald-400' : 'text-trader-red' },
                            ].map((tile, i) => (
                                <div key={i} className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {tile.key && (
                                            <Edit3 size={10} className="text-slate-500 cursor-pointer hover:text-white"
                                                onClick={() => {
                                                    const newVal = prompt(`Novo valor para ${tile.label}:`, (config as any)[tile.key!]);
                                                    if (newVal) setConfig({ ...config, [tile.key!]: parseFloat(newVal) });
                                                }}
                                            />
                                        )}
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{tile.label}</p>
                                    <h3 className={`text-lg font-black font-mono ${tile.color}`}>{tile.val}</h3>
                                    {tile.label === 'Banca Atual' && (
                                        <div className="mt-2 flex items-center gap-1">
                                            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, realGrowthPct))}%` }} />
                                            </div>
                                            <span className={`text-[9px] font-black ${realGrowthPct >= 0 ? 'text-emerald-500' : 'text-trader-red'}`}>{realGrowthPct >= 0 ? '+' : ''}{realGrowthPct.toFixed(1)}%</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Chart Area */}
                        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl backdrop-blur-sm h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyAnalytics.processed.filter((r, i) => i < 10)}>
                                    <defs>
                                        <linearGradient id="colorBala" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="day" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBala)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Editable Table */}
                        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-900 z-10">
                                        <tr>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Dia</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Profit/Loss ($)</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Banca Final</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Observação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs">
                                        {dailyAnalytics.processed.map((r, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 font-black text-slate-500">{r.day}</td>
                                                <td className="p-4">
                                                    <input
                                                        type="number"
                                                        value={r.pnl}
                                                        step="0.01"
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                            const newRecords = [...dailyRecords];
                                                            newRecords[i].pnl = val;
                                                            setDailyRecords(newRecords);
                                                        }}
                                                        className={`bg-slate-950/40 border border-transparent focus:border-emerald-500/50 rounded px-2 py-1 w-24 font-mono font-bold focus:ring-0 ${r.pnl > 0 ? 'text-emerald-400' : r.pnl < 0 ? 'text-trader-red' : 'text-slate-600'}`}
                                                    />
                                                </td>
                                                <td className="p-4 font-mono font-bold text-white/80">{formatCurrency(r.balance)}</td>
                                                <td className="p-4 italic">
                                                    <input
                                                        type="text"
                                                        value={r.obs}
                                                        placeholder="..."
                                                        onChange={(e) => {
                                                            const newRecords = [...dailyRecords];
                                                            newRecords[i].obs = e.target.value;
                                                            setDailyRecords(newRecords);
                                                        }}
                                                        className="bg-transparent border-none p-0 w-full text-[10px] text-slate-400 focus:ring-0 focus:text-white transition-all"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'compound' && (
                    <motion.div
                        key="compound"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-6"
                    >
                        {/* Calculator Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                            <div className="space-y-4">
                                <h2 className="text-xl font-black uppercase text-white flex items-center gap-3">
                                    <TrendingUp className="text-emerald-500" /> Simulador de Juros Compostos
                                </h2>
                                <p className="text-xs text-slate-400">Projeção recomendada: 3% a 5% ao dia.</p>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Investimento Inicial ($)</label>
                                        <input
                                            type="number"
                                            value={compoundConfig.initial}
                                            onChange={(e) => setCompoundConfig({ ...compoundConfig, initial: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono w-full text-sm"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Retorno (%)</label>
                                        <input
                                            type="number"
                                            value={compoundConfig.rate}
                                            onChange={(e) => setCompoundConfig({ ...compoundConfig, rate: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-trader-green font-mono w-full text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex flex-col justify-center">
                                <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest mb-1">Previsão Acumulada (60 dias)</p>
                                <h3 className="text-4xl font-black text-white">$ {compoundData[59].forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase">Meta de Multiplicação: {(compoundData[59].forecast / compoundConfig.initial).toFixed(0)}x</p>
                            </div>
                        </div>

                        {/* Compound Table */}
                        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto max-h-[600px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-900 z-10 shadow-lg border-b border-white/5">
                                        <tr>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dia</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Investimento ($)</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Retorno (%)</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lucro Prev.</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Previsão Acum.</th>
                                            <th className="p-4 text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5">Realizado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs">
                                        {compoundData.map((r, i) => (
                                            <tr key={i} className={`hover:bg-white/5 transition-colors ${i % 30 === 0 && i !== 0 ? 'border-t-2 border-emerald-500/30' : ''}`}>
                                                <td className="p-4 font-black text-slate-600">{r.day}</td>
                                                <td className="p-4 font-mono text-white/50">{formatCurrency(r.investment)}</td>
                                                <td className="p-4 font-mono font-bold text-emerald-500">{r.rate}%</td>
                                                <td className="p-4 font-mono text-emerald-400/80">+{formatCurrency(r.profitPrev)}</td>
                                                <td className="p-4 font-mono font-black text-white">{formatCurrency(r.forecast)}</td>
                                                <td className="p-4 bg-amber-500/5">
                                                    <input
                                                        type="number"
                                                        value={r.real || ''}
                                                        placeholder="0.00"
                                                        onChange={(e) => {
                                                            const newReal = [...realizedCompound];
                                                            newReal[i] = parseFloat(e.target.value) || 0;
                                                            setRealizedCompound(newReal);
                                                        }}
                                                        className="bg-transparent border-none p-0 w-20 font-mono font-bold text-amber-500 focus:ring-0"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'monthly' && (
                    <motion.div
                        key="monthly"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 p-8 rounded-3xl backdrop-blur-md h-[500px]">
                                <h2 className="text-xl font-black uppercase text-white mb-8">Evolução Mensal (Performance)</h2>
                                <ResponsiveContainer width="100%" height="80%">
                                    <BarChart data={[
                                        { m: 'JAN', p: 0 }, { m: 'FEV', p: 0 }, { m: 'MAR', p: serverData?.gold?.dailyProfit || dailyAnalytics.totalPnl },
                                        { m: 'ABR', p: 0 }, { m: 'MAI', p: 0 }, { m: 'JUN', p: 0 },
                                        { m: 'JUL', p: 0 }, { m: 'AGO', p: 0 }, { m: 'SET', p: 0 },
                                        { m: 'OUT', p: 0 }, { m: 'NOV', p: 0 }, { m: 'DEZ', p: 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis dataKey="m" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: '#ffffff05' }} />
                                        <Bar dataKey="p" radius={[6, 6, 0, 0]}>
                                            {([
                                                { m: 'JAN', p: 450 }, { m: 'FEV', p: 820 }, { m: 'MAR', p: dailyAnalytics.totalPnl },
                                                { m: 'ABR', p: 0 }, { m: 'MAI', p: 0 }, { m: 'JUN', p: 0 },
                                                { m: 'JUL', p: 0 }, { m: 'AGO', p: 0 }, { m: 'SET', p: 0 },
                                                { m: 'OUT', p: 0 }, { m: 'NOV', p: 0 }, { m: 'DEZ', p: 0 }
                                            ]).map((entry, index) => (
                                                <Cell key={index} fill={entry.p >= 0 ? '#10b981' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-900 border border-white/5 p-6 rounded-3xl">
                                    <h3 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-tighter">Histórico de Fechamento</h3>
                                    <div className="space-y-3">
                                        {['JAN', 'FEV', 'MAR'].map(m => (
                                            <div key={m} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{m}</span>
                                                <span className={`text-sm font-mono font-bold ${m === 'MAR' ? (dailyAnalytics.totalPnl >= 0 ? 'text-emerald-400' : 'text-trader-red') : 'text-emerald-400'}`}>
                                                    {m === 'MAR' ? formatCurrency(dailyAnalytics.totalPnl) : formatCurrency(m === 'JAN' ? 450 : 820)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-6 bg-gradient-to-br from-trader-blue/20 to-indigo-500/20 border border-trader-blue/30 rounded-3xl">
                                    <Target className="text-trader-blue mb-4" size={32} />
                                    <h4 className="font-black text-white uppercase text-[10px] mb-2 tracking-widest">Meta Anual</h4>
                                    <p className="text-[11px] text-slate-400 leading-relaxed italic">"A consistência mora nos detalhes. O controle mensal permite ajustar o gerenciamento antes que o drawdown se torne irreversível."</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
