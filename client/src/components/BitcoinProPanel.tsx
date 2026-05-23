import React, { useState, useEffect } from 'react';
import { Bitcoin, TrendingUp, Activity, Zap, Shield, Target, Cpu, Wallet, BarChart3, Clock, TrendingDown } from 'lucide-react';
import axios from 'axios';

interface BitcoinProStatus {
    settings: { enabled: boolean; symbol: string; lotSize: number; maxDailyLoss: number; maxDailyProfit: number };
    state: { position: any | null; dailyProfit: number; dailyLoss: number };
    isRunning: boolean;
    marginOk: boolean;
    lastAnalysis: {
        price: number; ema50: number; ema200: number; ema50Slope: string;
        trend: string; rsi: number; distanceToEma50: number;
        pullbackToEma: boolean; rsiSignal: boolean; entryScore: number;
        swingLow: number; swingHigh: number;
    } | null;
    performance: { label: string; signalCount: number; winCount: number; winRate: number }[];
    stats: {
        totalTrades: number; winCount: number; lossCount: number; winRate: number;
        totalProfit: number; avgWin: number; avgLoss: number; profitFactor: number;
        maxConsecutiveWins: number; maxConsecutiveLosses: number;
        bestTrade: number; worstTrade: number;
    };
    trades: {
        entryTime: number; exitTime: number; entryPrice: number; exitPrice: number;
        direction: string; result: string; profit: number;
    }[];
}

interface AccountInfo {
    balance: number; equity: number; margin: number; margin_free: number;
    profit: number; leverage: number; currency: string;
}

interface LivePosition {
    ticket: number; symbol: string; type: number;
    price_open: number; price_current: number;
    sl: number; tp: number; profit: number;
    volume: number; time_msc: number;
}

export const BitcoinProPanel: React.FC = () => {
    const [status, setStatus] = useState<BitcoinProStatus | null>(null);
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [livePos, setLivePos] = useState<LivePosition | null>(null);
    const [allPositions, setAllPositions] = useState<LivePosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [lotSize, setLotSize] = useState('0.01');
    const [maxDailyLoss, setMaxDailyLoss] = useState('50');
    const [maxDailyProfit, setMaxDailyProfit] = useState('100');

    const fetchStatus = async () => {
        try {
            const [statusRes, accRes, posRes] = await Promise.all([
                axios.get('/api/mt5/bitcoin-pro/status'),
                axios.get('/api/mt5/account').catch(() => null),
                axios.get('/api/mt5/positions').catch(() => ({ data: [] })),
            ]);
            setStatus(statusRes.data);
            setLotSize(String(statusRes.data.settings.lotSize));
            setMaxDailyLoss(String(statusRes.data.settings.maxDailyLoss));
            setMaxDailyProfit(String(statusRes.data.settings.maxDailyProfit));
            if (accRes) setAccount(accRes.data);
            const positions: LivePosition[] = posRes.data || [];
            const btcPos = positions.find((p: LivePosition) => p.symbol === statusRes.data.settings.symbol);
            setLivePos(btcPos || null);
            setAllPositions(positions.filter((p: LivePosition) => p.symbol === statusRes.data.settings.symbol));
        } catch { }
    };

    useEffect(() => {
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => clearInterval(iv);
    }, []);

    const toggle = async () => {
        setLoading(true);
        try {
            await axios.post('/api/mt5/bitcoin-pro/settings', { enabled: !status?.settings?.enabled });
            await fetchStatus();
        } catch { }
        setLoading(false);
    };

    const saveRisk = async () => {
        try {
            await axios.post('/api/mt5/bitcoin-pro/settings', {
                ...status?.settings,
                lotSize: parseFloat(lotSize) || 0.01,
                maxDailyLoss: parseFloat(maxDailyLoss) || 50,
                maxDailyProfit: parseFloat(maxDailyProfit) || 100,
            });
            await fetchStatus();
        } catch { }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveRisk();
    };

    const a = status?.lastAnalysis;

    return (
        <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-600/10 rounded-2xl border border-green-600/20">
                            <Bitcoin size={28} className="text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Bitcoin <span className="text-green-500">Pro</span></h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estratégia 50/200 + RSI — Swing Trade BTC</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!status?.marginOk && status?.settings?.enabled && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Margem</span>
                            </div>
                        )}
                        <button
                            onClick={toggle}
                            disabled={loading}
                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${status?.settings?.enabled
                                ? 'bg-trader-red/10 border border-trader-red/30 text-trader-red'
                                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                                }`}
                        >
                            {loading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span> :
                                status?.settings?.enabled ? <><Zap size={16} /> Desligar</> : <><Zap size={16} /> Ativar Robô</>
                            }
                        </button>
                    </div>
                </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {!status?.marginOk && status?.settings?.enabled && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
                            <div>
                                <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Margem Insuficiente</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">A conta não tem margem livre suficiente para abrir posição BTCUSD 0.01. As posições XAUUSD em aberto consomem ~$120 de margem. O robô tentará automaticamente quando houver margem disponível.</p>
                            </div>
                        </div>
                    )}

                    {a ? (
                        <>
                            {/* Monitoramento da Estratégia */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Activity className="text-green-500" size={16} /> Monitoramento da Estratégia
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Preço BTC</span>
                                        <span className="text-lg font-black text-white">${a.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">EMA 50</span>
                                        <span className="text-lg font-black text-amber-400">${a.ema50.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">EMA 200</span>
                                        <span className="text-lg font-black text-indigo-400">${a.ema200.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">RSI 14</span>
                                        <span className={`text-lg font-black ${a.rsi > 70 ? 'text-trader-red' : a.rsi < 30 ? 'text-trader-green' : 'text-white'}`}>{a.rsi.toFixed(1)}</span>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2">
                                    {[
                                        { label: 'Tendência', ativo: a.trend === 'BULLISH', texto: a.trend, cor: a.trend === 'BULLISH' ? 'text-trader-green' : a.trend === 'BEARISH' ? 'text-trader-red' : 'text-slate-400', bgAtivo: 'bg-trader-green/10 border-trader-green/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                        { label: 'EMA50 Subindo', ativo: a.ema50Slope === 'UP', texto: a.ema50Slope === 'UP' ? '✅ Ativo' : '⏳ Inativo', cor: a.ema50Slope === 'UP' ? 'text-trader-green' : 'text-slate-500', bgAtivo: 'bg-trader-green/10 border-trader-green/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                        { label: 'Recuo EMA50', ativo: a.pullbackToEma, texto: a.pullbackToEma ? '✅ Próximo' : `⏳ ${a.distanceToEma50.toFixed(1)}%`, cor: a.pullbackToEma ? 'text-amber-400' : 'text-slate-500', bgAtivo: 'bg-amber-500/10 border-amber-500/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                        { label: 'Sinal RSI', ativo: a.rsiSignal, texto: a.rsiSignal ? '✅ Compra' : '⏳ Sem Sinal', cor: a.rsiSignal ? 'text-trader-green' : 'text-slate-500', bgAtivo: 'bg-trader-green/10 border-trader-green/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                        { label: 'Score', ativo: a.entryScore >= 60, texto: `${a.entryScore}/100`, cor: a.entryScore >= 70 ? 'text-trader-green' : a.entryScore >= 50 ? 'text-amber-400' : 'text-slate-500', bgAtivo: 'bg-trader-green/10 border-trader-green/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                        { label: 'Distância EMA50', ativo: Math.abs(a.distanceToEma50) < 3, texto: `${a.distanceToEma50.toFixed(2)}%`, cor: Math.abs(a.distanceToEma50) < 2 ? 'text-trader-green' : Math.abs(a.distanceToEma50) < 5 ? 'text-amber-400' : 'text-trader-red', bgAtivo: 'bg-amber-500/10 border-amber-500/30', bgInativo: 'bg-slate-950/40 border-white/5' },
                                    ].map((s, i) => (
                                        <div key={i} className={`p-2.5 rounded-xl border transition-all ${s.ativo ? s.bgAtivo : s.bgInativo}`}>
                                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block">{s.label}</span>
                                            <span className={`text-[10px] font-black ${s.cor}`}>{s.texto}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex items-center gap-4 text-[9px] font-bold text-slate-500">
                                    <span>Swing High: <span className="text-white">${a.swingHigh.toLocaleString()}</span></span>
                                    <span>Swing Low: <span className="text-white">${a.swingLow.toLocaleString()}</span></span>
                                    <span>Inclinação EMA50: <span className={a.ema50Slope === 'UP' ? 'text-trader-green' : a.ema50Slope === 'DOWN' ? 'text-trader-red' : 'text-slate-400'}>{a.ema50Slope}</span></span>
                                </div>
                            </div>

                            {/* Estatística da Estratégia */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <BarChart3 className="text-trader-blue" size={16} /> Estatística da Estratégia
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total Trades</span>
                                        <span className="text-lg font-black text-white">{status?.stats?.totalTrades || 0}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Win Rate</span>
                                        <span className={`text-lg font-black ${(status?.stats?.winRate || 0) >= 60 ? 'text-trader-green' : (status?.stats?.winRate || 0) >= 40 ? 'text-amber-400' : 'text-trader-red'}`}>
                                            {(status?.stats?.winRate || 0).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Profit Factor</span>
                                        <span className={`text-lg font-black ${(status?.stats?.profitFactor || 0) >= 1.5 ? 'text-trader-green' : (status?.stats?.profitFactor || 0) >= 1 ? 'text-amber-400' : 'text-trader-red'}`}>
                                            {status?.stats?.profitFactor === Infinity ? '∞' : (status?.stats?.profitFactor || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">P&L Total</span>
                                        <span className={`text-lg font-black ${(status?.stats?.totalProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                            ${(status?.stats?.totalProfit || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Média Win</span>
                                        <span className="text-sm font-black text-trader-green">${(status?.stats?.avgWin || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Média Loss</span>
                                        <span className="text-sm font-black text-trader-red">-${(status?.stats?.avgLoss || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Melhor Trade</span>
                                        <span className="text-sm font-black text-trader-green">${(status?.stats?.bestTrade || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pior Trade</span>
                                        <span className="text-sm font-black text-trader-red">${(status?.stats?.worstTrade || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Maior Sequência Wins</span>
                                        <span className="text-sm font-black text-trader-green">{status?.stats?.maxConsecutiveWins || 0}</span>
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Maior Sequência Losses</span>
                                        <span className="text-sm font-black text-trader-red">{status?.stats?.maxConsecutiveLosses || 0}</span>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Desempenho por Indicador</h4>
                                    <div className="space-y-1.5">
                                        {status?.performance?.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-white/5">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{p.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-slate-600">{p.winCount}/{p.signalCount}</span>
                                                    <span className={`text-xs font-black min-w-[3rem] text-right ${p.winRate >= 60 ? 'text-trader-green' : p.winRate >= 40 ? 'text-amber-400' : 'text-trader-red'}`}>
                                                        {p.winRate.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!status?.performance || status.performance.length === 0) && (
                                            <p className="text-xs text-slate-500 text-center py-3">Nenhum trade realizado ainda</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Monitoramento de Trades Abertos */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <TrendingUp className="text-trader-blue" size={16} /> Trades Abertos
                                </h3>
                                {livePos ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Ticket</span>
                                                <span className="text-sm font-black text-white">#{livePos.ticket}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Direção</span>
                                                <span className={`text-sm font-black ${livePos.type === 0 ? 'text-trader-green' : 'text-trader-red'}`}>{livePos.type === 0 ? 'BUY' : 'SELL'}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Volume</span>
                                                <span className="text-sm font-black text-white">{livePos.volume}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">P&L Flutuante</span>
                                                <span className={`text-sm font-black ${livePos.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                    ${livePos.profit.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Entrada</span>
                                                <span className="text-sm font-black text-white">${livePos.price_open.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Atual</span>
                                                <span className="text-sm font-black text-amber-400">${livePos.price_current.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Stop Loss</span>
                                                <span className="text-sm font-black text-trader-red">${livePos.sl.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Take Profit</span>
                                                <span className="text-sm font-black text-trader-green">${livePos.tp.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
                                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-2">Progresso para o TP</span>
                                            <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                                                {(() => {
                                                    const total = livePos.tp - livePos.price_open;
                                                    const atual = livePos.price_current - livePos.price_open;
                                                    const pct = Math.max(0, Math.min(100, (atual / total) * 100));
                                                    return (
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                                            style={{ width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : pct >= 50 ? 'linear-gradient(90deg, #22c55e, #eab308)' : 'linear-gradient(90deg, #eab308, #ef4444)' }}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex justify-between mt-1.5">
                                                <span className="text-[8px] text-trader-red font-bold">SL ${livePos.sl.toFixed(0)}</span>
                                                <span className={`text-[9px] font-black ${livePos.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                    {livePos.profit >= 0 ? '+' : ''}{livePos.profit.toFixed(2)}
                                                </span>
                                                <span className="text-[8px] text-trader-green font-bold">TP ${livePos.tp.toFixed(0)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-[8px] text-slate-600">
                                            <Clock size={10} />
                                            <span>Aberto desde: {new Date(livePos.time_msc).toLocaleString('pt-BR')}</span>
                                            <span className="font-bold">|</span>
                                            <span>Há {(Date.now() - livePos.time_msc) / 3600000 > 1 ? `${((Date.now() - livePos.time_msc) / 3600000).toFixed(1)}h` : `${Math.round((Date.now() - livePos.time_msc) / 60000)}min`}</span>
                                        </div>
                                    </div>
                                ) : allPositions.length > 0 ? (
                                    <div className="space-y-3">
                                        {allPositions.map(p => (
                                            <div key={p.ticket} className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[8px] font-black text-slate-500 uppercase">#{p.ticket} {p.type === 0 ? 'BUY' : 'SELL'}</span>
                                                    <span className={`text-xs font-black ${p.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                                        ${p.profit.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[9px] text-slate-400">${p.price_open.toFixed(2)} → ${p.price_current.toFixed(2)}</span>
                                                    <span className="text-[8px] text-slate-600">{p.volume} lot</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <TrendingDown size={32} className="text-slate-700 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-slate-500">Nenhum trade aberto</p>
                                        <p className="text-[8px] text-slate-600 mt-1">Aguardando setup ideal para entrar</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-12 flex flex-col items-center justify-center text-center">
                            <Cpu size={40} className="text-slate-700 mb-4" />
                            <p className="text-sm font-bold text-slate-500">Aguardando primeira análise...</p>
                            <p className="text-[10px] text-slate-600 mt-1">O robô coleta dados a cada 30s</p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <BarChart3 className="text-trader-blue" size={16} /> Dados Financeiros
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Saldo</span>
                                <span className="text-sm font-black text-white">${(account?.balance || 0).toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Equity</span>
                                <span className="text-sm font-black text-emerald-400">${(account?.equity || 0).toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Margem</span>
                                <span className="text-sm font-black text-amber-400">${(account?.margin || 0).toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Margem Livre</span>
                                <span className="text-sm font-black text-trader-green">${(account?.margin_free || 0).toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">P&L Diário</span>
                                <span className={`text-sm font-black ${(account?.profit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                    ${(account?.profit || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block mb-1">Alavancagem</span>
                                <span className="text-sm font-black text-indigo-400">1:{account?.leverage || 100}</span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[8px] text-slate-600">
                            <Wallet size={10} />
                            <span>{account?.currency || 'USD'}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="text-trader-blue" size={16} /> Gestão de Risco
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Lote</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max="10"
                                    value={lotSize}
                                    onChange={e => setLotSize(e.target.value)}
                                    onBlur={saveRisk}
                                    onKeyDown={handleKeyDown}
                                    className="w-20 bg-slate-800/80 text-right text-sm font-black text-white border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:border-green-500/50"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Max Loss Diário</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">$</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={maxDailyLoss}
                                        onChange={e => setMaxDailyLoss(e.target.value)}
                                        onBlur={saveRisk}
                                        onKeyDown={handleKeyDown}
                                        className="w-20 bg-slate-800/80 text-right text-sm font-black text-trader-red border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:border-red-500/50"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Max Gain Diário</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">$</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={maxDailyProfit}
                                        onChange={e => setMaxDailyProfit(e.target.value)}
                                        onBlur={saveRisk}
                                        onKeyDown={handleKeyDown}
                                        className="w-20 bg-slate-800/80 text-right text-sm font-black text-trader-green border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:border-green-500/50"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase">PL Diário</span>
                                <span className={`text-sm font-black ${(status?.state?.dailyProfit || 0) > 0 ? 'text-trader-green' : 'text-slate-400'}`}>
                                    ${(status?.state?.dailyProfit || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Target className="text-green-500" size={16} /> Posição Ativa
                        </h3>
                        {status?.state?.position ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Tipo</span>
                                    <span className="text-sm font-black text-trader-green">BUY</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Entrada</span>
                                    <span className="text-sm font-black text-white">${status.state.position.price.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Stop Loss</span>
                                    <span className="text-sm font-black text-trader-red">${status.state.position.sl.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Take Profit</span>
                                    <span className="text-sm font-black text-trader-green">${status.state.position.tp.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-xs font-bold text-slate-500">Nenhuma posição ativa</p>
                                <p className="text-[8px] text-slate-600 mt-1">Aguardando setup ideal</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
