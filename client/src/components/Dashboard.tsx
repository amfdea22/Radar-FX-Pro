import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Target, Activity, Plus,
    Shield, Wallet, Bot, CircleDot, RefreshCw, Cpu, Eye
} from 'lucide-react';
import { SignalScanner } from './SignalScanner';
import { DisciplinePanel } from './DisciplinePanel';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AccountInfo { balance: number; equity: number; margin: number; margin_free: number; profit: number; currency: string; }
interface Position { ticket: number; symbol: string; type: number; volume: number; price_open: number; price_current: number; profit: number; sl: number; tp: number; }

function CockpitLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
                <filter id="cglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="17" fill="none" stroke="url(#cg)" strokeWidth="2" filter="url(#cglow)" />
            <circle cx="22" cy="22" r="10" fill="none" stroke="url(#cg)" strokeWidth="1.5" opacity="0.6" />
            <circle cx="22" cy="22" r="4" fill="url(#cg)" />
            <line x1="22" y1="5" x2="22" y2="10" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <line x1="22" y1="34" x2="22" y2="39" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <line x1="5" y1="22" x2="10" y2="22" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <line x1="34" y1="22" x2="39" y2="22" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </svg>
    );
}

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

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-sky-500/10 rounded-3xl border border-sky-500/20 shadow-xl shadow-sky-500/10">
                        <CockpitLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Radar</span> Sinais
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${account ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {account ? 'Live' : 'Offline'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-sky-500" /> Painel de Controle Principal — MT5 em Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={() => { setLoading(true); fetchData(); }} className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-500 rounded-2xl hover:bg-sky-500/20 transition-all flex items-center gap-2 group" title="Recarregar">
                        <RefreshCw size={16} className="group-hover:rotate-90 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Sincronizar</span>
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{account?.currency || 'USD'}</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${account ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${account ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                            <span className="text-[10px] font-black uppercase">{account ? `Conta ${account.balance.toFixed(0)}` : 'Desconectado'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { name: 'Saldo Atual', value: account ? `$${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---', icon: Wallet, color: 'text-white', bgIcon: 'bg-sky-500/20 text-sky-500' },
                        { name: 'Lucro (24h)', value: discipline ? `$${discipline.profit.toFixed(2)}` : '---', icon: Target, color: (discipline?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', bgIcon: (discipline?.profit || 0) >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500' },
                        { name: 'Lucro Aberto', value: `$${totalProfit.toFixed(2)}`, icon: TrendingUp, color: totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400', bgIcon: totalProfit >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500' },
                        { name: 'Patrimônio', value: account ? `$${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---', icon: Activity, color: 'text-white', bgIcon: 'bg-indigo-500/20 text-indigo-500' },
                    ].map((stat, i) => (
                        <motion.div key={i} whileHover={{ y: -4 }} className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-sky-500/20 transition-all">
                            <div className="flex items-center gap-4 mb-3">
                                <div className={`p-3 rounded-xl ${stat.bgIcon}`}>
                                    <stat.icon size={20} />
                                </div>
                            </div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.name}</p>
                            <p className={`text-2xl font-black italic ${stat.color}`}>{stat.value}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* SINAIS SCANNER */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent"></div>
                    <SignalScanner />
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent"></div>
                        <DisciplinePanel />
                    </div>
                </div>
            </div>

            {/* ACCOUNT INFO */}
            {account && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <Wallet className="text-sky-500" size={20} />
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Detalhes da Conta</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Saldo</p>
                            <p className="text-xl font-black text-white italic tabular-nums">${account.balance.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Equity</p>
                            <p className={`text-xl font-black italic tabular-nums ${account.equity >= account.balance ? 'text-emerald-400' : 'text-red-400'}`}>${account.equity.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Margem</p>
                            <p className="text-xl font-black text-amber-400 italic tabular-nums">${account.margin.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Margem Livre</p>
                            <p className="text-xl font-black text-emerald-400 italic tabular-nums">${account.margin_free.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
