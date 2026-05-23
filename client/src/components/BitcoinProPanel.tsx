import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, TrendingUp, Activity, Zap, Target, Cpu, Shield, DollarSign, BarChart3, TrendingDown, Crosshair, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface BitcoinProStatus {
    settings: { enabled: boolean; symbol: string; lotSize: number; maxDailyLoss: number; maxDailyProfit: number };
    state: { position: any | null; dailyProfit: number; dailyLoss: number };
    isRunning: boolean;
    marginOk: boolean;
    lastAnalysis: {
        price: number; ema50: number; ema200: number; ema50Slope: string;
        trend: string; rsi: number; distanceToEma50: number;
        pullbackToEma: boolean; rsiSignal: boolean; entryScore: number;
        direction: string; swingLow: number; swingHigh: number;
    } | null;
    performance: { label: string; signalCount: number; winCount: number; winRate: number }[];
    stats: {
        totalTrades: number; winCount: number; lossCount: number; winRate: number;
        totalProfit: number; avgWin: number; avgLoss: number; profitFactor: number;
        maxConsecutiveWins: number; maxConsecutiveLosses: number;
        bestTrade: number; worstTrade: number;
    };
    trades: {
        entryTime: number; exitTime: number; entryPrice: number; exitPrice: number;
        direction: string; result: string; profit: number;
    }[];
    operationLog?: Array<{ time: string; action: string; details: string }>;
}

interface LocalLog {
    time: string;
    type: 'SYSTEM' | 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' | 'ERROR' | 'CONFIG' | 'START' | 'STOP' | 'SCAN';
    message: string;
}

function BtcLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="btc" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
                <filter id="btcglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22c55e" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="url(#btc)" filter="url(#btcglow)" />
            <text x="22" y="28" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontFamily="Arial">₿</text>
        </svg>
    );
}

function EmaChart({ ema50, ema200, price, swingLow, swingHigh }: { ema50: number; ema200: number; price: number; swingLow: number; swingHigh: number }) {
    const range = Math.max(swingHigh - swingLow, 1);
    const h = 80, w = 200;
    const pad = 14;
    const toY = (v: number) => pad + (1 - (v - swingLow) / range) * (h - pad * 2);
    return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <line x1={0} y1={toY(ema50)} x2={w} y2={toY(ema50)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6" />
            <text x={w - 4} y={toY(ema50) - 4} textAnchor="end" fill="#f59e0b" fontSize="7" fontWeight="700">EMA50</text>
            <line x1={0} y1={toY(ema200)} x2={w} y2={toY(ema200)} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6" />
            <text x={w - 4} y={toY(ema200) - 4} textAnchor="end" fill="#6366f1" fontSize="7" fontWeight="700">EMA200</text>
            <circle cx={w / 2} cy={toY(price)} r={4.5} fill="#22c55e" stroke="white" strokeWidth="1.5" className="drop-shadow-lg" />
            <text x={w / 2 + 9} y={toY(price) + 3} fill="white" fontSize="9" fontWeight="700">${price.toFixed(1)}</text>
            <line x1={0} y1={toY(swingHigh)} x2={w} y2={toY(swingHigh)} stroke="#ef4444" strokeWidth="1" opacity="0.3" />
            <text x={4} y={toY(swingHigh) - 4} fill="#ef4444" fontSize="7" fontWeight="700">HH</text>
            <line x1={0} y1={toY(swingLow)} x2={w} y2={toY(swingLow)} stroke="#22c55e" strokeWidth="1" opacity="0.3" />
            <text x={4} y={toY(swingLow) - 4} fill="#22c55e" fontSize="7" fontWeight="700">LL</text>
        </svg>
    );
}

const ACCENT = 'green';

export const BitcoinProPanel: React.FC = () => {
    const [status, setStatus] = useState<BitcoinProStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [lotSize, setLotSize] = useState(0.01);
    const [maxDailyLoss, setMaxDailyLoss] = useState(50);
    const [maxDailyProfit, setMaxDailyProfit] = useState(100);
    const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);

    const addLog = (type: LocalLog['type'], message: string) => {
        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour12: false });
        setLocalLogs(prev => [...prev, { time, type, message }]);
    };

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/bitcoin-pro/status');
            const wasNull = status === null;
            setStatus(res.data);
            setLotSize(res.data.settings.lotSize);
            setMaxDailyLoss(res.data.settings.maxDailyLoss);
            setMaxDailyProfit(res.data.settings.maxDailyProfit);
            if (wasNull) addLog('SYSTEM', 'Conexão estabelecida com MT5');
            if (res.data?.lastAnalysis?.trend) addLog('SCAN', `Análise: ${res.data.lastAnalysis.trend} | Score ${res.data.lastAnalysis.entryScore}/100`);
        } catch { }
    };

    useEffect(() => {
        addLog('SYSTEM', 'Iniciando monitoramento Bitcoin Pro...');
        addLog('INFO', 'Conectando ao servidor MT5...');
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => {
            clearInterval(iv);
            addLog('SYSTEM', 'Monitoramento encerrado');
        };
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [localLogs.length, status?.operationLog?.length]);

    const toggle = async () => {
        setLoading(true);
        const wasEnabled = status?.settings?.enabled;
        addLog(wasEnabled ? 'STOP' : 'START', wasEnabled ? 'Desligando robô...' : 'Iniciando robô Bitcoin Pro...');
        try {
            await axios.post('/api/mt5/bitcoin-pro/settings', { enabled: !wasEnabled });
            await fetchStatus();
            addLog(wasEnabled ? 'STOP' : 'START', wasEnabled ? 'Robô desligado com sucesso' : 'Robô iniciado com sucesso');
        } catch {
            addLog('ERROR', 'Falha ao alterar estado do robô');
        }
        setLoading(false);
    };

    const saveSettings = () => {
        addLog('CONFIG', `Salvando configurações — Lote: ${lotSize.toFixed(2)}, Max Loss: $${maxDailyLoss}, Max Gain: $${maxDailyProfit}`);
        axios.post('/api/mt5/bitcoin-pro/settings', {
            ...status?.settings, lotSize, maxDailyLoss, maxDailyProfit,
        }).catch(() => addLog('ERROR', 'Erro ao salvar configurações'));
    };

    const a = status?.lastAnalysis;
    const s = status?.stats;

    const validA = a && typeof a.price === 'number';

    const analysisItems = [
        { label: 'Tendência', key: 'trend' as const, icon: TrendingUp },
        { label: 'Direção', key: 'direction' as const, icon: Zap },
        { label: 'Score', key: 'entryScore' as const, icon: Target },
        { label: 'EMA50 Slope', key: 'ema50Slope' as const, icon: Activity },
    ];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-green-500/10 rounded-3xl border border-green-500/20 shadow-xl shadow-green-500/10">
                        <BtcLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Bitcoin</span> Pro
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${status?.settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {status?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-green-500" /> Estratégia 50/200 + RSI — Swing Trade BTC
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border transition-all ${status?.isRunning ? 'border-emerald-500/30 text-emerald-500' : 'border-white/5 text-slate-400'} hover:bg-green-500/10 hover:border-green-500/20`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${status?.isRunning ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{status?.marginOk ? 'Live' : 'Sem Margem'}</span>
                </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Cpu className="text-green-500 animate-pulse" /> Trend <span className="text-green-500">Momentum</span> Engine
                            <span className={`px-2 py-0.5 rounded text-[10px] tracking-widest uppercase ${a?.trend === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : a?.trend === 'BEARISH' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                                {a?.trend || 'Scanning'}
                            </span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">EMA 50/200 Cross + RSI 14 — Swing Trade Estratégico</p>
                    </div>
                    <button
                        onClick={toggle}
                        disabled={loading}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            status?.settings?.enabled
                                ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                : 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20'
                        }`}
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : status?.settings?.enabled ? (
                            <><Zap size={12} /> Desligar</>
                        ) : (
                            <><Zap size={12} /> Ligar Robô</>
                        )}
                    </button>
                </div>

                {validA ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-green-500/20 transition-all flex items-center gap-4">
                            <div className="p-3 bg-green-500/20 text-green-500 rounded-xl">
                                <Bitcoin size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Preço BTC</p>
                                <p className="text-xl font-black text-white italic">${(a?.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-green-500/20 transition-all flex items-center gap-4">
                            <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                                <Target size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">EMA 50</p>
                                <p className="text-xl font-black text-white italic">${(a?.ema50 ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-green-500/20 transition-all flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
                                <Activity size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">EMA 200</p>
                                <p className="text-xl font-black text-white italic">${(a?.ema200 ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-green-500/20 transition-all flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${(a?.rsi ?? 50) > 70 ? 'bg-red-500/20 text-red-500' : (a?.rsi ?? 50) < 30 ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                <Crosshair size={20} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">RSI 14</p>
                                <p className={`text-xl font-black italic ${(a?.rsi ?? 50) > 70 ? 'text-red-400' : (a?.rsi ?? 50) < 30 ? 'text-green-400' : 'text-white'}`}>{(a?.rsi ?? 0).toFixed(1)}</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                        if (!validA || !a) return [0, 1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 animate-pulse">
                                <div className="h-5 bg-slate-800/60 rounded w-20 mb-4" />
                                <div className="space-y-3">
                                    <div className="h-3 bg-slate-800/60 rounded w-full" />
                                    <div className="h-8 bg-slate-800/60 rounded w-16" />
                                    <div className="h-2 bg-slate-800/60 rounded w-full" />
                                </div>
                            </div>
                        ));

                        return analysisItems.map((item, i) => {
                            const val = a[item.key];
                            const strVal = typeof val === 'number' ? `${val}/100` : String(val ?? '--');
                            const isUp = val === 'BULLISH' || val === 'UP' || val === 'BUY';
                            const isDown = val === 'BEARISH' || val === 'DOWN' || val === 'SELL';
                            const isGood = typeof val === 'number' && val >= 70;
                            const isMid = typeof val === 'number' && val >= 50;

                            return (
                                <motion.div key={i} whileHover={{ y: -5 }} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 hover:border-green-500/20 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-lg font-black text-white italic">{item.label}</span>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isUp ? 'bg-emerald-500/20 text-emerald-500' : isDown ? 'bg-red-500/20 text-red-500' : isGood ? 'bg-emerald-500/20 text-emerald-500' : isMid ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-500/10 text-slate-500'} border border-current/20`}>
                                            {strVal}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${isUp ? 'bg-emerald-500/20 text-emerald-500' : isDown ? 'bg-red-500/20 text-red-500' : isGood ? 'bg-emerald-500/20 text-emerald-500' : isMid ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                                <item.icon size={20} className={val === 'BEARISH' || val === 'DOWN' ? 'rotate-180' : ''} />
                                            </div>
                                            <p className={`text-2xl font-black italic ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : isGood ? 'text-emerald-400' : isMid ? 'text-amber-400' : 'text-slate-400'}`}>{strVal}</p>
                                        </div>
                                        {item.key === 'entryScore' && (
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, val as number)}%` }}
                                                    className={`h-full ${isGood ? 'bg-gradient-to-r from-green-500 to-emerald-400' : isMid ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        });
                    })()}

                    {validA && a && (
                        <motion.div whileHover={{ y: -5 }} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 hover:border-green-500/20 transition-all md:col-span-2 lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EMA Structure</span>
                                <div className="flex gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${a?.pullbackToEma ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500'}`}>Pullback</span>
                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${a?.rsiSignal ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500'}`}>RSI Signal</span>
                                </div>
                            </div>
                            <EmaChart ema50={a?.ema50 ?? 0} ema200={a?.ema200 ?? 0} price={a?.price ?? 0} swingLow={a?.swingLow ?? 0} swingHigh={a?.swingHigh ?? 0} />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* TRADE EM EXECUÇÃO */}
            {status?.state?.position ? (
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>

                    <div className="flex items-center gap-3 mb-8">
                        <div className={`p-2.5 rounded-xl border ${status.state.position.type === 'BUY' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
                            <Zap size={22} className={status.state.position.type === 'SELL' ? 'rotate-180' : ''} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                    Trade em <span className={status.state.position.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{status.state.position.type === 'BUY' ? 'Compra' : 'Venda'}</span>
                                </h3>
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${status.state.position.type === 'BUY' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
                                    {status.state.position.type === 'BUY' ? 'LONG' : 'SHORT'}
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                                {status?.settings?.symbol || 'BTCUSD'} · Lote {status.state.position.volume ?? status?.settings?.lotSize ?? 0.01}
                                {status.state.position.ticket && <> · Ticket #{status.state.position.ticket}</>}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Preço Entrada</span>
                            <p className="text-2xl font-black text-white italic mt-1">${(status.state.position.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Stop Loss</span>
                                    <p className="text-sm font-black text-red-400">${(status.state.position.sl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Take Profit</span>
                                    <p className="text-sm font-black text-emerald-400">${(status.state.position.tp ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Preço Atual</span>
                            <p className="text-2xl font-black text-white italic mt-1">${(a?.price ?? status.state.position.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">P&L Flutuante</span>
                                    <p className={`text-lg font-black ${(status.state.position.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {(status.state.position.profit ?? 0) >= 0 ? '+' : ''}${(status.state.position.profit ?? 0).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">P&L Diário</span>
                                    <p className={`text-lg font-black ${(status.state.dailyProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {(status.state.dailyProfit ?? 0) >= 0 ? '+' : ''}${(status.state.dailyProfit ?? 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tempo em Trade</span>
                            <p className="text-2xl font-black text-white italic mt-1">
                                {status.state.position.openTime
                                    ? (() => {
                                        const elapsed = Math.floor((Date.now() - status.state.position.openTime * 1000) / 60000);
                                        const h = Math.floor(elapsed / 60);
                                        const m = elapsed % 60;
                                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                    })()
                                    : '--'}
                            </p>
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Distância SL</span>
                                    <p className="text-sm font-black text-red-400">
                                        {status.state.position.sl && status.state.position.price
                                            ? `${Math.abs(((status.state.position.sl - status.state.position.price) / status.state.position.price) * 100).toFixed(2)}%`
                                            : '--'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Distância TP</span>
                                    <p className="text-sm font-black text-emerald-400">
                                        {status.state.position.tp && status.state.position.price
                                            ? `${Math.abs(((status.state.position.tp - status.state.position.price) / status.state.position.price) * 100).toFixed(2)}%`
                                            : '--'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {status.state.position.sl && status.state.position.tp && (
                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                            <div className="flex justify-between text-[9px] font-black text-slate-500 mb-2">
                                <span>SL ${(status.state.position.sl ?? 0).toFixed(2)}</span>
                                <span className="text-white">${(status.state.position.price ?? 0).toFixed(2)}</span>
                                <span>TP ${(status.state.position.tp ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                                <div className={`h-full rounded-full transition-all duration-1000 ${(status.state.position.profit ?? 0) >= 0 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
                                    style={{ width: `${(() => {
                                        const total = (status.state.position.tp - status.state.position.sl);
                                        const current = (status.state.position.price ?? 0) - status.state.position.sl;
                                        return total !== 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 50;
                                    })()}%` }}
                                />
                                <div className="absolute top-0 w-0.5 h-full bg-white/60 shadow-[0_0_6px_rgba(255,255,255,0.5)]" style={{ left: `${((status.state.position.price - status.state.position.sl) / (status.state.position.tp - status.state.position.sl)) * 100}%` }} />
                            </div>
                            <div className="flex justify-between text-[8px] font-black text-slate-600 mt-1.5">
                                <span>{(status.state.position.sl < (status.state.position.price ?? 0) && status.state.position.type === 'BUY') || (status.state.position.sl > (status.state.position.price ?? 0) && status.state.position.type === 'SELL') ? '● Em Lucro' : '● Em Perda'}</span>
                                <span>{(status.state.position.price ?? 0) > status.state.position.tp ? '● TP Atingido' : (status.state.position.price ?? 0) < status.state.position.sl ? '● SL Atingido' : '● Em Aberto'}</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : validA && a ? (
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800/50 rounded-2xl border border-white/5">
                            <TrendingDown size={24} className="text-slate-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white italic">Nenhum Trade em Execução</h3>
                            <p className="text-[10px] text-slate-500 mt-1">Estratégia monitorando mercado — aguardando setup ideal</p>
                        </div>
                        {a && (
                            <div className="ml-auto flex items-center gap-3">
                                <span className="text-[9px] text-slate-500">Último sinal:</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${a.trend === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : a.trend === 'BEARISH' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                                    {a.trend || 'NEUTRO'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800/50 rounded-2xl border border-white/5 animate-pulse">
                            <Cpu size={24} className="text-slate-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white italic">Aguardando Análise</h3>
                            <p className="text-[10px] text-slate-500 mt-1">Conectando ao servidor MT5 para iniciar monitoramento</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                <div className="xl:col-span-2 space-y-6">
                    {s && (s.totalTrades ?? 0) > 0 && (
                        <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>

                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <BarChart3 className="text-green-400" size={20} /> Estatísticas
                                </h3>
                                <span className="text-[10px] font-bold text-green-400/60 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/15">
                                    {s.totalTrades ?? 0} trades — {(s.winRate ?? 0).toFixed(0)}% win rate
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {[
                                    { label: 'Total Trades', value: s.totalTrades ?? 0, color: 'text-white' },
                                    { label: 'Win Rate', value: `${(s.winRate ?? 0).toFixed(0)}%`, color: (s.winRate ?? 0) >= 60 ? 'text-emerald-400' : (s.winRate ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400' },
                                    { label: 'Profit Factor', value: (s.profitFactor ?? 0) === Infinity ? '∞' : (s.profitFactor ?? 0).toFixed(2), color: (s.profitFactor ?? 0) >= 1.5 ? 'text-emerald-400' : (s.profitFactor ?? 0) >= 1 ? 'text-amber-400' : 'text-red-400' },
                                    { label: 'P&L Total', value: `$${(s.totalProfit ?? 0).toFixed(2)}`, color: (s.totalProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                ].map((m, i) => (
                                    <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{m.label}</p>
                                        <p className={`text-2xl font-black italic ${m.color}`}>{m.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {[
                                    { label: 'Média Win', value: `$${(s.avgWin || 0).toFixed(2)}`, color: 'text-emerald-400' },
                                    { label: 'Média Loss', value: `-$${(s.avgLoss || 0).toFixed(2)}`, color: 'text-red-400' },
                                    { label: 'Melhor Trade', value: `$${(s.bestTrade || 0).toFixed(2)}`, color: 'text-emerald-400' },
                                    { label: 'Pior Trade', value: `$${(s.worstTrade || 0).toFixed(2)}`, color: 'text-red-400' },
                                ].map((m, i) => (
                                    <div key={i} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{m.label}</p>
                                        <p className={`text-sm font-black ${m.color}`}>{m.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Maior Sequência Wins</p>
                                    <p className="text-sm font-black text-emerald-400">{s.maxConsecutiveWins ?? 0}</p>
                                </div>
                                <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Maior Sequência Losses</p>
                                    <p className="text-sm font-black text-red-400">{s.maxConsecutiveLosses ?? 0}</p>
                                </div>
                            </div>

                            {status?.performance && status.performance.length > 0 && (
                                <>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Desempenho por Indicador</h4>
                                    <div className="space-y-1.5 mb-6">
                                        {status.performance.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[9px] font-bold text-slate-400">{p.label}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] text-slate-600">{p.winCount ?? 0}/{p.signalCount ?? 0}</span>
                                                    <span className={`text-sm font-black min-w-[3rem] text-right ${(p.winRate ?? 0) >= 60 ? 'text-emerald-400' : (p.winRate ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {(p.winRate ?? 0).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Últimos Trades</h4>
                            <div className="space-y-1.5">
                                {status?.trades?.slice(0, 8).map((t, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.result === 'WIN' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            <span className={`text-xs font-black ${t.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'}`}>{t.result}</span>
                                            <span className="text-[10px] text-slate-500">{t.direction}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">${t.entryPrice?.toFixed(2) || '0.00'}</span>
                                        <span className={`text-xs font-black ${(t.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${t.profit?.toFixed(2) || '0.00'}</span>
                                    </div>
                                ))}
                                {(!status?.trades || status.trades.length === 0) && (
                                    <div className="flex flex-col items-center py-8 text-center">
                                        <TrendingDown size={28} className="text-slate-700 mb-2" />
                                        <p className="text-xs font-bold text-slate-500">Nenhum trade realizado ainda</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {(!s || (s.totalTrades ?? 0) === 0) && validA && (
                        <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Bitcoin size={36} className="text-slate-700 mb-3" />
                                <p className="text-sm font-bold text-slate-500">Aguardando trades</p>
                                <p className="text-[10px] text-slate-600 mt-1">Estratégia monitorando EMA 50/200 e RSI</p>
                            </div>
                        </div>
                    )}

                    {!validA && (
                        <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Bitcoin size={36} className="text-slate-700 mb-3" />
                                <p className="text-sm font-bold text-slate-500">Aguardando primeira análise...</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Shield className="text-green-500" size={18} /> Gestão de Risco
                        </h3>
                        <div className="space-y-5">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lote</span>
                                    <span className="text-sm font-black text-amber-400">{lotSize.toFixed(2)}</span>
                                </div>
                                <input type="range" min={0.01} max={1} step={0.01} value={lotSize}
                                    onChange={e => { setLotSize(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-amber-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max Loss Diário</span>
                                    <span className="text-sm font-black text-red-400">${maxDailyLoss.toFixed(0)}</span>
                                </div>
                                <input type="range" min={10} max={500} step={10} value={maxDailyLoss}
                                    onChange={e => { setMaxDailyLoss(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-red-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max Gain Diário</span>
                                    <span className="text-sm font-black text-emerald-400">${maxDailyProfit.toFixed(0)}</span>
                                </div>
                                <input type="range" min={10} max={1000} step={10} value={maxDailyProfit}
                                    onChange={e => { setMaxDailyProfit(Number(e.target.value)); }}
                                    onMouseUp={() => saveSettings()}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">P&L Diário</span>
                                <span className={`text-lg font-black ${(status?.state?.dailyProfit || 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    ${(status?.state?.dailyProfit || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Margem OK</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status?.marginOk ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                    <span className={`text-sm font-black ${status?.marginOk ? 'text-emerald-400' : 'text-red-400'}`}>{status?.marginOk ? 'Sim' : 'Não'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {validA && (
                        <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                            <div className="flex flex-col items-center py-6 text-center">
                                <TrendingDown size={32} className="text-slate-700 mb-3" />
                                <p className="text-sm font-bold text-slate-500">Nenhuma posição ativa</p>
                                <p className="text-[10px] text-slate-600 mt-1">Aguardando setup ideal para entrar</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TERMINAL DE MONITORAMENTO */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                            <Terminal size={16} className="text-green-400" />
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Terminal de Monitoramento</span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status?.settings?.enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${status?.settings?.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-[7px] font-black uppercase tracking-widest">{status?.settings?.enabled ? 'AO VIVO' : 'OFF'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                            {(status?.operationLog?.length ?? 0) + localLogs.length} eventos
                        </span>
                        <button
                            onClick={() => setLocalLogs([])}
                            className="text-[8px] px-2 py-1 rounded-lg bg-slate-950/50 border border-white/5 text-slate-500 hover:text-red-400 hover:border-red-500/20 transition-all font-black uppercase tracking-widest"
                        >
                            Limpar
                        </button>
                    </div>
                </div>
                <div ref={terminalRef} className="h-56 overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-slate-950/20 no-scrollbar">
                    {localLogs.length > 0 || (status?.operationLog && status.operationLog.length > 0) ? (
                        <>
                            {status?.operationLog?.slice(-30).map((log, i) => {
                                const actionColors: Record<string, string> = {
                                    OPEN: 'text-emerald-400', CLOSE: 'text-amber-400',
                                    PROFIT: 'text-emerald-300', STOP: 'text-red-400',
                                    ERROR: 'text-red-400', INFO: 'text-slate-400',
                                    CONFIG: 'text-blue-400', SCAN: 'text-cyan-400',
                                };
                                const c = actionColors[log.action] || 'text-green-400/70';
                                return (
                                    <div key={`api-${i}`} className="flex gap-3 items-start hover:bg-white/[0.02] px-2 py-0.5 rounded transition-colors">
                                        <span className="text-slate-700 shrink-0 text-[10px]">{log.time}</span>
                                        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${c}`}>[{log.action}]</span>
                                        <span className="text-slate-300">{log.details}</span>
                                    </div>
                                );
                            })}
                            {localLogs.map((log, i) => {
                                const colors: Record<string, string> = {
                                    SYSTEM: 'text-green-400', INFO: 'text-slate-400',
                                    TRADE: 'text-emerald-400', SUCCESS: 'text-emerald-300',
                                    WARN: 'text-amber-400', ERROR: 'text-red-400',
                                    CONFIG: 'text-blue-400', START: 'text-emerald-400',
                                    STOP: 'text-red-400', SCAN: 'text-cyan-400',
                                };
                                const prefixes: Record<string, string> = {
                                    SYSTEM: '⚡', INFO: 'ℹ', TRADE: '◆', SUCCESS: '✓',
                                    WARN: '⚠', ERROR: '✕', CONFIG: '⚙', START: '▶',
                                    STOP: '■', SCAN: '◈',
                                };
                                return (
                                    <div key={`local-${i}`} className="flex gap-3 items-start hover:bg-white/[0.02] px-2 py-0.5 rounded transition-colors">
                                        <span className="text-slate-700 shrink-0 text-[10px]">{log.time}</span>
                                        <span className={`w-4 shrink-0 ${colors[log.type]}`}>{prefixes[log.type]}</span>
                                        <span className={colors[log.type]}>{log.message}</span>
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Terminal size={24} className="text-slate-700 mb-2" />
                            <p className="text-[11px] font-bold text-slate-600">Aguardando logs do Bitcoin Pro...</p>
                            <p className="text-[9px] text-slate-700 mt-1">Os eventos aparecerão aqui em tempo real</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
