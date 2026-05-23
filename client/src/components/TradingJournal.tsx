import React, { useState, useEffect } from 'react';
import {
    BookOpen,
    Calendar,
    Tag,
    MessageSquare,
    Image as ImageIcon,
    Activity,
    Filter,
    Plus,
    Save,
    TrendingUp,
    TrendingDown,
    Clock,
    Target,
    Cpu,
    Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ReportCard: React.FC<{ title: string, stats: PeriodStats, icon: any }> = ({ title, stats, icon: Icon }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden group"
    >
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"></div>
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                <Icon size={20} className="text-orange-400" />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
        </div>

        <div className="space-y-4">
            <div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Lucro Líquido</p>
                <h4 className={`text-xl font-black italic ${stats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.profit >= 0 ? '+' : ''}${stats.profit.toLocaleString()}
                </h4>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">% Acerto</p>
                    <p className="text-xs font-black text-white">{stats.winRate}%</p>
                </div>
                <div>
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">P. Factor</p>
                    <p className="text-xs font-black text-white">{stats.profitFactor}</p>
                </div>
            </div>
        </div>
    </motion.div>
);

interface Trade {
    ticket: number;
    symbol: string;
    type: number;
    entry_price: number;
    exit_price?: number;
    profit: number;
    time: number;
    comment?: string;
    volume: number;
}

interface PeriodStats {
    profit: number;
    winRate: number;
    totalTrades: number;
    winTrades: number;
    lossTrades: number;
    profitFactor: number;
}

interface Reports {
    today: PeriodStats;
    threeDays: PeriodStats;
    weekly: PeriodStats;
    monthly: PeriodStats;
}

export const TradingJournal: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [reports, setReports] = useState<Reports | null>(null);
    const [loading, setLoading] = useState(true);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const now = new Date().toLocaleString();

        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text('RADAR-FX: DIÁRIO DE BORDO ALPHA', 14, 25);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Relatório Gerado em: ${now}`, 14, 32);

        if (reports) {
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text('Resumo de Performance', 14, 45);

            const summaryData = [
                ['Hoje', `+$${reports.today.profit}`, `${reports.today.winRate}%`, reports.today.totalTrades, reports.today.profitFactor],
                ['3 Dias', `+$${reports.threeDays.profit}`, `${reports.threeDays.winRate}%`, reports.threeDays.totalTrades, reports.threeDays.profitFactor],
                ['Semanal', `+$${reports.weekly.profit}`, `${reports.weekly.winRate}%`, reports.weekly.totalTrades, reports.weekly.profitFactor],
                ['Mensal', `+$${reports.monthly.profit}`, `${reports.monthly.winRate}%`, reports.monthly.totalTrades, reports.monthly.profitFactor],
            ];

            autoTable(doc, {
                startY: 50,
                head: [['Período', 'Lucro Líquido', 'Assertividade', 'Total Trades', 'Fator Lucro']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9 }
            });
        }

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 45;
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Histórico Detalhado de Operações', 14, finalY);

        const tableBody = trades.map(t => [
            new Date(t.time * 1000).toLocaleString(),
            t.symbol,
            t.volume,
            t.type === 0 ? 'BUY' : 'SELL',
            t.entry_price,
            t.profit >= 0 ? `+$${t.profit}` : `$${t.profit}`
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Data/Hora', 'Símbolo', 'Lote', 'Tipo', 'Preço', 'Lucro ($)']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
            columnStyles: {
                5: { fontStyle: 'bold' }
            },
            didParseCell: (data) => {
                if (data.column.index === 5 && data.cell.section === 'body') {
                    const val = data.cell.raw as string;
                    if (val && val.includes('+')) {
                        data.cell.styles.textColor = [34, 197, 94];
                    } else if (val && val.includes('-')) {
                        data.cell.styles.textColor = [239, 68, 68];
                    }
                }
            }
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Radar-FX Intelligent Station - Tecnologia de Alta Frequência Alpha', 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }

        doc.save(`Radar-FX_Diario_Alpha_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const fetchData = async () => {
        try {
            const [historyRes, reportsRes] = await Promise.all([
                axios.get(`/api/mt5/history?t=${Date.now()}`),
                axios.get(`/api/mt5/reports?t=${Date.now()}`)
            ]);

            const normalizeTime = (t: any): number => {
                const val = Number(t);
                if (isNaN(val)) return 0;
                return val > 100000000000 ? Math.floor(val / 1000) : val;
            };
            const resetTime = reportsRes.data?.today?.resetTimestamp || 0;
            const history = historyRes.data.filter((d: any) => d.entry === 1 && normalizeTime(d.time) >= resetTime);
            setTrades(history.map((h: any) => ({
                ticket: h.ticket,
                symbol: h.symbol,
                type: h.type,
                entry_price: h.price,
                profit: h.profit,
                time: h.time,
                volume: h.volume,
                comment: h.comment
            })).sort((a: any, b: any) => b.time - a.time));

            setReports(reportsRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to sync data:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-orange-500/10 rounded-3xl border border-orange-500/20 shadow-xl shadow-orange-500/10">
                        <BookOpen size={40} className="text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">Diário</span>
                            de Bordo
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-orange-500/10 border border-orange-500/20 text-orange-500">
                                {trades.length ? `${trades.length} trades` : 'AO VIVO'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-orange-400" /> Sincronizado com MT5 History (Últimos 30 dias)
                        </p>
                    </div>
                </div>

                <button
                    onClick={exportToPDF}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-orange-500/10 hover:border-orange-500/20 transition-all"
                >
                    <Download size={14} className="text-orange-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exportar PDF</span>
                </button>
            </div>

            {/* REPORTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reports && (
                    <>
                        <ReportCard title="Hoje" stats={reports.today} icon={Clock} />
                        <ReportCard title="3 Dias" stats={reports.threeDays} icon={Calendar} />
                        <ReportCard title="Semanal" stats={reports.weekly} icon={Activity} />
                        <ReportCard title="Mensal" stats={reports.monthly} icon={Target} />
                    </>
                )}
            </div>

            {/* TRADES SECTION */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"></div>

                <div className="flex items-center gap-2 mb-6">
                    <Activity size={18} className="text-orange-400" />
                    <h3 className="text-sm font-bold text-white">Histórico de Operações</h3>
                </div>

                <div className="space-y-4">
                    <AnimatePresence>
                        {trades.map((trade, i) => (
                            <motion.div
                                key={trade.ticket}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-slate-950/40 p-5 lg:p-6 rounded-2xl border border-white/5 hover:border-orange-500/20 transition-all lg:flex lg:items-center lg:gap-8"
                            >
                                <div className="flex items-center gap-4 lg:w-48">
                                    <div className={`p-4 rounded-2xl ${trade.profit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {trade.profit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-500 uppercase">{new Date(trade.time * 1000).toLocaleDateString()}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(trade.time * 1000).toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                <div className="flex-1 mt-6 lg:mt-0 grid grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Ativo / Lote</p>
                                        <p className="text-lg font-black text-white italic tracking-tight">{trade.symbol} <span className="text-[10px] text-slate-500">v.{trade.volume}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Tipo / Entrada</p>
                                        <p className="text-sm font-black text-slate-300 uppercase">{trade.type === 0 ? 'BUY' : 'SELL'} @ {trade.entry_price}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Resultado</p>
                                        <p className={`text-xl font-black italic ${trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {trade.profit >= 0 ? '+' : ''}{trade.profit.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="hidden lg:block">
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Ticket / Bridge</p>
                                        <p className="text-xs font-black text-slate-500 uppercase">#{trade.ticket}</p>
                                    </div>
                                </div>

                                <div className="mt-6 lg:mt-0 flex gap-2">
                                    <button className="p-3 bg-slate-900/60 rounded-xl border border-white/5 text-slate-500 hover:text-orange-400 hover:border-orange-500/20 transition-all">
                                        <MessageSquare size={16} />
                                    </button>
                                    <button className="p-3 bg-slate-900/60 rounded-xl border border-white/5 text-slate-500 hover:text-white hover:border-white/20 transition-all">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {loading && (
                        <div className="flex flex-col items-center justify-center p-20 space-y-4">
                            <Activity className="animate-pulse text-orange-400" size={48} />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Sincronizando Histórico MetaTrader...</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
