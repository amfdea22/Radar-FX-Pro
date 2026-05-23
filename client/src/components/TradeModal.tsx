import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Target, Layers, TrendingUp, TrendingDown, DollarSign, Bitcoin, Globe, Briefcase, Search, Check, ShieldAlert, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { ASSETS, Asset, AssetCategory } from '../constants/assets';

interface TradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (trade: any) => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, onSave }) => {
    const [category, setCategory] = useState<AssetCategory>('B3');
    const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS.find(a => a.category === 'B3') || ASSETS[0]);
    const [type, setType] = useState<'COMPRA' | 'VENDA'>('COMPRA');
    const [contracts, setContracts] = useState<number>(1);
    const [entryPrice, setEntryPrice] = useState<number>(0);
    const [exitPrice, setExitPrice] = useState<number>(0);
    const [stopLoss, setStopLoss] = useState<number>(0);
    const [followedPlan, setFollowedPlan] = useState<boolean>(true);

    // Sistema de Gestão de Risco Inteligente
    const [capital, setCapital] = useState<number>(1000);
    const [riskProfile, setRiskProfile] = useState<'cons' | 'mod' | 'agg'>('mod');
    const [disciplineLocked, setDisciplineLocked] = useState(false);

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Verificar status da disciplina
        axios.get('/api/mt5/discipline').then(res => {
            if (res.data && res.data.isLocked) {
                setDisciplineLocked(true);
            }
        }).catch(() => {});
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAssets = useMemo(() => {
        return ASSETS.filter(a =>
            a.category === category &&
            (a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [category, searchQuery]);

    if (!isOpen) return null;

    // Calcular risco em % com base no perfil
    const riskPercentage = useMemo(() => {
        if (riskProfile === 'cons') return 1;
        if (riskProfile === 'mod') return 3;
        return 5;
    }, [riskProfile]);

    // Calcular saldo do risco R$
    const riskAmount = (capital * riskPercentage) / 100;

    // Sugerir lotes
    useEffect(() => {
        if (entryPrice > 0 && stopLoss > 0 && entryPrice !== stopLoss) {
            const pointRisk = Math.abs(entryPrice - stopLoss);
            let pointMultiplier = selectedAsset.pointValue;
            if (selectedAsset.category === 'FOREX') {
                pointMultiplier = selectedAsset.symbol.includes('JPY') ? 100 : 10000;
                pointMultiplier = pointMultiplier * (selectedAsset.pointValue / 10);
            }
            if (pointRisk > 0 && pointMultiplier > 0) {
                // riskAmount = pointRisk * contracts * pointMultiplier
                const suggestedContracts = riskAmount / (pointRisk * pointMultiplier);
                if (suggestedContracts > 0 && isFinite(suggestedContracts)) {
                    // Arredondar seguro para 2 casas
                    setContracts(parseFloat(suggestedContracts.toFixed(2)));
                }
            }
        }
    }, [entryPrice, stopLoss, riskAmount, selectedAsset]);

    const financialResult = useMemo(() => {
        const diff = type === 'COMPRA' ? exitPrice - entryPrice : entryPrice - exitPrice;

        if (selectedAsset.category === 'B3') {
            return diff * contracts * selectedAsset.pointValue;
        } else if (selectedAsset.category === 'CRYPTO') {
            return diff * contracts;
        } else {
            // Forex calculation logic
            const multiplier = selectedAsset.symbol.includes('JPY') ? 100 : 10000;
            if (selectedAsset.symbol.includes('XAU')) return diff * contracts;
            return diff * multiplier * contracts * (selectedAsset.pointValue / 10);
        }
    }, [selectedAsset, type, contracts, entryPrice, exitPrice]);

    const handleSave = async () => {
        const payload = {
            category: selectedAsset.category,
            asset: selectedAsset.name,
            symbol: selectedAsset.symbol,
            type,
            contracts,
            entryPrice,
            exitPrice,
            stopLoss,
            capitalRiskPct: riskPercentage,
            value: financialResult,
            status: financialResult >= 0 ? 'GAIN' : 'LOSS',
            followedPlan
        };

        try {
            const resp = await axios.post('/api/mt5/journal', payload);
            if (resp.data && resp.data.trade) {
                onSave(resp.data.trade);
            }
        } catch (e) {
            // Em caso de erro salvar mockado
            const mockTrade = { ...payload, timestamp: new Date() };
            onSave(mockTrade);
        }
        
        onClose();
    };

    const getCategoryIcon = (cat: AssetCategory) => {
        switch (cat) {
            case 'B3': return <Briefcase size={16} />;
            case 'CRYPTO': return <Bitcoin size={16} />;
            case 'FOREX': return <Globe size={16} />;
            default: return <Target size={16} />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Novo Registro</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Gestor de Risco Integrado</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 Transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {disciplineLocked && (
                    <div className="bg-trader-red border-b border-trader-red/50 p-4 flex items-center justify-center gap-3 shadow-lg shadow-trader-red/20">
                        <ShieldAlert size={20} className="text-white" />
                        <span className="text-white text-xs font-black uppercase tracking-widest">Atenção: Limite Diário (Stop) Atingido no Alpha. Operações Bloqueadas!</span>
                    </div>
                )}

                <div className={`p-8 space-y-6 ${disciplineLocked ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                    {/* Category Toggle */}
                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
                        {(['B3', 'CRYPTO', 'FOREX'] as AssetCategory[]).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => {
                                    setCategory(cat);
                                    const firstOfCat = ASSETS.find(a => a.category === cat);
                                    if (firstOfCat) setSelectedAsset(firstOfCat);
                                    setSearchQuery('');
                                }}
                                className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${category === cat ? 'bg-trader-blue text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Asset Search/Selector */}
                        <div className="space-y-2 relative" ref={searchRef}>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ativo</label>
                            <button
                                onClick={() => setIsSearchOpen(!isSearchOpen)}
                                className="w-full flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-trader-blue outline-none font-bold"
                            >
                                <div className="flex items-center gap-2">
                                    {getCategoryIcon(selectedAsset.category)}
                                    <span className="truncate">{selectedAsset.name}</span>
                                </div>
                                <Search size={14} className="text-slate-500" />
                            </button>

                            <AnimatePresence>
                                {isSearchOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-10 top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                                    >
                                        <div className="p-2 border-b border-slate-800 sticky top-0 bg-slate-900">
                                            <input
                                                autoFocus
                                                placeholder="Buscar ativo..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-trader-blue outline-none"
                                            />
                                        </div>
                                        {filteredAssets.map(asset => (
                                            <button
                                                key={asset.id}
                                                onClick={() => {
                                                    setSelectedAsset(asset);
                                                    setIsSearchOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors text-left ${selectedAsset.id === asset.id ? 'text-trader-blue bg-trader-blue/5' : 'text-slate-300'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black">{asset.name}</span>
                                                    <span className="text-[8px] uppercase tracking-widest text-slate-600">{asset.symbol}</span>
                                                </div>
                                                {selectedAsset.id === asset.id && <Check size={14} />}
                                            </button>
                                        ))}
                                        {filteredAssets.length === 0 && (
                                            <div className="p-4 text-center text-slate-600 text-[10px] font-black uppercase">Nenhum ativo encontrado</div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Type Toggle */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo de Ordem</label>
                            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 h-[46px]">
                                <button onClick={() => setType('COMPRA')} className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition-all ${type === 'COMPRA' ? 'bg-trader-green/20 text-trader-green' : 'text-slate-600'}`}>
                                    <TrendingUp size={14} /><span className="text-[10px] font-black">COMPRA</span>
                                </button>
                                <button onClick={() => setType('VENDA')} className={`flex-1 flex items-center justify-center gap-2 rounded-xl transition-all ${type === 'VENDA' ? 'bg-trader-red/20 text-trader-red' : 'text-slate-600'}`}>
                                    <TrendingDown size={14} /><span className="text-[10px] font-black">VENDA</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Risk Calculator Section */}
                    <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 relative shadow-inner">
                        <div className="absolute top-4 right-4 text-trader-blue opacity-20"><Calculator size={40} /></div>
                        
                        <div className="grid grid-cols-2 gap-6 relative z-10 mb-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Capital Disponível (R$)</label>
                                <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-trader-blue outline-none font-bold text-center" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Perfil de Risco</label>
                                <div className="flex rounded-xl overflow-hidden border border-slate-800 h-[46px]">
                                    <button onClick={() => setRiskProfile('cons')} className={`flex-1 text-[8px] font-black uppercase transition-colors ${riskProfile === 'cons' ? 'bg-trader-green text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}>CONS</button>
                                    <button onClick={() => setRiskProfile('mod')} className={`flex-1 text-[8px] font-black uppercase transition-colors ${riskProfile === 'mod' ? 'bg-trader-blue text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}>MOD</button>
                                    <button onClick={() => setRiskProfile('agg')} className={`flex-1 text-[8px] font-black uppercase transition-colors ${riskProfile === 'agg' ? 'bg-trader-red text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}>AGR</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-trader-blue/5 border border-trader-blue/20 rounded-xl relative z-10">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Risco Aceitável: <span className="text-trader-blue font-black">{riskPercentage}%</span></span>
                            <span className="text-sm font-black text-white italic tracking-wider">R$ {riskAmount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preço Entrada</label>
                            <input type="number" step="0.00001" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-trader-blue outline-none font-bold" />
                        </div>
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-trader-red">Stop Loss</label>
                            <input type="number" step="0.00001" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-trader-red outline-none font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-trader-blue">Lotes/Contratos Sugeridos</label>
                            <input type="number" step="0.01" value={contracts} onChange={(e) => setContracts(Number(e.target.value))} className="w-full bg-slate-950 border border-trader-blue/30 rounded-2xl px-4 py-3 text-trader-blue outline-none font-black text-lg" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preço Saída Real</label>
                            <input type="number" step="0.00001" value={exitPrice} onChange={(e) => setExitPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-trader-green outline-none font-bold" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-950 rounded-[2rem] border border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${financialResult >= 0 ? 'bg-trader-green/10 text-trader-green' : 'bg-trader-red/10 text-trader-red'}`}>
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resultado Financeiro</p>
                                <p className={`text-2xl font-black ${financialResult >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>R$ {financialResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seguiu o Plano?</span>
                            <button onClick={() => setFollowedPlan(!followedPlan)} className={`w-12 h-6 rounded-full relative transition-colors ${followedPlan ? 'bg-trader-green' : 'bg-slate-700'}`}>
                                <motion.div animate={{ x: followedPlan ? 26 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </button>
                        </div>
                    </div>

                    <button onClick={handleSave} className="w-full py-4 bg-trader-blue hover:bg-trader-blue/80 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-trader-blue/20 transition-all active:scale-[0.98]">
                        CONFIRMAR E REGISTRAR
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
