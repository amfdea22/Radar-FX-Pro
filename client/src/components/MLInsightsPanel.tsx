import React, { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Target, Shield, BarChart3, Crosshair, Cpu, BrainCircuit, Zap, DollarSign, Percent, RefreshCw, CircleDot, Radio, ChevronDown, AlertTriangle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeframeSignal {
    timeframe: string; trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; ema: number; rsi: number;
}
interface SupportResistance { support: number; resistance: number; }
interface InstitutionalData { power: number; type: string; bias: string; confidence: number; }
interface SymbolPrediction {
    symbol: string; direction: 'UP' | 'DOWN' | 'NEUTRAL'; confidence: number;
    entryPrice: number; targetPrice: number; stopPrice: number;
    rewardRisk: number; signalStrength: 'ALTA' | 'MODERADA' | 'FRACA';
    error?: string; horizon: string; timeframes: TimeframeSignal[];
    supportResistance: SupportResistance; institutional: InstitutionalData | null;
    factors: { name: string; impact: number }[];
}
interface MarketRegime { regime: string; volatility: number; strength: number; probability: number; description: string; }
interface RiskMetrics { sharpe: number; sortino: number; calmar: number; var95: number; cvar95: number; maxDrawdown: number; expectancy: number; profitFactor: number; }
interface MonteCarlo { iterations: number; expectedProfit: number; confidence95: [number, number]; ruinProbability: number; medianCapital: number; }
interface NewsSentiment { title: string; source: string; time: string; sentiment: number; label: string; keywords: string[]; relevance: number; }
interface PredictionRecord { id: string; symbol: string; direction: 'UP' | 'DOWN'; entryPrice: number; targetPrice: number; stopPrice: number; signalStrength: string; confidence: number; rewardRisk: number; timestamp: string; resolved?: 'WIN' | 'LOSS' | 'PENDING'; resolvedAt?: string; resolutionPrice?: number; }
interface MLSettings { enabled: boolean; symbols: string[]; confidenceThresholdAlta: number; confidenceThresholdModerada: number; minRewardRiskAlta: number; minRewardRiskModerada: number; autoTradeEnabled: boolean; autoTradeMaxRisk: number; autoTradeDefaultLot: number; telegramAlerts: boolean; }
interface FullReport { symbols: string[]; robotName: string; predictions: SymbolPrediction[]; regime: MarketRegime | null; risk: RiskMetrics; news: NewsSentiment[]; correlation: any; timestamp: string; }

const DIRECTION_CFG: Record<string, { icon: string; label: string; gradient: string; glow: string }> = {
    UP: { icon: '▲', label: 'COMPRA', gradient: 'from-emerald-400 via-emerald-500 to-green-600', glow: 'shadow-emerald-500/25' },
    DOWN: { icon: '▼', label: 'VENDA', gradient: 'from-red-400 via-red-500 to-rose-600', glow: 'shadow-red-500/25' },
    NEUTRAL: { icon: '◆', label: 'NEUTRO', gradient: 'from-slate-400 via-slate-500 to-zinc-600', glow: 'shadow-slate-500/25' },
};

const ROBOTS_LIST = [
    { id: 'shark-bot', name: 'SharkBot', icon: '🦈', color: 'from-cyan-400 to-cyan-300' },
    { id: 'gold-scalper', name: 'Gold Scalper', icon: '⚡', color: 'from-amber-400 to-yellow-300' },
    { id: 'motor-ia', name: 'Motor IA', icon: '🧠', color: 'from-violet-400 to-purple-300' },
    { id: 'crypto-ia', name: 'Crypto IA', icon: '₿', color: 'from-orange-400 to-amber-300' },
    { id: 'alpha-robot', name: 'Alpha Robot', icon: 'α', color: 'from-emerald-400 to-teal-300' },
    { id: 'supreme', name: 'Supreme', icon: '♛', color: 'from-rose-400 to-pink-300' },
    { id: 'recovery', name: 'Recovery', icon: '↺', color: 'from-blue-400 to-indigo-300' },
    { id: 'bitcoin-pro', name: 'Bitcoin Pro', icon: '₿', color: 'from-yellow-400 to-orange-300' },
];

const TABS = [
    { key: 'sinais', label: 'Sinais', icon: '◈' },
    { key: 'robos', label: 'Robôs', icon: '⚙' },
    { key: 'risco', label: 'Risco', icon: '♠' },
    { key: 'noticias', label: 'Notícias', icon: '◆' },
    { key: 'historico', label: 'Hit Rate', icon: '▲' },
    { key: 'config', label: 'Config', icon: '⚙' },
    { key: 'performance', label: 'Perf.', icon: '■' },
] as const;

function MlLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="mlg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <filter id="mlglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.4" />
                </filter>
            </defs>
            <rect x="8" y="10" width="28" height="24" rx="4" fill="none" stroke="url(#mlg)" strokeWidth="2" filter="url(#mlglow)" />
            <circle cx="16" cy="18" r="2" fill="url(#mlg)" />
            <circle cx="22" cy="18" r="2" fill="url(#mlg)" />
            <circle cx="28" cy="18" r="2" fill="url(#mlg)" />
            <path d="M13 27 Q 22 21, 31 27" fill="none" stroke="url(#mlg)" strokeWidth="1.5" opacity="0.6" />
            <line x1="16" y1="30" x2="18" y2="24" stroke="url(#mlg)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="30" x2="22" y2="22" stroke="url(#mlg)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="28" y1="30" x2="26" y2="24" stroke="url(#mlg)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function SignalBadge({ strength }: { strength: string }) {
    const cfg = strength === 'ALTA'
        ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' }
        : strength === 'MODERADA'
            ? { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/25', dot: 'bg-yellow-400' }
            : { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', dot: 'bg-slate-500' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${strength === 'ALTA' ? 'animate-pulse' : ''}`} />
            {strength}
        </span>
    );
}

function TrendPill({ trend }: { trend: string }) {
    if (trend === 'BULLISH') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/15 uppercase">▲ ALTA</span>;
    if (trend === 'BEARISH') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-black border border-red-500/15 uppercase">▼ BAIXA</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 text-[10px] font-black border border-slate-500/15 uppercase">◆ NEUTRO</span>;
}

function ConfidenceRing({ value, size = 72 }: { value: number; size?: number }) {
    const r = (size - 12) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 70 ? '#34d399' : value >= 50 ? '#facc15' : '#f87171';
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
                className="transition-all duration-1000 ease-out" />
            <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize="18" fontWeight="900" className="tabular-nums drop-shadow-sm">{value}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="700">%</text>
        </svg>
    );
}

function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    const r = (size - 12) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg, i) => {
                const len = (seg.value / total) * circ;
                const dash = `${len} ${circ - len}`;
                const o = -offset;
                offset += len;
                return seg.value > 0 ? (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="5" strokeLinecap="butt"
                        strokeDasharray={dash} strokeDashoffset={o} transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />
                ) : null;
            })}
            <circle cx={cx} cy={cy} r={r - 5} fill="rgba(0,0,0,0.3)" />
        </svg>
    );
}

function GaugeChart({ value, size = 100 }: { value: number; size?: number }) {
    const r = (size - 16) / 2;
    const cx = size / 2;
    const cy = size / 2 + 4;
    const circ = r * Math.PI;
    const offset = circ - (value / 100) * circ;
    const color = value >= 60 ? '#34d399' : value >= 40 ? '#facc15' : '#f87171';
    return (
        <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
            <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="18" fontWeight="900" className="tabular-nums">{value}%</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7" fontWeight="700" letter-spacing="1">HIT RATE</text>
        </svg>
    );
}

function WinLossTimeline({ records }: { records: PredictionRecord[] }) {
    if (!records.length) return null;
    const dots = records.slice(-30);
    const w = dots.length * 6 + 4;
    return (
        <svg width={Math.max(w, 60)} height={24} viewBox={`0 0 ${Math.max(w, 60)} 24`} className="w-full">
            {dots.map((rec, i) => {
                const x = i * 6 + 4;
                const color = rec.resolved === 'WIN' ? '#34d399' : rec.resolved === 'LOSS' ? '#f87171' : 'rgba(255,255,255,0.15)';
                return <circle key={i} cx={x} cy={12} r={2.5} fill={color} className="transition-all duration-300" />;
            })}
        </svg>
    );
}

function BarSparkline({ values, color = '#34d399', height = 24 }: { values: number[]; color?: string; height?: number }) {
    if (!values.length) return null;
    const max = Math.max(...values, 1);
    const w = values.length * 8;
    return (
        <svg width={Math.max(w, 40)} height={height} viewBox={`0 0 ${Math.max(w, 40)} ${height}`} className="w-full">
            {values.map((v, i) => {
                const bh = (v / max) * (height - 4);
                return <rect key={i} x={i * 8 + 2} y={height - 2 - bh} width={4} height={bh} rx={1} fill={color} opacity={0.7 + 0.3 * (v / max)} className="transition-all duration-500" />;
            })}
        </svg>
    );
}

interface RobotStatus {
    isRunning?: boolean;
    settings?: { enabled?: boolean; symbol?: string; lotSize?: number };
    state?: { position?: any | null; dailyProfit?: number; dailyLoss?: number };
    performance?: { totalTrades?: number; wins?: number; losses?: number; winRate?: number; totalProfit?: number; profitFactor?: number };
    trades?: any[];
}

export default function MLInsightsPanel() {
    const [report, setReport] = useState<FullReport | null>(null);
    const [monteCarlo, setMonteCarlo] = useState<MonteCarlo | null>(null);
    const [history, setHistory] = useState<{ records: PredictionRecord[]; stats: any } | null>(null);
    const [settings, setSettings] = useState<MLSettings | null>(null);
    const [performance, setPerformance] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'sinais' | 'robos' | 'risco' | 'noticias' | 'historico' | 'config' | 'performance'>('sinais');
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [selectedRobot, setSelectedRobot] = useState<string>('shark-bot');
    const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
    const [robotLogs, setRobotLogs] = useState<string[]>([]);

    const fetchAll = useCallback(async () => {
        const [r, mc, h, s, p] = await Promise.all([
            fetch('/api/mt5/ml-insights/full-report').then(r => r.json()).catch(() => null),
            fetch('/api/mt5/ml-insights/risk-metrics').then(r => r.json()).catch(() => null),
            fetch('/api/mt5/ml-insights/history').then(r => r.json()).catch(() => null),
            fetch('/api/mt5/ml-insights/settings').then(r => r.json()).catch(() => null),
            fetch('/api/mt5/ml-insights/performance').then(r => r.json()).catch(() => null),
        ]);
        if (r) { setReport(r); if (!selectedSymbol && r.predictions?.length) setSelectedSymbol(r.predictions[0].symbol); }
        if (mc) setMonteCarlo(mc.monteCarlo);
        if (h) setHistory(h);
        if (s) setSettings(s);
        if (p) setPerformance(p);
        setLoading(false);
    }, [selectedSymbol]);

    const fetchRobotStatus = useCallback(async () => {
        const data = await fetch(`/api/mt5/${selectedRobot}/status`).then(r => r.json()).catch(() => null);
        if (data) {
            setRobotStatus(data);
            if (data.operationLog) setRobotLogs(data.operationLog.slice(-30));
        }
    }, [selectedRobot]);

    useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 30000); return () => clearInterval(i); }, [fetchAll]);

    useEffect(() => {
        fetchRobotStatus();
        const i = setInterval(fetchRobotStatus, 10000);
        return () => clearInterval(i);
    }, [fetchRobotStatus]);

    const updateSettings = async (patch: Partial<MLSettings>) => {
        try {
            const res = await fetch('/api/mt5/ml-insights/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
            const data = await res.json();
            if (data.settings) setSettings(data.settings);
        } catch (e) { }
    };

    const regAccent = (r: string) => ({
        TRENDING_BULL: 'text-emerald-400 from-emerald-400', TRENDING_BEAR: 'text-red-400 from-red-400',
        RANGING: 'text-yellow-400 from-yellow-400', VOLATILE: 'text-orange-400 from-orange-400', SILENT: 'text-slate-400 from-slate-400'
    }[r] || 'text-slate-400 from-slate-400');
    const regLabel = (r: string) => ({ TRENDING_BULL: 'Tendência de Alta', TRENDING_BEAR: 'Tendência de Baixa', RANGING: 'Lateral', VOLATILE: 'Volátil', SILENT: 'Silencioso' }[r] || r);

    const prediction = selectedSymbol ? report?.predictions?.find(p => p.symbol === selectedSymbol) : report?.predictions?.[0];

    const symbolCounts = report?.predictions?.reduce((acc, p) => {
        acc[p.direction] = (acc[p.direction] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) || {};

    const strengthCounts = report?.predictions?.reduce((acc, p) => {
        acc[p.signalStrength] = (acc[p.signalStrength] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) || {};

    const renderSymbolSelector = () => {
        if (!report?.predictions) return null;
        return (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                {report.predictions.map(p => {
                    const dc = DIRECTION_CFG[p.direction];
                    const sel = p.symbol === selectedSymbol;
                    return (
                        <button key={p.symbol} onClick={() => setSelectedSymbol(p.symbol)}
                            className={`relative flex-shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all duration-300 border ${
                                sel
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-700/50 hover:border-slate-600'}`}>
                            {sel && <div className="absolute -top-px left-2 right-2 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />}
                            <div className="flex items-center gap-2">
                                <span className={sel ? `bg-gradient-to-r ${dc.gradient} bg-clip-text text-transparent` : ''}>{dc.icon}</span>
                                <span>{p.symbol}</span>
                                {p.signalStrength === 'ALTA' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-500/50" />}
                                {p.error && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shadow-sm shadow-yellow-500/50" title={p.error} />}
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderPredictionCard = () => {
        if (!prediction) return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center relative overflow-hidden">
                <div className="text-4xl mb-3 opacity-30">◈</div>
                <p className="text-base font-bold text-slate-400">Nenhum sinal disponível</p>
                <p className="text-[10px] text-slate-600 mt-1">Aguardando dados do ML Insights...</p>
            </div>
        );
        const p = prediction;
        const dc = DIRECTION_CFG[p.direction];
        const hasData = p.entryPrice > 0;

        return (
            <div className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border ${p.direction === 'UP' ? 'border-emerald-500/15' : p.direction === 'DOWN' ? 'border-red-500/15' : 'border-white/5'} p-6 relative overflow-hidden ${dc.glow}`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${dc.gradient} flex items-center justify-center shadow-lg ${dc.glow}`}>
                            <span className="text-xl font-black text-white drop-shadow-sm">{dc.icon}</span>
                        </div>
                        <div>
                            <div className={`text-2xl font-black bg-gradient-to-r ${dc.gradient} bg-clip-text text-transparent italic tracking-tight`}>{dc.label}</div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{report?.robotName} · {p.symbol}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <SignalBadge strength={p.signalStrength} />
                        <span className="text-[10px] font-mono text-slate-500">{report?.timestamp ? new Date(report.timestamp).toLocaleTimeString('pt-BR') : ''}</span>
                    </div>
                </div>

                {p.error && (
                    <div className="mb-4 p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-[11px] font-bold text-yellow-400">⚠ {p.error}</p>
                    </div>
                )}

                {hasData && <>
                    <div className="flex items-center gap-5 mb-5">
                        <ConfidenceRing value={p.confidence} size={80} />
                        <div className="flex-1">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                <span>Confiança</span>
                                <span>{p.confidence}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ease-out ${p.confidence >= 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : p.confidence >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, p.confidence))}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Entry', value: p.entryPrice, color: 'text-white', border: 'border-white/5' },
                            { label: 'Alvo (TP)', value: p.targetPrice, color: 'text-emerald-400', border: 'border-emerald-500/20' },
                            { label: 'Stop (SL)', value: p.stopPrice, color: 'text-red-400', border: 'border-red-500/20' },
                        ].map(item => (
                            <div key={item.label} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                                <p className={`text-xl font-black italic tabular-nums ${item.color}`}>{item.value.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>

                    {p.rewardRisk > 0 && (
                        <div className="flex justify-center mb-4">
                            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border ${p.rewardRisk >= 2 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25'}`}>
                                <TrendingUp size={14} /> R:R {p.rewardRisk.toFixed(1)}:1
                            </div>
                        </div>
                    )}

                    {p.institutional && (
                        <div className="bg-slate-950/40 border border-violet-500/15 p-4 rounded-2xl mb-4">
                            <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BrainCircuit size={14} /> Smart Money
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-2.5 bg-slate-900/50 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo</p>
                                    <p className="text-[13px] font-bold text-white">{p.institutional.type}</p>
                                </div>
                                <div className="text-center p-2.5 bg-slate-900/50 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Poder</p>
                                    <p className={`text-[13px] font-bold ${p.institutional.power >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>{p.institutional.power}%</p>
                                </div>
                                <div className="text-center p-2.5 bg-slate-900/50 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Viés</p>
                                    <p className={`text-[13px] font-bold ${p.institutional.bias === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>{p.institutional.bias}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {p.timeframes?.length > 0 && (
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl mb-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Multi-Timeframe</h4>
                            <div className="space-y-1.5">
                                {p.timeframes.map((tf, i) => {
                                    const barColor = tf.strength >= 70 ? '#34d399' : tf.strength >= 40 ? '#facc15' : '#f87171';
                                    return (
                                        <div key={i} className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="w-10 text-[11px] font-black text-slate-400 uppercase">{tf.timeframe}</span>
                                                <TrendPill trend={tf.trend} />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <svg width="40" height="12" viewBox="0 0 40 12">
                                                    <rect x="0" y="3" width="40" height="6" rx="3" fill="rgba(255,255,255,0.04)" />
                                                    <rect x="0" y="3" width={tf.strength * 0.4} height="6" rx="3" fill={barColor} className="transition-all duration-500" />
                                                </svg>
                                                <span className="text-[11px] font-mono text-slate-500 w-12 text-right">{tf.strength.toFixed(0)}%</span>
                                                <span className="text-[11px] font-mono text-slate-500">RSI {tf.rsi}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {p.supportResistance && (p.supportResistance.support > 0 || p.supportResistance.resistance > 0) && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">Suporte</p>
                                <p className="text-xl font-black text-emerald-400 italic tabular-nums">{p.supportResistance.support.toFixed(2)}</p>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-red-400/60 uppercase tracking-widest mb-1">Resistência</p>
                                <p className="text-xl font-black text-red-400 italic tabular-nums">{p.supportResistance.resistance.toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    {p.factors?.length > 0 && (
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Fatores</h4>
                            <div className="space-y-2">
                                {p.factors.map((f, i) => {
                                    const pct = Math.min(100, Math.abs(f.impact) * 5);
                                    const barColor = f.impact > 0 ? '#34d399' : f.impact < 0 ? '#f87171' : 'rgba(255,255,255,0.10)';
                                    return (
                                        <div key={i} className="flex items-center gap-3 bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
                                            <span className={`w-6 text-center font-black text-[12px] tabular-nums ${f.impact > 0 ? 'text-emerald-400' : f.impact < 0 ? 'text-red-400' : 'text-slate-500'}`}>{f.impact > 0 ? '+' : ''}{f.impact}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-bold text-slate-400 truncate">{f.name}</p>
                                                <svg width="100%" height="6" viewBox="0 0 100 6" className="mt-0.5">
                                                    <rect x="0" y="0" width="100" height="6" rx="3" fill="rgba(255,255,255,0.04)" />
                                                    <rect x="0" y="0" width={pct} height="6" rx="3" fill={barColor} className="transition-all duration-500" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>}
            </div>
        );
    };

    const renderRegime = () => {
        if (!report?.regime) return null;
        const r = report.regime;
        const accent = regAccent(r.regime);
        const probColor = r.probability >= 70 ? '#34d399' : r.probability >= 40 ? '#facc15' : '#f87171';
        return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={18} /> Regime
                        {prediction && <span className="text-sm font-black text-slate-500 ml-1">· {prediction.symbol}</span>}
                    </h3>
                    <svg width="44" height="22" viewBox="0 0 44 22">
                        <circle cx="22" cy="11" r="9.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                        <circle cx="22" cy="11" r="9.5" fill="none" stroke={probColor} strokeWidth="2" strokeLinecap="round"
                            strokeDasharray={`${(r.probability / 100) * 59.7} 59.7`} transform="rotate(-90 22 11)" className="transition-all duration-700" />
                        <text x="22" y="14.5" textAnchor="middle" fill={probColor} fontSize="8" fontWeight="900" className="tabular-nums">{r.probability}%</text>
                    </svg>
                </div>
                <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-black bg-gradient-to-r ${accent} bg-clip-text text-transparent italic tracking-tight`}>{regLabel(r.regime)}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-400 mb-4 leading-relaxed">{r.description}</p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Volatilidade</p>
                        <p className="text-xl font-black text-white italic tabular-nums">{r.volatility.toFixed(2)}%</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Força</p>
                        <p className="text-xl font-black text-white italic tabular-nums">{r.strength.toFixed(1)}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderRobotMonitor = () => {
        const robot = ROBOTS_LIST.find(r => r.id === selectedRobot);
        const perf = robotStatus?.performance;
        const pos = robotStatus?.state?.position;
        return (
            <div className="space-y-4">
                {/* Robot selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {ROBOTS_LIST.map(r => {
                        const sel = r.id === selectedRobot;
                        return (
                            <button key={r.id} onClick={() => setSelectedRobot(r.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                                    sel ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-700/50'}`}>
                                <span>{r.icon}</span>
                                <span className={`${sel ? `bg-gradient-to-r ${r.color} bg-clip-text text-transparent` : ''}`}>{r.name}</span>
                                {sel && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            </button>
                        );
                    })}
                </div>

                {!robotStatus ? (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-base font-bold text-slate-400">Conectando ao {robot?.name}...</p>
                    </div>
                ) : (
                    <>
                        {/* Status cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${robotStatus.isRunning ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                    <span className={`text-sm font-black ${robotStatus.isRunning ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {robotStatus.isRunning ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ativo</p>
                                <p className="text-sm font-black text-white">{robotStatus.settings?.symbol || '—'}</p>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Trades</p>
                                <p className="text-sm font-black text-white">{perf?.totalTrades || 0}</p>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">P&L</p>
                                <p className={`text-sm font-black ${(perf?.totalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${(perf?.totalProfit || 0).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {/* Performance */}
                        {perf && perf.totalTrades > 0 && (
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                                    <BarChart3 className="text-emerald-500" size={18} /> Performance
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Win Rate</p>
                                        <p className={`text-lg font-black italic ${perf.winRate >= 60 ? 'text-emerald-400' : perf.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{perf.winRate?.toFixed(0) || 0}%</p>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Wins</p>
                                        <p className="text-lg font-black text-emerald-400">{perf.wins || 0}</p>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Losses</p>
                                        <p className="text-lg font-black text-red-400">{perf.losses || 0}</p>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">PF</p>
                                        <p className={`text-lg font-black italic ${(perf.profitFactor || 0) >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{perf.profitFactor?.toFixed(2) || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active Position */}
                        {pos ? (
                            <div className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border p-6 relative overflow-hidden ${pos.type === 'BUY' ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                                    <Target className={pos.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'} size={18} />
                                    Posição Ativa · <span className={pos.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{pos.type}</span>
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">Entrada</p>
                                        <p className="text-base font-black text-white">{pos.price?.toFixed(2) || '—'}</p>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">SL</p>
                                        <p className="text-base font-black text-red-400">{pos.sl?.toFixed(2) || '—'}</p>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">TP</p>
                                        <p className="text-base font-black text-emerald-400">{pos.tp?.toFixed(2) || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 text-center">
                                <Target size={28} className="text-slate-700 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-500">Nenhuma posição ativa</p>
                            </div>
                        )}

                        {/* Live logs */}
                        {robotLogs.length > 0 && (
                            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                                    <Terminal size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Terminal</span>
                                    <span className="text-[8px] text-slate-600">últimos eventos</span>
                                </div>
                                <div className="h-40 overflow-y-auto p-4 font-mono text-[10px] space-y-1 bg-slate-950/20">
                                    {robotLogs.map((log: any, i: number) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <span className="text-slate-600 shrink-0">[{log.time || ''}]</span>
                                            <span className="text-emerald-500/70 shrink-0 font-black uppercase">[{log.action || ''}]</span>
                                            <span className="text-slate-300">{log.details || ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const renderRisk = () => {
        if (!report?.risk) return null;
        const r = report.risk;

        const riskColor = (v: number, threshold: number) => v > threshold ? '#34d399' : v > 0 ? '#facc15' : '#f87171';
        const maxSharpe = Math.max(Math.abs(r.sharpe), 3);
        const maxSortino = Math.max(Math.abs(r.sortino), 3);
        const maxCalmar = Math.max(Math.abs(r.calmar), 3);
        const maxPF = Math.max(r.profitFactor, 2);

        const MiniBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
            const pct = Math.min(100, Math.abs(value) / max * 100);
            return (
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-20">{label}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-black tabular-nums text-right" style={{ color }}>{value.toFixed(2)}</span>
                </div>
            );
        };

        return <div className="space-y-6">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Shield className="text-emerald-500" size={18} /> Métricas de Risco
                </h3>
                <div className="space-y-3">
                    <MiniBar label="Sharpe" value={r.sharpe} max={maxSharpe} color={riskColor(r.sharpe, 1)} />
                    <MiniBar label="Sortino" value={r.sortino} max={maxSortino} color={riskColor(r.sortino, 1)} />
                    <MiniBar label="Calmar" value={r.calmar} max={maxCalmar} color={riskColor(r.calmar, 1)} />
                    <MiniBar label="Profit Factor" value={r.profitFactor} max={maxPF} color={r.profitFactor > 1.5 ? '#34d399' : r.profitFactor > 1 ? '#facc15' : '#f87171'} />
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-red-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Crosshair className="text-red-400" size={18} /> Exposição
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">VaR 95%</p>
                        <p className="text-xl font-black text-red-400 italic tabular-nums">${Math.abs(r.var95).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CVaR 95%</p>
                        <p className="text-xl font-black text-orange-400 italic tabular-nums">${Math.abs(r.cvar95).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Max Drawdown</p>
                        <p className="text-xl font-black text-red-400 italic tabular-nums">{r.maxDrawdown.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Expectancy</p>
                        <p className={`text-xl font-black italic tabular-nums ${r.expectancy > 0 ? 'text-emerald-400' : 'text-red-400'}`}>${r.expectancy.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {monteCarlo && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <BrainCircuit className="text-violet-400" size={18} /> Monte Carlo
                        <span className="text-[10px] font-black text-slate-500 ml-2">{monteCarlo.iterations} iterações</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Retorno Esperado</p>
                            <p className={`text-xl font-black italic tabular-nums ${monteCarlo.expectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${monteCarlo.expectedProfit.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Capital Mediano</p>
                            <p className="text-xl font-black text-white italic tabular-nums">${monteCarlo.medianCapital.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Probabilidade de Ruína</span>
                        <span className={`text-xl font-black italic tabular-nums ${monteCarlo.ruinProbability > 20 ? 'text-red-400' : monteCarlo.ruinProbability > 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>{monteCarlo.ruinProbability.toFixed(1)}%</span>
                    </div>
                </div>
            )}
        </div>;
    };

    const renderNews = () => {
        if (!report?.news?.length) return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center relative overflow-hidden">
                <div className="text-4xl mb-3 opacity-30">◆</div>
                <p className="text-base font-bold text-slate-400">Nenhuma notícia disponível</p>
            </div>
        );

        const sentiments = report.news.reduce((acc, n) => {
            acc[n.label] = (acc[n.label] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const positive = sentiments['POSITIVE'] || 0;
        const negative = sentiments['NEGATIVE'] || 0;
        const neutral = sentiments['NEUTRAL'] || 0;
        const total = positive + negative + neutral;

        return <div className="space-y-4">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Activity className="text-emerald-500" size={18} /> Sentimento
                </h3>
                <div className="flex items-center gap-2 h-8">
                    {total > 0 && <>
                        <div className="h-full bg-emerald-500/20 rounded-xl transition-all duration-500 flex items-center justify-center" style={{ width: `${(positive / total) * 100}%`, minWidth: positive > 0 ? '24px' : '0' }}>
                            {positive > 0 && <span className="text-[9px] font-black text-emerald-400">{positive}</span>}
                        </div>
                        <div className="h-full bg-slate-700/50 rounded-xl transition-all duration-500 flex items-center justify-center" style={{ width: `${(neutral / total) * 100}%`, minWidth: neutral > 0 ? '24px' : '0' }}>
                            {neutral > 0 && <span className="text-[9px] font-black text-slate-400">{neutral}</span>}
                        </div>
                        <div className="h-full bg-red-500/20 rounded-xl transition-all duration-500 flex items-center justify-center" style={{ width: `${(negative / total) * 100}%`, minWidth: negative > 0 ? '24px' : '0' }}>
                            {negative > 0 && <span className="text-[9px] font-black text-red-400">{negative}</span>}
                        </div>
                    </>}
                </div>
            </div>
            {report.news.map((n, i) => (
                <motion.div key={i} whileHover={{ y: -3 }} className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border p-5 relative overflow-hidden ${n.label === 'POSITIVE' ? 'border-emerald-500/15' : n.label === 'NEGATIVE' ? 'border-red-500/15' : 'border-white/5'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${n.label === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-400' : n.label === 'NEGATIVE' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                            {n.label === 'POSITIVE' ? '▲' : n.label === 'NEGATIVE' ? '▼' : '◆'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white leading-tight mb-1">{n.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                <span>{n.source}</span>
                                <span>·</span>
                                <span>{new Date(n.time).toLocaleTimeString('pt-BR')}</span>
                                <span>·</span>
                                <span>rel. {n.relevance}%</span>
                            </div>
                        </div>
                        <span className={`text-[13px] font-black tabular-nums ${n.label === 'POSITIVE' ? 'text-emerald-400' : n.label === 'NEGATIVE' ? 'text-red-400' : 'text-slate-500'}`}>{n.sentiment > 0 ? '+' : ''}{n.sentiment.toFixed(2)}</span>
                    </div>
                </motion.div>
            ))}
        </div>;
    };

    const renderHistory = () => {
        if (!history) return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center relative overflow-hidden">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-base font-bold text-slate-400">Carregando histórico...</p>
            </div>
        );
        const { records, stats } = history;
        const filteredRecords = records.filter(r => selectedFilter === 'all' || r.resolved === selectedFilter);

        const hitColor = stats.hitRate >= 60 ? 'from-emerald-500 to-emerald-400' : stats.hitRate >= 40 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400';

        return <div className="space-y-4">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Target className="text-emerald-500" size={18} /> Visão Geral
                </h3>
                <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-white', border: 'border-white/5' },
                        { label: 'Wins', value: stats.wins, color: 'text-emerald-400', border: 'border-emerald-500/20' },
                        { label: 'Losses', value: stats.losses, color: 'text-red-400', border: 'border-red-500/20' },
                        { label: 'Hit Rate', value: `${stats.hitRate}%`, color: `bg-gradient-to-r ${hitColor} bg-clip-text text-transparent`, border: 'border-white/5' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className={`text-xl font-black italic tabular-nums ${item.color}`}>{item.value}</p>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                    <GaugeChart value={stats.hitRate} size={80} />
                    <div className="flex-1">
                        <WinLossTimeline records={records} />
                        <div className="flex justify-between text-[9px] text-slate-600 font-black mt-1">
                            <span className="text-emerald-400">↑ Win</span>
                            <span className="text-red-400">↓ Loss</span>
                            <span className="text-slate-500">· Pending</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                    { key: 'all', label: 'Todos', icon: '◈' },
                    { key: 'WIN', label: 'Ganhos', icon: '▲' },
                    { key: 'LOSS', label: 'Perdidos', icon: '▼' },
                    { key: 'PENDING', label: 'Pendentes', icon: '◆' },
                ].map(f => {
                    const sel = f.key === selectedFilter;
                    return (
                        <button key={f.key} onClick={() => setSelectedFilter(f.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border ${sel ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]' : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-700/50'}`}>
                            <span>{f.icon}</span>
                            <span>{f.label}</span>
                        </button>
                    );
                })}
            </div>

            {filteredRecords.length === 0 && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-8 text-center">
                    <p className="text-sm font-bold text-slate-400">Nenhum registro</p>
                </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredRecords.map((rec, i) => (
                    <div key={i} className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4 hover:border-emerald-500/15 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base ${rec.direction === 'UP' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {rec.direction === 'UP' ? '▲' : '▼'}
                                </div>
                                <div>
                                    <p className="text-base font-black text-white">{rec.symbol}</p>
                                    <p className="text-[11px] font-bold text-slate-500 tabular-nums">{rec.entryPrice.toFixed(2)} → TP {rec.targetPrice.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-[13px] font-black tabular-nums ${rec.resolved === 'WIN' ? 'text-emerald-400' : rec.resolved === 'LOSS' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {rec.resolved === 'WIN' ? 'WIN' : rec.resolved === 'LOSS' ? 'LOSS' : '⌛ PENDING'}
                                </p>
                                <p className="text-[11px] font-bold text-slate-500">{new Date(rec.timestamp).toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>;
    };

    const renderSettingsPanel = () => {
        if (!settings) return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center relative overflow-hidden">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-base font-bold text-slate-400">Carregando...</p>
            </div>
        );

        const GlassToggle = ({ active, onClick, label, sublabel }: { active: boolean; onClick: () => void; label: string; sublabel?: string }) => (
            <button onClick={onClick} className={`group flex items-center gap-3 w-full p-4 rounded-2xl border transition-all ${active ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}>
                <div className={`relative w-10 h-5 rounded-full transition-all duration-300 ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${active ? 'translate-x-5' : ''}`} />
                </div>
                <div className="text-left">
                    <p className="text-[12px] font-black text-white uppercase tracking-wider">{label}</p>
                    {sublabel && <p className="text-[10px] text-slate-500">{sublabel}</p>}
                </div>
            </button>
        );

        const GlassSlider = ({ label, value, min, max, step = 1, unit = '', color = 'emerald', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; color?: string; onChange: (v: number) => void }) => {
            const accentColor = color === 'emerald' ? 'accent-emerald-500' : color === 'yellow' ? 'accent-yellow-500' : color === 'violet' ? 'accent-violet-500' : 'accent-red-500';
            return (
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                        <span className={`text-lg font-black italic text-${color === 'emerald' ? 'emerald' : color === 'yellow' ? 'yellow' : color === 'violet' ? 'violet' : 'red'}-400`}>{value}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
                        className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer ${accentColor}`} />
                </div>
            );
        };

        return <div className="space-y-4">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <BrainCircuit className="text-emerald-500" size={18} /> ML Insights
                </h3>
                <GlassToggle active={settings.enabled} onClick={() => updateSettings({ enabled: !settings.enabled })}
                    label="Engine Principal" sublabel="Ativa ou desativa todas as análises ML" />
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <CircleDot className="text-emerald-500" size={18} /> Símbolos Ativos
                </h3>
                <div className="flex flex-wrap gap-2">
                    {['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD', 'SP500'].map(s => {
                        const active = settings.symbols.includes(s);
                        return (
                            <button key={s} onClick={() => {
                                const next = active ? settings.symbols.filter(x => x !== s) : [...settings.symbols, s];
                                updateSettings({ symbols: next });
                            }}
                                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                                    : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-700/50'}`}>
                                {s}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <BarChart3 className="text-emerald-500" size={18} /> Thresholds
                </h3>
                <div className="space-y-3">
                    <GlassSlider label="Confiança ALTA" value={settings.confidenceThresholdAlta} min={30} max={95} unit="%" color="emerald" onChange={v => updateSettings({ confidenceThresholdAlta: v })} />
                    <GlassSlider label="Confiança MODERADA" value={settings.confidenceThresholdModerada} min={20} max={80} unit="%" color="yellow" onChange={v => updateSettings({ confidenceThresholdModerada: v })} />
                    <GlassSlider label="R:R mínimo ALTA" value={settings.minRewardRiskAlta} min={1} max={5} step={0.5} unit=":1" color="emerald" onChange={v => updateSettings({ minRewardRiskAlta: v })} />
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Zap className="text-emerald-500" size={18} /> Auto-Trade
                </h3>
                <div className="space-y-3">
                    <GlassToggle active={settings.autoTradeEnabled} onClick={() => updateSettings({ autoTradeEnabled: !settings.autoTradeEnabled })}
                        label="Integração Alpha Robot" sublabel="Envia sinais ALTA para o robô executar" />
                    {settings.autoTradeEnabled && (
                        <div className="space-y-3 mt-3">
                            <GlassSlider label="Risco Máximo" value={settings.autoTradeMaxRisk} min={0.1} max={5} step={0.1} unit="%" color="violet" onChange={v => updateSettings({ autoTradeMaxRisk: v })} />
                            <GlassSlider label="Lote Padrão" value={settings.autoTradeDefaultLot} min={0.01} max={1} step={0.01} color="violet" onChange={v => updateSettings({ autoTradeDefaultLot: v })} />
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Activity className="text-emerald-500" size={18} /> Alertas
                </h3>
                <GlassToggle active={settings.telegramAlerts} onClick={() => updateSettings({ telegramAlerts: !settings.telegramAlerts })}
                    label="Telegram" sublabel="Notificar quando gerar sinal ALTA" />
            </div>
        </div>;
    };

    const renderPerformance = () => {
        if (!performance) return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-12 text-center relative overflow-hidden">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-base font-bold text-slate-400">Carregando performance...</p>
            </div>
        );
        const hitColor = performance.overall.hitRate >= 60 ? 'from-emerald-500 to-emerald-400' : performance.overall.hitRate >= 40 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400';

        const dirSegments = [
            { value: symbolCounts['UP'] || 0, color: '#34d399', label: 'UP' },
            { value: symbolCounts['DOWN'] || 0, color: '#f87171', label: 'DOWN' },
            { value: symbolCounts['NEUTRAL'] || 0, color: 'rgba(255,255,255,0.15)', label: 'NEUTRAL' },
        ];

        const strSegments = [
            { value: strengthCounts['ALTA'] || 0, color: '#34d399', label: 'ALTA' },
            { value: strengthCounts['MODERADA'] || 0, color: '#facc15', label: 'MODERADA' },
            { value: strengthCounts['FRACA'] || 0, color: 'rgba(255,255,255,0.15)', label: 'FRACA' },
        ];

        const perfValues = Object.values(performance.perSymbol).map((d: any) => d.hitRate);

        return <div className="space-y-4">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Percent className="text-emerald-500" size={18} /> Desempenho Geral
                </h3>
                <div className="flex items-center gap-5 mb-6">
                    <GaugeChart value={performance.overall.hitRate} size={88} />
                    <div className="flex-1 grid grid-cols-3 gap-3">
                        <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                            <p className="text-2xl font-black text-white italic tabular-nums">{performance.overall.total}</p>
                        </div>
                        <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/15 text-center">
                            <p className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">Wins</p>
                            <p className="text-2xl font-black text-emerald-400 italic tabular-nums">{performance.overall.wins}</p>
                        </div>
                        <div className="bg-red-500/5 p-3 rounded-2xl border border-red-500/15 text-center">
                            <p className="text-[8px] font-black text-red-400/60 uppercase tracking-widest mb-1">Losses</p>
                            <p className="text-2xl font-black text-red-400 italic tabular-nums">{performance.overall.losses}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hit Rate Geral</span>
                        <span className={`text-2xl bg-gradient-to-r ${hitColor} bg-clip-text text-transparent italic font-black tabular-nums`}>{performance.overall.hitRate}%</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${hitColor} transition-all duration-700 ease-out`}
                            style={{ width: `${Math.min(100, Math.max(0, performance.overall.hitRate))}%` }} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {report?.predictions && (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" size={16} /> Direção
                        </h3>
                        <div className="flex items-center gap-3">
                            <DonutChart segments={dirSegments} size={64} />
                            <div className="flex-1 space-y-1.5">
                                {dirSegments.map(s => s.value > 0 && (
                                    <div key={s.label} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                                        <span className="font-black text-slate-500 uppercase tracking-widest w-14">{s.label}</span>
                                        <span className="font-black text-white tabular-nums">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {report?.predictions && (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Zap className="text-emerald-500" size={16} /> Sinais
                        </h3>
                        <div className="flex items-center gap-3">
                            <DonutChart segments={strSegments} size={64} />
                            <div className="flex-1 space-y-1.5">
                                {strSegments.map(s => s.value > 0 && (
                                    <div key={s.label} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                                        <span className="font-black text-slate-500 uppercase tracking-widest w-16">{s.label}</span>
                                        <span className="font-black text-white tabular-nums">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {perfValues.length > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <BarChart3 className="text-emerald-500" size={18} /> Hit Rate por Símbolo
                    </h3>
                    <BarSparkline values={perfValues} color="#34d399" height={28} />
                </div>
            )}

            <div className="space-y-2">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2 mb-3">
                    <CircleDot className="text-emerald-500" size={18} /> Por Símbolo
                </h3>
                {Object.entries(performance.perSymbol).map(([symbol, data]: [string, any]) => {
                    const rate = data.hitRate;
                    const barColor = rate >= 60 ? 'from-emerald-500 to-emerald-400' : rate >= 40 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400';
                    const segColor = rate >= 60 ? '#34d399' : rate >= 40 ? '#facc15' : '#f87171';
                    return (
                        <motion.div key={symbol} whileHover={{ y: -3 }} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-5 hover:border-emerald-500/15 transition-all relative overflow-hidden">
                            <div className="flex items-center gap-4">
                                <div className="w-16 text-[15px] font-black text-white">{symbol}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2">
                                        <span className="tabular-nums">{data.wins}W / {data.losses}L</span>
                                        <span className={`font-black bg-gradient-to-r ${barColor} bg-clip-text text-transparent tabular-nums`}>{rate}%</span>
                                    </div>
                                    <svg width="100%" height="10" viewBox="0 0 100 10" className="mt-0.5">
                                        <rect x="0" y="3" width="100" height="4" rx="2" fill="rgba(255,255,255,0.04)" />
                                        <rect x="0" y="3" width={Math.min(100, Math.max(0, rate))} height="4" rx="2" fill={segColor} className="transition-all duration-700" />
                                        <circle cx={Math.min(100, Math.max(0, rate))} cy="5" r="4" fill={segColor} className="transition-all duration-700 drop-shadow-sm" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                {Object.keys(performance.perSymbol).length === 0 && (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-8 text-center">
                        <p className="text-sm font-bold text-slate-400">Nenhum dado de performance ainda</p>
                    </div>
                )}
            </div>
        </div>;
    };

    if (loading) return (
        <div className="p-16 text-center">
            <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Carregando ML Insights...</p>
        </div>
    );

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(52,211,153,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 shadow-xl shadow-emerald-500/10">
                        <MlLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">ML</span> Insights
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${settings?.enabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {settings?.enabled ? '24/7 Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-emerald-500" /> Machine Learning & Análise Preditiva Multi-Símbolo
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={fetchAll} className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl hover:bg-emerald-500/20 transition-all flex items-center gap-2 group" title="Recarregar">
                        <RefreshCw size={16} className="group-hover:rotate-90 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Recarregar</span>
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sistema Preditivo</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${settings?.enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${settings?.enabled ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                            <span className="text-[10px] font-black uppercase">{settings?.enabled ? 'Analisando' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
                <div className="flex items-center gap-1 relative z-10">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                            className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                activeTab === tab.key
                                    ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                                    : 'text-slate-500 hover:text-slate-400'}`}>
                            {activeTab === tab.key && <div className="absolute -top-px left-3 right-3 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />}
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                    {/* Robot selector dropdown */}
                    <div className="relative ml-2">
                        <select value={selectedRobot} onChange={e => setSelectedRobot(e.target.value)}
                            className="appearance-none bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 pr-8 text-[10px] font-black text-white uppercase tracking-wider outline-none focus:border-emerald-500/50 cursor-pointer">
                            {ROBOTS_LIST.map(r => (
                                <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    {robotStatus && (
                        <div className="flex items-center gap-2 ml-1">
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${(robotStatus.isRunning || robotStatus.settings?.enabled) ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            <span className={`text-[9px] font-black ${(robotStatus.isRunning || robotStatus.settings?.enabled) ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {robotStatus?.settings?.symbol || ''}
                            </span>
                        </div>
                    )}
                    {report?.timestamp && <span className="text-[10px] font-mono text-slate-500 ml-auto mr-1">{new Date(report.timestamp).toLocaleTimeString('pt-BR')}</span>}
                </div>
            </div>

            {/* CONTENT */}
            {activeTab === 'sinais' && <div className="space-y-6">{renderSymbolSelector()}{renderPredictionCard()}{renderRegime()}</div>}
            {activeTab === 'robos' && renderRobotMonitor()}
            {activeTab === 'risco' && renderRisk()}
            {activeTab === 'noticias' && renderNews()}
            {activeTab === 'historico' && renderHistory()}
            {activeTab === 'config' && renderSettingsPanel()}
            {activeTab === 'performance' && renderPerformance()}
        </div>
    );
}
