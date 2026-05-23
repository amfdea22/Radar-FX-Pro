import React, { useState, useEffect, useCallback } from 'react';

interface PricePrediction {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    targetPrice: number;
    stopPrice: number;
    horizon: string;
    factors: { name: string; impact: number }[];
}

interface MarketRegime {
    regime: 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGING' | 'VOLATILE' | 'SILENT';
    volatility: number;
    strength: number;
    probability: number;
    description: string;
}

interface RiskMetrics {
    sharpe: number;
    sortino: number;
    calmar: number;
    var95: number;
    cvar95: number;
    maxDrawdown: number;
    expectancy: number;
    profitFactor: number;
}

interface MonteCarlo {
    iterations: number;
    expectedProfit: number;
    confidence95: [number, number];
    ruinProbability: number;
    medianCapital: number;
}

interface NewsSentiment {
    title: string;
    source: string;
    time: string;
    sentiment: number;
    label: string;
    keywords: string[];
    relevance: number;
}

interface FullReport {
    prediction: PricePrediction;
    regime: MarketRegime;
    risk: RiskMetrics;
    news: NewsSentiment[];
    correlation: { pairs: { x: string; y: string; correlation: number; strength: string }[] } | null;
    timestamp: string;
}

export default function MLInsightsPanel() {
    const [report, setReport] = useState<FullReport | null>(null);
    const [monteCarlo, setMonteCarlo] = useState<MonteCarlo | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'predictions' | 'risk' | 'news'>('predictions');

    const fetchData = useCallback(async () => {
        try {
            const [r, mc] = await Promise.all([
                fetch('/api/mt5/ml-insights/full-report').then(r => r.json()).catch(() => null),
                fetch('/api/mt5/ml-insights/risk-metrics').then(r => r.json()).catch(() => null),
            ]);
            if (r) setReport(r);
            if (mc) setMonteCarlo(mc.monteCarlo);
        } catch (e) {} finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);

    const getRegimeColor = (r: string) => {
        const colors: Record<string, string> = {
            TRENDING_BULL: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
            TRENDING_BEAR: 'text-red-400 border-red-500/30 bg-red-500/10',
            RANGING: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
            VOLATILE: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
            SILENT: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
        };
        return colors[r] || 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    };

    const getRegimeLabel = (r: string) => {
        const labels: Record<string, string> = {
            TRENDING_BULL: '📈 Tendência de Alta',
            TRENDING_BEAR: '📉 Tendência de Baixa',
            RANGING: '➖ Lateral',
            VOLATILE: '⚡ Volátil',
            SILENT: '💤 Silencioso',
        };
        return labels[r] || r;
    };

    const GaugeBar = ({ value, label, color }: { value: number; label: string; color: string }) => (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                <span>{label}</span>
                <span>{value.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
            </div>
        </div>
    );

    const renderPredictions = () => {
        if (!report?.prediction) return null;
        const p = report.prediction;

        return (
            <div className="space-y-4">
                <div className={`p-4 rounded-2xl border ${p.direction === 'UP' ? 'border-emerald-500/30 bg-emerald-500/5' : p.direction === 'DOWN' ? 'border-red-500/30 bg-red-500/5' : 'border-slate-500/30 bg-slate-500/5'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Previsão ML</span>
                        <span className="text-[10px] text-slate-500">{p.horizon}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`text-3xl font-black ${p.direction === 'UP' ? 'text-emerald-400' : p.direction === 'DOWN' ? 'text-red-400' : 'text-slate-400'}`}>
                            {p.direction === 'UP' ? '↑' : p.direction === 'DOWN' ? '↓' : '→'}
                        </span>
                        <div>
                            <div className={`text-lg font-black ${p.direction === 'UP' ? 'text-emerald-400' : p.direction === 'DOWN' ? 'text-red-400' : 'text-slate-300'}`}>
                                {p.direction === 'UP' ? 'COMPRA' : p.direction === 'DOWN' ? 'VENDA' : 'NEUTRO'}
                            </div>
                            <div className="text-[10px] text-slate-500">Confiança: {p.confidence.toFixed(0)}%</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500 uppercase">Alvo</div>
                            <div className="text-sm font-bold text-white">${p.targetPrice.toFixed(2)}</div>
                        </div>
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500 uppercase">Stop</div>
                            <div className="text-sm font-bold text-red-400">${p.stopPrice.toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Fatores</div>
                        {p.factors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300">{f.name}</span>
                                <span className={`font-bold ${f.impact > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {f.impact > 0 ? '+' : ''}{f.impact}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {report.regime && (
                    <div className={`p-4 rounded-2xl border ${getRegimeColor(report.regime.regime)}`}>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Regime de Mercado</div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold">{getRegimeLabel(report.regime.regime)}</span>
                            <span className="text-xs text-slate-400">{report.regime.probability}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mb-2">{report.regime.description}</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">Volatilidade</div>
                                <div className="text-xs font-bold">{report.regime.volatility.toFixed(2)}%</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">Força</div>
                                <div className="text-xs font-bold">{report.regime.strength.toFixed(1)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {report.correlation?.pairs?.map((pair, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{pair.x} × {pair.y}</span>
                            <span className={`text-xs font-bold ${Math.abs(pair.correlation) > 0.5 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                r = {pair.correlation.toFixed(4)}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Correlação {pair.strength}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderRisk = () => {
        if (!report?.risk) return null;
        const r = report.risk;

        const MetricCard = ({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) => (
            <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase mb-1">{label}</div>
                <div className={`text-lg font-black ${color}`}>
                    {value.toFixed(2)}{suffix || ''}
                </div>
            </div>
        );

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Sharpe Ratio" value={r.sharpe} color={r.sharpe > 1 ? 'text-emerald-400' : r.sharpe > 0 ? 'text-yellow-400' : 'text-red-400'} />
                    <MetricCard label="Sortino Ratio" value={r.sortino} color={r.sortino > 1 ? 'text-emerald-400' : r.sortino > 0 ? 'text-yellow-400' : 'text-red-400'} />
                    <MetricCard label="Calmar Ratio" value={r.calmar} color={r.calmar > 1 ? 'text-emerald-400' : r.calmar > 0 ? 'text-yellow-400' : 'text-red-400'} />
                    <MetricCard label="Fator de Lucro" value={r.profitFactor} color={r.profitFactor > 1.5 ? 'text-emerald-400' : r.profitFactor > 1 ? 'text-yellow-400' : 'text-red-400'} />
                </div>

                <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Análise de Risco</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500">VaR 95%</div>
                            <div className="text-sm font-bold text-red-400">${Math.abs(r.var95).toFixed(2)}</div>
                        </div>
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500">CVaR 95%</div>
                            <div className="text-sm font-bold text-orange-400">${Math.abs(r.cvar95).toFixed(2)}</div>
                        </div>
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500">Max Drawdown</div>
                            <div className="text-sm font-bold text-red-400">{r.maxDrawdown.toFixed(1)}%</div>
                        </div>
                        <div className="bg-slate-950/50 rounded-xl p-2">
                            <div className="text-[9px] text-slate-500">Expectancy</div>
                            <div className={`text-sm font-bold ${r.expectancy > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                ${r.expectancy.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {monteCarlo && (
                    <div className="p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Monte Carlo</span>
                            <span className="text-[9px] text-slate-500">{monteCarlo.iterations} iterações</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">Retorno Esperado</div>
                                <div className={`text-sm font-bold ${monteCarlo.expectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${monteCarlo.expectedProfit.toFixed(2)}
                                </div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">Mediana</div>
                                <div className="text-sm font-bold text-white">${monteCarlo.medianCapital.toFixed(2)}</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">IC 95% (inf)</div>
                                <div className="text-sm font-bold text-white">${monteCarlo.confidence95[0].toFixed(2)}</div>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2">
                                <div className="text-[9px] text-slate-500">IC 95% (sup)</div>
                                <div className="text-sm font-bold text-white">${monteCarlo.confidence95[1].toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Probabilidade de Ruína</span>
                            <span className={`text-lg font-black ${monteCarlo.ruinProbability > 20 ? 'text-red-400' : monteCarlo.ruinProbability > 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                {monteCarlo.ruinProbability.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderNews = () => {
        if (!report?.news || report.news.length === 0) {
            return (
                <div className="p-6 text-center text-slate-500 text-xs">
                    Nenhuma notícia disponível no momento
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {report.news.map((n, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${n.label === 'POSITIVE' ? 'border-emerald-500/20 bg-emerald-500/5' : n.label === 'NEGATIVE' ? 'border-red-500/20 bg-red-500/5' : 'border-slate-600/30 bg-slate-700/20'}`}>
                        <div className="flex items-start gap-2">
                            <span className="text-base mt-0.5">
                                {n.label === 'POSITIVE' ? '📈' : n.label === 'NEGATIVE' ? '📉' : '📊'}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-white leading-tight mb-1">{n.title}</div>
                                <div className="flex items-center gap-2 text-[9px] text-slate-500">
                                    <span>{n.source}</span>
                                    <span>•</span>
                                    <span>{new Date(n.time).toLocaleTimeString('pt-BR')}</span>
                                    <span>•</span>
                                    <span>relevância {n.relevance}%</span>
                                </div>
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {n.keywords.map((kw, j) => (
                                        <span key={j} className="px-1.5 py-0.5 text-[8px] bg-slate-800 text-slate-400 rounded-md uppercase font-bold">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className={`text-xs font-black ${n.label === 'POSITIVE' ? 'text-emerald-400' : n.label === 'NEGATIVE' ? 'text-red-400' : 'text-slate-400'}`}>
                                {n.sentiment > 0 ? '+' : ''}{n.sentiment.toFixed(2)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-10 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-3" />
                <div className="text-xs text-slate-500">Carregando ML Insights...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
                    {(['predictions', 'risk', 'news'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-violet-500 text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {tab === 'predictions' ? 'ML Previsão' : tab === 'risk' ? 'Risco' : 'Notícias'}
                        </button>
                    ))}
                </div>
                {report?.timestamp && (
                    <span className="text-[9px] text-slate-600 ml-auto">
                        {new Date(report.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                )}
            </div>

            {activeTab === 'predictions' && renderPredictions()}
            {activeTab === 'risk' && renderRisk()}
            {activeTab === 'news' && renderNews()}
        </div>
    );
}
