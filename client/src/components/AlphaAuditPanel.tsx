import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    History,
    Zap,
    TrendingUp,
    TrendingDown,
    Brain,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    Activity
} from 'lucide-react';

interface AuditSnapshot {
    id: string;
    timestamp: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    microTrend: 'up' | 'down' | 'neutral';
    macroTrend: 'up' | 'down' | 'neutral';
    sentimentScore: number;
    sentimentEmotion: string;
    candleTime: number;
    orderTicket?: number;
}

export const AlphaAuditPanel: React.FC = () => {
    const [auditData, setAuditData] = useState<AuditSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const fetchAudit = async () => {
        try {
            const resp = await axios.get('/api/mt5/audit/history');
            setAuditData(resp.data.reverse());
        } catch (e) {
            console.error('Failed to fetch audit', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAudit();
        const timer = setInterval(fetchAudit, 10000);
        return () => clearInterval(timer);
    }, []);

    const filteredData = auditData.filter(a =>
        a.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        a.type.toLowerCase().includes(filter.toLowerCase())
    );

    const getEmotionColor = (score: number) => {
        if (score < 30) return 'text-red-400';
        if (score < 45) return 'text-orange-400';
        if (score > 70) return 'text-emerald-400';
        if (score > 55) return 'text-green-400';
        return 'text-slate-400';
    };

    return (
        <div className="space-y-4">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-trader-blue/10 flex items-center justify-center text-trader-blue border border-trader-blue/20">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit Mode</p>
                        <p className="text-lg font-black text-white">ACTIVE</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                        <History size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capturas Totais</p>
                        <p className="text-lg font-black text-white">{auditData.length}</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado da I.A.</p>
                        <p className="text-lg font-black text-white uppercase italic">Learning...</p>
                    </div>
                </div>
            </div>

            {/* Main Audit List */}
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                            <Zap size={18} />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight italic">Black Box: Snapshot Execução</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input
                                type="text"
                                placeholder="Filtrar por ativo ou direção..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-trader-blue/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário / Ticket</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Instrumento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alpha Vision (M5/H1)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sentimento Agent</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Candle Timing</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <AnimatePresence>
                                {filteredData.map((snapshot, idx) => (
                                    <motion.tr
                                        key={snapshot.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-white/[0.03] transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-200">
                                                    {new Date(snapshot.timestamp).toLocaleTimeString()}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-500 italic">
                                                    #{snapshot.orderTicket || snapshot.id.split('-').pop()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${snapshot.type === 'BUY' ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                                    {snapshot.type === 'BUY' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white">{snapshot.symbol}</p>
                                                    <p className={`text-[9px] font-black uppercase ${snapshot.type === 'BUY' ? 'text-trader-green' : 'text-trader-red'}`}>
                                                        {snapshot.type === 'BUY' ? 'Compra' : 'Venda'} @ {snapshot.price}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[7px] font-black text-slate-500 uppercase">Micro (M5)</span>
                                                    <div className={`p-1 rounded-full border ${snapshot.microTrend === 'up' ? 'bg-trader-green/20 border-trader-green/30 text-trader-green' : snapshot.microTrend === 'down' ? 'bg-trader-red/20 border-trader-red/30 text-trader-red' : 'bg-slate-800 border-white/10 text-slate-600'}`}>
                                                        {snapshot.microTrend === 'up' ? <TrendingUp size={10} /> : snapshot.microTrend === 'down' ? <TrendingDown size={10} /> : <Zap size={10} />}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[7px] font-black text-slate-500 uppercase">Macro (H1)</span>
                                                    <div className={`p-1 rounded-full border ${snapshot.macroTrend === 'up' ? 'bg-trader-green/20 border-trader-green/30 text-trader-green' : snapshot.macroTrend === 'down' ? 'bg-trader-red/20 border-trader-red/30 text-trader-red' : 'bg-slate-800 border-white/10 text-slate-600'}`}>
                                                        {snapshot.macroTrend === 'up' ? <TrendingUp size={12} /> : snapshot.macroTrend === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} className="opacity-10" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex items-center gap-1 pb-1 border-b border-white/5 w-24 justify-center">
                                                    <Brain size={10} className={getEmotionColor(snapshot.sentimentScore)} />
                                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${getEmotionColor(snapshot.sentimentScore)}`}>
                                                        {snapshot.sentimentEmotion.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className={`h-full rounded-full ${snapshot.sentimentScore < 45 ? 'bg-red-500' : snapshot.sentimentScore > 55 ? 'bg-trader-green' : 'bg-slate-500'}`}
                                                        style={{ width: `${snapshot.sentimentScore}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 bg-white/5 py-2 px-3 rounded-xl border border-white/5">
                                                <Clock size={12} className={snapshot.candleTime < 15 ? 'text-trader-red animate-pulse' : 'text-slate-500'} />
                                                <span className={`text-[12px] font-black ${snapshot.candleTime < 15 ? 'text-trader-red' : 'text-slate-300'}`}>
                                                    00:{snapshot.candleTime < 10 ? `0${snapshot.candleTime}` : snapshot.candleTime}
                                                </span>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>

                            {filteredData.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Shield size={40} className="text-slate-800" />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum evento auditado ainda. Realize uma operação para iniciar o log de rede.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
