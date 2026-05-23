import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import { Activity, TrendingUp, TrendingDown, Target, Zap, Clock, Search, Layers, ShieldCheck, ChevronRight, X, ChevronUp, ChevronDown, BarChart3, RefreshCw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AnalysisData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    rsi: number | null;
    ema9: number | null;
    ema21: number | null;
    sma200: number | null;
}

interface AnalysisResponse {
    symbol: string;
    timeframe: string;
    sentiment: string;
    data: AnalysisData[];
}

interface AuditSnapshot {
    id: string;
    timestamp: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    microTrend: 'up' | 'down' | 'neutral';
    macroTrend: 'up' | 'down' | 'neutral';
    sentimentScore: number;
    sentimentEmotion: string;
    candleTime: number;
    orderTicket?: number;
}

export const TechnicalAnalysisPanel: React.FC = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const [symbol, setSymbol] = useState('GOLD');
    const [timeframe, setTimeframe] = useState('H1');
    const [loading, setLoading] = useState(true);
    const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'error'>('offline');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
    const [auditHistory, setAuditHistory] = useState<AuditSnapshot[]>([]);
    const [selectedAudit, setSelectedAudit] = useState<AuditSnapshot | null>(null);
    const [auditPanelCollapsed, setAuditPanelCollapsed] = useState(false);
    const [mtfSentiments, setMtfSentiments] = useState<Record<string, string>>({});
    
    // Trade Form State
    const [lot, setLot] = useState(0.1);
    const [slPoints, setSlPoints] = useState(200);
    const [tpPoints, setTpPoints] = useState(400);
    const [executing, setExecuting] = useState(false);
    const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
    const majorSymbols = ['GOLD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'ETHUSD'];

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const response = await axios.get<AnalysisResponse>(`/api/mt5/analysis`, {
                params: { symbol, timeframe, count: 500 }
            });
            setAnalysis(response.data);
            updateChart(response.data.data);
            setConnStatus('online');
            setErrorMsg(null);
            
            if (!isSilent) {
                fetchMTFSummary();
                fetchAuditHistory();
            }
        } catch (error: any) {
            console.error('Failed to fetch technical analysis:', error);
            setConnStatus('error');
            const detail = error.response?.data?.details?.error || error.response?.data?.error || error.message;
            setErrorMsg(`Bridge Error: ${detail}`);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const fetchAuditHistory = async () => {
        try {
            const response = await axios.get<AuditSnapshot[]>(`/api/mt5/audit/history`);
            const filtered = response.data.filter(a => a.symbol === symbol);
            setAuditHistory(filtered);
        } catch (e) {
            console.error('Failed to fetch audit history:', e);
        }
    };

    const fetchMTFSummary = async () => {
        const tfs = ['M15', 'H1', 'H4', 'D1'];
        const results: Record<string, string> = {};
        for (const tf of tfs) {
            try {
                const res = await axios.get<AnalysisResponse>(`/api/mt5/analysis`, {
                    params: { symbol, timeframe: tf, count: 2 }
                });
                results[tf] = res.data.sentiment;
            } catch (e) {
                results[tf] = 'ERR';
            }
        }
        setMtfSentiments(results);
    };

    const handleTrade = async (action: 'BUY' | 'SELL') => {
        setExecuting(true);
        setOrderFeedback(null);
        try {
            const response = await axios.post('/api/mt5/order', {
                symbol,
                action,
                lot,
                sl_points: slPoints,
                tp_points: tpPoints,
                comment: `Rapid Analysis Entry (${timeframe})`
            });
            setOrderFeedback({ type: 'success', msg: `Ordem #${response.data.order_id} aberta!` });
            setTimeout(() => setOrderFeedback(null), 5000);
        } catch (error: any) {
            setOrderFeedback({ type: 'error', msg: error.response?.data?.error || 'Erro na execução' });
        } finally {
            setExecuting(false);
            fetchAuditHistory();
        }
    };

    const updateChart = (data: AnalysisData[]) => {
        if (!chartRef.current || !data || data.length === 0) return;
        const { mainSeries, ema9Series, ema21Series, sma200Series } = chartRef.current;

        const candleData: CandlestickData[] = data.map(d => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        mainSeries.setData(candleData);
        ema9Series.setData(data.filter(d => d.ema9 !== null).map(d => ({ time: d.time as any, value: d.ema9! })));
        ema21Series.setData(data.filter(d => d.ema21 !== null).map(d => ({ time: d.time as any, value: d.ema21! })));
        sma200Series.setData(data.filter(d => d.sma200 !== null).map(d => ({ time: d.time as any, value: d.sma200! })));

        if (auditHistory.length > 0) {
            const markers = auditHistory
                .map(audit => {
                    const timestamp = Math.floor(audit.timestamp / 1000);
                    const candle = data.reduce((prev, curr) => {
                        return (Math.abs(curr.time - timestamp) < Math.abs(prev.time - timestamp) ? curr : prev);
                    });

                    if (Math.abs(candle.time - timestamp) > 3600 * 24) return null;

                    return {
                        time: candle.time as any,
                        position: audit.type === 'BUY' ? 'belowBar' : 'aboveBar',
                        color: audit.type === 'BUY' ? '#10b981' : '#ef4444',
                        shape: audit.type === 'BUY' ? 'arrowUp' : 'arrowDown',
                        text: audit.type,
                        size: 2,
                        id: audit.id
                    };
                })
                .filter(m => m !== null);

            mainSeries.setMarkers(markers);
        }
    };

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
        });

        const mainSeries = chart.addCandlestickSeries({ upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444' });
        const ema9Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, title: 'EMA 9' });
        const ema21Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA 21' });
        const sma200Series = chart.addLineSeries({ color: '#6366f1', lineWidth: 2, title: 'SMA 200' });

        chartRef.current = { chart, mainSeries, ema9Series, ema21Series, sma200Series };

        const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
        window.addEventListener('resize', handleResize);
        
        fetchData();
        fetchAuditHistory();
        const interval = setInterval(() => {
            fetchData(true);
            fetchAuditHistory();
        }, 5000);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(interval);
            chart.remove();
        };
    }, []);

    useEffect(() => {
        fetchData();
        fetchAuditHistory();
    }, [symbol, timeframe]);

    const getSentimentColor = (sentiment: string) => {
        if (sentiment.includes('Bullish') || sentiment === 'Oversold') return 'text-trader-green';
        if (sentiment.includes('Bearish') || sentiment === 'Overbought') return 'text-trader-red';
        return 'text-slate-400';
    };

    const a = 'violet';
    const accent = 'violet-500';
    const accentLight = 'violet-400';
    const accentDark = 'purple-600';

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <BarChart3 size={40} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-600">Análise</span> Técnica
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${connStatus === 'online' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {connStatus === 'online' ? 'Online' : connStatus === 'error' ? 'Erro' : 'Offline'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-violet-400" /> Multi-Timeframe | EMA/SMA | Alpha Guard
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <div className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5">
                        {timeframes.map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${timeframe === tf ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-tighter transition-all border bg-slate-950 text-slate-300 hover:text-violet-400 hover:bg-slate-900 border-white/10 hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    >
                        <RefreshCw size={12} />
                        Sincronizar
                    </button>
                </div>
            </div>

            {/* CHART + SIDEBAR */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* CHART AREA */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20">
                                    <Activity size={18} className="text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Alpha Analysis Core</h3>
                                    <span className="text-lg font-black text-white italic tracking-tighter flex items-center gap-2">
                                        {symbol}
                                        <span className="text-slate-600 text-sm font-normal not-italic">({timeframe})</span>
                                    </span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${connStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                <span className="text-[8px] font-black uppercase tracking-tighter">{connStatus}</span>
                            </div>
                        </div>

                        <div ref={chartContainerRef} className="w-full relative min-h-[500px]">
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm z-10 rounded-2xl text-center flex-col gap-4">
                                    <Activity size={32} className="text-violet-400 animate-spin" />
                                    <span className="text-[10px] font-black text-slate-400 tracking-widest">SINCRONIZANDO COM MT5...</span>
                                </div>
                            )}
                            
                            {errorMsg && !loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-rose-500/5 backdrop-blur-sm z-10 rounded-2xl text-center flex-col gap-3">
                                    <ShieldCheck size={32} className="text-rose-500" />
                                    <span className="text-[11px] font-black text-white bg-rose-500/20 px-4 py-2 rounded-xl">{errorMsg}</span>
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest max-w-xs">
                                        Certifique-se de que o terminal MT5 no computador está aberto e conectado.
                                    </p>
                                    <button onClick={() => fetchData()} className="text-violet-400 font-black text-[9px] uppercase hover:underline mt-2">TENTAR NOVAMENTE</button>
                                </div>
                            )}

                            <AnimatePresence>
                                {auditHistory.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute top-4 right-4 z-20 flex flex-col gap-2 max-w-[200px]"
                                    >
                                        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck size={14} className="text-violet-400" />
                                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Auditoria Local</span>
                                                </div>
                                                <button 
                                                    onClick={() => setAuditPanelCollapsed(!auditPanelCollapsed)}
                                                    className="p-1 hover:bg-white/5 rounded-md text-slate-500 transition-colors"
                                                >
                                                    {auditPanelCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                                </button>
                                            </div>
                                            
                                            <AnimatePresence>
                                                {!auditPanelCollapsed && (
                                                    <motion.div 
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                                            {auditHistory.slice(0, 5).map(audit => (
                                                                <button 
                                                                    key={audit.id}
                                                                    onClick={() => setSelectedAudit(audit)}
                                                                    className={`w-full p-2 rounded-lg border flex items-center justify-between transition-all ${selectedAudit?.id === audit.id ? 'bg-violet-500/20 border-violet-500/50' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}
                                                                >
                                                                    <span className={`text-[7px] font-black ${audit.type === 'BUY' ? 'text-trader-green' : 'text-trader-red'}`}>{audit.type}</span>
                                                                    <span className="text-[7px] text-slate-500">{new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        
                                        {selectedAudit && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="bg-violet-500/10 backdrop-blur-md border border-violet-500/30 p-4 rounded-3xl shadow-2xl relative"
                                            >
                                                <button onClick={() => setSelectedAudit(null)} className="absolute top-2 right-2 text-slate-500 hover:text-white">
                                                    <X size={14} />
                                                </button>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Sentimento</span>
                                                        <span className={`text-[8px] font-black uppercase ${getSentimentColor(selectedAudit.sentimentEmotion)}`}>{selectedAudit.sentimentEmotion}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Macro Trend</span>
                                                        <span className={`text-[8px] font-black uppercase ${selectedAudit.macroTrend === 'up' ? 'text-trader-green' : selectedAudit.macroTrend === 'down' ? 'text-trader-red' : 'text-slate-400'}`}>{selectedAudit.macroTrend}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Micro Trend</span>
                                                        <span className={`text-[8px] font-black uppercase ${selectedAudit.microTrend === 'up' ? 'text-trader-green' : selectedAudit.microTrend === 'down' ? 'text-trader-red' : 'text-slate-400'}`}>{selectedAudit.microTrend}</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                                                        <span className="text-[10px] font-black text-white italic">{selectedAudit.sentimentScore.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Multi-Timeframe Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(mtfSentiments).map(([tf, sent]) => (
                            <div key={tf} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase mb-2">{tf}</span>
                                <span className={`text-[11px] font-black uppercase tracking-tighter ${getSentimentColor(sent)}`}>
                                    {sent}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SIDEBAR */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Execution Card */}
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
                                <Zap size={14} className="text-violet-400" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Execução Rápida</span>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Volume (Lote)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={lot}
                                    onChange={e => setLot(Number(e.target.value))}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-white font-black text-sm focus:border-violet-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Stop Loss (pts)</label>
                                    <input
                                        type="number"
                                        value={slPoints}
                                        onChange={e => setSlPoints(Number(e.target.value))}
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-white font-black text-sm focus:border-rose-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Take Profit (pts)</label>
                                    <input
                                        type="number"
                                        value={tpPoints}
                                        onChange={e => setTpPoints(Number(e.target.value))}
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-white font-black text-sm focus:border-emerald-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                disabled={executing}
                                onClick={() => handleTrade('BUY')}
                                className="flex-1 bg-trader-green hover:bg-trader-green/80 text-black font-black py-4 rounded-2xl transition-all flex flex-col items-center justify-center relative overflow-hidden group disabled:opacity-50"
                            >
                                <TrendingUp size={20} className="mb-1" />
                                <span className="text-[10px] uppercase tracking-tighter">BUY</span>
                            </button>
                            <button
                                disabled={executing}
                                onClick={() => handleTrade('SELL')}
                                className="flex-1 bg-trader-red hover:bg-trader-red/80 text-white font-black py-4 rounded-2xl transition-all flex flex-col items-center justify-center relative overflow-hidden group disabled:opacity-50"
                            >
                                <TrendingDown size={20} className="mb-1" />
                                <span className="text-[10px] uppercase tracking-tighter">SELL</span>
                            </button>
                        </div>

                        <AnimatePresence>
                            {orderFeedback && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={`mt-4 p-3 rounded-xl border text-[9px] font-black uppercase text-center ${orderFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-rose-500/10 border-rose-500 text-rose-500'}`}
                                >
                                    {orderFeedback.msg}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Sentiment & Symbols Selection */}
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sentiment Hub</p>
                            <div className={`text-[10px] font-black italic uppercase ${getSentimentColor(analysis?.sentiment || '')}`}>
                                {analysis?.sentiment || 'Neutral'}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {majorSymbols.map(sym => (
                                <button
                                    key={sym}
                                    onClick={() => setSymbol(sym)}
                                    className={`p-3 rounded-xl border transition-all text-left ${symbol === sym ? 'bg-violet-500/10 border-violet-500/50' : 'bg-slate-950/20 border-white/5 hover:border-white/10'}`}
                                >
                                    <span className={`text-[10px] font-black italic ${symbol === sym ? 'text-violet-400' : 'text-slate-400'}`}>{sym}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-violet-500/5 to-purple-600/5 p-6 rounded-[2rem] border border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck size={16} className="text-violet-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Alpha Guard</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            Execução direta via Alpha Analysis ignora filtros de horário, mas mantém o monitoramento do **Trade Guardian** para proteção de capital.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
