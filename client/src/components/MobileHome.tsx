import React, { useState, useEffect } from 'react';
import {
    Wallet,
    Activity,
    TrendingUp,
    Target,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    ShieldCheck,
    BarChart3,
    AlertTriangle,
    Zap,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AccountInfo {
    balance: number;
    equity: number;
    margin: number;
    margin_free: number;
    profit: number;
    currency: string;
}

interface Position {
    ticket: number;
    symbol: string;
    type: number;
    volume: number;
    price_open: number;
    price_current: number;
    profit: number;
    sl: number;
    tp: number;
}

interface DisciplineData {
    daily_profit: number;
    daily_trades: number;
    win_rate: number;
    drawdown: number;
    consecutive_losses: number;
    sniper_active: boolean;
}

export const MobileHome: React.FC<{ onTradeClick: () => void }> = ({ onTradeClick }) => {
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [positions, setPositions] = useState<Position[]>([]);
    const [discipline, setDiscipline] = useState<DisciplineData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [accRes, posRes, discRes] = await Promise.all([
                axios.get('/api/mt5/account'),
                axios.get('/api/mt5/positions'),
                axios.get('/api/mt5/discipline').catch(() => null)
            ]);
            setAccount(accRes.data);
            setPositions(posRes.data);
            if (discRes?.data) setDiscipline(discRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to sync mobile data:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const totalProfit = (positions || []).reduce((sum, pos) => sum + pos.profit, 0);
    const dailyProfit = discipline?.daily_profit ?? null;
    const isDailyPositive = dailyProfit !== null && dailyProfit >= 0;
    const isDailyNegative = dailyProfit !== null && dailyProfit < 0;
    const winRate = discipline?.win_rate ?? null;

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Account Overview Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-900 backdrop-blur-2xl rounded-[2rem] p-5 md:p-7 border border-white/5 shadow-2xl overflow-hidden relative"
            >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                    <Wallet size={140} />
                </div>

                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Status da Conta</p>
                        <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase">
                            {account ? `${account.currency} ${account.balance.toLocaleString()}` : '---'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {positions.length > 0 && (
                            <div className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/20 rounded-full flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest">{positions.length}</span>
                            </div>
                        )}
                        <div className="px-2.5 py-1 bg-trader-green/20 border border-trader-green/30 rounded-full flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-trader-green rounded-full animate-pulse" />
                            <span className="text-[7px] md:text-[8px] font-black text-trader-green uppercase tracking-widest">LIVE</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-white/[0.04] p-3 md:p-4 rounded-2xl border border-white/[0.06]">
                        <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Equity</p>
                        <p className="text-base md:text-lg font-black text-white leading-none">
                            {account ? account.equity.toLocaleString() : '---'}
                        </p>
                    </div>
                    <div className="bg-white/[0.04] p-3 md:p-4 rounded-2xl border border-white/[0.06]">
                        <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Lucro Aberto</p>
                        <p className={`text-base md:text-lg font-black leading-none ${totalProfit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                            {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white/[0.04] p-3 md:p-4 rounded-2xl border border-white/[0.06]">
                        <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Lucro 24h</p>
                        <p className={`text-base md:text-lg font-black leading-none ${isDailyPositive ? 'text-trader-green' : isDailyNegative ? 'text-trader-red' : 'text-slate-400'}`}>
                            {dailyProfit !== null ? `${dailyProfit >= 0 ? '+' : ''}${dailyProfit.toFixed(2)}` : '---'}
                        </p>
                    </div>
                    <div className="bg-white/[0.04] p-3 md:p-4 rounded-2xl border border-white/[0.06]">
                        <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Win Rate</p>
                        <p className="text-base md:text-lg font-black leading-none text-trader-cyan">
                            {winRate !== null ? `${winRate.toFixed(1)}%` : '---'}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Quick Actions + Scanner Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onTradeClick}
                    className="col-span-1 md:col-span-2 bg-trader-blue h-14 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center gap-2.5 shadow-xl shadow-trader-blue/20 active:scale-95 transition-all"
                >
                    <Activity size={18} className="text-white" />
                    <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest">Operar Agora</span>
                </motion.button>
                <div className="col-span-1 bg-slate-900/40 border border-white/5 rounded-2xl md:rounded-3xl flex items-center justify-center gap-2.5">
                    <ShieldCheck size={16} className="text-trader-cyan" />
                    <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Guardian</span>
                </div>
                <div className={`col-span-1 bg-slate-900/40 border rounded-2xl md:rounded-3xl flex items-center justify-center gap-2.5 ${discipline?.sniper_active ? 'border-emerald-500/20' : 'border-white/5'}`}>
                    <Zap size={16} className={discipline?.sniper_active ? 'text-emerald-400' : 'text-slate-600'} />
                    <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${discipline?.sniper_active ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {discipline?.sniper_active ? 'Sniper Ativo' : 'Sniper Off'}
                    </span>
                </div>
            </div>

            {/* Active Positions List */}
            <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between items-center px-1 md:px-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[11px] md:text-xs font-black text-white uppercase tracking-[0.2em]">Posições ({(positions || []).length})</h3>
                        {(positions || []).length > 0 && (
                            <span className="text-[7px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                {(positions || []).reduce((sum, p) => sum + p.volume, 0).toFixed(2)} lots
                            </span>
                        )}
                    </div>
                    <Clock size={13} className="text-slate-600" />
                </div>

                <div className="space-y-2.5 md:space-y-3">
                    <AnimatePresence mode="popLayout">
                        {positions.length > 0 ? (
                            positions.map((pos, idx) => (
                                <motion.div
                                    key={pos.ticket}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-slate-900/40 backdrop-blur-xl p-3.5 md:p-4 rounded-2xl md:rounded-3xl border border-white/5 flex items-center gap-3 md:gap-4 active:bg-slate-800/60 transition-colors"
                                >
                                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${pos.type === 0 ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                        {pos.type === 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm md:text-base font-black text-white italic truncate">{pos.symbol}</span>
                                            <span className="text-[7px] md:text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase whitespace-nowrap">
                                                {pos.volume}
                                            </span>
                                        </div>
                                        <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                            {pos.type === 0 ? 'COMPRA' : 'VENDA'} · {pos.price_open}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-sm md:text-base font-black ${pos.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                            {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                                        </p>
                                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none">USD</p>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-slate-900/20 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-8 md:p-12 text-center"
                            >
                                <div className="relative inline-block mb-4">
                                    <Activity size={36} className="text-slate-800 opacity-20" />
                                    <RefreshCw size={14} className="text-slate-600 absolute bottom-0 -right-1 animate-spin" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Scanner aguardando setups...</p>
                                <p className="text-[8px] font-bold text-slate-700 mt-2 uppercase tracking-wider">Sniper monitorando M1</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Daily Stats Footer */}
            {discipline && (
                <div className="bg-slate-900/20 border border-white/5 rounded-2xl md:rounded-3xl p-3 md:p-4">
                    <div className="flex items-center justify-between text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                            <BarChart3 size={12} className="text-slate-600" />
                            Trades Hoje: <span className="text-white">{discipline.daily_trades || 0}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-slate-600" />
                            Drawdown: <span className={discipline.drawdown > 0 ? 'text-trader-red' : 'text-slate-400'}>{discipline.drawdown?.toFixed(1) ?? '0.0'}%</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            Perdas Seg.: <span className={discipline.consecutive_losses > 2 ? 'text-trader-red' : 'text-white'}>{discipline.consecutive_losses || 0}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
