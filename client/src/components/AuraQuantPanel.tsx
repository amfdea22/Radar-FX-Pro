import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, Target, Cpu, Shield, DollarSign, Terminal, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface AuraQuantStatus {
    settings: { enabled: boolean; symbol: string; lotSize: number; maxDailyLoss: number; maxDailyProfit: number; maxSpread: number; riskPercent: number };
    state: { position: any | null; dailyProfit: number; dailyLoss: number };
    isRunning: boolean;
    marginOk: boolean;
    lastAnalysis: {
        price: number; ema21: number; ema50: number; stochK: number; stochD: number;
        atr: number; atrMA20: number; trend: number; adx: number; signal: string | null; entryScore: number;
        altSignal: string | null; altScore: number; dxyBias: number;
        calendarBlock: boolean; calendarReason: string;
    } | null;
    stats: {
        totalTrades: number; winCount: number; lossCount: number; winRate: number;
        totalProfit: number; avgWin: number; avgLoss: number; profitFactor: number;
        maxConsecutiveWins: number; maxConsecutiveLosses: number;
        bestTrade: number; worstTrade: number;
    };
    trades: Array<{ entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; direction: string; result: string; profit: number; partialClose: boolean }>;
    operationLog?: Array<{ time: string; action: string; details: string }>;
}

interface LocalLog { time: string; type: string; message: string }

export const AuraQuantPanel: React.FC = () => {
    const [status, setStatus] = useState<AuraQuantStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);

    const addLog = (type: string, message: string) => {
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        setLocalLogs(prev => [...prev, { time, type, message }]);
    };

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/aura-quant/status');
            const wasNull = status === null;
            setStatus(res.data);
            if (wasNull) addLog('SYSTEM', 'Aura Quant conectado ao MT5');
        } catch {}
    };

    useEffect(() => {
        addLog('SYSTEM', 'Iniciando Aura Quant...');
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => { clearInterval(iv); addLog('SYSTEM', 'Monitoramento encerrado'); };
    }, []);

    useEffect(() => {
        if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }, [localLogs.length, status?.operationLog?.length]);

    const toggle = async () => {
        setLoading(true);
        const wasEnabled = status?.settings?.enabled;
        addLog(wasEnabled ? 'STOP' : 'START', wasEnabled ? 'Desligando...' : 'Iniciando Aura Quant...');
        try {
            await axios.post('/api/mt5/aura-quant/settings', { enabled: !wasEnabled });
            await fetchStatus();
            addLog(wasEnabled ? 'STOP' : 'START', wasEnabled ? 'Parado' : 'Robô ativo');
        } catch { addLog('ERROR', 'Falha ao alterar estado'); }
        setLoading(false);
    };

    const a = status?.lastAnalysis;
    const s = status?.stats;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <div className="w-10 h-10 flex items-center justify-center">
                            <span className="text-2xl font-black text-violet-400 italic">A</span>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500">Aura</span> Quant
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${status?.settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {status?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-violet-400" /> XAUUSD M15 · Pullback + Stoch(14,3,3) + ADX · Trailing TP
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border transition-all ${status?.isRunning ? 'border-emerald-500/30 text-emerald-500' : 'border-white/5 text-slate-400'}`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${status?.isRunning ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{status?.marginOk ? 'Live' : 'Sem Margem'}</span>
                </div>
            </div>

            {/* Engine Panel */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Zap className="text-violet-400" /> Aura <span className="text-violet-400">Signal</span> Engine
                            <span className="px-2 py-0.5 rounded text-[10px] tracking-widest uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                M15
                            </span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Estratégia de pullback com EMA21 + Stoch(14,3,3) + ADX + Filtro de Tendência H4</p>
                    </div>
                    <button onClick={toggle} disabled={loading}
                        className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-lg ${status?.settings?.enabled ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {loading ? '...' : status?.settings?.enabled ? 'DESLIGAR' : 'ATIVAR'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Analysis */}
                    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 col-span-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={12} /> Análise M15
                        </h4>
                        {a ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Preço</span>
                                    <span className="text-xl font-black text-white">${a.price.toFixed(2)}</span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">EMA 21</span>
                                    <span className="text-xl font-black text-amber-400">{a.ema21.toFixed(1)}</span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">EMA 50</span>
                                    <span className={`text-xl font-black ${a.price > a.ema50 ? 'text-emerald-400' : 'text-rose-400'}`}>{a.ema50.toFixed(1)}</span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Stoch K/D (14,3,3)</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-violet-400">{a.stochK.toFixed(1)}</span>
                                        <span className="text-[10px] text-slate-600">/</span>
                                        <span className="text-sm font-black text-violet-300">{a.stochD.toFixed(1)}</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">ADX (14)</span>
                                    <span className={`text-xl font-black ${a.adx > 25 ? 'text-emerald-400' : a.adx > 20 ? 'text-amber-400' : 'text-slate-500'}`}>{a.adx.toFixed(1)}</span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">ATR 14 / Média 20</span>
                                    <span className={`text-lg font-black ${a.atr >= a.atrMA20 ? 'text-emerald-400' : 'text-slate-500'}`}>{a.atr.toFixed(2)} / {a.atrMA20.toFixed(2)}</span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Tendência H4</span>
                                    <span className={`text-lg font-black ${a.trend === 1 ? 'text-emerald-400' : a.trend === -1 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {a.trend === 1 ? 'ALTA' : a.trend === -1 ? 'BAIXA' : 'NEUTRA'}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Sinal</span>
                                    <span className={`text-lg font-black ${a.signal === 'BUY' ? 'text-emerald-400' : a.signal === 'SELL' ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {a.signal || (a.altSignal ? `${a.altSignal}(ALT)` : 'AGUARDANDO')}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Score</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xl font-black ${(a.entryScore || a.altScore) >= 50 ? 'text-emerald-400' : (a.entryScore || a.altScore) >= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {a.signal ? a.entryScore : a.altScore || '--'}
                                        </span>
                                        {a.altSignal && !a.signal && <span className="text-[9px] text-amber-400 font-bold">ALT</span>}
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">DXY Bias</span>
                                    <span className={`text-lg font-black ${a.dxyBias > 0 ? 'text-emerald-400' : a.dxyBias < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {a.dxyBias > 0 ? 'BULL XAU' : a.dxyBias < 0 ? 'BEAR XAU' : 'NEUTRO'}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 col-span-2">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Calendário</span>
                                    <span className={`text-sm font-black ${a.calendarBlock ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {a.calendarBlock ? a.calendarReason : 'Nenhum evento de alto impacto'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-32">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Analisando mercado...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BarChart3 size={12} /> Estatísticas
                        </h4>
                        {s ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total Trades</span>
                                    <span className="text-sm font-black text-white">{s.totalTrades}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Win Rate</span>
                                    <span className="text-sm font-black text-emerald-400">{s.winRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Lucro Total</span>
                                    <span className={`text-sm font-black ${s.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ${s.totalProfit.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Profit Factor</span>
                                    <span className="text-sm font-black text-white">{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Win/Loss</span>
                                    <span className="text-sm font-black">
                                        <span className="text-emerald-400">${s.avgWin.toFixed(2)}</span>
                                        <span className="text-slate-600 mx-1">/</span>
                                        <span className="text-rose-400">-${s.avgLoss.toFixed(2)}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Melhor/Pior</span>
                                    <span className="text-sm font-black">
                                        <span className="text-emerald-400">${s.bestTrade.toFixed(2)}</span>
                                        <span className="text-slate-600 mx-1">/</span>
                                        <span className="text-rose-400">${s.worstTrade.toFixed(2)}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Seq. Wins</span>
                                    <span className="text-sm font-black text-emerald-400">{s.maxConsecutiveWins}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-500 text-center py-8">Nenhum trade ainda</div>
                        )}
                    </div>
                </div>

                {/* Terminal */}
                <div className="bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border-b border-white/5">
                        <Terminal size={12} className="text-slate-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Terminal Aura Quant</span>
                    </div>
                    <div ref={terminalRef} className="h-48 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1">
                        {[...(status?.operationLog || []), ...localLogs].slice(-60).map((log, i) => (
                            <div key={i} className={`flex gap-2 ${log.type === 'ERROR' ? 'text-rose-400' : log.type === 'SYSTEM' || log.action === 'INIT' ? 'text-violet-400' : log.type === 'START' || log.action?.startsWith('TP') ? 'text-emerald-400' : log.type === 'STOP' ? 'text-rose-400' : log.type === 'WARN' ? 'text-amber-400' : 'text-slate-400'}`}>
                                <span className="text-slate-600 shrink-0">{(log as any).time || log.time}</span>
                                <span className="font-bold shrink-0">{(log as any).action || log.type}</span>
                                <span className="truncate">{(log as any).details || log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
