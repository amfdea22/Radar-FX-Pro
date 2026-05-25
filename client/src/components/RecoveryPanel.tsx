import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Zap, Shield, DollarSign, BarChart3, Target, Brain, Cpu, PieChart, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Sigma } from 'lucide-react';
import axios from 'axios';

interface RecoveryStatus {
    settings: {
        enabled: boolean; maxDrawdownPercent: number; maxDailyRecoveryTrades: number;
        baseLotSize: number; maxLotMultiplier: number; recoveryCooldownMinutes: number;
        targetSymbols: string[]; minConfidenceScore: number;
        useMartingale: boolean; martingaleMultiplier: number;
        useAntiMartingale: boolean; antiMartingaleMultiplier: number;
        useKellySizing: boolean; kellyFraction: number;
        volatilityAdjustment: boolean; consecutiveLossThreshold: number;
        preserveModeOnDrawdown: boolean; telegramAlerts: boolean;
    };
    state: {
        active: boolean; currentDrawdown: number; dailyRecoveryTrades: number;
        consecutiveLosses: number; currentTier: number;
        totalRecovered: number; totalLosses: number;
        recoveryAttempts: number; successfulRecoveries: number;
        failedRecoveries: number; inPreservationMode: boolean;
    };
    isRunning: boolean; marginOk: boolean;
    strategyStats: Array<{
        name: string; winRate: number; avgWin: number; avgLoss: number;
        profitFactor: number; totalTrades: number;
        consecutiveLosses: number; maxConsecutiveLosses: number;
        recoveryRecommended: boolean; recoveryLotSize: number;
        recoveryConfidence: number;
    }>;
    performance: { totalAttempts: number; successes: number; failures: number; winRate: number; netResult: number; totalRecovered: number; totalLosses: number; };
}

const RECOVERY_COLORS = {
    tier0: '#22c55e', tier1: '#eab308', tier2: '#f97316',
    tier3: '#ef4444', tier4: '#dc2626',
};

export const RecoveryPanel: React.FC = () => {
    const [status, setStatus] = useState<RecoveryStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedStats, setExpandedStats] = useState(true);
    const [expandedSettings, setExpandedSettings] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/mt5/recovery/status');
            setStatus(res.data);
        } catch { }
    };

    useEffect(() => {
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => clearInterval(iv);
    }, []);

    const toggle = async () => {
        setLoading(true);
        try {
            await axios.post('/api/mt5/recovery/settings', { enabled: !status?.settings?.enabled });
            await fetchStatus();
        } catch { }
        setLoading(false);
    };

    const updateSetting = async (key: string, value: any) => {
        await axios.post('/api/mt5/recovery/settings', { [key]: value });
        await fetchStatus();
    };

    const s = status?.state;
    const perf = status?.performance;
    const stats = status?.strategyStats || [];
    const tierColors = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#dc2626'];
    const tierLabels = ['Normal', 'Leve', 'Médio', 'Alto', 'Crítico'];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <Brain size={44} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">Recovery</span> Engine
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${status?.settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {status?.settings?.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Sigma size={12} className="text-violet-500" /> Recuperação Inteligente — Martingale + Kelly + Volatilidade
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={toggle} disabled={loading}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${status?.settings?.enabled ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20' : 'bg-violet-500/10 border-violet-500/30 text-violet-500 hover:bg-violet-500/20'}`}>
                        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                        {status?.settings?.enabled ? 'Desligar' : 'Ligar'}
                    </button>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Drawdown', value: `${s?.currentDrawdown.toFixed(2) || '0.00'}%`, color: s && s.currentDrawdown > 10 ? 'text-red-400' : s && s.currentDrawdown > 5 ? 'text-amber-400' : 'text-emerald-400', icon: TrendingDown },
                    { label: 'Tier', value: `${tierLabels[s?.currentTier || 0]} (${s?.currentTier || 0})`, color: tierColors[s?.currentTier || 0], icon: Shield, isTier: true },
                    { label: 'Perdas Consec.', value: `${s?.consecutiveLosses || 0}x`, color: (s?.consecutiveLosses || 0) >= 3 ? 'text-red-400' : 'text-slate-300', icon: AlertTriangle },
                    { label: 'Recuperações', value: `${perf?.successes || 0}/${perf?.totalAttempts || 0}`, color: 'text-emerald-400', icon: Target },
                    { label: 'Resultado Líq.', value: `$${(perf?.netResult || 0).toFixed(2)}`, color: (perf?.netResult || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', icon: DollarSign },
                    { label: 'Diário', value: `${s?.dailyRecoveryTrades || 0}/${status?.settings?.maxDailyRecoveryTrades || 5}`, color: 'text-violet-400', icon: Activity },
                ].map((m, i) => (
                    <div key={i} className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4 flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-xl">
                            <m.icon size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                            <p className="text-lg font-black italic" style={m.isTier ? { color: m.color } : {}}>{m.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* PRESERVATION MODE WARNING */}
            {s?.inPreservationMode && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4">
                    <AlertTriangle size={32} className="text-red-400 shrink-0" />
                    <div>
                        <h3 className="text-lg font-black text-red-400 uppercase tracking-tight">MODO PRESERVAÇÃO ATIVADO</h3>
                        <p className="text-sm text-slate-400">Drawdown crítico detectado. Todos os trades de recuperação foram pausados até o drawdown reduzir.</p>
                    </div>
                </motion.div>
            )}

            {/* STRATEGY STATS TABLE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedStats(!expandedStats)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <BarChart3 className="text-violet-400" size={18} /> Estatísticas por Estratégia
                    </h3>
                    {expandedStats ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>
                <AnimatePresence>
                    {expandedStats && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6 overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                            <th className="py-3 pr-4">Estratégia</th>
                                            <th className="py-3 pr-4">Win Rate</th>
                                            <th className="py-3 pr-4">Perdas Cons.</th>
                                            <th className="py-3 pr-4">Max Cons.</th>
                                            <th className="py-3 pr-4">Profit Factor</th>
                                            <th className="py-3 pr-4">Confiança</th>
                                            <th className="py-3 pr-4">Lote Rec.</th>
                                            <th className="py-3 pr-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.length === 0 ? (
                                            <tr><td colSpan={8} className="py-8 text-center text-slate-600 text-sm font-bold">Nenhum dado disponível. Aguardando histórico de trades...</td></tr>
                                        ) : stats.map((st, i) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="py-3 pr-4 font-black text-white text-sm">{st.name}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`font-black ${st.winRate >= 60 ? 'text-emerald-400' : st.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {st.winRate.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`font-black ${st.consecutiveLosses >= 3 ? 'text-red-400' : st.consecutiveLosses >= 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                                                        {st.consecutiveLosses}x
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-slate-400 font-bold">{st.maxConsecutiveLosses}x</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`font-black ${st.profitFactor >= 1.5 ? 'text-emerald-400' : st.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {st.profitFactor === 999 ? '∞' : st.profitFactor.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                                                                style={{ width: `${Math.min(100, st.recoveryConfidence)}%` }} />
                                                        </div>
                                                        <span className="font-black text-xs text-slate-300">{st.recoveryConfidence.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-4 font-black text-violet-400">{st.recoveryLotSize.toFixed(2)}</td>
                                                <td className="py-3 pr-4">
                                                    {st.recoveryRecommended ? (
                                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 animate-pulse">
                                                            PRONTO
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-500/10 text-slate-500">
                                                            AGUARDANDO
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ENGINE PERFORMANCE */}
            {perf && perf.totalAttempts > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <PieChart className="text-violet-400" size={18} /> Desempenho do Motor
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Win Rate Rec.', value: `${perf.winRate.toFixed(1)}%`, color: perf.winRate >= 60 ? 'text-emerald-400' : perf.winRate >= 40 ? 'text-amber-400' : 'text-red-400' },
                            { label: 'Total Recuperado', value: `$${perf.totalRecovered.toFixed(2)}`, color: 'text-emerald-400' },
                            { label: 'Total Perdido', value: `$${perf.totalLosses.toFixed(2)}`, color: 'text-red-400' },
                            { label: 'Resultado Líquido', value: `$${perf.netResult.toFixed(2)}`, color: perf.netResult >= 0 ? 'text-emerald-400' : 'text-red-400' },
                        ].map((m, i) => (
                            <div key={i} className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{m.label}</p>
                                <p className={`text-3xl font-black italic ${m.color}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* DRAWDOWN VISUALIZATION */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Activity className="text-violet-400" size={18} /> Zonas de Drawdown
                </h3>
                <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map(tier => {
                        const limits = ['0-3%', '3-5%', '5-8%', '8-15%', '15%+'];
                        const isActive = s?.currentTier === tier;
                        return (
                            <div key={tier} className={`p-4 rounded-2xl border transition-all ${isActive ? 'bg-violet-500/10 border-violet-500/30' : 'bg-slate-950/40 border-white/5'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tierColors[tier] }} />
                                        <span className="font-black text-white text-sm">Tier {tier} — {tierLabels[tier]}</span>
                                        <span className="text-[10px] font-bold text-slate-500">{limits[tier]}</span>
                                    </div>
                                    {isActive && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-violet-500/20 text-violet-500 border border-violet-500/30 animate-pulse">ATUAL</span>}
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: isActive ? '100%' : '0%', backgroundColor: tierColors[tier], opacity: isActive ? 1 : 0.3 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SETTINGS */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                <button onClick={() => setExpandedSettings(!expandedSettings)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Cpu className="text-violet-400" size={18} /> Configurações Matemáticas
                    </h3>
                    {expandedSettings ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>
                <AnimatePresence>
                    {expandedSettings && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-8 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <SettingSlider label="Limite Drawdown (%)" value={status?.settings?.maxDrawdownPercent || 15} min={3} max={30} step={1} onChange={v => updateSetting('maxDrawdownPercent', v)} />
                                <SettingSlider label="Trades Recup./Dia" value={status?.settings?.maxDailyRecoveryTrades || 5} min={1} max={20} step={1} onChange={v => updateSetting('maxDailyRecoveryTrades', v)} />
                                <SettingSlider label="Lote Base" value={status?.settings?.baseLotSize || 0.01} min={0.01} max={0.1} step={0.01} onChange={v => updateSetting('baseLotSize', v)} />
                                <SettingSlider label="Multiplicador Máx." value={status?.settings?.maxLotMultiplier || 3} min={1} max={10} step={0.5} onChange={v => updateSetting('maxLotMultiplier', v)} />
                                <SettingSlider label="Cooldown (min)" value={status?.settings?.recoveryCooldownMinutes || 30} min={5} max={120} step={5} onChange={v => updateSetting('recoveryCooldownMinutes', v)} />
                                <SettingSlider label="Confiança Mínima (%)" value={status?.settings?.minConfidenceScore || 40} min={10} max={90} step={5} onChange={v => updateSetting('minConfidenceScore', v)} />
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 md:col-span-2 lg:col-span-3">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Símbolos Alvo</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD', 'SP500', 'WTI', 'USDJPY', 'USDCAD', 'AUDUSD'].map(sym => {
                                            const active = status?.settings?.targetSymbols?.includes(sym) || false;
                                            return (
                                                <button key={sym} onClick={() => {
                                                    const current = status?.settings?.targetSymbols || [];
                                                    const next = active ? current.filter((s: string) => s !== sym) : [...current, sym];
                                                    updateSetting('targetSymbols', next);
                                                }}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${active ? 'bg-violet-500/20 text-violet-400 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-slate-800/40 text-slate-500 border-white/5 hover:text-slate-300 hover:border-slate-700'}`}>
                                                    {sym}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <SettingSlider label="Threshold Perdas Cons." value={status?.settings?.consecutiveLossThreshold || 2} min={1} max={5} step={1} onChange={v => updateSetting('consecutiveLossThreshold', v)} />
                                <SettingSlider label="Martingale Multiplier" value={status?.settings?.martingaleMultiplier || 1.6} min={1.1} max={3} step={0.1} onChange={v => updateSetting('martingaleMultiplier', v)} />
                                <SettingSlider label="Anti-Martingale" value={status?.settings?.antiMartingaleMultiplier || 1.3} min={1} max={2.5} step={0.1} onChange={v => updateSetting('antiMartingaleMultiplier', v)} />
                                <SettingSlider label="Kelly Fraction" value={status?.settings?.kellyFraction || 0.25} min={0.1} max={1} step={0.05} onChange={v => updateSetting('kellyFraction', v)} />
                                <SettingToggle label="Martingale" value={status?.settings?.useMartingale || false} onChange={v => updateSetting('useMartingale', v)} />
                                <SettingToggle label="Anti-Martingale" value={status?.settings?.useAntiMartingale || false} onChange={v => updateSetting('useAntiMartingale', v)} />
                                <SettingToggle label="Kelly Sizing" value={status?.settings?.useKellySizing || false} onChange={v => updateSetting('useKellySizing', v)} />
                                <SettingToggle label="Ajuste Volatilidade" value={status?.settings?.volatilityAdjustment || false} onChange={v => updateSetting('volatilityAdjustment', v)} />
                                <SettingToggle label="Modo Preservação" value={status?.settings?.preserveModeOnDrawdown || false} onChange={v => updateSetting('preserveModeOnDrawdown', v)} />
                                <SettingToggle label="Alertas Telegram" value={status?.settings?.telegramAlerts || false} onChange={v => updateSetting('telegramAlerts', v)} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const SettingSlider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className="text-sm font-black text-violet-400">{value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg" />
    </div>
);

const SettingToggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        <button onClick={() => onChange(!value)}
            className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-violet-500' : 'bg-slate-700'}`}>
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-md ${value ? 'left-6' : 'left-0.5'}`} />
        </button>
    </div>
);
