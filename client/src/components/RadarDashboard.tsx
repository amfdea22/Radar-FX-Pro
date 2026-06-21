import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, Wallet, TrendingUp, TrendingDown, Target, Activity,
    RefreshCw, Cpu, Zap, ArrowUp, ArrowDown, Minus, Eye, DollarSign, BarChart2,
    ChevronDown, ChevronUp, Power
} from 'lucide-react';
import axios from 'axios';
import { DisciplinePanel } from './DisciplinePanel';
import { ActiveBotsCard } from './ActiveBotsCard';


interface AccountInfo { balance: number; equity: number; margin: number; margin_free: number; profit: number; currency: string; }
interface TickData { bid: number; ask: number; change: number; changePercent: number; changePercent5m: number; changePercent1h: number; is_open: boolean }
interface Position { ticket: number; symbol: string; type: number; volume: number; price_open: number; price_current: number; profit: number; magic?: number; engine?: string; comment?: string; }
interface Signal { id: string; asset: string; symbol: string; type: 'BUY' | 'SELL'; setup: string; confidence: number; price_entry: number; sl: number; tp: number; category: string; }
interface Discipline { profit: number; tradeCount: number; consecutiveLosses: number; isLocked: boolean; }

const DASHBOARD_SYMBOLS = [
    { id: 'xauusd', name: 'XAU/USD', label: 'Gold', icon: '🥇', category: 'Metais' },
    { id: 'xagusd', name: 'XAG/USD', label: 'Silver', icon: '🥈', category: 'Metais' },
    { id: 'btcusd', name: 'BTC/USD', label: 'Bitcoin', icon: '₿', category: 'Crypto' },
    { id: 'ethusd', name: 'ETH/USD', label: 'Ethereum', icon: '⟠', category: 'Crypto' },
    { id: 'eurusd', name: 'EUR/USD', label: 'Euro', icon: '€', category: 'Forex' },
    { id: 'gbpusd', name: 'GBP/USD', label: 'Libra', icon: '£', category: 'Forex' },
    { id: 'usdjpy', name: 'USD/JPY', label: 'Iene', icon: '¥', category: 'Forex' },
    { id: 'solusd', name: 'SOL/USD', label: 'Solana', icon: '◎', category: 'Crypto' },
    { id: 'xrpusd', name: 'XRP/USD', label: 'Ripple', icon: '✕', category: 'Crypto' },
    { id: 'nas100', name: 'NAS100', label: 'Nasdaq', icon: '📊', category: 'Indices' },
    { id: 'us30', name: 'US30', label: 'Dow Jones', icon: '📈', category: 'Indices' },
    { id: 'us500', name: 'US500', label: 'S&P 500', icon: '🏛', category: 'Indices' },
];

const CATEGORY_ORDER = ['Metais', 'Crypto', 'Forex', 'Indices'];
const CATEGORY_COLORS: Record<string, string> = {
    Metais: '#F59E0B',
    Crypto: '#8B5CF6',
    Forex: '#3B82F6',
    Indices: '#06B6D4',
};

const ENGINE_SYMBOL_MAP: Record<string, string> = {
    'Gold Scalper': 'XAUUSD',
    'Bitcoin Pro': 'BTCUSD',
    'Crypto IA': 'BTCUSD',
    'Supreme AI': 'EURUSD',
    'Alpha Robot': 'XAUUSD',
    'Shark Bot': 'XAUUSD',
};

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
    if (!data || data.length < 2) return <div className="w-[80px] h-[28px]" />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
    const up = data[data.length - 1] >= data[0];
    return (
        <svg width={width} height={height} className="shrink-0">
            <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
            {up && <defs><linearGradient id={`sg-${data[0]}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>}
            {up && <polygon fill={`url(#sg-${data[0]})`} points={`0,${height} ${pts} ${width},${height}`} />}
        </svg>
    );
}

function formatPrice(sym: string, price: number): string {
    const prec = sym.includes('JPY') || sym.includes('XAG') ? 3 : sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('XRP') ? 2 : sym.includes('XAU') || sym.includes('NAS') || sym.includes('US30') || sym.includes('SPX') || sym.includes('US500') ? 2 : 5;
    return price.toFixed(prec);
}

export const RadarDashboard: React.FC = () => {
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [ticks, setTicks] = useState<Record<string, TickData>>({});
    const [positions, setPositions] = useState<Position[]>([]);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [discipline, setDiscipline] = useState<Discipline | null>(null);
    const [candles, setCandles] = useState<Record<string, number[]>>({});
    const [strategyWinRates, setStrategyWinRates] = useState<Record<string, number>>({});
    const [elapsed, setElapsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

    const fetchAll = useCallback(async () => {
        const syms = DASHBOARD_SYMBOLS.map(s => s.id.toUpperCase());
        try {
            const [accRes, tickRes, posRes, sigRes, discRes, stratRes] = await Promise.all([
                axios.get('/api/mt5/account').catch(() => null),
                axios.post('/api/mt5/ticks', { symbols: syms }).catch(() => null),
                axios.get('/api/mt5/positions').catch(() => null),
                axios.get('/api/mt5/signals').catch(() => null),
                axios.get('/api/mt5/discipline').catch(() => null),
                axios.get('/api/mt5/reports/strategies').catch(() => null),
            ]);
            if (accRes?.data) setAccount(accRes.data);
            if (tickRes?.data) setTicks(tickRes.data);
            if (posRes?.data) setPositions(Array.isArray(posRes.data) ? posRes.data : []);
            if (sigRes?.data) setSignals(Array.isArray(sigRes.data) ? sigRes.data : []);
            if (discRes?.data) setDiscipline(discRes.data);
            if (stratRes?.data) {
                const wrMap: Record<string, number> = {};
                const arr = Array.isArray(stratRes.data) ? stratRes.data : [];
                for (const s of arr) {
                    if (s.symbol) wrMap[s.symbol.toUpperCase()] = s.winRate || s.win_rate || 0;
                    if (s.name) wrMap[s.name] = s.winRate || s.win_rate || 0;
                }
                setStrategyWinRates(wrMap);
            }
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    const fetchCandles = useCallback(async () => {
        const results: Record<string, number[]> = {};
        const entries = Object.entries(candles);
        const needFetch = DASHBOARD_SYMBOLS.filter(s => !candles[s.id.toUpperCase()]);
        if (needFetch.length === 0 && entries.length > 0) return;
        const batches = [];
        for (const sym of DASHBOARD_SYMBOLS) {
            batches.push(
                axios.get('/api/mt5/candles', { params: { symbol: sym.id.toUpperCase(), timeframe: 'M5', count: 20 }, timeout: 4000 })
                    .then(r => { if (Array.isArray(r.data)) results[sym.id.toUpperCase()] = r.data.map((c: any) => c.close || c.close_price || c.price || 0).filter(Boolean); })
                    .catch(() => {})
            );
        }
        await Promise.all(batches);
        if (Object.keys(results).length > 0) setCandles(prev => ({ ...prev, ...results }));
    }, []);

    useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 5000); return () => clearInterval(i); }, [fetchAll]);
    useEffect(() => { const t = setTimeout(fetchCandles, 1000); return () => clearTimeout(t); }, [loading]);

    useEffect(() => { const i = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(i); }, []);

    const sortedSymbols = useMemo(() => {
        const byCategory: Record<string, typeof DASHBOARD_SYMBOLS> = {};
        for (const s of DASHBOARD_SYMBOLS) {
            if (!byCategory[s.category]) byCategory[s.category] = [];
            byCategory[s.category].push(s);
        }
        const result: typeof DASHBOARD_SYMBOLS = [];
        for (const cat of CATEGORY_ORDER) if (byCategory[cat]) result.push(...byCategory[cat]);
        return result;
    }, []);

    const totalFloatingPL = useMemo(() => (positions || []).reduce((s, p) => s + p.profit, 0), [positions]);

    const getSignalFor = (sym: string): Signal | undefined => signals.find(s => s.symbol.toUpperCase() === sym.toUpperCase());
    const getPositionFor = (sym: string): Position | undefined => positions.find(p => p.symbol.toUpperCase() === sym.toUpperCase());
    const getWinRateFor = (sym: string): number => {
        const usym = sym.toUpperCase();
        if (strategyWinRates[usym]) return strategyWinRates[usym];
        for (const [engine, s] of Object.entries(ENGINE_SYMBOL_MAP)) {
            if (s === usym && strategyWinRates[engine]) return strategyWinRates[engine];
        }
        return 0;
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-sky-500/10 rounded-3xl border border-sky-500/20 shadow-xl shadow-sky-500/10">
                        <LayoutDashboard size={40} className="text-sky-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Radar</span> Dashboard
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${account ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {account ? 'Live' : 'Offline'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-sky-500" /> Radar FX — Visão Geral dos Ativos em Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={() => { setLoading(true); fetchAll(); }}
                        className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-500 rounded-2xl hover:bg-sky-500/20 transition-all group">
                        <RefreshCw size={16} className="group-hover:rotate-90 transition-transform" />
                    </button>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${account ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${account ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <span className="text-[10px] font-black uppercase">{account?.currency || 'USD'}</span>
                        {account && <span className="text-slate-500/50">•</span>}
                        <span className="text-[10px] font-black uppercase">{account ? `Conta ${account.balance.toFixed(0)}` : 'Desconectado'}</span>
                    </div>
                </div>
            </motion.div>

            {/* KPI ROW */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
                <button onClick={() => toggleSection('kpi')}
                    className="w-full flex items-center justify-between p-6 pb-0">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Indicadores</h3>
                    {collapsedSections['kpi'] ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
                </button>
                {!collapsedSections['kpi'] && (
                    <motion.div variants={container} initial="hidden" animate="show" className="p-6 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { name: 'Saldo', value: account ? `$${account.balance.toFixed(2)}` : '---', icon: Wallet, color: 'text-white' },
                                { name: 'Equity', value: account ? `$${account.equity.toFixed(2)}` : '---', icon: Activity, color: account && account.equity >= account.balance ? 'text-emerald-400' : account && account.equity < account.balance ? 'text-red-400' : 'text-white' },
                                { name: 'Lucro (24h)', value: discipline ? `$${discipline.profit.toFixed(2)}` : '---', icon: Target, color: (discipline?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                { name: 'Flutuante', value: `$${totalFloatingPL.toFixed(2)}`, icon: TrendingUp, color: totalFloatingPL >= 0 ? 'text-emerald-400' : 'text-red-400' },
                            ].map((kpi, i) => (
                                <motion.div key={i} variants={itemAnim} whileHover={{ y: -4 }}
                                    className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-sky-500/20 transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`p-3 rounded-xl ${kpi.name === 'Saldo' ? 'bg-sky-500/20 text-sky-500' : kpi.name === 'Equity' ? 'bg-indigo-500/20 text-indigo-500' : kpi.name === 'Lucro (24h)' ? (discipline?.profit || 0) >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500' : totalFloatingPL >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                            <kpi.icon size={18} />
                                        </div>
                                        {i === 0 && account && (
                                            <span className="text-[9px] font-black text-slate-600 font-mono">MT5</span>
                                        )}
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.name}</p>
                                    <p className={`text-2xl font-black italic ${kpi.color}`}>{kpi.value}</p>
                                     </motion.div>
                                 ))}
                             </div>
                         </motion.div>
                     )}
                 </div>

            {/* BOTTOM: POSITIONS + DISCIPLINE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* POSITIONS */}
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                    <button onClick={() => toggleSection('positions')}
                        className="w-full flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-2.5">
                            <Eye className="text-sky-400" size={18} />
                            <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Posições Abertas</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-700/50">{positions.length} aberta(s)</span>
                            {collapsedSections['positions'] ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
                        </div>
                    </button>
                    {!collapsedSections['positions'] && (
                    <div className="p-6 pt-4">
                    {positions.length > 0 ? (
                        <div className="space-y-2">
                            {positions.map(pos => (
                                <div key={pos.ticket}
                                    className="flex items-center gap-4 p-4 bg-slate-950/40 rounded-xl border border-white/5 hover:border-sky-500/20 transition-all">
                                    <div className={`w-1 h-12 rounded-full ${pos.type === 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-white italic">{pos.symbol}</span>
                                        {pos.engine && (
                                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                                                {pos.engine}
                                            </span>
                                        )}
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${pos.type === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                            {pos.type === 0 ? 'BUY' : 'SELL'} {pos.volume}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <span>Entry: <span className="text-slate-300 font-black">{pos.price_open.toFixed(2)}</span></span>
                                            <span>Price: <span className="text-slate-300 font-black">{pos.price_current.toFixed(2)}</span></span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xl font-black italic ${pos.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                                        </p>
                                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Flutuante</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Activity size={36} className="mx-auto mb-3 text-slate-700" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhuma posição aberta</p>
                        </div>
                    )}
                </div>
                    )}
                </div>

                {/* DISCIPLINE + QUICK INFO */}
                <div className="space-y-4">
                    <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                        <button onClick={() => toggleSection('discipline')}
                            className="w-full flex items-center justify-between p-6 pb-0">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Disciplina</h3>
                            {collapsedSections['discipline'] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                        </button>
                        {!collapsedSections['discipline'] && <div className="p-6 pt-4"><DisciplinePanel /></div>}
                    </div>

                    {/* METRICS SUMMARY */}
                    <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                        <button onClick={() => toggleSection('resumo')}
                            className="w-full flex items-center justify-between p-6 pb-0">
                            <div className="flex items-center gap-2">
                                <DollarSign className="text-sky-400" size={16} />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumo</span>
                            </div>
                            {collapsedSections['resumo'] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                        </button>
                        {!collapsedSections['resumo'] && (
                        <div className="p-6 pt-4">
                        <div className="space-y-2.5">
                            {[
                                { label: 'Saldo', value: account ? `$${account.balance.toFixed(2)}` : '---', color: 'text-white' },
                                { label: 'Margem', value: account ? `${((account.margin / account.balance) * 100).toFixed(1)}%` : '---', color: 'text-amber-400' },
                                { label: 'Margem Livre', value: account ? `$${account.margin_free.toFixed(2)}` : '---', color: 'text-emerald-400' },
                            ].map((r, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg">
                                    <span className="text-[10px] font-bold text-slate-500">{r.label}</span>
                                    <span className={`text-xs font-black font-mono ${r.color}`}>{r.value}</span>
                                </div>
                            ))}
                        </div>
                        </div>
                        )}
                    </div>
                </div>
            </div>

                {/* ACTIVE BOTS */}
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                    <button onClick={() => toggleSection('bots')}
                        className="w-full flex items-center justify-between p-6 pb-0">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Robôs Ativos</h3>
                        {collapsedSections['bots'] ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
                    </button>
                    {!collapsedSections['bots'] && <div className="p-6 pt-4"><ActiveBotsCard /></div>}
                </div>

                {/* KILL SWITCH */}
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-red-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
                    <button onClick={() => toggleSection('killswitch')}
                        className="w-full flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-2.5">
                            <Power size={18} className="text-red-400" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Kill Switch</h3>
                        </div>
                        {collapsedSections['killswitch'] ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
                    </button>
                    {!collapsedSections['killswitch'] && (
                        <div className="p-6 pt-4">
                            <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">
                                Desliga todos os robôs do Radar FX instantaneamente
                            </p>
                            <button onClick={async () => {
                                if (!confirm('Tem certeza? Todos os robôs serão desligados!')) return;
                                try {
                                    await axios.post('/api/system/engines/disable-all');
                                    alert('✅ Todos os robôs foram desligados!');
                                } catch { alert('❌ Erro ao desligar robôs'); }
                            }}
                                className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.02]">
                                <Power size={16} />
                                Desligar Todos
                            </button>
                        </div>
                    )}
                </div>

                {/* ASSET GRID */}
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                    <button onClick={() => toggleSection('assets')}
                        className="w-full flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-3">
                            <BarChart2 size={18} className="text-sky-400" />
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Ativos do Radar FX</h3>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-700/50">{DASHBOARD_SYMBOLS.length} ativos</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {discipline && (
                                <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">
                                    <span className="flex items-center gap-1"><Eye size={12} className="text-sky-400" /> {discipline.tradeCount || 0} trades hoje</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                                    <span className={discipline.consecutiveLosses > 0 ? 'text-red-400' : 'text-emerald-400'}>{discipline.consecutiveLosses || 0} perdas consec</span>
                                </div>
                            )}
                            {collapsedSections['assets'] ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
                        </div>
                    </button>
                    {!collapsedSections['assets'] && (
            <div className="p-6 pt-4">
            <motion.div variants={container} initial="hidden" animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sortedSymbols.map((sym, idx) => {
                    const usym = sym.id.toUpperCase();
                    const tick = ticks[usym];
                    const sig = getSignalFor(usym);
                    const pos = getPositionFor(usym);
                    const wr = getWinRateFor(usym);
                    const catColor = CATEGORY_COLORS[sym.category] || '#3B82F6';
                    const cData = candles[usym];

                    const changePct = tick?.changePercent || 0;
                    const isUp = changePct >= 0;
                    const price = tick?.bid || 0;

                    return (
                        <motion.div key={sym.id} variants={itemAnim} whileHover={{ y: -4, scale: 1.01 }}
                            className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-sky-500/20 transition-all p-5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* TOP ROW: icon + name + category badge */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                                        {sym.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white italic leading-none">{sym.name}</p>
                                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">{sym.label}</p>
                                    </div>
                                </div>
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                                    {sym.category}
                                </span>
                            </div>

                            {/* PRICE + CHANGE */}
                            <div className="flex items-end justify-between mb-2.5">
                                <div>
                                    <p className="text-2xl font-black text-white italic tabular-nums tracking-tight">
                                        {price > 0 ? formatPrice(usym, price) : '---'}
                                    </p>
                                </div>
                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                    {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                    {changePct.toFixed(2)}%
                                </div>
                            </div>

                            {/* SPARKLINE */}
                            <div className="flex items-center justify-center my-2 h-8">
                                {cData && cData.length > 1 ? (
                                    <Sparkline data={cData} color={isUp ? '#10B981' : '#EF4444'} />
                                ) : (
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                        <div className="w-16 h-[2px] rounded bg-slate-800 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-600 to-transparent animate-pulse" />
                                        </div>
                                        <span className="text-[9px]">carregando...</span>
                                    </div>
                                )}
                            </div>

                            {/* SIGNAL + POSITION + WIN RATE */}
                            <div className="flex items-center justify-between mt-1 pt-2.5 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    {sig ? (
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${sig.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                            {sig.type === 'BUY' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                            {sig.type} {sig.confidence}%
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                            <Minus size={10} /> Neutro
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {pos && (
                                        <span className={`text-[9px] font-black font-mono ${pos.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                                        </span>
                                    )}
                                    {wr > 0 && (
                                        <span className="text-[9px] font-black font-mono text-sky-400">{wr}% WR</span>
                                    )}
                                </div>
                            </div>

                            {/* GLOW ON HOVER */}
                            <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{ background: `radial-gradient(circle, ${catColor}08, transparent)` }} />
                        </motion.div>
                    );
                })}
            </motion.div>
            </div>
                    )}
                </div>

        </div>
    );
};
