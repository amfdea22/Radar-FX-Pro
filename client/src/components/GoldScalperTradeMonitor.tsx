import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, DollarSign, Layers, List, RefreshCw } from 'lucide-react';

interface PositionData {
    ticket: number;
    type: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    currentPrice: number;
    sl: number;
    tp: number;
    profit: number;
    gridLevel: number;
    openTime: string;
    duration: string;
    hasPartialClose: boolean;
    trailingActive: boolean;
    watermark: number;
}

interface PositionEvent {
    time: string;
    ticket: number;
    type: 'OPENED' | 'PARTIAL_CLOSE' | 'TRAILING_UPDATE' | 'BREAKEVEN' | 'CLOSED';
    details: string;
    profit?: number;
}

interface MonitorData {
    summary: {
        openPositions: number;
        totalVolume: number;
        floatingPL: number;
        dailyTrades: number;
        dailyProfit: number;
        dailyLoss: number;
        gridLevelsUsed: number;
    };
    positions: PositionData[];
    events: PositionEvent[];
}

const API = '/api/mt5/gold-scalper/trade-monitor';

function calcDuration(openTime: string): string {
    if (!openTime) return '';
    const ms = Date.now() - new Date(openTime).getTime();
    if (ms < 0) return '0m';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}

export default function GoldScalperTradeMonitor({ embedded }: { embedded?: boolean }) {
    const [data, setData] = useState<MonitorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setTick] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(API);
            const json = await res.json();
            setData(json);
            setError('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Tick a cada 1s para atualizar durações em tempo real
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-yellow-400" size={32} />
                <span className="ml-3 text-gray-400">Carregando monitor...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-400">
                <span>Erro de conexão: {error}</span>
            </div>
        );
    }

    if (!data) return null;

    const { summary, positions, events } = data;

    return (
        <div className={embedded ? "space-y-3" : "space-y-4 p-4"}>
            {!embedded && (
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                        <Activity /> Gold Scalper — Monitor de Trades XAUUSD
                    </h2>
                    <button onClick={fetchData} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Atualizar agora">
                        <RefreshCw size={18} className="text-gray-400" />
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className={embedded ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3"}>
                <SummaryCard label="Abertas" value={summary.openPositions} icon={<Layers size={embedded ? 14 : 16} />} color="text-blue-400" embedded={embedded} />
                <SummaryCard label="Volume Total" value={summary.totalVolume.toFixed(2)} icon={<DollarSign size={embedded ? 14 : 16} />} color="text-cyan-400" embedded={embedded} />
                <SummaryCard label="P&L Flutuante" value={`$${summary.floatingPL.toFixed(2)}`} icon={<Activity size={embedded ? 14 : 16} />} color={summary.floatingPL >= 0 ? 'text-green-400' : 'text-red-400'} embedded={embedded} />
                <SummaryCard label="Trades Hoje" value={summary.dailyTrades} icon={<List size={embedded ? 14 : 16} />} color="text-purple-400" embedded={embedded} />
                <SummaryCard label="Daily Profit" value={`$${summary.dailyProfit.toFixed(2)}`} icon={<TrendingUp size={embedded ? 14 : 16} />} color="text-green-400" embedded={embedded} />
                <SummaryCard label="Daily Loss" value={`$${summary.dailyLoss.toFixed(2)}`} icon={<TrendingDown size={embedded ? 14 : 16} />} color="text-red-400" embedded={embedded} />
                <SummaryCard label="Grid Levels" value={`${summary.gridLevelsUsed}`} icon={<Layers size={embedded ? 14 : 16} />} color="text-yellow-400" embedded={embedded} />
            </div>

            {/* Positions Table */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700 font-semibold text-gray-300 flex items-center gap-2">
                    <Layers size={16} className="text-yellow-400" />
                    Posições Abertas
                    {positions.length === 0 && <span className="text-gray-500 text-sm font-normal ml-2">— Nenhuma posição aberta</span>}
                    {positions.length > 0 && <span className="text-gray-500 text-xs font-normal ml-1">({positions.length})</span>}
                </div>
                {positions.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                                    <th className="p-3 text-left">Ticket</th>
                                    <th className="p-3 text-left">Tipo</th>
                                    <th className="p-3 text-right">Volume</th>
                                    <th className="p-3 text-right">Entry</th>
                                    <th className="p-3 text-right">Atual</th>
                                    <th className="p-3 text-right">SL</th>
                                    <th className="p-3 text-right">TP</th>
                                    <th className="p-3 text-right">P&L</th>
                                    <th className="p-3 text-right">Grid</th>
                                    <th className="p-3 text-right">Duração</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map(pos => (
                                    <tr key={pos.ticket} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                        <td className="p-3 text-gray-300 font-mono">{pos.ticket}</td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                                pos.type === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                                            }`}>
                                                {pos.type === 'BUY' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {pos.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right text-gray-300">{pos.volume.toFixed(2)}</td>
                                        <td className="p-3 text-right text-gray-300">{pos.entryPrice.toFixed(2)}</td>
                                        <td className="p-3 text-right text-gray-300 font-mono">{pos.currentPrice?.toFixed(2) || '-'}</td>
                                        <td className="p-3 text-right text-gray-400">{pos.sl ? pos.sl.toFixed(pos.sl < 1 ? 2 : 1) : '-'}</td>
                                        <td className="p-3 text-right text-gray-400">{pos.tp ? pos.tp.toFixed(pos.tp < 1 ? 2 : 1) : '-'}</td>
                                        <td className={`p-3 text-right font-mono font-bold ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                                                #{pos.gridLevel}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right text-gray-400 text-xs whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1">
                                                <Clock size={12} /> {calcDuration(pos.openTime)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Events Feed */}
            <div className="bg-gray-900 rounded-lg border border-gray-700">
                <div className="px-4 py-3 border-b border-gray-700 font-semibold text-gray-300 flex items-center gap-2">
                    <Clock size={16} className="text-yellow-400" />
                    Feed de Eventos
                    <span className="text-gray-500 text-xs font-normal ml-1">({events.length})</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
                    {events.length === 0 ? (
                        <div className="p-6 text-gray-500 text-sm text-center">
                            Nenhum evento registrado ainda.
                            <div className="text-xs text-gray-600 mt-1">O monitor detectará automaticamente abertura e fechamento de posições.</div>
                        </div>
                    ) : (
                        events.slice().reverse().map((ev, i) => {
                            const evColor =
                                ev.type === 'OPENED' ? 'bg-blue-400' :
                                ev.type === 'CLOSED' ? (ev.profit && ev.profit >= 0 ? 'bg-green-400' : 'bg-red-400') :
                                ev.type === 'PARTIAL_CLOSE' ? 'bg-yellow-400' :
                                ev.type === 'TRAILING_UPDATE' ? 'bg-purple-400' :
                                ev.type === 'BREAKEVEN' ? 'bg-cyan-400' : 'bg-gray-400';
                            const textColor =
                                ev.type === 'OPENED' ? 'text-blue-400' :
                                ev.type === 'CLOSED' ? (ev.profit && ev.profit >= 0 ? 'text-green-400' : 'text-red-400') :
                                ev.type === 'PARTIAL_CLOSE' ? 'text-yellow-400' :
                                ev.type === 'TRAILING_UPDATE' ? 'text-purple-400' : 'text-cyan-400';
                            return (
                                <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-sm hover:bg-gray-800/30 transition-colors">
                                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${evColor}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold ${textColor}`}>{ev.type}</span>
                                            <span className="text-gray-600 text-xs">#{ev.ticket}</span>
                                            {ev.profit !== undefined && (
                                                <span className={`text-xs font-mono font-bold ${ev.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {ev.profit >= 0 ? '+' : ''}${ev.profit.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-gray-400 text-xs mt-0.5 truncate">{ev.details}</div>
                                    </div>
                                    <span className="text-gray-600 text-xs shrink-0 whitespace-nowrap">{formatTime(ev.time)}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon, color, embedded }: { label: string; value: string | number; icon: React.ReactNode; color: string; embedded?: boolean }) {
    return (
        <div className={`bg-gray-900 rounded-lg border border-gray-700 ${embedded ? 'p-2' : 'p-3'}`}>
            <div className={`flex items-center gap-2 text-gray-500 ${embedded ? 'text-[10px]' : 'text-xs'} mb-1`}>
                {icon}
                <span>{label}</span>
            </div>
            <div className={`${embedded ? 'text-base' : 'text-lg'} font-bold ${color}`}>{value}</div>
        </div>
    );
}

function formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
