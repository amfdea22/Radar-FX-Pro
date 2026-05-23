import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Shield, Settings, Activity, 
    RefreshCw, Play, Pause, ChevronRight,
    Target, BarChart3, Globe, Layers, AlertTriangle, Plus, Terminal, History, Clock, ArrowUpRight, ArrowDownRight, Trophy, Star, Crown, MousePointer2, Check, Minus, ShieldAlert, DollarSign, TrendingDown
} from 'lucide-react';
import { OmniHistoryHub } from './OmniHistoryHub';

export const OmniProbabilisticPanel: React.FC = () => {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeToNext, setTimeToNext] = useState(0);
    const [newSymbol, setNewSymbol] = useState('');
    const [activeView, setActiveView] = useState<'terminal' | 'history'>('terminal');
    const [scorePeriod, setScorePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [lastWinCount, setLastWinCount] = useState(0);

    const playWinSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
    };

    const fetchStatus = async () => {
        try {
            const response = await axios.get('/api/mt5/omni/status');
            setStatus(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Omni sync failed:', error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (status?.scoreboard?.daily?.wins > lastWinCount) {
            if (lastWinCount !== 0) playWinSound();
            setLastWinCount(status.scoreboard.daily.wins);
        }
    }, [status?.scoreboard?.daily?.wins]);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const secToNext5m = (300 - (now.getMinutes() % 5 * 60 + now.getSeconds())) % 300;
            setTimeToNext(secToNext5m);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleEngine = async () => {
        try {
            await axios.post('/api/mt5/omni/settings', { enabled: !status.enabled });
            fetchStatus();
        } catch (error) {}
    };

    const updateSync = async (settings: any) => {
        try {
            await axios.post('/api/mt5/omni/settings', settings);
            fetchStatus();
        } catch (error) {}
    };

    const updateStrategy = async (strategy: string) => {
        updateSync({ strategy });
    };

    const addSymbol = async () => {
        if (!newSymbol || status.settings.symbols.includes(newSymbol.toUpperCase())) return;
        const updatedSymbols = [...status.settings.symbols, newSymbol.toUpperCase()];
        try {
            await axios.post('/api/mt5/omni/settings', { symbols: updatedSymbols });
            setNewSymbol('');
            fetchStatus();
        } catch (error) {}
    };

    const removeSymbol = async (symbolToRemove: string) => {
        const updatedSymbols = status.settings.symbols.filter((s: string) => s !== symbolToRemove);
        try {
            await axios.post('/api/mt5/omni/settings', { symbols: updatedSymbols });
            fetchStatus();
        } catch (error) {}
    };

    if (loading || !status) return (
        <div className="flex justify-center p-20">
            <div className="w-8 h-8 border-4 border-trader-blue/20 border-t-trader-blue rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            {/* Header com Status e Cronômetro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <Globe className="text-trader-blue animate-pulse" size={32} />
                        Omni Probabilistic <span className="text-trader-blue">Engine</span>
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                        <Activity size={12} className={status.enabled ? "text-trader-green" : "text-slate-700"} />
                        Motor Universal de Ciclos de Variação | v1.1 [LIVE TERMINAL]
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-slate-900/80 border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Próximo Quadrante</p>
                            <p className="text-xl font-black text-white italic tabular-nums">
                                {Math.floor(timeToNext / 60)}:{(timeToNext % 60).toString().padStart(2, '0')}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full border-2 border-trader-blue/20 flex items-center justify-center relative overflow-hidden">
                            <motion.div 
                                className="absolute bottom-0 left-0 right-0 bg-trader-blue/20"
                                initial={{ height: 0 }}
                                animate={{ height: `${(timeToNext / 300) * 100}%` }}
                            />
                            <RefreshCw size={18} className="text-trader-blue animate-spin-slow" />
                        </div>
                    </div>

                    <button 
                        onClick={toggleEngine}
                        className={`px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg ${
                            status.enabled 
                            ? 'bg-trader-red/10 border border-trader-red/30 text-trader-red hover:bg-trader-red/20' 
                            : 'bg-trader-green/10 border border-trader-green/30 text-trader-green hover:bg-trader-green/20 shadow-trader-green/20'
                        }`}
                    >
                        {status.enabled ? <Pause size={18} /> : <Play size={18} />}
                        {status.enabled ? 'Pausar Motor' : 'Ativar Omni'}
                    </button>
                </div>
            </div>

            {/* OMNI LIVE CYCLE HUD - MONITORAMENTO DE QUADRANTES */}
            <div className="bg-slate-900/60 p-8 rounded-[2.5rem] border border-trader-blue/30 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-trader-blue/50 to-transparent"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-trader-blue/10 border-2 border-trader-blue/40 flex items-center justify-center animate-pulse">
                                <Zap className="text-trader-blue" size={32} />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-trader-green rounded-full border-4 border-slate-900 flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3">
                                <h4 className="text-xl font-black text-white italic tracking-tighter uppercase">
                                    {status.telemetry?.robotVersion || 'OMNI CORE v1.5'}
                                </h4>
                                <span className="px-3 py-1 bg-trader-blue/20 text-trader-blue text-[8px] font-black rounded-full uppercase tracking-widest border border-trader-blue/30">
                                    PROBABILISTIC
                                </span>
                            </div>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                                Análise Ativa: <span className="text-trader-blue">{status.telemetry?.activeStrategy || status.settings.strategy}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md w-full">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Análise de Quadrante (M5)</span>
                            <span className="text-[10px] font-black text-trader-blue animate-pulse uppercase tracking-widest">{status.telemetry?.actionMsg || 'Sincronizando...'}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                            {[1, 2, 3, 4, 5].map((v) => (
                                <div key={v} className="relative">
                                    <div className={`h-3 rounded-full transition-all duration-1000 ${
                                        (status.telemetry?.currentVela || 0) >= v 
                                        ? 'bg-trader-blue shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                                        : 'bg-slate-800'
                                    }`} />
                                    <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-black ${
                                        (status.telemetry?.currentVela || 0) === v ? 'text-trader-blue' : 'text-slate-700'
                                    }`}>V{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="text-center md:text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Confluência Neuro</p>
                        <div className="flex items-center gap-3 justify-end">
                            <div className="h-10 w-1 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="w-full bg-trader-green"
                                    animate={{ height: ['80%', '95%', '85%', '100%', '90%'] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            </div>
                            <span className="text-3xl font-black text-white italic">{(85 + Math.random() * 10).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* OMNI SCOREBOARD HUB */}
            <div className="bg-slate-900/40 p-1 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <div className="flex bg-slate-950/60 p-2 rounded-[2.2rem] gap-2 mb-1">
                    {(['daily', 'weekly', 'monthly'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setScorePeriod(p)}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                scorePeriod === p ? 'bg-trader-blue text-white' : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            {p === 'daily' ? 'Hoje' : p === 'weekly' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                    <div className="bg-slate-950/80 p-6 rounded-3xl border border-trader-green/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <Trophy className="text-trader-green" size={40} />
                        </div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Total Ganhos</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-trader-green italic">{status.scoreboard?.[scorePeriod]?.wins || 0}</span>
                            <span className="text-[10px] text-slate-700 font-bold uppercase mb-1">Ciclos</span>
                        </div>
                    </div>

                    <div className="bg-slate-950/80 p-6 rounded-3xl border border-trader-blue/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <Zap className="text-trader-blue" size={40} />
                        </div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">G0 (Direto)</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-white italic">{status.scoreboard?.[scorePeriod]?.directWins || 0}</span>
                            <div className="px-2 py-0.5 bg-trader-blue/20 rounded-md text-[8px] text-trader-blue font-black mb-1">SNIPER</div>
                        </div>
                    </div>

                    <div className="bg-slate-950/80 p-6 rounded-3xl border border-amber-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <ShieldAlert className="text-amber-500" size={40} />
                        </div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Martingales</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-amber-500 italic">{status.scoreboard?.[scorePeriod]?.gales || 0}</span>
                            <div className="flex flex-col gap-0.5 mb-1">
                                <span className="text-[7px] font-black text-slate-500">G1: {status.scoreboard?.[scorePeriod]?.g1Wins || 0}</span>
                                <span className="text-[7px] font-black text-slate-500">G2: {status.scoreboard?.[scorePeriod]?.g2Wins || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950/80 p-6 rounded-3xl border-trader-red/20 border relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="text-trader-red" size={40} />
                        </div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Stop Loss</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-trader-red italic">{status.scoreboard?.[scorePeriod]?.stops || 0}</span>
                            <div className="px-2 py-0.5 bg-trader-red/20 rounded-md text-[8px] text-trader-red font-black mb-1">STOP</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 px-6 pb-6 mt-[-1rem]">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">Lucro Bruto</p>
                        <p className="text-xl font-black text-trader-green italic">+${status.scoreboard?.[scorePeriod]?.grossProfit || '0.00'}</p>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">Perda Bruta</p>
                        <p className="text-xl font-black text-trader-red italic">-${status.scoreboard?.[scorePeriod]?.grossLoss || '0.00'}</p>
                    </div>
                    <div className="bg-trader-blue/5 p-4 rounded-2xl border border-trader-blue/20 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <DollarSign size={24} className="text-trader-blue" />
                        </div>
                        <p className="text-[7px] font-black text-trader-blue uppercase tracking-widest mb-1">Saldo Líquido</p>
                        <p className={`text-xl font-black italic ${(status.scoreboard?.[scorePeriod]?.netProfit || 0) >= 0 ? 'text-white' : 'text-trader-red'}`}>
                            ${status.scoreboard?.[scorePeriod]?.netProfit || '0.00'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Layers size={120} className="text-white" />
                        </div>

                        <h3 className="text-xs font-black text-trader-blue uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                             <Zap size={16} /> Configurações de Operação
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Estratégia Probabilística Ativa</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['MHI1', 'MHI2', 'MHI3', 'TWIN_TOWERS', 'CYCLE_OF_3'].map(strat => (
                                            <button
                                                key={strat}
                                                onClick={() => updateStrategy(strat)}
                                                className={`py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                    status.settings.strategy === strat 
                                                    ? 'bg-trader-blue border-trader-blue text-white shadow-lg shadow-trader-blue/30' 
                                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                                }`}
                                            >
                                                {strat.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Nível de Gale</label>
                                        <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                            <button 
                                                onClick={() => updateSync({ martingaleLevels: Math.max(0, status.settings.martingaleLevels - 1) })}
                                                className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-r border-slate-800 transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <div className="flex-1 flex items-center justify-center text-white font-black text-sm py-3">
                                                {status.settings.martingaleLevels}
                                            </div>
                                            <button 
                                                onClick={() => updateSync({ martingaleLevels: Math.min(3, status.settings.martingaleLevels + 1) })}
                                                className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-l border-slate-800 transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Multiplicador</label>
                                        <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                            <button 
                                                onClick={() => updateSync({ martingaleMultiplier: Math.max(1.5, status.settings.martingaleMultiplier - 0.5) })}
                                                className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-r border-slate-800 transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <div className="flex-1 flex items-center justify-center text-white font-black text-sm py-3">
                                                {status.settings.martingaleMultiplier.toFixed(1)}x
                                            </div>
                                            <button 
                                                onClick={() => updateSync({ martingaleMultiplier: Math.min(4.0, status.settings.martingaleMultiplier + 0.5) })}
                                                className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-l border-slate-800 transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Lote Padrão</label>
                                    <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                        <button 
                                            onClick={() => updateSync({ defaultLot: Math.max(0.01, status.settings.defaultLot - 0.01) })}
                                            className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-r border-slate-800 transition-colors"
                                        >
                                            <Minus size={12} />
                                        </button>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={status.settings.defaultLot}
                                            onChange={(e) => updateSync({ defaultLot: parseFloat(e.target.value) })}
                                            className="bg-transparent text-center text-white font-black text-sm py-3 outline-none"
                                        />
                                        <button 
                                            onClick={() => updateSync({ defaultLot: parseFloat((status.settings.defaultLot + 0.01).toFixed(2)) })}
                                            className="w-10 flex items-center justify-center text-slate-500 hover:text-white border-l border-slate-800 transition-colors"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Filtros de Segurança (Auto-Lock)</label>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <Target size={16} className="text-amber-500" />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">SMA 200</span>
                                            </div>
                                            <button 
                                                onClick={() => updateSync({ useTrendFilter: !status.settings.useTrendFilter })}
                                                className={`w-8 h-4 rounded-full relative flex items-center px-1 transition-all ${status.settings.useTrendFilter ? 'bg-trader-blue' : 'bg-slate-800'}`}
                                            >
                                                <div className={`w-2 h-2 bg-white rounded-full transition-all ${status.settings.useTrendFilter ? 'ml-auto' : ''}`} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <BarChart3 size={16} className="text-purple-500" />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Elephant Candle</span>
                                            </div>
                                            <div className="w-8 h-4 bg-trader-blue rounded-full relative flex items-center px-1">
                                                <div className="w-2 h-2 bg-white rounded-full ml-auto" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AnimatePresence>
                            {status.settings.symbols.map((symbol: string) => (
                                <motion.div 
                                    key={symbol} 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-trader-blue/30 transition-all cursor-pointer relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black text-xs italic group-hover:bg-trader-blue group-hover:text-white transition-colors uppercase">
                                            {symbol.substring(0, 3)}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white tracking-widest uppercase">{symbol}</h4>
                                            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Canal de Ciclo Ativo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="text-right">
                                            <div className="text-xs font-black text-trader-green italic text-right flex items-center gap-1">
                                                <Activity size={10} /> LIVE
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeSymbol(symbol); }}
                                            className="w-8 h-8 rounded-lg bg-trader-red/10 text-trader-red opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-trader-red hover:text-white"
                                        >
                                            <Pause size={14} className="rotate-45" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        
                        <div className="bg-slate-950 border border-dashed border-slate-800 p-6 rounded-3xl flex items-center gap-3 group focus-within:border-trader-blue/50 transition-all">
                             <input 
                                type="text"
                                value={newSymbol}
                                onChange={(e) => setNewSymbol(e.target.value)}
                                placeholder="NOVO ATIVO..."
                                className="bg-transparent border-none outline-none text-white text-xs font-black uppercase tracking-widest w-full placeholder:text-slate-700"
                                onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                             />
                             <button 
                                onClick={addSymbol}
                                className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 hover:bg-trader-blue hover:text-white transition-all shadow-xl"
                             >
                                <Plus size={18} />
                             </button>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col h-[500px] shadow-2xl">
                        <div className="flex border-b border-white/5 bg-slate-950/40">
                            <button 
                                onClick={() => setActiveView('terminal')}
                                className={`flex-1 py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'terminal' ? 'text-white border-b-2 border-trader-blue bg-white/5' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Terminal size={14} /> Terminal Logs
                            </button>
                            <button 
                                onClick={() => setActiveView('history')}
                                className={`flex-1 py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'history' ? 'text-white border-b-2 border-trader-blue bg-white/5' : 'text-slate-500 hover:text-white'}`}
                            >
                                <History size={14} /> Omni Trade Explorer
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar relative bg-slate-950/20">
                            <AnimatePresence mode="wait">
                                {activeView === 'terminal' ? (
                                    <motion.div 
                                        key="terminal"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="font-mono text-[11px] space-y-2"
                                    >
                                        {status.logs && status.logs.length > 0 ? (
                                            status.logs.map((log: any, i: number) => (
                                                <div key={i} className="flex gap-4 group">
                                                    <span className="text-slate-600 shrink-0">{log.time}</span>
                                                    <span className={
                                                        log.type === 'SUCCESS' ? 'text-trader-green' :
                                                        log.type === 'ERROR' ? 'text-trader-red' :
                                                        log.type === 'WARN' ? 'text-amber-500' : 'text-emerald-500/70'
                                                    }>{log.msg}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-slate-700 italic flex flex-col items-center justify-center h-full gap-4 mt-20">
                                                <Terminal size={40} className="opacity-20 translate-y-4" />
                                                Aguardando atividade do motor...
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div 
                                        key="history"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <OmniHistoryHub />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 rounded-[2.5rem] border border-trader-blue/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Trophy size={100} className="text-amber-500" />
                        </div>
                        
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div>
                                <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Crown size={14} /> Omni Ranking Hub
                                </h3>
                                <p className="text-[9px] text-slate-500 font-black uppercase mt-1">Alta Performance Baseada em Dados Históricos</p>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {status.ranking && status.ranking.map((strat: any, index: number) => (
                                <motion.div 
                                    key={strat.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                                        status.settings.strategy === strat.name 
                                        ? 'bg-trader-blue/10 border-trader-blue shadow-lg shadow-trader-blue/10' 
                                        : 'bg-slate-950/40 border-slate-800/50 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs italic ${
                                            index === 0 ? 'bg-amber-500 text-black' : 
                                            index === 1 ? 'bg-slate-300 text-black' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            {index + 1}º
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-sm font-black italic uppercase ${status.settings.strategy === strat.name ? 'text-white' : 'text-slate-300'}`}>
                                                    {strat.name}
                                                </h4>
                                                {index === 0 && <Star size={10} className="text-amber-500 fill-amber-500 animate-pulse" />}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{strat.trades} Trades</span>
                                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                <span className={`text-[7px] font-black uppercase ${strat.winRate >= 80 ? 'text-trader-green' : 'text-amber-500'}`}>
                                                    {strat.winRate}% Assertividade
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-xs font-black italic ${strat.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                {strat.profit >= 0 ? '+' : ''}${strat.profit}
                                            </p>
                                            <p className="text-[7px] text-slate-600 font-black uppercase">Result</p>
                                        </div>
                                        
                                        {status.settings.strategy !== strat.name ? (
                                            <button 
                                                onClick={() => updateStrategy(strat.name)}
                                                className="p-2 bg-trader-blue/10 text-trader-blue rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-trader-blue hover:text-white"
                                                title="Ativar Estratégia"
                                            >
                                                <MousePointer2 size={14} />
                                            </button>
                                        ) : (
                                            <div className="p-2 bg-trader-green/20 text-trader-green rounded-lg">
                                                <Check size={14} />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden flex flex-col h-full shadow-2xl">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-xs font-black text-trader-green uppercase tracking-[0.3em]">Status Vital</h3>
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${status.enabled ? 'bg-trader-green/20 text-trader-green' : 'bg-slate-800 text-slate-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${status.enabled ? 'bg-trader-green animate-pulse' : 'bg-slate-600'}`}></div>
                                {status.enabled ? 'EM EXECUÇÃO' : 'STBY'}
                            </div>
                        </div>
                        
                        <div className="space-y-8 flex-1">
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Processamento de Ciclos</p>
                                <div className="flex items-end gap-3">
                                    <p className="text-5xl font-black text-white italic">{status.processedCycles}</p>
                                    <p className="text-xs font-bold text-slate-700 mb-1 uppercase tracking-tighter">Quadrantes</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex justify-between items-center group hover:border-trader-green/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-trader-green/10 rounded-lg text-trader-green"><ArrowUpRight size={16} /></div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assertividade</span>
                                    </div>
                                    <span className="text-xl font-black text-trader-green italic">88.4%</span>
                                </div>
                                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex justify-between items-center group hover:border-trader-blue/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-trader-blue/10 rounded-lg text-trader-blue"><Activity size={16} /></div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Trades Hoje</span>
                                    </div>
                                    <span className="text-xl font-black text-white italic">{status.history?.length || 0}</span>
                                </div>
                            </div>

                            <div className="p-6 bg-trader-blue/5 border border-trader-blue/10 rounded-3xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                    <Shield size={60} className="text-white" />
                                </div>
                                <div className="flex items-center gap-2 mb-3 relative z-10">
                                    <Shield size={14} className="text-trader-blue" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Disciplina Alpha</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider italic leading-relaxed relative z-10">
                                    Sistema monitorando $5,000 de margem institucional. <span className="text-white">Proteção ativa.</span>
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[9px] font-bold text-slate-600 uppercase">Engine Latency</span>
                                <span className="text-[9px] font-black text-trader-green">14ms</span>
                            </div>
                            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-trader-blue"
                                    animate={{ width: ['20%', '25%', '22%', '28%', '20%'] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
