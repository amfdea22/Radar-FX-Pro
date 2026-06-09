import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, Activity, Zap, TrendingUp, Target, Globe, CircleDot, Shield, Crosshair, Cpu, Users, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { SoundService } from '../services/SoundService';
import { CryptoReport } from './CryptoReport';


interface CryptoSignal {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    setup: string;
    confidence: number;
    price: number;
    time: string;
}

const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Agora';
    return `${Math.floor(diff / 60000)}m atrás`;
};

interface TradeRecord {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    openPrice: number;
    closePrice: number;
    profit: number;
    duration: string;
    time: string;
}

interface SocialTrader {
    id: string;
    username: string;
    level: string;
    winRate: number;
    profitTokens: number;
    followers: number;
    drawdown: number;
    sharpeRatio: number;
}

interface SocialStatus {
    isAutoPilotActive: boolean;
    activeTraders: string[];
    processedCount: number;
}

interface CryptoMaster {
    id: string;
    name: string;
    winRate: number;
    profitToday: number;
    activePos: string;
    strategy: string;
    totalProfit: number;
    totalTrades: number;
    bestWin: number;
    worstLoss: number;
    sharpeRatio: number;
    avgTradeTime: string;
    recentTrades: TradeRecord[];
    expandedHistory?: boolean;
    isCopying?: boolean;
    isLoading?: boolean;
}

export const CryptoIntelligenceHub: React.FC = () => {
    const [signals, setSignals] = useState<any[]>([]);
    const [masters, setMasters] = useState<any[]>([]);
    const [cryptoIAStatus, setCryptoIAStatus] = useState<any>(null);
    const [networkStatus, setNetworkStatus] = useState('scanning');
    const lastSignalCountRef = useRef(0);
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [orderResult, setOrderResult] = useState<{ id: string, success: boolean, message: string } | null>(null);
    const [manualSettings, setManualSettings] = useState<Record<string, { lot: number, tp: number, sl: number }>>({});

    // Social Trading states
    const [community, setCommunity] = useState<SocialTrader[]>([]);
    const [socialStatus, setSocialStatus] = useState<SocialStatus>({ isAutoPilotActive: false, activeTraders: [], processedCount: 0 });
    const [socialLoading, setSocialLoading] = useState<string | null>(null);

    useEffect(() => {
        const fetchSignals = async () => {
            try {
                const res = await axios.get('/api/mt5/signals');
                const cryptoKeys = [
                    'BTC', 'ETH', 'BNB', 'DOG', 'SOL', 'XRP', 'ADA', 'AVAX',
                    'MATIC', 'DOT', 'LINK', 'TRX', 'LTC', 'SHIB', 'BCH', 'ETC',
                    'XLM', 'XMR', 'ZEC', 'EOS', 'LNK', 'SHB', 'MTC'
                ];

                const filtered = res.data
                    .filter((s: any) => cryptoKeys.some(ck => s.symbol.toUpperCase().includes(ck)))
                    .map((s: any) => ({
                        id: s.id,
                        symbol: s.symbol,
                        type: s.type,
                        setup: s.setup,
                        confidence: s.confidence,
                        price: s.price_entry,
                        time: formatTimeAgo(s.timestamp)
                    }));
                // Alerta sonoro para novos sinais cripto (usando ref para evitar stale closure)
                if (filtered.length > lastSignalCountRef.current && lastSignalCountRef.current > 0) {
                    SoundService.playNotification();
                }
                lastSignalCountRef.current = filtered.length;

                setSignals(filtered);
            } catch (error) {
                console.error("Failed to fetch crypto signals", error);
            }
        };

        const fetchCopyStatus = async () => {
            try {
                const res = await axios.get('/api/mt5/copy-trader/status');
                const activeId = res.data.activeMasterId;
                setMasters(prev => prev.map(m => ({ ...m, isCopying: m.id === activeId })));
            } catch (error) { }
        };

        const fetchSocialData = async () => {
            try {
                const [commRes, statusRes] = await Promise.all([
                    axios.get('/api/mt5/social/community?crypto=true'),
                    axios.get('/api/mt5/social/status?crypto=true')
                ]);
                setCommunity(commRes.data);
                setSocialStatus(statusRes.data);
            } catch (error) { }
        };

        const fetchMastersData = async () => {
            try {
                const res = await axios.get('/api/mt5/reports/strategies');
                const cryptoStrategies = ['Alpha Nakamoto', 'Altcoin Sniper', 'Ethereum Core', 'Quantum BTC Pro'];
                const filtered = res.data.filter((s: any) => cryptoStrategies.includes(s.name));

                // Busca histórico para cada um
                const mastersWithHistory = await Promise.all(filtered.map(async (s: any) => {
                    try {
                        const histRes = await axios.get(`/api/mt5/reports/strategy-history?name=${encodeURIComponent(s.name)}`);
                        return {
                            id: s.name.toLowerCase().replace(/\s+/g, '_'),
                            name: s.name,
                            winRate: s.winRate,
                            profitToday: 0,
                            activePos: 'Idle',
                            strategy: s.name === 'Alpha Nakamoto' ? 'Bitcoin Neural Momentum' :
                                s.name === 'Altcoin Sniper' ? 'Micro-cap Volatility' :
                                    s.name === 'Ethereum Core' ? 'Ethereum Neural Flow' : 'Quantum Grid Strategy',
                            totalProfit: s.totalProfit,
                            totalTrades: s.totalTrades,
                            bestWin: 0,
                            worstLoss: 0,
                            sharpeRatio: s.profitFactor,
                            avgTradeTime: 'N/A',
                            recentTrades: histRes.data || [],
                            isCopying: false // Será atualizado pelo fetchCopyStatus
                        };
                    } catch (e) {
                        return null;
                    }
                }));

                setMasters(prev => {
                    const newMasters = mastersWithHistory.filter(m => m !== null) as any[];
                    // Preserva o estado isCopying se já existir
                    return newMasters.map(nm => {
                        const existing = prev.find(p => p.id === nm.id);
                        return existing ? { ...nm, isCopying: existing.isCopying } : nm;
                    });
                });
            } catch (error) {
                console.error("Failed to fetch crypto masters data", error);
            }
        };

        const fetchCryptoIA = async () => {
            try {
                const res = await axios.get('/api/mt5/crypto-ia/status');
                setCryptoIAStatus(res.data);
            } catch (error) { }
        };

        fetchSignals();
        fetchCopyStatus();
        fetchSocialData();
        fetchMastersData();
        fetchCryptoIA();
        const signalIv = setInterval(fetchSignals, 5000);
        const copyIv = setInterval(fetchCopyStatus, 5000);
        const socialIv = setInterval(fetchSocialData, 8000);
        const mastersIv = setInterval(fetchMastersData, 15000);
        const cryptoIAIv = setInterval(fetchCryptoIA, 5000);

        const scanIv = setInterval(() => {
            setNetworkStatus(prev => prev === 'scanning' ? 'locked' : 'scanning');
        }, 3000);

        return () => {
            clearInterval(scanIv);
            clearInterval(signalIv);
            clearInterval(copyIv);
            clearInterval(socialIv);
            clearInterval(mastersIv);
        };
    }, []);

    const executeSignal = async (sig: CryptoSignal) => {
        if (executingId) return;

        setExecutingId(sig.id);
        setOrderResult(null);

        const settings = manualSettings[sig.id] || { lot: 0.01, tp: 3000, sl: 5000 };

        try {
            const response = await axios.post('/api/mt5/order', {
                symbol: sig.symbol,
                action: sig.type,
                lot: settings.lot,
                tp_points: settings.tp,
                sl_points: settings.sl,
                comment: `Matrix:${sig.symbol}:${sig.type}`
            });

            setOrderResult({
                id: sig.id,
                success: true,
                message: `Ordem Executada!`
            });
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message;
            setOrderResult({
                id: sig.id,
                success: false,
                message: msg
            });
        } finally {
            setTimeout(() => setExecutingId(null), 3000);
            setTimeout(() => setOrderResult(null), 4000);
        }
    };

    const toggleCryptoAutoPilot = async () => {
        setSocialLoading('autopilot');
        try {
            const newEnabled = !cryptoIAStatus?.settings?.enabled;
            const res = await axios.post('/api/mt5/crypto-ia/settings', { enabled: newEnabled });
            setCryptoIAStatus(res.data.statusData);
            setSocialStatus(prev => ({ ...prev, isAutoPilotActive: newEnabled }));
        } catch (error) { }
        setSocialLoading(null);
    };

    const toggleFollowTrader = async (id: string) => {
        if (socialStatus.isAutoPilotActive) return;
        setSocialLoading(id);
        try {
            const res = await axios.post('/api/mt5/social/follow', { traderId: id, isCrypto: true });
            setSocialStatus(res.data.statusData);
        } catch (error) { }
        setSocialLoading(null);
    };

    const toggleCryptoIASetting = async (key: string, value: any) => {
        try {
            const current = cryptoIAStatus?.settings || {};
            const newSettings = { ...current, [key]: value };
            const res = await axios.post('/api/mt5/crypto-ia/settings', newSettings);
            setCryptoIAStatus(res.data.statusData);
            SoundService.playNotification();
        } catch (e) { }
    };

    const handleCopyToggle = async (masterId: string) => {
        setMasters(prev => prev.map(m => m.id === masterId ? { ...m, isLoading: true } : m));

        try {
            const master = masters.find(m => m.id === masterId);
            const newStatus = !master?.isCopying;

            await axios.post('/api/mt5/copy-trader/follow', {
                masterId: newStatus ? masterId : null
            });

            setMasters(prev => prev.map(m => ({
                ...m,
                isCopying: m.id === masterId ? newStatus : false,
                isLoading: false
            })));
        } catch (error) {
            setMasters(prev => prev.map(m => m.id === masterId ? { ...m, isLoading: false } : m));
            console.error("Failed to toggle crypto copy", error);
        }
    };

    const toggleHistory = (masterId: string) => {
        setMasters(prev => prev.map(m => m.id === masterId ? { ...m, expandedHistory: !m.expandedHistory } : m));
    };

    const handleManualSync = () => {
        setSocialLoading('sync');
        // Apenas forçamos a busca dos dados novamente para UI
        // fetchMastersData é chamado internamente no useEffect via intervalo, chamamos aqui também
        (async () => {
            // Recarrega tudo
            try {
                const res = await axios.get('/api/mt5/reports/strategies');
                const cryptoStrategies = ['Alpha Nakamoto', 'Altcoin Sniper', 'Ethereum Core', 'Quantum BTC Pro'];
                const filtered = res.data.filter((s: any) => cryptoStrategies.includes(s.name));

                const mastersWithHistory = await Promise.all(filtered.map(async (s: any) => {
                    const histRes = await axios.get(`/api/mt5/reports/strategy-history?name=${encodeURIComponent(s.name)}`);
                    return {
                        id: s.name.toLowerCase().replace(/\s+/g, '_'),
                        name: s.name,
                        winRate: s.winRate,
                        profitToday: 0,
                        activePos: 'Idle',
                        strategy: s.name === 'Alpha Nakamoto' ? 'Bitcoin Neural Momentum' :
                            s.name === 'Altcoin Sniper' ? 'Micro-cap Volatility' :
                                s.name === 'Ethereum Core' ? 'Ethereum Neural Flow' : 'Quantum Grid Strategy',
                        totalProfit: s.totalProfit,
                        totalTrades: s.totalTrades,
                        bestWin: 0,
                        worstLoss: 0,
                        sharpeRatio: s.profitFactor,
                        avgTradeTime: 'N/A',
                        recentTrades: histRes.data || [],
                        isCopying: false
                    };
                }));

                setMasters(prev => {
                    const newMasters = mastersWithHistory as any[];
                    return newMasters.map(nm => {
                        const existing = prev.find(p => p.id === nm.id);
                        return existing ? { ...nm, isCopying: existing.isCopying } : nm;
                    });
                });
            } catch (e) { }
            setSocialLoading(null);
            SoundService.playNotification();
        })();
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Headline Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <Bitcoin size={40} className="text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Crypto</span> Hub
                            <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs tracking-widest uppercase">24/7 Ativo</span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-amber-500" /> Inteligência Algorítmica & Copy Trader Digital
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 relative z-10 items-center">
                    <button
                        onClick={handleManualSync}
                        disabled={socialLoading === 'sync'}
                        className={`p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl hover:bg-amber-500/20 transition-all flex items-center gap-2 group ${socialLoading === 'sync' ? 'animate-pulse' : ''}`}
                        title="Sincronizar Dados Reais">
                        <Activity size={18} className={socialLoading === 'sync' ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Recarregar Dashboard</span>
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status da Rede Blockchain</span>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${networkStatus === 'scanning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-trader-green/10 border-trader-green/20 text-trader-green'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${networkStatus === 'scanning' ? 'bg-amber-500' : 'bg-trader-green'}`}></div>
                            <span className="text-[10px] font-black uppercase">{networkStatus === 'scanning' ? 'Buscando Volatilidade' : 'Padrão Confirmado'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ALPHA SMART IA ENGINE - PAINEL PREMIUM */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <Cpu className="text-amber-500 animate-pulse" /> Alpha <span className="text-amber-500">Smart IA</span> Engine
                            <span className="px-2 py-0.5 bg-trader-green/20 text-trader-green border border-trader-green/30 rounded text-[10px] tracking-widest uppercase animate-pulse">Proteção Ativa</span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestão de Grade Fibonacci & Filtros HFT em Tempo Real</p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={toggleCryptoAutoPilot}
                            disabled={socialLoading === 'autopilot'}
                            className={`px-5 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                                cryptoIAStatus?.settings?.enabled
                                    ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                    : 'bg-trader-green/10 border-trader-green/30 text-trader-green hover:bg-trader-green/20'
                            }`}
                        >
                            {socialLoading === 'autopilot' ? (
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                            ) : cryptoIAStatus?.settings?.enabled ? (
                                <><Zap size={12} /> Desligar</>
                            ) : (
                                <><Zap size={12} /> Ligar</>
                            )}
                        </button>
                        <div className="flex items-center gap-3 bg-slate-950/40 px-4 py-2 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Smart Grid</span>
                            <button
                                onClick={() => toggleCryptoIASetting('smartGridIA', !cryptoIAStatus?.settings?.smartGridIA)}
                                className={`w-10 h-5 rounded-full relative transition-all ${cryptoIAStatus?.settings?.smartGridIA ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${cryptoIAStatus?.settings?.smartGridIA ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-950/40 px-4 py-2 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IA Profile</span>
                            <div className="flex gap-1">
                                {[
                                    { id: 'conservador', label: 'C', color: 'text-trader-green', bg: 'bg-trader-green/20' },
                                    { id: 'moderado', label: 'M', color: 'text-amber-500', bg: 'bg-amber-500/20' },
                                    { id: 'agressivo', label: 'A', color: 'text-trader-red', bg: 'bg-trader-red/20' }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => toggleCryptoIASetting('riskProfile', p.id)}
                                        className={`w-6 h-6 flex items-center justify-center rounded-lg text-[9px] font-black transition-all border ${
                                            cryptoIAStatus?.settings?.riskProfile === p.id 
                                            ? `${p.bg} ${p.color} border-current` 
                                            : 'bg-slate-900 text-slate-600 border-transparent hover:border-slate-700'
                                        }`}
                                        title={p.id.toUpperCase()}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-950/40 px-4 py-2 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HFT Filters</span>
                            <button
                                onClick={() => toggleCryptoIASetting('hftFilters', { ...cryptoIAStatus?.settings?.hftFilters, trendM1: !cryptoIAStatus?.settings?.hftFilters?.trendM1 })}
                                className={`w-10 h-5 rounded-full relative transition-all ${cryptoIAStatus?.settings?.hftFilters?.trendM1 ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${cryptoIAStatus?.settings?.hftFilters?.trendM1 ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* PAINEL DE ESTATÍSTICAS GLOBAIS IA */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-trader-green/20 text-trader-green rounded-xl">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">% Acerto Global IA</p>
                            <p className="text-xl font-black text-white italic">{cryptoIAStatus?.winRate || 0}%</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                            <Award size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Melhor Ativo (24h)</p>
                            <p className="text-xl font-black text-white italic">{cryptoIAStatus?.bestAsset || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-trader-blue/20 text-trader-blue rounded-xl">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ativos Monitorados</p>
                            <p className="text-xl font-black text-white italic">{cryptoIAStatus?.settings?.symbols?.length || 0}</p>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-purple-500/20 text-purple-500 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lucro Acumulado IA</p>
                            <p className="text-xl font-black text-trader-green italic">${cryptoIAStatus?.dailyProfit || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {cryptoIAStatus?.settings?.symbols.map((sym: string) => {
                        const state = cryptoIAStatus?.states[sym];
                        if (!state) return null;
                        const rsiColor = state.rsi > 70 ? 'text-trader-red' : state.rsi < 30 ? 'text-trader-green' : 'text-amber-500';
                        const trendColor = state.trendM1 === 'UP' ? 'text-trader-green' : 'text-trader-red';
                        const resolvedName = cryptoIAStatus?.resolvedSymbols?.[sym] || sym;
                        const isSynced = cryptoIAStatus?.resolvedSymbols?.[sym] !== undefined;

                        return (
                            <motion.div key={sym} whileHover={{ y: -5 }} className={`bg-slate-950/40 p-5 rounded-3xl border ${isSynced ? 'border-white/5' : 'border-red-500/20 opacity-60'} hover:border-amber-500/20 transition-all`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-white italic">{sym}</span>
                                        <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{resolvedName}</span>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${trendColor} bg-current/10 border border-current/20`}>
                                        {state.trendM1}
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isSynced ? 'bg-trader-blue/20 text-trader-blue' : 'bg-red-500/20 text-red-500'} border border-current/30`}>
                                        {isSynced ? `IA: ${cryptoIAStatus?.neuroScores?.[sym] || 0}%` : 'ERRO SYNC'}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">RSI (14)</p>
                                            <p className={`text-xl font-black italic ${rsiColor}`}>{state.rsi.toFixed(1)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">ATR</p>
                                            <p className="text-sm font-bold text-white">${state.atr.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${state.rsi}%` }}
                                            className={`h-full ${state.rsi > 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-trader-green to-amber-500'}`}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Grid Lvl</p>
                                            <p className="text-xs font-black text-white">{state.gridLevel || 0}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Vol Flow</p>
                                            <p className="text-xs font-black text-amber-500">{(state.currentVolume / state.volumeAvg * 100).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* MATRIZ NEURAL CRIPTO (SINAIS) */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                            <Zap className="text-amber-400" /> Alpha Signals <span className="text-amber-500">Crypto Matrix</span>
                        </h3>
                    </div>
                    <div className="grid gap-4">
                        {signals.map((sig) => (
                            <motion.div key={sig.id} whileHover={{ x: 5 }} className="bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-6">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${sig.type === 'BUY' ? 'bg-trader-green/10 text-trader-green border border-trader-green/20' : 'bg-trader-red/10 text-trader-red border border-trader-red/20'}`}>
                                        <TrendingUp size={24} className={sig.type === 'SELL' ? 'rotate-180' : ''} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xl font-black text-white italic tracking-tight">{sig.symbol}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${sig.type === 'BUY' ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-red/20 text-trader-red'}`}>
                                                {sig.type}
                                            </span>
                                            {sig.confidence >= 90 && (
                                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-trader-blue/20 text-trader-blue border border-trader-blue/30 shadow-[0_0_10px_rgba(0,163,255,0.2)] animate-pulse">
                                                    Institucional Alta Acertividade
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{sig.setup} • {sig.time}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Preço Atual</p>
                                        <p className="text-base font-black text-white">${sig.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Confiança Neural</p>
                                        <p className="text-xl font-black text-amber-400 italic">{sig.confidence}%</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 relative">
                                        {/* NOVO: Controles Editáveis de Execução */}
                                        <div className="flex items-center gap-2 mb-2 bg-slate-950/40 p-1.5 rounded-lg border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex flex-col">
                                                <span className="text-[7px] font-black text-slate-500 uppercase">Lot</span>
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-10 bg-slate-900 border border-slate-700 rounded p-0.5 text-[9px] text-center font-bold text-white outline-none focus:border-amber-500"
                                                    value={manualSettings[sig.id]?.lot || 0.01}
                                                    onChange={(e) => setManualSettings(p => ({ ...p, [sig.id]: { ...(p[sig.id] || { lot: 0.01, tp: 3000, sl: 5000 }), lot: parseFloat(e.target.value) || 0.01 } }))}
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[7px] font-black text-indigo-400 uppercase">TP pts</span>
                                                <input
                                                    type="number"
                                                    className="w-12 bg-slate-900 border border-slate-700 rounded p-0.5 text-[9px] text-center font-bold text-white outline-none focus:border-amber-500"
                                                    value={manualSettings[sig.id]?.tp || 3000}
                                                    onChange={(e) => setManualSettings(p => ({ ...p, [sig.id]: { ...(p[sig.id] || { lot: 0.01, tp: 3000, sl: 5000 }), tp: parseInt(e.target.value) || 0 } }))}
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[7px] font-black text-rose-500 uppercase">SL pts</span>
                                                <input
                                                    type="number"
                                                    className="w-12 bg-slate-900 border border-slate-700 rounded p-0.5 text-[9px] text-center font-bold text-white outline-none focus:border-amber-500"
                                                    value={manualSettings[sig.id]?.sl || 5000}
                                                    onChange={(e) => setManualSettings(p => ({ ...p, [sig.id]: { ...(p[sig.id] || { lot: 0.01, tp: 3000, sl: 5000 }), sl: parseInt(e.target.value) || 0 } }))}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => executeSignal(sig)}
                                            disabled={executingId === sig.id}
                                            className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg min-w-[120px] ${executingId === sig.id ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'}`}
                                        >
                                            {executingId === sig.id ? 'Enviando...' : 'Executar'}
                                        </button>

                                        <AnimatePresence>
                                            {orderResult && orderResult.id === sig.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    className={`absolute -bottom-8 right-0 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md ${orderResult.success ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-trader-red/20 text-trader-red border border-trader-red/30'}`}
                                                >
                                                    {orderResult.message}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* COPY TRADER ELITE CRIPTO */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                            <Target className="text-trader-blue" /> Elite <span className="text-trader-blue">Copy Traders</span>
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {masters.map((master, idx) => (
                            <React.Fragment key={master.id}>
                            <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 hover:border-trader-blue/30 transition-all group">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                                            <Crosshair size={18} className="text-slate-400 group-hover:text-trader-blue transition-colors" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider">{master.name}</h4>
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{master.strategy}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Acertividade</span>
                                        <span className="text-sm font-black text-trader-green italic">{master.winRate}%</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Lucro Hoje</span>
                                        <span className="text-sm font-black text-white italic">${master.profitToday.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Novas Estatísticas: Carreira e Consistência */}
                                <div className="space-y-4 mb-6">
                                    {/* Estatísticas de Carreira */}
                                    <div className="bg-slate-950/20 rounded-xl p-3 border border-slate-800">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                                            <Activity size={10} className="text-amber-500" /> Estatísticas de Carreira
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 gap-y-3 mt-2">
                                            <div>
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Lucro Total</span>
                                                <span className="text-xs font-black text-white italic">${master.totalProfit.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Total Op.</span>
                                                <span className="text-xs font-black text-white italic">{master.totalTrades.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Melhor Win</span>
                                                <span className="text-xs font-black text-trader-green italic">${master.bestWin.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Pior Loss</span>
                                                <span className="text-xs font-black text-trader-red italic">${Math.abs(master.worstLoss).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Raio-X de Consistência */}
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-950/20 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between">
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sharpe</span>
                                            <span className="text-xs font-black text-white italic">{master.sharpeRatio.toFixed(1)}</span>
                                        </div>
                                        <div className="flex-1 bg-slate-950/20 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between">
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">T. Médio</span>
                                            <span className="text-xs font-black text-white italic">{master.avgTradeTime}</span>
                                        </div>
                                    </div>

                                    {/* Botão de Histórico */}
                                    <button
                                        onClick={() => toggleHistory(master.id)}
                                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-300"
                                    >
                                        <Activity size={12} className={master.expandedHistory ? "text-trader-blue" : ""} />
                                        {master.expandedHistory ? 'Ocultar' : 'Ver'} Histórico de Acertividade
                                    </button>

                                    {/* Lista Expansível de Histórico */}
                                    <AnimatePresence>
                                        {master.expandedHistory && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-2 space-y-2">
                                                    {master.recentTrades.map((trade: any) => (
                                                        <div key={trade.id} className="bg-slate-950/40 rounded-lg p-2.5 border border-slate-800/50 flex flex-col gap-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${trade.type === 'BUY' ? 'bg-trader-green' : 'bg-trader-red'}`}></span>
                                                                    <span className="text-xs font-black text-white italic">{trade.symbol}</span>
                                                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{trade.time}</span>
                                                                </div>
                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${trade.profit > 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                                    {trade.profit > 0 ? '+' : ''}${trade.profit.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between px-3.5">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[7px] font-black text-slate-600 uppercase">Abertura</span>
                                                                    <span className="text-[9px] font-bold text-slate-400">{trade.openPrice}</span>
                                                                </div>
                                                                <div className="w-4 h-px bg-slate-800"></div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[7px] font-black text-slate-600 uppercase">Fechamento</span>
                                                                    <span className="text-[9px] font-bold text-slate-400">{trade.closePrice}</span>
                                                                </div>
                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[7px] font-black text-slate-600 uppercase">Duração</span>
                                                                    <span className="text-[9px] font-bold text-slate-400">{trade.duration}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <motion.button
                                    onClick={() => handleCopyToggle(master.id)}
                                    disabled={master.isLoading}
                                    whileHover={{ scale: master.isLoading ? 1 : 1.02 }}
                                    whileTap={{ scale: master.isLoading ? 1 : 0.98 }}
                                    className={`w-full py-3 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl border transition-all flex items-center justify-center gap-2 relative overflow-hidden ${master.isLoading ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' :
                                        master.isCopying
                                            ? 'bg-trader-red/10 border-trader-red/30 text-trader-red hover:bg-trader-red/20'
                                            : 'bg-trader-blue border-trader-blue hover:bg-trader-blue/80 text-white shadow-lg shadow-trader-blue/20'
                                        }`}
                                >
                                    {master.isLoading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                            Aguarde...
                                        </>
                                    ) : master.isCopying ? (
                                        <>
                                            <Shield size={14} className="rotate-180" /> Parar Cópia
                                        </>
                                    ) : (
                                        <>
                                            <Shield size={14} /> Copiar Trader
                                        </>
                                    )}
                                </motion.button>
                            </div>

                            {master.name.includes('Altcoin') && (
                                <div className="p-6 bg-purple-950/40 backdrop-blur-xl rounded-[2.5rem] border border-purple-500/30 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                                    <div className={`absolute inset-0 transition-opacity duration-1000 ${cryptoIAStatus?.settings?.enabled ? 'opacity-100' : 'opacity-0'} bg-gradient-to-br from-purple-600/20 to-indigo-600/20`}></div>
                                    <Cpu size={28} className={`mb-3 transition-all duration-500 relative z-10 ${cryptoIAStatus?.settings?.enabled ? 'text-purple-400 animate-pulse' : 'text-slate-600'}`} />
                                    <h3 className="text-base font-black text-white uppercase tracking-widest relative z-10">Cripto Auto-Pilot</h3>
                                    <p className="text-[9px] text-slate-400 font-medium mt-1 mb-3 max-w-[200px] relative z-10">
                                        {cryptoIAStatus?.settings?.enabled
                                            ? 'IA Neural analisando 23 criptomoedas 24/7.'
                                            : 'Deixe o robô operar automaticamente com inteligência neural.'}
                                    </p>
                                    <div className="flex items-center gap-3 mb-4 relative z-10">
                                        {cryptoIAStatus && (
                                            <>
                                                <span className={`flex items-center gap-1 text-[7px] font-black uppercase tracking-widest ${cryptoIAStatus.bridgeOk ? 'text-trader-green' : 'text-trader-red'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cryptoIAStatus.bridgeOk ? 'bg-trader-green' : 'bg-trader-red'}`}></span>
                                                    Bridge
                                                </span>
                                                <span className="text-[7px] text-slate-600">|</span>
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{cryptoIAStatus.resolvedCount || 0}/{cryptoIAStatus.totalSymbols || 23} Símbolos</span>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        onClick={toggleCryptoAutoPilot}
                                        disabled={socialLoading === 'autopilot'}
                                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all relative z-10 flex items-center gap-2 ${cryptoIAStatus?.settings?.enabled
                                            ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.4)]'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                            }`}
                                    >
                                        {socialLoading === 'autopilot' ? (
                                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                                        ) : cryptoIAStatus?.settings?.enabled ? (
                                            <><Zap size={14} /> Auto-Pilot Ativo</>
                                        ) : (
                                            <><Zap size={14} /> Ativar Auto-Pilot</>
                                        )}
                                    </button>
                                    {cryptoIAStatus?.settings?.enabled && !cryptoIAStatus?.bridgeOk && (
                                        <p className="text-[7px] text-amber-400 font-bold mt-2 relative z-10">Bridge offline — aguardando reconexão...</p>
                                    )}
                                </div>
                            )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* COMUNIDADE CRIPTO */}
            <div className="mt-12">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2 mb-6">
                    <Users className="text-purple-400" /> Comunidade <span className="text-purple-500">Cripto</span>
                </h3>
                <div className="grid gap-3">
                    {community.map((trader, i) => {
                        const isCoping = socialStatus.activeTraders.includes(trader.id);
                        const isLoading = socialLoading === trader.id;

                        return (
                            <motion.div key={trader.id} className={`flex flex-col md:flex-row justify-between items-center p-5 rounded-2xl border backdrop-blur-md transition-all ${isCoping ? 'bg-purple-900/30 border-purple-500/50' : 'bg-slate-900/40 border-slate-800'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-400 border-2 border-slate-700 relative">
                                        {i + 1}
                                        {i < 3 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-slate-900"></div>}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white flex items-center gap-2">
                                            {trader.username}
                                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400">
                                                {trader.level}
                                            </span>
                                        </h4>
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{trader.followers} seguidores</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8 mt-4 md:mt-0">
                                    <div className="text-center">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">% Acerto</p>
                                        <p className="text-lg font-black text-trader-green italic">{trader.winRate}%</p>
                                    </div>
                                    <div className="text-center hidden sm:block">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Lucro</p>
                                        <p className="text-base font-black text-white italic">${trader.profitTokens}</p>
                                    </div>
                                    <div className="text-center hidden md:block">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Drawdown</p>
                                        <p className="text-sm font-black text-trader-red italic">{trader.drawdown}%</p>
                                    </div>
                                    <button
                                        onClick={() => toggleFollowTrader(trader.id)}
                                        disabled={socialStatus.isAutoPilotActive || isLoading}
                                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all min-w-[140px] justify-center ${socialStatus.isAutoPilotActive ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500' :
                                            isLoading ? 'bg-slate-800 text-slate-500' :
                                                isCoping ? 'bg-trader-red/10 text-trader-red border border-trader-red/30' : 'bg-purple-600 hover:bg-purple-500 text-white'
                                            }`}
                                    >
                                        {isLoading ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span> :
                                            isCoping ? <><Target size={14} className="rotate-180" /> Parar Cópia</> : <><Target size={14} /> Copiar Trader</>
                                        }
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <CryptoReport />

            {/* CryptoRiskManager removido */}

        </div >
    );
};
