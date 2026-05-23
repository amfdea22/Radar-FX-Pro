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
    Flame
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
        if (severity === 'CRITICAL') return <ShieldAlert size={20} className="text-trader-red" />;
        if (type === 'INSTITUTIONAL') return <Flame size={20} className="text-trader-amber" />;
        if (type === 'GUARDIAN') return <ShieldCheck size={20} className="text-trader-blue" />;
        if (type === 'MARKET') return <Activity size={20} className="text-trader-green" />;
        return <Info size={20} className="text-slate-400" />;
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'border-trader-red/30 bg-trader-red/10';
            case 'WARNING': return 'border-trader-amber/30 bg-trader-amber/10';
            default: return 'border-slate-800 bg-slate-900/40';
        }
    };

    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        Central de Alertas
                        <div className={`w-2 h-2 rounded-full animate-ping ${loading ? 'bg-trader-amber' : 'bg-trader-green'}`}></div>
                    </h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                        <Activity size={10} className="text-trader-green" />
                        Sincronização em Tempo Real com Motores Alpha
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Status de Sincronia</span>
                            <span className="text-[9px] font-black text-trader-green uppercase tracking-widest">ATIVO • 100%</span>
                        </div>
                        <div className="w-[1px] h-6 bg-slate-800"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total: {alerts.length}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
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
                                className={`p-6 rounded-[2rem] border backdrop-blur-xl flex gap-6 items-start group hover:scale-[1.01] transition-all ${getSeverityStyles(alert.severity)}`}
                            >
                                <div className={`p-4 rounded-2xl bg-slate-950/50 border border-slate-800/50 group-hover:border-white/10 transition-colors`}>
                                    {getIcon(alert.type, alert.severity)}
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            {alert.type} • {new Date(alert.timestamp).toLocaleTimeString()}
                                        </p>
                                        {alert.severity === 'CRITICAL' && (
                                            <span className="bg-trader-red text-[7px] font-black px-2 py-0.5 rounded-full text-white uppercase tracking-tighter animate-pulse">
                                                Urgente
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-black text-white italic tracking-tight mb-2 group-hover:text-trader-blue transition-colors">
                                        {alert.message}
                                    </h3>
                                    {alert.details && (
                                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                            {alert.details}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-32 space-y-4">
                            <Activity className="mx-auto text-slate-800 animate-pulse" size={48} />
                            <p className="text-xs font-black text-slate-600 uppercase tracking-[0.3em]">Nenhum alerta pendente no sistema</p>
                        </div>
                    )}
                </AnimatePresence>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                        <Activity className="animate-pulse text-trader-blue" size={48} />
                        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Monitorando Sistemas...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
