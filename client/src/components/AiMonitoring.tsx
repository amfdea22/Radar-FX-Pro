import React, { useState, useEffect } from 'react';
import {
    Cpu, Brain, Activity, TrendingUp, TrendingDown, Target,
    Zap, Shield, BarChart2, AlertTriangle, Clock, Layers,
    PieChart, Radio, ArrowUp, ArrowDown, Minus, Eye, Server
} from 'lucide-react';
import axios from 'axios';

interface AiStatus {
    gold?: any;
    crypto?: any;
    swing?: any;
    omni?: any;
    supreme?: any;
    robot?: any;
    analytics?: any;
    discipline?: any;
}

const NEURO_COLORS = {
    low: '#EF4444',
    mid: '#F59E0B',
    high: '#10B981',
    elite: '#3B82F6'
};

const getColorScale = (val: number, thresholds: number[]) => {
    if (val >= thresholds[2]) return NEURO_COLORS.elite;
    if (val >= thresholds[1]) return NEURO_COLORS.high;
    if (val >= thresholds[0]) return NEURO_COLORS.mid;
    return NEURO_COLORS.low;
};

const StatusBadge: React.FC<{ active?: boolean; label?: string }> = ({ active, label }) => (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-600 border border-slate-700'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        {label || (active ? 'Ativo' : 'Inativo')}
    </span>
);

const GaugeBar: React.FC<{ value: number; label: string; max?: number; color?: string; suffix?: string }> = ({ value, label, max = 100, color, suffix = '' }) => {
    const safeMax = Math.max(max, 1);
    const pct = Math.min(100, Math.max(2, (value / safeMax) * 100));
    const barColor = color || getColorScale(value, [40, 70, 90]);
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                <span className="text-xs font-black font-mono" style={{ color: barColor }}>{value}{suffix}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}40` }} />
            </div>
        </div>
    );
};

const NeuroGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 100 }) => {
    const r = 40;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = getColorScale(score, [40, 70, 90]);
    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
            </svg>
            <span className="absolute text-2xl font-black font-mono" style={{ color }}>{score}</span>
        </div>
    );
};

export const AiMonitoring: React.FC = () => {
    const [data, setData] = useState<AiStatus>({});
    const [loading, setLoading] = useState(true);
    const [hoveredLog, setHoveredLog] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const resp = await axios.get('/api/mt5/ai-monitoring');
            setData(resp.data);
            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); }, []);

    if (loading && !data.gold) {
        return (
            <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">Carregando monitoramento IA...</span>
                </div>
            </div>
        );
    }

    const g = data.gold || {};
    const s = g.settings || {};
    const dp = g.decisionPillars || {};
    const pred = g.predictions || {};
    const iaLearn = g.iaLearning || {};
    const dd = g.drawdownHeatmap || {};
    const sc = data.supreme || {};
    const rc = data.robot || {};
    const dc = data.discipline || {};
    const an = data.analytics || {};
    const aiInsights: string[] = an?.aiInsights || [];

    const engines = [
        { id: 'gold', name: 'Gold Scalper', icon: Target, active: s.enabled, data: g, color: '#F59E0B' },
        { id: 'crypto', name: 'Crypto IA', icon: Brain, active: data.crypto?.settings?.enabled, data: data.crypto, color: '#8B5CF6' },
        { id: 'swing', name: 'Swing Trader', icon: TrendingUp, active: data.swing?.settings?.enabled, data: data.swing, color: '#06B6D4' },
        { id: 'omni', name: 'Omni Prob.', icon: Layers, active: data.omni?.settings?.enabled, data: data.omni, color: '#EC4899' },
        { id: 'supreme', name: 'Supreme AI', icon: Cpu, active: sc.status === 'ACTIVE', data: sc, color: '#10B981' },
        { id: 'robot', name: 'Alpha Robot', icon: Radio, active: data.robot?.enabled, data: rc, color: '#6366F1' },
    ];

    const logs: any[] = g.operationLog ? [...g.operationLog].filter((l: any) => l.action?.startsWith('IA_') || l.action === 'WARN' || l.action === 'NEURO') : [];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-fuchsia-500/20 shadow-[0_0_50px_rgba(217,70,239,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-fuchsia-500/10 rounded-3xl border border-fuchsia-500/20 shadow-xl shadow-fuchsia-500/10">
                        <Cpu size={40} className="text-fuchsia-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600">Monitoramento</span>
                            IA
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                                AO VIVO
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Brain size={12} className="text-fuchsia-400" /> Métricas em tempo real dos softwares e modelos de IA
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                    <Server size={14} className="text-fuchsia-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Live</span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
            </div>

            {/* MODEL STATUS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {engines.map(eng => {
                    const Icon = eng.icon;
                    const extra = eng.id === 'supreme' ? `${sc.confluencePower || 0}%` : eng.id === 'robot' ? `${rc.stats?.totalTrades || 0}t` : '';
                    return (
                        <div key={eng.id} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-fuchsia-500/20 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${eng.color}20` }}>
                                        <Icon size={16} style={{ color: eng.color }} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{eng.name}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <StatusBadge active={eng.active} />
                                {extra && <span className="text-xs font-black font-mono text-slate-500">{extra}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ROW: NEURO SCORE + CORTEX + PILLARS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Neuro Score */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <Brain size={16} className="text-fuchsia-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Neuro Score</span>
                        <span className="text-[10px] text-slate-700 font-mono ml-auto">
                            {iaLearn.totalAnalyzed || 0} trades analisados
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <NeuroGauge score={g.iaScore || 0} />
                        <div className="flex-1 space-y-3">
                            <div className="text-xs text-slate-500 font-bold">Threshold IA: <span className="text-white font-mono">{iaLearn.minScore || 60}%</span></div>
                            <div className="text-xs text-slate-500 font-bold">Última Otimização: <span className="text-white font-mono">{iaLearn.lastOptimized ? new Date(iaLearn.lastOptimized).toLocaleString('pt-BR') : '--'}</span></div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500 font-bold">Score:</span>
                                <span className="font-black font-mono" style={{ color: getColorScale(g.iaScore || 0, [40, 70, 90]) }}>
                                    {g.iaScore || 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cortex */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <Activity size={16} className="text-cyan-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Córtex & Estado</span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">Humor do Córtex</span>
                            <span className={`text-sm font-black px-3 py-1 rounded-lg ${g.cortexHumor === 'PROTEÇÃO' ? 'bg-red-500/20 text-red-400' : g.cortexHumor === 'CAUTELOSO' ? 'bg-amber-500/20 text-amber-400' : g.cortexHumor === 'AGRESSIVO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {g.cortexHumor || 'ANALÍTICO'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">Micro Tendência</span>
                            <span className={`flex items-center gap-1 text-sm font-black ${g.microTrend === 'UP' ? 'text-emerald-400' : g.microTrend === 'DOWN' ? 'text-red-400' : 'text-slate-500'}`}>
                                {g.microTrend === 'UP' ? <ArrowUp size={14} /> : g.microTrend === 'DOWN' ? <ArrowDown size={14} /> : <Minus size={14} />}
                                {g.microTrend || 'FLAT'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">Cooling Off</span>
                            <StatusBadge active={g.isCoolingOff} label={g.isCoolingOff ? 'Ativo' : 'Normal'} />
                        </div>
                        {g.isCoolingOff && g.coolOffRemainingMs > 0 && (
                            <div className="text-xs text-amber-500 font-bold text-center">
                                Restam {(g.coolOffRemainingMs / 60000).toFixed(0)} min
                            </div>
                        )}
                    </div>
                </div>

                {/* Decision Pillars */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Pilares de Decisão</span>
                    </div>
                    <div className="space-y-3">
                        <GaugeBar value={dp.trend || 0} label="Tendência" color="#3B82F6" suffix="%" />
                        <GaugeBar value={dp.dxy || 0} label="DXY" color="#8B5CF6" suffix="%" />
                        <GaugeBar value={dp.rsi || 0} label="RSI" color="#F59E0B" suffix="%" />
                        <GaugeBar value={dp.volume || 0} label="Volume" color="#10B981" suffix="%" />
                    </div>
                </div>
            </div>

            {/* ROW: PREDICTIONS + SENTIMENT + DRAWDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Predictions */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <Eye size={16} className="text-amber-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Predições da IA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { tf: '1M', data: pred.m1 },
                            { tf: '5M', data: pred.m5 },
                            { tf: '15M', data: pred.m15 },
                            { tf: '1H', data: pred.h1 }
                        ].map(p => {
                            const dir = p.data?.direction;
                            const conf = p.data?.confidence || 0;
                            const isUp = dir === 'UP';
                            const isDown = dir === 'DOWN';
                            return (
                                <div key={p.tf} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 text-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Timeframe {p.tf}</span>
                                    <div className={`my-3 flex items-center justify-center ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
                                        {isUp ? <ArrowUp size={28} /> : isDown ? <ArrowDown size={28} /> : <Minus size={28} />}
                                    </div>
                                    <span className={`text-sm font-black block ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
                                        {dir || 'FLAT'}
                                    </span>
                                    {conf > 0 && (
                                        <div className="mt-2">
                                            <GaugeBar value={conf} label="Confiança" max={100} suffix="%" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Market Sentiment */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <Activity size={16} className="text-rose-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Sentimento de Mercado</span>
                    </div>
                    <div className="space-y-3">
                        <GaugeBar value={g.sentiment?.long || 50} label="Long Bias" color="#10B981" suffix="%" max={100} />
                        <GaugeBar value={g.sentiment?.short || 50} label="Short Bias" color="#EF4444" suffix="%" max={100} />
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 mt-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Macro Sentimento</span>
                            <span className={`text-xs font-black ${sc.macroSentiment?.status?.includes('Bullish') ? 'text-emerald-400' : 'text-red-400'}`}>
                                {sc.macroSentiment?.status || 'NEUTRO'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Risk & Divergence */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={16} className="text-orange-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Risco & Divergência</span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">Drawdown</span>
                            <span className={`text-sm font-black font-mono ${dd.status === 'CRÍTICO' ? 'text-red-400' : dd.status === 'ALERTA' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {dd.percent || 0}%
                            </span>
                        </div>
                        <GaugeBar value={dd.percent || 0} label="DD% vs Max Loss" max={100} color={dd.status === 'CRÍTICO' ? '#EF4444' : dd.status === 'ALERTA' ? '#F59E0B' : '#10B981'} suffix="%" />
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">XAU-DXY</span>
                            <span className={`text-xs font-black ${g.dxyDivergence?.status === 'CRÍTICA' ? 'text-red-400' : g.dxyDivergence?.status === 'SAUDÁVEL' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {g.dxyDivergence?.status || 'NORMAL'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW: DISCIPLINE + OMNI RANKING + ENGINES STATS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Discipline */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-emerald-400" />
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Disciplina</span>
                        </div>
                        <StatusBadge active={!dc.isLocked} label={dc.isLocked ? 'Bloqueado' : 'Liberado'} />
                    </div>
                    <div className="space-y-3">
                        <GaugeBar value={dc.tradeCount || 0} label="Trades Hoje" max={dc.limits?.maxTradesPerDay || 10} color="#3B82F6" />
                        <GaugeBar value={dc.consecutiveLosses || 0} label="Perdas Consecutivas" max={dc.limits?.maxConsecutiveLosses || 3} color="#EF4444" />
                        <GaugeBar value={Math.abs(dc.profit || 0)} label="P&L Hoje" max={Math.max(Math.abs(dc.profit || 0), dc.profit >= 0 ? dc.limits?.dailyTakeProfit || 50 : dc.limits?.dailyStopLoss || 30)} color={(dc.profit || 0) >= 0 ? '#10B981' : '#EF4444'} suffix={(dc.profit || 0) >= 0 ? ' lucro' : ' perda'} />
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <span className="text-xs font-bold text-slate-400">Stop / Meta</span>
                            <span className="text-xs font-black font-mono text-slate-300">
                                -${dc.limits?.dailyStopLoss || 30} / +${dc.limits?.dailyTakeProfit || 50}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/10">
                            <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">Gold Scalper</span>
                            <span className="text-xs font-black font-mono text-amber-300">{g.report?.totalTrades || 0} trades  |  {g.report?.winRate || 0}% WR</span>
                        </div>
                        {dc.reason && dc.isLocked && (
                            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                <span className="text-[10px] font-bold text-red-400">{dc.reason}</span>
                            </div>
                        )}
                        {dc.history && (
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Histórico</span>
                                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                                    {[
                                        { key: 'Hoje', data: dc.history.today },
                                        { key: '3D', data: dc.history.d3 },
                                        { key: 'Semana', data: dc.history.w1 },
                                        { key: 'Mês', data: dc.history.m1 },
                                    ].map(h => (
                                        <div key={h.key} className="p-1.5 bg-slate-800/30 rounded-lg text-center">
                                            <span className="text-slate-500 block text-[9px]">{h.key}</span>
                                            <span className={(h.data?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>${(h.data?.profit || 0).toFixed(2)}</span>
                                            <div className="text-slate-600 text-[8px]">{h.data?.tradeCount || 0}t / {h.data?.winRate || 0}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {dc.pulse && (
                            <div className="flex items-center gap-2 text-[10px] font-mono">
                                <span className={`px-1.5 py-0.5 rounded ${dc.pulse.guardian?.isSafe ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>Guardião</span>
                                <span className={`px-1.5 py-0.5 rounded ${dc.pulse.signals?.isSafe ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>Sinais</span>
                                <span className={`px-1.5 py-0.5 rounded ${dc.pulse.intelligence?.isSafe ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>IA</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Omni Ranking */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <Layers size={16} className="text-pink-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Ranking Omni</span>
                    </div>
                    <div className="space-y-1.5">
                        {(data.omni?.ranking || []).slice(0, 6).map((r: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-400' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-800 text-slate-600'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-300">{r.name || r.strategy}</span>
                                </div>
                                <span className="text-[10px] font-black font-mono text-slate-500">{r.winRate || 0}%</span>
                            </div>
                        ))}
                        {(!data.omni?.ranking || data.omni.ranking.length === 0) && (
                            <div className="text-xs text-slate-600 text-center py-4">Nenhum dado disponível</div>
                        )}
                    </div>
                    {data.omni?.telemetry && (
                        <div className="mt-3 text-[10px] text-slate-600 font-mono text-center">{data.omni.telemetry.robotVersion || data.omni.telemetry.actionMsg || JSON.stringify(data.omni.telemetry)}</div>
                    )}
                </div>

                {/* Engines Stats */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart2 size={16} className="text-blue-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Performance dos Motores</span>
                    </div>
                    <div className="space-y-2">
                        {[
                            { name: 'Gold Scalper', winRate: g.report?.winRate, trades: g.report?.totalTrades, profit: g.report?.totalProfit },
                            { name: 'Supreme AI', winRate: sc.performance?.winRate, trades: sc.performance?.totalTrades, profit: sc.performance?.totalProfit },
                            { name: 'Alpha Robot', winRate: rc.totalWins ? Math.round(rc.totalWins / ((rc.totalWins || 0) + (rc.totalLosses || 0)) * 100) : 0, trades: (rc.totalWins || 0) + (rc.totalLosses || 0), profit: rc.totalProfitAllTime || 0 },
                        ].filter(e => e.winRate != null || e.trades).map((eng, i) => (
                            <div key={i} className="p-2.5 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{eng.name}</span>
                                    <span className={`text-xs font-black font-mono ${(eng.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        ${(eng.profit || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-mono">
                                    <span className="text-slate-600">{eng.trades || 0} trades</span>
                                    <span className="text-slate-600">|</span>
                                    <span className={eng.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{eng.winRate || 0}% WR</span>
                                </div>
                            </div>
                        ))}
                        {(!g.report && !rc.stats && !sc.performance) && (
                            <div className="text-xs text-slate-600 text-center py-4">Aguardando dados...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI INSIGHTS */}
            {aiInsights.length > 0 && (
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-3">
                        <Brain size={16} className="text-fuchsia-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Insights da IA</span>
                    </div>
                    <div className="space-y-2">
                        {aiInsights.map((insight: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-fuchsia-400 mt-0.5">◆</span>
                                <span>{insight}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI OPERATION LOG */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-fuchsia-400" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Log de Eventos IA</span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {logs.length === 0 && g.operationLog?.length > 0 ? (
                        (g.operationLog || []).slice(0, 30).map((log: any, i: number) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-xs transition-colors ${hoveredLog === `${i}` ? 'bg-white/5' : 'bg-slate-800/20'}`}
                                onMouseEnter={() => setHoveredLog(`${i}`)} onMouseLeave={() => setHoveredLog(null)}>
                                <span className="text-[10px] font-mono text-slate-600 w-16 shrink-0">{log.time}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${log.action === 'IA_GUARD' ? 'bg-violet-500/20 text-violet-400' : log.action === 'IA_LEARNING' ? 'bg-blue-500/20 text-blue-400' : log.action === 'WARN' ? 'bg-amber-500/20 text-amber-400' : log.action === 'NEURO' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                    {log.action}
                                </span>
                                <span className="text-slate-400 flex-1 truncate">{log.details}</span>
                            </div>
                        ))
                    ) : (
                        logs.slice(0, 30).map((log: any, i: number) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-xs transition-colors ${hoveredLog === `l_${i}` ? 'bg-white/5' : 'bg-slate-800/20'}`}
                                onMouseEnter={() => setHoveredLog(`l_${i}`)} onMouseLeave={() => setHoveredLog(null)}>
                                <span className="text-[10px] font-mono text-slate-600 w-16 shrink-0">{log.time}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${log.action === 'IA_GUARD' ? 'bg-violet-500/20 text-violet-400' : log.action === 'IA_LEARNING' ? 'bg-blue-500/20 text-blue-400' : log.action === 'WARN' ? 'bg-amber-500/20 text-amber-400' : log.action === 'NEURO' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                    {log.action}
                                </span>
                                <span className="text-slate-400 flex-1 truncate">{log.details}</span>
                            </div>
                        ))
                    )}
                    {(!g.operationLog || g.operationLog.length === 0) && (
                        <div className="text-xs text-slate-600 text-center py-6">Nenhum evento IA registrado</div>
                    )}
                </div>
            </div>

        </div>
    );
};
