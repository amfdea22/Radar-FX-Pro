import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Target, Activity, Lock, Unlock, AlertTriangle, Calendar, Clock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { SoundService } from '../services/SoundService';

interface DisciplineStatus {
    profit: number;
    tradeCount: number;
    consecutiveLosses: number;
    limits: {
        dailyStopLoss: number;
        dailyTakeProfit: number;
        maxTradesPerDay: number;
        maxConsecutiveLosses: number;
    };
    isSafe: boolean;
    isLocked: boolean;
    reason: string | null;
    history: {
        today: { profit: number; tradeCount: number; winRate: number };
        d3: { profit: number; tradeCount: number; winRate: number };
        w1: { profit: number; tradeCount: number; winRate: number };
        m1: { profit: number; tradeCount: number; winRate: number };
    };
    pulse: {
        guardian: { active: boolean };
        signals: { active: boolean; signalCount: number };
        intelligence: { active: boolean };
    };
}

export const DisciplinePanel: React.FC = () => {
    const [status, setStatus] = useState<DisciplineStatus | null>(null);
    const [lastLockState, setLastLockState] = useState(false);
    const [activePeriod, setActivePeriod] = useState<'today' | 'd3' | 'w1' | 'm1'>('today');
    const [loadingReset, setLoadingReset] = useState(false);

    const fetchStatus = async () => {
        try {
            const response = await axios.get(`/api/mt5/discipline?t=${Date.now()}`);
            const newStatus = response.data;
            if (newStatus.isLocked && !lastLockState) {
                try { SoundService.playAlert(); } catch (e) { }
            }
            setLastLockState(newStatus.isLocked);
            setStatus(newStatus);
        } catch (e) {
            console.error('Failed to fetch discipline status');
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!status) return (
        <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 animate-pulse h-[400px]">
            <div className="w-1/2 h-4 bg-slate-800 rounded mb-4"></div>
            <div className="w-full h-32 bg-slate-800 rounded mb-4"></div>
        </div>
    );

    const periodData = status.history[activePeriod];
    const periods = [
        { id: 'today', label: 'Hoje', icon: Clock },
        { id: 'd3', label: '3 Dias', icon: Calendar },
        { id: 'w1', label: '1 Semana', icon: BarChart3 },
        { id: 'm1', label: '1 Mês', icon: Activity },
    ];

    const profitProgress = status.profit >= 0
        ? Math.min((status.profit / status.limits.dailyTakeProfit) * 100, 100)
        : Math.min((Math.abs(status.profit) / status.limits.dailyStopLoss) * 100, 100);

    return (
        <div className={`bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden transition-all ${status.isLocked ? 'border-trader-red/50 shadow-trader-red/10 animate-pulse' : ''}`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Gestão Emocional</h3>
                    <h2 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        Diário Alpha
                        {status.isLocked ? <Lock size={16} className="text-trader-red" /> : <Unlock size={16} className="text-trader-green" />}
                    </h2>
                </div>
                <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${status.isLocked ? 'bg-trader-red/20 border-trader-red text-trader-red' : 'bg-trader-green/20 border-trader-green text-trader-green'}`}>
                    {status.isLocked ? 'Locked' : 'Safe'}
                </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 mb-6 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                {periods.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setActivePeriod(p.id as any)}
                        className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${activePeriod === p.id ? 'bg-trader-blue text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <p className="text-[7px] font-black uppercase tracking-tighter">{p.label}</p>
                    </button>
                ))}
            </div>

            {/* Results Display */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 group hover:border-trader-blue/30 transition-all">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Resultado Líquido</p>
                        <p className={`text-2xl font-black italic ${periodData.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                            {periodData.profit >= 0 ? '+' : ''}${periodData.profit}
                        </p>
                    </div>
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Assertividade</p>
                        <p className="text-2xl font-black text-white italic">{periodData.winRate}%</p>
                    </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Volume de Trades</p>
                        <p className="text-lg font-black text-white">{periodData.tradeCount} ordens</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Sequência Loss</p>
                        <p className={`text-lg font-black ${status.consecutiveLosses > 1 ? 'text-trader-red' : 'text-white'}`}>{activePeriod === 'today' ? status.consecutiveLosses : '-'}</p>
                    </div>
                </div>

                {/* Daily Protection Progress (Only for today) */}
                {activePeriod === 'today' && (
                    <div className="pt-2">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Proteção Diária</span>
                            <span className={`text-[10px] font-black italic ${status.profit >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                {Math.round(profitProgress)}% do limite
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${profitProgress}%` }}
                                className={`h-full ${status.profit >= 0 ? 'bg-trader-green' : 'bg-trader-red'}`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Reset & Emergency Actions */}
            <div className="mt-6 pt-6 border-t border-slate-800/50 space-y-3">
                <AnimatePresence>
                    {status.isLocked && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-3 bg-trader-red/10 border border-trader-red/30 rounded-xl flex items-center gap-3 mb-3">
                            <AlertTriangle size={16} className="text-trader-red" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-trader-red uppercase tracking-widest">Bloqueio Ativo</span>
                                <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">{status.reason}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    disabled={loadingReset}
                    onClick={async () => {
                        if (confirm('Deseja resetar as estatísticas e bloqueios do Diário Alpha?')) {
                            setLoadingReset(true);
                            await axios.post('/api/mt5/discipline/reset');
                            await fetchStatus();
                            setLoadingReset(false);
                        }
                    }}
                    className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${status.isLocked
                        ? 'bg-trader-red text-white border-trader-red shadow-lg shadow-trader-red/20 hover:bg-trader-red/80'
                        : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 border-slate-700/50'
                        } ${loadingReset ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loadingReset ? 'Resetando Alpha...' : status.isLocked ? 'Alpha Emergency Reset (DESBLOQUEAR)' : 'Alpha Reset Stats'}
                </button>
            </div>
        </div>
    );
};
