import React, { useState, useEffect } from 'react';
import {
    Zap, Radar, ShieldCheck, TrendingUp, TrendingDown, Target, Clock, AlertCircle,
    Sparkles, Magnet, Layers, Activity, ShieldAlert, ChevronRight, Settings,
    MousePointer2, Laptop, BarChart3, Bell, X, CheckCircle2, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { RiskSettings } from './RiskSettings';

interface Signal {
    id: string;
    asset: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    setup: string;
    timeframe: string;
    confidence: number;
    timestamp: string;
    details?: string;
    indicators?: string[];
    sl?: number;
    tp?: number;
    volume_power?: number;
    price_entry?: number;
    isInstitutional?: boolean;
    category?: 'FOREX' | 'INDICES' | 'CRIPTOMOEDAS' | 'METAIS' | 'COMMODITIES';
}

interface Notification {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

import { SoundService } from '../services/SoundService';

export const SignalScanner: React.FC = () => {
    const [signals, setSignals] = useState<Signal[]>([]);
    const [loading, setLoading] = useState(true);
    const [guardianActive, setGuardianActive] = useState(true);
    const [riskMode, setRiskMode] = useState<Record<string, 'AUTO' | 'MANUAL'>>({});
    const [manualInputs, setManualInputs] = useState<Record<string, { sl: string, tp: string }>>({});
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FOREX' | 'INDICES' | 'CRIPTOMOEDAS' | 'METAIS' | 'COMMODITIES'>('ALL');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isDisciplineLocked, setIsDisciplineLocked] = useState(false);
    const [globalSettings, setGlobalSettings] = useState({
        defaultLot: 0.01,
        trailingPoints: 100,
        riskRewardRatio: 2.0,
        autoExecution: false,
        dailyStopLoss: 1000,
        dailyTakeProfit: 2000,
        maxTradesPerDay: 10
    });

    const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [{ id, type, message }, ...prev].slice(0, 3));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const fetchSignals = async () => {
        try {
            const [signalsResp, discResp] = await Promise.all([
                axios.get('/api/mt5/signals'),
                axios.get('/api/mt5/discipline')
            ]);

            const newSignals = signalsResp.data;
            const newDiscipline = discResp.data;

            // Alerta sonoro para novos sinais
            if (newSignals.length > signals.length && signals.length > 0) {
                SoundService.playNotification();
            }

            setSignals(newSignals);
            setIsDisciplineLocked(newDiscipline.isLocked);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch scanner data:', error);
        }
    };

    useEffect(() => {
        fetchSignals();
        const interval = setInterval(fetchSignals, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleZap = async (signal: Signal) => {
        if (isDisciplineLocked) {
            SoundService.playAlert();
            addNotification('error', 'BLOQUEIO DE DISCIPLINA: Operações suspensas hoje.');
            return;
        }

        const isManual = riskMode[signal.id] === 'MANUAL';
        const finalSl = isManual ? parseFloat(manualInputs[signal.id]?.sl || '0') : signal.sl;
        const finalTp = isManual ? parseFloat(manualInputs[signal.id]?.tp || '0') : signal.tp;

        try {
            const response = await axios.post('/api/mt5/order', {
                symbol: signal.symbol,
                action: signal.type,
                lot: globalSettings.defaultLot,
                sl: finalSl,
                tp: finalTp,
                magic: 0,
                comment: `SIG:${signal.setup}`.substring(0, 31)
            });
            addNotification('success', `Ordem Executada: #${response.data.order_id || response.data.ticket} | ${signal.symbol}`);
        } catch (error: any) {
            const errData = error.response?.data;
            if (errData?.error?.includes('10018') || errData?.code === 10018) {
                addNotification('info', `Aguardando Mercado: ${signal.symbol} está fechado. Tentando novamente em breve...`);
            } else {
                addNotification('error', `Erro Bridge: ${errData?.error || 'Falha na conexão'}`);
            }
        }
    };

    const getSetupIcon = (setup: string) => {
        if (setup.includes('Alpha')) return <Sparkles size={14} className="text-trader-amber" />;
        if (setup.includes('Golden')) return <Magnet size={14} className="text-trader-blue" />;
        if (setup.includes('Squeeze')) return <Layers size={14} className="text-purple-400" />;
        if (setup.includes('Smart')) return <Activity size={14} className="text-trader-green" />;
        if (setup.includes('Scalper')) return <Link2 size={14} className="text-cyan-400" />;
        if (setup.includes('VSA')) return <BarChart3 size={14} className="text-trader-blue animate-pulse" />;
        return <Target size={14} className="text-slate-500" />;
    };

    const toggleRiskMode = (signalId: string) => {
        setRiskMode(prev => ({
            ...prev,
            [signalId]: prev[signalId] === 'MANUAL' ? 'AUTO' : 'MANUAL'
        }));
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative min-h-[600px]">
            {/* Notification Center */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-[80%] px-4 pointer-events-none">
                <AnimatePresence>
                    {notifications.map(n => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`p-3 rounded-2xl border shadow-xl flex items-center gap-3 pointer-events-auto backdrop-blur-md ${n.type === 'success' ? 'bg-trader-green/20 border-trader-green/40 text-trader-green' :
                                n.type === 'error' ? 'bg-trader-red/20 border-trader-red/40 text-trader-red' :
                                    'bg-trader-blue/20 border-trader-blue/40 text-trader-blue'
                                }`}
                        >
                            {n.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span className="text-[10px] font-black uppercase tracking-widest">{n.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,24,38,0)_50%,#1e293b_50%)] bg-[length:100%_4px]"></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-trader-blue/10 text-trader-blue rounded-xl border border-trader-blue/20">
                        <Radar size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Radar Station</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-trader-green animate-ping"></div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Scanner VSA Ativo</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all border border-slate-700 hover:border-trader-blue/50"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        onClick={() => setGuardianActive(!guardianActive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${guardianActive ? 'bg-trader-blue/20 border-trader-blue text-trader-blue' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                        <ShieldCheck size={12} className={guardianActive ? 'animate-pulse' : ''} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{guardianActive ? 'Guardian ON' : 'OFF'}</span>
                    </button>
                </div>
            </div>

            {/* Asset Categories Filter Bar */}
            <div className="flex items-center gap-2 mb-6 relative z-10 overflow-x-auto pb-2 custom-scrollbar">
                {(['ALL', 'FOREX', 'INDICES', 'CRIPTOMOEDAS', 'METAIS', 'COMMODITIES'] as const).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategory === cat
                            ? 'bg-trader-blue/20 border-trader-blue text-trader-blue shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                    >
                        {cat === 'ALL' ? 'Todos Ativos' : cat}
                    </button>
                ))}
            </div>

            <div className="space-y-4 relative z-10 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence>
                    {isDisciplineLocked && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
                            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/40 rounded-3xl border border-trader-red/20"
                        >
                            <div className="p-4 bg-trader-red/20 rounded-full border border-trader-red/40 mb-4 animate-pulse">
                                <ShieldAlert size={48} className="text-trader-red" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Safety Lock Active</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Alpha Discipline Violada</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode='popLayout'>
                    {signals
                        .filter(s => selectedCategory === 'ALL' || s.category === selectedCategory)
                        .sort((a, b) => {
                            // 1. Prioridade para Institucional
                            if (a.isInstitutional && !b.isInstitutional) return -1;
                            if (!a.isInstitutional && b.isInstitutional) return 1;
                            // 2. Desempate por Confiança
                            return (b.confidence || 0) - (a.confidence || 0);
                        }).map((signal) => {
                            const isAlpha = signal.setup === 'Alpha Confluence';
                            const isWhale = signal.setup === 'Golden Whale Hunter';
                            const isSqueeze = signal.setup === 'Squeeze Breakout';
                            const isQuantum = signal.setup === 'Quantum BTC Pro';
                            const isNakamoto = signal.setup === 'Alpha Nakamoto';
                            const isSniper = signal.setup === 'Altcoin Sniper';
                            const isElite = (signal.confidence || 0) >= 90 || isWhale || isQuantum;
                            const isInstitutional = signal.isInstitutional || isWhale || isQuantum;
                            const symbolStr = signal.symbol || '';
                            const isSharkStatus = isInstitutional && (symbolStr.includes('XAU') || symbolStr.includes('BTC')) && !isWhale && !isQuantum;
                            const isWhaleStatus = isWhale;
                            const isDiamondStatus = isInstitutional && !isSharkStatus && !isWhaleStatus && !isQuantum;
                            const isScalperGrid = signal.setup === 'Alpha Scalper Grid';
                            const mode = riskMode[signal.id] || 'AUTO';

                            return (
                                <motion.div
                                    key={signal.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileHover={{ x: 5 }}
                                    className={`flex flex-col gap-4 p-5 bg-slate-950/60 rounded-3xl border transition-all group relative overflow-hidden ${isWhaleStatus ? 'border-trader-amber shadow-2xl shadow-trader-amber/20 bg-gradient-to-br from-trader-amber/10 to-transparent' :
                                        isQuantum ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10 bg-emerald-500/5' :
                                            isNakamoto ? 'border-orange-500/50 shadow-lg shadow-orange-500/10 bg-orange-500/5' :
                                                isSqueeze ? 'border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/10 bg-fuchsia-500/5' :
                                                    isInstitutional ? 'border-trader-blue-500/50 shadow-lg shadow-trader-blue/10 bg-trader-blue/5' :
                                                        isScalperGrid ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/5 bg-cyan-500/5' :
                                                            isAlpha ? 'border-trader-amber/50 shadow-lg shadow-trader-amber/5' :
                                                                isElite ? 'border-trader-blue/50 shadow-lg shadow-trader-blue/5' :
                                                                    signal.setup.includes('VSA') ? 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50' :
                                                                        'border-slate-800/50 hover:border-slate-700'
                                        }`}
                                >
                                    {isWhaleStatus && (
                                        <div className="absolute -right-4 -top-4 opacity-20 pointer-events-none group-hover:scale-110 transition-transform">
                                            <TrendingUp size={120} className="text-trader-amber rotate-12" />
                                        </div>
                                    )}
                                    {isSharkStatus && (
                                        <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <TrendingUp size={80} className="text-red-500 rotate-12" />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4">
                                        <div className={`w-1 h-10 rounded-full ${signal.type === 'BUY' ? 'bg-trader-green' : 'bg-trader-red'}`}></div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="text-sm font-black text-white italic tracking-tight truncate">{signal.asset}</span>
                                                    {isInstitutional && (
                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${isWhaleStatus ? 'bg-trader-amber/20 border-trader-amber/40 shadow-[0_0_10px_rgba(255,191,0,0.2)]' : isQuantum ? 'bg-emerald-500/20 border-emerald-500/30' : isSharkStatus ? 'bg-red-500/20 border-red-500/30' : 'bg-cyan-500/20 border-cyan-500/30'}`}>
                                                            <span className={`text-[7px] font-black ${isWhaleStatus ? 'text-trader-amber' : isQuantum ? 'text-emerald-400' : isSharkStatus ? 'text-red-400' : 'text-cyan-400'} uppercase tracking-widest flex items-center gap-1`}>
                                                                {isWhaleStatus ? '🐳 GOLDEN WHALE' : isQuantum ? '🤖 QUANTUM PRO' : isSharkStatus ? '🦈 SHARK' : '💎 ELITE SMC'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isSqueeze && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/30">
                                                            <span className="text-[7px] font-black text-fuchsia-400 uppercase tracking-widest">💥 SQUEEZE</span>
                                                        </div>
                                                    )}
                                                    {isNakamoto && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/30">
                                                            <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest">₿ NAKAMOTO</span>
                                                        </div>
                                                    )}
                                                    {isSniper && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-lime-500/20 border border-lime-500/30">
                                                            <span className="text-[7px] font-black text-lime-400 uppercase tracking-widest">🎯 SNIPER</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">{signal.timeframe}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end shrink-0">
                                                    <span className={`text-xl font-black italic leading-none ${isElite ? 'text-trader-amber drop-shadow-[0_0_8px_rgba(255,191,0,0.3)]' : 'text-white'}`}>
                                                        {signal.confidence}%
                                                    </span>
                                                    <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest text-right mt-1">
                                                        Confiança
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {isWhaleStatus ? (
                                                            <Sparkles size={14} className="text-trader-amber animate-bounce" />
                                                        ) : isQuantum ? (
                                                            <Laptop size={14} className="text-emerald-400 animate-pulse" />
                                                        ) : isSharkStatus ? (
                                                            <Zap size={14} className="text-red-500 animate-pulse" />
                                                        ) : isDiamondStatus ? (
                                                            <Sparkles size={14} className="text-cyan-400 animate-pulse" />
                                                        ) : getSetupIcon(signal.setup)}
                                                        <span className={`text-[10px] font-black uppercase tracking-widest truncate ${isWhaleStatus ? 'text-trader-amber' : isQuantum ? 'text-emerald-400' : isSharkStatus ? 'text-red-400' : isDiamondStatus ? 'text-cyan-400' : isAlpha ? 'text-trader-amber' : 'text-slate-400'}`}>
                                                            {isWhaleStatus ? 'INSTITUTIONAL WHALE HUNTER' : isQuantum ? 'QUANTUM ALGORITHMIC' : isInstitutional ? 'VSA INSTITUTIONAL' : signal.setup}
                                                        </span>
                                                    </div>

                                                    {/* VSA Visual Bar */}
                                                    {signal.volume_power && (
                                                        <div className="flex flex-col gap-1 w-36">
                                                            <div className="flex justify-between items-end mb-1">
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Volume Power</span>
                                                                <span className="text-[10px] font-black text-trader-blue leading-none">{signal.volume_power}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden border border-slate-800">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${signal.volume_power}%` }}
                                                                    className="h-full bg-gradient-to-r from-trader-blue/40 to-trader-blue shadow-[0_0_8px_rgba(0,163,255,0.3)]"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isScalperGrid && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 w-fit">
                                                            <span className="text-[7px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                                                                ⛓️ SCALPER GRID
                                                            </span>
                                                        </div>
                                                    )}
                                                    {signal.details && (
                                                        <p className="text-[8px] font-medium text-slate-500 mt-1 max-w-[200px] leading-relaxed italic">
                                                            {signal.details}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleZap(signal)}
                                                className={`p-4 rounded-2xl shadow-xl active:scale-95 transition-all group/btn ${isDisciplineLocked ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : isAlpha ? 'bg-trader-amber text-black shadow-trader-amber/20' : isElite ? 'bg-trader-blue text-white shadow-trader-blue/20' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                                            >
                                                {isDisciplineLocked ? <ShieldAlert size={18} /> : <Zap size={18} className="group-hover/btn:rotate-12 transition-transform" />}
                                            </button>
                                            <button
                                                onClick={() => toggleRiskMode(signal.id)}
                                                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[7px] font-black uppercase border transition-all ${mode === 'AUTO' ? 'bg-trader-blue/10 border-trader-blue/30 text-trader-blue hover:bg-trader-blue/20' : 'bg-purple-900/20 border-purple-500/30 text-purple-400 hover:bg-purple-900/30'}`}
                                            >
                                                {mode === 'AUTO' ? <Laptop size={8} /> : <MousePointer2 size={8} />}
                                                {mode}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Risk Management Inputs (Auto/Manual) */}
                                    {guardianActive && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/50"
                                        >
                                            <div className={`flex flex-col gap-1 p-2 border rounded-xl transition-all ${mode === 'AUTO' ? 'bg-trader-red/5 border-trader-red/10' : 'bg-slate-900 border-slate-700'}`}>
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                        <ShieldAlert size={8} className="text-trader-red" /> Stop Loss
                                                    </label>
                                                    {mode === 'AUTO' && <span className="text-[9px] font-black text-trader-red">{signal.sl}</span>}
                                                </div>
                                                {mode === 'MANUAL' && (
                                                    <input
                                                        type="text"
                                                        placeholder="Preço SL"
                                                        value={manualInputs[signal.id]?.sl || ''}
                                                        onChange={(e) => setManualInputs(prev => ({ ...prev, [signal.id]: { ...prev[signal.id], sl: e.target.value } }))}
                                                        className="bg-transparent text-[10px] font-black text-white outline-none px-1 p-0.5 border-b border-slate-700 focus:border-trader-red transition-all"
                                                    />
                                                )}
                                            </div>

                                            <div className={`flex flex-col gap-1 p-2 border rounded-xl transition-all ${mode === 'AUTO' ? 'bg-trader-green/5 border-trader-green/10' : 'bg-slate-900 border-slate-700'}`}>
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Target size={8} className="text-trader-green" /> Take Profit
                                                    </label>
                                                    {mode === 'AUTO' && <span className="text-[9px] font-black text-trader-green">{signal.tp}</span>}
                                                </div>
                                                {mode === 'MANUAL' && (
                                                    <input
                                                        type="text"
                                                        placeholder="Preço TP"
                                                        value={manualInputs[signal.id]?.tp || ''}
                                                        onChange={(e) => setManualInputs(prev => ({ ...prev, [signal.id]: { ...prev[signal.id], tp: e.target.value } }))}
                                                        className="bg-transparent text-[10px] font-black text-white outline-none px-1 p-0.5 border-b border-slate-700 focus:border-trader-green transition-all"
                                                    />
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                </AnimatePresence>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                        <div className="w-8 h-8 border-4 border-trader-blue/20 border-t-trader-blue rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Escaneando Liquidez VSA...</p>
                    </div>
                )}
            </div>

            <div className="mt-8 p-4 bg-slate-950/80 border border-slate-800 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-[8px] font-black uppercase text-slate-500">
                    <Clock size={12} /> Próxima Varredura: 2m
                </div>
                <div className="flex items-center gap-2 text-[8px] font-black uppercase text-trader-blue">
                    <Activity size={12} className="animate-pulse" /> Global Risk: {globalSettings.defaultLot} Lot / {globalSettings.trailingPoints}pts
                </div>
            </div>

            {/* Settings Modal Integration */}
            <RiskSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={globalSettings}
                onSave={async (newSettings) => {
                    setGlobalSettings(newSettings);
                    try {
                        // Sincroniza Disciplina
                        await axios.post('/api/mt5/discipline/settings', {
                            dailyStopLoss: newSettings.dailyStopLoss,
                            dailyTakeProfit: newSettings.dailyTakeProfit,
                            maxTradesPerDay: newSettings.maxTradesPerDay
                        });
                        // Sincroniza Guardian (Trailing Stop)
                        await axios.post('/api/mt5/guardian/settings', {
                            trailingPoints: newSettings.trailingPoints
                        });
                    } catch (e) {
                        console.error('Failed to sync system settings');
                    }
                    setIsSettingsOpen(false);
                    addNotification('info', 'Configurações de Risco Salvas!');
                }}
            />
        </div>
    );
};
