import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Eye, TrendingUp, TrendingDown, Crosshair,
    Shield, Zap, Clock, DollarSign, Target, AlertTriangle,
    ChevronUp, ChevronDown, Minus, Radio
} from 'lucide-react';
import axios from 'axios';

interface Position {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    entryPrice: number;
    currentPrice: number;
    sl: number;
    tp: number;
    profit: number;
    profitPct: number;
    pnlPerLot: number;
    slDistance: number;
    slDistancePct: number;
    tpDistance: number;
    tpDistancePct: number;
    isBE: boolean;
    beTriggered: boolean;
    trailingTriggered: boolean;
    timeInTrade: string;
    timeSeconds: number;
}

interface LiveMonitorData {
    positions: Position[];
    summary: {
        totalPositions: number;
        totalProfit: number;
        totalVolume: number;
        avgProfitPct: number;
    };
    indicators: {
        rsi: number;
        rsiZone: string;
        trendM1: string;
        trendM5: string;
        sniperTrigger: string | null;
        sniperValid: boolean;
    };
    cycleInfo: {
        lastCycleTime: number;
        isProcessing: boolean;
        enabled: boolean;
    };
}

interface PricePoint {
    time: number;
    price: number;
}

function RSIGauge({ value, zone }: { value: number; zone: string }) {
    const angle = (value / 100) * 180 - 90;
    const color = zone === 'OVERSOLD' ? '#10b981' : zone === 'OVERBOUGHT' ? '#ef4444' : '#818cf8';
    return (
        <div className="relative flex flex-col items-center">
            <svg width="120" height="70" viewBox="0 0 120 70">
                <defs>
                    <linearGradient id="rsiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                </defs>
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="url(#rsiGrad)" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
                <line
                    x1="60" y1="60"
                    x2={60 + 40 * Math.cos((angle * Math.PI) / 180)}
                    y2={60 + 40 * Math.sin((angle * Math.PI) / 180)}
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <circle cx="60" cy="60" r="4" fill={color} />
                <text x="10" y="68" fill="#475569" fontSize="7" fontWeight="bold">0</text>
                <text x="55" y="18" fill="#475569" fontSize="7" fontWeight="bold">50</text>
                <text x="108" y="68" fill="#475569" fontSize="7" fontWeight="bold">100</text>
            </svg>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-black italic" style={{ color }}>{value.toFixed(1)}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    zone === 'OVERSOLD' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                    zone === 'OVERBOUGHT' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                    'bg-slate-500/10 border-slate-500/30 text-slate-400'
                }`}>{zone}</span>
            </div>
        </div>
    );
}

function PriceBar({ position }: { position: Position }) {
    const { entryPrice, currentPrice, sl, tp, type } = position;
    if (!entryPrice) return null;

    const isBuy = type === 'BUY';
    const range = Math.max(
        Math.abs(tp - entryPrice) || Math.abs(entryPrice * 0.01),
        Math.abs(entryPrice - sl) || Math.abs(entryPrice * 0.01),
        Math.abs(currentPrice - entryPrice) || Math.abs(entryPrice * 0.005)
    ) * 1.2;

    const min = isBuy ? Math.min(entryPrice, sl || entryPrice - range, currentPrice) - range * 0.1
                        : Math.min(entryPrice, tp || entryPrice - range, currentPrice) - range * 0.1;
    const max = isBuy ? Math.max(entryPrice, tp || entryPrice + range, currentPrice) + range * 0.1
                        : Math.max(entryPrice, sl || entryPrice + range, currentPrice) + range * 0.1;
    const totalRange = max - min || 1;

    const toX = (price: number) => ((price - min) / totalRange) * 100;

    const entryX = toX(entryPrice);
    const currentX = toX(currentPrice);
    const slX = sl > 0 ? toX(sl) : null;
    const tpX = tp > 0 ? toX(tp) : null;

    const isProfit = isBuy ? currentPrice > entryPrice : currentPrice < entryPrice;

    return (
        <div className="relative h-12 w-full my-2">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full" />
            {slX !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-rose-500/50" style={{ left: `${slX}%` }}>
                    <span className="absolute -top-4 -translate-x-1/2 text-[7px] font-black text-rose-500">SL</span>
                </div>
            )}
            {tpX !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-emerald-500/50" style={{ left: `${tpX}%` }}>
                    <span className="absolute -top-4 -translate-x-1/2 text-[7px] font-black text-emerald-500">TP</span>
                </div>
            )}
            <div className="absolute top-0 bottom-0 w-px bg-slate-500/50" style={{ left: `${entryX}%` }}>
                <span className="absolute -bottom-4 -translate-x-1/2 text-[7px] font-bold text-slate-500">ENTRY</span>
            </div>
            <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-10"
                style={{
                    left: `${currentX}%`,
                    backgroundColor: isProfit ? '#10b981' : '#ef4444',
                    borderColor: isProfit ? '#10b981' : '#ef4444',
                    boxShadow: `0 0 10px ${isProfit ? '#10b981' : '#ef4444'}40`,
                }}
                animate={{ left: `${currentX}%` }}
                transition={{ duration: 0.3 }}
            />
            {isBuy && currentX > entryX && (
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-emerald-500/40"
                    style={{ left: `${entryX}%`, width: `${Math.max(0, currentX - entryX)}%` }}
                />
            )}
            {!isBuy && currentX < entryX && (
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-emerald-500/40"
                    style={{ left: `${currentX}%`, width: `${Math.max(0, entryX - currentX)}%` }}
                />
            )}
        </div>
    );
}

function PositionCard({ position, index }: { position: Position; index: number }) {
    const isBuy = position.type === 'BUY';
    const isProfit = position.profit >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.05 }}
            className={`relative bg-slate-950/60 rounded-2xl border p-5 transition-all hover:border-opacity-50 ${
                isProfit ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-rose-500/20 hover:border-rose-500/40'
            }`}
        >
            {/* Top bar */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                        isBuy ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>{position.type}</span>
                    <span className="text-xs font-black text-white">{position.symbol}</span>
                    <span className="text-[9px] font-mono text-slate-500">#{position.ticket}</span>
                </div>
                <div className="flex items-center gap-2">
                    {position.isBE && (
                        <span className="px-2 py-0.5 rounded text-[7px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider">BE</span>
                    )}
                    {position.trailingTriggered && (
                        <span className="px-2 py-0.5 rounded text-[7px] font-black bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase tracking-wider">TRAIL</span>
                    )}
                    <span className="flex items-center gap-1 text-[9px] text-slate-500">
                        <Clock size={10} /> {position.timeInTrade}
                    </span>
                </div>
            </div>

            {/* Price bar */}
            <PriceBar position={position} />

            {/* Prices row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Entry</p>
                    <p className="text-sm font-black text-white font-mono">{position.entryPrice}</p>
                </div>
                <div className="text-center">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Current</p>
                    <p className={`text-sm font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>{position.currentPrice}</p>
                </div>
                <div className="text-center">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Volume</p>
                    <p className="text-sm font-black text-white">{position.volume}</p>
                </div>
            </div>

            {/* SL / TP row */}
            <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-rose-500/5 rounded-xl p-2 text-center border border-rose-500/10">
                    <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Stop Loss</p>
                    <p className="text-xs font-black text-rose-400 font-mono">{position.sl > 0 ? position.sl : '---'}</p>
                    <p className="text-[8px] text-rose-500/60">{position.slDistance > 0 ? `${position.slDistance} (${position.slDistancePct}%)` : ''}</p>
                </div>
                <div className="bg-emerald-500/5 rounded-xl p-2 text-center border border-emerald-500/10">
                    <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Take Profit</p>
                    <p className="text-xs font-black text-emerald-400 font-mono">{position.tp > 0 ? position.tp : '---'}</p>
                    <p className="text-[8px] text-emerald-500/60">{position.tpDistance > 0 ? `${position.tpDistance} (${position.tpDistancePct}%)` : ''}</p>
                </div>
            </div>

            {/* P&L */}
            <div className="mt-3 flex items-center justify-between">
                <div>
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">P&L</p>
                    <p className={`text-xl font-black italic ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${position.profit.toFixed(2)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">P&L %</p>
                    <p className={`text-lg font-black italic ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{position.profitPct.toFixed(2)}%
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

function SniperIndicator({ trigger, valid }: { trigger: string | null; valid: boolean }) {
    if (!trigger) return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 border border-white/5">
            <Radio size={16} className="text-slate-600 animate-pulse" />
            <div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Aguardando padrão...</p>
            </div>
        </div>
    );

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            valid
                ? trigger === 'BUY' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'
                : 'bg-slate-950/40 border-white/5'
        }`}>
            <Crosshair size={16} className={valid ? (trigger === 'BUY' ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600'} />
            <div>
                <p className={`text-[8px] font-black uppercase tracking-widest ${valid ? (trigger === 'BUY' ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600'}`}>
                    Sniper: {trigger} {valid ? '(VÁLIDO)' : '(inválido)'}
                </p>
                {!valid && (
                    <p className="text-[7px] text-slate-600 tracking-wider">
                        {trigger === 'BUY' ? 'RSI precisa < 40' : 'RSI precisa > 60'}
                    </p>
                )}
            </div>
        </div>
    );
}

export const LiveTradeMonitor: React.FC = () => {
    const [data, setData] = useState<LiveMonitorData | null>(null);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = async () => {
        try {
            const resp = await axios.get('/api/mt5/micro-scalper/live-monitor');
            setData(resp.data);
            const now = Date.now();
            setPriceHistory(prev => {
                const newPoint = { time: now, price: resp.data.positions[0]?.currentPrice || 0 };
                const updated = [...prev, newPoint].slice(-60);
                return updated;
            });
        } catch (err) {
            console.error('Live monitor fetch error:', err);
        }
    };

    useEffect(() => {
        fetchData();
        intervalRef.current = setInterval(fetchData, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    if (!data) return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Conectando ao Live Monitor...</p>
        </div>
    );

    const { positions, summary, indicators, cycleInfo } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Eye size={20} className="text-indigo-400" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse border border-slate-900" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">
                            Live Trade Monitor
                        </h3>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            Atualização a cada 1s
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                    cycleInfo.enabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-500'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${cycleInfo.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                    {cycleInfo.enabled ? 'ONLINE' : 'OFFLINE'}
                </div>
            </div>

            {/* Indicators Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* RSI Gauge */}
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-4 flex flex-col items-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">RSI M1</p>
                    <RSIGauge value={indicators.rsi} zone={indicators.rsiZone} />
                </div>

                {/* Sniper Trigger */}
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-4">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Sniper Trigger</p>
                    <SniperIndicator trigger={indicators.sniperTrigger} valid={indicators.sniperValid} />
                </div>

                {/* Trend */}
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-4">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Tendência</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                            <span className="text-[9px] font-black text-slate-500 uppercase">M1</span>
                            <div className="flex items-center gap-2">
                                {indicators.trendM1 === 'BULLISH' ? <TrendingUp size={12} className="text-emerald-400" /> :
                                 indicators.trendM1 === 'BEARISH' ? <TrendingDown size={12} className="text-rose-400" /> :
                                 <Minus size={12} className="text-slate-500" />}
                                <span className={`text-[10px] font-black ${
                                    indicators.trendM1 === 'BULLISH' ? 'text-emerald-400' :
                                    indicators.trendM1 === 'BEARISH' ? 'text-rose-400' : 'text-slate-500'
                                }`}>{indicators.trendM1}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                            <span className="text-[9px] font-black text-slate-500 uppercase">M5</span>
                            <div className="flex items-center gap-2">
                                {indicators.trendM5 === 'BULLISH' ? <TrendingUp size={12} className="text-emerald-400" /> :
                                 indicators.trendM5 === 'BEARISH' ? <TrendingDown size={12} className="text-rose-400" /> :
                                 <Minus size={12} className="text-slate-500" />}
                                <span className={`text-[10px] font-black ${
                                    indicators.trendM5 === 'BULLISH' ? 'text-emerald-400' :
                                    indicators.trendM5 === 'BEARISH' ? 'text-rose-400' : 'text-slate-500'
                                }`}>{indicators.trendM5}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-4">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Resumo</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500">Posições</span>
                            <span className="text-sm font-black text-white">{summary.totalPositions}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500">Volume</span>
                            <span className="text-sm font-black text-white">{summary.totalVolume}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500">P&L Total</span>
                            <span className={`text-sm font-black italic ${summary.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ${summary.totalProfit.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500">P&L Médio</span>
                            <span className={`text-sm font-black italic ${summary.avgProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {summary.avgProfitPct.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Positions */}
            {positions.length === 0 ? (
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-12 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                        <Target size={48} className="text-indigo-500" />
                        <div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma posição ativa</p>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">Aguardando gatilho do Sniper...</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AnimatePresence>
                        {positions.map((pos, i) => (
                            <PositionCard key={pos.ticket} position={pos} index={i} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
