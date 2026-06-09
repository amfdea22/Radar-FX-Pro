import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, BarChart3, TrendingUp, TrendingDown, Target, Cpu,
    AlertTriangle, CheckCircle2, XCircle, Activity, DollarSign, RefreshCw,
    Shield, Play, Layers, BarChartBig
} from 'lucide-react';
import axios from 'axios';
import { PlotlyCharts } from './PlotlyCharts';

const BACKTEST_API = 'http://localhost:5003';

interface Props {
    trades: any[];
    metrics: any;
    history?: any[];
    onSelectHistory?: (entry: any) => void;
}

interface MiningMetrics {
    recovery_factor: number;
    profit_factor: number;
    sharpe: number;
    total_trades: number;
    win_rate: number;
    net_profit: number;
    max_drawdown: number;
}

interface WFASegment {
    in_sample: any;
    out_sample: any;
    wfe: number;
}

interface WFAResult {
    segments: WFASegment[];
    overall_wfe: number;
    segments_count: number;
}

interface MonteCarloResult {
    trials: number;
    actual_total: number;
    mean: number;
    std: number;
    percentiles: { p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
    prob_positive: number;
    prob_negative: number;
    confidence: number;
}

export const MineracaoDeEstrategia: React.FC<Props> = ({ trades, metrics, history = [], onSelectHistory }) => {
    const [miningMetrics, setMiningMetrics] = useState<MiningMetrics | null>(null);
    const [wfaResult, setWfaResult] = useState<WFAResult | null>(null);
    const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
    const [segments, setSegments] = useState(4);
    const [trials, setTrials] = useState(1000);
    const [charts, setCharts] = useState<Record<string, any> | null>(null);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [loadingWfa, setLoadingWfa] = useState(false);
    const [loadingMc, setLoadingMc] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasTrades = trades && trades.length > 0;
    const hasFullResult = metrics && hasTrades;

    const runCharts = async () => {
        if (!hasFullResult) return;
        setLoadingCharts(true); setError(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/mining/charts`, { trades });
            setCharts(data);
        } catch (e: any) { setError(e.response?.data?.error || e.message); }
        setLoadingCharts(false);
    };

    const runMiningMetrics = async () => {
        if (!hasFullResult) return;
        setLoadingMetrics(true); setError(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/mining/metrics`, { trades });
            setMiningMetrics(data);
        } catch (e: any) { setError(e.response?.data?.error || e.message); }
        setLoadingMetrics(false);
    };

    const runWFA = async () => {
        if (!hasFullResult) return;
        setLoadingWfa(true); setError(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/mining/wfa`, { trades, segments });
            setWfaResult(data);
        } catch (e: any) { setError(e.response?.data?.error || e.message); }
        setLoadingWfa(false);
    };

    const runMonteCarlo = async () => {
        if (!hasFullResult) return;
        setLoadingMc(true); setError(null);
        try {
            const { data } = await axios.post(`${BACKTEST_API}/api/backtest/mining/monte-carlo`, { trades, trials, confidence: 0.95 });
            setMcResult(data);
        } catch (e: any) { setError(e.response?.data?.error || e.message); }
        setLoadingMc(false);
    };

    const MetricCard = ({ label, value, color, icon, desc }: { label: string; value: string | number; color: string; icon: React.ReactNode; desc?: string }) => (
        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4 group relative">
            <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
            <div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-xl font-black text-white italic">{value}</p>
            </div>
            {desc && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-[10px] text-slate-300 rounded-xl border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-[280px] text-center leading-relaxed">
                    {desc}
                </div>
            )}
        </div>
    );

    if (!hasFullResult) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain size={48} className="text-violet-500/40 mb-4" />
                <p className="text-lg font-black text-slate-400 uppercase tracking-wider">Mineração de Estratégia</p>
                <p className="text-xs text-slate-600 mt-2 max-w-md">Execute um backtest primeiro para liberar as análises de robustez.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                        <Brain className="text-violet-400" size={24} /> Mineração de <span className="text-violet-400">Estratégia</span>
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Teste de Robustez & Métricas Avançadas — {trades.length} trades disponíveis
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle size={16} className="text-red-400" />
                    <p className="text-xs font-bold text-red-400">{error}</p>
                </div>
            )}

            {/* HISTÓRICO DE BACKTESTS */}
            {history.length > 0 && (
                <div className="bg-slate-950/30 rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-slate-500/30 to-transparent"></div>
                    <div className="flex items-center gap-3 mb-5">
                        <BarChart3 size={14} className="text-slate-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Histórico de Análises</h4>
                        <span className="text-[8px] font-black text-slate-500 ml-auto">{history.length} backtests</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-64 overflow-y-auto black-scrollbar pr-1">
                        {history.map((h, idx) => {
                            const m = h.metrics || h;
                            const pnl = m.total_pnl ?? m.totalPnl ?? 0;
                            const tradesCount = m.total_trades ?? m.totalTrades ?? 0;
                            const wr = m.win_rate ?? m.winRate ?? 0;
                            const strat = h.config?.strategy || h.strategy || '—';
                            const sym = h.config?.symbol || h.symbol || '—';
                            const isWin = pnl >= 0;
                            return (
                                <button key={h.id || h.jobId || idx} onClick={() => onSelectHistory?.(h)}
                                    className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-left transition-all hover:border-amber-500/30 hover:bg-slate-900/60 group relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${isWin ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}></div>
                                    <div className="flex items-center gap-2 mb-2 pl-2">
                                        <span className="text-[9px] font-black text-white uppercase">{sym}</span>
                                        <span className="text-[7px] font-black text-amber-400/80 uppercase tracking-wider">{strat}</span>
                                        {h.timestamp && (
                                            <span className="text-[7px] text-slate-600 ml-auto font-mono">
                                                {new Date(h.timestamp).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pl-2">
                                        <div>
                                            <p className="text-[6px] font-black text-slate-600 uppercase">Trades</p>
                                            <p className="text-[9px] font-black text-white">{tradesCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-[6px] font-black text-slate-600 uppercase">Win Rate</p>
                                            <p className={`text-[9px] font-black ${wr >= 40 ? 'text-emerald-400' : 'text-red-400'}`}>{wr}%</p>
                                        </div>
                                        <div>
                                            <p className="text-[6px] font-black text-slate-600 uppercase">P&L</p>
                                            <p className={`text-[9px] font-black ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* RESUMO DO BACKTEST */}
            {metrics && (
                <div className="bg-slate-950/30 rounded-3xl border border-amber-500/10 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                    <div className="flex items-center gap-3 mb-5">
                        <BarChart3 size={16} className="text-amber-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Resumo do Backtest</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                        {[
                            { label: 'Total Trades', value: metrics.total_trades ?? '—', color: 'text-white', bg: 'bg-amber-500/10',
                              desc: 'Número de ordens executadas no período' },
                            { label: 'Win Rate', value: metrics.win_rate != null ? `${metrics.win_rate}%` : '—',
                              color: (metrics.win_rate || 0) >= 40 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-amber-500/10',
                              desc: 'Percentual de trades lucrativos' },
                            { label: 'P&L Total', value: metrics.total_pnl != null ? `${metrics.total_pnl >= 0 ? '+' : ''}$${metrics.total_pnl.toFixed(0)}` : '—',
                              color: (metrics.total_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-amber-500/10',
                              desc: 'Lucro ou prejuízo líquido acumulado' },
                            { label: 'Retorno', value: metrics.total_return != null ? `${metrics.total_return >= 0 ? '+' : ''}${metrics.total_return}%` : '—',
                              color: (metrics.total_return || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-amber-500/10',
                              desc: 'Variação percentual do capital' },
                            { label: 'Profit Factor', value: (metrics.profit_factor || 0) > 900 ? '∞' : metrics.profit_factor?.toFixed(2) || '—',
                              color: (metrics.profit_factor || 0) >= 1.5 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-amber-500/10',
                              desc: 'Lucro bruto ÷ prejuízo bruto' },
                            { label: 'Max Drawdown', value: metrics.max_drawdown != null ? `${metrics.max_drawdown}%` : '—',
                              color: (metrics.max_drawdown || 0) < 20 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-amber-500/10',
                              desc: 'Maior queda do capital em relação ao pico' },
                            { label: 'Sharpe Ratio', value: metrics.sharpe_ratio?.toFixed(2) || '—',
                              color: (metrics.sharpe_ratio || 0) >= 1 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-amber-500/10',
                              desc: 'Retorno ajustado ao risco' },
                            { label: 'Capital Final', value: metrics.final_balance != null ? `$${metrics.final_balance.toFixed(0)}` : '—',
                              color: (metrics.final_balance || 0) >= (metrics.initial_capital || 0) ? 'text-emerald-400' : 'text-red-400', bg: 'bg-amber-500/10',
                              desc: 'Saldo final após todos os trades' },
                        ].map((m, i) => (
                            <div key={i} className="bg-slate-900/40 p-3 rounded-xl border border-white/5 group relative">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                                <p className={`text-xs font-black italic ${m.color}`}>{m.value}</p>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-[8px] text-slate-300 rounded-lg border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    {m.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MÉTRICAS DE MINERAÇÃO: Recovery Factor, Profit Factor, Sharpe, WFE */}
            <div className="bg-slate-950/30 rounded-3xl border border-violet-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Target size={16} className="text-violet-400" /> Métricas de Mineração
                    </h4>
                    <button onClick={runMiningMetrics} disabled={loadingMetrics}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all text-[10px] font-black uppercase tracking-widest">
                        {loadingMetrics ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                        {loadingMetrics ? 'Calculando...' : 'Calcular'}
                    </button>
                </div>
                {miningMetrics || wfaResult ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <MetricCard label="Fator de Recuperação" value={miningMetrics?.recovery_factor?.toFixed(2) || '—'}
                            color="bg-emerald-500/20 text-emerald-500" icon={<Activity size={20} />}
                            desc="Net Profit ÷ Max Drawdown. Mede a velocidade de recuperação após uma queda. Quanto maior, mais rápido a estratégia se recupera de perdas." />
                        <MetricCard label="Fator de Lucro" value={miningMetrics?.profit_factor === Infinity ? '∞' : miningMetrics?.profit_factor?.toFixed(2) || '—'}
                            color="bg-amber-500/20 text-amber-500" icon={<TrendingUp size={20} />}
                            desc="Gross Profit ÷ Gross Loss. Razão entre lucro bruto e prejuízo bruto. Acima de 1.5 é considerado saudável, acima de 2.0 é excelente." />
                        <MetricCard label="Índice de Sharpe" value={miningMetrics?.sharpe?.toFixed(4) || '—'}
                            color={`${(miningMetrics?.sharpe || 0) >= 1 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`} icon={<BarChart3 size={20} />}
                            desc="Retorno ajustado ao risco (anualizado). Acima de 1.0 é bom, acima de 2.0 é excelente. Valores negativos indicam performance inferior ao risco assumido." />
                        <MetricCard label="WFE — Walk Forward Efficiency"
                            value={wfaResult?.overall_wfe != null ? `${wfaResult.overall_wfe.toFixed(2)}%` : '—'}
                            color={wfaResult?.overall_wfe >= 60 ? 'bg-emerald-500/20 text-emerald-500' : wfaResult?.overall_wfe >= 40 ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'}
                            icon={<Layers size={20} />}
                            desc="Walk Forward Efficiency. Percentual do Sharpe Out Sample que se mantém em relação ao In Sample. ≥60% = ROBUSTO, ≥40% = MODERADO, <40% = FRACO. Quanto maior, mais a estratégia se comporta em dados não vistos." />
                    </div>
                ) : (
                    <p className="text-xs text-slate-600 text-center py-8">Pressione "Calcular" para ver as métricas.</p>
                )}
            </div>

            {/* WFA — WALK FORWARD ANALYSIS */}
            <div className="bg-slate-950/30 rounded-3xl border border-amber-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers size={16} className="text-amber-400" /> WFA — Walk Forward Analysis
                    </h4>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Segmentos</span>
                            <select value={segments} onChange={e => setSegments(Number(e.target.value))}
                                className="bg-transparent text-xs font-black text-white border-none outline-none">
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                                <option value={5}>5</option>
                                <option value={6}>6</option>
                            </select>
                        </div>
                        <button onClick={runWFA} disabled={loadingWfa}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all text-[10px] font-black uppercase tracking-widest">
                            {loadingWfa ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                            {loadingWfa ? 'Analisando...' : 'Executar WFA'}
                        </button>
                    </div>
                </div>
                {wfaResult?.error ? (
                    <p className="text-xs font-bold text-red-400 text-center py-4">{wfaResult.error}</p>
                ) : wfaResult ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-900/40 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WFE Geral:</span>
                            <span className={`text-2xl font-black italic ${(wfaResult.overall_wfe || 0) >= 60 ? 'text-emerald-400' : (wfaResult.overall_wfe || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                {wfaResult.overall_wfe?.toFixed(2)}%
                            </span>
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${(wfaResult.overall_wfe || 0) >= 60 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (wfaResult.overall_wfe || 0) >= 40 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                {(wfaResult.overall_wfe || 0) >= 60 ? 'ROBUSTO' : (wfaResult.overall_wfe || 0) >= 40 ? 'MODERADO' : 'FRACO'}
                            </span>
                        </div>
                        <div className="grid gap-4">
                            {wfaResult.segments?.map((seg, i) => (
                                <div key={i} className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                                            Segmento {i + 1} — WFE: {seg.wfe}%
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${(seg.wfe || 0) >= 60 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                            {seg.wfe >= 60 ? 'ESTÁVEL' : 'INSTÁVEL'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">In Sample</p>
                                            <p className="text-xs font-bold text-emerald-400">{seg.in_sample?.total_trades || 0} trades</p>
                                            <p className="text-[8px] text-slate-500">Sharpe: {seg.in_sample?.sharpe?.toFixed(2) || '0'}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-amber-500 uppercase tracking-widest">Out Sample</p>
                                            <p className="text-xs font-bold text-amber-400">{seg.out_sample?.total_trades || 0} trades</p>
                                            <p className="text-[8px] text-slate-500">Sharpe: {seg.out_sample?.sharpe?.toFixed(2) || '0'}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Win Rate</p>
                                            <p className="text-xs font-bold text-white">{seg.in_sample?.win_rate?.toFixed(1) || '0'}% / {seg.out_sample?.win_rate?.toFixed(1) || '0'}%</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">P&L</p>
                                            <p className="text-xs font-bold text-emerald-400">${seg.in_sample?.net_profit?.toFixed(0) || '0'} / ${seg.out_sample?.net_profit?.toFixed(0) || '0'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-600 text-center py-8">Pressione "Executar WFA" para testar a robustez da estratégia.</p>
                )}
            </div>

            {/* MONTE CARLO */}
            <div className="bg-slate-950/30 rounded-3xl border border-blue-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Shield size={16} className="text-blue-400" /> Teste de Monte Carlo
                    </h4>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Simulações</span>
                            <select value={trials} onChange={e => setTrials(Number(e.target.value))}
                                className="bg-transparent text-xs font-black text-white border-none outline-none">
                                <option value={500}>500</option>
                                <option value={1000}>1.000</option>
                                <option value={2000}>2.000</option>
                                <option value={5000}>5.000</option>
                            </select>
                        </div>
                        <button onClick={runMonteCarlo} disabled={loadingMc}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-black uppercase tracking-widest">
                            {loadingMc ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                            {loadingMc ? 'Simulando...' : 'Executar MC'}
                        </button>
                    </div>
                </div>
                {mcResult?.error ? (
                    <p className="text-xs font-bold text-red-400 text-center py-4">{mcResult.error}</p>
                ) : mcResult ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Média</p>
                                <p className={`text-lg font-black italic ${(mcResult.mean || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${mcResult.mean?.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Desv. Padrão</p>
                                <p className="text-lg font-black italic text-white">${mcResult.std?.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Prob. Positiva</p>
                                <p className={`text-lg font-black italic ${(mcResult.prob_positive || 0) >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>{mcResult.prob_positive?.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Prob. Negativa</p>
                                <p className={`text-lg font-black italic ${(mcResult.prob_negative || 0) <= 40 ? 'text-emerald-400' : 'text-red-400'}`}>{mcResult.prob_negative?.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-center">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Real</p>
                                <p className={`text-lg font-black italic ${(mcResult.actual_total || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${mcResult.actual_total?.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Percentis ({mcResult.trials} simulações)</p>
                            <div className="grid grid-cols-7 gap-2">
                                {[
                                    { key: 'p5', label: '5%' },
                                    { key: 'p10', label: '10%' },
                                    { key: 'p25', label: '25%' },
                                    { key: 'p50', label: '50%' },
                                    { key: 'p75', label: '75%' },
                                    { key: 'p90', label: '90%' },
                                    { key: 'p95', label: '95%' },
                                ].map(p => {
                                    const val = (mcResult.percentiles as any)[p.key] || 0;
                                    return (
                                        <div key={p.key} className="text-center">
                                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{p.label}</p>
                                            <p className={`text-xs font-black ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {val >= 0 ? '+' : ''}${val.toFixed(0)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-600 text-center py-8">Pressione "Executar MC" para simular milhares de cenários com os trades do backtest.</p>
                )}
            </div>

            {/* GRÁFICOS PLOTLY */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChartBig size={16} className="text-violet-400" /> Visualização Gráfica
                </h4>
                <button onClick={runCharts} disabled={loadingCharts}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all text-[10px] font-black uppercase tracking-widest">
                    {loadingCharts ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    {loadingCharts ? 'Gerando...' : 'Gerar Gráficos'}
                </button>
            </div>
            <PlotlyCharts charts={charts || {}} />
        </div>
    );
};
