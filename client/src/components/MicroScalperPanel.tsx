import React, { useState, useEffect } from 'react';
import {
    Zap, Activity, Target, Shield, Layers,
    RefreshCw, DollarSign, TrendingUp, Cpu,
    Power, Settings, Timer, AlertTriangle, ArrowRight,
    Crosshair, Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface MicroStatus {
    settings: {
        enabled: boolean;
        symbol: string;
        lotBase: number;
        lotMultiplier: number;
        gridStepPips: number;
        maxLevels: number;
        targetProfitUSD: number;
        stopLossUSD: number;
        rsiPeriod: number;
        rsiOverbought: number;
        rsiOversold: number;
        trendFilterM1: boolean;
        quickTP: boolean;
    };
    rsi: number;
    trendM1: string;
    trendM5: string;
    activePositions: number;
    activeOrders: any[];
    totalProfit: number;
    logs: { time: string, msg: string, type: 'INFO' | 'TRADE' | 'WARN' }[];
}

function SniperLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <filter id="sglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#sg)" strokeWidth="2" filter="url(#sglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#sg)" fontSize="22" fontWeight="900" fontStyle="italic" filter="url(#sglow)">T</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#sg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

export const MicroScalperPanel: React.FC = () => {
    const [status, setStatus] = useState<MicroStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/micro-scalper/status');
            setStatus(resp.data);
            setLoading(false);
        } catch (err) {
            console.error('Micro Scalper fetch error:', err);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const updateSetting = async (key: string, value: any) => {
        setUpdating(true);
        try {
            await axios.post('/api/mt5/micro-scalper/settings', { [key]: value });
            await fetchStatus();
        } catch (err) {
            console.error('Update failed:', err);
        } finally {
            setUpdating(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Deseja resetar a cesta do Titan Sniper e fechar todas as ordens?')) return;
        try {
            await axios.post('/api/mt5/micro-scalper/reset');
            await fetchStatus();
        } catch (err) {
            console.error('Reset failed:', err);
        }
    };

    if (loading || !status) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando Titan Sniper...</p>
            </div>
        );
    }

    const s = status.settings;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
                        <SniperLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Titan</span> Micro-Sniper
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${s.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {s.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-indigo-500" /> Fast Shot Grid | Banca Pequena v1.0
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button
                        onClick={() => updateSetting('enabled', !s.enabled)}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            s.enabled
                                ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/20'
                        }`}
                    >
                        {updating ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : s.enabled ? (
                            <><Power size={12} /> Desligar Sniper</>
                        ) : (
                            <><Power size={12} /> Ligar Sniper</>
                        )}
                    </button>
                </div>
            </div>

            {/* MICRO SNIPER ENGINE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Crosshair className="text-indigo-500 animate-pulse" /> Sniper <span className="text-indigo-500">Grid</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] tracking-widest uppercase animate-pulse ${
                                s.enabled ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'
                            }`}>
                                {s.enabled ? `${status.activePositions} Posição(ões)` : 'Offline'}
                            </span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Grid Scalping para Bancas Pequenas • Execução Rápida em M1/M5</p>
                    </div>
                </div>

                {/* PERFORMANCE STATS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro do Ciclo</p>
                            <p className={`text-xl font-black italic ${status.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ${status.totalProfit.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
                            <Layers size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Posições / Max</p>
                            <p className="text-xl font-black text-white italic">{status.activePositions} / {s.maxLevels}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-purple-500/20 text-purple-500 rounded-xl">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">RSI Sniper M1</p>
                            <p className={`text-xl font-black italic ${status.rsi > 70 ? 'text-rose-400' : status.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
                                {status.rsi.toFixed(1)}
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bias M1/M5</p>
                            <p className="text-xl font-black text-white italic">{status.trendM1} / {status.trendM5}</p>
                        </div>
                    </div>
                </div>

                {/* SNIPER SETTINGS */}
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <Settings className="text-indigo-500" size={18} /> Sniper Settings
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alvo Cesta ($)</span>
                                <span className="text-sm font-black text-emerald-400">${s.targetProfitUSD.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <button onClick={() => updateSetting('targetProfitUSD', Math.max(0.5, s.targetProfitUSD - 0.1))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                <span className="text-2xl font-black text-white">{s.targetProfitUSD.toFixed(1)}</span>
                                <button onClick={() => updateSetting('targetProfitUSD', Math.min(10, s.targetProfitUSD + 0.1))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Grade Step (Pts)</span>
                                <span className="text-sm font-black text-indigo-400">{s.gridStepPips}</span>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <button onClick={() => updateSetting('gridStepPips', Math.max(20, s.gridStepPips - 10))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                <span className="text-2xl font-black text-white">{s.gridStepPips}</span>
                                <button onClick={() => updateSetting('gridStepPips', Math.min(1000, s.gridStepPips + 10))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lote Base</span>
                                <span className="text-sm font-black text-white">{s.lotBase.toFixed(2)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {[0.01, 0.05, 0.1].map(lot => (
                                    <button key={lot}
                                        onClick={() => updateSetting('lotBase', lot)}
                                        className={`py-2 rounded-xl border font-black text-[10px] transition-all ${s.lotBase === lot
                                            ? 'bg-indigo-500/20 border-indigo-500/30 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                            : 'bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-700/50'}`}>
                                        {lot}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Multiplicador Lote</span>
                                <span className="text-sm font-black text-amber-400">{s.lotMultiplier}x</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-3">
                                {[1, 1.5, 2, 2.5].map(m => (
                                    <button key={m}
                                        onClick={() => updateSetting('lotMultiplier', m)}
                                        className={`py-2 rounded-xl border font-black text-[10px] transition-all ${s.lotMultiplier === m
                                            ? 'bg-amber-500/20 border-amber-500/30 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                            : 'bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-700/50'}`}>
                                        {m}x
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Níveis Máximos</span>
                                <span className="text-sm font-black text-white">{s.maxLevels}</span>
                            </div>
                            <input type="range" min={1} max={20} value={s.maxLevels}
                                onChange={(e) => updateSetting('maxLevels', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500 mt-3" />
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stop Loss Cesta ($)</span>
                                <span className="text-sm font-black text-rose-400">${s.stopLossUSD.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <button onClick={() => updateSetting('stopLossUSD', Math.max(1, s.stopLossUSD - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                <span className="text-2xl font-black text-white">{s.stopLossUSD}</span>
                                <button onClick={() => updateSetting('stopLossUSD', Math.min(50, s.stopLossUSD + 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Período RSI</span>
                                <span className="text-sm font-black text-purple-400">{s.rsiPeriod}</span>
                            </div>
                            <input type="range" min={7} max={21} value={s.rsiPeriod}
                                onChange={(e) => updateSetting('rsiPeriod', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500 mt-3" />
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RSI Overbought / Oversold</span>
                                <span className="text-sm font-black text-rose-400">{s.rsiOverbought} / <span className="text-emerald-400">{s.rsiOversold}</span></span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <button onClick={() => updateSetting('rsiOverbought', Math.min(90, s.rsiOverbought + 5))}
                                    className="py-2 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 font-black text-[9px] hover:bg-slate-700/50">OB +5</button>
                                <button onClick={() => updateSetting('rsiOversold', Math.max(10, s.rsiOversold - 5))}
                                    className="py-2 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 font-black text-[9px] hover:bg-slate-700/50">OS -5</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <button
                            onClick={() => updateSetting('trendFilterM1', !s.trendFilterM1)}
                            className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${s.trendFilterM1
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                                : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                            <Gauge size={20} className={s.trendFilterM1 ? 'text-indigo-400' : ''} />
                            <div className="text-left">
                                <span className="text-[8px] font-black uppercase tracking-widest block">Filtro Tendência M1</span>
                                <span className="text-[7px] text-slate-500 tracking-widest uppercase">{s.trendFilterM1 ? 'Opera apenas na direção do bias M1' : 'Sem restrição de tendência'}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => updateSetting('quickTP', !s.quickTP)}
                            className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${s.quickTP
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                                : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                            <Zap size={20} className={s.quickTP ? 'text-emerald-400' : ''} />
                            <div className="text-left">
                                <span className="text-[8px] font-black uppercase tracking-widest block">Quick TP</span>
                                <span className="text-[7px] text-slate-500 tracking-widest uppercase">{s.quickTP ? 'Take profit rápido ativado' : 'TP normal'}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* LEFT: MONITOR DE EXECUTION */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                <Layers className="text-indigo-500" size={18} /> Monitor de Execution
                            </h3>
                            <button
                                onClick={fetchStatus}
                                className="p-3 bg-slate-800/50 text-slate-400 rounded-2xl border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-all"
                            >
                                <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="bg-slate-950/60 rounded-[2rem] border border-white/5 overflow-hidden">
                            <div className="max-h-72 overflow-x-auto overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="sticky top-0 bg-slate-900 border-b border-white/5">
                                        <tr className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-6 py-4">Ticket</th>
                                            <th className="px-6 py-4">Ativo</th>
                                            <th className="px-6 py-4">Tipo</th>
                                            <th className="px-6 py-4">Lote</th>
                                            <th className="px-6 py-4 text-right">Lucro USD</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <AnimatePresence>
                                            {status.activeOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                                            <Target size={40} />
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Aguardando gatilho Sniper...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                status.activeOrders.map((order: any, i: number) => (
                                                    <motion.tr
                                                        key={order.ticket || i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="group hover:bg-white/5 transition-all"
                                                    >
                                                        <td className="px-6 py-4 text-xs font-mono text-slate-400">#{order.ticket}</td>
                                                        <td className="px-6 py-4 font-black text-white text-xs italic">{order.symbol}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${order.type === 0
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                                                                {order.type === 0 ? 'BUY' : 'SELL'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-black text-white">{order.volume.toFixed(2)}</td>
                                                        <td className={`px-6 py-4 text-xs font-black italic text-right ${order.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            ${order.profit.toFixed(2)}
                                                        </td>
                                                    </motion.tr>
                                                ))
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleReset}
                                className="flex-1 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20"
                            >
                                Finalizar Cesta
                            </button>
                            <button
                                onClick={fetchStatus}
                                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    updating
                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-500 cursor-wait'
                                    : 'bg-slate-800/50 border-white/5 text-slate-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400'
                                }`}
                            >
                                <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                                {updating ? 'Atualizando...' : 'Atualizar'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: TERMINAL & LOGS */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Timer className="text-emerald-500" size={18} /> Terminal Dev Mode
                        </h3>

                        <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5 min-h-[200px]">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
                            {status.logs.length === 0 ? (
                                <p className="text-slate-700 italic">Initializing Sniper Session...</p>
                            ) : (
                                status.logs.map((log, i) => (
                                    <div key={i} className="flex gap-3 opacity-90 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                        <span className={
                                            log.type === 'TRADE' ? 'text-indigo-400 font-bold' :
                                                log.type === 'WARN' ? 'text-rose-500' : 'text-slate-400'
                                        }>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-indigo-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                        <div className="text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                Titan Sniper <span className="mx-2">|</span> High Frequency Grid <span className="mx-2">|</span> Account Protection v1.0
                            </p>
                        </div>
                    </div>

                    <div className="bg-indigo-500/5 p-5 rounded-3xl border border-indigo-500/10 text-center">
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest italic opacity-70">
                            Dica de Gestão: Para bancas de $50-100, mantenha o Alvo da Cesta em $0.50 e a Grade em 100 pips.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
