import React, { useState } from 'react';
import { Settings, Shield, Zap, Target, X, Save, ShieldAlert, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RiskSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: {
        defaultLot: number;
        trailingPoints: number;
        riskRewardRatio: number;
        autoExecution: boolean;
        dailyStopLoss: number;
        dailyTakeProfit: number;
        maxTradesPerDay: number;
        manualStopLossUSD?: number;
        manualTakeProfitUSD?: number;
    };
    onSave: (newSettings: any) => void;
}

export const RiskSettings: React.FC<RiskSettingsProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-trader-blue/10 text-trader-blue rounded-xl">
                            <Settings size={20} />
                        </div>
                        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Risk Config</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Default Lot */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Lote Padrão (Lots)</label>
                        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <Zap size={18} className="text-trader-blue" />
                            <input
                                type="number"
                                step="0.01"
                                value={localSettings.defaultLot}
                                onChange={(e) => setLocalSettings({ ...localSettings, defaultLot: parseFloat(e.target.value) })}
                                className="bg-transparent text-lg font-black text-white outline-none w-full"
                            />
                        </div>
                    </div>

                    {/* Trailing Points */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Trailing Stop (Points)</label>
                        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <Shield size={18} className="text-trader-green" />
                            <input
                                type="number"
                                value={localSettings.trailingPoints}
                                onChange={(e) => setLocalSettings({ ...localSettings, trailingPoints: parseInt(e.target.value) })}
                                className="bg-transparent text-lg font-black text-white outline-none w-full"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Daily Stop */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Stop Diário ($)</label>
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
                                <ShieldAlert size={14} className="text-trader-red" />
                                <input
                                    type="number"
                                    value={localSettings.dailyStopLoss}
                                    onChange={(e) => setLocalSettings({ ...localSettings, dailyStopLoss: parseFloat(e.target.value) })}
                                    className="bg-transparent text-sm font-black text-white outline-none w-full"
                                />
                            </div>
                        </div>

                        {/* Daily Target */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Meta Diária ($)</label>
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
                                <Target size={14} className="text-trader-green" />
                                <input
                                    type="number"
                                    value={localSettings.dailyTakeProfit}
                                    onChange={(e) => setLocalSettings({ ...localSettings, dailyTakeProfit: parseFloat(e.target.value) })}
                                    className="bg-transparent text-sm font-black text-white outline-none w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Max Trades */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Máximo de Trades / Dia</label>
                        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <Activity size={18} className="text-purple-400" />
                            <input
                                type="number"
                                value={localSettings.maxTradesPerDay}
                                onChange={(e) => setLocalSettings({ ...localSettings, maxTradesPerDay: parseInt(e.target.value) })}
                                className="bg-transparent text-lg font-black text-white outline-none w-full"
                            />
                        </div>
                    </div>

                    {/* Manual Protection Configuration (Guardian) */}
                    <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield size={16} className="text-trader-blue" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Proteção Manual (Guardian)</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Stop Loss Manual ($)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={(localSettings as any).manualStopLossUSD || 5.0}
                                    onChange={(e) => setLocalSettings({ ...localSettings, manualStopLossUSD: parseFloat(e.target.value) } as any)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-trader-red transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Take Profit Manual ($)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={(localSettings as any).manualTakeProfitUSD || 10.0}
                                    onChange={(e) => setLocalSettings({ ...localSettings, manualTakeProfitUSD: parseFloat(e.target.value) } as any)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-trader-green transition-colors"
                                />
                            </div>
                        </div>
                        <p className="text-[7px] text-slate-600 font-bold leading-tight uppercase italic">
                            * Aplicado automaticamente a qualquer ordem manual aberta sem SL/TP.
                        </p>
                    </div>

                    {/* Max Consecutive Losses */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Limite de Loss Seguidos (Disciplina)</label>
                        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <ShieldAlert size={18} className="text-trader-red" />
                            <input
                                type="number"
                                value={(localSettings as any).maxConsecutiveLosses || 3}
                                onChange={(e) => setLocalSettings({ ...localSettings, maxConsecutiveLosses: parseInt(e.target.value) } as any)}
                                className="bg-transparent text-lg font-black text-white outline-none w-full"
                                placeholder="Ex: 3"
                            />
                        </div>
                    </div>

                    {/* Grid Protection Control */}
                    <div className="p-4 bg-trader-blue/5 border border-trader-blue/10 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-trader-blue" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Proteção de Grid (DCA)</span>
                            </div>
                            <button
                                onClick={() => setLocalSettings({ ...localSettings, enableGrid: !(localSettings as any).enableGrid } as any)}
                                className={`w-10 h-5 rounded-full transition-all relative ${(localSettings as any).enableGrid ? 'bg-trader-blue' : 'bg-slate-800'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(localSettings as any).enableGrid ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                        <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                            O Trade Guardian abrirá ordens automáticas para baixar o preço médio se a posição entrar em drawdown. Use com cautela.
                        </p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSave(localSettings)}
                        className="w-full py-4 bg-trader-blue hover:bg-trader-blue/80 text-white rounded-2xl shadow-lg shadow-trader-blue/20 transition-all font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 mt-4"
                    >
                        <Save size={18} /> Salvar Configurações
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};
