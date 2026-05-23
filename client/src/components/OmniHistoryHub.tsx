import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    History, ArrowUpRight, ArrowDownRight, Search, 
    Download, Filter, Calendar, TrendingUp, 
    Trophy, AlertCircle, Percent, Hash
} from 'lucide-react';

interface OmniHistoryHubProps {
    onClose?: () => void;
}

export const OmniHistoryHub: React.FC<OmniHistoryHubProps> = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStrat, setFilterStrat] = useState('ALL');

    const fetchFullHistory = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/mt5/omni/history/full');
            setData(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch full history:', error);
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!filteredTrades.length) return;
        
        const headers = ['Ticket', 'Data/Hora', 'Ativo', 'Tipo', 'Estrategia', 'Lucro ($)'];
        const rows = filteredTrades.map((t: any) => [
            t.ticket,
            new Date(t.time * 1000).toLocaleString(),
            t.symbol,
            t.type === 0 ? 'BUY' : 'SELL',
            t.comment || 'OMNI_LEGACY',
            t.profit.toFixed(2)
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `RadarFX_OmniHistory_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        fetchFullHistory();
    }, []);

    const filteredTrades = data?.history?.filter((t: any) => {
        const matchesSearch = t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             t.ticket.toString().includes(searchTerm);
        
        const comment = (t.comment || '').toUpperCase();
        const matchesStrat = filterStrat === 'ALL' || comment.includes(filterStrat);
        
        return matchesSearch && matchesStrat;
    }) || [];

    // Cálculo da Curva de Lucro (Simples)
    const equityCurve = filteredTrades.slice().reverse().reduce((acc: any[], t: any) => {
        const lastProfit = acc.length > 0 ? acc[acc.length - 1].value : 0;
        acc.push({ 
            time: new Date(t.time * 1000).toLocaleDateString(),
            value: Number((lastProfit + t.profit).toFixed(2)) 
        });
        return acc;
    }, []);

    const stats = {
        totalProfit: filteredTrades.reduce((s: number, t: any) => s + t.profit, 0).toFixed(2),
        winRate: filteredTrades.length > 0 
            ? ((filteredTrades.filter((t: any) => t.profit > 0).length / filteredTrades.length) * 100).toFixed(1)
            : '0',
        bestTrade: Math.max(...filteredTrades.map((t: any) => t.profit), 0).toFixed(2),
        totalTrades: filteredTrades.length
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-12 h-12 border-4 border-trader-blue/20 border-t-trader-blue rounded-full animate-spin"></div>
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Banco de Dados Omni...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="text-trader-blue" size={32} />
                    </div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Lucro Acumulado</p>
                    <p className={`text-2xl font-black italic ${Number(stats.totalProfit) >= 0 ? 'text-white' : 'text-trader-red'}`}>
                        ${stats.totalProfit}
                    </p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Trophy className="text-amber-500" size={32} />
                    </div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Taxa de Acerto</p>
                    <p className="text-2xl font-black italic text-trader-green">{stats.winRate}%</p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Percent className="text-purple-500" size={32} />
                    </div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Melhor Trade</p>
                    <p className="text-2xl font-black italic text-white">+${stats.bestTrade}</p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Hash className="text-slate-500" size={32} />
                    </div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Amostragem</p>
                    <p className="text-2xl font-black italic text-white">{stats.totalTrades}</p>
                </div>
            </div>

            {/* Controle de Filtros */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-950/40 p-4 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-white/5 w-full md:w-96 focus-within:border-trader-blue transition-all">
                    <Search size={16} className="text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Buscar por Ticket ou Ativo..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs text-white font-black uppercase w-full placeholder:text-slate-700"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
                    <Filter size={14} className="text-slate-500 mr-2" />
                    {['ALL', 'MHI', 'TWIN', 'CYCLE'].map(strat => (
                        <button
                            key={strat}
                            onClick={() => setFilterStrat(strat)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                filterStrat === strat 
                                ? 'bg-trader-blue text-white shadow-lg' 
                                : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {strat}
                        </button>
                    ))}
                    
                    <button 
                        onClick={exportToCSV}
                        className="ml-4 flex items-center gap-2 bg-trader-green/10 text-trader-green px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-trader-green hover:text-white transition-all"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Lista de Trades */}
            <div className="bg-slate-900/20 rounded-[2rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/40 border-b border-white/5">
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Ticket</th>
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Data/Hora</th>
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Ativo</th>
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Tipo</th>
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Estratégia</th>
                                <th className="p-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic text-right">Resultado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredTrades.length > 0 ? filteredTrades.map((trade: any, index: number) => (
                                <motion.tr 
                                    key={trade.ticket}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(index * 0.05, 1) }}
                                    className="hover:bg-white/5 transition-colors group"
                                >
                                    <td className="p-6">
                                        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
                                            <Hash size={12} className="text-trader-blue/40" />
                                            {trade.ticket}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase">
                                            <Calendar size={12} className="opacity-40" />
                                            {new Date(trade.time * 1000).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-xs font-black text-white italic group-hover:text-trader-blue transition-colors">{trade.symbol}</span>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${
                                            trade.type === 0 ? 'bg-trader-green/20 text-trader-green' : 'bg-trader-red/20 text-trader-red'
                                        }`}>
                                            {trade.type === 0 ? 'BUY' : 'SELL'}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase italic tracking-tighter">
                                            {trade.comment || 'OMNI LEGACY'}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className={`text-sm font-black italic flex items-center justify-end gap-1 ${trade.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                            {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                            {trade.profit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        </div>
                                    </td>
                                </motion.tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-700">
                                            <AlertCircle size={40} className="opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum trade encontrado nos critérios de filtro</p>
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
