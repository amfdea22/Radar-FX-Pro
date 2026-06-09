import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cpu, BrainCircuit, TrendingUp, TrendingDown, Target, Shield, BarChart3,
    Zap, Activity, Clock, Newspaper, Info, CheckCircle2, ChevronDown, ChevronUp,
    Search, ArrowUpRight, ArrowDownRight, Minus, Star, AlertTriangle,
    RefreshCw, Layers, GitCompare, CalendarDays, GripHorizontal, Network,
    Settings, DollarSign, Percent, PauseCircle, PlayCircle, Gauge
} from 'lucide-react';
import axios from 'axios';

interface AgentResult {
    agent: string;
    weight: number;
    timestamp: string;
    symbol: string;
    bias?: string;
    confidence?: number;
    error?: string;
    [key: string]: any;
}

interface DecisionMatrix {
    [agentName: string]: {
        weight: number;
        bias: string;
        confidence: number;
        status?: string;
        error?: string;
        [key: string]: any;
    };
}

interface IntelReport {
    symbol: string;
    timestamp: string;
    orchestrator: string;
    agent_results: Record<string, AgentResult>;
    decision_matrix: DecisionMatrix;
    final_direction: string;
    final_confidence: number;
    summary: string;
    recommendations: string[];
    alerts: string[];
    session_info: {
        in_kill_zone: boolean;
        volatility_alert: boolean;
        optimal_hour: boolean;
    };
}

interface TelemetryData {
    timestamp: string;
    equity: number;
    balance: number;
    drawdown_aberto: number;
    drawdown_pct: number;
    daily_pnl: number;
    ordens_ativas: { ativo: string; tipo: string; volume: number; lucro: number; preco_abertura: number; preco_atual: number }[];
    connected: boolean;
    mode: string;
    xgboost_pred?: string;
    xgboost_confianca?: number;
}

interface BacktestResult {
    drawdown_backtest: {
        timestamp: string;
        metrics: {
            total_points: number;
            max_drawdown_pct: number;
            avg_drawdown_when_risky_pct: number;
            breaches: number;
            max_drawdown_limit: number;
            trades_blocked: number;
            trades_allowed: number;
            time_in_market_pct: number;
            protection_efficiency_pct: number;
        };
        config: { max_total_drawdown: number; max_daily_drawdown: number; risk_per_trade: number };
        summary: string;
    };
    lot_sizing_backtest: {
        initial_balance: number;
        fixed: { final_balance: number; return_pct: number; max_drawdown_pct: number; sharpe_approx: number };
        dynamic_risk_guardian: { final_balance: number; return_pct: number; max_drawdown_pct: number; sharpe_approx: number };
    };
}

interface RiskGuardianData {
    agent: string;
    weight: number;
    symbol: string;
    timestamp: string;
    current_price?: number;
    atr_pct?: number;
    atr_pips?: number;
    error?: string;
    trading_allowed?: boolean;
    block_reasons?: string[];
    equity?: {
        current_equity: number;
        peak_equity: number;
        current_drawdown_pct: number;
        daily_drawdown_pct: number;
        remaining_drawdown_pct: number;
        remaining_daily_pct: number;
        max_drawdown_limit: number;
        max_daily_limit: number;
        risk_level: string;
        lot_reduction_factor: number;
        prop_firm: string;
        profit_target_pct: number;
        profit_progress_pct: number;
    };
    spread?: {
        symbol: string;
        current_spread: number;
        avg_spread: number;
        max_allowed: number;
        atr_pips: number;
        blocked: boolean;
        spread_ratio: number;
        reason: string | null;
        data_points: number;
    };
    lot_sizing_example?: {
        suggested_lot: number;
        risk_amount: number;
        sl_pips: number;
        structure_type: string;
        equity_reduction: number;
        structure_multiplier: number;
        confidence_multiplier: number;
        risk_per_trade_pct: number;
    };
}

interface OverviewResponse {
    timestamp: string;
    total_assets: number;
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    top_pick: IntelReport | null;
    summary: string;
    reports: IntelReport[];
    alerts: string[];
    market_regime: { regime: string; description: string };
}

const DIRECTION_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    STRONG_BUY: { icon: ArrowUpRight, color: '#22c55e', bg: 'bg-emerald-500/20', label: 'COMPRA FORTE' },
    BUY: { icon: TrendingUp, color: '#34d399', bg: 'bg-emerald-500/15', label: 'COMPRA' },
    NEUTRAL: { icon: Minus, color: '#a78bfa', bg: 'bg-violet-500/15', label: 'NEUTRO' },
    SELL: { icon: TrendingDown, color: '#f97316', bg: 'bg-orange-500/15', label: 'VENDA' },
    STRONG_SELL: { icon: ArrowDownRight, color: '#ef4444', bg: 'bg-red-500/20', label: 'VENDA FORTE' },
};

const AGENT_META: Record<string, { icon: any; color: string; label: string; desc: string; tooltip: string }> = {
    bias_trend: { icon: GitCompare, color: '#22c55e', label: 'Bias & Trend', desc: 'Estrutura de Mercado SMC', tooltip: 'Analisa estrutura de mercado SMC (BOS/CHoCH), Order Blocks, Fair Value Gaps e forca de tendencia por SMA nos timeframes H4/H1/D1 para definir o vies direcional' },
    news_macro: { icon: Newspaper, color: '#f59e0b', label: 'News & Macro', desc: 'Calendario Economico', tooltip: 'Monitora eventos economicos de alto impacto (CPI, FOMC, Payroll, etc.) via FF Calendar e calcula desvio Actual vs Consensus para projetar impacto no DXY e ativos correlacionados' },
    quant_stats: { icon: BarChart3, color: '#06b6d4', label: 'Quant Stats', desc: 'Estatistica e ML', tooltip: 'Calcula Z-Score, RSI, Bandas de Bollinger, ATR e Momentum em M5/M15/H1/D1 para identificar reversao ou continuidade com probabilidade estatistica' },
    session_intel: { icon: Clock, color: '#8b5cf6', label: 'Session Intel', desc: 'Sessoes e Horarios', tooltip: 'Mapeia sessoes (Asia/Londres/NY/Overlaps) e Kill Zones, recomenda estrategia ideal (Breakout/Momentum/Mean Reversion) baseada no horario UTC e liquidez esperada' },
    ml_predictor: { icon: BrainCircuit, color: '#ec4899', label: 'ML Predictor', desc: 'XGBoost Direcional', tooltip: 'Modelo XGBoost treinado com features de retorno, volatilidade, distancia de media movel e volume para prever a direcao da proxima vela (alta/baixa)' },
};

const SYMBOLS = ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'US30', 'ETHUSD', 'USDJPY', 'SP500'];

export const IntelEnginePanel: React.FC = () => {
    const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD');
    const [report, setReport] = useState<IntelReport | null>(null);
    const [overview, setOverview] = useState<OverviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'analise' | 'overview' | 'risk' | 'monitor'>('analise');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        matriz: true, agentes: true, alertas: true, recomendacoes: true, overview: true,
    });
    const [serviceStatus, setServiceStatus] = useState<{ status: string; agents: string[]; weights: Record<string, number> } | null>(null);
    const [riskData, setRiskData] = useState<RiskGuardianData | null>(null);
    const [riskCfg, setRiskCfg] = useState({ balance: '100000', propFirm: 'FTMO', riskPerTrade: '1' });
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);


    const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    const fetchStatus = useCallback(async () => {
        try {
            const res = await axios.get('/api/intel-engine/status');
            setServiceStatus(res.data);
        } catch { }
    }, []);

    const fetchAnalysis = useCallback(async (symbol: string) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/intel-engine/analyze', { symbol });
            setReport(res.data);
        } catch (e) { console.error('Intel Engine error:', e); }
        setLoading(false);
    }, []);

    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/intel-engine/market-overview');
            setOverview(res.data);
        } catch (e) { console.error('Intel Engine overview error:', e); }
        setLoading(false);
    }, []);

    const fetchRiskAnalysis = useCallback(async (symbol: string) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/intel-engine/risk-guardian/analyze', { symbol });
            setRiskData(res.data);
        } catch (e) { console.error('Risk Guardian error:', e); }
        setLoading(false);
    }, []);

    const fetchTelemetry = useCallback(async () => {
        try {
            const res = await axios.get('/api/telemetry');
            setTelemetry(res.data);
        } catch { }
    }, []);

    useEffect(() => {
        if (activeTab === 'monitor') {
            fetchTelemetry();
            const interval = setInterval(fetchTelemetry, 2000);
            return () => clearInterval(interval);
        }
    }, [activeTab, fetchTelemetry]);

    const fetchBacktest = useCallback(async () => {
        setBacktestLoading(true);
        try {
            const res = await axios.post('/api/intel-engine/risk-guardian/backtest');
            setBacktestResult(res.data);
        } catch (e) { console.error('Backtest error:', e); }
        setBacktestLoading(false);
    }, []);

    const saveRiskConfig = useCallback(async () => {
        try {
            await axios.post('/api/intel-engine/risk-guardian/configure', {
                account_balance: parseFloat(riskCfg.balance),
                prop_firm: riskCfg.propFirm,
                risk_per_trade: parseFloat(riskCfg.riskPerTrade),
            });
            if (selectedSymbol) fetchRiskAnalysis(selectedSymbol);
        } catch (e) { console.error('Risk config error:', e); }
    }, [riskCfg, selectedSymbol, fetchRiskAnalysis]);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    useEffect(() => {
        if (activeTab === 'analise') fetchAnalysis(selectedSymbol);
        else if (activeTab === 'overview') fetchOverview();
        else if (activeTab === 'risk') fetchRiskAnalysis(selectedSymbol);
    }, [activeTab, selectedSymbol, fetchAnalysis, fetchOverview, fetchRiskAnalysis]);

    const dc = (dir: string) => DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.NEUTRAL;
    const dirCfg = report ? dc(report.final_direction) : null;

    const renderAgentIcon = (agentName: string) => {
        const meta = AGENT_META[agentName] || { icon: Cpu, color: '#64748b', label: agentName, desc: '' };
        const Icon = meta.icon;
        return { Icon, color: meta.color, label: meta.label, desc: meta.desc };
    };

    const getBiasBadge = (bias: string, confidence?: number) => {
        const colorMap: Record<string, string> = {
            BULLISH: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            BEARISH: 'text-red-400 bg-red-500/10 border-red-500/20',
            ATIVO_ALTA: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            ATIVO_QUEDA: 'text-red-400 bg-red-500/10 border-red-500/20',
            USD_ALTA: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            USD_QUEDA: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            ALTA_VOLATILIDADE: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
            KILL_ZONE_ATIVA: 'text-red-400 bg-red-500/10 border-red-500/20',
            BAIXA_VOLATILIDADE: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            ENTRE_SESSOES: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
            RANGING: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
            NEUTRO: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
            CAUTELA: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            AGUARDAR: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            SOBRECOMPRADO: 'text-red-400 bg-red-500/10 border-red-500/20',
            SOBREVENDIDO: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            ESTICADO_ALTA: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            ESTICADO_BAIXA: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        };
        const cls = colorMap[bias] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        return (
            <span className={`text-sm font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${cls}`}>
                {bias.replace(/_/g, ' ')} {confidence ? `${confidence}%` : ''}
            </span>
        );
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-cyan-500/10 rounded-3xl border border-cyan-500/20 shadow-xl shadow-cyan-500/10">
                        <Network size={44} className="text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Intel</span> Engine
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                                v1
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm mt-2 flex items-center gap-2">
                            <Layers size={12} className="text-cyan-500" /> Agente Colaborativo Multi-Agente de IA
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 relative z-10">
                    {serviceStatus && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-white/5">
                            <div className={`w-2 h-2 rounded-full ${serviceStatus.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                            <span className="text-[11px] font-black text-slate-400 uppercase">{serviceStatus.agents.length} agentes</span>
                        </div>
                    )}
                    <button onClick={() => { if (activeTab === 'analise') fetchAnalysis(selectedSymbol); else fetchOverview(); }}
                        className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 rounded-2xl hover:bg-cyan-500/20 transition-all" title="Recarregar">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-1.5">
                {[
                    { key: 'analise', label: 'Analise Multi-Agente', icon: Cpu },
                    { key: 'overview', label: 'Visao Geral do Mercado', icon: Activity },
                    { key: 'risk', label: 'Risk Guardian', icon: Shield },
                    { key: 'monitor', label: 'Terminal Monitor', icon: Activity },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                        className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === tab.key ? 'bg-cyan-500/20 text-cyan-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
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
                                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all border whitespace-nowrap ${selectedSymbol === s ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-cyan-500/20'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    {report && !loading ? (
                        <>
                            {/* DIRECTION CARD */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className={`p-5 rounded-3xl ${dirCfg?.bg}`} style={{ borderColor: `${dirCfg?.color}30`, borderWidth: 1 }}>
                                            {dirCfg?.icon && <dirCfg.icon size={36} style={{ color: dirCfg.color }} />}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Decisao Final do Orquestrador</p>
                                            <p className="text-3xl font-black italic" style={{ color: dirCfg?.color }}>{dirCfg?.label || 'ANALISE'}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-sm font-black text-slate-400">Confianca:</span>
                                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                                                        style={{ width: `${report.final_confidence}%` }} />
                                                </div>
                                                <span className="text-sm font-black text-cyan-400">{report.final_confidence}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="text-center px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5">
                                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Net Score</p>
                                            <p className="text-xl font-black text-white">
                                                {Object.values(report.decision_matrix || {}).reduce((acc: number, a: any) => acc + (a.bias === 'BULLISH' || a.bias === 'ATIVO_ALTA' ? a.confidence * a.weight : a.bias === 'BEARISH' || a.bias === 'ATIVO_QUEDA' ? -a.confidence * a.weight : 0), 0).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-center px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5">
                                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Agentes</p>
                                            <p className="text-xl font-black text-white">{Object.keys(report.agent_results).length}/4</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Session Info Badges */}
                                <div className="flex gap-2 mt-4">
                                    {report.session_info?.volatility_alert && (
                                        <span className="text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 uppercase tracking-widest">
                                            <AlertTriangle size={10} /> Alerta de Volatilidade
                                        </span>
                                    )}
                                    {report.session_info?.in_kill_zone && (
                                        <span className="text-sm font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 flex items-center gap-1 uppercase tracking-widest">
                                            <Zap size={10} /> Kill Zone Ativa
                                        </span>
                                    )}
                                    {report.session_info?.optimal_hour && (
                                        <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 uppercase tracking-widest">
                                            <Star size={10} /> Horario Otimo
                                        </span>
                                    )}
                                </div>

                                <p className="mt-4 text-xs font-bold text-slate-400 leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    {report.summary}
                                </p>

                                {/* Alerts */}
                                {report.alerts && report.alerts.length > 0 && (
                                    <div className="mt-4 space-y-1">
                                        {report.alerts.map((alert, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                                <AlertTriangle size={10} /> {alert}
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </motion.div>

                            {/* DECISION MATRIX */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('matriz')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <GripHorizontal className="text-cyan-400" size={18} /> Matriz de Decisao
                                            <span className="text-[11px] text-slate-500 ml-2 font-bold">Pesos: Bias 30% | News 25% | Quant 15% | ML 20% | Session 10%</span>
                                    </h3>
                                    {expandedSections.matriz ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.matriz && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {Object.entries(report.decision_matrix || {}).map(([agentName, data]) => {
                                                        const meta = AGENT_META[agentName] || { icon: Cpu, color: '#64748b', label: agentName, desc: '' };
                                                        const Icon = meta.icon;
                                                        const weightPct = Math.round((data.weight || 0) * 100);
                                                        return (
                                                            <div key={agentName} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all relative group">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon size={16} style={{ color: meta.color }} />
                                                                        <span className="text-xs font-black text-white">{meta.label}</span>
                                                                        <div className="relative">
                                                                            <Info size={12} className="text-slate-600 hover:text-cyan-400 cursor-help transition-colors" />
                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-xl bg-slate-800 border border-cyan-500/30 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                                                                                <p className="text-xs font-bold text-slate-300 leading-relaxed">{meta.tooltip}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-[11px] font-black text-slate-500">{weightPct}% peso</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>{getBiasBadge(data.bias, data.confidence)}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] text-slate-500">Confianca</span>
                                                                        <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                            <div className="h-full rounded-full transition-all" style={{
                                                                                width: `${data.confidence || 50}%`,
                                                                                background: (data.confidence || 50) >= 70 ? '#22c55e' : (data.confidence || 50) >= 50 ? '#f59e0b' : '#ef4444'
                                                                            }} />
                                                                        </div>
                                                                        <span className="text-sm font-black text-slate-400">{data.confidence || 50}%</span>
                                                                    </div>
                                                                </div>
                                                                {data.volatility_alert && (
                                                                    <div className="mt-2 text-[11px] font-bold text-amber-400">Alerta de Volatilidade</div>
                                                                )}
                                                                {data.in_kill_zone && (
                                                                    <div className="mt-2 text-[11px] font-bold text-red-400">Kill Zone Ativa</div>
                                                                )}
                                                                {data.regime && (
                                                                    <div className="mt-2 text-[11px] font-bold text-cyan-400">Regime: {data.regime.regime}</div>
                                                                )}
                                                                {data.structure && (
                                                                    <div className="mt-2 text-[11px] text-slate-400">
                                                                        {Object.entries(data.structure).map(([tf, s]) => (
                                                                            <span key={tf} className="mr-2">{tf}: <span className="font-bold text-white">{s as string}</span></span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* RAW AGENT RESULTS */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => toggleSection('agentes')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <Layers className="text-blue-400" size={18} /> Analise Detalhada dos Agentes
                                    </h3>
                                    {expandedSections.agentes ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {expandedSections.agentes && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 space-y-4">
                                                {Object.entries(report.agent_results || {}).map(([name, result]) => {
                                                    const { Icon, color, label, desc } = renderAgentIcon(name);
                                                    const err = result.error;
                                                    return (
                                                        <div key={name} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <Icon size={18} style={{ color }} />
                                                                <div>
                                                                    <p className="text-sm font-black text-white">{label}</p>
                                                                    <p className="text-[11px] text-slate-500">{desc}</p>
                                                                </div>
                                                                <div className="ml-auto text-right">
                                                                    <span className="text-[11px] font-black text-slate-500">Peso: {Math.round((result.weight || 0) * 100)}%</span>
                                                                </div>
                                                            </div>
                                                            {err ? (
                                                                <p className="text-sm font-bold text-red-400">Erro: {err}</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {result.inference?.reasoning?.map((r: string, i: number) => (
                                                                        <div key={i} className="flex items-start gap-2 text-sm font-bold text-slate-400">
                                                                            <Info size={10} className="text-cyan-500 mt-0.5 shrink-0" />
                                                                            <span>{r}</span>
                                                                        </div>
                                                                    ))}
                                                                    {result.relevant_events && result.relevant_events.length > 0 && (
                                                                        <div className="mt-3 space-y-1">
                                                                            <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Eventos Relevantes</p>
                                                                            {result.relevant_events.map((ev: any, i: number) => (
                                                                                <div key={i} className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-2 rounded-lg">
                                                                                    <span className="font-bold text-white">{ev.event}</span>
                                                                                    <span className="text-amber-400">{ev.impact} • {ev.diff_minutes > 0 ? `em ${Math.round(ev.diff_minutes)}min` : `${Math.abs(Math.round(ev.diff_minutes))}min atras`}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {result.timeframes && (
                                                                        <div className="mt-3">
                                                                            <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest mb-2">Timeframes</p>
                                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                                {(Array.isArray(result.timeframes) ? result.timeframes : Object.values(result.timeframes || {})).slice(0).reverse().map((tf: any, i: number) => (
                                                                                    <div key={i} className="bg-slate-900/40 p-2 rounded-xl border border-white/5 text-center">
                                                                                        <p className="text-sm font-black text-slate-500 uppercase">{tf.tf || tf.structure || i}</p>
                                                                                        <p className="text-xs font-black text-white">{tf.current_price || '-'}</p>
                                                                                        <p className={`text-sm font-black ${tf.status === 'SOBRECOMPRADO' ? 'text-red-400' : tf.status === 'SOBREVENDIDO' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                                                                            {tf.z_score !== undefined ? `Z: ${tf.z_score}` : ''}{tf.rsi !== undefined ? ` | RSI: ${tf.rsi}` : ''}
                                                                                        </p>
                                                                                        <p className="text-sm text-slate-500">{tf.reversal_probability !== undefined ? `Rev: ${tf.reversal_probability}%` : tf.trend_strength !== undefined ? `Forca: ${tf.trend_strength}` : ''}</p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {result.active_sessions && result.active_sessions.length > 0 && (
                                                                        <div className="mt-3">
                                                                            <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-2">Sessoes Ativas</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {(result.active_sessions || []).map((s: any, i: number) => (
                                                                                    <span key={i} className="text-sm font-bold text-slate-300 bg-slate-800/50 px-2 py-1 rounded-lg border border-white/5">{typeof s === 'string' ? s : s.name || s.name_en || s.key || JSON.stringify(s)}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* RECOMMENDATIONS */}
                            {report.recommendations && report.recommendations.length > 0 && (
                                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                    <button onClick={() => toggleSection('recomendacoes')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                            <Star className="text-amber-400" size={18} /> Recomendacoes dos Agentes
                                        </h3>
                                        {expandedSections.recomendacoes ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                    </button>
                                    <AnimatePresence>
                                        {expandedSections.recomendacoes && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                <div className="px-8 pb-6 space-y-2">
                                                    {report.recommendations.map((rec, i) => (
                                                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-xl border border-white/5">
                                                            <CheckCircle2 size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                                                            <p className="text-xs font-bold text-slate-300">{rec}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Network size={48} className="text-cyan-500 animate-pulse" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mt-4 animate-bounce">Coordenando agentes...</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-16 text-center">
                            <Cpu size={40} className="text-slate-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">Selecione um ativo para analise multi-agente</p>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'overview' && (
                overview ? (
                    <div className="space-y-6">
                        {/* MARKET REGIME */}
                        {overview.market_regime && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Regime de Mercado</p>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm font-black ${overview.market_regime.regime === 'OTIMISTA' ? 'text-emerald-400' : overview.market_regime.regime === 'PESSIMISTA' ? 'text-red-400' : 'text-cyan-400'}`}>
                                        {overview.market_regime.regime}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400">{overview.market_regime.description}</span>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <span className="text-sm font-black text-emerald-400">{overview.bullish_count} Compra</span>
                                    <span className="text-sm font-black text-red-400">{overview.bearish_count} Venda</span>
                                    <span className="text-sm font-black text-slate-400">{overview.neutral_count} Neutro</span>
                                </div>
                            </motion.div>
                        )}

                        {/* TOP PICK */}
                        {overview.top_pick && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent backdrop-blur-xl rounded-[2.5rem] border border-cyan-500/30 p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                                <div className="relative z-10">
                                    <p className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                                        <Star size={12} /> Top Pick do Intel Engine
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                                            <Network size={32} className="text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-black text-white italic">{overview.top_pick.symbol}</p>
                                            <p className="text-sm font-bold text-slate-400 mt-1">{overview.top_pick.summary}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-2xl font-black italic" style={{ color: dc(overview.top_pick.final_direction).color }}>
                                                {dc(overview.top_pick.final_direction).label}
                                            </p>
                                            <p className="text-lg font-black text-cyan-400">Confianca: {overview.top_pick.final_confidence}%</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ALERTS */}
                        {overview.alerts && overview.alerts.length > 0 && (
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                                <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <AlertTriangle size={12} /> Alertas do Mercado
                                </p>
                                <div className="space-y-1">
                                    {overview.alerts.map((alert, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm font-bold text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                            <Zap size={10} /> {alert}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ALL REPORTS SIDE BY SIDE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {overview.reports?.map((r: IntelReport, i: number) => {
                                const cfg = dc(r.final_direction);
                                const netScore = Object.values(r.decision_matrix || {}).reduce((acc: number, a: any) =>
                                    acc + (a.bias === 'BULLISH' || a.bias === 'ATIVO_ALTA' ? a.confidence * a.weight :
                                        a.bias === 'BEARISH' || a.bias === 'ATIVO_QUEDA' ? -a.confidence * a.weight : 0), 0);
                                const [expanded, setExpanded] = React.useState(false);
                                return (
                                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                        whileHover={{ y: -2 }}
                                        className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all overflow-hidden">
                                        {/* Header */}
                                        <div className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${cfg.bg}`}>
                                                        <cfg.icon size={16} style={{ color: cfg.color }} />
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white">{r.symbol}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Score: {netScore.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black" style={{ color: cfg.color }}>{cfg.label}</p>
                                                    <p className="text-[11px] font-black text-cyan-400">{r.final_confidence}%</p>
                                                </div>
                                            </div>
                                            {/* Agent bars */}
                                            <div className="flex gap-1 mb-2">
                                                {Object.entries(r.decision_matrix || {}).map(([name, d]: [string, any]) => {
                                                    const m = AGENT_META[name] || { icon: Cpu, color: '#64748b', label: '', desc: '' };
                                                    const isBull = d.bias === 'BULLISH' || d.bias === 'ATIVO_ALTA';
                                                    const isBear = d.bias === 'BEARISH' || d.bias === 'ATIVO_QUEDA';
                                                    return (
                                                        <div key={name} className="flex-1 bg-slate-950/40 rounded-lg p-1.5 text-center border border-white/5"
                                                            title={`${m.label}: ${d.bias} ${d.confidence}%`}>
                                                            <div className="w-full h-1 rounded-full bg-slate-800 mb-1 overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all ${isBull ? 'bg-emerald-400' : isBear ? 'bg-red-400' : 'bg-slate-500'}`}
                                                                    style={{ width: `${d.confidence || 50}%` }} />
                                                            </div>
                                                            <p className={`text-[7px] font-black uppercase ${isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-slate-400'}`}>
                                                                {d.confidence}%
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Alerts */}
                                            {r.alerts && r.alerts.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {r.alerts.slice(0, 2).map((a, ai) => (
                                                        <span key={ai} className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                                            <AlertTriangle size={7} /> {a.length > 40 ? a.slice(0, 40) + '...' : a}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Summary */}
                                            <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed line-clamp-2">{r.summary}</p>
                                            {/* Expand */}
                                            <button onClick={() => setExpanded(!expanded)}
                                                className="mt-2 text-[10px] font-black text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1 uppercase tracking-wider">
                                                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                {expanded ? 'Menos detalhes' : 'Mais detalhes'}
                                            </button>
                                        </div>
                                        {/* Expanded details */}
                                        <AnimatePresence>
                                            {expanded && (
                                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                    <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                                                        {/* Recommendation badges */}
                                                        {r.recommendations && r.recommendations.length > 0 && (
                                                            <div>
                                                                <p className="text-[9px] font-black text-cyan-400 uppercase tracking-widest mb-1">Recomendacoes</p>
                                                                <div className="space-y-1">
                                                                    {r.recommendations.slice(0, 3).map((rec, ri) => (
                                                                        <p key={ri} className="text-[10px] font-bold text-slate-400 flex items-start gap-1.5">
                                                                            <CheckCircle2 size={9} className="text-cyan-500 mt-0.5 shrink-0" /> {rec}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Full agent breakdown */}
                                                        <div>
                                                            <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">Agentes</p>
                                                            <div className="space-y-1">
                                                                {Object.entries(r.decision_matrix || {}).map(([name, d]: [string, any]) => {
                                                                    const m = AGENT_META[name] || { icon: Cpu, color: '#64748b', label: name, desc: '' };
                                                                    const Icon = m.icon;
                                                                    return (
                                                                        <div key={name} className="flex items-center justify-between bg-slate-950/40 p-1.5 rounded-lg border border-white/5">
                                                                            <div className="flex items-center gap-2">
                                                                                <Icon size={10} style={{ color: m.color }} />
                                                                                <span className="text-[10px] font-bold text-white">{m.label}</span>
                                                                            </div>
                                                                            {getBiasBadge(d.bias, d.confidence)}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* Session info */}
                                                        {r.session_info && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {r.session_info.volatility_alert && (
                                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Alta Volatilidade</span>
                                                                )}
                                                                {r.session_info.in_kill_zone && (
                                                                    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Kill Zone</span>
                                                                )}
                                                                {r.session_info.optimal_hour && (
                                                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Horario Otimo</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Network size={48} className="text-cyan-500 animate-pulse" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mt-4 animate-bounce">Gerando visao geral multi-agente...</p>
                    </div>
                ) : (
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-16 text-center">
                        <Activity size={40} className="text-slate-600 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500">Nenhum dado disponivel</p>
                    </div>
                )
            )}

            {activeTab === 'monitor' && (
                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={14} className="text-cyan-400" /> Terminal em Tempo Real
                            </p>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${telemetry?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                                <span className="text-[11px] font-black text-slate-400 uppercase">{telemetry?.mode || '---'}</span>
                                <span className="text-[11px] text-slate-600">| {telemetry?.timestamp || '---'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Equity', value: telemetry ? `$${telemetry.equity.toLocaleString()}` : '---', color: telemetry && telemetry.equity >= telemetry.balance ? 'text-emerald-400' : 'text-red-400' },
                                { label: 'Balance', value: telemetry ? `$${telemetry.balance.toLocaleString()}` : '---', color: 'text-white' },
                                { label: 'Drawdown', value: telemetry ? `${telemetry.drawdown_pct}%` : '---', color: telemetry && telemetry.drawdown_pct > 5 ? 'text-red-400' : telemetry && telemetry.drawdown_pct > 2 ? 'text-amber-400' : 'text-emerald-400' },
                                { label: 'Daily P&L', value: telemetry ? `$${telemetry.daily_pnl.toLocaleString()}` : '---', color: telemetry && telemetry.daily_pnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                            ].map((m, mi) => (
                                <div key={mi} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-center">
                                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{m.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Positions */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BarChart3 size={14} className="text-amber-400" /> Ordens Abertas ({telemetry?.ordens_ativas?.length || 0})
                        </p>
                        {telemetry?.ordens_ativas && telemetry.ordens_ativas.length > 0 ? (
                            <div className="space-y-2">
                                {telemetry.ordens_ativas.map((ordem, i) => (
                                    <div key={i} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-black ${ordem.tipo === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {ordem.tipo === 'BUY' ? '▲' : '▼'} {ordem.tipo}
                                            </span>
                                            <span className="text-sm font-black text-white">{ordem.ativo}</span>
                                            <span className="text-sm font-bold text-slate-400">{ordem.volume} lotes</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">${ordem.preco_abertura.toFixed(2)} → ${ordem.preco_atual.toFixed(2)}</span>
                                            <span className={`text-sm font-black ${ordem.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                ${ordem.lucro.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-sm font-bold text-slate-500">Nenhuma ordem aberta no momento</p>
                                {!telemetry?.connected && (
                                    <p className="text-xs text-slate-600 mt-2">Modo simulado — conecte ao MT5 para dados reais</p>
                                )}
                            </div>
                        )}
                    </motion.div>

                    {/* XGBoost Prediction */}
                    {telemetry?.xgboost_pred && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BrainCircuit size={14} className="text-pink-400" /> Previsao XGBoost em Tempo Real
                            </p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${telemetry.xgboost_pred === 'BULLISH' ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
                                        <span className={`text-2xl font-black ${telemetry.xgboost_pred === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {telemetry.xgboost_pred === 'BULLISH' ? '▲ COMPRA' : '▼ VENDA'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-black text-white">{telemetry.xgboost_confianca}%</p>
                                        <p className="text-xs font-bold text-slate-500">Confianca Direcional</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500">Alvo: XAUUSD</p>
                                    <p className="text-[10px] font-bold text-slate-500">Modelo: XGBoost M15</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Status da Conexao */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Info size={14} className="text-cyan-400" /> Status da Conexao
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                            <div className="flex justify-between font-bold">
                                <span className="text-slate-400">Bridge MT5</span>
                                <span className={telemetry?.connected ? 'text-emerald-400' : 'text-amber-400'}>{telemetry?.connected ? 'Conectado' : 'Simulado'}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span className="text-slate-400">Modo</span>
                                <span className="text-white">{telemetry?.mode || '---'}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span className="text-slate-400">XGBoost</span>
                                <span className={telemetry?.xgboost_pred ? 'text-emerald-400' : 'text-slate-500'}>{telemetry?.xgboost_pred ? 'Ativo' : 'Aguardando'}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {activeTab === 'risk' && (
                <>
                    {/* SYMBOL SELECTOR + CONFIG */}
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                        <div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Ativo</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {SYMBOLS.map(s => (
                                    <button key={s} onClick={() => setSelectedSymbol(s)}
                                        className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all border whitespace-nowrap ${selectedSymbol === s ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-amber-500/20'}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-end gap-3">
                            <div>
                                <p className="text-[11px] font-black text-slate-500 mb-1">Prop-Firm</p>
                                <select value={riskCfg.propFirm} onChange={e => setRiskCfg(p => ({ ...p, propFirm: e.target.value }))}
                                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white">
                                    {['FTMO', 'MFF', 'FUNDEDNEXT', 'THE_FUNDED_TRADER'].map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-500 mb-1">Saldo</p>
                                <input type="number" value={riskCfg.balance} onChange={e => setRiskCfg(p => ({ ...p, balance: e.target.value }))}
                                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white w-24" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-500 mb-1">Risco %</p>
                                <input type="number" value={riskCfg.riskPerTrade} onChange={e => setRiskCfg(p => ({ ...p, riskPerTrade: e.target.value }))}
                                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white w-16" step="0.1" />
                            </div>
                            <button onClick={saveRiskConfig}
                                className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-all text-sm font-black uppercase tracking-wider">
                                <Settings size={14} className="inline mr-1" /> Aplicar
                            </button>
                        </div>
                    </div>

                    {riskData && !loading ? (
                        <>
                            {/* TRADING ALLOWED BANNER */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className={`rounded-[2.5rem] p-6 border relative overflow-hidden ${riskData.trading_allowed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                <div className="flex items-center gap-4">
                                    {riskData.trading_allowed ? (
                                        <><PlayCircle size={40} className="text-emerald-400" />
                                            <div><p className="text-2xl font-black text-emerald-400 uppercase italic">Trading Liberado</p>
                                                <p className="text-sm font-bold text-emerald-300/70">Nenhum bloqueio de risco ativo</p></div></>
                                    ) : (
                                        <><PauseCircle size={40} className="text-red-400" />
                                            <div><p className="text-2xl font-black text-red-400 uppercase italic">Trading Bloqueado</p>
                                                <p className="text-sm font-bold text-red-300/70">Risco acima do limite permitido</p></div></>
                                    )}
                                </div>
                                {riskData.block_reasons && riskData.block_reasons.length > 0 && (
                                    <div className="mt-4 space-y-1">
                                        {riskData.block_reasons.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm font-bold text-amber-400 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                                                <AlertTriangle size={14} /> {r}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>

                            {/* THREE COLUMN RISK METRICS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* EQUITY / DRAWDOWN */}
                                {riskData.equity && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <DollarSign size={14} className="text-amber-400" /> Equity & Drawdown
                                        </p>
                                        {/* Drawdown gauge */}
                                        <div className="flex flex-col items-center mb-4">
                                            <div className="relative w-28 h-14 overflow-hidden mb-2">
                                                <div className="absolute bottom-0 left-0 w-full h-full bg-slate-800 rounded-t-full"></div>
                                                <div className="absolute bottom-0 left-0 h-full rounded-t-full transition-all duration-500" style={{
                                                    width: `${Math.min(100, riskData.equity.current_drawdown_pct / riskData.equity.max_drawdown_limit * 100)}%`,
                                                    background: riskData.equity.risk_level === 'CRITICAL' ? '#ef4444' : riskData.equity.risk_level === 'HIGH' ? '#f97316' : riskData.equity.risk_level === 'MODERATE' ? '#eab308' : '#22c55e',
                                                }}></div>
                                            </div>
                                            <p className={`text-2xl font-black ${riskData.equity.risk_level === 'CRITICAL' ? 'text-red-400' : riskData.equity.risk_level === 'HIGH' ? 'text-orange-400' : riskData.equity.risk_level === 'MODERATE' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                                {riskData.equity.current_drawdown_pct}%
                                            </p>
                                            <p className="text-xs font-bold text-slate-500">Drawdown Atual / {riskData.equity.max_drawdown_limit}% max</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Equity</span>
                                                <span className="text-white">${riskData.equity.current_equity.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Daily Drawdown</span>
                                                <span className={riskData.equity.daily_drawdown_pct > riskData.equity.max_daily_limit * 0.7 ? 'text-red-400' : 'text-white'}>
                                                    {riskData.equity.daily_drawdown_pct}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Limite Restante</span>
                                                <span className="text-emerald-400">{riskData.equity.remaining_drawdown_pct}%</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Lucro alvo</span>
                                                <span className="text-cyan-400">{riskData.equity.profit_progress_pct}% / {riskData.equity.profit_target_pct}%</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Nivel Risco</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black uppercase ${riskData.equity.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : riskData.equity.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : riskData.equity.risk_level === 'MODERATE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {riskData.equity.risk_level}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Prop-Firm</span>
                                                <span className="text-white">{riskData.equity.prop_firm}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Reducao Lote</span>
                                                <span className="text-amber-400">{Math.round(riskData.equity.lot_reduction_factor * 100)}%</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* SPREAD FILTER */}
                                {riskData.spread && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Activity size={14} className="text-cyan-400" /> Spread & ATR
                                        </p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Spread Atual</span>
                                                <span className={riskData.spread.blocked ? 'text-red-400' : 'text-emerald-400'}>
                                                    {riskData.spread.current_spread.toFixed(1)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Spread Medio</span>
                                                <span className="text-white">{riskData.spread.avg_spread.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Max Permitido</span>
                                                <span className="text-white">{riskData.spread.max_allowed.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">ATR (pips)</span>
                                                <span className="text-cyan-400">{riskData.spread.atr_pips.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Proporcao</span>
                                                <span className={riskData.spread.spread_ratio > 0.8 ? 'text-amber-400' : 'text-white'}>
                                                    {riskData.spread.spread_ratio.toFixed(2)}x
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Amostras</span>
                                                <span className="text-slate-400">{riskData.spread.data_points}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 p-3 rounded-xl border text-sm font-bold" style={{
                                            borderColor: riskData.spread.blocked ? '#ef444430' : '#22c55e30',
                                            background: riskData.spread.blocked ? '#ef444408' : '#22c55e08',
                                            color: riskData.spread.blocked ? '#ef4444' : '#22c55e',
                                        }}>
                                            {riskData.spread.blocked ? `BLOQUEADO: ${riskData.spread.reason}` : 'Spread dentro do limite aceitavel'}
                                        </div>
                                    </motion.div>
                                )}

                                {/* LOT SIZING */}
                                {riskData.lot_sizing_example && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                        className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6">
                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Target size={14} className="text-emerald-400" /> Exemplo de Lote (FVG)
                                        </p>
                                        <div className="space-y-2">
                                            <div className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 text-center mb-3">
                                                <p className="text-3xl font-black text-emerald-400">{riskData.lot_sizing_example.suggested_lot}</p>
                                                <p className="text-sm font-bold text-slate-500">Lotes Sugeridos</p>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Valor em Risco</span>
                                                <span className="text-white">${riskData.lot_sizing_example.risk_amount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Stop Loss (pips)</span>
                                                <span className="text-red-400">{riskData.lot_sizing_example.sl_pips}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Mult. Estrutura</span>
                                                <span className="text-amber-400">{riskData.lot_sizing_example.structure_multiplier}x</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Mult. Confianca</span>
                                                <span className="text-cyan-400">{riskData.lot_sizing_example.confidence_multiplier.toFixed(2)}x</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Reducao Equity</span>
                                                <span className="text-amber-400">{Math.round(riskData.lot_sizing_example.equity_reduction * 100)}%</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-slate-400">Risco por Trade</span>
                                                <span className="text-white">{riskData.lot_sizing_example.risk_per_trade_pct}%</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* BACKTEST SECTION */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                <button onClick={() => { if (!backtestResult) fetchBacktest(); toggleSection('backtest'); }}
                                    className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                        <BarChart3 className="text-emerald-400" size={18} /> Backtest Risk Guardian
                                        <span className="text-[11px] text-slate-500 ml-2 font-bold">Validacao vetorial</span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {backtestLoading && <RefreshCw size={14} className="animate-spin text-cyan-400" />}
                                        {expandedSections.backtest ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {expandedSections.backtest && backtestResult && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 space-y-6">
                                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                    <p className="text-sm font-bold text-slate-300">{backtestResult.drawdown_backtest.summary}</p>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {[
                                                        { label: 'Protection Efficiency', value: `${backtestResult.drawdown_backtest.metrics.protection_efficiency_pct}%`, color: 'text-emerald-400' },
                                                        { label: 'Max Drawdown', value: `${backtestResult.drawdown_backtest.metrics.max_drawdown_pct}%`, color: backtestResult.drawdown_backtest.metrics.max_drawdown_pct > 8 ? 'text-red-400' : 'text-amber-400' },
                                                        { label: 'Trades Blocked', value: `${backtestResult.drawdown_backtest.metrics.trades_blocked}`, color: 'text-orange-400' },
                                                        { label: 'Market Time', value: `${backtestResult.drawdown_backtest.metrics.time_in_market_pct}%`, color: 'text-cyan-400' },
                                                    ].map((m, mi) => (
                                                        <div key={mi} className="bg-slate-950/40 p-4 rounded-xl border border-white/5 text-center">
                                                            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{m.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {backtestResult.lot_sizing_backtest && (
                                                    <div>
                                                        <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest mb-3">Fixed vs Dynamic Lot Sizing</p>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {[
                                                                { title: 'Fixed (sem protecao)', data: backtestResult.lot_sizing_backtest.fixed, color: 'text-slate-400' },
                                                                { title: 'Dynamic (Risk Guardian)', data: backtestResult.lot_sizing_backtest.dynamic_risk_guardian, color: 'text-emerald-400' },
                                                            ].map((side, si) => (
                                                                <div key={si} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                                                    <p className={`text-sm font-black ${side.color} uppercase tracking-wider mb-3`}>{side.title}</p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between text-xs font-bold">
                                                                            <span className="text-slate-400">Final Balance</span>
                                                                            <span className="text-white">${side.data.final_balance.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-xs font-bold">
                                                                            <span className="text-slate-400">Return</span>
                                                                            <span className={side.data.return_pct > 0 ? 'text-emerald-400' : 'text-red-400'}>{side.data.return_pct}%</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-xs font-bold">
                                                                            <span className="text-slate-400">Max Drawdown</span>
                                                                            <span className="text-red-400">{side.data.max_drawdown_pct}%</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-xs font-bold">
                                                                            <span className="text-slate-400">Sharpe (aprox)</span>
                                                                            <span className="text-cyan-400">{side.data.sharpe_approx}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20">
                                                            <p className="text-xs font-bold text-emerald-300">
                                                                Risk Guardian reduziu drawdown de {backtestResult.lot_sizing_backtest.fixed.max_drawdown_pct}% para {backtestResult.lot_sizing_backtest.dynamic_risk_guardian.max_drawdown_pct}%
                                                                {backtestResult.lot_sizing_backtest.dynamic_risk_guardian.max_drawdown_pct < backtestResult.lot_sizing_backtest.fixed.max_drawdown_pct ? ' ✓' : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                    {expandedSections.backtest && !backtestResult && !backtestLoading && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="px-8 pb-6 text-center">
                                                <BarChart3 size={32} className="text-slate-600 mx-auto mb-3" />
                                                <p className="text-sm font-bold text-slate-500">Clique no botao acima para executar o backtest</p>
                                                <button onClick={fetchBacktest}
                                                    className="mt-3 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all text-sm font-black uppercase tracking-wider">
                                                    Executar Backtest
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Shield size={48} className="text-amber-500 animate-pulse" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mt-4 animate-bounce">Analisando risco...</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-16 text-center">
                            <Shield size={40} className="text-slate-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">Selecione um ativo para analise de risco</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
