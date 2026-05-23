import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Shield, Flame, Crosshair, Cpu, CheckCircle2, TrendingUp, Terminal, Activity, Layers, Target, BarChart3, AlertOctagon, RefreshCw, Gauge } from 'lucide-react';
import axios from 'axios';

function SupremeLogo() {
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="drop-shadow-xl">
            <defs>
                <linearGradient id="supg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <filter id="supglow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
                </filter>
            </defs>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#supg)" strokeWidth="2" filter="url(#supglow)" />
            <text x="22" y="30" textAnchor="middle" fill="url(#supg)" fontSize="18" fontWeight="900" fontStyle="italic" filter="url(#supglow)">S</text>
            <circle cx="22" cy="22" r="18" fill="none" stroke="url(#supg)" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
        </svg>
    );
}

export const AlphaSupremeHub: React.FC = () => {
    const [nakamoto, setNakamoto] = useState(false);
    const [intel7, setIntel7] = useState(false);
    const [confluenceMode, setConfluenceMode] = useState(true);
    const [status, setStatus] = useState<string>('IDLE');
    const [power, setPower] = useState(0);
    const [leverage, setLeverage] = useState(50);
    const [maxLoss, setMaxLoss] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(500);
    const [logs, setLogs] = useState<{ time: string; message: string; type: string }[]>([]);
    const [sentiment, setSentiment] = useState<{ btc: number; dxy: number; status: string }>({ btc: 0, dxy: 0, status: '...' });
    const [performance, setPerformance] = useState<{
        winRate: number;
        totalTrades: number;
        totalProfit: number;
        history: { day: string, pnl: number }[];
        trades: any[];
    } | null>(null);

    const fetchStatus = () => {
        axios.get('/api/mt5/supreme/status').then(res => {
            const data = res.data;
            setNakamoto(data.settings.nakamotoActive);
            setIntel7(data.settings.intelligence7Active);
            setConfluenceMode(data.settings.confluenceMode);
            setStatus(data.status);
            setPower(data.confluencePower);
            if (data.settings.capitalAllocation) setLeverage(data.settings.capitalAllocation);
            if (data.settings.maxLoss) setMaxLoss(data.settings.maxLoss);
            if (data.settings.dailyTarget) setDailyTarget(data.settings.dailyTarget);
            if (data.logs) setLogs(data.logs);
            if (data.macroSentiment) setSentiment(data.macroSentiment);
            if (data.performance) setPerformance(data.performance);
            if (data.lastSyncTime) setLastSync(data.lastSyncTime);
        }).catch(err => console.error("Error fetching Supreme Status", err));
    };

    const [lastSync, setLastSync] = useState<number>(0);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const toggleSettings = (key: string, value: any) => {
        const payload = {
            nakamotoActive: key === 'nakamoto' ? value : nakamoto,
            intelligence7Active: key === 'intel7' ? value : intel7,
            confluenceMode: key === 'confluence' ? value : confluenceMode,
            capitalAllocation: key === 'leverage' ? value : leverage,
            maxLoss: key === 'maxLoss' ? value : maxLoss,
            dailyTarget: key === 'dailyTarget' ? value : dailyTarget,
        };

        axios.post('/api/mt5/supreme/toggle', payload).then(res => {
            fetchStatus();
        });
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <SupremeLogo />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Alpha</span> Supreme
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-amber-500/10 border border-amber-500/20 text-amber-500">V2 Híbrido</span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-amber-500" /> Fusão de Fluxo Institucional com Momentum Volátil
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status do Motor</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                            status === 'EXECUTING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                            status === 'ANALYZING' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            'bg-slate-500/10 border-slate-500/20 text-slate-500'
                        }`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                                status === 'EXECUTING' ? 'bg-amber-500' :
                                status === 'ANALYZING' ? 'bg-emerald-500' : 'bg-slate-500'
                            }`} />
                            <span className="text-[10px] font-black uppercase">
                                {status === 'EXECUTING' ? 'Executando Ordem' : status === 'WAITING_CONFLUENCE' ? 'Buscando Confluência' : status === 'ANALYZING' ? 'Analisando Mercado' : 'Ocioso'}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Assertividade</span>
                        <span className={`text-xl font-black italic ${power > 95 ? 'text-amber-500' : power > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{power}%</span>
                    </div>
                </div>
            </div>

            {/* ENGINES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${
                    nakamoto ? 'border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 'border-amber-500/10'
                }`}>
                    <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent ${nakamoto ? 'via-amber-500/70' : 'via-amber-500/40'} to-transparent`} />
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Cpu size={120} className={nakamoto ? 'text-amber-500' : 'text-slate-600'} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-3 h-3 rounded-full ${nakamoto ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-slate-700'}`} />
                                <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${nakamoto ? 'text-white' : 'text-slate-500'}`}>Alpha Nakamoto</h3>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Motor Especialista em Cripto (Bitcoin Momentum)</span>
                        </div>
                        <button onClick={() => toggleSettings('nakamoto', !nakamoto)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${nakamoto ? 'bg-amber-500' : 'bg-slate-800'}`}>
                            <motion.div className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: nakamoto ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                        </button>
                    </div>
                    <div className="space-y-4 relative z-10">
                        {['Leitura On-Chain em tempo real (23 Pares)', 'Detector de manipulação institucional (Baleias)', 'Benchmark Histórico: 94.8%'].map((text, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                <CheckCircle2 size={16} className={nakamoto ? 'text-amber-500' : 'text-slate-700'} />
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${
                    intel7 ? 'border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-blue-500/10'
                }`}>
                    <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent ${intel7 ? 'via-blue-500/70' : 'via-blue-500/40'} to-transparent`} />
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TrendingUp size={120} className={intel7 ? 'text-blue-500' : 'text-slate-600'} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-3 h-3 rounded-full ${intel7 ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-slate-700'}`} />
                                <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${intel7 ? 'text-white' : 'text-slate-500'}`}>Intelligence 7</h3>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Motor Especialista em Forex (Smart Money)</span>
                        </div>
                        <button onClick={() => toggleSettings('intel7', !intel7)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${intel7 ? 'bg-blue-500' : 'bg-slate-800'}`}>
                            <motion.div className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: intel7 ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                        </button>
                    </div>
                    <div className="space-y-4 relative z-10">
                        {['Análise de Volume e Exaustão H1/H4', 'Scanner Macro (EUR/USD, GBP/USD, XAU/USD)', 'Benchmark Histórico: 94.2%'].map((text, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                <CheckCircle2 size={16} className={intel7 ? 'text-blue-500' : 'text-slate-700'} />
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONFLUÊNCIA MESTRA */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
                    <div className="flex gap-6 items-center">
                        <div className={`w-16 h-16 rounded-2xl flex justify-center items-center shrink-0 border transition-all ${
                            confluenceMode && nakamoto && intel7
                                ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 border-transparent shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                                : 'bg-slate-800 border-slate-700 grayscale'
                        }`}>
                            <Flame size={32} className="text-white" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                Confluência Mestra <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded not-italic tracking-widest font-bold">HÍBRIDO</span>
                            </h4>
                            <p className="text-xs text-slate-400 font-medium max-w-xl mt-1">
                                Ao ativar, o Super Robô ignorará sinais comuns. Ele aguardará o exato momento onde o apetite a risco do Crypto <b>(Nakamoto)</b> se alinhar perfeitamente com a liquidez institucional do Forex <b>(Intelligence 7)</b>.
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer shrink-0">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${confluenceMode && nakamoto && intel7 ? 'text-amber-500' : 'text-slate-500'}`}>Ligar Fusão de IAs</span>
                        <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${
                            confluenceMode && nakamoto && intel7
                                ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                                : 'bg-slate-800'
                        }`}>
                            <input type="checkbox" className="sr-only" checked={confluenceMode} onChange={(e) => toggleSettings('confluence', e.target.checked)} disabled={!nakamoto || !intel7} />
                            <motion.div className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: confluenceMode && nakamoto && intel7 ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                        </div>
                    </label>
                </div>
                {(!nakamoto || !intel7) && (
                    <div className="mt-6 flex items-center gap-2 text-xs text-amber-500/70 border border-amber-500/20 bg-amber-500/5 p-3 rounded-xl">
                        <Zap size={14} /> Ative ambos os motores (Nakamoto e Intelligence 7) para liberar o botão de Confluência Mestra.
                    </div>
                )}
            </div>

            {/* WIDGETS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                    <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1">
                        <Layers className="text-amber-500" size={18} /> Alavancagem Supreme
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-6">Poder de fogo para entradas híbridas.</p>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multiplicador</span>
                        <span className="text-3xl font-black text-amber-500 italic uppercase">Lote x{leverage}</span>
                    </div>
                    <input type="range" min="1" max="50" value={leverage}
                        onChange={(e) => { setLeverage(parseInt(e.target.value)); toggleSettings('leverage', parseInt(e.target.value) as any); }}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                    <div className="flex justify-between text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">
                        <span>Seguro (1x)</span>
                        <span>Agressivo (50x)</span>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                    <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1">
                        <Activity className="text-emerald-500" size={18} /> Radar Macro DXY vs BTC
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-6">Sentimento Institucional em Tempo Real</p>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Bitcoin (Apetite a Risco)</span>
                                <span className="text-amber-500">{sentiment.btc}% Força</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div animate={{ width: `${sentiment.btc}%` }} className="h-full bg-amber-500" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Dólar DXY (Aversão a Risco)</span>
                                <span className="text-blue-400">{sentiment.dxy}% Força</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div animate={{ width: `${sentiment.dxy}%` }} className="h-full bg-blue-500" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Confluência Atual:</span>
                        <span className={`text-xs font-black uppercase tracking-widest ${sentiment.status.includes('Bullish') ? 'text-amber-500' : 'text-rose-400'}`}>{sentiment.status}</span>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                    <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-3">
                        <Terminal className="text-emerald-500" size={18} /> Supreme Terminal
                    </h4>
                    <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 relative border border-white/5 min-h-[200px]">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                        {logs.length === 0 ? (
                            <p className="text-emerald-700 italic">Aguardando boot do motor central...</p>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 text-[10px] font-mono leading-tight relative z-10">
                                    <span className="text-emerald-700 shrink-0">[{log.time}]</span>
                                    <span className={
                                        log.type === 'warn' ? 'text-amber-400' :
                                            log.type === 'success' ? 'text-emerald-400 font-bold' :
                                                log.type === 'execute' ? 'text-rose-400 font-bold' :
                                                    'text-emerald-600'
                                    }>
                                        {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* RISK & PERFORMANCE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-rose-500/10 p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                    <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1">
                        <Shield className="text-rose-500" size={18} /> Blindagem Supreme
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-6">Limites financeiros isolados apenas para o Super Robô.</p>
                    <div className="space-y-4">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                                    <AlertOctagon size={20} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase">Stop Loss Diário Máximo</span>
                                    <span className="text-lg font-black text-white italic">Risco Controlado</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold">$</span>
                                <input type="number" value={maxLoss}
                                    onChange={(e) => { const val = Number(e.target.value); setMaxLoss(val); toggleSettings('maxLoss', val); }}
                                    className="w-24 bg-transparent border-b-2 border-slate-700 focus:border-rose-500 outline-none text-xl font-black text-white text-right pb-1 transition-colors" />
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase">Meta Diária (Take Profit)</span>
                                    <span className="text-lg font-black text-white italic">Alvo de Lucro</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold">$</span>
                                <input type="number" value={dailyTarget}
                                    onChange={(e) => { const val = Number(e.target.value); setDailyTarget(val); toggleSettings('dailyTarget', val); }}
                                    className="w-24 bg-transparent border-b-2 border-slate-700 focus:border-emerald-500 outline-none text-xl font-black text-white text-right pb-1 transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-emerald-500/10 p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1">
                                <BarChart3 className="text-emerald-500" size={18} /> Performance Híbrida
                            </h4>
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Histórico PnL da Confluência Mestra</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <button onClick={() => { axios.post('/api/mt5/supreme/sync').then(() => fetchStatus()); }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all text-slate-400 hover:text-white group">
                                <RefreshCw size={16} className="group-active:rotate-180 transition-transform duration-500" />
                            </button>
                            {lastSync > 0 && (
                                <span className="text-[8px] text-slate-600 font-bold mt-1 uppercase">Sinc: {new Date(lastSync).toLocaleTimeString()}</span>
                            )}
                        </div>
                    </div>

                    {performance ? (
                        <div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                {[
                                    { label: '% Acerto', value: `${performance.winRate.toFixed(1)}%`, color: 'text-emerald-400' },
                                    { label: 'Trades', value: `${performance.totalTrades}`, color: 'text-white' },
                                    { label: 'Lucro Total', value: `$${performance.totalProfit.toFixed(2)}`, color: performance.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                                ].map((item, i) => (
                                    <div key={i} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-center">
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">{item.label}</span>
                                        <span className={`text-xl font-black italic ${item.color}`}>{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="h-24 flex items-end justify-between gap-1 px-1 mb-8">
                                {performance.history.map((item, idx) => {
                                    const maxPnl = Math.max(...performance.history.map(h => Math.abs(h.pnl)), 10);
                                    const heightPercent = (Math.abs(item.pnl) / maxPnl) * 100;
                                    return (
                                        <div key={idx} className="flex flex-col items-center flex-1">
                                            <div className="relative w-full flex justify-center items-end h-16 mb-1">
                                                <div className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${item.pnl >= 0 ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                                                    style={{ height: `${Math.max(4, heightPercent)}%` }} />
                                            </div>
                                            <span className="text-[8px] text-slate-600 font-black uppercase">{item.day}</span>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {performance.trades && performance.trades.length > 0 ? (
                                    performance.trades.map((trade: any) => (
                                        <div key={trade.ticket} className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-white/5 text-[10px]">
                                            <div className="flex gap-3 items-center">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${trade.profit > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {trade.profit > 0 ? 'W' : 'L'}
                                                </div>
                                                <div>
                                                    <span className="block font-black text-white">{trade.symbol}</span>
                                                    <span className="text-slate-500">{new Date(trade.closeTime).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`block font-black ${trade.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                                </span>
                                                <span className="text-slate-600 uppercase font-bold">Lote {trade.lot}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-2xl">
                                        <Activity className="mx-auto text-slate-700 mb-2" size={24} />
                                        <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Aguardando primeiro sinal híbrido</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm font-bold animate-pulse">
                            Carregando histórico...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
