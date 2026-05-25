import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Activity, Shield, RefreshCw,
    AlertTriangle, CheckCircle2, Power, Settings,
    Zap, Layers, Target, XCircle, TrendingDown, Settings2,
    Gauge, Timer, DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface ForexScalperSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    useRiskPercentage: boolean;
    riskPercentage: number;
    gridDistancePoints: number;
    maxGridLevels: number;
    maxDailyLossUSD: number;
    dailyTargetUSD: number;
    smartBreakevenEnabled: boolean;
    smartBreakevenTriggerPoints: number;
    smartBreakevenLockPoints: number;
    takeProfitPoints: number;
    stopLossPoints: number;
    trailingStopEnabled: boolean;
    trailingStopPoints: number;
    basketSize: number;
    basketOffsetPoints: number;
    basketTPMultiplier: number;
    globalTrailingEnabled: boolean;
    gridMultiplier: number;
    gridDynamicDistance: boolean;
    trendFilterM5: boolean;
}

interface ForexState {
    dailyProfit: number;
    isGoalReached: boolean;
    isProcessing: boolean;
    activePositions: any[];
    logs: { time: string; msg: string; type: 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' }[];
}

function SpeedLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="spg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="spglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#spg)" strokeWidth="2" filter="url(#spglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#spg)" fontSize="18" fontWeight="900" fontStyle="italic" filter="url(#spglow)">S</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#spg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

export function ForexScalperPanel() {
    const [settings, setSettings] = useState<ForexScalperSettings | null>(null);
    const [state, setState] = useState<ForexState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [account, setAccount] = useState<{ balance?: number } | null>(null);

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/forex-scalper/status');
            const accResp = await axios.get('/api/mt5/account').catch(() => ({ data: { balance: 0 } }));
            setSettings(resp.data.settings);
            setState(resp.data.state);
            setAccount(accResp.data);
            setError(null);
        } catch (err) {
            setError('Falha ao conectar ao Backend do Speed Scalper.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const updateSetting = async (key: keyof ForexScalperSettings, value: any) => {
        if (!settings) return;
        setIsUpdating(true);
        try {
            await axios.post('/api/mt5/forex-scalper/settings', { [key]: value });
            fetchStatus();
        } catch (err) {
            setError('Erro ao atualizar configurações.');
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleEnabled = () => {
        if (settings) {
            updateSetting('enabled', !settings.enabled);
        }
    };

    const handleCloseOrder = async (ticket: number) => {
        try {
            await axios.post('/api/mt5/forex-scalper/close', { ticket });
            fetchStatus();
        } catch (err) {
            setError('Erro ao fechar ordem.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando Speed Scalper...</p>
            </div>
        );
    }

    if (!settings || !state) {
        return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-red-500/10 p-8 shadow-2xl text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-white mb-2">Erro de Conexão</h3>
                <p className="text-red-200">{error}</p>
                <button onClick={fetchStatus} className="mt-4 px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all">
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const progressPercent = settings.dailyTargetUSD > 0 ? Math.min((state.dailyProfit / settings.dailyTargetUSD) * 100, 100) : 0;
    const isActive = settings.enabled;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-cyan-500/10 rounded-3xl border border-cyan-500/20 shadow-xl shadow-cyan-500/10">
                        <SpeedLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Speed</span> Scalper
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${isActive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-cyan-500" /> Motor de tiros rápidos com Grid Dinâmico e Break Even Inteligente
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button
                        onClick={toggleEnabled}
                        disabled={isUpdating}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            isActive
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/20'
                        }`}
                    >
                        {isUpdating ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : isActive ? (
                            <><Power size={12} /> Desligar Motor</>
                        ) : (
                            <><Power size={12} /> Ativar Agressividade</>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-red-500/10 p-6 shadow-2xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">{error}</p>
                </div>
            )}

            {/* SPEED SCALPER ENGINE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Gauge className="text-cyan-500 animate-pulse" /> Progresso <span className="text-cyan-500">Diário</span>
                            {state.isGoalReached && (
                                <span className="px-2 py-0.5 rounded text-[10px] tracking-widest uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> META BATIDA
                                </span>
                            )}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Meta rápida de ${settings.dailyTargetUSD}</p>
                    </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="mb-8">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-2">
                        <span className="text-slate-500">Progresso</span>
                        <span className={`${state.dailyProfit >= settings.dailyTargetUSD ? 'text-emerald-400' : 'text-cyan-400'}`}>
                            ${state.dailyProfit.toFixed(2)} / ${settings.dailyTargetUSD}
                        </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ type: "spring", bounce: 0, duration: 1 }}
                            className={`h-full rounded-full ${state.dailyProfit >= settings.dailyTargetUSD
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                            }`}
                        />
                    </div>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/20 text-cyan-500 rounded-xl">
                            <Layers size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Níveis Abertos</p>
                            <p className="text-xl font-black text-white italic">{state.activePositions.length} <span className="text-sm text-slate-500 font-normal">/ {settings.maxGridLevels}</span></p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${state.dailyProfit >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro Atual</p>
                            <p className={`text-xl font-black italic ${state.dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {state.dailyProfit >= 0 ? '+' : ''}${state.dailyProfit.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <Target size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Multiplicador</p>
                            <p className="text-xl font-black text-white italic">{settings.gridMultiplier}x</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
                            <Settings2 size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Distância Grid</p>
                            <p className="text-xl font-black text-white italic">{settings.gridDistancePoints} pts</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* MONITOR DE TRADES */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                <TrendingUp className="text-cyan-500" size={18} /> Monitor de Trades em Execução
                            </h3>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total: {state.activePositions.length} Operações</span>
                        </div>

                        <div className="bg-slate-950/60 rounded-[2rem] border border-white/5 overflow-hidden">
                            <div className="max-h-72 overflow-x-auto overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="sticky top-0 bg-slate-900 border-b border-white/5">
                                        <tr className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-6 py-4">Ticket</th>
                                            <th className="px-6 py-4">Ativo/Tipo</th>
                                            <th className="px-6 py-4 text-right">Lotes</th>
                                            <th className="px-6 py-4 text-right">Preço Entry</th>
                                            <th className="px-6 py-4 text-right">Lucro Atual</th>
                                            <th className="px-6 py-4 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {state.activePositions.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                                        <Target size={40} />
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma operação em vigor no momento.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            state.activePositions.map((pos, i) => (
                                                <tr key={pos.ticket || i} className="group hover:bg-white/5 transition-all">
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{pos.ticket}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white italic">{pos.symbol}</span>
                                                            <span className={`text-[9px] font-black ${pos.type === 'BUY' ? 'text-cyan-400' : 'text-rose-400'}`}>
                                                                {pos.type}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-xs font-black text-white">{parseFloat(pos.volume).toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{parseFloat(pos.price_open).toFixed(5)}</td>
                                                    <td className={`px-6 py-4 text-right font-mono text-xs font-black italic ${parseFloat(pos.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {parseFloat(pos.profit) >= 0 ? '+' : ''}{parseFloat(pos.profit).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => handleCloseOrder(pos.ticket)} className="p-2 text-slate-500 hover:text-rose-400 transition-all" title="Fechar Ordem">
                                                            <XCircle size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LIVE EXECUTION LOGS */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Activity className="text-cyan-500" size={18} /> Live Execution (HFT)
                        </h3>

                        <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5 min-h-[200px]">
                            {state.logs.length === 0 ? (
                                <p className="text-slate-700 italic">Aguardando sinais...</p>
                            ) : (
                                state.logs.map((log, i) => (
                                    <div key={i} className="flex gap-3 items-start border-l-2 pl-2" style={{
                                        borderColor: log.type === 'SUCCESS' ? '#10b981' : log.type === 'WARN' ? '#f59e0b' : log.type === 'TRADE' ? '#22d3ee' : '#334155'
                                    }}>
                                        <span className="text-slate-600 shrink-0">{log.time}</span>
                                        <span className={
                                            log.type === 'SUCCESS' ? 'text-emerald-400' :
                                                log.type === 'WARN' ? 'text-amber-400' :
                                                    log.type === 'TRADE' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                                        }>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* PARÂMETROS INTELIGENTES */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Settings className="text-cyan-500" size={18} /> Parâmetros Inteligentes (Grid & BE)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lote</label>
                            <div onClick={() => updateSetting('useRiskPercentage', !settings.useRiskPercentage)}
                                className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${settings.useRiskPercentage ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.useRiskPercentage ? 'right-1' : 'left-1'}`} />
                            </div>
                        </div>
                        {settings.useRiskPercentage ? (
                            <div className="flex items-center gap-2">
                                <input type="number" min="0.1" max="10" step="0.1" value={settings.riskPercentage}
                                    onChange={(e) => updateSetting('riskPercentage', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                                <span className="text-[9px] font-black text-slate-500">%</span>
                            </div>
                        ) : (
                            <input type="number" min="0.01" step="0.01" value={settings.lotSize}
                                onChange={(e) => updateSetting('lotSize', parseFloat(e.target.value))}
                                className="w-full bg-slate-800 text-white font-mono rounded-lg px-3 py-2 border border-transparent focus:border-cyan-500 focus:ring-0" />
                        )}
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">{settings.useRiskPercentage ? `Lote por ${settings.riskPercentage}% da banca` : 'Lote fixo'}</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Layers size={14} /> Distância do Grid (Pts)
                        </label>
                        <input type="number" min="10" step="10" value={settings.gridDistancePoints}
                            onChange={(e) => updateSetting('gridDistancePoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-amber-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-amber-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Ativa próximo nível após X pontos contra</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Shield size={14} /> BE Alvo (Pontos)
                        </label>
                        <input type="number" min="10" step="10" value={settings.smartBreakevenTriggerPoints}
                            onChange={(e) => updateSetting('smartBreakevenTriggerPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Distância de lucro para armar Smart BE</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Shield size={14} /> BE Trava (Pontos)
                        </label>
                        <input type="number" min="0" step="1" value={settings.smartBreakevenLockPoints}
                            onChange={(e) => updateSetting('smartBreakevenLockPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Trava de lucro mínimo ao acionar o BE</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <TrendingUp size={14} /> Trailing Stop
                            </label>
                            <div onClick={() => updateSetting('trailingStopEnabled', !settings.trailingStopEnabled)}
                                className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${settings.trailingStopEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.trailingStopEnabled ? 'right-1' : 'left-1'}`} />
                            </div>
                        </div>
                        <input type="number" min="10" step="10" disabled={!settings.trailingStopEnabled}
                            value={settings.trailingStopPoints}
                            onChange={(e) => updateSetting('trailingStopPoints', parseInt(e.target.value))}
                            className={`w-full bg-slate-800 text-cyan-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-cyan-500 focus:ring-0 ${!settings.trailingStopEnabled ? 'opacity-50 cursor-not-allowed' : ''}`} />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Rastro dinâmico que segue o lucro</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Layers size={14} /> Basket TP Multiplier
                        </label>
                        <input type="number" step="0.5" min="0.5" max="5" value={settings.basketTPMultiplier}
                            onChange={(e) => updateSetting('basketTPMultiplier', parseFloat(e.target.value))}
                            className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Fecha cesta ao atingir {settings.basketTPMultiplier}x o TP base</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Settings2 size={14} /> Espaçamento Cesta
                        </label>
                        <input type="number" min="5" max="100" value={settings.basketOffsetPoints}
                            onChange={(e) => updateSetting('basketOffsetPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-purple-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-purple-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Distância inteligente entre camadas</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Shield size={14} /> Proteção Global
                        </label>
                        <button onClick={() => updateSetting('globalTrailingEnabled', !settings.globalTrailingEnabled)}
                            className={`w-full py-2 rounded-xl border font-black text-[10px] transition-all ${settings.globalTrailingEnabled
                                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                                : 'bg-slate-800/50 border-white/5 text-slate-500'}`}>
                            {settings.globalTrailingEnabled ? 'ATIVADA' : 'DESATIVADA'}
                        </button>
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Trava lucro da cesta inteira</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <TrendingUp size={14} /> Multiplicador Grid
                        </label>
                        <input type="number" step="0.1" min="1.0" max="3.0" value={settings.gridMultiplier}
                            onChange={(e) => updateSetting('gridMultiplier', parseFloat(e.target.value))}
                            className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Aumenta lotes para sair rápido (Martingale)</p>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <RefreshCw size={14} /> Distância Dinâmica
                        </label>
                        <button onClick={() => updateSetting('gridDynamicDistance', !settings.gridDynamicDistance)}
                            className={`w-full py-2 rounded-xl border font-black text-[10px] transition-all ${settings.gridDynamicDistance
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                : 'bg-slate-800/50 border-white/5 text-slate-500'}`}>
                            {settings.gridDynamicDistance ? 'INTELIGENTE' : 'FIXA'}
                        </button>
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Aumenta distância em drawdowns</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Activity size={14} /> Filtro Tendência M5
                        </label>
                        <button onClick={() => updateSetting('trendFilterM5', !settings.trendFilterM5)}
                            className={`w-full py-2 rounded-xl border font-black text-[10px] transition-all ${settings.trendFilterM5
                                ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'bg-slate-800/50 border-white/5 text-slate-500'}`}>
                            {settings.trendFilterM5 ? 'ATIVADO' : 'DESATIVADO'}
                        </button>
                        <p className="text-[7px] text-slate-500 mt-1 uppercase tracking-widest">Só entra na direção da tendência M5</p>
                    </div>
                </div>

                {/* RISK MANAGEMENT */}
                <div className="mt-8 pt-8 border-t border-white/5">
                    <h4 className="text-sm font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <Shield className="text-cyan-500" size={16} /> Gestão de Risco Global
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Meta Diária (USD)</label>
                            <input type="number" value={settings.dailyTargetUSD}
                                onChange={(e) => updateSetting('dailyTargetUSD', parseFloat(e.target.value))}
                                className="w-full bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-emerald-500 focus:ring-0" />
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Max Loss Diário (USD)</label>
                            <input type="number" value={settings.maxDailyLossUSD}
                                onChange={(e) => updateSetting('maxDailyLossUSD', parseFloat(e.target.value))}
                                className="w-full bg-slate-800 text-rose-400 font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-rose-500 focus:ring-0" />
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Ordem Take (Pts)</label>
                            <input type="number" value={settings.takeProfitPoints}
                                onChange={(e) => updateSetting('takeProfitPoints', parseInt(e.target.value))}
                                className="w-full bg-slate-800 text-white font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-cyan-500 focus:ring-0" />
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Ordem SL (Pts)</label>
                            <input type="number" value={settings.stopLossPoints}
                                onChange={(e) => updateSetting('stopLossPoints', parseInt(e.target.value))}
                                className="w-full bg-slate-800 text-white font-mono font-bold rounded-lg px-3 py-2 border border-transparent focus:border-rose-500 focus:ring-0" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
