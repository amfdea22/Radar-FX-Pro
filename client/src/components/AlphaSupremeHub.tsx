import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Shield, Flame, Crosshair, Cpu, CheckCircle2, TrendingUp, Terminal, Activity, Layers, Target, BarChart3, AlertOctagon, RefreshCw } from 'lucide-react';
import axios from 'axios';

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
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Cabeçalho Premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-r from-amber-500/10 to-transparent p-6 rounded-3xl border border-amber-500/20">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Crown className="text-amber-500" size={32} />
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Alpha Supreme</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500 text-black">V2 Híbrido</span>
                    </div>
                    <p className="text-slate-400 font-medium">O motor de guerra da sua conta. Fusão de Fluxo Institucional (Forex) com Momentum Volátil (Cripto).</p>
                </div>
                <div className="flex px-4 py-2 bg-slate-900 rounded-xl border border-slate-700 items-center justify-between gap-6">
                    <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-black">Status do Motor</span>
                        <span className={`text-sm font-black uppercase ${status === 'EXECUTING' ? 'text-amber-500 animate-pulse' : status === 'WAITING_CONFLUENCE' ? 'text-trader-blue' : status === 'ANALYZING' ? 'text-trader-green' : 'text-slate-600'}`}>
                            {status === 'EXECUTING' ? 'EXECUTANDO ORDEM' : status === 'WAITING_CONFLUENCE' ? 'Buscando Confluência' : status === 'ANALYZING' ? 'Analisando Mercado' : 'Ocioso'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-black">Assertividade Preditiva</span>
                        <span className={`text-xl font-black italic ${power > 95 ? 'text-amber-500' : power > 0 ? 'text-trader-green' : 'text-slate-600'}`}>{power}%</span>
                    </div>
                </div>
            </div>

            {/* Painéis Híbridos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Motor 1: Nakamoto */}
                <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden ${nakamoto ? 'bg-slate-900/80 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'bg-slate-900/30 border-slate-800'}`}>
                    <div className={`absolute top-0 right-0 p-8 opacity-10 transition-transform duration-700 ${nakamoto ? 'scale-125' : 'scale-100'}`}>
                        <Cpu size={120} className={nakamoto ? 'text-amber-500' : 'text-slate-600'} />
                    </div>

                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-3 h-3 rounded-full ${nakamoto ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-slate-700'}`}></span>
                                <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${nakamoto ? 'text-white' : 'text-slate-500'}`}>Alpha Nakamoto</h3>
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Motor Especialista em Cripto (Bitcoin Momentum)</span>
                        </div>
                        <button
                            onClick={() => toggleSettings('nakamoto', !nakamoto)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${nakamoto ? 'bg-amber-500' : 'bg-slate-800'}`}
                        >
                            <motion.div
                                className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: nakamoto ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={nakamoto ? 'text-amber-500' : 'text-slate-700'} />
                            <span>Leitura On-Chain em tempo real (23 Pares)</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={nakamoto ? 'text-amber-500' : 'text-slate-700'} />
                            <span>Detector de manipulação institucional (Baleias)</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={nakamoto ? 'text-amber-500' : 'text-slate-700'} />
                            <span>Benchmark Histórico: <b>94.8%</b></span>
                        </div>
                    </div>
                </div>

                {/* Motor 2: Intelligence 7 */}
                <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden ${intel7 ? 'bg-slate-900/80 border-trader-blue/50 shadow-[0_0_40px_rgba(0,163,255,0.1)]' : 'bg-slate-900/30 border-slate-800'}`}>
                    <div className={`absolute top-0 right-0 p-8 opacity-10 transition-transform duration-700 ${intel7 ? 'scale-125' : 'scale-100'}`}>
                        <TrendingUp size={120} className={intel7 ? 'text-trader-blue' : 'text-slate-600'} />
                    </div>

                    <div className="relative z-10 flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-3 h-3 rounded-full ${intel7 ? 'bg-trader-blue shadow-[0_0_10px_rgba(0,163,255,0.8)]' : 'bg-slate-700'}`}></span>
                                <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${intel7 ? 'text-white' : 'text-slate-500'}`}>Intelligence 7</h3>
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Motor Especialista em Forex (Smart Money)</span>
                        </div>
                        <button
                            onClick={() => toggleSettings('intel7', !intel7)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${intel7 ? 'bg-trader-blue' : 'bg-slate-800'}`}
                        >
                            <motion.div
                                className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: intel7 ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={intel7 ? 'text-trader-blue' : 'text-slate-700'} />
                            <span>Análise de Volume e Exaustão H1/H4</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={intel7 ? 'text-trader-blue' : 'text-slate-700'} />
                            <span>Scanner Macro (EUR/USD, GBP/USD, XAU/USD)</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={16} className={intel7 ? 'text-trader-blue' : 'text-slate-700'} />
                            <span>Benchmark Histórico: <b>94.2%</b></span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Fusão Neural / Confluência Mestra */}
            <div className="bg-slate-900/60 p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-r from-transparent via-amber-500/5 to-trader-blue/5 transition-opacity duration-1000 ${confluenceMode && nakamoto && intel7 ? 'opacity-100' : 'opacity-0'}`}></div>

                <div className="flex justify-between items-center relative z-10">
                    <div className="flex gap-6 items-center">
                        <div className={`w-16 h-16 rounded-2xl flex justify-center items-center shrink-0 border transition-all ${confluenceMode && nakamoto && intel7 ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-trader-red border-transparent shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'bg-slate-800 border-slate-700 grayscale'}`}>
                            <Flame size={32} className="text-white" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                Confluência Mestra <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded not-italic tracking-widest font-bold">HÍBRIDO</span>
                            </h4>
                            <p className="text-xs text-slate-400 font-medium max-w-xl mt-1">Ao ativar, o Super Robô ignorará sinais comuns. Ele aguardará o exato momento onde o apetite a risco do Crypto <b>(Nakamoto)</b> se alinhar perfeitamente com a liquidez institucional do Forex <b>(Intelligence 7)</b>.</p>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${confluenceMode && nakamoto && intel7 ? 'text-amber-500' : 'text-slate-500'}`}>Ligar Fusão de IAs</span>
                        <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${confluenceMode && nakamoto && intel7 ? 'bg-gradient-to-r from-amber-500 to-trader-red shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800'}`}>
                            <input type="checkbox" className="sr-only" checked={confluenceMode} onChange={(e) => toggleSettings('confluence', e.target.checked)} disabled={!nakamoto || !intel7} />
                            <motion.div
                                className="w-6 h-6 bg-white rounded-full shadow-md"
                                animate={{ x: confluenceMode && nakamoto && intel7 ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </div>
                    </label>
                </div>

                {!nakamoto || !intel7 ? (
                    <div className="mt-6 flex items-center gap-2 text-xs text-amber-500/70 border border-amber-500/20 bg-amber-500/5 p-3 rounded-lg">
                        <Zap size={14} /> Ative ambos os motores (Nakamoto e Intelligence 7) para liberar o botão de Confluência Mestra.
                    </div>
                ) : null}
            </div>

            {/* Widgets Supreme (Alavancagem, Radar Sentimento e Terminal) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Modificador de Alavancagem */}
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 relative z-10 flex flex-col justify-between">
                    <div>
                        <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1"><Layers className="text-amber-500" size={18} /> Alavancagem Supreme</h4>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-6">Poder de fogo para entradas híbridas.</p>

                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multiplicador</span>
                            <span className="text-3xl font-black text-amber-500 italic uppercase">Lote x{leverage}</span>
                        </div>

                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={leverage}
                            onChange={(e) => {
                                setLeverage(parseInt(e.target.value));
                                toggleSettings('leverage', parseInt(e.target.value) as any);
                            }}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">
                            <span>Seguro (1x)</span>
                            <span>Agressivo (50x)</span>
                        </div>
                    </div>
                </div>

                {/* Radar Sentimento Macro */}
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                        <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1"><Activity className="text-trader-blue" size={18} /> Radar Macro DXY vs BTC</h4>
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
                                    <span className="text-trader-blue">{sentiment.dxy}% Força</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div animate={{ width: `${sentiment.dxy}%` }} className="h-full bg-trader-blue" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Confluência Atual:</span>
                        <span className={`text-xs font-black uppercase tracking-widest ${sentiment.status.includes('Bullish') ? 'text-amber-500' : 'text-trader-red'}`}>{sentiment.status}</span>
                    </div>
                </div>

                {/* Supreme Logs (Terminal) */}
                <div className="bg-black p-4 rounded-3xl border border-slate-800 overflow-hidden relative flex flex-col h-64 shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                    <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                    <h4 className="text-trader-green/50 font-black italic uppercase tracking-tighter flex items-center gap-2 mb-3 border-b border-trader-green/10 pb-2 relative z-10 text-xs"><Terminal size={14} /> Supreme Terminal</h4>

                    <div className="flex-1 overflow-y-auto space-y-2 relative z-10 pr-2 scrollbar-thin scrollbar-thumb-trader-green/20">
                        {logs.length === 0 ? (
                            <p className="text-trader-green/40 text-[10px] font-mono">Aguardando boot do motor central...</p>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 text-[10px] font-mono leading-tight">
                                    <span className="text-trader-green/50 shrink-0">[{log.time}]</span>
                                    <span className={
                                        log.type === 'warn' ? 'text-amber-400' :
                                            log.type === 'success' ? 'text-trader-green font-bold' :
                                                log.type === 'execute' ? 'text-trader-red font-bold' :
                                                    'text-trader-green/80'
                                    }>
                                        {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Painel de Gestão de Risco e Desempenho */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Parâmetros de Risco Supreme */}
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
                    <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1"><Shield className="text-trader-red" size={18} /> Blindagem Supreme</h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-6">Limites financeiros isolados apenas para o Super Robô.</p>

                    <div className="space-y-4">
                        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group focus-within:border-trader-red/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-trader-red/10 rounded-lg text-trader-red">
                                    <AlertOctagon size={20} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase">Stop Loss Diário Máximo</span>
                                    <span className="text-lg font-black text-white italic">Risco Controlado</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold">$</span>
                                <input
                                    type="number"
                                    value={maxLoss}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setMaxLoss(val);
                                        toggleSettings('maxLoss', val);
                                    }}
                                    className="w-24 bg-transparent border-b-2 border-slate-700 focus:border-trader-red outline-none text-xl font-black text-white text-right pb-1 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group focus-within:border-trader-green/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-trader-green/10 rounded-lg text-trader-green">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase">Meta Diária (Take Profit)</span>
                                    <span className="text-lg font-black text-white italic">Alvo de Lucro</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold">$</span>
                                <input
                                    type="number"
                                    value={dailyTarget}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setDailyTarget(val);
                                        toggleSettings('dailyTarget', val);
                                    }}
                                    className="w-24 bg-transparent border-b-2 border-slate-700 focus:border-trader-green outline-none text-xl font-black text-white text-right pb-1 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Relatório de Performance Real */}
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2 mb-1">
                                <BarChart3 className="text-trader-green" size={18} /> Performance Híbrida
                            </h4>
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Histórico PnL da Confluência Mestra</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <button
                                onClick={() => {
                                    axios.post('/api/mt5/supreme/sync').then(() => fetchStatus());
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all text-slate-400 hover:text-white group"
                                title="Sincronizar Trades"
                            >
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
                                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">% Acerto</span>
                                    <span className="text-2xl font-black text-trader-green italic">{performance.winRate.toFixed(1)}%</span>
                                </div>
                                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">Trades</span>
                                    <span className="text-2xl font-black text-white italic">{performance.totalTrades}</span>
                                </div>
                                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
                                    <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">Lucro Total</span>
                                    <span className={`text-2xl font-black italic ${performance.totalProfit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                        ${performance.totalProfit.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Gráfico de Barras */}
                            <div className="h-24 flex items-end justify-between gap-1 px-1 mb-8">
                                {performance.history.map((item, idx) => {
                                    const maxPnl = Math.max(...performance.history.map(h => Math.abs(h.pnl)), 10);
                                    const heightPercent = (Math.abs(item.pnl) / maxPnl) * 100;
                                    const isPositive = item.pnl >= 0;
                                    return (
                                        <div key={idx} className="flex flex-col items-center flex-1 group">
                                            <div className="relative w-full flex justify-center items-end h-16 mb-1">
                                                <div
                                                    className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${isPositive ? 'bg-trader-green/60' : 'bg-trader-red/60'}`}
                                                    style={{ height: `${Math.max(4, heightPercent)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[8px] text-slate-600 font-black uppercase">{item.day}</span>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Tabela de Trades Recentes */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                                {performance.trades && performance.trades.length > 0 ? (
                                    performance.trades.map((trade: any) => (
                                        <div key={trade.ticket} className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-white/5 text-[10px]">
                                            <div className="flex gap-3 items-center">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${trade.profit > 0 ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                                    {trade.profit > 0 ? 'W' : 'L'}
                                                </div>
                                                <div>
                                                    <span className="block font-black text-white">{trade.symbol}</span>
                                                    <span className="text-slate-500">{new Date(trade.closeTime).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`block font-black ${trade.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                                </span>
                                                <span className="text-slate-600 uppercase font-bold">Lote {trade.lot}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-3xl">
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
