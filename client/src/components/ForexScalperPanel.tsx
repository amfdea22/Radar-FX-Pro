import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Activity, Shield, RefreshCw,
    AlertTriangle, CheckCircle2, Power, Settings,
    Zap, Layers, Target, XCircle, TrendingDown, Settings2
} from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface ForexScalperSettings {
    enabled: boolean;
    symbols: string[];
    lotSize: number;
    gridDistancePoints: number;
    maxGridLevels: number;
    maxDailyLossUSD: number;
    dailyTargetUSD: number;
    smartBreakevenEnabled: boolean;
    smartBreakevenTriggerPoints: number;
    smartBreakevenLockPoints: number;
    takeProfitPoints: number;
    stopLossPoints: number;
    trailingStopEnabled: boolean;
    trailingStopPoints: number;
    basketSize: number;
    basketOffsetPoints: number;
    globalTrailingEnabled: boolean;
    gridMultiplier: number;
    gridDynamicDistance: boolean;
}

interface ForexState {
    dailyProfit: number;
    isGoalReached: boolean;
    isProcessing: boolean;
    activePositions: any[];
    logs: { time: string; msg: string; type: 'INFO' | 'TRADE' | 'SUCCESS' | 'WARN' }[];
}

export function ForexScalperPanel() {
    const [settings, setSettings] = useState<ForexScalperSettings | null>(null);
    const [state, setState] = useState<ForexState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [account, setAccount] = useState<{ balance?: number } | null>(null);

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/forex-scalper/status');
            const accResp = await axios.get('/api/mt5/account').catch(() => ({ data: { balance: 0 } }));
            setSettings(resp.data.settings);
            setState(resp.data.state);
            setAccount(accResp.data);
            setError(null);
        } catch (err) {
            setError('Falha ao conectar ao Backend do Speed Scalper.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const updateSetting = async (key: keyof ForexScalperSettings, value: any) => {
        if (!settings) return;
        setIsUpdating(true);
        try {
            await axios.post('/api/mt5/forex-scalper/settings', { [key]: value });
            fetchStatus();
        } catch (err) {
            setError('Erro ao atualizar configurações.');
        } finally {
            setIsLoading(false); // keep it simple
            setIsUpdating(false);
        }
    };

    const toggleEnabled = () => {
        if (settings) {
            updateSetting('enabled', !settings.enabled);
        }
    };

    const handleCloseOrder = async (ticket: number) => {
        try {
            await axios.post('/api/mt5/forex-scalper/close', { ticket });
            fetchStatus();
        } catch (err) {
            setError('Erro ao fechar ordem.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    if (!settings || !state) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Erro de Conexão</h3>
                <p className="text-red-200">{error}</p>
                <button
                    onClick={fetchStatus}
                    className="mt-4 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const progressPercent = settings.dailyTargetUSD > 0 ? Math.min((state.dailyProfit / settings.dailyTargetUSD) * 100, 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 italic">
                        <Zap className="w-8 h-8 text-cyan-400" />
                        SPEED SCALPER PRO
                        {settings.enabled ? (
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-sm not-italic rounded-full flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                ATIVO
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-slate-500/20 text-slate-400 text-sm not-italic rounded-full">
                                PARADO
                            </span>
                        )}
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Motor de tiros rápidos com Grid Dinâmico e Break Even Inteligente.
                    </p>
                </div>
                <button
                    onClick={toggleEnabled}
                    disabled={isUpdating}
                    className={`px-8 py-3 rounded-xl font-black uppercase tracking-wider flex items-center gap-2 transition-all ${settings.enabled
                        ? 'bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/30'
                        }`}
                >
                    <Power className="w-5 h-5" />
                    {settings.enabled ? 'Desligar Motor' : 'Ativar Agressividade'}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Principal */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-cyan-400" />
                            Progresso Diário
                        </h3>
                        {state.isGoalReached && (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-bold rounded-full flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> META BATIDA
                            </span>
                        )}
                    </div>

                    <div className="mb-6 relative z-10">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Meta Rápida (${settings.dailyTargetUSD})</span>
                            <span className={`font-bold ${state.dailyProfit >= settings.dailyTargetUSD ? 'text-green-400' : 'text-cyan-400'}`}>
                                ${state.dailyProfit.toFixed(2)}
                            </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ type: "spring", bounce: 0, duration: 1 }}
                                className={`h-full rounded-full ${state.dailyProfit >= settings.dailyTargetUSD
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                                    }`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 relative z-10">
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50">
                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Níveis Abertos (Grid)</div>
                            <div className="text-2xl font-black text-white flex items-center gap-2">
                                {state.activePositions.length}
                                <span className="text-sm text-slate-500 font-normal">/ {settings.maxGridLevels} Max</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 relative overflow-hidden">
                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Lucro Flutuante</div>
                            <div className={`text-2xl font-black ${state.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {state.dailyProfit >= 0 ? '+' : ''}${state.dailyProfit.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Painel de Log HFT */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col h-full">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 shrink-0">
                        <Activity className="w-5 h-5 text-slate-400" />
                        Live Execution (HFT)
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
                        {state.logs.length === 0 ? (
                            <div className="text-slate-500 text-center mt-10 italic">Aguardando sinais...</div>
                        ) : (
                            state.logs.map((log, i) => (
                                <div key={i} className="flex gap-3 items-start border-l-2 pl-2" style={{
                                    borderColor: log.type === 'SUCCESS' ? '#10b981' : log.type === 'WARN' ? '#f59e0b' : log.type === 'TRADE' ? '#22d3ee' : '#334155'
                                }}>
                                    <span className="text-slate-500 shrink-0">{log.time}</span>
                                    <span className={log.type === 'SUCCESS' ? 'text-emerald-400' : log.type === 'WARN' ? 'text-amber-400' : log.type === 'TRADE' ? 'text-cyan-400 font-bold' : 'text-slate-300'}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Monitor de Trades em Execução */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                        Monitor de Trades em Execução
                    </h3>
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                        Total: {state.activePositions.length} Operações
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket</th>
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ativo/Tipo</th>
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Lotes</th>
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Preço Entry</th>
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Lucro Atual</th>
                                <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {state.activePositions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-slate-600 italic">
                                        Nenhuma operação em vigor no momento.
                                    </td>
                                </tr>
                            ) : (
                                state.activePositions.map((pos) => (
                                    <tr key={pos.ticket} className="group hover:bg-slate-700/20 transition-colors">
                                        <td className="py-4 font-mono text-xs text-slate-400">#{pos.ticket}</td>
                                        <td className="py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white">{pos.symbol}</span>
                                                <span className={`text-[10px] font-black italic ${pos.type === 'BUY' ? 'text-cyan-400' : 'text-red-400'}`}>
                                                    {pos.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right font-mono text-sm text-white">
                                            {parseFloat(pos.volume).toFixed(2)}
                                        </td>
                                        <td className="py-4 text-right font-mono text-xs text-slate-400">
                                            {parseFloat(pos.price_open).toFixed(5)}
                                        </td>
                                        <td className={`py-4 text-right font-mono text-sm font-bold ${parseFloat(pos.profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {parseFloat(pos.profit) >= 0 ? '+' : ''}{parseFloat(pos.profit).toFixed(2)}
                                        </td>
                                        <td className="py-4 text-right">
                                            <button
                                                onClick={() => handleCloseOrder(pos.ticket)}
                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                                title="Fechar Ordem Manualmente"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Configurações Avançadas */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm shadow-xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                    <Settings className="w-5 h-5 text-cyan-400" />
                    Parâmetros Inteligentes (Grid & BE)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Target size={14} /> Lote Agressivo
                        </label>
                        <input
                            type="number"
                            min="0.01" step="0.01"
                            value={settings.lotSize}
                            onChange={(e) => updateSetting('lotSize', parseFloat(e.target.value))}
                            className="w-full bg-slate-800 text-white font-mono rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Layers size={14} /> Distância do Grid (Pts)
                        </label>
                        <input
                            type="number"
                            min="10" step="10"
                            value={settings.gridDistancePoints}
                            onChange={(e) => updateSetting('gridDistancePoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-amber-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-amber-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Ativa próximo nível após X pontos contra.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Shield size={14} /> BE Alvo (Pontos)
                        </label>
                        <input
                            type="number"
                            min="10" step="10"
                            value={settings.smartBreakevenTriggerPoints}
                            onChange={(e) => updateSetting('smartBreakevenTriggerPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-green-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-green-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Distância de lucro para armar Smart BE.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Shield size={14} /> BE Trava (Pontos)
                        </label>
                        <input
                            type="number"
                            min="0" step="1"
                            value={settings.smartBreakevenLockPoints}
                            onChange={(e) => updateSetting('smartBreakevenLockPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-green-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-green-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Trava de lucro mínimo ao acionar o BE.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center justify-between">
                            <span className="flex items-center gap-1"><TrendingUp size={14} /> Trailing Stop</span>
                            <div
                                onClick={() => updateSetting('trailingStopEnabled', !settings.trailingStopEnabled)}
                                className={`w-8 h-4 rounded-full cursor-pointer transition-colors relative ${settings.trailingStopEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.trailingStopEnabled ? 'left-4.5' : 'left-0.5'}`} />
                            </div>
                        </label>
                        <input
                            type="number"
                            min="10" step="10"
                            disabled={!settings.trailingStopEnabled}
                            value={settings.trailingStopPoints}
                            onChange={(e) => updateSetting('trailingStopPoints', parseInt(e.target.value))}
                            className={`w-full bg-slate-800 text-cyan-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-cyan-500 ${!settings.trailingStopEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Rastro dinâmico que segue o lucro.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Layers size={14} /> Cesta Proteção
                        </label>
                        <input
                            type="number"
                            min="1" max="10"
                            value={settings.basketSize}
                            onChange={(e) => updateSetting('basketSize', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-amber-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-amber-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Número de ordens simultâneas.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Settings2 size={14} /> Espaçamento Cesta
                        </label>
                        <input
                            type="number"
                            min="5" max="100"
                            value={settings.basketOffsetPoints}
                            onChange={(e) => updateSetting('basketOffsetPoints', parseInt(e.target.value))}
                            className="w-full bg-slate-800 text-purple-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-purple-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Distância inteligente entre camadas.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <Shield size={14} /> Proteção Global
                        </label>
                        <button
                            onClick={() => updateSetting('globalTrailingEnabled', !settings.globalTrailingEnabled)}
                            className={`w-full py-2 rounded-lg font-bold text-xs transition-all ${settings.globalTrailingEnabled
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                        >
                            {settings.globalTrailingEnabled ? 'ATIVADA' : 'DESATIVADA'}
                        </button>
                        <p className="text-[10px] text-slate-500 mt-2">Trava lucro da cesta inteira.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <TrendingUp size={14} /> Multiplicador Grid
                        </label>
                        <input
                            type="number"
                            step="0.1" min="1.0" max="3.0"
                            value={settings.gridMultiplier}
                            onChange={(e) => updateSetting('gridMultiplier', parseFloat(e.target.value))}
                            className="w-full bg-slate-800 text-green-400 font-mono font-bold rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-green-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">Aumenta lotes p/ sair rápido (Martingale).</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                        <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                            <RefreshCw size={14} /> Distância Dinâmica
                        </label>
                        <button
                            onClick={() => updateSetting('gridDynamicDistance', !settings.gridDynamicDistance)}
                            className={`w-full py-2 rounded-lg font-bold text-xs transition-all ${settings.gridDynamicDistance
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                        >
                            {settings.gridDynamicDistance ? 'INTELIGENTE' : 'FIXA'}
                        </button>
                        <p className="text-[10px] text-slate-500 mt-2">Aumenta distância em drawdowns.</p>
                    </div>
                </div>

                {/* Risk Settings (Global SL e TP) */}
                <div className="mt-6 border-t border-slate-700/50 pt-6">
                    <h4 className="text-sm font-bold text-white mb-4">Gestão de Risco Global</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Meta Diária (USD)</label>
                            <input
                                type="number"
                                value={settings.dailyTargetUSD}
                                onChange={(e) => updateSetting('dailyTargetUSD', parseFloat(e.target.value))}
                                className="w-full bg-slate-900 text-green-400 rounded-lg px-3 py-1.5 text-sm font-mono border border-slate-700 focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Max Loss Diário (USD)</label>
                            <input
                                type="number"
                                value={settings.maxDailyLossUSD}
                                onChange={(e) => updateSetting('maxDailyLossUSD', parseFloat(e.target.value))}
                                className="w-full bg-slate-900 text-red-400 rounded-lg px-3 py-1.5 text-sm font-mono border border-slate-700 focus:border-red-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Ordem Take (Pts)</label>
                            <input
                                type="number"
                                value={settings.takeProfitPoints}
                                onChange={(e) => updateSetting('takeProfitPoints', parseInt(e.target.value))}
                                className="w-full bg-slate-900 text-white rounded-lg px-3 py-1.5 text-sm font-mono border border-slate-700 focus:border-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Ordem SL (Pts)</label>
                            <input
                                type="number"
                                value={settings.stopLossPoints}
                                onChange={(e) => updateSetting('stopLossPoints', parseInt(e.target.value))}
                                className="w-full bg-slate-900 text-white rounded-lg px-3 py-1.5 text-sm font-mono border border-slate-700 focus:border-red-500"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
