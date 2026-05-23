import React, { useState, useEffect } from 'react';
import { 
    Coins, 
    Zap, 
    TrendingUp, 
    Shield, 
    Activity, 
    ArrowUpRight, 
    ArrowDownRight, 
    RefreshCw, 
    Settings,
    Cpu,
    Brain,
    Lock,
    Unlock,
    BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export const CryptoHubPanel: React.FC = () => {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchData = async () => {
        setIsUpdating(true);
        try {
            const response = await axios.get('/api/mt5/crypto-ia/status');
            setStatus(response.data);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch crypto status:', error);
        } finally {
            setLoading(false);
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, []);

    const toggleEngine = async () => {
        if (!status) return;
        try {
            const newEnabled = !status.settings.enabled;
            await axios.post('/api/mt5/crypto-ia/settings', { enabled: newEnabled });
            await fetchData();
        } catch (error) {
            console.error('Toggle engine failed:', error);
        }
    };

    if (loading && !status) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <RefreshCw size={32} className="text-fuchsia-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando Rede Neural...</span>
            </div>
        );
    }

    const neuroScores = status?.neuroScores || {};
    const settings = status?.settings || {};
    const bestAsset = status?.bestAsset || 'BTCUSD';

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-3xl border border-white/5"
                >
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">% Acerto Alpha</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-fuchsia-400 italic">{status?.winRate || '88.5'}%</span>
                        <TrendingUp size={14} className="text-trader-green" />
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-3xl border border-white/5"
                >
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Profit 24h</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-white italic">${status?.dailyProfit || '0.00'}</span>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-3xl border border-white/5"
                >
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Melhor Ativo</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-cyan-400 italic uppercase">{bestAsset.replace('USD', '')}</span>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={`${settings.enabled ? 'bg-fuchsia-500/10 border-fuchsia-500/20' : 'bg-slate-900/40 border-white/5'} backdrop-blur-xl p-4 rounded-3xl border transition-colors cursor-pointer`}
                    onClick={toggleEngine}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Status Robô</p>
                        {settings.enabled ? <Unlock size={12} className="text-fuchsia-400" /> : <Lock size={12} className="text-slate-600" />}
                    </div>
                    <span className={`text-lg font-black italic uppercase ${settings.enabled ? 'text-fuchsia-400' : 'text-slate-600'}`}>
                        {settings.enabled ? 'ON' : 'OFF'}
                    </span>
                </motion.div>
            </div>

            {/* Neural Signal Radar */}
            <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-fuchsia-500/5 to-transparent pointer-events-none" />
                
                <div className="p-6 md:p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Brain className="text-fuchsia-500" size={18} />
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Neuro Radar Cripto</h2>
                            </div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">IA de Alta Frequência 24/7</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest tabular-nums">
                                {lastUpdate.toLocaleTimeString()}
                            </span>
                            <motion.button 
                                whileTap={{ rotate: 180 }}
                                onClick={fetchData}
                                className={`p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors ${isUpdating ? 'animate-spin' : ''}`}
                            >
                                <RefreshCw size={14} className="text-fuchsia-500" />
                            </motion.button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(neuroScores).slice(0, 10).map(([symbol, score]: [string, any], idx) => (
                            <motion.div 
                                key={symbol}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group relative bg-slate-950/40 p-5 rounded-[1.8rem] border border-white/5 hover:border-fuchsia-500/30 transition-all flex items-center justify-between overflow-hidden"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-300 font-black text-[10px] group-hover:scale-110 group-hover:bg-fuchsia-500/10 group-hover:text-fuchsia-400 transition-all">
                                        {symbol.substring(0, 3)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white italic uppercase tracking-tight">{symbol}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1 w-16 bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${score}%` }}
                                                    className={`h-full ${score >= 80 ? 'bg-fuchsia-500 shadow-[0_0_8px_rgba(232,28,255,0.5)]' : 'bg-slate-600'}`}
                                                />
                                            </div>
                                            <span className={`text-[8px] font-black uppercase ${score >= 80 ? 'text-fuchsia-400' : 'text-slate-600'}`}>
                                                {score}% Trust
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end">
                                    {score >= 80 ? (
                                        <div className="flex items-center gap-1 text-fuchsia-500 animate-pulse">
                                            <Zap size={12} fill="currentColor" />
                                            <span className="text-[8px] font-black uppercase tracking-tighter italic">Alpha Signal</span>
                                        </div>
                                    ) : (
                                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-tighter italic">Monitorando...</span>
                                    )}
                                    <div className="flex items-center gap-1 mt-1">
                                        <ArrowUpRight size={14} className={score > 50 ? 'text-trader-green' : 'text-slate-700 opacity-20'} />
                                        <ArrowDownRight size={14} className={score <= 50 ? 'text-trader-red' : 'text-slate-700 opacity-20'} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Smart Grid Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity size={20} className="text-cyan-400" />
                        <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Parâmetros Neural-Grid</h3>
                    </div>
                    
                    <div className="space-y-4">
                        {[
                            { label: 'Smart Grid IA', enabled: settings.smartGridIA },
                            { label: 'Fases Fibonacci', enabled: settings.fiboLevels },
                            { label: 'Trailing Dinâmico', enabled: settings.smartTrailing },
                            { label: 'News Guard 24h', enabled: settings.newsGuard },
                        ].map((item) => (
                            <div key={item.label} className="flex justify-between items-center p-3 bg-slate-950/30 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                                <div className={`w-2 h-2 rounded-full ${item.enabled ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-slate-800'}`} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Cpu size={80} />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <Shield size={20} className="text-trader-amber" />
                        <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Gestão de Risco Institutional</h3>
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Max Daily Risk</p>
                                <p className="text-xl font-black text-white italic">${settings.maxDailyLoss || '500'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Profit Target</p>
                                <p className="text-xl font-black text-trader-green italic">${settings.maxDailyProfit || '1000'}</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <div className="flex justify-between mb-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Utilização da Banca</span>
                                <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">{settings.riskPercent || '1.0'}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-950 rounded-full border border-white/5 px-0.5 flex items-center">
                                <motion.div 
                                    className="h-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(settings.riskPercent || 1) * 20}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
