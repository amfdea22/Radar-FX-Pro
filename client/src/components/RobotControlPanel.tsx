import React, { useState, useEffect } from 'react';
import {
    Bot, Power, Zap, ShieldCheck, Target,
    BarChart3, Settings2, Activity, BrainCircuit, Cpu,
    Trophy, RefreshCw, Percent, TrendingUp, Flame, DollarSign,
    Eye, Layers, TrendingDown, Gauge, ArrowUpDown, Crosshair,
    Shield, CircleDot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface RobotSettings {
    enabled: boolean;
    minConfidence: number;
    maxTradesPerDay: number;
    defaultLot: number;
    onlyInstitutional: boolean;
    autoBreakEven: boolean;
    autoTrailing: boolean;
    tradesPer15Min: number;
    tradeLimitInterval: '1m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1mo';
    preferredTimeframe: string;
    useInstitutionalAnalysis: boolean;
    maxRiskPerTrade: number;
    trailingActivation: number;
    breakevenActivation: number;
    atrMultiplierSL: number;
    atrMultiplierTP: number;
    entryScoreThreshold: number;
    symbols: string[];
}

interface TradeRecord {
    id: string;
    ticket: number;
    type: 'BUY' | 'SELL';
    lot: number;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    result: 'WIN' | 'LOSS';
    setup: string;
    closeReason: string;
    openTime: string;
    closeTime: string;
    duration: string;
}

interface TradeReport {
    summary: {
        totalTrades: number;
        wins: number;
        losses: number;
        winRate: number;
        totalProfit: number;
        profitFactor: number;
        currentStreak: number;
    };
    recentTrades: TradeRecord[];
}

interface InstitutionalAnalysis {
    symbol: string;
    direction: 'BUY' | 'SELL' | 'NEUTRAL';
    score: number;
    wyckoffPhase: string;
    rsi: number;
    confidence: number;
    details: string;
    vwapDistance: number;
    trendAlignment: string;
    volumeRatio: number;
}

function AlphaLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
                <filter id="aglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a78bfa" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#ag)" strokeWidth="2" filter="url(#aglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#ag)" fontSize="26" fontWeight="900" fontStyle="italic" filter="url(#aglow)">A</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#ag)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

function GaugeChart({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
    const pct = Math.min(100, (value / max) * 100);
    const angle = (pct / 100) * 180;
    const rad = (angle - 90) * Math.PI / 180;
    const r = 28;
    const cx = 36, cy = 40;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    return (
        <svg width="72" height="52" viewBox="0 0 72 52" className="overflow-visible">
            <path d="M6 40 A28 28 0 0 1 66 40" fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <path d="M6 40 A28 28 0 0 1 66 40" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${pct * 0.52} 200`} />
            <circle cx={x} cy={y} r={3} fill={color} stroke="white" strokeWidth="1" />
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <text x={cx} y={cy + 6} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{value}</text>
        </svg>
    );
}

const SYMBOLS = ['XAUUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD'];

export const RobotControlPanel: React.FC = () => {
    const [settings, setSettings] = useState<RobotSettings | null>(null);
    const [stats, setStats] = useState({
        processedCount: 0,
        tradesThisWindow: 0,
        tradesLimit: 0,
        currentInterval: '15m',
        openPositions: 0
    });
    const [analysisData, setAnalysisData] = useState<InstitutionalAnalysis[]>([]);
    const [report, setReport] = useState<TradeReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await axios.get('/api/mt5/robot/status');
                setSettings(response.data.settings);
                setStats({
                    processedCount: response.data.processedCount,
                    tradesThisWindow: response.data.tradesThisWindow,
                    tradesLimit: response.data.tradesLimit,
                    currentInterval: response.data.currentInterval,
                    openPositions: response.data.openPositions || 0
                });
                setAnalysisData(response.data.institutionalAnalysis || []);
            } catch (error) {
                console.error('Failed to fetch robot status');
            } finally {
                setLoading(false);
            }
        };

        const fetchReport = async () => {
            try {
                const response = await axios.get('/api/mt5/robot/report');
                setReport(response.data);
            } catch (error) {
                console.error('Failed to fetch robot report');
            }
        };

        fetchStatus();
        fetchReport();
        const interval = setInterval(() => {
            fetchStatus();
            fetchReport();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleRobot = async () => {
        if (!settings) return;
        const newEnabled = !settings.enabled;
        await updateSettings({ enabled: newEnabled });
    };

    const updateSettings = async (newPartial: Partial<RobotSettings>) => {
        if (!settings) return;
        setSaving(true);
        try {
            const response = await axios.post('/api/mt5/robot/settings', { ...settings, ...newPartial });
            setSettings(response.data.settings);
        } catch (error) {
            console.error('Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const [statusResp, reportResp] = await Promise.all([
                axios.get('/api/mt5/robot/status'),
                axios.get('/api/mt5/robot/report')
            ]);
            setSettings(statusResp.data.settings);
            setReport(reportResp.data);
        } catch (error) {
            console.error('Failed to sync robot trades');
        } finally {
            setSyncing(false);
        }
    };

    if (loading || !settings) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando I.A. Alpha...</p>
            </div>
        );
    }

    const isActive = settings.enabled;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <AlphaLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500">Alpha</span> Robot
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${isActive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-violet-500" /> Análise Institucional Wyckoff + VWAP + Order Blocks
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{settings.symbols.length} Símbolos</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isActive ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            <span className="text-[10px] font-black uppercase">{isActive ? 'Live' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ALPHA INSTITUTIONAL ENGINE */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Cpu className="text-violet-500 animate-pulse" /> Institutional <span className="text-violet-500">Engine</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] tracking-widest uppercase animate-pulse ${analysisData.some(a => a.direction !== 'NEUTRAL' && a.score >= (settings?.entryScoreThreshold || 70)) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-violet-500/20 text-violet-500 border border-violet-500/30'}`}>
                                {analysisData.some(a => a.direction !== 'NEUTRAL') ? `${analysisData.filter(a => a.direction !== 'NEUTRAL').length} Sinal(is)` : 'Scanning'}
                            </span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Wyckoff Phase Detection & Market Structure Analysis em Tempo Real</p>
                    </div>
                    <button
                        onClick={toggleRobot}
                        disabled={saving}
                        className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            isActive
                                ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                : 'bg-violet-500/10 border-violet-500/30 text-violet-500 hover:bg-violet-500/20'
                        }`}
                    >
                        {saving ? (
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                        ) : isActive ? (
                            <><Zap size={12} /> Desligar Alpha</>
                        ) : (
                            <><Zap size={12} /> Ligar Alpha</>
                        )}
                    </button>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-violet-500/20 text-violet-500 rounded-xl">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sinais Processados</p>
                            <p className="text-xl font-black text-white italic">{stats.processedCount}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
                            <ArrowUpDown size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Posições Abertas</p>
                            <p className={`text-xl font-black italic ${stats.openPositions > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{stats.openPositions}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <Settings2 size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Limite Diário</p>
                            <p className="text-xl font-black text-white italic">{settings.maxTradesPerDay}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl">
                            <BrainCircuit size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Score Mín</p>
                            <p className="text-xl font-black text-white italic">{settings.entryScoreThreshold}</p>
                        </div>
                    </div>
                </div>

                {/* SYMBOL ANALYSIS CARDS */}
                {analysisData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {analysisData.map((a) => {
                            const isBullish = a.direction === 'BUY';
                            const isReady = a.direction !== 'NEUTRAL' && a.score >= (settings?.entryScoreThreshold || 70);
                            const color = isBullish ? 'emerald' : isReady || a.direction === 'SELL' ? 'red' : 'violet';
                            return (
                                <motion.div key={a.symbol} whileHover={{ y: -5 }} className={`bg-slate-950/40 p-5 rounded-3xl border transition-all ${isReady ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(52,211,153,0.15)]' : 'border-white/5 hover:border-violet-500/20'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-lg font-black text-white italic">{a.symbol}</span>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                            a.direction === 'NEUTRAL' ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20' :
                                            isBullish ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'
                                        }`}>
                                            {a.direction === 'NEUTRAL' ? 'NEUTRO' : a.direction}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Score</p>
                                                <p className={`text-xl font-black italic ${isBullish ? 'text-emerald-400' : a.direction === 'SELL' ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {a.score}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Wyckoff</p>
                                                <p className="text-sm font-bold text-white">{a.wyckoffPhase}</p>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${a.score}%` }}
                                                className={`h-full bg-gradient-to-r ${isBullish ? 'from-emerald-500 to-trader-green' : a.direction === 'SELL' ? 'from-red-500 to-red-400' : 'from-slate-500 to-slate-400'}`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                            <div>
                                                <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">RSI</p>
                                                <p className="text-xs font-black text-white">{a.rsi.toFixed(1)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">VWAP</p>
                                                <p className={`text-xs font-black ${a.vwapDistance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{a.vwapDistance > 0 ? '+' : ''}{a.vwapDistance}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* CONFIG LEFT */}
                <div className="xl:col-span-2 space-y-6">

                    {/* FILTERS & INTELLIGENCE */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <BrainCircuit className="text-violet-500" size={18} /> Inteligência & Filtros
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confiança I.A. Mínima</span>
                                    <span className="text-sm font-black text-violet-400">{settings.minConfidence}%</span>
                                </div>
                                <input type="range" min={70} max={99} value={settings.minConfidence}
                                    onChange={(e) => updateSettings({ minConfidence: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-violet-500" />
                                <div className="flex justify-between text-[7px] font-black text-slate-600 uppercase mt-1">
                                    <span>70%</span>
                                    <span>99%</span>
                                </div>
                            </div>

                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Volume (Lot)</span>
                                    <span className="text-sm font-black text-white">{settings.defaultLot.toFixed(2)}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[0.01, 0.1, 0.5, 1.0].map(lot => (
                                        <button key={lot}
                                            onClick={() => updateSettings({ defaultLot: lot })}
                                            className={`py-2 rounded-xl border font-black text-[10px] transition-all ${settings.defaultLot === lot
                                                ? 'bg-violet-500/20 border-violet-500/30 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                                                : 'bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-700/50'}`}>
                                            {lot}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => updateSettings({ onlyInstitutional: !settings.onlyInstitutional })}
                                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.onlyInstitutional
                                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                                    : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                                <ShieldCheck size={22} className={settings.onlyInstitutional ? 'text-violet-400' : ''} />
                                <span className="text-[8px] font-black uppercase tracking-widest text-center">Somente Institucional</span>
                            </button>
                            <button
                                onClick={() => updateSettings({ autoBreakEven: !settings.autoBreakEven })}
                                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.autoBreakEven
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                    : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                                <Target size={22} className={settings.autoBreakEven ? 'text-amber-400' : ''} />
                                <span className="text-[8px] font-black uppercase tracking-widest text-center">Break-Even Auto</span>
                            </button>
                            <button
                                onClick={() => updateSettings({ autoTrailing: !settings.autoTrailing })}
                                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.autoTrailing
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                    : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                                <Zap size={22} className={settings.autoTrailing ? 'text-cyan-400' : ''} />
                                <span className="text-[8px] font-black uppercase tracking-widest text-center">Trailing Stop Auto</span>
                            </button>
                        </div>

                        <div className="mt-6 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Limite de Trades</span>
                                <span className="text-[8px] font-black text-violet-400 uppercase">Janela ({stats.currentInterval}): {stats.tradesThisWindow}</span>
                            </div>
                            <div className="flex items-center justify-between mb-3">
                                <button onClick={() => updateSettings({ maxTradesPerDay: settings.maxTradesPerDay - 1 })}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">-</button>
                                <span className="text-2xl font-black text-white">{settings.maxTradesPerDay}</span>
                                <button onClick={() => updateSettings({ maxTradesPerDay: settings.maxTradesPerDay + 1 })}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">+</button>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase">Trades/{settings.tradeLimitInterval}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateSettings({ tradesPer15Min: Math.max(0, settings.tradesPer15Min - 1) })}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">-</button>
                                    <span className="text-sm font-black text-white">{settings.tradesPer15Min}</span>
                                    <button onClick={() => updateSettings({ tradesPer15Min: settings.tradesPer15Min + 1 })}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">+</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                                {['1m', '15m', '30m', '1h', '1d', '1w', '1mo'].map(interval => (
                                    <button key={interval}
                                        onClick={() => updateSettings({ tradeLimitInterval: interval as any })}
                                        className={`py-1.5 rounded-lg border font-black text-[8px] uppercase transition-all ${settings.tradeLimitInterval === interval
                                            ? 'bg-violet-500/20 border-violet-500/30 text-white'
                                            : 'bg-slate-800/50 border-white/5 text-slate-600 hover:bg-slate-700/50'}`}>
                                        {interval}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* INSTITUTIONAL PARAMETERS */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Gauge className="text-violet-500" size={18} /> Parâmetros Institucionais
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score Mínimo</span>
                                    <span className="text-sm font-black text-violet-400">{settings.entryScoreThreshold}</span>
                                </div>
                                <input type="range" min={40} max={95} value={settings.entryScoreThreshold}
                                    onChange={(e) => updateSettings({ entryScoreThreshold: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-violet-500" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risco por Trade</span>
                                    <span className="text-sm font-black text-red-400">{settings.maxRiskPerTrade}%</span>
                                </div>
                                <input type="range" min={0.1} max={5} step={0.1} value={settings.maxRiskPerTrade}
                                    onChange={(e) => updateSettings({ maxRiskPerTrade: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-red-500" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ATR Multiplicador SL</span>
                                    <span className="text-sm font-black text-red-400">{settings.atrMultiplierSL}x</span>
                                </div>
                                <input type="range" min={0.5} max={4} step={0.1} value={settings.atrMultiplierSL}
                                    onChange={(e) => updateSettings({ atrMultiplierSL: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-red-500" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ATR Multiplicador TP</span>
                                    <span className="text-sm font-black text-emerald-400">{settings.atrMultiplierTP}x</span>
                                </div>
                                <input type="range" min={1} max={8} step={0.1} value={settings.atrMultiplierTP}
                                    onChange={(e) => updateSettings({ atrMultiplierTP: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Trailing Ativa</span>
                                    <span className="text-sm font-black text-cyan-400">{settings.trailingActivation * 100}% do TP</span>
                                </div>
                                <input type="range" min={10} max={80} step={5} value={settings.trailingActivation * 100}
                                    onChange={(e) => updateSettings({ trailingActivation: parseInt(e.target.value) / 100 })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Break-Even Ativa</span>
                                    <span className="text-sm font-black text-amber-400">{settings.breakevenActivation * 100}% do TP</span>
                                </div>
                                <input type="range" min={5} max={60} step={5} value={settings.breakevenActivation * 100}
                                    onChange={(e) => updateSettings({ breakevenActivation: parseInt(e.target.value) / 100 })}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-amber-500" />
                            </div>
                        </div>

                        <div className="mt-6 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Eye size={16} className={settings.useInstitutionalAnalysis ? 'text-emerald-400' : 'text-slate-500'} />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Análise Institucional</span>
                                </div>
                                <button
                                    onClick={() => updateSettings({ useInstitutionalAnalysis: !settings.useInstitutionalAnalysis })}
                                    className={`w-10 h-5 rounded-full relative transition-all ${settings.useInstitutionalAnalysis ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.useInstitutionalAnalysis ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TIMEFRAME */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Activity className="text-violet-500" size={18} /> Timeframe de Operação
                        </h3>
                        <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
                            {['ALL', 'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'].map(tf => (
                                <button key={tf}
                                    onClick={() => updateSettings({ preferredTimeframe: tf })}
                                    className={`py-3 rounded-2xl border font-black text-[10px] transition-all ${settings.preferredTimeframe === tf
                                        ? 'bg-violet-500/20 border-violet-500/30 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] scale-105'
                                        : 'bg-slate-950/40 border-white/5 text-slate-500 hover:border-slate-700'}`}>
                                    {tf === 'ALL' ? 'TODOS' : tf}
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mt-4">
                            O robô executará apenas sinais confirmados no timeframe selecionado.
                        </p>
                    </div>

                    {/* SYMBOLS */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <CircleDot className="text-violet-500" size={18} /> Símbolos Monitorados
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                            {SYMBOLS.map(s => (
                                <button key={s}
                                    onClick={() => {
                                        const current = settings.symbols;
                                        const updated = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                                        if (updated.length > 0) updateSettings({ symbols: updated });
                                    }}
                                    className={`px-3 py-2 rounded-xl border text-[10px] font-black tracking-wide transition-all ${settings.symbols.includes(s)
                                        ? 'bg-violet-500/20 border-violet-500/30 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                                        : 'bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-700/50'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TRADE REPORT */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                <Trophy className="text-violet-500" size={18} /> Relatório de Performance I.A.
                            </h3>
                            <button onClick={handleSync} disabled={syncing}
                                className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${syncing
                                    ? 'bg-violet-500/20 border-violet-500/30 text-violet-500 cursor-wait'
                                    : 'bg-slate-800/50 border-white/5 text-slate-300 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-400'}`}>
                                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                                {syncing ? 'Sincronizando...' : 'Sincronizar'}
                            </button>
                        </div>

                        {/* KPI GRID */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                                    <BarChart3 size={12} /> Total Trades
                                </p>
                                <p className="text-2xl font-black text-white italic">{report?.summary.totalTrades || 0}</p>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                                    <Percent size={12} /> % Acerto
                                </p>
                                <p className={`text-2xl font-black italic ${(report?.summary.winRate || 0) >= 60 ? 'text-emerald-400' : (report?.summary.winRate || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {report?.summary.winRate || 0}%
                                </p>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                                    <DollarSign size={12} /> Lucro Total
                                </p>
                                <p className={`text-2xl font-black italic ${(report?.summary.totalProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${(report?.summary.totalProfit || 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                                    <TrendingUp size={12} /> Profit Factor
                                </p>
                                <p className={`text-2xl font-black italic ${(report?.summary.profitFactor || 0) >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {report?.summary.profitFactor?.toFixed(2) || '0.00'}
                                </p>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                                    <Flame size={12} /> Streak
                                </p>
                                <p className="text-2xl font-black text-amber-400 italic">{report?.summary.currentStreak || 0}x</p>
                            </div>
                        </div>

                        {/* WIN/LOSS BAR */}
                        {report && report.summary.totalTrades > 0 && (
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{report.summary.wins} Vitórias</span>
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{report.summary.losses} Derrotas</span>
                                </div>
                                <div className="h-4 bg-slate-950 rounded-full overflow-hidden flex border border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${report.summary.winRate}%` }}
                                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full"
                                    />
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${100 - report.summary.winRate}%` }}
                                        className="bg-gradient-to-r from-red-500 to-red-400 h-full"
                                    />
                                </div>
                            </div>
                        )}

                        {/* TABLE */}
                        <div className="bg-slate-950/60 rounded-[2rem] border border-white/5 overflow-hidden">
                            <div className="max-h-72 overflow-x-auto overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="sticky top-0 bg-slate-900 border-b border-white/5">
                                        <tr className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Ativo</th>
                                            <th className="px-6 py-4">Tipo</th>
                                            <th className="px-6 py-4">Setup</th>
                                            <th className="px-6 py-4 text-right">P&L ($)</th>
                                            <th className="px-6 py-4 text-right">Data/Hora</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {report?.recentTrades && report.recentTrades.length > 0 ? (
                                            report.recentTrades.map((trade) => (
                                                <tr key={trade.id} className="group hover:bg-white/5 transition-all">
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${trade.result === 'WIN'
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                            : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                                            {trade.result}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-white text-xs italic">XAUUSD</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-black ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {trade.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{trade.setup}</td>
                                                    <td className={`px-6 py-4 text-right text-xs font-black italic ${trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-[10px] text-slate-500 font-mono">
                                                        {new Date(trade.closeTime).toLocaleDateString()} {new Date(trade.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                                        <Bot size={40} />
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sincronize para visualizar o histórico neural</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="space-y-6">
                    {/* ACTIVE POSITIONS */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Target className="text-violet-500" size={18} /> Posições
                        </h3>
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-center">
                                <Target size={28} className="text-slate-600" />
                            </div>
                            <p className="text-base font-black text-slate-400">
                                {stats.openPositions > 0 ? `${stats.openPositions} posição(ões) aberta(s)` : 'Nenhuma posição ativa'}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">Gerenciado pelo Trade Guardian</p>
                        </div>
                    </div>

                    {/* INSTITUTIONAL ANALYSIS MINI */}
                    {analysisData.length > 0 && (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <Layers className="text-violet-500" size={18} /> Scores em Tempo Real
                            </h3>
                            <div className="space-y-4">
                                {analysisData.map(a => {
                                    const isBullish = a.direction === 'BUY';
                                    const scoreColor = isBullish ? 'text-emerald-400' : a.direction === 'SELL' ? 'text-red-400' : 'text-slate-400';
                                    return (
                                        <div key={a.symbol} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-black text-white">{a.symbol}</span>
                                                <span className={`text-xs font-black italic ${scoreColor}`}>{a.score}</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${a.score}%` }}
                                                    className={`h-full ${isBullish ? 'bg-emerald-500' : a.direction === 'SELL' ? 'bg-red-500' : 'bg-slate-500'}`}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[7px] font-black text-slate-600 uppercase">{a.wyckoffPhase}</span>
                                                <span className={`text-[7px] font-black uppercase ${a.trendAlignment === 'ALIGNED' || a.trendAlignment === 'BULLISH' ? 'text-emerald-400' : a.trendAlignment === 'BEARISH' ? 'text-red-400' : 'text-slate-500'}`}>
                                                    {a.trendAlignment}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* USE ML SIGNALS TOGGLE */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <BrainCircuit className="text-violet-500" size={18} /> Integração ML
                        </h3>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Zap size={16} className={settings.useMLSignals ? 'text-violet-400' : 'text-slate-600'} />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Usar Sinais ML</span>
                                </div>
                                <button
                                    onClick={() => updateSettings({ useMLSignals: !(settings as any).useMLSignals })}
                                    className={`w-10 h-5 rounded-full relative transition-all ${(settings as any).useMLSignals ? 'bg-violet-500' : 'bg-slate-700'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(settings as any).useMLSignals ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                            {(settings as any).useMLSignals && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <p className="text-[8px] font-black text-violet-400/60 uppercase tracking-widest">
                                        Sinais ALTA do ML Insights serão convertidos em ordens Alpha Robot
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ROBOT STATUS */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent ${isActive ? 'via-emerald-500/50' : 'via-slate-500/30'} to-transparent`}></div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Shield className="text-violet-500" size={18} /> Status Alpha Robot
                        </h3>
                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 text-center">
                            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                                <Bot size={32} className={isActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'} />
                            </div>
                            <p className="text-base font-black text-white italic">{isActive ? 'Alpha Robot Ativo' : 'Alpha Robot Inativo'}</p>
                            <p className="text-[10px] text-slate-500 mt-1">
                                {isActive
                                    ? `Analisando ${settings.symbols.length} símbolos • Score mínimo: ${settings.entryScoreThreshold}`
                                    : 'Ative o robô para iniciar trading institucional'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
