import React from 'react';
import {
    TrendingUp, TrendingDown, ExternalLink, Trash2,
    Activity, Clock, ArrowUpRight, ArrowDownRight, RefreshCw,
    Zap, Radio, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTvAlerts } from '../hooks/useTvAlerts';

export const TradingViewSignalsCard: React.FC = () => {
    const { alerts, loading, clearAlerts, buys, sells, lastAlert } = useTvAlerts();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/30 backdrop-blur-xl rounded-[2.5rem] border-2 border-blue-500/40 p-6 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden group"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-pulse"></div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none"></div>
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-cyan-500/5 blur-[60px] pointer-events-none"></div>

            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-2xl border border-blue-400/30 shadow-lg shadow-blue-500/10">
                        <Radio size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                <Zap size={18} className="text-blue-400" />
                                TradingView Signals
                            </h3>
                            <span className="px-2.5 py-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/10 text-blue-400 border border-blue-400/30 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                LIVE
                            </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                            <Bell size={10} className="text-blue-400" /> Alertas Webhook em Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                        <button onClick={clearAlerts} className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all">
                            <Trash2 size={15} />
                        </button>
                    )}
                    <a href="/settings" className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all">
                        <ExternalLink size={15} />
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4 relative z-10">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-blue-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Activity size={10} className="text-blue-400" />
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                    </div>
                    <p className="text-2xl font-black italic text-white">{alerts.length}</p>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-emerald-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ArrowUpRight size={10} className="text-emerald-400" />
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Compra</p>
                    </div>
                    <p className="text-2xl font-black italic text-emerald-400">{buys.length}</p>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-red-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ArrowDownRight size={10} className="text-red-400" />
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Venda</p>
                    </div>
                    <p className="text-2xl font-black italic text-red-400">{sells.length}</p>
                </div>
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-amber-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock size={10} className="text-amber-400" />
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Último</p>
                    </div>
                    <p className="text-lg font-black italic text-amber-400 truncate">
                        {lastAlert ? new Date(lastAlert.timestamp).toLocaleTimeString('pt-BR') : '---'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <RefreshCw size={24} className="text-blue-400 animate-spin" />
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-blue-500/20 rounded-2xl bg-slate-950/30 relative z-10">
                    <Radio size={48} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum Alerta Recebido</p>
                    <p className="text-[10px] text-slate-600 mt-2">Configure o webhook no TradingView e dispara um alerta</p>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-blue-500/20">
                        <Zap size={12} className="text-blue-400" />
                        <code className="text-[10px] text-blue-400 font-mono font-bold">{window.location.origin}/api/tradingview/webhook</code>
                    </div>
                    <div className="mt-3">
                        <p className="text-[8px] text-slate-600">Formato: {'{"symbol":"XAUUSD","direction":"buy","price":2345,"strategy":"SMC"}'}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 relative z-10">
                    <AnimatePresence initial={false}>
                        {alerts.map((a, idx) => {
                            const isBuy = a.direction === 'buy' || a.direction === 'long';
                            return (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center gap-4 p-4 bg-slate-950/60 rounded-2xl border border-blue-500/10 hover:border-blue-400/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all group/card"
                                >
                                    <div className={`p-3 rounded-xl ${isBuy ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-red-500/15 border border-red-500/20'}`}>
                                        {isBuy
                                            ? <ArrowUpRight size={20} className="text-emerald-400" />
                                            : <ArrowDownRight size={20} className="text-red-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base font-black text-white italic">{a.symbol}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${isBuy ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                                                {isBuy ? 'COMPRA' : 'VENDA'}
                                            </span>
                                            {a.strategy && a.strategy !== 'manual' && (
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate bg-slate-800/50 px-2 py-0.5 rounded-md">
                                                    {a.strategy}
                                                </span>
                                            )}
                                            {idx === 0 && (
                                                <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-400/20 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
                                                    NOVO
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-xs font-mono text-slate-400 font-bold">@ {a.price.toFixed(2)}</span>
                                            <span className="text-[9px] text-slate-600 flex items-center gap-1">
                                                <Clock size={9} />
                                                {new Date(a.timestamp).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity ${isBuy ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                        {isBuy ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {alerts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-blue-500/10 flex items-center justify-between text-[9px] text-slate-500 relative z-10">
                    <span className="flex items-center gap-1.5"><RefreshCw size={10} className="text-blue-400" /> Auto-sync 5s</span>
                    <span className="flex items-center gap-1.5"><Zap size={10} className="text-blue-400" /> {alerts.length} alertas armazenados</span>
                </div>
            )}
        </motion.div>
    );
};
