import React, { useState, useEffect, useRef } from 'react';
import { Activity, Zap, TrendingUp, Target, Cpu, Shield, DollarSign, BarChart3, Crosshair, CircleDot, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface SharkBotStatus {
    settings: { enabled: boolean; symbol: string; timeframe: string; lotSize: number; maxDailyLoss: number; maxDailyProfit: number; riskPercent: number; fvgMinAtrRatio: number };
    state: { position: any | null; dailyProfit: number; dailyLoss: number };
    isRunning: boolean;
    marginOk: boolean;
    lastAnalysis: {
        price: number; atr: number; swingHigh: number; swingLow: number;
        nivel50: number; sma50: number; fvgCount: number; bos: boolean;
        setupCount: number; setups: { entradaLimit: number; stopLoss: number; gapSize: number }[];
    } | null;
    trades: any[];
    operationLog: Array<{ time: string; action: string; details: string }>;
    performance: { totalTrades: number; wins: number; losses: number; winRate: number; totalProfit: number; avgWin: number; avgLoss: number; profitFactor: number };
}

function SharkLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="sglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.4" />
                </filter>
            </defs>
            <path d="M6 28 L12 18 L18 24 L26 14 L32 22 L40 10 L38 26 L32 30 L24 34 L16 30 L10 34 Z"
                fill="url(#sg)" filter="url(#sglow)" />
            <circle cx="28" cy="20" r="2" fill="white" opacity="0.9" />
            <path d="M10 32 L6 38 L14 34 Z" fill="#06b6d4" opacity="0.6" />
            <path d="M18 30 L14 38 L20 34 Z" fill="#06b6d4" opacity="0.4" />
            <path d="M32 26 L34 34 L28 30 Z" fill="#06b6d4" opacity="0.5" />
        </svg>
    );
}

function FvgDepthChart({ nivel50, swingLow, swingHigh, price, fvgs }: { nivel50: number; swingLow: number; swingHigh: number; price: number; fvgs: { entradaLimit: number }[] }) {
    const range = swingHigh - swingLow || 1;
    const h = 96, w = 260;
    const pad = 16;
    const toY = (v: number) => pad + (1 - (v - swingLow) / range) * (h - pad * 2);
    const midY = toY(nivel50);
    const priceY = toY(price);
    return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
            </defs>
            <rect x={0} y={midY} width={w} height={h - midY} fill="url(#dg)" />
            <line x1={0} y1={midY} x2={w} y2={midY} stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            <text x={w - 4} y={midY - 4} textAnchor="end" fill="#22d3ee" fontSize="8" fontWeight="700">50% Discount Zone</text>
            {fvgs.slice(0, 3).map((fvg, i) => {
                const fy = toY(fvg.entradaLimit);
                return (
                    <g key={i}>
                        <rect x={50 + i * 65} y={fy - 1} width={36} height={4} rx={2} fill="#22d3ee" opacity={0.9} />
                        <rect x={50 + i * 65} y={fy - 4} width={36} height={10} rx={2} fill="none" stroke="#22d3ee" strokeWidth="1" opacity={0.25} className="animate-pulse" />
                    </g>
                );
            })}
            <line x1={0} y1={toY(swingHigh)} x2={w} y2={toY(swingHigh)} stroke="#f87171" strokeWidth="1" opacity="0.4" />
            <text x={4} y={toY(swingHigh) - 4} fill="#f87171" fontSize="7" fontWeight="700">HH</text>
            <line x1={0} y1={toY(swingLow)} x2={w} y2={toY(swingLow)} stroke="#34d399" strokeWidth="1" opacity="0.4" />
            <text x={4} y={toY(swingLow) - 4} fill="#34d399" fontSize="7" fontWeight="700">LL</text>
            <circle cx={w / 2} cy={priceY} r={4.5} fill={price <= nivel50 ? '#22d3ee' : '#f87171'} stroke="white" strokeWidth="1.5" className="drop-shadow-lg" />
            <text x={w / 2 + 9} y={priceY + 3} fill="white" fontSize="9" fontWeight="700">${price.toFixed(1)}</text>
        </svg>
    );
}

const SYMBOLS = ['XAUUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'XAGUSD', 'WTI', 'SP500'];
const TIMEFRAMES = ['M15', 'M30', 'H1', 'H4'];

export const SharkBotPanel: React.FC = () => {
    const [status, setStatus] = useState<SharkBotStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [lotSize, setLotSize] = useState(0.01);
    const [riskPercent, setRiskPercent] = useState(1.0);
    const [symbol, setSymbol] = useState('XAUUSD');
    const [timeframe, setTimeframe] = useState('H1');
    const [fvgMinAtr, setFvgMinAtr] = useState(0.5);
    const terminalRef = useRef<HTMLDivElement>(null);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/shark-bot/status');
            setStatus(res.data);
            setLotSize(res.data.settings.lotSize);
            setRiskPercent(res.data.settings.riskPercent);
            setSymbol(res.data.settings.symbol);
            setTimeframe(res.data.settings.timeframe);
            setFvgMinAtr(res.data.settings.fvgMinAtrRatio);
        } catch { }
    };

    useEffect(() => {
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [status?.operationLog?.length]);

    const toggle = async () => {
        setLoading(true);
        try {
            await axios.post('/api/mt5/shark-bot/settings', { enabled: !status?.settings?.enabled });
            await fetchStatus();
        } catch { }
        setLoading(false);
    };

    const saveSettings = (overrides?: Record<string, any>) => {
        axios.post('/api/mt5/shark-bot/settings', {
            ...status?.settings, lotSize, riskPercent, symbol, timeframe, fvgMinAtrRatio: fvgMinAtr,
            ...overrides,
        }).catch(() => { });
    };

    const a = status?.lastAnalysis;
    const perf = status?.performance;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-cyan-500/10 rounded-3xl border border-cyan-500/20 shadow-xl shadow-cyan-500/10">
                        <SharkLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Shark</span> Bot
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${status?.settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {status?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-cyan-500" /> SMC Institucional — FVG + Discount Zone
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{symbol} {timeframe}</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${status?.isRunning ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${status?.isRunning ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            <span className="text-[10px] font-black uppercase">{status?.isRunning ? 'Live' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SMC ENGINE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Cpu className="text-cyan-500 animate-pulse" /> SMC <span className="text-cyan-500">Institutional</span> Engine
                            <span className={`px-2 py-0.5 rounded text-[10px] tracking-widest uppercase animate-pulse ${a?.setupCount ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-500 border border-cyan-500/30'}`}>
                                {a?.setupCount ? `${a.setupCount} Setup${a.setupCount > 1 ? 's' : ''}` : 'Scanning'}
                            </span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Fair Value Gap Detection & Break of Structure Analysis em Tempo Real</p>
                    </div>
                    <button
                        onClick={toggle}
                        disabled={loading}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            status?.settings?.enabled
                                ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/20'
                        }`}
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : status?.settings?.enabled ? (
                            <><Zap size={12} /> Desligar Shark</>
                        ) : (
                            <><Zap size={12} /> Ligar Shark</>
                        )}
                    </button>
                </div>

                {/* STATS GRID */}
                {a ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-cyan-500/20 text-cyan-500 rounded-xl">
                                <Activity size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Preço Atual</p>
                                <p className="text-xl font-black text-white italic">${a.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
                                <Target size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ATR 14</p>
                                <p className="text-xl font-black text-white italic">${a.atr.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">SMA 50</p>
                                <p className="text-xl font-black text-white italic">${a.sma50.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                                <Crosshair size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Nível 50%</p>
                                <p className={`text-xl font-black italic ${a.price <= a.nivel50 ? 'text-emerald-400' : 'text-amber-400'}`}>${a.nivel50.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 animate-pulse">
                                <div className="h-4 bg-slate-800/60 rounded w-16 mb-2" />
                                <div className="h-6 bg-slate-800/60 rounded w-24" />
                            </div>
                        ))}
                    </div>
                )}

                {/* SYMBOL CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[symbol].map((sym) => {
                        if (!a) return (
                            <div key={sym} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 animate-pulse">
                                <div className="h-5 bg-slate-800/60 rounded w-20 mb-4" />
                                <div className="space-y-3">
                                    <div className="h-3 bg-slate-800/60 rounded w-full" />
                                    <div className="h-8 bg-slate-800/60 rounded w-16" />
                                    <div className="h-2 bg-slate-800/60 rounded w-full" />
                                </div>
                            </div>
                        );
                        const rsiColor = a.price > a.sma50 ? 'text-emerald-400' : 'text-red-400';
                        const trendColor = a.bos ? 'text-emerald-400' : 'text-cyan-400';
                        return (
                            <motion.div key={sym} whileHover={{ y: -5 }} className={`bg-slate-950/40 p-5 rounded-3xl border border-white/5 hover:border-cyan-500/20 transition-all`}>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-lg font-black text-white italic">{sym}</span>
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${trendColor} bg-current/10 border border-current/20`}>
                                        {a.bos ? 'BOS ✓' : 'Estrutura'}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Distância SMA50</p>
                                            <p className={`text-xl font-black italic ${rsiColor}`}>
                                                {((a.price / a.sma50 - 1) * 100).toFixed(2)}%
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">FVGs</p>
                                            <p className="text-sm font-bold text-white">{a.fvgCount}</p>
                                        </div>
                                    </div>

                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, Math.abs((a.price / a.sma50 - 1) * 500))}%` }}
                                            className={`h-full ${a.price >= a.sma50 ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Swing High</p>
                                            <p className="text-xs font-black text-white">${a.swingHigh.toFixed(2)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Swing Low</p>
                                            <p className="text-xs font-black text-white">${a.swingLow.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* SMC STRUCTURE CHART */}
                    {a && (
                        <motion.div whileHover={{ y: -5 }} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 hover:border-cyan-500/20 transition-all md:col-span-2 lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estrutura de Mercado</span>
                                <div className="flex gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${a.bos ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>BOS</span>
                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${a.fvgCount > 0 ? 'bg-cyan-500/20 text-cyan-500' : 'bg-slate-500/10 text-slate-500'}`}>FVG</span>
                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${a.setupCount > 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>SETUP</span>
                                </div>
                            </div>
                            <FvgDepthChart nivel50={a.nivel50} swingLow={a.swingLow} swingHigh={a.swingHigh} price={a.price} fvgs={a.setups} />
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* FVG SIGNALS & TRADES */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                            <Zap className="text-cyan-400" /> FVG Signals <span className="text-cyan-500">Detected</span>
                        </h3>
                        {a && (
                            <span className="text-[10px] font-bold text-cyan-400/60 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/15">
                                {a.fvgCount} FVG{a.fvgCount !== 1 ? "s" : ""} — {a.setupCount} Setup{a.setupCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>

                    {a?.setups && a.setups.length > 0 ? (
                        <div className="grid gap-4">
                            {a.setups.slice(-6).reverse().map((s, i) => {
                                const dist = ((a.price - s.entradaLimit) / s.entradaLimit * 100);
                                return (
                                    <motion.div key={i} whileHover={{ x: 5 }} className="bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                                                <Target size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-xl font-black text-white italic tracking-tight">FVG #{a.setups.length - i}</span>
                                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-500">
                                                        LIMIT BUY
                                                    </span>
                                                    {dist <= 0 && (
                                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 animate-pulse">
                                                            Na Zona!
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    Gap: ${s.gapSize.toFixed(2)} • Distância: {dist > 0 ? '+' : ''}{dist.toFixed(2)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Entrada</p>
                                                <p className="text-lg font-black text-white">${s.entradaLimit.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Stop Loss</p>
                                                <p className="text-lg font-black text-red-400">${s.stopLoss.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : a ? (
                        <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <Target size={32} className="text-slate-700 mb-3" />
                            <p className="text-sm font-bold text-slate-500">Nenhum FVG válido encontrado</p>
                            <p className="text-[10px] text-slate-600 mt-1">Aguardando nova formação de desequilíbrio de mercado</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <div className="flex gap-1.5 mb-4">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="w-2 h-2 rounded-full bg-cyan-500/40 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                                ))}
                            </div>
                            <p className="text-sm font-bold text-slate-500">Escaneando ativos...</p>
                            <p className="text-[10px] text-slate-600 mt-1">Análise SMC em andamento</p>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="space-y-6">
                    {/* CONFIG */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Shield className="text-cyan-500" size={18} /> Configurações
                        </h3>

                        <div className="space-y-5">
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Símbolo</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {SYMBOLS.map(s => (
                                        <button key={s} onClick={() => { setSymbol(s); setTimeout(() => saveSettings({ symbol: s }), 100); }}
                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${symbol === s ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800/50 text-slate-500 border border-white/5 hover:bg-slate-700/50'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Timeframe</p>
                                <div className="flex gap-1.5">
                                    {TIMEFRAMES.map(t => (
                                        <button key={t} onClick={() => { setTimeframe(t); setTimeout(() => saveSettings({ timeframe: t }), 100); }}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${timeframe === t ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800/50 text-slate-500 border border-white/5 hover:bg-slate-700/50'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lote</span>
                                    <span className="text-sm font-black text-cyan-400">{lotSize.toFixed(2)}</span>
                                </div>
                                <input type="range" min={0.01} max={1} step={0.01} value={lotSize}
                                    onChange={e => { setLotSize(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risco por Trade</span>
                                    <span className="text-sm font-black text-amber-400">{riskPercent.toFixed(1)}%</span>
                                </div>
                                <input type="range" min={0.1} max={5} step={0.1} value={riskPercent}
                                    onChange={e => { setRiskPercent(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-amber-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">FVG Min ATR</span>
                                    <span className="text-sm font-black text-cyan-400">{fvgMinAtr.toFixed(1)}x</span>
                                </div>
                                <input type="range" min={0.1} max={2} step={0.1} value={fvgMinAtr}
                                    onChange={e => { setFvgMinAtr(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                        </div>
                    </div>

                    {/* PERFORMANCE */}
                    {perf && perf.totalTrades > 0 && (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/10 p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <BarChart3 className="text-cyan-500" size={18} /> Performance
                            </h3>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Win Rate</p>
                                    <p className={`text-2xl font-black italic ${perf.winRate >= 60 ? 'text-emerald-400' : perf.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{perf.winRate.toFixed(0)}%</p>
                                </div>
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total</p>
                                    <p className="text-2xl font-black text-white italic">{perf.totalTrades}</p>
                                </div>
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Profit Factor</p>
                                    <p className={`text-2xl font-black italic ${perf.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{perf.profitFactor === Infinity ? '∞' : perf.profitFactor.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">P&L</p>
                                    <p className={`text-2xl font-black italic ${perf.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${perf.totalProfit.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {status.trades.slice(0, 5).map((t, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.result === 'WIN' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            <span className={`text-xs font-black ${t.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'}`}>{t.result}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">${t.entryPrice?.toFixed(2) || '0.00'}</span>
                                        <span className={`text-xs font-black ${t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${t.profit?.toFixed(2) || '0.00'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ACTIVE POSITION */}
                    {status?.state?.position ? (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/20 p-8 relative overflow-hidden shadow-[0_0_30px_rgba(52,211,153,0.08)]">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <DollarSign className="text-emerald-400" size={18} /> Posição Ativa
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Tipo', value: 'BUY', color: 'text-emerald-400' },
                                    { label: 'Entrada', value: `$${status.state.position.price.toFixed(2)}`, color: 'text-white' },
                                    { label: 'Stop Loss', value: `$${status.state.position.sl.toFixed(2)}`, color: 'text-red-400' },
                                    { label: 'Take Profit', value: `$${status.state.position.tp.toFixed(2)}`, color: 'text-emerald-400' },
                                ].map((r, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.label}</span>
                                        <span className={`text-sm font-black ${r.color}`}>{r.value}</span>
                                    </div>
                                ))}
                                <div className="mt-4">
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                        <span>SL ${status.state.position.sl.toFixed(0)}</span>
                                        <span>TP ${status.state.position.tp.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 transition-all duration-1000" style={{ width: '45%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                            <div className="flex flex-col items-center py-4 text-center">
                                <Target size={32} className="text-slate-700 mb-3" />
                                <p className="text-sm font-bold text-slate-500">Nenhuma posição ativa</p>
                                <p className="text-[10px] text-slate-600 mt-1">Aguardando setup ideal</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TERMINAL MONITORAMENTO */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                            <Terminal size={16} className="text-cyan-400" />
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Terminal de Monitoramento</span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status?.isRunning ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${status?.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-[7px] font-black uppercase tracking-widest">{status?.isRunning ? 'LIVE' : 'OFF'}</span>
                        </div>
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        {status?.operationLog?.length || 0} eventos
                    </span>
                </div>
                <div ref={terminalRef} className="h-48 overflow-y-auto p-6 no-scrollbar font-mono text-[11px] space-y-1.5 bg-slate-950/20">
                    {status?.operationLog && status.operationLog.length > 0 ? (
                        status.operationLog.slice(-50).map((log, i) => (
                            <div key={i} className="flex gap-3 items-start">
                                <span className="text-slate-600 shrink-0 text-[10px]">{log.time}</span>
                                <span className="text-cyan-500/70 shrink-0 text-[10px] font-black uppercase tracking-wider">[{log.action}]</span>
                                <span className="text-slate-300">{log.details}</span>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Terminal size={24} className="text-slate-700 mb-2" />
                            <p className="text-[11px] font-bold text-slate-600">Aguardando logs do Shark Bot...</p>
                            <p className="text-[9px] text-slate-700 mt-1">Os eventos aparecerão aqui em tempo real</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
