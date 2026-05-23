import React, { useState, useEffect } from 'react';
import {
    Bot, Power, Zap, ShieldCheck, Target,
    BarChart3, Settings2, Fingerprint, Activity,
    BrainCircuit, Cpu, Trophy, RefreshCw, Percent,
    TrendingUp, Flame, DollarSign, XCircle, AlertTriangle,
    Eye, Layers, TrendingDown, Waves, Gauge, ArrowUpDown
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
            await axios.post('/api/mt5/robot/sync');
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
                <div className="w-12 h-12 border-4 border-trader-cyan/20 border-t-trader-cyan rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando I.A. Alpha...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden relative group">
                {/* Background Glows */}
                <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] -mr-32 -mt-32 transition-colors duration-1000 ${settings.enabled ? 'bg-trader-green/20' : 'bg-trader-red/10'}`}></div>

                <div className="flex items-center gap-5 relative z-10">
                    <div className={`p-4 rounded-2xl border transition-all duration-500 ${settings.enabled
                        ? 'bg-trader-green/10 border-trader-green/30 text-trader-green shadow-[0_0_20px_rgba(22,163,74,0.3)]'
                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                        }`}>
                        <Bot size={32} strokeWidth={2.5} className={settings.enabled ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Alpha Robot v2.0</h1>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${settings.enabled ? 'bg-trader-green text-black' : 'bg-slate-800 text-slate-500'
                                }`}>AI ENGINE ONLINE</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Automação Institucional de Alta Frequência</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    {/* Botão Glass Luminoso */}
                    <button
                        onClick={toggleRobot}
                        disabled={saving}
                        className={`relative group flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all duration-500 ${settings.enabled
                            ? 'bg-trader-green/20 border border-trader-green/40 text-trader-green shadow-[0_0_30px_rgba(22,163,74,0.4)] hover:scale-105 active:scale-95'
                            : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                            }`}
                    >
                        <Power size={18} className={settings.enabled ? 'animate-pulse' : ''} />
                        {settings.enabled ? 'Robô Ativo' : 'Robô Em Espera'}

                        {/* Glow effect overlay */}
                        {settings.enabled && (
                            <span className="absolute inset-0 rounded-[1.5rem] bg-trader-green/10 animate-ping pointer-events-none"></span>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Parâmetros de Filtro (I.A. Decision) */}
                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-2">
                        <BrainCircuit className="text-trader-cyan" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Inteligência & Filtros</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Confiança Mínima */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Confiança I.A. Mínima</label>
                                <span className="text-lg font-black text-slate-400 italic">{settings.minConfidence}%</span>
                            </div>
                            <input
                                type="range"
                                min="70"
                                max="99"
                                value={settings.minConfidence}
                                onChange={(e) => updateSettings({ minConfidence: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-green"
                            />
                            <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase">
                                <span>70% (Scalp)</span>
                                <span>99% (Elite)</span>
                            </div>
                        </div>

                        {/* Lote Padrão */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Volume por Operação (Lot)</label>
                                <span className="text-lg font-black text-white italic">{settings.defaultLot.toFixed(2)}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[0.01, 0.1, 0.5, 1.0].map(lot => (
                                    <button
                                        key={lot}
                                        onClick={() => updateSettings({ defaultLot: lot })}
                                        className={`py-2 rounded-xl border font-black text-[10px] transition-all ${settings.defaultLot === lot
                                            ? 'bg-trader-green/20 border-trader-green/40 text-slate-300 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                                            : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'
                                            }`}
                                    >
                                        {lot}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        {/* Toggles */}
                        <button
                            onClick={() => updateSettings({ onlyInstitutional: !settings.onlyInstitutional })}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.onlyInstitutional
                                ? 'bg-trader-green/10 border-trader-green/40 text-slate-300 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                                : 'bg-slate-950/50 border-slate-800 text-slate-600'
                                }`}
                        >
                            <ShieldCheck size={24} className={settings.onlyInstitutional ? 'animate-pulse text-slate-300' : ''} />
                            <span className={`text-[9px] font-black uppercase tracking-widest text-center ${settings.onlyInstitutional ? 'text-slate-300' : ''}`}>Somente Institucional</span>
                        </button>

                        <button
                            onClick={() => updateSettings({ autoBreakEven: !settings.autoBreakEven })}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.autoBreakEven
                                ? 'bg-trader-green/20 border-trader-green/40 text-trader-green shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                : 'bg-slate-950/50 border-slate-800 text-slate-600'
                                }`}
                        >
                            <Target size={24} className={settings.autoBreakEven ? 'animate-pulse text-trader-green' : ''} />
                            <span className={`text-[9px] font-black uppercase tracking-widest text-center ${settings.autoBreakEven ? 'text-slate-300' : ''}`}>Break-Even Auto</span>
                        </button>

                        <button
                            onClick={() => updateSettings({ autoTrailing: !settings.autoTrailing })}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${settings.autoTrailing
                                ? 'bg-trader-amber/20 border-trader-amber/40 text-trader-amber shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                : 'bg-slate-950/50 border-slate-800 text-slate-600'
                                }`}
                        >
                            <Zap size={24} className={settings.autoTrailing ? 'animate-pulse text-trader-green' : ''} />
                            <span className={`text-[9px] font-black uppercase tracking-widest text-center ${settings.autoTrailing ? 'text-slate-300' : ''}`}>Trailing Stop Auto</span>
                        </button>
                    </div>
                </div>

                {/* Performance & Status Stat Cards */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col gap-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="text-trader-cyan" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Performance Hoje</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-5 bg-slate-950/50 border border-white/5 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Cpu size={18} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinais Processados</span>
                            </div>
                            <span className="text-xl font-black text-white">{stats.processedCount}</span>
                        </div>

                        <div className="p-5 bg-slate-950/50 border border-white/5 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ArrowUpDown size={18} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posições Abertas</span>
                            </div>
                            <span className={`text-xl font-black ${stats.openPositions > 0 ? 'text-trader-green' : 'text-slate-500'}`}>{stats.openPositions}</span>
                        </div>

                        <div className="p-5 bg-slate-950/50 border border-white/5 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Settings2 size={18} className="text-slate-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Diário (Trades)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateSettings({ maxTradesPerDay: settings.maxTradesPerDay - 1 })}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700 transition-colors"
                                >-</button>
                                <span className="w-8 text-center text-sm font-black text-white">{settings.maxTradesPerDay}</span>
                                <button
                                    onClick={() => updateSettings({ maxTradesPerDay: settings.maxTradesPerDay + 1 })}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700 transition-colors"
                                >+</button>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-950/50 border border-white/5 rounded-3xl flex flex-col gap-4">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <Activity size={18} className="text-slate-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite de Trades</span>
                                        <span className="text-[8px] font-black text-trader-cyan uppercase">Janela ({stats.currentInterval}): {stats.tradesThisWindow}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateSettings({ tradesPer15Min: Math.max(0, settings.tradesPer15Min - 1) })}
                                        className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700 transition-colors"
                                    >-</button>
                                    <span className="w-8 text-center text-sm font-black text-white">{settings.tradesPer15Min}</span>
                                    <button
                                        onClick={() => updateSettings({ tradesPer15Min: settings.tradesPer15Min + 1 })}
                                        className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700 transition-colors"
                                    >+</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 pt-2 border-t border-white/5">
                                {['1m', '15m', '30m', '1h', '1d', '1w', '1mo'].map(interval => (
                                    <button
                                        key={interval}
                                        onClick={() => updateSettings({ tradeLimitInterval: interval as any })}
                                        className={`py-1.5 rounded-lg border font-black text-[8px] uppercase transition-all ${settings.tradeLimitInterval === interval
                                            ? 'bg-trader-green/20 border-trader-green/40 text-slate-300 shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-600 hover:border-slate-700'
                                            }`}
                                    >
                                        {interval}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Robot Sensing Visualization */}
                        <div className="mt-4 p-6 bg-trader-green/5 border border-trader-green/20 rounded-[2rem] relative overflow-hidden">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="relative">
                                    <Fingerprint size={32} className={`text-trader-green transition-all duration-1000 ${settings.enabled ? 'animate-pulse scale-110' : 'opacity-60'}`} />
                                    {settings.enabled && (
                                        <div className="absolute inset-0 bg-trader-green/20 blur-xl animate-pulse"></div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Status do Sensor</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                        {settings.enabled ? 'Analisando Volume Institucional...' : 'Sensor Em Espera'}
                                    </p>
                                </div>
                            </div>

                            {/* Scanning line animation */}
                            {settings.enabled && (
                                <motion.div
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-px bg-trader-green/20 shadow-[0_0_10px_rgba(22,163,74,0.5)] z-0"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Institutional Analysis Cards */}
                {analysisData.length > 0 && (
                    <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Layers className="text-trader-cyan" size={20} />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Análise Institucional</h2>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-auto">
                                {stats.openPositions} posições abertas
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {analysisData.map((a) => {
                                const isBullish = a.direction === 'BUY';
                                const isReady = a.direction !== 'NEUTRAL' && a.score >= (settings?.entryScoreThreshold || 70);
                                return (
                                    <div key={a.symbol} className={`bg-slate-950/60 p-4 rounded-2xl border transition-all ${isReady
                                        ? 'border-trader-green/40 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                                        : 'border-white/5'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black text-white">{a.symbol}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter border ${isReady
                                                ? 'bg-trader-green/20 border-trader-green/30 text-trader-green'
                                                : a.direction === 'NEUTRAL'
                                                    ? 'bg-slate-800 border-slate-700 text-slate-500'
                                                    : 'bg-trader-red/20 border-trader-red/30 text-trader-red'
                                                }`}>
                                                {a.direction === 'NEUTRAL' ? 'NEUTRO' : a.direction}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1 mb-2">
                                            <span className={`text-lg font-black italic ${isBullish ? 'text-trader-green' : 'text-trader-red'}`}>
                                                {a.score}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-600 uppercase">/ {settings?.entryScoreThreshold || 70}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[7px] font-black text-slate-400 uppercase">
                                                {a.wyckoffPhase}
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[7px] font-black text-slate-400">
                                                RSI {a.rsi}
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[7px] font-black text-slate-400">
                                                VWAP {a.vwapDistance > 0 ? '+' : ''}{a.vwapDistance}%
                                            </span>
                                        </div>
                                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-tighter mt-2 truncate">{a.details}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Institutional Settings */}
                <div className="lg:col-span-3 bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Gauge className="text-trader-cyan" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Parâmetros Institucionais</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Score Threshold */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Score Mínimo</label>
                            <input
                                type="range"
                                min="40"
                                max="95"
                                value={settings.entryScoreThreshold}
                                onChange={(e) => updateSettings({ entryScoreThreshold: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-cyan"
                            />
                            <span className="text-xs font-black text-white">{settings.entryScoreThreshold}</span>
                        </div>

                        {/* Risk % */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Risco por Trade (%)</label>
                            <input
                                type="range"
                                min="0.1"
                                max="5"
                                step="0.1"
                                value={settings.maxRiskPerTrade}
                                onChange={(e) => updateSettings({ maxRiskPerTrade: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-red"
                            />
                            <span className="text-xs font-black text-white">{settings.maxRiskPerTrade}%</span>
                        </div>

                        {/* ATR SL */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">ATR Multiplicador SL</label>
                            <input
                                type="range"
                                min="0.5"
                                max="4"
                                step="0.1"
                                value={settings.atrMultiplierSL}
                                onChange={(e) => updateSettings({ atrMultiplierSL: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-red"
                            />
                            <span className="text-xs font-black text-white">{settings.atrMultiplierSL}x</span>
                        </div>

                        {/* ATR TP */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">ATR Multiplicador TP</label>
                            <input
                                type="range"
                                min="1"
                                max="8"
                                step="0.1"
                                value={settings.atrMultiplierTP}
                                onChange={(e) => updateSettings({ atrMultiplierTP: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-green"
                            />
                            <span className="text-xs font-black text-white">{settings.atrMultiplierTP}x</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {/* Trailing Activation */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Trailing Ativa em (%)</label>
                            <input
                                type="range"
                                min="10"
                                max="80"
                                step="5"
                                value={settings.trailingActivation * 100}
                                onChange={(e) => updateSettings({ trailingActivation: parseInt(e.target.value) / 100 })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-amber"
                            />
                            <span className="text-xs font-black text-white">{settings.trailingActivation * 100}% do TP</span>
                        </div>

                        {/* Breakeven Activation */}
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Breakeven Ativa em (%)</label>
                            <input
                                type="range"
                                min="5"
                                max="60"
                                step="5"
                                value={settings.breakevenActivation * 100}
                                onChange={(e) => updateSettings({ breakevenActivation: parseInt(e.target.value) / 100 })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-trader-cyan"
                            />
                            <span className="text-xs font-black text-white">{settings.breakevenActivation * 100}% do TP</span>
                        </div>

                        {/* Toggle Institutional Analysis */}
                        <div className="flex items-center">
                            <button
                                onClick={() => updateSettings({ useInstitutionalAnalysis: !settings.useInstitutionalAnalysis })}
                                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all w-full ${settings.useInstitutionalAnalysis
                                    ? 'bg-trader-green/10 border-trader-green/40 text-slate-300 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                                    : 'bg-slate-950/50 border-slate-800 text-slate-600'
                                    }`}
                            >
                                <Eye size={22} className={settings.useInstitutionalAnalysis ? 'text-trader-green' : ''} />
                                <span className={`text-[8px] font-black uppercase tracking-widest text-center ${settings.useInstitutionalAnalysis ? 'text-trader-green' : ''}`}>
                                    Análise Institucional {settings.useInstitutionalAnalysis ? 'ATIVA' : 'INATIVA'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Timeframe Selection */}
                <div className="lg:col-span-3 bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Activity className="text-trader-cyan" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Timeframe de Operação</h2>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
                        {['ALL', 'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'].map(tf => (
                            <button
                                key={tf}
                                onClick={() => updateSettings({ preferredTimeframe: tf })}
                                className={`py-3 rounded-2xl border font-black text-[10px] transition-all ${settings.preferredTimeframe === tf
                                    ? 'bg-trader-green/20 border-trader-green/40 text-slate-300 shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-105'
                                    : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'
                                    }`}
                            >
                                {tf === 'ALL' ? 'TODOS' : tf}
                            </button>
                        ))}
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mt-2">
                        O robô executará apenas sinais confirmados no timeframe selecionado.
                    </p>
                </div>

                {/* ==================== TRADE REPORT AREA ==================== */}
                <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trophy className="text-trader-green" size={24} />
                            <div>
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Relatório de Performance I.A.</h2>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Análise de Win/Loss e Assertividade Alpha</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${syncing
                                ? 'bg-trader-green/20 border-trader-green/40 text-trader-green cursor-wait'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-trader-green/10 hover:border-trader-green/30 hover:text-trader-green'
                                }`}
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Sincronizando...' : 'Sincronizar Trades'}
                        </button>
                    </div>

                    {/* Report KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Total Trades', value: report?.summary.totalTrades || 0, color: 'text-white', icon: <BarChart3 size={18} /> },
                            { label: '% Acerto', value: `${report?.summary.winRate || 0}%`, color: (report?.summary.winRate || 0) >= 60 ? 'text-trader-green' : 'text-trader-red', icon: <Percent size={18} /> },
                            { label: 'Lucro Total', value: `$${(report?.summary.totalProfit || 0).toFixed(2)}`, color: (report?.summary.totalProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <DollarSign size={18} /> },
                            { label: 'Profit Factor', value: report?.summary.profitFactor || 0, color: (report?.summary.profitFactor || 0) >= 1.5 ? 'text-trader-green' : 'text-trader-red', icon: <TrendingUp size={18} /> },
                            { label: 'Streak Atual', value: `${report?.summary.currentStreak || 0}x`, color: 'text-amber-400', icon: <Flame size={18} /> }
                        ].map((kpi, i) => (
                            <div key={i} className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 group hover:border-trader-green/30 transition-all">
                                <div className="flex items-center gap-2 mb-2" title={kpi.label === 'Profit Factor' ? 'Fator de Lucro: Ganho Bruto / Perda Bruta (Ideal > 1.5)' : undefined}>
                                    <span className="text-slate-600 group-hover:text-trader-green transition-colors">{kpi.icon}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${kpi.label === 'Profit Factor' ? 'cursor-help border-b border-slate-600 border-dotted text-slate-400' : 'text-slate-500'}`}>{kpi.label}</span>
                                </div>
                                <span className={`text-2xl font-black italic tracking-tighter ${kpi.color}`}>{kpi.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Asset / Trace Chart Placeholder or Summary */}
                    {report && report.summary.totalTrades > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black text-trader-green uppercase tracking-widest">{report.summary.wins} Vitórias</span>
                                <span className="text-[10px] font-black text-trader-red uppercase tracking-widest">{report.summary.losses} Derrotas</span>
                            </div>
                            <div className="h-4 bg-slate-950 rounded-full overflow-hidden flex border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${report.summary.winRate}%` }}
                                    className="bg-gradient-to-r from-trader-green to-emerald-400 h-full"
                                />
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${100 - report.summary.winRate}%` }}
                                    className="bg-gradient-to-r from-red-500 to-trader-red h-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Recent Trades Table */}
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
                                                        ? 'bg-trader-green/10 border-trader-green/30 text-trader-green'
                                                        : 'bg-trader-red/10 border-trader-red/30 text-trader-red'
                                                        }`}>
                                                        {trade.result}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-black text-white text-xs italic">XAUUSD</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black ${trade.type === 'BUY' ? 'text-trader-green' : 'text-trader-red'}`}>
                                                        {trade.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{trade.setup}</td>
                                                <td className={`px-6 py-4 text-right text-xs font-black italic ${trade.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
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
        </div>
    );
};
