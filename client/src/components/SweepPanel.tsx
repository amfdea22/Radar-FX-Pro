import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    TrendingUp, TrendingDown, RefreshCw, Settings, AlertTriangle, CheckCircle,
    BarChart3, Zap, Activity, DollarSign, Clock, Target, ChevronDown, ChevronUp,
    Power, ArrowUpDown, Percent, Flame, Wallet, Cpu, Crosshair, Printer, ShieldAlert, Plus, Minus
} from 'lucide-react';
import SweepTradeMonitor from './SweepTradeMonitor';

interface SweepStatus {
    settings: any;
    swingHighs: Record<string, any[]>;
    swingLows: Record<string, any[]>;
    positions: any[];
    dailyProfit: number;
    dailyLoss: number;
    totalTrades: number;
    wins: number;
    losses: number;
    totalProfitClosed: number;
    isExecuting: boolean;
    tradeHistory: any[];
    signalHistory: any[];
    logs: any[];
    uptime: number;
}

const ActionBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
        INFO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        TRADE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        WARN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        SIGNAL: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${colors[type] || colors.INFO}`}>
            {type}
        </span>
    );
};

const ScoreGauge = ({ score }: { score: number }) => {
    const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-amber-400' : 'bg-rose-400';
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[9px] font-black text-slate-400">{score}</span>
        </div>
    );
};

const InfoTooltip = ({ label, value, tooltip, className = '' }: { label: string; value: React.ReactNode; tooltip: string; className?: string }) => (
    <div className={`group relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-800/60 border-white/5 hover:border-amber-500/20 transition-all cursor-help">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-bold text-white">{value}</span>
        </div>
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 p-3 bg-slate-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
            <p className="text-[10px] text-slate-400 leading-relaxed">{tooltip}</p>
        </div>
    </div>
);

const CollapsibleSection = ({ title, icon: Icon, accent = 'from-amber-500/10 to-transparent', defaultOpen = true, children, badge }: {
    title: string; icon: React.ElementType; accent?: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string | number;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 bg-gradient-to-br ${accent} rounded-xl border border-white/5`}>
                        {Icon && <Icon size={16} className="text-amber-400" />}
                    </div>
                    <h3 className="text-white text-xs font-black uppercase tracking-wider">{title}</h3>
                    {badge !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[9px] font-bold text-slate-400">{badge}</span>
                    )}
                </div>
                {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ maxHeight: 0, opacity: 0 }}
                        animate={{ maxHeight: 20000, opacity: 1 }}
                        exit={{ maxHeight: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 lg:p-5 pt-0">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const KPICard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) => (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-all h-full">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <Icon size={14} className={color} />
        </div>
        <div className={`text-2xl font-black italic ${color}`}>{value}</div>
    </div>
);

export const SweepPanel = () => {
    const [status, setStatus] = useState<SweepStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [localSettings, setLocalSettings] = useState<any>(null);
    const [tradeMonitorCollapsed, setTradeMonitorCollapsed] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/sweep/status');
            setStatus(res.data);
            if (!localSettings) setLocalSettings(res.data.settings);
            setError(null);
        } catch (err) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Erro ao buscar status';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const updateSettings = async (newSettings: any) => {
        try {
            await axios.post('/api/mt5/sweep/settings', newSettings);
            fetchStatus();
        } catch (err) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Erro ao atualizar';
        }
    };

    const toggleEnabled = () => updateSettings({ enabled: !status?.settings?.enabled });

    const handleSettingChange = (key: string, value: any) => {
        const updated = { ...localSettings, [key]: value };
        setLocalSettings(updated);
        updateSettings({ [key]: value });
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    if (loading) return (
        <div className="p-10 text-center text-slate-500 animate-pulse text-xs font-black uppercase tracking-widest">
            Sincronizando Sweep H4 M15...
        </div>
    );

    const s = status;
    const settings = localSettings || s?.settings || {};
    const winRate = s && (s.wins + s.losses) > 0 ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(1) : '--';
    const positions = s?.positions ?? [];
    const signalHistory = s?.signalHistory ?? [];
    const tradeHistory = s?.tradeHistory ?? [];
    const logs = s?.logs ?? [];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {error && (
                <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 backdrop-blur-xl text-rose-400 text-[10px] font-bold uppercase flex items-center gap-2">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            {/* Header Banner */}
            <div className="relative p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                            <Zap size={24} className="text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                                Sweep{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                                    H4 M15
                                </span>
                            </h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${s?.settings?.enabled
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                    }`}>
                                    {s?.settings?.enabled ? 'Online' : 'Offline'}
                                </span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Zap size={10} /> {s?.uptime ? formatTime(s.uptime) : '--'} uptime
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 px-4 py-2 bg-black/40 rounded-2xl border border-white/5">
                            <span className={`text-[8px] font-black tracking-[0.2em] uppercase ${s?.settings?.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                                {s?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                            <button
                                onClick={toggleEnabled}
                                className={`relative w-12 h-6 flex items-center rounded-full transition-all duration-500 px-1 ${s?.settings?.enabled
                                    ? 'bg-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                    : 'bg-slate-800'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-500 ${s?.settings?.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <button onClick={fetchStatus} className="p-2 bg-slate-950 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-all active:scale-95">
                            <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="relative bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <KPICard label="Win Rate" value={winRate !== '--' ? `${winRate}%` : '--'} icon={Percent} color={winRate !== '--' && parseFloat(winRate) >= 50 ? 'text-emerald-400' : 'text-rose-400'} />
                    <KPICard label="Total Trades" value={s?.totalTrades ?? 0} icon={BarChart3} color="text-amber-400" />
                    <KPICard label="Wins" value={s?.wins ?? 0} icon={TrendingUp} color="text-emerald-400" />
                    <KPICard label="Losses" value={s?.losses ?? 0} icon={TrendingDown} color="text-rose-400" />
                    <KPICard label="P&L Fechado" value={`${(s?.totalProfitClosed ?? 0) >= 0 ? '+' : ''}${(s?.totalProfitClosed ?? 0).toFixed(2)}`} icon={Wallet} color={(s?.totalProfitClosed ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                    <KPICard label="Daily P&L" value={`${((s?.dailyProfit ?? 0) - (s?.dailyLoss ?? 0)) >= 0 ? '+' : ''}${((s?.dailyProfit ?? 0) - (s?.dailyLoss ?? 0)).toFixed(2)}`} icon={Activity} color={((s?.dailyProfit ?? 0) - (s?.dailyLoss ?? 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                    <KPICard label="Abertas" value={positions.length} icon={Crosshair} color="text-amber-400" />
                    {s?.isExecuting && (
                        <div className="col-span-full flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl animate-pulse">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                Executando trade...
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* SWEEP MONITOR - Trade Monitor ao Vivo */}
            <div className="p-6 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.1)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20">
                            <Activity size={18} className="text-sky-500" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-500">Trade Monitor</span> ao Vivo
                        </h3>
                    </div>
                    <button
                        onClick={() => setTradeMonitorCollapsed(!tradeMonitorCollapsed)}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        {tradeMonitorCollapsed ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                </div>
                {!tradeMonitorCollapsed && <SweepTradeMonitor embedded />}
            </div>

            {/* Settings */}
            <CollapsibleSection title="Configurações" icon={Settings} defaultOpen={false} accent="from-amber-500/10 to-transparent">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Parâmetros de Entrada</div>
                        {[
                            { key: 'lotSize', label: 'Lote Fixo', type: 'number', step: 0.01, min: 0.01, max: 10, icon: Target },
                            { key: 'riskUSD', label: 'Risk USD', type: 'number', step: 1, min: 0, icon: DollarSign },
                            { key: 'minSwingDistance', label: 'Min Swing Distância', type: 'number', step: 0.01, min: 0.01, icon: ArrowUpDown },
                            { key: 'atrSlMultiplier', label: 'SL Multiplier (ATR)', type: 'number', step: 0.1, min: 0.5, max: 5, icon: ShieldAlert },
                            { key: 'atrTpMultiplier', label: 'TP Multiplier (ATR)', type: 'number', step: 0.1, min: 0.5, max: 10, icon: Target },
                        ].map(field => (
                            <div key={field.key} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <field.icon size={12} className="text-amber-400/70" />
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                                </div>
                                <input
                                    type={field.type}
                                    step={field.step}
                                    min={field.min}
                                    max={field.max}
                                    value={settings[field.key] ?? ''}
                                    onChange={e => handleSettingChange(field.key, parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-black text-center focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="space-y-3">
                         <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Limites & Controles</div>
                         {[
                             { key: 'maxDailyLoss', label: 'Max Daily Loss', type: 'number', step: 5, min: 0, icon: Flame },
                             { key: 'maxDailyProfit', label: 'Max Daily Profit', type: 'number', step: 5, min: 0, icon: TrendingUp },
                             { key: 'cooldownMinutes', label: 'Cooldown (min)', type: 'number', step: 1, min: 1, max: 120, icon: Clock },
                         ].map(field => (
                             <div key={field.key} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                 <div className="flex items-center gap-2">
                                     <field.icon size={12} className="text-amber-400/70" />
                                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                                 </div>
                                 <input
                                     type={field.type}
                                     step={field.step}
                                     min={field.min}
                                     max={field.max}
                                     value={settings[field.key] ?? ''}
                                     onChange={e => handleSettingChange(field.key, parseFloat(e.target.value) || 0)}
                                     className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-black text-center focus:outline-none focus:border-amber-500/50 transition-colors"
                                 />
                             </div>
                         ))}
                         <div className="space-y-2 pt-2">
                             <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 group">
                                 <div className="flex items-center gap-2">
                                     <Zap size={12} className="text-amber-400/70" />
                                     <div className="flex flex-col">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trailing Progressivo</label>
                                         <span className="text-[8px] text-slate-600 italic">Estica o lucro conforme o trade avança</span>
                                     </div>
                                 </div>
                                 <button
                                     onClick={() => handleSettingChange('useProgressiveTrailing', !settings.useProgressiveTrailing)}
                                     className={`relative w-10 h-5 flex items-center rounded-full transition-all duration-500 px-1 ${settings.useProgressiveTrailing ? 'bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-slate-800'}`}
                                 >
                                     <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-500 ${settings.useProgressiveTrailing ? 'translate-x-5' : 'translate-x-0'}`} />
                                 </button>
                             </div>
                              <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 group">
                                  <div className="flex items-center gap-2">
                                      <ShieldAlert size={12} className="text-rose-400/70" />
                                      <div className="flex flex-col">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trailing de Reversão</label>
                                          <span className="text-[8px] text-slate-600 italic">Reversão automática em movimentos fortes</span>
                                      </div>
                                  </div>
                                  <button
                                      onClick={() => handleSettingChange('useFastReversal', !settings.useFastReversal)}
                                      className={`relative w-10 h-5 flex items-center rounded-full transition-all duration-500 px-1 ${settings.useFastReversal ? 'bg-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-slate-800'}`}
                                  >
                                      <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-500 ${settings.useFastReversal ? 'translate-x-5' : 'translate-x-0'}`} />
                                  </button>
                              </div>
                         </div>
                         <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl border border-amber-500/30">
                            <div className="flex items-center gap-2">
                                <Activity size={12} className="text-amber-400" />
                                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Símbolos</label>
                            </div>
                            <input
                                type="text"
                                value={Array.isArray(settings.symbols) ? settings.symbols.join(', ') : ''}
                                onChange={e => handleSettingChange('symbols', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                                className="w-40 bg-slate-900 border border-amber-500/30 rounded-lg px-3 py-1.5 text-white text-[10px] font-mono text-right focus:outline-none focus:border-amber-500/50 transition-colors"
                                placeholder="XAUUSD, BTCUSD"
                            />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Swing Points & Sinais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CollapsibleSection title="Swing Points (H4)" icon={Crosshair} defaultOpen={false} accent="from-violet-500/10 to-transparent"
                    badge={Object.keys(s?.swingHighs || {}).length > 0 ? Object.values(s?.swingHighs || {}).reduce((a: number, b: any[]) => a + b.length, 0).toString() : '0'}>
                    {s?.swingHighs && Object.keys(s.swingHighs).length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(s.swingHighs).map(([symbol, highs]) => (
                                <div key={symbol} className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 font-bold">{symbol}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {(highs as any[]).slice(-8).map((h: any, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-mono font-bold">
                                                {h.price.toFixed(2)}
                                            </span>
                                        ))}
                                    </div>
                                    {(s?.swingLows?.[symbol] ?? []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(s.swingLows[symbol] as any[]).slice(-8).map((l: any, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded text-[9px] font-mono font-bold">
                                                    {l.price.toFixed(2)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-600 text-[11px] italic">Nenhum swing point detectado</p>
                    )}
                </CollapsibleSection>

                <CollapsibleSection title="Sinais Recentes" icon={Zap} defaultOpen={true} accent="from-emerald-500/10 to-transparent"
                    badge={signalHistory.length.toString()}>
                    {signalHistory.length > 0 ? (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                            {signalHistory.map((sig: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-slate-950/30 rounded-xl px-3 py-2 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${sig.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {sig.direction}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">{sig.symbol}</span>
                                        <ScoreGauge score={sig.score} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {sig.executed ? (
                                            <span className="text-[8px] text-emerald-500 flex items-center gap-1 font-black uppercase tracking-wider">
                                                <CheckCircle size={10} /> Executado
                                            </span>
                                        ) : (
                                            <span className="text-[8px] text-amber-500 font-black uppercase tracking-wider">Não executado</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-600 text-[11px] italic">Nenhum sinal gerado</p>
                    )}
                </CollapsibleSection>
            </div>

            {/* Histórico de Trades */}
            <CollapsibleSection title="Histórico de Trades" icon={BarChart3} defaultOpen={false} accent="from-blue-500/10 to-transparent"
                badge={tradeHistory.length.toString()}>
                {tradeHistory.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="text-[8px] text-slate-500 uppercase tracking-widest font-black border-b border-white/5">
                                    <th className="text-left py-2 pr-4">Par</th>
                                    <th className="text-left py-2 pr-4">Direção</th>
                                    <th className="text-left py-2 pr-4">Entrada</th>
                                    <th className="text-right py-2">P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tradeHistory.map((t: any, i: number) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-2 pr-4 text-slate-300 font-bold">{t.symbol}</td>
                                        <td className="py-2 pr-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${t.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {t.direction}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-slate-400 font-mono">{t.entry}</td>
                                        <td className={`py-2 text-right font-black font-mono ${t.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {t.profit >= 0 ? '+' : ''}{t.profit?.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-600 text-[11px] italic">Nenhum trade registrado</p>
                )}
            </CollapsibleSection>

            {/* Terminal de Monitoramento */}
            <CollapsibleSection title="Terminal de Logs" icon={Printer} defaultOpen={false} accent="from-emerald-500/10 to-transparent"
                badge={logs.length.toString()}>
                <div className="relative overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent pointer-events-none" />
                    <div className="bg-slate-950/90 backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_0_40px_rgba(0,255,100,0.05)]">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-500/10">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="text-[8px] text-emerald-500/50 font-mono tracking-[0.2em] ml-2">sweep_terminal.log</span>
                            <span className="text-[8px] text-emerald-500/30 font-mono ml-auto">-- INSERT --</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-4 font-mono text-[11px] space-y-0.5 custom-scrollbar-terminal" style={{
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,255,100,0.02) 20px, rgba(0,255,100,0.02) 21px)'
                        }}>
                            {logs.length > 0 ? (
                                logs.map((log: any, i: number) => {
                                    const colors: Record<string, string> = {
                                        INFO: 'text-slate-500',
                                        TRADE: 'text-emerald-400',
                                        WARN: 'text-amber-400',
                                        SIGNAL: 'text-violet-400',
                                    };
                                    return (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                            <ActionBadge type={log.type} />
                                            <span className={colors[log.type] || 'text-slate-500'}>{log.msg}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400/50">$</span>
                                    <span className="text-slate-600 animate-pulse">Waiting for sweep signals...</span>
                                    <span className="w-2 h-4 bg-emerald-400/70 animate-pulse" />
                                </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-emerald-400/50">$</span>
                                <span className="w-2 h-4 bg-emerald-400/70 animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};