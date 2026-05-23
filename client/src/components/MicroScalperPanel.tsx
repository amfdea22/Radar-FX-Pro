import React, { useState, useEffect } from 'react';
import {
    Zap, Activity, Target, Shield, Layers,
    RefreshCw, DollarSign, TrendingUp, Cpu,
    Power, Settings, Timer, AlertTriangle, ArrowRight
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
    activeOrders: any[]; // New: Monitor of active orders
    totalProfit: number;
    logs: { time: string, msg: string, type: 'INFO' | 'TRADE' | 'WARN' }[]; // New: Execution logs
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
            <div className="flex items-center justify-center p-20">
                <RefreshCw className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    const s = status.settings;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Titan Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[2.5rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap size={120} className="text-white" />
                </div>

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                            <Cpu className="text-white animate-pulse" size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                                Titan Micro-Sniper <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded italic not-italic font-black text-white">Banca Pequena v1.0</span>
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Estratégia: Fast Shot Grid</span>
                                <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${s.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                                    {s.enabled ? 'Sincronizado' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => updateSetting('enabled', !s.enabled)}
                        className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all shadow-xl border ${s.enabled
                            ? 'bg-indigo-500 text-white border-white/20 shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                    >
                        <Power size={18} />
                        {s.enabled ? 'titan active' : 'engage sniper'}
                    </button>
                </div>
            </div>

            {/* Performance Widgets (Mini Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Lucro do Ciclo', value: `$${status.totalProfit.toFixed(2)}`, icon: <DollarSign size={16} />, color: status.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                    { label: 'Posições Ativas', value: `${status.activePositions} / ${s.maxLevels}`, icon: <Layers size={16} />, color: 'text-indigo-400' },
                    { label: 'RSI Sniper M1', value: status.rsi.toFixed(1), icon: <Activity size={16} />, color: 'text-purple-400' },
                    { label: 'Bias M1/M5', value: `${status.trendM1} / ${status.trendM5}`, icon: <TrendingUp size={16} />, color: 'text-indigo-400' }
                ].map((item, i) => (
                    <div key={i} className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                        <div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{item.label}</span>
                            <span className={`text-lg font-black italic tracking-tighter ${item.color}`}>{item.value}</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-indigo-500/10 transition-colors">
                            <span className={item.color}>{item.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden">
                        <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3 mb-6">
                            <Layers className="text-indigo-500" size={20} /> Monitor de Execution (Grid)
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket</th>
                                        <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ativo</th>
                                        <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                        <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lote</th>
                                        <th className="py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Lucro USD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {status.activeOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Aguardando gatilho Sniper...</td>
                                            </tr>
                                        ) : (
                                            status.activeOrders.map((order: any) => (
                                                <motion.tr
                                                    key={order.ticket}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="border-b border-slate-800/50 hover:bg-white/5 transition-colors"
                                                >
                                                    <td className="py-3 text-xs font-mono text-slate-400">#{order.ticket}</td>
                                                    <td className="py-3 text-[10px] font-black text-white italic">{order.symbol}</td>
                                                    <td className="py-3">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${order.type === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                            {order.type === 0 ? 'BUY' : 'SELL'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-xs font-bold text-white">{order.volume.toFixed(2)}</td>
                                                    <td className={`py-3 text-xs font-black text-right ${order.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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

                    <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
                        <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3 mb-6">
                            <Settings className="text-indigo-500" size={20} /> Sniper Settings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alvo Cesta ($)</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => updateSetting('targetProfitUSD', Math.max(0.5, s.targetProfitUSD - 0.1))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                    <span className="text-xs font-black text-emerald-400">${s.targetProfitUSD.toFixed(1)}</span>
                                    <button onClick={() => updateSetting('targetProfitUSD', Math.min(10, s.targetProfitUSD + 0.1))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Grade Step (Pts)</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => updateSetting('gridStepPips', Math.max(20, s.gridStepPips - 10))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">-</button>
                                    <span className="text-xs font-black text-indigo-400">{s.gridStepPips}</span>
                                    <button onClick={() => updateSetting('gridStepPips', Math.min(1000, s.gridStepPips + 10))} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Terminal & Log HFT */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-xl flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-3">
                                <Timer className="text-emerald-500" size={18} /> Terminal Dev Mode
                            </h3>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>

                        <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5">
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

                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={handleReset}
                                className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Finalizar Cesta
                            </button>
                            <button
                                onClick={fetchStatus}
                                className="p-3 bg-slate-800 text-slate-400 rounded-xl border border-slate-700"
                            >
                                <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            Titan Sniper <span className="mx-2">|</span> High Frequency Grid <span className="mx-2">|</span> Account Protection v1.0
                        </p>
                    </div>
                </div>
            </div>

            {/* Micro Management Tip */}
            <div className="bg-indigo-500/5 p-5 rounded-3xl border border-indigo-500/10 text-center">
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest italic opacity-70">
                    Dica de Gestão: Para bancas de $50-100, mantenha o Alvo da Cesta em $0.50 e a Grade em 100 pips.
                </p>
            </div>
        </div>
    );
};
