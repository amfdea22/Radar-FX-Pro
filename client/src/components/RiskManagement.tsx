import React, { useState, useEffect } from 'react';
import {
    Shield, Target, DollarSign, TrendingUp, TrendingDown, Activity,
    Wallet, BarChart3, Layers, AlertTriangle, Minus, Plus, Brain, Info
} from 'lucide-react';
import axios from 'axios';

interface RiskData {
    account: {
        balance: number;
        equity: number;
        margin: number;
        marginLevel: number;
        leverage: number;
        currency: string;
        broker: string;
        login: number;
        floatingPL: number;
        openPositions: number;
    };
    discipline: {
        dailyProfit: number;
        tradeCount: number;
        consecutiveLosses: number;
        isSafe: boolean;
        isLocked: boolean;
        limits: any;
    } | null;
    robots: Array<{
        name: string;
        id: string;
        active: boolean;
        report: any;
    }>;
}

const InfoTooltip: React.FC<{ header: string; content: React.ReactNode; children: React.ReactNode }> = ({ header, content, children }) => (
    <div className="group relative">
        {children}
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] backdrop-blur-xl pointer-events-none">
            <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <Brain size={14} className="text-blue-400" />
                    <span className="text-xs font-black text-white uppercase tracking-tighter">{header}</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed font-medium">{content}</div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
        </div>
    </div>
);

export const RiskManagement: React.FC = () => {
    const [data, setData] = useState<RiskData | null>(null);
    const [selectedRobot, setSelectedRobot] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [riskRes, goldRes] = await Promise.all([
                axios.get('/api/mt5/risk-management'),
                axios.get('/api/mt5/gold-scalper/risk-report').catch(() => null)
            ]);
            const riskData = riskRes.data;
            if (goldRes?.data) {
                const gr = goldRes.data;
                riskData.robots = riskData.robots || [];
                const idx = riskData.robots.findIndex((r: any) => r.id === 'gold_scalper');
                if (idx >= 0) {
                    riskData.robots[idx].report = gr;
                } else {
                    riskData.robots.push({ name: 'Gold Scalper', id: 'gold_scalper', active: true, report: gr });
                }
                riskData.account.floatingPL = gr.account?.floatingPL || 0;
                riskData.account.openPositions = gr.account?.openPositions || 0;
            }
            setData(riskData);
            setLoading(false);
        } catch (err) {
            console.error('Risk management fetch error:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">Carregando gestão de risco...</span>
                </div>
            </div>
        );
    }

    const goldReport = data?.robots?.find(r => r.id === 'gold_scalper')?.report;

    return (
        <div className="p-6 space-y-5 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                        <Shield size={22} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Gestão de Risco</h1>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Visão consolidada de todas as estratégias</p>
                    </div>
                </div>
                {data?.account && (
                    <div className="flex items-center gap-3 text-xs text-slate-600 font-bold uppercase tracking-widest">
                        <span>{data.account.broker}</span>
                        <span className="text-slate-700">|</span>
                        <span>Login: {data.account.login}</span>
                        <span className="text-slate-700">|</span>
                        <span>1:{data.account.leverage}</span>
                    </div>
                )}
            </div>

            {/* Account Health */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                    { label: 'Saldo', value: `$${data?.account.balance.toFixed(2) || '0'}`, color: 'text-trader-blue', icon: <Wallet size={16} />, tip: 'Saldo total disponível na conta MT5.' },
                    { label: 'Equity', value: `$${data?.account.equity.toFixed(2) || '0'}`, color: 'text-emerald-400', icon: <TrendingUp size={16} />, tip: 'Saldo + lucro/prejuízo flutuante das posições abertas.' },
                    { label: 'Margem', value: `${data?.account.marginLevel.toFixed(1) || '0'}%`, color: (data?.account.marginLevel || 0) > 200 ? 'text-trader-green' : 'text-trader-red', icon: <BarChart3 size={16} />, tip: 'Nível de margem (equity / margem). >200% = saudável.' },
                    { label: 'Flutuante', value: `$${(data?.account.floatingPL || 0).toFixed(2)}`, color: (data?.account.floatingPL || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Activity size={16} />, tip: 'Lucro/prejuízo não realizado das posições em aberto.' },
                    { label: 'Posições', value: `${data?.account.openPositions || 0}`, color: 'text-slate-300', icon: <Layers size={16} />, tip: 'Total de posições abertas em todos os robôs.' },
                    { label: 'Trades Hoje', value: `${data?.discipline?.tradeCount || 0}`, color: 'text-amber-400', icon: <Target size={16} />, tip: 'Total de trades executados hoje (todos os robôs).' },
                    { label: 'Consec. Loss', value: `${data?.discipline?.consecutiveLosses || 0}`, color: (data?.discipline?.consecutiveLosses || 0) > 3 ? 'text-trader-red' : 'text-slate-400', icon: <AlertTriangle size={16} />, tip: 'Perdas consecutivas atuais. Limite configuravel no Guardião.' }
                ].map((kpi, i) => (
                    <InfoTooltip key={i} header={kpi.label} content={kpi.tip}>
                        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/20 transition-all cursor-help h-full">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{kpi.label}</span>
                                <span className={`${kpi.color} opacity-60`}>{kpi.icon}</span>
                            </div>
                            <span className={`text-2xl font-black italic ${kpi.color}`}>{kpi.value}</span>
                        </div>
                    </InfoTooltip>
                ))}
            </div>

            {/* Risk Limits + Discipline Score row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {/* Discipline Score (Gold Scalper) */}
                {goldReport && (
                    <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
                        <div className="relative w-24 h-24 mb-2">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="30" fill="none" stroke="#1e293b" strokeWidth="6" />
                                <circle cx="36" cy="36" r="30" fill="none" stroke={goldReport.discipline.score >= 70 ? '#10b981' : goldReport.discipline.score >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(goldReport.discipline.score / 100) * 188.5} 188.5`} strokeLinecap="round" />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center text-4xl font-black italic ${goldReport.discipline.score >= 70 ? 'text-emerald-400' : goldReport.discipline.score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{goldReport.discipline.score}</span>
                        </div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Score Gold Scalper</span>
                    </div>
                )}

                {/* Risk Limits */}
                {[
                    { label: 'Risco por Trade', value: goldReport ? `${goldReport.risk.riskPerTradePct}% ($${goldReport.risk.riskPerTradeUSD})` : '-', color: (goldReport?.risk.riskPerTradePct || 0) > 2 ? 'text-amber-400' : 'text-trader-green' },
                    { label: 'Drawdown Atual', value: goldReport ? `${goldReport.risk.drawdown}%` : '-', color: (goldReport?.risk.drawdown || 0) > 15 ? 'text-trader-red' : (goldReport?.risk.drawdown || 0) > 5 ? 'text-amber-400' : 'text-trader-green' },
                    { label: 'Perda Diária', value: goldReport ? `$${goldReport.risk.dailyLossRemaining} restante` : '-', color: (goldReport?.risk.dailyLossRemaining || 0) < 10 ? 'text-trader-red' : 'text-trader-green' }
                ].map((item, i) => (
                    <div key={i} className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col justify-center">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">{item.label}</span>
                        <span className={`text-xl font-black italic ${item.color}`}>{item.value}</span>
                        {item.label === 'Perda Diária' && goldReport && (
                            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-trader-red" style={{ width: `${Math.min(100, ((goldReport.risk.maxDailyLoss - goldReport.risk.dailyLossRemaining) / goldReport.risk.maxDailyLoss) * 100)}%` }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detailed Reports per Robot */}
            {data?.robots.map(robot => {
                const r = robot.report;
                if (!r) return null;
                return (
                    <div key={robot.id} className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-2.5 h-2.5 rounded-full ${robot.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                            <span className="text-base font-black text-white uppercase tracking-tighter">{robot.name}</span>
                            <span className="text-xs text-slate-600 font-bold">Total Trades: {r.risk.totalTrades}</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Breakdown */}
                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Detalhamento</span>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                    {[
                                        { label: '% Acerto', value: `${r.discipline.breakdown.winRate}%`, color: r.discipline.breakdown.winRate >= 50 ? 'text-trader-green' : 'text-trader-red' },
                                        { label: 'Profit Factor', value: r.discipline.breakdown.profitFactor.toFixed(2), color: r.discipline.breakdown.profitFactor >= 1.2 ? 'text-trader-green' : 'text-trader-red' },
                                        { label: 'Méd G', value: `$${r.discipline.breakdown.avgWin}`, color: 'text-trader-green' },
                                        { label: 'Méd P', value: `-$${r.discipline.breakdown.avgLoss}`, color: 'text-trader-red' },
                                        { label: 'Melhor Trade', value: `$${r.discipline.breakdown.bestTrade}`, color: 'text-emerald-400' },
                                        { label: 'Pior Trade', value: `-$${Math.abs(r.discipline.breakdown.worstTrade)}`, color: 'text-red-400' },
                                        { label: 'Perdas Consec', value: r.risk.consecutiveLosses, color: r.risk.consecutiveLosses > 3 ? 'text-trader-red' : 'text-slate-300' },
                                        { label: 'Seq Vitórias', value: r.risk.winStreak, color: r.risk.winStreak > 3 ? 'text-emerald-400' : 'text-slate-300' }
                                    ].map((d, i) => (
                                        <div key={i} className="flex items-center justify-between border-b border-slate-800/50 pb-1">
                                        <span className="text-xs text-slate-500 font-bold">{d.label}</span>
                                        <span className={`text-sm font-black italic ${d.color}`}>{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Position Sizing */}
                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Dimensionamento de Lote</span>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-600 font-black uppercase tracking-widest border-b border-slate-800">
                                                <th className="text-left pb-1.5 pr-3">Risco</th>
                                                <th className="text-right pb-1.5 pr-3">USD</th>
                                                <th className="text-right pb-1.5">Lote</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {r.sizing?.map((s: any, i: number) => (
                                                <tr key={i} className={`border-b border-slate-800/50 ${s.riskPct === r.risk.riskPerTradePct ? 'bg-emerald-500/5' : ''}`}>
                                                    <td className={`py-1.5 pr-3 font-black ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>{s.riskPct}%</td>
                                                    <td className={`text-right py-1.5 pr-3 font-bold ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>${s.riskUSD}</td>
                                                    <td className={`text-right py-1.5 font-mono font-black ${s.riskPct === r.risk.riskPerTradePct ? 'text-emerald-400' : 'text-slate-400'}`}>{s.lot}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Performance */}
                        {r.monthly && r.monthly.length > 0 && (
                            <div className="mt-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Performance Mensal</span>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-600 font-black uppercase tracking-widest border-b border-slate-800">
                                                <th className="text-left pb-2 pr-4">Mês</th>
                                                <th className="text-right pb-2 pr-4">Trades</th>
                                                <th className="text-right pb-2 pr-4">Ganhos</th>
                                                <th className="text-right pb-2 pr-4">Perdas</th>
                                                <th className="text-right pb-2 pr-4">% Acerto</th>
                                                <th className="text-right pb-2">Lucro</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {r.monthly.map((m: any, i: number) => (
                                                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                                    <td className="py-2 pr-4 font-black text-slate-300">{m.month}</td>
                                                    <td className="text-right py-2 pr-4 text-slate-400 font-bold">{m.trades}</td>
                                                    <td className="text-right py-2 pr-4 text-trader-green font-bold">{m.wins}</td>
                                                    <td className="text-right py-2 pr-4 text-trader-red font-bold">{m.losses}</td>
                                                    <td className={`text-right py-2 pr-4 font-black ${m.winRate >= 50 ? 'text-trader-green' : 'text-trader-red'}`}>{m.winRate}%</td>
                                                    <td className={`text-right py-2 font-black font-mono ${m.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>{m.profit >= 0 ? '+' : ''}${m.profit.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disciplina Boa (&ge;70)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Atenção (40-69)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Crítico (&lt;40)</span>
                <span className="flex items-center gap-1 ml-auto"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Robô Ativo</span>
            </div>
        </div>
    );
};
