import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BrainCircuit, TrendingUp, TrendingDown, Target, Shield, BarChart3,
    Zap, DollarSign, AlertTriangle, RefreshCw, Activity, Clock,
    Newspaper, Info, CheckCircle2, ChevronDown, ChevronUp, Search,
    ArrowUpRight, ArrowDownRight, Minus, Cpu, Star, CalendarDays
} from 'lucide-react';
import axios from 'axios';

interface AnalystReport {
    timestamp: number; symbol: string;
    direction: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidence: number; summary: string; score: number;
    technicalAnalysis: {
        trend: string; strength: number; shortTerm: string; longTerm: string;
        support: number; resistance: number;
        indicators: { name: string; value: string; signal: string }[];
    };
    fundamentalAnalysis: {
        newsSentiment: number; newsLabel: string; recentNews: any[];
        economicImpact: string; marketRegime: string; regimeDescription: string;
    };
    bestTimes: { hour: string; label: string; winRate: number; recommendation: string }[];
    statistics: {
        dailyAvgProfit: number; winRate: number; totalTrades: number;
        profitFactor: number; consecutiveWins: number; consecutiveLosses: number;
        avgWin: number; avgLoss: number; expectancy: number;
        bestDay: string; worstDay: string;
    };
    risks: { factor: string; level: string; description: string }[];
    recommendations: string[];
    economicEvents: { event: string; date: string; impact: string; currency: string; forecast: string; previous: string }[];
}

const DIRECTION_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    STRONG_BUY: { icon: ArrowUpRight, color: '#22c55e', bg: 'bg-emerald-500/20', label: 'COMPRA FORTE' },
    BUY: { icon: TrendingUp, color: '#34d399', bg: 'bg-emerald-500/15', label: 'COMPRA' },
    NEUTRAL: { icon: Minus, color: '#a78bfa', bg: 'bg-violet-500/15', label: 'NEUTRO' },
    SELL: { icon: TrendingDown, color: '#f97316', bg: 'bg-orange-500/15', label: 'VENDA' },
    STRONG_SELL: { icon: ArrowDownRight, color: '#ef4444', bg: 'bg-red-500/20', label: 'VENDA FORTE' },
};

const SYMBOLS = ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'US30', 'ETHUSD', 'USDJPY', 'SP500'];

export const AIAnalystPanel: React.FC = () => {
    const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD');
    const [report, setReport] = useState<AnalystReport | null>(null);
    const [overview, setOverview] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'analise' | 'overview' | 'multi'>('analise');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        tecnica: true, fundamental: true, horarios: true, riscos: true, recomendacoes: true,
    });

    const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    const fetchAnalysis = async (symbol: string) => {
        setLoading(true);
        try {
            const res = await axios.get('/api/mt5/ai-analyst/analyze', { params: { symbol } });
            setReport(res.data);
        } catch (e) { console.error('AI Analyst error:', e); }
        setLoading(false);
    };

    const fetchOverview = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/mt5/ai-analyst/market-overview');
            setOverview(res.data);
        } catch (e) { console.error('AI Analyst overview error:', e); }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'analise') fetchAnalysis(selectedSymbol);
        else if (activeTab === 'overview') fetchOverview();
    }, [activeTab, selectedSymbol]);

    const dc = (dir: string) => DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.NEUTRAL;
    const dirCfg = report ? dc(report.direction) : null;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-violet-500/10 rounded-3xl border border-violet-500/20 shadow-xl shadow-violet-500/10">
                        <BrainCircuit size={44} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500">AI</span> Analyst
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-violet-500/10 border border-violet-500/20 text-violet-500">
                                IA
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-violet-500" /> Agente de IA para Analise e Decisao de Trading
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 relative z-10">
                    <button onClick={() => { if (activeTab === 'analise') fetchAnalysis(selectedSymbol); else fetchOverview(); }}
                        className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-500 rounded-2xl hover:bg-violet-500/20 transition-all" title="Recarregar">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-1.5">
                {[
                    { key: 'analise', label: 'Analise de Ativo', icon: Search },
                    { key: 'overview', label: 'Visao Geral', icon: Activity },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                        className={`flex-1 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === tab.key ? 'bg-violet-500/20 text-violet-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'analise' && (
                <>
                    {/* SYMBOL SELECTOR */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {SYMBOLS.map(s => (
                            <button key={s} onClick={() => setSelectedSymbol(s)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${selectedSymbol === s ? 'bg-violet-500/20 border-violet-500/40 text-violet-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-violet-500/20'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    {report && !loading ? (
                        <>
                            {/* DIRECTION CARD */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className={`p-5 rounded-3xl ${dirCfg?.bg}`} style={{ borderColor: `${dirCfg?.color}30`, borderWidth: 1 }}>
                                            {dirCfg?.icon && <dirCfg.icon size={36} style={{ color: dirCfg.color }} />}
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Direcao Recomendada</p>
                                            <p className="text-3xl font-black italic" style={{ color: dirCfg?.color }}>{dirCfg?.label || 'ANALISE'}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] font-black text-slate-400">Confianca:</span>
                                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                                                        style={{ width: `${report.confidence}%` }} />
                                                </div>
                                                <span className="text-sm font-black text-violet-400">{report.confidence}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="text-center px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5">
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Score</p>
                                            <p className="text-xl font-black text-white">{report.score}</p>
                                        </div>
                                        <div className="text-center px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5">
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Tendencia</p>
                                            <p className="text-xl font-black" style={{ color: report.technicalAnalysis.trend === 'BULLISH' ? '#22c55e' : report.technicalAnalysis.trend === 'BEARISH' ? '#ef4444' : '#a78bfa' }}>
                                                {report.technicalAnalysis.trend}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-6 text-xs font-bold text-slate-400 leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    {report.summary}
                                </p>
                            </motion.div>

                            {/* TECHNICAL ANALYSIS */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('tecnica')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <BarChart3 className="text-cyan-400" size={18} /> Analise Tecnica
                                    </h3>
                                    {expandedSections.tecnica ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.tecnica && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Curto Prazo</p>
                                                        <p className="text-xs font-bold text-slate-300 mt-1">{report.technicalAnalysis.shortTerm}</p>
                                                    </div>
                                                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Longo Prazo</p>
                                                        <p className="text-xs font-bold text-slate-300 mt-1">{report.technicalAnalysis.longTerm}</p>
                                                    </div>
                                                </div>
                                                {report.technicalAnalysis.support > 0 && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                                                            <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Suporte</p>
                                                            <p className="text-lg font-black text-white">${report.technicalAnalysis.support.toFixed(2)}</p>
                                                        </div>
                                                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
                                                            <p className="text-[7px] font-black text-red-400 uppercase tracking-widest">Resistencia</p>
                                                            <p className="text-lg font-black text-white">${report.technicalAnalysis.resistance.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {report.technicalAnalysis.indicators.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Indicadores</p>
                                                        {report.technicalAnalysis.indicators.map((ind, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                                <span className="text-xs font-black text-white">{ind.name}</span>
                                                                <span className="text-[10px] font-bold text-slate-400">{ind.value}</span>
                                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${ind.signal === 'POSITIVO' ? 'bg-emerald-500/20 text-emerald-400' : ind.signal === 'NEGATIVO' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                                    {ind.signal}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* STATISTICS */}
                            {report.statistics.totalTrades > 0 && (
                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                        <Target className="text-emerald-400" size={18} /> Estatisticas do Ativo
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {[
                                            { label: 'Trades', value: report.statistics.totalTrades, color: 'text-white' },
                                            { label: 'Win Rate', value: `${report.statistics.winRate}%`, color: report.statistics.winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
                                            { label: 'P&L Medio/Dia', value: `$${report.statistics.dailyAvgProfit}`, color: report.statistics.dailyAvgProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                            { label: 'Profit Factor', value: report.statistics.profitFactor.toFixed(2), color: report.statistics.profitFactor >= 1.5 ? 'text-emerald-400' : report.statistics.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400' },
                                            { label: 'Expectativa', value: `$${report.statistics.expectancy.toFixed(2)}`, color: report.statistics.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                            { label: 'Avg Win', value: `$${report.statistics.avgWin.toFixed(2)}`, color: 'text-emerald-400' },
                                            { label: 'Avg Loss', value: `$${report.statistics.avgLoss.toFixed(2)}`, color: 'text-red-400' },
                                            { label: 'Cons. Wins', value: `${report.statistics.consecutiveWins}`, color: 'text-emerald-400' },
                                            { label: 'Cons. Losses', value: `${report.statistics.consecutiveLosses}`, color: report.statistics.consecutiveLosses >= 3 ? 'text-red-400' : 'text-slate-300' },
                                            { label: 'Melhor Dia', value: report.statistics.bestDay, color: 'text-emerald-400' },
                                            { label: 'Pior Dia', value: report.statistics.worstDay, color: 'text-red-400' },
                                        ].map((m, i) => (
                                            <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-white/5 text-center">
                                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                                                <p className={`text-sm font-black ${m.color}`}>{m.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* BEST TIMES */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('horarios')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <Clock className="text-amber-400" size={18} /> Melhores Horarios para Operar
                                    </h3>
                                    {expandedSections.horarios ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.horarios && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {report.bestTimes.map((t, i) => (
                                                    <div key={i} className={`p-4 rounded-2xl border text-center ${t.recommendation === 'ALTA' ? 'bg-emerald-500/10 border-emerald-500/20' : t.recommendation === 'MEDIA' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/50 border-white/5'}`}>
                                                        <p className="text-lg font-black text-white">{t.hour}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 mt-1">{t.label}</p>
                                                        <p className={`text-sm font-black mt-1 ${t.winRate >= 65 ? 'text-emerald-400' : 'text-amber-400'}`}>{t.winRate}% win rate</p>
                                                        <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-2 inline-block ${t.recommendation === 'ALTA' ? 'bg-emerald-500/20 text-emerald-400' : t.recommendation === 'MEDIA' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                            {t.recommendation}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* ECONOMIC EVENTS */}
                            {report.economicEvents.length > 0 && (
                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                        <CalendarDays className="text-amber-400" size={18} /> Eventos Economicos de Alto Impacto
                                    </h3>
                                    <div className="space-y-2">
                                        {report.economicEvents.map((ev, i) => (
                                            <div key={i} className="flex items-center justify-between bg-slate-950/40 p-4 rounded-xl border border-white/5">
                                                <div>
                                                    <p className="text-xs font-black text-white">{ev.event}</p>
                                                    <p className="text-[8px] text-slate-500">{ev.currency} • {ev.date}</p>
                                                </div>
                                                <div className="text-right text-[10px] font-bold text-slate-400">
                                                    <p>Prev: {ev.forecast} | Ant: {ev.previous}</p>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${ev.impact === 'ALTO' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {ev.impact}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* RISKS */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('riscos')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <Shield className="text-rose-400" size={18} /> Avaliacao de Riscos
                                    </h3>
                                    {expandedSections.riscos ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.riscos && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 space-y-2">
                                                {report.risks.map((r, i) => (
                                                    <div key={i} className={`p-4 rounded-2xl border ${r.level === 'CRITICO' ? 'bg-red-500/10 border-red-500/30' : r.level === 'ALTO' ? 'bg-orange-500/10 border-orange-500/20' : r.level === 'MEDIO' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${r.level === 'CRITICO' ? 'bg-red-500/20 text-red-400' : r.level === 'ALTO' ? 'bg-orange-500/20 text-orange-400' : r.level === 'MEDIO' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                                {r.level}
                                                            </span>
                                                            <span className="text-xs font-black text-white">{r.factor}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400">{r.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* RECOMMENDATIONS */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('recomendacoes')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <Star className="text-amber-400" size={18} /> Recomendacoes
                                    </h3>
                                    {expandedSections.recomendacoes ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.recomendacoes && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 space-y-2">
                                                {report.recommendations.map((rec, i) => (
                                                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                                        <CheckCircle2 size={14} className="text-violet-400 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-300">{rec}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <BrainCircuit size={48} className="text-violet-500 animate-pulse" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4 animate-bounce">Analisando mercado...</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-16 text-center">
                            <Search size={40} className="text-slate-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">Selecione um ativo para analisar</p>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'overview' && (
                overview ? (
                    <div className="space-y-6">
                        {/* TOP PICK */}
                        {overview.topPick && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent backdrop-blur-xl rounded-[2.5rem] border border-violet-500/30 p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                                <div className="relative z-10">
                                    <p className="text-[8px] font-black text-violet-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                                        <Star size={12} /> Top Pick do Analista
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-violet-500/10 rounded-2xl border border-violet-500/20">
                                            <BrainCircuit size={32} className="text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-black text-white italic">{overview.topPick.symbol}</p>
                                            <p className="text-sm font-bold text-slate-400 mt-1">{overview.topPick.summary}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-2xl font-black italic" style={{ color: dc(overview.topPick.direction).color }}>
                                                {dc(overview.topPick.direction).label}
                                            </p>
                                            <p className="text-lg font-black text-violet-400">Score: {overview.topPick.score}/100</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* OVERVIEW SUMMARY */}
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                            <p className="text-sm font-bold text-slate-300">{overview.summary}</p>
                        </div>

                        {/* ALL REPORTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {overview.reports?.map((r: AnalystReport, i: number) => {
                                const cfg = dc(r.direction);
                                return (
                                    <motion.div key={i} whileHover={{ y: -3 }}
                                        className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-5 hover:border-violet-500/20 transition-all">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${cfg.bg}`}>
                                                    <cfg.icon size={16} style={{ color: cfg.color }} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white">{r.symbol}</p>
                                                    <p className="text-[8px] text-slate-500 uppercase tracking-widest">{r.technicalAnalysis.trend}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black" style={{ color: cfg.color }}>{cfg.label}</p>
                                                <p className="text-[10px] font-black text-violet-400">{r.confidence}% conf.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-slate-950/40 p-2 rounded-xl">
                                                <p className="text-[7px] font-black text-slate-500 uppercase">Score</p>
                                                <p className="text-sm font-black text-white">{r.score}</p>
                                            </div>
                                            <div className="bg-slate-950/40 p-2 rounded-xl">
                                                <p className="text-[7px] font-black text-slate-500 uppercase">WR</p>
                                                <p className="text-sm font-black text-white">{r.statistics.winRate}%</p>
                                            </div>
                                            <div className="bg-slate-950/40 p-2 rounded-xl">
                                                <p className="text-[7px] font-black text-slate-500 uppercase">Risco</p>
                                                <p className={`text-sm font-black ${r.risks.some(x => x.level === 'CRITICO' || x.level === 'ALTO') ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {r.risks.some(x => x.level === 'CRITICO' || x.level === 'ALTO') ? 'ALTO' : 'BAIXO'}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <BrainCircuit size={48} className="text-violet-500 animate-pulse" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4 animate-bounce">Gerando visao geral...</p>
                    </div>
                ) : (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-16 text-center">
                        <Activity size={40} className="text-slate-600 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500">Nenhum dado disponivel</p>
                    </div>
                )
            )}
        </div>
    );
};
