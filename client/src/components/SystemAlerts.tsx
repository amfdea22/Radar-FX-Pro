import React, { useState, useEffect } from 'react';
import {
    Bell,
    ShieldAlert,
    Zap,
    ShieldCheck,
    Info,
    AlertTriangle,
    Activity,
    Clock,
    Flame,
    Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface SystemAlert {
    id: string;
    timestamp: string;
    type: 'DISCIPLINE' | 'INSTITUTIONAL' | 'GUARDIAN' | 'MARKET';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    details?: string;
}

export const SystemAlerts: React.FC = () => {
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const response = await axios.get('/api/mt5/alerts');
            setAlerts(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to sync alerts:', error);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 5000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (type: string, severity: string) => {
        if (severity === 'CRITICAL') return <ShieldAlert size={20} className="text-red-400" />;
        if (type === 'INSTITUTIONAL') return <Flame size={20} className="text-amber-400" />;
        if (type === 'GUARDIAN') return <ShieldCheck size={20} className="text-blue-400" />;
        if (type === 'MARKET') return <Activity size={20} className="text-emerald-400" />;
        return <Info size={20} className="text-slate-400" />;
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'border-red-500/30 bg-red-500/5';
            case 'WARNING': return 'border-amber-500/30 bg-amber-500/5';
            default: return 'border-white/5 bg-transparent';
        }
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-red-500/10 rounded-3xl border border-red-500/20 shadow-xl shadow-red-500/10">
                        <Bell size={40} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-600">Central</span>
                            de Alertas
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-red-500/10 border border-red-500/20 text-red-500">
                                {alerts.length} {alerts.length === 1 ? 'ALERTA' : 'ALERTAS'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-red-400" /> Sincronização em Tempo Real com Motores Alpha
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5">
                    <Activity size={14} className="text-red-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync</span>
                    <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                    <span className="text-[10px] text-slate-500">Total: {alerts.length}</span>
                </div>
            </div>

            {/* ALERTS LIST */}
            <div className="max-w-4xl mx-auto space-y-4">
                <AnimatePresence mode="popLayout">
                    {alerts.length > 0 ? (
                        alerts.map((alert, i) => (
                            <motion.div
                                key={alert.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.05 }}
                                className={`bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border shadow-2xl relative overflow-hidden group hover:scale-[1.01] transition-all ${getSeverityStyles(alert.severity)}`}
                            >
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>
                                <div className="flex gap-6 items-start relative z-10">
                                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                                        {getIcon(alert.type, alert.severity)}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                                {alert.type} • {new Date(alert.timestamp).toLocaleTimeString()}
                                            </p>
                                            {alert.severity === 'CRITICAL' && (
                                                <span className="bg-red-500/20 text-red-400 text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse border border-red-500/30">
                                                    Urgente
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-white italic tracking-tight mb-2 group-hover:text-red-400 transition-colors">
                                            {alert.message}
                                        </h3>
                                        {alert.details && (
                                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                                {alert.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-32 space-y-4"
                        >
                            <Activity className="mx-auto text-slate-800" size={48} />
                            <p className="text-xs font-black text-slate-600 uppercase tracking-[0.3em]">Nenhum alerta pendente no sistema</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Activity className="animate-pulse text-red-400" size={48} />
                        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Monitorando Sistemas...</p>
                    </div>
                )}
            </div>

        </div>
    );
};
