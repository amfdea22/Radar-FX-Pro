import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FlaskConical, TrendingUp, TrendingDown, BarChart3, Target, Activity, Play, Cpu,
    Download, CheckCircle2, XCircle, Shield, Brain, RefreshCw, Settings,
    ChevronDown, ChevronUp, History, Upload, LineChart, List, Grid, Grip,
    DollarSign, Database, Zap, Layers, AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { EquityChart } from './EquityChart';
import { MineracaoDeEstrategia } from './MineracaoDeEstrategia';

const BACKTEST_API = 'http://localhost:5003';

interface BacktestMetrics {
    total_trades: number; win_trades: number; loss_trades: number;
    win_rate: number; total_pnl: number; total_return: number;
    avg_win: number; avg_loss: number; profit_factor: number;
    max_drawdown: number; max_drawdown_value: number;
    final_balance: number; initial_capital: number;
    sharpe_ratio: number; avg_bars_held: number;
}

interface Trade {
    ticket: number; symbol: string; action: string;
    entry_time: string; exit_time: string;
    entry_price: number; exit_price: number;
    volume: number; pnl: number; balance: number;
    comment: string; magic: number;
}

interface EquityPoint { time: string; equity: number; balance: number; margin: number; }
interface BacktestResult {
    job_id: string; status: string; metrics: BacktestMetrics;
    trades: Trade[]; equity_curve: EquityPoint[];
    config: any; error?: string;
}

interface StrategyInfo {
    id: string; name: string; description: string; engines: string[];
}

const CATEGORIES = [
    { id: 'all', name: 'Todos' },
    { id: 'forex', name: 'Forex' },
    { id: 'metal', name: 'Metais' },
    { id: 'crypto', name: 'Crypto' },
    { id: 'index', name: 'Índices' },
    { id: 'commodity', name: 'Commodities' },
];

const DATASOURCES = [
    { id: 'auto', name: 'Automático', icon: Database },
    { id: 'mt5', name: 'MT5', icon: Database },
    { id: 'litefinance', name: 'LiteFinance', icon: Database },
    { id: 'polygon', name: 'Polygon.io', icon: Database },
];

const STRATEGIES: StrategyInfo[] = [
    { id: 'smc', name: 'Smart Money Concepts', description: 'FVG + Order Blocks + Score (SMA/RSI/MACD/BB)', engines: ['AlphaRobot', 'SharkBot', 'GoldScalper'] },
    { id: 'trend', name: 'Trend Following', description: 'Cruzamento SMA com ATR trailing', engines: ['SwingTrader'] },
    { id: 'gold_scalper', name: 'Gold Scalper Grid', description: 'Grid trailing com MA200 + RSI para XAUUSD', engines: ['GoldScalper'] },
    { id: 'shark_bot', name: 'SharkBot FVG', description: 'Fair Value Gap + partial close + breakeven', engines: ['SharkBot'] },
    { id: 'bitcoin_pro', name: 'BitcoinPro EMA50/200', description: 'Score de entrada EMA + ATR + RSI para BTCUSD', engines: ['BitcoinPro'] },
    { id: 'xgboost', name: 'XGBoost Preditivo', description: 'ML prediction com fallback SMC', engines: [] },
];

export const BacktestPanel: React.FC = () => {
    const [symbol, setSymbol] = useState('EURUSD');
    const [symbolSearch, setSymbolSearch] = useState('');
    const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
    const [symbolFocused, setSymbolFocused] = useState(false);
    const [category, setCategory] = useState('all');
    const [instruments, setInstruments] = useState<Record<string, any>>({});
    const [timeframe, setTimeframe] = useState('1h');
    const defaultDateTo = new Date().toISOString().split('T')[0];
    const defaultDateFrom = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(defaultDateFrom);
    const [dateTo, setDateTo] = useState(defaultDateTo);
    const [dataSource, setDataSource] = useState('auto');
    const [strategy, setStrategy] = useState('smc');
    const [initialCapital, setInitialCapital] = useState(10000);
    const [commission, setCommission] = useState(3.0);
    const [leverage, setLeverage] = useState(100);
    const [fixedVolume, setFixedVolume] = useState(0.1);
    const [tpPips, setTpPips] = useState(50);
    const [slPips, setSlPips] = useState(20);
    const [useATR, setUseATR] = useState(false);
    const [maxPositions, setMaxPositions] = useState(1);
    const [gridMode, setGridMode] = useState(false);
    const [gridSpacing, setGridSpacing] = useState(100);
    const [gridLevels, setGridLevels] = useState(3);
    const [gridMultiplier, setGridMultiplier] = useState(1.5);
    const [useTrailing, setUseTrailing] = useState(true);
    const [partialClose, setPartialClose] = useState(0.5);
    const [minScore, setMinScore] = useState(40);

    const [result, setResult] = useState<BacktestResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'config' | 'results' | 'history' | 'mining'>('config');
    const [history, setHistory] = useState<any[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [dataPreview, setDataPreview] = useState<any[] | null>(null);
    const [dataLoading, setDataLoading] = useState(false);

    const normalizeResult = (h: any): BacktestResult => {
        if (!h) return h;
        if (h.metrics) return h;
        return {
            ...h,
            metrics: {
                total_trades: h.totalTrades || h.total_trades || 0,
                total_pnl: h.totalPnl || h.total_pnl || 0,
                total_return: h.totalReturn || h.total_return || 0,
                win_rate: h.winRate || h.win_rate || 0,
                profit_factor: h.profitFactor || h.profit_factor || 0,
                max_drawdown: h.maxDrawdown || h.max_drawdown || 0,
                sharpe_ratio: h.sharpeRatio || h.sharpe_ratio || 0,
                avg_win: h.avgWin || h.avg_win || 0,
                avg_loss: h.avgLoss || h.avg_loss || 0,
                avg_bars_held: h.avgBarsHeld || h.avg_bars_held || 0,
                initial_capital: h.initialCapital || h.initial_capital || 10000,
                final_balance: h.finalBalance || h.final_balance || 0,
            },
            data_source_actual: h.data_source_actual || h.dataSourceActual || 'unknown',
            is_synthetic: h.is_synthetic || h.isSynthetic || false,
        } as any;
    };

    const handleViewResults = (h: any) => {
        setResult(normalizeResult(h));
        setActiveTab('results');
    };

    useEffect(() => {
        axios.get(`${BACKTEST_API}/api/backtest/instruments`).then(r => setInstruments(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (jobId) {
            const interval = setInterval(async () => {
                try {
                    const { data } = await axios.get(`${BACKTEST_API}/api/backtest/status/${jobId}`);
                    if (data.status === 'completed' || data.status === 'error') {
                        setResult(normalizeResult(data));
                        setLoading(false);
                        setJobId(null);
                        clearInterval(interval);
                        loadHistory();
                    }
                } catch { }
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [jobId]);

    const loadHistory = async () => {
        try {
            const [pyHistory, nodeHistory] = await Promise.all([
                axios.get(`${BACKTEST_API}/api/backtest/history`).then(r => r.data).catch(() => []),
                axios.get('/api/backtest/node/history').then(r => r.data).catch(() => []),
            ]);
            const merged = [...(pyHistory || []), ...(nodeHistory || [])];
            merged.sort((a: any, b: any) => new Date(b.timestamp || b.runAt).getTime() - new Date(a.timestamp || a.runAt).getTime());
            setHistory(merged.slice(0, 30));
        } catch { }
    };

    useEffect(() => { loadHistory(); }, []);

    const handleFetchData = async () => {
        setDataLoading(true);
        setDataPreview(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/data/fetch`, {
                symbol, timeframe, bars: calcPeriodsFromRange(), source: dataSource,
                date_from: dateFrom, date_to: dateTo,
            });
            setDataPreview(data.data?.slice(-20) || []);
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setDataLoading(false);
        }
    };

    const calcPeriodsFromRange = () => {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const diffDays = Math.ceil((to.getTime() - from.getTime()) / (86400000));
        const tfHours = { '1m': 1/60, '5m': 5/60, '15m': 15/60, '30m': 0.5, '1h': 1, '4h': 4, '1d': 24, '1w': 168 }[timeframe] || 1;
        return Math.min(5000, Math.max(50, Math.ceil(diffDays * 24 / tfHours) + 100));
    };

    const buildConfig = () => ({
        symbol,
        timeframe,
        periods: calcPeriodsFromRange(),
        date_from: dateFrom,
        date_to: dateTo,
        data_source: dataSource,
        strategy,
        initial_capital: initialCapital,
        commission_per_lot: commission,
        leverage,
        fixed_volume: fixedVolume,
        tp_pips: tpPips,
        sl_pips: slPips,
        use_atr_sl: useATR,
        max_positions: maxPositions,
        grid_mode: gridMode,
        grid_spacing_pips: gridSpacing,
        grid_max_levels: gridLevels,
        grid_multiplier: gridMultiplier,
        use_trailing: useTrailing,
        partial_close_pct: partialClose,
        min_entry_score: minScore,
    });

    const handleRun = async () => {
        setLoading(true);
        setResult(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/run`, buildConfig());
            setJobId(data.job_id);
        } catch (err: any) {
            setResult({ status: 'error', error: err.response?.data?.error || err.message } as any);
            setLoading(false);
        }
    };

    const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        Object.entries(buildConfig()).forEach(([k, v]) => formData.append(k, String(v)));
        setLoading(true);
        setResult(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/run`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setJobId(data.job_id);
        } catch (err: any) {
            setResult({ status: 'error', error: err.response?.data?.error || err.message } as any);
            setLoading(false);
        }
    };

    const formatMoney = (v: number) => `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`;

    const exportTrades = () => {
        if (!result?.trades?.length) return;
        const csv = [
            'ticket,symbol,action,entry_time,exit_time,entry_price,exit_price,volume,pnl,balance,comment',
            ...result.trades.map(t =>
                `${t.ticket},${t.symbol},${t.action},${t.entry_time},${t.exit_time},${t.entry_price},${t.exit_price},${t.volume},${t.pnl},${t.balance},${t.comment}`
            )
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest_${result.job_id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const symbolRunCount: Record<string, number> = {};
    history.forEach((h: any) => {
        const sym = h.config?.symbol;
        if (sym) symbolRunCount[sym] = (symbolRunCount[sym] || 0) + 1;
    });
    const maxRunCount = Math.max(1, ...Object.values(symbolRunCount));

    const filteredInstruments = Object.entries(instruments)
        .filter(([sym, data]) => {
            if (category !== 'all' && (data as any).category !== category) return false;
            if (!symbolSearch) return true;
            const q = symbolSearch.toLowerCase();
            const name = ((data as any).name || sym).toLowerCase();
            return sym.toLowerCase().includes(q) || name.includes(q);
        })
        .sort(([aSym, aData], [bSym, bData]) => {
            const aRuns = symbolRunCount[aSym] || 0;
            const bRuns = symbolRunCount[bSym] || 0;
            if (aRuns !== bRuns) return bRuns - aRuns;
            return aSym.localeCompare(bSym);
        });

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <FlaskConical size={40} className="text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Backtest</span> Engine
                            <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs tracking-widest uppercase">v2.0</span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-amber-500" /> Motor Multi-Estratégia — 6 Robôs • 25+ Ativos • Grid • Multi-Posição
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <label className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl hover:bg-amber-500/20 transition-all flex items-center gap-2 cursor-pointer group">
                        <Upload size={18} className="group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">CSV</span>
                        <input type="file" accept=".csv" onChange={handleUploadCSV} className="hidden" />
                    </label>
                    <button onClick={handleRun} disabled={loading}
                        className="px-5 py-3 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                        {loading ? 'Processando...' : 'Executar'}
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Motor</span>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase">v2.0</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-900/40 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar w-fit">
                {(['config', 'results', 'history', 'mining'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-2 py-3 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                        {tab === 'config' && <Settings size={14} />}
                        {tab === 'results' && <BarChart3 size={14} />}
                        {tab === 'history' && <History size={14} />}
                        {tab === 'mining' && <Brain size={14} />}
                        {tab === 'config' ? 'Configuração' : tab === 'results' ? 'Resultados' : tab === 'history' ? 'Histórico' : 'Mineração'}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'config' && (
                    <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

                        {/* Data Source */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database size={14} className="text-amber-500" /> Fonte de Dados
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {DATASOURCES.map(ds => {
                                    const Icon = ds.icon;
                                    const isActive = dataSource === ds.id;
                                    return (
                                        <button key={ds.id} onClick={() => setDataSource(ds.id)}
                                            className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${isActive ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/40 border-white/5 hover:border-amber-500/20'}`}>
                                            <div className={`p-1.5 rounded-lg ${isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                                                <Icon size={14} />
                                            </div>
                                            <span className={`text-[10px] font-black ${isActive ? 'text-amber-400' : 'text-slate-400'}`}>{ds.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="space-y-2 relative">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Símbolo</label>
                                    <div className="flex gap-2">
                                        <select value={category} onChange={e => { setCategory(e.target.value); setShowSymbolDropdown(true); }}
                                            className="w-[90px] shrink-0 bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50">
                                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <div className="relative flex-1">
                                            <div className="flex bg-slate-950 border border-white/5 rounded-2xl overflow-hidden focus-within:border-amber-500/50">
                                                <input type="text"
                                                    value={symbolFocused ? symbolSearch : symbol}
                                                    onFocus={() => {
                                                        setSymbolFocused(true);
                                                        setShowSymbolDropdown(true);
                                                    }}
                                                    onBlur={() => setTimeout(() => { setSymbolFocused(false); setShowSymbolDropdown(false); }, 200)}
                                                    onChange={e => { setSymbolSearch(e.target.value); setShowSymbolDropdown(true); }}
                                                    placeholder="Buscar símbolo..."
                                                    className="flex-1 bg-transparent p-3 text-white text-[10px] font-black outline-none placeholder:text-slate-600" />
                                                <button onClick={() => setShowSymbolDropdown(v => !v)}
                                                    className="px-2 bg-transparent text-slate-500 hover:text-amber-400 transition-colors">
                                                    <ChevronDown size={14} className={`transition-transform ${showSymbolDropdown ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>
                                            {showSymbolDropdown && filteredInstruments.length > 0 && (
                                                <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-64 overflow-y-auto bg-slate-900 border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl black-scrollbar">
                                                    {filteredInstruments.map(([sym, data]: [string, any]) => {
                                                        const runs = symbolRunCount[sym] || 0;
                                                        const runWidth = Math.max(4, (runs / maxRunCount) * 60);
                                                        const isSelected = sym === symbol;
                                                        return (
                                                            <button key={sym}
                                                                onMouseDown={() => { setSymbol(sym); setSymbolSearch(''); setShowSymbolDropdown(false); }}
                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all border-b border-white/5 last:border-0 hover:bg-amber-500/10 ${isSelected ? 'bg-amber-500/15' : ''}`}>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-xs font-black ${isSelected ? 'text-amber-400' : 'text-white'}`}>{sym}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${data.category === 'forex' ? 'bg-emerald-500/20 text-emerald-400' : data.category === 'crypto' ? 'bg-purple-500/20 text-purple-400' : data.category === 'metal' ? 'bg-yellow-500/20 text-yellow-400' : data.category === 'index' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{data.category}</span>
                                                                    </div>
                                                                    <p className="text-[8px] text-slate-500 truncate mt-0.5">{data.name}</p>
                                                                </div>
                                                                <div className="flex items-center gap-3 shrink-0">
                                                                    <span className="text-[9px] font-mono text-slate-500">{data.spread_avg}p</span>
                                                                    {runs > 0 && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="h-1.5 bg-amber-500/30 rounded-full overflow-hidden w-[60px]">
                                                                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${runWidth}px` }}></div>
                                                                            </div>
                                                                            <span className="text-[8px] text-slate-500 font-mono">{runs}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Timeframe</label>
                                    <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50">
                                        {['1m','5m','15m','30m','1h','4h','1d','1w'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50 [color-scheme:dark]" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50 [color-scheme:dark]" />
                                </div>
                                <div className="space-y-2 flex flex-col justify-end">
                                    <button onClick={handleFetchData} disabled={dataLoading}
                                        className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl hover:bg-amber-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 justify-center">
                                        {dataLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                                        {dataLoading ? 'Baixando...' : 'Pré-visualizar Dados'}
                                    </button>
                                </div>
                            </div>
                            {dataPreview && (
                                <div className="mt-4 p-4 bg-slate-950/40 rounded-2xl border border-white/5 max-h-40 overflow-y-auto">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Últimas {dataPreview.length} barras — {symbol} {timeframe}</p>
                                    <div className="grid grid-cols-6 gap-2 text-[8px] font-mono">
                                        <span className="text-slate-600 font-black">Tempo</span>
                                        <span className="text-slate-600 font-black text-right">Open</span>
                                        <span className="text-slate-600 font-black text-right">High</span>
                                        <span className="text-slate-600 font-black text-right">Low</span>
                                        <span className="text-slate-600 font-black text-right">Close</span>
                                        <span className="text-slate-600 font-black text-right">Vol</span>
                                        {dataPreview.map((d: any, i: number) => (
                                            <React.Fragment key={i}>
                                                <span className="text-slate-400 truncate">{new Date(d.time).toLocaleString()}</span>
                                                <span className="text-slate-300 text-right">{d.open.toFixed(5)}</span>
                                                <span className="text-emerald-400 text-right">{d.high.toFixed(5)}</span>
                                                <span className="text-red-400 text-right">{d.low.toFixed(5)}</span>
                                                <span className="text-slate-300 text-right">{d.close.toFixed(5)}</span>
                                                <span className="text-slate-500 text-right">{d.volume}</span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Strategy Selection */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Brain size={14} className="text-amber-500" /> Estratégia
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {STRATEGIES.map(s => {
                                    const isActive = strategy === s.id;
                                    return (
                                        <button key={s.id} onClick={() => setStrategy(s.id)}
                                            className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${isActive ? 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/10' : 'bg-slate-950/40 border-white/5 hover:border-amber-500/30'}`}>
                                            <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                                                <Brain size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-xs font-black ${isActive ? 'text-amber-400' : 'text-slate-300'}`}>{s.name}</p>
                                                <p className="text-[8px] font-medium text-slate-500 mt-0.5 leading-tight">{s.description}</p>
                                                {s.engines.length > 0 && (
                                                    <div className="flex gap-1 mt-1.5 flex-wrap">
                                                        {s.engines.map(e => (
                                                            <span key={e} className="px-1.5 py-0.5 bg-slate-800 rounded text-[7px] font-black text-slate-400 uppercase tracking-wider">{e}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Capital & Risk */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <DollarSign size={14} className="text-amber-500" /> Capital & Risco
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                {[
                                    { label: 'Capital Inicial', val: initialCapital, set: setInitialCapital, step: 100 },
                                    { label: 'Comissão/Lote', val: commission, set: setCommission, step: 0.1 },
                                    { label: 'Alavancagem', val: leverage, set: setLeverage, step: 1 },
                                    { label: 'Volume Fixo', val: fixedVolume, set: setFixedVolume, step: 0.01 },
                                    { label: 'TP (pips)', val: tpPips, set: setTpPips, step: 1 },
                                    { label: 'SL (pips)', val: slPips, set: setSlPips, step: 1 },
                                ].map(f => (
                                    <div key={f.label} className="space-y-2">
                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">{f.label}</label>
                                        <input type="number" step={f.step} value={f.val} onChange={e => f.set(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Position Management & Grid */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Layers size={14} className="text-amber-500" /> Gerenciamento de Posições
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Max Posições</label>
                                    <input type="number" min={1} max={50} value={maxPositions} onChange={e => setMaxPositions(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                                </div>
                                <div className="space-y-2 flex flex-col justify-end">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Zap size={10} /> SL/TP por ATR
                                    </label>
                                    <button onClick={() => setUseATR(!useATR)}
                                        className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${useATR ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                                        {useATR ? 'ATR Ativo' : 'Pips Fixos'}
                                    </button>
                                </div>
                                <div className="space-y-2 flex flex-col justify-end">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Grid size={10} /> Grid Trading
                                    </label>
                                    <button onClick={() => setGridMode(!gridMode)}
                                        className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${gridMode ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                                        {gridMode ? 'Grid Ativo' : 'Grid Desligado'}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Grid Spacing (pips)</label>
                                    <input type="number" min={10} value={gridSpacing} onChange={e => setGridSpacing(Number(e.target.value))}
                                        disabled={!gridMode}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50 disabled:opacity-30" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Grid Níveis</label>
                                    <input type="number" min={1} max={20} value={gridLevels} onChange={e => setGridLevels(Number(e.target.value))}
                                        disabled={!gridMode}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50 disabled:opacity-30" />
                                </div>
                            </div>
                        </div>

                        {/* Advanced */}
                        <div>
                            <button onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors">
                                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {showAdvanced ? 'Ocultar' : 'Mostrar'} Avançado
                            </button>
                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/5">
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Multiplicador Grid</label>
                                                <input type="number" step={0.1} min={1} value={gridMultiplier} onChange={e => setGridMultiplier(Number(e.target.value))}
                                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                                            </div>
                                            <div className="space-y-2 flex flex-col justify-end">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Trailing Stop</label>
                                                <button onClick={() => setUseTrailing(!useTrailing)}
                                                    className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${useTrailing ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                                                    {useTrailing ? 'Ativo' : 'Inativo'}
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Partial Close (%)</label>
                                                <input type="number" min={0} max={1} step={0.1} value={partialClose} onChange={e => setPartialClose(Number(e.target.value))}
                                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Score Mínimo</label>
                                                <input type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))}
                                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'results' && (
                    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {loading && (
                            <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10">
                                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-sm font-black text-amber-400 animate-pulse uppercase tracking-widest">EXECUTANDO BACKTEST...</p>
                                <p className="text-[10px] text-slate-500 mt-2">{symbol} {timeframe} — Estratégia {strategy}</p>
                            </div>
                        )}
                        {!loading && !result && (
                            <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10">
                                <FlaskConical size={48} className="text-slate-600 mb-4" />
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum backtest executado</p>
                                <p className="text-[10px] text-slate-600 mt-2">Configure os parâmetros e clique em Executar</p>
                            </div>
                        )}
                        {result?.status === 'error' && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-8">
                                <div className="flex items-center gap-4 mb-2">
                                    <XCircle size={24} className="text-red-400 shrink-0" />
                                    <p className="text-sm font-black text-red-400 uppercase tracking-widest">Erro no Backtest</p>
                                </div>
                                <p className="text-xs text-slate-400 ml-10">{result.error}</p>
                            </div>
                        )}
                        {result?.metrics && result.status === 'completed' && (
                            <>
                                {(result as any).is_synthetic && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] p-4 mb-4 flex items-center gap-3">
                                        <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                                        <div>
                                            <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Dados Sintéticos</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Nenhuma fonte real disponível. Os resultados não refletem condições reais de mercado.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {result.metrics.error && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] p-4 mb-4 flex items-center gap-3">
                                        <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                                        <div>
                                            <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Sem Trades</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {result.metrics.error}. Tente aumentar o período de datas, alterar o timeframe, ou usar uma estratégia diferente.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                                                <BarChart3 className="text-amber-500" /> Métricas
                                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded text-[10px] tracking-widest uppercase">{result.trades?.length || 0} Trades</span>
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{symbol} | {timeframe} | {strategy}</p>
                                        </div>
                                        <button onClick={exportTrades}
                                            className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl hover:bg-amber-500/20 transition-all flex items-center gap-2">
                                            <Download size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">CSV</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {[
                                            { label: 'Período', desc: 'Tempo total analisado entre data início e fim',
                                              value: `${Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000))} dias`,
                                              icon: History, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                            { label: 'Total Trades', desc: 'Número total de ordens executadas no período', value: result.metrics.total_trades, icon: Activity, color: 'text-white', bg: 'bg-slate-800' },
                                            { label: 'Win Rate', desc: 'Percentual de trades lucrativos em relação ao total', value: `${result.metrics.win_rate}%`, icon: Target, color: result.metrics.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400', bg: result.metrics.win_rate >= 50 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
                                            { label: 'P&L Total', desc: 'Lucro ou prejuízo líquido acumulado no período', value: formatMoney(result.metrics.total_pnl), icon: TrendingUp, color: result.metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400', bg: result.metrics.total_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
                                            { label: 'Retorno', desc: 'Variação percentual do capital inicial ao final', value: `${result.metrics.total_return}%`, icon: TrendingUp, color: result.metrics.total_return >= 0 ? 'text-emerald-400' : 'text-red-400', bg: result.metrics.total_return >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
                                            { label: 'Profit Factor', desc: 'Razão entre lucro bruto e prejuízo bruto (>1.5 é saudável)', value: result.metrics.profit_factor > 900 ? '∞' : result.metrics.profit_factor.toFixed(2), icon: BarChart3, color: result.metrics.profit_factor >= 1.5 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-amber-500/10' },
                                            { label: 'Max Drawdown', desc: 'Maior queda do capital em relação ao pico anterior', value: `${result.metrics.max_drawdown}%`, icon: Shield, color: result.metrics.max_drawdown < 20 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-rose-500/10' },
                                            { label: 'Sharpe Ratio', desc: 'Retorno ajustado ao risco (>1 é bom, >2 é excelente)', value: result.metrics.sharpe_ratio?.toFixed(2) || 'N/A', icon: Activity, color: (result.metrics.sharpe_ratio || 0) >= 1 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-indigo-500/10' },
                                            { label: 'Avg Win', desc: 'Lucro médio por trade vencedor', value: formatMoney(result.metrics.avg_win), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                            { label: 'Avg Loss', desc: 'Prejuízo médio por trade perdedor', value: formatMoney(result.metrics.avg_loss), icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
                                            { label: 'Barras Média', desc: 'Média de candles que cada trade permaneceu aberto', value: result.metrics.avg_bars_held || '-', icon: Grip, color: 'text-slate-300', bg: 'bg-slate-800' },
                                        ].map((m, i) => {
                                            const Icon = m.icon;
                                            return (
                                                <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 group relative">
                                                    <div className={`p-2 rounded-xl ${m.bg} w-fit mb-2`}>
                                                        <Icon size={16} className={m.color} />
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                                                    <p className={`text-lg font-black italic ${m.color}`}>{m.value}</p>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-[10px] text-slate-300 rounded-xl border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                                        {m.desc}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <LineChart size={20} className="text-amber-500" />
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Curva de Capital</h3>
                                        <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">{symbol} | {timeframe}</span>
                                    </div>
                                    <div className="w-full h-64 sm:h-80 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                                        {result.equity_curve?.length > 0 ? (
                                            <EquityChart data={result.equity_curve} symbol={symbol} timeframe={timeframe} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <p className="text-[10px] text-slate-600">Dados insuficientes para o gráfico</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 overflow-hidden shadow-2xl">
                                    <div className="p-8 border-b border-white/5">
                                        <div className="flex items-center gap-3">
                                            <List size={20} className="text-amber-500" />
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Trades</h3>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto no-scrollbar">
                                        <table className="w-full text-left min-w-[700px]">
                                            <thead>
                                                <tr className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/50 border-b border-white/5">
                                                    <th className="p-3 font-medium">Ticket</th>
                                                    <th className="p-3 font-medium">Tipo</th>
                                                    <th className="p-3 font-medium">Setup</th>
                                                    <th className="p-3 font-medium">Ativo</th>
                                                    <th className="p-3 font-medium text-right">Volume</th>
                                                    <th className="p-3 font-medium text-right">P&L</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs divide-y divide-white/5">
                                                {result.trades?.slice(0, 30).map((t, i) => (
                                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-3 font-mono text-slate-500 font-bold">#{t.ticket}</td>
                                                        <td className="p-3">
                                                            <span className={`flex items-center gap-1.5 font-black ${t.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {t.action === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                                {t.action}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-amber-500/20 whitespace-nowrap">
                                                                {t.comment || strategy}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-black text-white">{t.symbol || symbol}</td>
                                                        <td className="p-3 text-right font-black text-slate-400">{t.volume}</td>
                                                        <td className={`p-3 text-right font-black font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {(!result.trades || result.trades.length === 0) && (
                                        <p className="text-xs text-slate-600 text-center py-8">Nenhum trade executado.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10">
                                <History size={48} className="text-slate-600 mb-4" />
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum backtest no histórico</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((h: any) => {
                                    const isWin = (h.metrics?.total_pnl || h.totalPnl || 0) >= 0;
                                    const strat = h.config?.strategy || h.strategy || 'smc';
                                    const sym = h.config?.symbol || h.symbol || '---';
                                    return (
                                        <div key={h.id || h.jobId} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-6 shadow-2xl relative overflow-hidden">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${isWin ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                                        {isWin ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-white italic uppercase tracking-tighter flex items-center gap-2 flex-wrap">
                                                            #{h.id || h.jobId}
                                                            <span className="text-[8px] font-black text-amber-400 uppercase">{strat.toUpperCase()}</span>
                                                            <span className="text-[8px] font-black text-slate-500 uppercase">{sym}</span>
                                                        </p>
                                                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                                                            {h.timestamp ? new Date(h.timestamp).toLocaleString() : '---'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-lg font-black italic ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {isWin ? '+' : ''}${(h.metrics?.total_pnl || h.totalPnl || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                                                {[
                                                    { label: 'Trades', value: h.metrics?.total_trades || h.totalTrades || 0 },
                                                    { label: 'Win Rate', value: `${h.metrics?.win_rate || h.winRate || 0}%` },
                                                    { label: 'Retorno', value: `${h.metrics?.total_return || h.totalReturn || 0}%` },
                                                    { label: 'Profit Factor', value: (h.metrics?.profit_factor || h.profitFactor || 0).toFixed(2) },
                                                    { label: 'Drawdown', value: `${h.metrics?.max_drawdown || h.maxDrawdown || 0}%` },
                                                    { label: 'Sharpe', value: h.metrics?.sharpe_ratio?.toFixed(2) || '-' },
                                                    { label: 'Capital', value: `$${h.metrics?.initial_capital || h.initialCapital || 0}` },
                                                    { label: 'Final', value: `$${h.metrics?.final_balance || h.finalBalance || 0}` },
                                                ].map((s, i) => (
                                                    <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                                                        <p className="text-xs font-black text-white">{s.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={() => handleViewResults(h)}
                                                className="mt-4 pt-4 border-t border-white/5 text-[8px] font-black text-amber-400 uppercase tracking-widest hover:text-amber-300 transition-colors flex items-center gap-1">
                                                <BarChart3 size={12} /> Ver Resultados →
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
                {activeTab === 'mining' && (
                    <motion.div key="mining" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/10 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
                        <MineracaoDeEstrategia trades={result?.trades || []} metrics={result?.metrics} history={history} onSelectHistory={handleViewResults} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
