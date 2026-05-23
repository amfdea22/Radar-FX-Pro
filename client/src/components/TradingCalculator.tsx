import React, { useState } from 'react';
import { Calculator, Target, ShieldAlert, Percent, DollarSign, ArrowRight, ArrowDown, ArrowUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export const TradingCalculator: React.FC = () => {
    // Estado Calculadora de Lote
    const [accountBalance, setAccountBalance] = useState<number>(1000);
    const [riskPercent, setRiskPercent] = useState<number>(1.0);
    const [stopLossPips, setStopLossPips] = useState<number>(20);
    const [pairValuePerPip, setPairValuePerPip] = useState<number>(10); // Standard Lot (100k) pip value

    // Estado Risco/Retorno
    const [entryPrice, setEntryPrice] = useState<number>(0);
    const [stopLossPrice, setStopLossPrice] = useState<number>(0);
    const [takeProfitPrice, setTakeProfitPrice] = useState<number>(0);

    // Cálculos - Lote
    const riskAmount = accountBalance * (riskPercent / 100);
    const recommendedLot = stopLossPips > 0 && pairValuePerPip > 0
        ? riskAmount / (stopLossPips * pairValuePerPip)
        : 0;

    // Cálculos - Risco Retorno
    const rrRisk = Math.abs(entryPrice - stopLossPrice);
    const rrReward = Math.abs(takeProfitPrice - entryPrice);
    const rrRatio = rrRisk > 0 ? (rrReward / rrRisk).toFixed(2) : '0.00';
    const isBuy = stopLossPrice < entryPrice && takeProfitPrice > entryPrice;
    const isSell = stopLossPrice > entryPrice && takeProfitPrice < entryPrice;
    const direction = entryPrice === 0 ? 'N/A' : isBuy ? 'COMPRA (LONG)' : isSell ? 'VENDA (SHORT)' : 'Inválido';

    return (
        <div className="p-4 lg:p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900/30 via-slate-900/80 to-indigo-900/30 backdrop-blur-xl p-8 rounded-[2rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.1),transparent_50%)]"></div>

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-indigo-500/10 rounded-3xl border border-indigo-500/30 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                            <Calculator size={36} strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Finance / Calculadora</h1>
                                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                    Pro Tool
                                </span>
                            </div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Dimensionamento de Posição & Gestão de Risco</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Lot Size Calculator */}
                <div className="bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full point-events-none group-hover:bg-indigo-600/10 transition-colors duration-700"></div>

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <ShieldAlert className="text-indigo-400" size={24} />
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">Dimensionamento de Lote</h2>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo da Conta (USD)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="number"
                                    value={accountBalance}
                                    onChange={(e) => setAccountBalance(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black italic focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Risco (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={riskPercent}
                                        onChange={(e) => setRiskPercent(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black italic focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stop Loss (Pips)</label>
                                <div className="relative">
                                    <ArrowDown className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="number"
                                        value={stopLossPips}
                                        onChange={(e) => setStopLossPips(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black italic focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-950/30 border border-indigo-500/20 rounded-3xl mt-6 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Valor em Risco</span>
                                <span className="text-lg font-black text-white italic">${riskAmount.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-white/5 w-full"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Lote Recomendado</span>
                                <div className="bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/40">
                                    <span className="text-3xl font-black text-indigo-300 italic">{recommendedLot.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Risk / Reward Calculator */}
                <div className="bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 blur-[100px] rounded-full point-events-none group-hover:bg-emerald-600/10 transition-colors duration-700"></div>

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <Target className="text-emerald-400" size={24} />
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">Risco / Retorno (R:R)</h2>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preço de Entrada</label>
                            <div className="relative">
                                <ArrowRight className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={entryPrice || ''}
                                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white font-black italic focus:outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="Ex: 1.08500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-trader-red uppercase tracking-widest">Stop Loss</label>
                                <div className="relative">
                                    <ArrowDown className="absolute left-4 top-1/2 transform -translate-y-1/2 text-trader-red/50" size={16} />
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={stopLossPrice || ''}
                                        onChange={(e) => setStopLossPrice(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-trader-red/20 rounded-2xl py-4 pl-12 pr-4 text-trader-red font-black italic focus:outline-none focus:border-trader-red/50 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-trader-green uppercase tracking-widest">Take Profit</label>
                                <div className="relative">
                                    <ArrowUp className="absolute left-4 top-1/2 transform -translate-y-1/2 text-trader-green/50" size={16} />
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={takeProfitPrice || ''}
                                        onChange={(e) => setTakeProfitPrice(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-trader-green/20 rounded-2xl py-4 pl-12 pr-4 text-trader-green font-black italic focus:outline-none focus:border-trader-green/50 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-emerald-950/30 border border-emerald-500/20 rounded-3xl mt-6 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Direção</span>
                                <span className={`text-sm font-black italic px-3 py-1 rounded-lg border ${isBuy ? 'bg-trader-green/20 text-trader-green border-trader-green/30' : isSell ? 'bg-trader-red/20 text-trader-red border-trader-red/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{direction}</span>
                            </div>
                            <div className="h-px bg-white/5 w-full"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Relação Risco : Retorno</span>
                                <div className={`px-4 py-2 rounded-xl border ${Number(rrRatio) >= 2 ? 'bg-trader-green/20 border-trader-green/40' : Number(rrRatio) >= 1 ? 'bg-amber-500/20 border-amber-500/40' : 'bg-trader-red/20 border-trader-red/40'}`}>
                                    <span className={`text-3xl font-black italic ${Number(rrRatio) >= 2 ? 'text-trader-green' : Number(rrRatio) >= 1 ? 'text-amber-500' : 'text-trader-red'}`}>
                                        1 : {rrRatio}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
