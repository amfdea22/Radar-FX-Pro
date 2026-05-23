import React, { useState, useEffect } from 'react';
import {
    Users, TrendingUp, Shield, Zap,
    ArrowUpRight, BarChart3, Globe,
    Target, Briefcase, Activity, Power,
    ChevronDown, ChevronUp, Clock, DollarSign,
    Award, BookOpen, History, TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface TradeRecord {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    entry: number;
    exit: number;
    lot: number;
    profit: number;
    date: string;
    duration: string;
}

interface MasterTrader {
    id: string;
    name: string;
    institution: string;
    winRate: number;
    drawdown: number;
    profitToday: number;
    followers: number;
    status: 'online' | 'offline';
    strategy: string;
    risk: 'Low' | 'Medium' | 'High';
    bio: string;
    totalProfit: number;
    totalTrades: number;
    avgTradeTime: string;
    bestTrade: number;
    worstTrade: number;
    sharpeRatio: number;
    tradeHistory: TradeRecord[];
}

const MASTERS: MasterTrader[] = [
    {
        id: '1',
        name: 'Jim Simons',
        institution: 'Renaissance Technologies',
        winRate: 98.4,
        drawdown: 0.5,
        profitToday: 12450.25,
        followers: 1242,
        status: 'online',
        strategy: 'Pure Quant & Neural Arbitrage',
        risk: 'Low',
        bio: 'Fundador da Renaissance Technologies e do fundo Medallion, o fundo mais lucrativo da história (média de 66% ao ano). Matemático e decifrador de códigos, Simons revolucionou o mercado com algoritmos 100% quantitativos que ignoram o fator humano.',
        totalProfit: 1250000,
        totalTrades: 4520,
        avgTradeTime: '2m 15s',
        bestTrade: 4500,
        worstTrade: -200,
        sharpeRatio: 4.8,
        tradeHistory: [
            { id: 't1', symbol: 'XAUUSD', type: 'BUY', entry: 2042.50, exit: 2045.80, lot: 5.0, profit: 1650.00, date: '2026-02-28', duration: '1m 45s' },
            { id: 't2', symbol: 'NAS100', type: 'SELL', entry: 17850.00, exit: 17825.00, lot: 10.0, profit: 2500.00, date: '2026-02-28', duration: '3m 12s' },
            { id: 't3', symbol: 'EURUSD', type: 'BUY', entry: 1.08250, exit: 1.08320, lot: 50.0, profit: 350.00, date: '2026-02-28', duration: '58s' }
        ]
    },
    {
        id: '2',
        name: 'George Soros',
        institution: 'Soros Fund Management',
        winRate: 91.2,
        drawdown: 2.1,
        profitToday: 8520.10,
        followers: 845,
        status: 'online',
        strategy: 'Global Macro & Institutional Bias',
        risk: 'Medium',
        bio: 'O homem que "quebrou o Banco da Inglaterra". Mestre da Teoria da Reflexividade, Soros foca em grandes desequilíbrios macroeconômicos e movimentos de manada instuticionais. Sua estratégia busca capturar reversões brutais em ativos globais.',
        totalProfit: 850000,
        totalTrades: 2150,
        avgTradeTime: '45m',
        bestTrade: 12000,
        worstTrade: -1500,
        sharpeRatio: 3.2,
        tradeHistory: [
            { id: 't4', symbol: 'US30', type: 'SELL', entry: 38250.0, exit: 38180.0, lot: 5.0, profit: 3500.00, date: '2026-02-28', duration: '42m' },
            { id: 't5', symbol: 'GBPUSD', type: 'BUY', entry: 1.26500, exit: 1.26420, lot: 20.0, profit: -1600.00, date: '2026-02-28', duration: '1h 15m' },
            { id: 't6', symbol: 'BTCUSD', type: 'SELL', entry: 62450.0, exit: 62100.0, lot: 2.0, profit: 700.00, date: '2026-02-28', duration: '2h 30m' }
        ]
    },
    {
        id: '3',
        name: 'Ray Dalio',
        institution: 'Bridgewater Associates',
        winRate: 88.5,
        drawdown: 1.2,
        profitToday: 5410.50,
        followers: 2105,
        status: 'online',
        strategy: 'All Weather Stability',
        risk: 'Low',
        bio: 'Criador da maior gestora de hedge funds do mundo, a Bridgewater. Dalio opera o portfólio "All Weather", focado em algoritmos que performam em qualquer condição de mercado (crise, inflação ou crescimento). Prioridade máxima em preservação de capital.',
        totalProfit: 980000,
        totalTrades: 3840,
        avgTradeTime: '1h 20m',
        bestTrade: 3200,
        worstTrade: -450,
        sharpeRatio: 3.7,
        tradeHistory: [
            { id: 't7', symbol: 'EURUSD', type: 'BUY', entry: 1.08150, exit: 1.08280, lot: 30.0, profit: 390.00, date: '2026-02-28', duration: '3h' },
            { id: 't8', symbol: 'USDJPY', type: 'SELL', entry: 150.80, exit: 150.45, lot: 25.0, profit: 875.00, date: '2026-02-28', duration: '5h 12m' },
            { id: 't9', symbol: 'ETHUSD', type: 'BUY', entry: 3450.0, exit: 3485.0, lot: 10.0, profit: 350.00, date: '2026-02-28', duration: '8h' }
        ]
    }
];

export const CopyTraderPanel: React.FC = () => {
    const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
    const [loadingMaster, setLoadingMaster] = useState<string | null>(null);
    const [networkStatus, setNetworkStatus] = useState<'connected' | 'waiting'>('waiting');
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const resp = await axios.get('/api/mt5/copy-trader/status');
                setActiveMasterId(resp.data.activeMasterId);
                setNetworkStatus(resp.data.activeMasterId ? 'connected' : 'waiting');
            } catch (e) {
                console.error('Failed to sync CopyTrader status');
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 7000);
        return () => clearInterval(interval);
    }, []);

    const handleFollow = async (id: string) => {
        setLoadingMaster(id);
        try {
            const nextId = activeMasterId === id ? null : id;
            await axios.post('/api/mt5/copy-trader/follow', { masterId: nextId });
            setActiveMasterId(nextId);
            setNetworkStatus(nextId ? 'connected' : 'waiting');
        } catch (e) {
            console.error('CopyTrader action failed');
        } finally {
            setLoadingMaster(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Headline Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Briefcase className="text-indigo-400" size={20} />
                        </div>
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Copy Trader Institucional</h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Replicação de ordens em tempo real de grandes players</p>
                </div>

                <div className="flex gap-4 relative z-10">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status da Rede</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${networkStatus === 'connected' ? 'bg-trader-green/10 border-trader-green/20 text-trader-green' : 'bg-trader-red/10 border-trader-red/20 text-trader-red'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${networkStatus === 'connected' ? 'bg-trader-green' : 'bg-trader-red'}`}></div>
                            <span className="text-[10px] font-black uppercase">{networkStatus === 'connected' ? 'Link Institucional Ativo' : 'Aguardando Master'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Master Traders Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {MASTERS.map((master) => (
                    <motion.div
                        key={master.id}
                        whileHover={{ y: -5 }}
                        className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border transition-all overflow-hidden relative group ${activeMasterId === master.id ? 'border-trader-blue ring-1 ring-trader-blue/50' : 'border-white/5 hover:border-white/10'}`}
                    >
                        {/* Header card */}
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-trader-blue to-indigo-600 flex items-center justify-center text-white font-black text-xl italic shadow-lg">
                                        {master.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black uppercase italic tracking-tighter">{master.name}</h3>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{master.institution}</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${master.status === 'online' ? 'bg-trader-green/10 text-trader-green' : 'bg-slate-800 text-slate-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${master.status === 'online' ? 'bg-trader-green animate-pulse' : 'bg-slate-500'}`}></div>
                                    {master.status}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Acertividade</span>
                                    <span className="text-lg font-black text-trader-green italic leading-none">{master.winRate}%</span>
                                </div>
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Lucro Hoje</span>
                                    <span className="text-lg font-black text-white italic leading-none">${master.profitToday.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="bg-slate-950/20 p-2 rounded-xl border border-white/5 text-center">
                                    <span className="text-[6px] font-black text-slate-500 uppercase block">Drawdown</span>
                                    <span className="text-[10px] font-black text-trader-red">{master.drawdown}%</span>
                                </div>
                                <div className="bg-slate-950/20 p-2 rounded-xl border border-white/5 text-center">
                                    <span className="text-[6px] font-black text-slate-500 uppercase block">Sharpe</span>
                                    <span className="text-[10px] font-black text-trader-blue">{master.sharpeRatio}</span>
                                </div>
                                <div className="bg-slate-950/20 p-2 rounded-xl border border-white/5 text-center">
                                    <span className="text-[6px] font-black text-slate-500 uppercase block">Tempo Médio</span>
                                    <span className="text-[10px] font-black text-slate-300">{master.avgTradeTime}</span>
                                </div>
                            </div>

                            {/* Detalhes de Carreira - NEW */}
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 mb-6">
                                <h4 className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Activity size={10} className="text-trader-blue" /> Estatísticas de Carreira
                                </h4>
                                <div className="grid grid-cols-2 gap-y-3">
                                    <div className="flex flex-col">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Lucro Total</span>
                                        <span className="text-xs font-black text-white italic tracking-tight">${master.totalProfit.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Total Operações</span>
                                        <span className="text-xs font-black text-white italic tracking-tight">{master.totalTrades.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Melhor Win</span>
                                        <span className="text-xs font-black text-trader-green italic tracking-tight">+${master.bestTrade.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Maior Loss</span>
                                        <span className="text-xs font-black text-trader-red italic tracking-tight">${master.worstTrade.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-3">
                                    <Zap size={14} className="text-trader-amber" />
                                    <span className="text-[10px] font-bold text-slate-300 italic">{master.strategy}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Users size={14} className="text-trader-blue" />
                                    <span className="text-[10px] font-bold text-slate-300">{master.followers.toLocaleString()} Seguidores</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleFollow(master.id)}
                                disabled={loadingMaster === master.id}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 mb-4 ${activeMasterId === master.id
                                    ? 'bg-trader-red/20 border border-trader-red/30 text-trader-red hover:bg-trader-red/30'
                                    : 'bg-trader-blue hover:bg-trader-blue-hover text-white shadow-[0_0_20px_rgba(0,163,255,0.3)]'
                                    }`}
                            >
                                {loadingMaster === master.id ? (
                                    <Activity size={16} className="animate-spin" />
                                ) : activeMasterId === master.id ? (
                                    <>
                                        <Shield size={16} /> Parar Cópia
                                    </>
                                ) : (
                                    <>
                                        <Target size={16} /> Copiar Trader
                                    </>
                                )}
                            </button>

                            {/* Today's History Toggle */}
                            <button
                                onClick={() => setExpandedHistory(expandedHistory === master.id ? null : master.id)}
                                className="w-full py-2 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                            >
                                <History size={12} />
                                {expandedHistory === master.id ? 'Ocultar Trades de Hoje' : 'Ver Trades de Hoje'}
                                {expandedHistory === master.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            {/* Expanded History Section */}
                            <AnimatePresence>
                                {expandedHistory === master.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-6 space-y-3">
                                            {master.tradeHistory.map((trade) => (
                                                <div key={trade.id} className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1 h-8 rounded-full ${trade.profit > 0 ? 'bg-trader-green' : 'bg-trader-red'}`}></div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-white italic">{trade.symbol}</span>
                                                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${trade.type === 'BUY' ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-red/20 text-trader-red'}`}>
                                                                    {trade.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-[7px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Entrada: {trade.entry} | Duração: {trade.duration}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black italic ${trade.profit > 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                            {trade.profit > 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                                        </p>
                                                        <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest">Executado</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {master.tradeHistory.length === 0 && (
                                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center py-4">Nenhuma operação realizada hoje.</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer card info */}
                        <div className="bg-slate-950/40 p-6 border-t border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 leading-relaxed">
                                {master.bio}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
