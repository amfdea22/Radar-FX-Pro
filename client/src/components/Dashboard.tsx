import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Target, Activity, Info, Plus,
    Shield, Wallet
} from 'lucide-react';
import { SignalScanner } from './SignalScanner';
import { DisciplinePanel } from './DisciplinePanel';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AccountInfo { balance: number; equity: number; margin: number; margin_free: number; profit: number; currency: string; }
interface Position { ticket: number; symbol: string; type: number; volume: number; price_open: number; price_current: number; profit: number; sl: number; tp: number; }

export const Dashboard: React.FC<{ onNewTrade: () => void }> = ({ onNewTrade }) => {
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [positions, setPositions] = useState<Position[]>([]);
    const [discipline, setDiscipline] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [accRes, posRes, discRes] = await Promise.all([
                axios.get('/api/mt5/account'),
                axios.get('/api/mt5/positions'),
                axios.get('/api/mt5/discipline')
            ]);
            setAccount(accRes.data);
            setPositions(posRes.data);
            setDiscipline(discRes.data);
            setLoading(false);
        } catch (error) { console.error('Failed to sync MT5 data:', error); }
    };

    useEffect(() => { fetchData(); const interval = setInterval(fetchData, 5000); return () => clearInterval(interval); }, []);

    const totalProfit = positions.reduce((sum, pos) => sum + pos.profit, 0);
    const stats = [
        { name: 'Saldo Atual', value: account ? `${account.currency} ${account.balance.toLocaleString()}` : '---', change: '+0.0%', isPositive: true, icon: Wallet },
        { name: 'Lucro (24h)', value: discipline ? `$${discipline.profit.toFixed(2)}` : '---', change: (discipline?.profit || 0) >= 0 ? 'Gain' : 'Loss', isPositive: (discipline?.profit || 0) >= 0, icon: Target },
        { name: 'Lucro Aberto', value: `$${totalProfit.toFixed(2)}`, change: totalProfit >= 0 ? '+Líquido' : '-Drawdown', isPositive: totalProfit >= 0, icon: TrendingUp },
        { name: 'Patrimônio (Equity)', value: account ? `${account.currency} ${account.equity.toLocaleString()}` : '---', change: 'Ok', isPositive: true, icon: Activity },
    ];

    return (
        <div className="p-6 space-y-6 overflow-y-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl group hover:border-trader-blue/50 transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-800 rounded-2xl text-slate-400 group-hover:text-trader-blue transition-colors">
                                <stat.icon size={22} />
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${stat.isPositive ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                {stat.change}
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.name}</p>
                        <p className="text-2xl font-black text-white">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Cockpit Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="col-span-1 lg:col-span-2 bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-1">Mercado ao Vivo</h3>
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Posições em Aberto</h2>
                        </div>
                        <div className="px-4 py-2 bg-trader-blue/10 rounded-xl border border-trader-blue/20">
                            <span className="text-[10px] font-black text-trader-blue uppercase">MT5 Sync OK</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {positions.length > 0 ? positions.map((pos) => (
                                <motion.div key={pos.ticket} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center gap-4 p-5 bg-slate-950/60 rounded-3xl border border-slate-800/50 hover:border-trader-blue/30 transition-all group">
                                    <div className={`w-1.5 h-12 rounded-full ${pos.type === 0 ? 'bg-trader-green' : 'bg-trader-red'}`} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-white italic">{pos.symbol}</span>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${pos.type === 0 ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-red/20 text-trader-red'}`}>
                                                {pos.type === 0 ? 'BUY' : 'SELL'} {pos.volume}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 mt-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Entry: <span className="text-slate-300">{pos.price_open}</span></span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Price: <span className="text-slate-300">{pos.price_current}</span></span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xl font-black ${pos.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>{pos.profit >= 0 ? '+' : ''}{pos.profit.toLocaleString()}</p>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro Flutuante</p>
                                    </div>
                                </motion.div>
                            )) : (
                                <div className="p-20 text-center text-slate-600">
                                    <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhuma posição aberta no momento</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-6"><DisciplinePanel /><SignalScanner /></div>
            </div>
        </div>
    );
};
