import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Clock, Timer, TrendingUp, Activity, Zap, Target, Crown, Brain,
    Cpu, Bitcoin, RefreshCw, ChevronDown, ChevronUp, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface TradeRecord {
    start: string;
    end: string;
    durationMs: number;
    symbol: string;
    type: string;
    profit: number;
}

interface EngineDuration {
    engine: string;
    magic: number;
    trades: TradeRecord[];
    totalDurationMs: number;
    tradeCount: number;
    avgDurationMs: number;
    totalProfit: number;
}

interface DurationData {
    engines: EngineDuration[];
    grandTotalMs: number;
    grandTotalTrades: number;
    grandTotalProfit: number;
    date: string;
}

const ENGINE_CONFIG: Record<string, { icon: any; color: string; gradient: string; bg: string }> = {
    'Gold Scalper': { icon: Target, color: '#F59E0B', gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10 border-amber-500/20' },
    'Micro Sniper': { icon: Zap, color: '#6366F1', gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    'Speed Scalper': { icon: Zap, color: '#06B6D4', gradient: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    'Sweep H4 M15': { icon: TrendingUp, color: '#10B981', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    'Shark Bot': { icon: Zap, color: '#06B6D4', gradient: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    'Wolf Bot': { icon: Target, color: '#F59E0B', gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10 border-amber-500/20' },
    'Crypto IA': { icon: Bitcoin, color: '#F97316', gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-500/10 border-orange-500/20' },
    'Alpha Robot': { icon: Cpu, color: '#EC4899', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500/10 border-pink-500/20' },
    'Supreme': { icon: Crown, color: '#10B981', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    'Omni': { icon: Activity, color: '#A855F7', gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-500/10 border-purple-500/20' },
    'Bitcoin Pro': { icon: Bitcoin, color: '#F59E0B', gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10 border-amber-500/20' },
    'Agent IA': { icon: Brain, color: '#EC4899', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500/10 border-pink-500/20' },
    'Recovery': { icon: Activity, color: '#64748B', gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-500/10 border-slate-500/20' },
    'Aura Quant': { icon: Brain, color: '#8B5CF6', gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-500/10 border-violet-500/20' },
};

function formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0s';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
}

function Tip({ children, text }: { children: React.ReactNode; text: string }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ref = useRef<HTMLDivElement>(null);

    const onEnter = useCallback(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top - 8 });
        setShow(true);
    }, []);

    const onLeave = useCallback(() => setShow(false), []);

    return (
        <>
            <div
                ref={ref}
                className="inline-block cursor-help"
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
            >
                {children}
            </div>
            {show && createPortal(
                <div
                    className="px-3 py-2 bg-slate-800 border border-white/15 rounded-xl text-[10px] font-bold text-slate-200 max-w-[280px] text-center leading-tight shadow-2xl shadow-black/60 pointer-events-none"
                    style={{
                        position: 'fixed',
                        left: pos.x,
                        top: pos.y,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 99999,
                    }}
                >
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[5px] border-transparent border-t-slate-800" />
                </div>,
                document.body
            )}
        </>
    );
}

function formatTime(iso: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function ClockRing({ progress, color, size = 80 }: { progress: number; color: string; size?: number }) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - Math.min(progress, 1));

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: 'stroke-dashoffset 1s ease' }}
            />
        </svg>
    );
}

function DurationLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="dlg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <filter id="dlglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#dlg)" strokeWidth="2" filter="url(#dlglow)" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#dlg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
            <line x1="22" y1="22" x2="22" y2="10" stroke="url(#dlg)" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="22" x2="30" y2="26" stroke="url(#dlg)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="22" cy="22" r="2" fill="url(#dlg)" />
        </svg>
    );
}

export const TradingDurationPanel: React.FC = () => {
    const [data, setData] = useState<DurationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedEngine, setExpandedEngine] = useState<number | null>(null);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/mt5/trading-duration', { timeout: 30000 });
            setData(res.data);
        } catch (err: any) {
            console.error('Trading duration fetch error:', err?.message || err);
            if (!data) {
                setData({ engines: [], grandTotalMs: 0, grandTotalTrades: 0, grandTotalProfit: 0, date: new Date().toISOString().slice(0, 10) });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxDuration = useMemo(() => {
        if (!data?.engines?.length) return 1;
        return Math.max(...data.engines.map(e => Math.max(e.totalDurationMs, 0)), 1);
    }, [data]);

    if (loading || !data) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4 min-h-[600px]">
            <div className="relative">
                <div className="p-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-3xl border border-white/10">
                    <Clock className="text-indigo-400 animate-pulse" size={64} />
                </div>
                <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full"></div>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-bounce">Carregando duração de operações...</p>
        </div>
    );

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 rounded-[2.5rem] opacity-20 blur-xl group-hover:opacity-30 transition-all duration-700" />
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-800/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-[120px] pointer-events-none -translate-y-1/3 translate-x-1/4" />
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl border border-white/10 shadow-xl shadow-indigo-500/5 group-hover/icon">
                            <div className="group-hover/icon:scale-110 transition-transform duration-500">
                                <DurationLogo />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-4 flex-wrap">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-purple-300">Trading</span>
                                <span className="text-white">Duration</span>
                            </h2>
                            <p className="text-slate-500 font-black uppercase tracking-[0.35em] text-sm mt-3 flex items-center gap-2.5">
                                <Timer size={14} className="text-indigo-400" />
                                Duração das Operações por Robô
                            </p>
                            <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-xs mt-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                                {new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-indigo-500/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                <Clock size={16} className="text-indigo-400" />
                            </div>
                            <Tip text="Soma de todas as durações de operações abertas e fechadas hoje">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Tempo Total Hoje</span>
                            </Tip>
                        </div>
                        <p className="text-2xl font-black italic text-white drop-shadow-lg">{formatDuration(data.grandTotalMs)}</p>
                    </div>
                </div>
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <Activity size={16} className="text-emerald-400" />
                            </div>
                            <Tip text="Quantidade total de ordens executadas por todos os robôs">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Trades</span>
                            </Tip>
                        </div>
                        <p className="text-2xl font-black italic text-white drop-shadow-lg">{data.grandTotalTrades}</p>
                    </div>
                </div>
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-amber-500/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                <TrendingUp size={16} className="text-amber-400" />
                            </div>
                            <Tip text="Número de engines que operaram ao menos uma vez hoje">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Robôs Ativos Hoje</span>
                            </Tip>
                        </div>
                        <p className="text-2xl font-black italic text-white drop-shadow-lg">{data.engines.length}</p>
                    </div>
                </div>
                <div className={`bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border relative overflow-hidden group ${(data.grandTotalProfit || 0) >= 0 ? 'border-emerald-500/10' : 'border-rose-500/10'}`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${(data.grandTotalProfit || 0) >= 0 ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-xl border ${(data.grandTotalProfit || 0) >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                <DollarSign size={16} className={(data.grandTotalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                            </div>
                            <Tip text="Lucro ou prejuízo total de todas as operações fechadas hoje (inclui comissão e swap)">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">P&L Total Hoje</span>
                            </Tip>
                        </div>
                        <p className={`text-2xl font-black italic drop-shadow-lg ${(data.grandTotalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ${(data.grandTotalProfit || 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* ENGINE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                    {data.engines.map((engine, idx) => {
                        const cfg = ENGINE_CONFIG[engine.engine] || { icon: Cpu, color: '#64748B', gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-500/10 border-slate-500/20' };
                        const Icon = cfg.icon;
                        const progress = Math.max(engine.totalDurationMs, 0) / maxDuration;
                        const isExpanded = expandedEngine === engine.magic;

                        return (
                            <motion.div
                                key={engine.magic}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05, duration: 0.3 }}
                                className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300 group"
                            >
                                {/* Card Header */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl border ${cfg.bg}`}>
                                                <Icon size={18} style={{ color: cfg.color }} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white uppercase tracking-wider">{engine.engine}</h3>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Magic #{engine.magic}</span>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <Tip text={`Proporção do tempo total entre todos os robôs: ${Math.round(progress * 100)}%`}>
                                                <div>
                                                    <ClockRing progress={progress} color={cfg.color} size={70} />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-[11px] font-black text-white" style={{ textShadow: `0 0 8px ${cfg.color}80` }}>
                                                            {Math.round(progress * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </Tip>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5">
                                            <Tip text="Tempo total que este robô esteve com ordens abertas hoje">
                                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">Total</p>
                                            </Tip>
                                            <p className="text-lg font-black italic text-white" style={{ textShadow: `0 0 10px ${cfg.color}60` }}>
                                                {formatDuration(engine.totalDurationMs)}
                                            </p>
                                        </div>
                                        <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5">
                                            <Tip text="Número de ordens executadas por este robô hoje">
                                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">Trades</p>
                                            </Tip>
                                            <p className="text-lg font-black italic text-white">{engine.tradeCount}</p>
                                        </div>
                                        <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5">
                                            <Tip text="Duração média por operação = Tempo Total ÷ Número de Trades">
                                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">Média</p>
                                            </Tip>
                                            <p className="text-lg font-black italic text-white">{formatDuration(engine.avgDurationMs)}</p>
                                        </div>
                                        <div className={`bg-slate-950/40 rounded-xl p-3 border ${(engine.totalProfit || 0) >= 0 ? 'border-emerald-500/10' : 'border-rose-500/10'}`}>
                                            <Tip text="Lucro ou prejuízo deste robô hoje (inclui comissão e swap)">
                                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">P&L</p>
                                            </Tip>
                                            <p className={`text-lg font-black italic ${(engine.totalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                ${(engine.totalProfit || 0).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <Tip text={`Proporção deste robô em relação ao total: ${formatDuration(Math.max(engine.totalDurationMs, 0))} de ${formatDuration(maxDuration)}`}>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3 cursor-help">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress * 100}%` }}
                                                transition={{ delay: idx * 0.05 + 0.3, duration: 0.8, ease: 'easeOut' }}
                                                className="h-full rounded-full"
                                                style={{ background: `linear-gradient(90deg, ${cfg.color}CC, ${cfg.color})`, boxShadow: `0 0 10px ${cfg.color}60` }}
                                            />
                                        </div>
                                    </Tip>

                                    {/* Expand trades */}
                                    {engine.trades.length > 0 && (
                                        <Tip text="Clique para ver detalhes de cada operação: horário, símbolo, tipo e lucro">
                                            <button
                                                onClick={() => setExpandedEngine(isExpanded ? null : engine.magic)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/30 rounded-xl border border-white/5 hover:bg-slate-950/50 transition-all text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]"
                                            >
                                                <span>{engine.trades.length} trade{engine.trades.length !== 1 ? 's' : ''} hoje</span>
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </Tip>
                                    )}
                                </div>

                                {/* Expanded Trade List */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
                                                {engine.trades.map((trade, tIdx) => (
                                                    <div key={tIdx} className="flex items-center justify-between px-3 py-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${trade.end ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                                            <div>
                                                                <Tip text={`Ativo: ${trade.symbol} | Tipo: ${trade.type} | P&L: $${(trade.profit || 0).toFixed(2)}`}>
                                                                    <span className="text-[9px] font-black text-white">{trade.symbol}</span>
                                                                </Tip>
                                                                <span className={`ml-1.5 text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    {trade.type}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <Tip text={trade.end ? `Entrada: ${new Date(trade.start).toLocaleTimeString('pt-BR')} → Saída: ${new Date(trade.end).toLocaleTimeString('pt-BR')}` : `Entrada: ${new Date(trade.start).toLocaleTimeString('pt-BR')} → Operação aberta`}>
                                                                <p className="text-[9px] font-black text-slate-300">
                                                                    {formatTime(trade.start)} {trade.end ? `→ ${formatTime(trade.end)}` : '→ aberto'}
                                                                </p>
                                                            </Tip>
                                                            <Tip text={`Duração: ${formatDuration(trade.durationMs)} | Lucro: $${(trade.profit || 0).toFixed(2)}`}>
                                                                <p className={`text-[8px] font-black ${(trade.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                    ${(trade.profit || 0).toFixed(2)} · {formatDuration(trade.durationMs)}
                                                                </p>
                                                            </Tip>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Empty state */}
            {data.engines.length === 0 && (
                <div className="text-center py-16">
                    <Clock size={48} className="text-slate-700 mx-auto mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-wider">Nenhuma operação registrada hoje</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-2">Os robôs ainda não abriram posições hoje</p>
                </div>
            )}
        </div>
    );
};
