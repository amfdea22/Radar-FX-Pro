import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Target, TrendingUp, Shield, Zap, History, Settings,
    DollarSign, BarChart3, RefreshCw, Crosshair, Eye, EyeOff,
    ChevronDown, ChevronUp, AlertTriangle, Award, Sparkles, Cpu,
    Bot, Power
} from 'lucide-react';

interface WolfBotStatus {
    settings: any;
    state: any;
    lastAnalysis: any;
    trades: any[];
    operationLog: any[];
    performance: any;
    pendingOrders: number[];
}

const PhaseColors: Record<string, string> = {
    SPRING: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    UTAD: 'text-red-400 bg-red-500/10 border-red-500/30',
    MARKUP: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    MARKDOWN: 'text-red-400 bg-red-500/10 border-red-500/30',
    ACCUMULATION: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    DISTRIBUTION: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    NONE: 'text-slate-500 bg-slate-800/40 border-slate-700/30',
};

export const WolfBotPanel: React.FC = () => {
    const [status, setStatus] = useState<WolfBotStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showLog, setShowLog] = useState(true);
    const [notif, setNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/wolf-bot/status');
            setStatus(resp.data);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => {
        fetchStatus();
        const iv = setInterval(fetchStatus, 8000);
        return () => clearInterval(iv);
    }, []);

    const showNotif = (type: 'success' | 'error', msg: string) => {
        setNotif({ type, msg });
        setTimeout(() => setNotif(null), 3000);
    };

    const handleToggle = async () => {
        try {
            const res = await axios.post('/api/mt5/wolf-bot/settings', { enabled: !status?.settings?.enabled });
            await fetchStatus();
            showNotif('success', `Wolf Bot ${res.data.statusData?.settings?.enabled ? 'ativado' : 'pausado'}`);
        } catch { showNotif('error', 'Erro ao alterar estado'); }
    };

    const handleUpdate = async (key: string, value: any) => {
        try {
            await axios.post('/api/mt5/wolf-bot/settings', { [key]: value });
            await fetchStatus();
        } catch { showNotif('error', 'Erro ao salvar config'); }
    };

    const handleSync = async () => {
        setSyncing(true);
        try { await axios.get('/api/mt5/wolf-bot/history'); await fetchStatus(); showNotif('success', 'Sincronizado'); }
        catch { showNotif('error', 'Erro ao sincronizar'); }
        finally { setSyncing(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic animate-pulse">
                    Inicializando Wolf Bot...
                </span>
            </motion.div>
        </div>
    );
    if (!status) return <div className="text-red-400 text-center p-8 font-bold">Erro ao carregar Wolf Bot.</div>;

    const { settings, lastAnalysis, operationLog, performance, pendingOrders, trades } = status;
    const analysis = lastAnalysis || {};
    const setup = analysis?.setup || {};
    const range = analysis?.tradingRange || {};
    const fvgs = analysis?.fvgZones || [];
    const obs = analysis?.orderBlocks || [];
    const swings = analysis?.customSwings || [];
    const perf = performance || {};
    const isEnabled = settings?.enabled;

    function WolfLogo() {
        return (
            <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
                <defs>
                    <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                    <filter id="wglow">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#fbbf24" floodOpacity="0.4" />
                    </filter>
                </defs>
                <circle cx="22" cy="22" r="18" fill="none" stroke="url(#wg)" strokeWidth="2" filter="url(#wglow)" />
                <text x="22" y="30" textAnchor="middle" fill="url(#wg)" fontSize="26" fontWeight="900" fontStyle="italic" filter="url(#wglow)">W</text>
                <circle cx="22" cy="22" r="18" fill="none" stroke="url(#wg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
            </svg>
        );
    }

    const phaseFull = analysis?.wyckoffPhase || 'NONE';
    const phaseKey = phaseFull.includes('SPRING') ? 'SPRING'
        : phaseFull.includes('UTAD') ? 'UTAD'
            : phaseFull.includes('MARKUP') ? 'MARKUP'
                : phaseFull.includes('MARKDOWN') ? 'MARKDOWN'
                    : phaseFull.includes('ACCUMULATION') ? 'ACCUMULATION'
                        : phaseFull.includes('DISTRIBUTION') ? 'DISTRIBUTION' : 'NONE';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

            {/* Notificacao */}
            <AnimatePresence>
                {notif && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl border text-[11px] font-bold uppercase tracking-wider shadow-2xl ${notif.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
                        {notif.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADLINE — Melhorado */}
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="flex flex-col md:flex-row justify-between items-center gap-6 p-8 bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <WolfLogo />
                    </div>
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Wolf</span> Bot
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${isEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-400'}`}>
                                {isEnabled ? '● SISTEMA ATIVO' : '○ SISTEMA PAUSADO'}
                            </span>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px] flex items-center gap-2">
                                <Cpu size={12} className="text-amber-500" /> MT5 SYNC OK
                            </p>
                        </div>
                    </div>
                </div>

                {/* BOTÃO LIGA/DESLIGA PROMINENTE */}
                <div className="relative z-10">
                    <button onClick={handleToggle}
                        className={`group flex items-center gap-3 px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter transition-all duration-300 border ${isEnabled 
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}>
                        {isEnabled ? <Power size={20} /> : <Power size={20} />}
                        {isEnabled ? 'Desligar Robô' : 'Ligar Robô'}
                    </button>
                </div>
            </motion.div>


            {/* Grid Principal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── COLUNA ESQUERDA: Config + Setup ── */}
                <div className="lg:col-span-1 space-y-5">

                    {/* Card Config */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-amber-500/10 p-5 space-y-4">
                        <button onClick={() => setShowSettings(!showSettings)}
                            className="flex items-center justify-between w-full text-white">
                            <div className="flex items-center gap-2">
                                <Settings size={16} className="text-amber-400" />
                                <h3 className="text-[11px] font-black uppercase italic tracking-wider">Configurações</h3>
                            </div>
                            {showSettings ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden space-y-3">
                                     {[
                                         { key: 'lotSize', label: 'Lote Padrão', type: 'number', step: 0.01, min: 0.01 },
                                         { key: 'riskPercent', label: 'Risco %', type: 'number', step: 0.1, min: 0.1, max: 5 },
                                         { key: 'minRR', label: 'Min R:R', type: 'number', step: 0.5, min: 1 },
                                         { key: 'swingPeriods', label: 'Período Swing', type: 'number', step: 1, min: 3, max: 30 },
                                         { key: 'breakevenPaddingPoints', label: 'Padding BE (pts)', type: 'number', step: 1, min: 0 },
                                     ].map(field => (
                                         <div key={field.key} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all group">
                                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">{field.label}</span>
                                             <input type={field.type} step={field.step} min={field.min} max={field.max}
                                                 value={settings?.[field.key] ?? ''}
                                                 onChange={(e) => handleUpdate(field.key, parseFloat(e.target.value) || field.min)}
                                                 className="w-20 text-right bg-slate-900/60 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-amber-300 focus:outline-none focus:border-amber-500/50 transition-all shadow-inner" />
                                         </div>
                                     ))}

                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Card Setup Ativo */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-amber-500/10 p-5 space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <Crosshair size={16} className="text-amber-400" />
                            <h3 className="text-[11px] font-black uppercase italic tracking-wider">Setup Ativo</h3>
                            {setup?.direction && (
                                <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${setup.direction === 'LONG' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                                    {setup.direction}
                                </span>
                            )}
                        </div>

                        {setup?.direction ? (
                            <div className="space-y-2">
                                {[
                                    { label: 'Entrada', value: setup.entry, color: 'text-amber-300' },
                                    { label: 'Stop Loss', value: setup.sl, color: 'text-red-400' },
                                    { label: 'TP1 (60%)', value: setup.tp1, color: 'text-emerald-400' },
                                    { label: 'TP2 (40%)', value: setup.tp2, color: 'text-emerald-300' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
                                        <span className={`text-[13px] font-black italic ${item.color}`}>
                                            {item.value?.toFixed(2) ?? '—'}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Confianca</span>
                                    <span className={`text-[13px] font-black italic ${setup.confidence === 'A' ? 'text-emerald-400' : setup.confidence === 'B' ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {setup.confidence || '—'}
                                    </span>
                                </div>
                                <p className="text-[9px] text-slate-600 italic mt-1 leading-relaxed">{setup.reason}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-6 text-slate-600">
                                <EyeOff size={24} className="mb-2 opacity-50" />
                                <p className="text-[10px] font-bold uppercase tracking-wider">Aguardando Setup</p>
                                <p className="text-[9px] text-slate-700 italic mt-1">Nenhuma confluencia Wyckoff + SMC no momento</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Estatisticas Rapidas */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-5 space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <Award size={16} className="text-amber-400" />
                            <h3 className="text-[11px] font-black uppercase italic tracking-wider">Performance</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Trades', value: perf.totalTrades ?? 0, color: 'text-white' },
                                { label: 'Wins', value: perf.wins ?? 0, color: 'text-emerald-400' },
                                { label: 'Losses', value: perf.losses ?? 0, color: 'text-red-400' },
                                { label: 'Win Rate', value: perf.winRate ? `${perf.winRate.toFixed(1)}%` : '0%', color: perf.winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
                                { label: 'Lucro Total', value: perf.totalProfit ? `$${perf.totalProfit.toFixed(2)}` : '$0.00', color: (perf.totalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                { label: 'Ordens Pend.', value: pendingOrders?.length ?? 0, color: 'text-amber-400' },
                            ].map(stat => (
                                <div key={stat.label} className="p-2.5 bg-slate-950/40 rounded-xl border border-white/5 text-center">
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{stat.label}</p>
                                    <p className={`text-lg font-black italic ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* ── COLUNA DIREITA (2/3): Analise + Range + FVGs + Log ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Cartoes de Analise */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: Activity, label: 'Fase Wyckoff', value: analysis?.wyckoffSummary || '—', color: PhaseColors[phaseKey] || 'text-slate-400 bg-slate-800/40 border-slate-700/30', sub: analysis?.wyckoffPhase || '' },
                            { icon: TrendingUp, label: 'Estrutura SMC', value: analysis?.smcStructure || '—', color: analysis?.smcStructure === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : analysis?.smcStructure === 'BEARISH' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-slate-400 bg-slate-800/40 border-slate-700/30' },
                            { icon: Zap, label: 'Liquidity Sweep', value: analysis?.liquiditySweep || 'Nenhum', color: analysis?.liquiditySweep ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-slate-500 bg-slate-800/40 border-slate-700/30' },
                            { icon: Shield, label: 'CHoCH', value: analysis?.hasCHoCH || 'Aguardando', color: analysis?.hasCHoCH === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : analysis?.hasCHoCH === 'BEARISH' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-slate-500 bg-slate-800/40 border-slate-700/30' },
                        ].map((card, i) => (
                            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className={`p-4 rounded-2xl border backdrop-blur-sm ${card.color}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <card.icon size={14} />
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-70">{card.label}</span>
                                </div>
                                <p className="text-[13px] font-black italic leading-tight">{card.value}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Range + FVGs + OBs + OTE */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-amber-500/10 p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            <div>
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Range Superior</p>
                                <p className="text-lg font-black text-white italic">{range?.upperSwing?.toFixed(2) ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Range Inferior</p>
                                <p className="text-lg font-black text-white italic">{range?.lowerSwing?.toFixed(2) ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">FVGs Ativos</p>
                                <p className="text-lg font-black italic text-amber-400">{fvgs.filter((f: any) => !f.mitigated).length}</p>
                                <p className="text-[8px] text-slate-600">{fvgs.length} total</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Order Blocks</p>
                                <p className="text-lg font-black italic text-amber-400">{obs.filter((o: any) => !o.mitigated).length}</p>
                                <p className="text-[8px] text-slate-600">{obs.length} total</p>
                            </div>
                        </div>
                        {analysis?.oteZone && (
                            <div className="mt-3 flex items-center gap-4 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Zona OTE:</span>
                                <span className="text-[11px] font-black text-white">{analysis.oteZone.low?.toFixed(2)}</span>
                                <span className="text-slate-600">→</span>
                                <span className="text-[11px] font-black text-white">{analysis.oteZone.high?.toFixed(2)}</span>
                            </div>
                        )}
                    </motion.div>

                    {/* Tabela de FVGs Detectados */}
                    {fvgs.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-amber-500/10 p-5">
                            <div className="flex items-center gap-2 mb-4 text-white">
                                <BarChart3 size={16} className="text-amber-400" />
                                <h3 className="text-[11px] font-black uppercase italic tracking-wider">Fair Value Gaps</h3>
                                <span className="ml-auto text-[9px] text-slate-500 font-bold">{fvgs.length} encontrados</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[9px]">
                                    <thead>
                                        <tr className="text-slate-600 font-black uppercase tracking-widest border-b border-white/5">
                                            <th className="p-2 text-left">Tipo</th>
                                            <th className="p-2 text-right">Bottom</th>
                                            <th className="p-2 text-right">Top</th>
                                            <th className="p-2 text-right">Entry 50%</th>
                                            <th className="p-2 text-right">Gap</th>
                                            <th className="p-2 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fvgs.slice(-8).reverse().map((fvg: any, i: number) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                                                <td className="p-2"><span className={`font-black ${fvg.type === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>{fvg.type}</span></td>
                                                <td className="p-2 text-right font-bold text-white">{fvg.bottom?.toFixed(2)}</td>
                                                <td className="p-2 text-right font-bold text-white">{fvg.top?.toFixed(2)}</td>
                                                <td className="p-2 text-right font-bold text-amber-400">{fvg.entry50?.toFixed(2)}</td>
                                                <td className="p-2 text-right font-bold text-slate-400">{fvg.gapSize?.toFixed(2)}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${fvg.mitigated ? 'text-slate-600 bg-slate-800/40' : 'text-emerald-400 bg-emerald-500/10'}`}>
                                                        {fvg.mitigated ? 'Mitigado' : 'Ativo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {/* Ordem Pendentes */}
                    {pendingOrders && pendingOrders.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-amber-500/10 p-5">
                            <div className="flex items-center gap-2 text-white mb-3">
                                <Eye size={16} className="text-amber-400" />
                                <h3 className="text-[11px] font-black uppercase italic tracking-wider">Ordens Pendentes</h3>
                                <span className="ml-auto text-[9px] text-amber-400 font-bold">{pendingOrders.length} ativas</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {pendingOrders.map((t: number) => (
                                    <span key={t} className="px-3 py-1.5 bg-slate-800/40 rounded-xl border border-amber-500/20 text-[10px] font-bold text-amber-300">
                                        #{t}
                                    </span>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Log de Operações — Terminal Estilo */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="bg-black/40 backdrop-blur-xl rounded-[2rem] border border-slate-800 p-5 font-mono shadow-inner">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Activity size={14} className="text-amber-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Terminal de Execução MT5</h3>
                            </div>
                            <button onClick={handleSync} disabled={syncing}
                                className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${syncing ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500/30'}`}>
                                <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} /> SYNC
                            </button>
                        </div>

                        <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {(!operationLog || operationLog.length === 0) ? (
                                <p className="text-center text-slate-700 text-[10px] font-bold py-8 italic">Aguardando dados do MT5...</p>
                            ) : (
                                operationLog.slice().reverse().map((log: any, i: number) => {
                                    const isOrder = log.action === 'ORDER' || log.action === 'ORDER_LIMIT';
                                    const isError = log.action === 'ERROR' || log.action.includes('FAIL');
                                    const isFill = log.action === 'FILL' || log.action === 'FILLED';
                                    const isBE = log.action === 'BE+CUSTOS' || log.action === 'BREAKEVEN';
                                    
                                    return (
                                        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-[9px] ${isError ? 'bg-red-950/20 text-red-400' : isFill ? 'bg-emerald-950/20 text-emerald-400' : isOrder ? 'bg-amber-950/20 text-amber-400' : 'text-slate-400'}`}>
                                            <span className="text-slate-600 font-bold w-14 shrink-0">{log.time}</span>
                                            <span className="font-black w-20 shrink-0 uppercase">{log.action}</span>
                                            <span className="truncate italic">{log.details}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};
