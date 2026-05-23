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
    Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Sub-component for Period Report Cards
const ReportCard: React.FC<{ title: string, stats: PeriodStats, icon: any }> = ({ title, stats, icon: Icon }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800 hover:border-trader-blue/40 transition-all group"
    >
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-950 rounded-2xl text-slate-400 group-hover:text-trader-blue transition-colors">
                <Icon size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
        </div>

        <div className="space-y-4">
            <div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Lucro Líquido</p>
                <h4 className={`text-xl font-black italic ${stats.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                    {stats.profit >= 0 ? '+' : ''}${stats.profit.toLocaleString()}
                </h4>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
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
    type: number; // 0 for BUY, 1 for SELL
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

        // Cabeçalho
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('RADAR-FX: DIÁRIO DE BORDO ALPHA', 14, 25);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Relatório Gerado em: ${now}`, 14, 32);

        // Seção de Resumo
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

        // Tabela de Trades Detalhada
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
                        data.cell.styles.textColor = [34, 197, 94]; // trader-green
                    } else if (val && val.includes('-')) {
                        data.cell.styles.textColor = [239, 68, 68]; // trader-red
                    }
                }
            }
        });

        // Rodapé
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
        const interval = setInterval(fetchData, 10000); // 10s sync
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Diário de Bordo Alpha</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Sincronizado com MT5 History (Últimos 30 dias)</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-trader-blue/10 border border-trader-blue/20 text-trader-blue rounded-2xl hover:bg-trader-blue/20 transition-all text-xs font-black uppercase tracking-widest"
                    >
                        <Save size={16} /> Exportar PDF
                    </button>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {reports && (
                    <>
                        <ReportCard title="Hoje" stats={reports.today} icon={Clock} />
                        <ReportCard title="3 Dias" stats={reports.threeDays} icon={Calendar} />
                        <ReportCard title="Semanal" stats={reports.weekly} icon={Activity} />
                        <ReportCard title="Mensal" stats={reports.monthly} icon={Target} />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6">
                <AnimatePresence>
                    {trades.map((trade, i) => (
                        <motion.div
                            key={trade.ticket}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/50 hover:border-trader-blue/30 transition-all group lg:flex lg:items-center lg:gap-8"
                        >
                            {/* Status & Date */}
                            <div className="flex items-center gap-4 lg:w-48">
                                <div className={`p-4 rounded-2xl ${trade.profit >= 0 ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                    {trade.profit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-500 uppercase">{new Date(trade.time * 1000).toLocaleDateString()}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(trade.time * 1000).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            {/* Trade Details */}
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
                                    <p className={`text-xl font-black italic ${trade.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toLocaleString()}
                                    </p>
                                </div>
                                <div className="hidden lg:block">
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Ticket / Bridge</p>
                                    <p className="text-xs font-black text-slate-500 uppercase">#{trade.ticket}</p>
                                </div>
                            </div>

                            {/* Comment section */}
                            <div className="mt-6 lg:mt-0 flex gap-2">
                                <button className="p-3 bg-slate-950 border border-slate-800 text-slate-500 rounded-xl hover:text-trader-blue transition-all">
                                    <MessageSquare size={16} />
                                </button>
                                <button className="p-3 bg-slate-950 border border-slate-800 text-slate-500 rounded-xl hover:text-white transition-all">
                                    <Plus size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                        <Activity className="animate-pulse text-trader-blue" size={48} />
                        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Sincronizando Histórico MetaTrader...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
