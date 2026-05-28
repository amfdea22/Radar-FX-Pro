import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    ShieldOff,
    AlertTriangle,
    Lock,
    Unlock,
    ArrowUpFromLine,
    Activity,
    DollarSign,
    Hand,
    Zap,
    Brain,
    Terminal,
    Clock,
    CheckCircle2,
    XCircle,
    FileText,
    Download,
    Wifi,
    Radio,
    RefreshCw,
    Newspaper,
    ListChecks,
    Timer,
    TrendingDown,
    PiggyBank,
    EqualNot,
    KeyRound,
    Ban
} from 'lucide-react';
import axios from 'axios';

interface SecurityConfig {
    panicEnabled: boolean;
    dailyLossLock: boolean;
    dailyLossAmount: number;
    targetHitLock: boolean;
    targetHitAmount: number;
    maxLotSize: number;
    fatFingerEnabled: boolean;
    maxSpread: number;
    spreadLockEnabled: boolean;
    maxPositions: number;
    positionLockEnabled: boolean;
    hardLockEnabled: boolean;
    hardLockUntil: string;
    maxLatency: number;
    latencyAction: 'pause' | 'close';
    newsLockEnabled: boolean;
    newsImpactMin: string;
    whitelistEnabled: boolean;
    whitelistSymbols: string;
    tradingHoursEnabled: boolean;
    tradingStartHour: string;
    tradingEndHour: string;
    maxConsecutiveLosses: number;
    consecutiveLossLockEnabled: boolean;
    minBalance: number;
    balanceProtectionEnabled: boolean;
    equityProtectionEnabled: boolean;
    equityDrawdownPercent: number;
    twoFactorEnabled: boolean;
    twoFactorPin: string;
    correlationGuardEnabled: boolean;
    correlationPairs: string;
}

interface AuditEntry {
    id: number;
    timestamp: string;
    nivel: string;
    ativo: string;
    trava_acionada: string;
    acao_executada: string;
    detalhe_tecnico: string;
}

export const SecurityCenter: React.FC = () => {
    const [config, setConfig] = useState<SecurityConfig>({
        panicEnabled: false,
        dailyLossLock: true,
        dailyLossAmount: 250,
        targetHitLock: false,
        targetHitAmount: 500,
        maxLotSize: 2.0,
        fatFingerEnabled: true,
        maxSpread: 30,
        spreadLockEnabled: true,
        maxPositions: 5,
        positionLockEnabled: true,
        hardLockEnabled: false,
        hardLockUntil: '00:00',
        maxLatency: 150,
        latencyAction: 'pause',
        newsLockEnabled: true,
        newsImpactMin: 'HIGH',
        whitelistEnabled: false,
        whitelistSymbols: 'XAUUSD,BTCUSD,GBPUSD',
        tradingHoursEnabled: true,
        tradingStartHour: '09:00',
        tradingEndHour: '17:00',
        maxConsecutiveLosses: 3,
        consecutiveLossLockEnabled: true,
        minBalance: 100,
        balanceProtectionEnabled: true,
        equityProtectionEnabled: true,
        equityDrawdownPercent: 20,
        twoFactorEnabled: false,
        twoFactorPin: '',
        correlationGuardEnabled: false,
        correlationPairs: 'XAUUSD⇄XAGUSD,EURUSD⇄GBPUSD',
    });
    const [showPanicConfirm, setShowPanicConfirm] = useState(false);
    const [panicResult, setPanicResult] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
    const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
    const [filterLevel, setFilterLevel] = useState<string>('all');
    const [isLocked, setIsLocked] = useState(false);
    const [currentSpread, setCurrentSpread] = useState<number | null>(null);
    const [currentLatency, setCurrentLatency] = useState<number | null>(null);

    useEffect(() => {
        axios.get('/api/mt5/risk-management').then(res => {
            const d = res.data;
            setConfig(prev => ({
                ...prev,
                dailyLossLock: d?.discipline?.isLocked || false,
                dailyLossAmount: d?.discipline?.dailyStopLoss || 250,
            }));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchRealtime = async () => {
            try {
                const res = await axios.get('/api/mt5/gold-scalper/status');
                const spread = res.data?.currentSpread;
                if (spread !== undefined) setCurrentSpread(spread);
            } catch {}
            try {
                const t0 = performance.now();
                await axios.get('/api/health', { timeout: 3000 });
                setCurrentLatency(Math.round(performance.now() - t0));
            } catch {
                setCurrentLatency(null);
            }
        };
        fetchRealtime();
        const interval = setInterval(fetchRealtime, 5000);
        return () => clearInterval(interval);
    }, []);

    const handlePanic = useCallback(async () => {
        setPanicResult('executing');
        try {
            await axios.post('/api/mt5/close-all-orders');
            await axios.post('/api/mt5/cancel-pending');
            setPanicResult('success');
            setTimeout(() => { setShowPanicConfirm(false); setPanicResult('idle'); }, 2000);
        } catch {
            setPanicResult('error');
            setTimeout(() => { setPanicResult('idle'); }, 2000);
        }
    }, []);

    const toggleSetting = useCallback(async (key: keyof SecurityConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        try {
            await axios.post('/api/mt5/security/settings', { [key]: value });
        } catch {}
    }, []);

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-xl shadow-blue-500/10">
                        <Shield size={40} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Central</span> de Segurança
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${isLocked ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                                {isLocked ? 'Bloqueado' : 'Seguro'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Lock size={12} className="text-blue-400" /> Proteção institucional contra erros operacionais
                        </p>
                    </div>
                </div>
            </div>

            {/* Botão de Pânico */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-rose-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                            <AlertTriangle size={28} className="text-rose-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Botão de Pânico</h3>
                            <p className="text-xs text-slate-400 mt-1">Fecha todas as ordens a mercado e cancela ordens pendentes instantaneamente</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPanicConfirm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:from-rose-500 hover:to-rose-400 transition-all shadow-[0_0_30px_rgba(225,29,72,0.3)] hover:shadow-[0_0_50px_rgba(225,29,72,0.5)] active:scale-95"
                    >
                        <span className="flex items-center gap-2"><ArrowUpFromLine size={16} /> PÂNICO</span>
                    </button>
                </div>
            </div>

            {/* Modal Confirmação Pânico */}
            <AnimatePresence>
                {showPanicConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => { if (panicResult !== 'executing') setShowPanicConfirm(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-900 border border-rose-500/30 rounded-[2rem] p-8 max-w-md w-full shadow-[0_0_80px_rgba(225,29,72,0.15)]"
                        >
                            {panicResult === 'idle' && (
                                <>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-rose-500/10 rounded-2xl">
                                            <AlertTriangle size={32} className="text-rose-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-widest">Confirmar Pânico</h3>
                                            <p className="text-xs text-slate-400 mt-1">Esta ação é irreversível</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                                        Todas as <strong className="text-rose-400">ordens abertas</strong> serão fechadas a mercado e todas as <strong className="text-rose-400">ordens pendentes</strong> serão canceladas.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowPanicConfirm(false)}
                                            className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-slate-700 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handlePanic}
                                            className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:from-rose-500 hover:to-rose-400 transition-all shadow-[0_0_20px_rgba(225,29,72,0.3)]"
                                        >
                                            Executar Pânico
                                        </button>
                                    </div>
                                </>
                            )}
                            {panicResult === 'executing' && (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <div className="w-12 h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Executando Pânico...</span>
                                </div>
                            )}
                            {panicResult === 'success' && (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <CheckCircle2 size={48} className="text-emerald-400" />
                                    <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">Pânico Executado com Sucesso</span>
                                </div>
                            )}
                            {panicResult === 'error' && (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <XCircle size={48} className="text-rose-400" />
                                    <span className="text-sm font-black text-rose-400 uppercase tracking-widest">Erro ao Executar Pânico</span>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Grid de Travas de Segurança */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Trava de Perda Diária */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-amber-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <DollarSign size={18} className="text-amber-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Perda Diária</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('dailyLossLock', !config.dailyLossLock)}
                                className={`p-2 rounded-xl border transition-all ${config.dailyLossLock ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.dailyLossLock ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-slate-500 font-bold">$</span>
                            <input
                                type="text"
                                value={config.dailyLossAmount}
                                onChange={e => toggleSetting('dailyLossAmount', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="w-20 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-amber-400 focus:border-amber-500/50 focus:outline-none disabled:opacity-40"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Bloqueia novas posições ao atingir o drawdown máximo estipulado</p>
                        <div className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${config.dailyLossLock ? 'text-amber-400' : 'text-slate-600'}`}>
                            {config.dailyLossLock ? '🟢 Ativo' : '⚪ Inativo'}
                        </div>
                    </div>
                </div>

                {/* Trava de Meta Batida */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-emerald-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-emerald-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Meta Batida</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('targetHitLock', !config.targetHitLock)}
                                className={`p-2 rounded-xl border transition-all ${config.targetHitLock ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.targetHitLock ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-slate-500 font-bold">$</span>
                            <input
                                type="text"
                                value={config.targetHitAmount}
                                onChange={e => toggleSetting('targetHitAmount', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="w-20 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-emerald-400 focus:border-emerald-500/50 focus:outline-none disabled:opacity-40"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Bloqueio opcional ao atingir o lucro financeiro do dia</p>
                        <div className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${config.targetHitLock ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {config.targetHitLock ? '🟢 Ativo' : '⚪ Inativo'}
                        </div>
                    </div>
                </div>

                {/* Prevenção Fat Finger */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-blue-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Hand size={18} className="text-blue-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Fat Finger</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('fatFingerEnabled', !config.fatFingerEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.fatFingerEnabled ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.fatFingerEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-slate-500 font-bold">Máx</span>
                            <input
                                type="text"
                                value={config.maxLotSize}
                                onChange={e => toggleSetting('maxLotSize', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="w-20 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-blue-400 focus:border-blue-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">lotes</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Validador que barra ordens cujo lote exceda o limite máximo padrão</p>
                        <div className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${config.fatFingerEnabled ? 'text-blue-400' : 'text-slate-600'}`}>
                            {config.fatFingerEnabled ? '🟢 Ativo' : '⚪ Inativo'}
                        </div>
                    </div>
                </div>

                {/* Trava de Spread Máximo (Anti-Slippage) */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-cyan-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Zap size={18} className="text-cyan-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Spread Máximo (Anti-Slippage)</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('spreadLockEnabled', !config.spreadLockEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.spreadLockEnabled ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.spreadLockEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Spread Máx Aceitável:</span>
                            <input
                                type="text"
                                value={config.maxSpread}
                                onChange={e => toggleSetting('maxSpread', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-cyan-400 focus:border-cyan-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">pontos</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-slate-950/50 rounded-xl border border-slate-800">
                            <Activity size={14} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spread Atual:</span>
                            {currentSpread !== null ? (
                                <span className={`text-sm font-black ${currentSpread <= config.maxSpread ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {currentSpread} pts
                                </span>
                            ) : (
                                <span className="text-xs text-slate-600">—</span>
                            )}
                        </div>
                        <div className="mb-3">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ação: </span>
                            <span className="text-[10px] text-cyan-400 font-bold uppercase">🚫 Rejeitar entrada</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Impede operações em momentos de falta de liquidez ou pós-notícias</p>
                    </div>
                </div>

                {/* Limite de Operações Simultâneas (Anti-Grid de Erro) */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-violet-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Brain size={18} className="text-violet-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Posições Simultâneas</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('positionLockEnabled', !config.positionLockEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.positionLockEnabled ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.positionLockEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Máx de Posições Abertas:</span>
                            <input
                                type="text"
                                value={config.maxPositions}
                                onChange={e => toggleSetting('maxPositions', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-violet-400 focus:border-violet-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">trades</span>
                        </div>
                        <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-3">
                            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle size={12} /> Tentativas de abertura além deste limite serão descartadas
                            </p>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Previne bug/loop no código Python ou atraso no MT5 de abrir dezenas de posições no mesmo preço</p>
                    </div>
                </div>

                {/* Modo Hard Lock */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-rose-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldOff size={18} className="text-rose-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Hard Lock</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('hardLockEnabled', !config.hardLockEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.hardLockEnabled ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                <Lock size={14} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={14} className="text-slate-500" />
                            <span className="text-lg font-black italic text-slate-400">00:00</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Desativa edições de todos os limites até às 00:00 do servidor</p>
                        <div className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${config.hardLockEnabled ? 'text-rose-400' : 'text-slate-600'}`}>
                            {config.hardLockEnabled ? '🔴 Bloqueado' : '⚪ Liberado'}
                        </div>
                    </div>
                </div>

                {/* Monitor de Saúde da Conexão (Ping e Latência) */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-green-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Wifi size={18} className="text-green-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Saúde da Conexão</span>
                            </div>
                            <RefreshCw size={14} className="text-slate-600 animate-[spin_2s_linear_infinite]" />
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Latência Máx (ms):</span>
                            <input
                                type="text"
                                value={config.maxLatency}
                                onChange={e => toggleSetting('maxLatency', Number(e.target.value))}
                                disabled={config.hardLockEnabled}
                                className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-green-400 focus:border-green-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">ms</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-slate-950/50 rounded-xl border border-slate-800">
                            <Radio size={14} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conexão Atual:</span>
                            {currentLatency !== null ? (
                                <span className={`flex items-center gap-1.5 text-sm font-black ${
                                    currentLatency < 50 ? 'text-emerald-400' :
                                    currentLatency < config.maxLatency ? 'text-amber-400' : 'text-rose-400'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${
                                        currentLatency < 50 ? 'bg-emerald-400' :
                                        currentLatency < config.maxLatency ? 'bg-amber-400' : 'bg-rose-400'
                                    }`} />
                                    {currentLatency} ms
                                    <span className="text-[8px] text-slate-500 font-normal normal-case">
                                        ({currentLatency < 50 ? 'excelente' : currentLatency < config.maxLatency ? 'moderado' : 'crítico'})
                                    </span>
                                </span>
                            ) : (
                                <span className="text-xs text-rose-400 font-bold">🔴 Sem conexão</span>
                            )}
                        </div>
                        <div className="mb-3">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ação em caso de atraso: </span>
                            <div className="flex gap-3 mt-1">
                                <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                                    config.latencyAction === 'pause'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                }`}>
                                    <input
                                        type="radio"
                                        name="latencyAction"
                                        checked={config.latencyAction === 'pause'}
                                        onChange={() => toggleSetting('latencyAction', 'pause')}
                                        className="sr-only"
                                    />
                                    <span className="text-[10px] font-bold uppercase">Pausar Entradas</span>
                                </label>
                                <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                                    config.latencyAction === 'close'
                                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                }`}>
                                    <input
                                        type="radio"
                                        name="latencyAction"
                                        checked={config.latencyAction === 'close'}
                                        onChange={() => toggleSetting('latencyAction', 'close')}
                                        className="sr-only"
                                    />
                                    <span className="text-[10px] font-bold uppercase">Fechar Posições</span>
                                </label>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Impede operações "cegas" com preços desatualizados por lentidão na VPS</p>
                    </div>
                </div>

                {/* Trava de Notícias */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-orange-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Newspaper size={18} className="text-orange-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Trava de Notícias</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('newsLockEnabled', !config.newsLockEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.newsLockEnabled ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.newsLockEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Impacto Mín:</span>
                            <select
                                value={config.newsImpactMin}
                                onChange={e => toggleSetting('newsImpactMin', e.target.value)}
                                disabled={config.hardLockEnabled}
                                className="bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-orange-400 focus:border-orange-500/50 focus:outline-none disabled:opacity-40 cursor-pointer"
                            >
                                <option value="HIGH">Alto</option>
                                <option value="MEDIUM">Médio</option>
                                <option value="LOW">Baixo</option>
                            </select>
                        </div>
                        <div className="px-3 py-2 bg-slate-950/50 rounded-xl border border-slate-800 mb-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status: </span>
                            <span className="text-[10px] text-emerald-400 font-bold uppercase">📰 Monitorando calendário</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Bloqueia operações durante eventos de alto impacto (CPI, FOMC, NFP)</p>
                    </div>
                </div>

                {/* Whitelist de Símbolos */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-teal-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-teal-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ListChecks size={18} className="text-teal-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Whitelist de Símbolos</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('whitelistEnabled', !config.whitelistEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.whitelistEnabled ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.whitelistEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={config.whitelistSymbols}
                            onChange={e => toggleSetting('whitelistSymbols', e.target.value)}
                            disabled={config.hardLockEnabled || !config.whitelistEnabled}
                            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-400 focus:border-teal-500/50 focus:outline-none disabled:opacity-40 mb-3"
                            placeholder="XAUUSD,BTCUSD,GBPUSD"
                        />
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {config.whitelistSymbols.split(',').map(s => s.trim()).filter(Boolean).map(sym => (
                                <span key={sym} className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-md text-[9px] font-bold text-teal-400 uppercase tracking-wider">{sym}</span>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Impede abrir posição em símbolo errado por engano</p>
                    </div>
                </div>

                {/* Horário de Funcionamento */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-indigo-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Timer size={18} className="text-indigo-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Horário de Funcionamento</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('tradingHoursEnabled', !config.tradingHoursEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.tradingHoursEnabled ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.tradingHoursEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-bold">De</span>
                                <input
                                    type="time"
                                    value={config.tradingStartHour}
                                    onChange={e => toggleSetting('tradingStartHour', e.target.value)}
                                    disabled={config.hardLockEnabled}
                                    className="bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-indigo-400 focus:border-indigo-500/50 focus:outline-none disabled:opacity-40"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-bold">Até</span>
                                <input
                                    type="time"
                                    value={config.tradingEndHour}
                                    onChange={e => toggleSetting('tradingEndHour', e.target.value)}
                                    disabled={config.hardLockEnabled}
                                    className="bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-indigo-400 focus:border-indigo-500/50 focus:outline-none disabled:opacity-40"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Fora da janela definida o robô não opera automaticamente</p>
                    </div>
                </div>

                {/* Perdas Consecutivas */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-rose-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={18} className="text-rose-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Perdas Consecutivas</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('consecutiveLossLockEnabled', !config.consecutiveLossLockEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.consecutiveLossLockEnabled ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.consecutiveLossLockEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Máx de Losses:</span>
                            <input
                                type="text"
                                value={config.maxConsecutiveLosses}
                                onChange={e => toggleSetting('maxConsecutiveLosses', Number(e.target.value))}
                                disabled={config.hardLockEnabled}
                                className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-rose-400 focus:border-rose-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">seguidos</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Pausa todos os robôs automaticamente após X losses consecutivos</p>
                    </div>
                </div>

                {/* Proteção de Saldo */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-yellow-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <PiggyBank size={18} className="text-yellow-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Proteção de Saldo</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('balanceProtectionEnabled', !config.balanceProtectionEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.balanceProtectionEnabled ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.balanceProtectionEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Saldo Mín:</span>
                            <input
                                type="text"
                                value={config.minBalance}
                                onChange={e => toggleSetting('minBalance', Number(e.target.value))}
                                disabled={config.hardLockEnabled}
                                className="w-20 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-yellow-400 focus:border-yellow-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">USD</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Se o saldo atingir este valor, todas as operações são encerradas e robôs desligados</p>
                    </div>
                </div>

                {/* Equity Protector */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-fuchsia-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <EqualNot size={18} className="text-fuchsia-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Equity Protector</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('equityProtectionEnabled', !config.equityProtectionEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.equityProtectionEnabled ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.equityProtectionEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">Drawdown Equity:</span>
                            <input
                                type="text"
                                value={config.equityDrawdownPercent}
                                onChange={e => toggleSetting('equityDrawdownPercent', Number(e.target.value))}
                                disabled={config.hardLockEnabled}
                                className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-fuchsia-400 focus:border-fuchsia-500/50 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Trava baseada no equity (saldo + lucro flutuante), não apenas no saldo</p>
                    </div>
                </div>

                {/* Confirmação 2FA */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-pink-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-pink-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <KeyRound size={18} className="text-pink-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Confirmação 2FA</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('twoFactorEnabled', !config.twoFactorEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.twoFactorEnabled ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.twoFactorEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-500 font-bold">PIN:</span>
                            <input
                                type="password"
                                value={config.twoFactorPin}
                                onChange={e => toggleSetting('twoFactorPin', e.target.value)}
                                disabled={config.hardLockEnabled || !config.twoFactorEnabled}
                                maxLength={6}
                                className="w-24 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-lg font-black italic text-pink-400 focus:border-pink-500/50 focus:outline-none disabled:opacity-40 placeholder:text-slate-700"
                                placeholder="******"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Exige PIN secundário para Pânico, alterar limites e desligar travas</p>
                    </div>
                </div>

                {/* Correlation Guard */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/5 hover:border-sky-500/20 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Ban size={18} className="text-sky-400" />
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Correlation Guard</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('correlationGuardEnabled', !config.correlationGuardEnabled)}
                                className={`p-2 rounded-xl border transition-all ${config.correlationGuardEnabled ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}
                            >
                                {config.correlationGuardEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={config.correlationPairs}
                            onChange={e => toggleSetting('correlationPairs', e.target.value)}
                            disabled={config.hardLockEnabled || !config.correlationGuardEnabled}
                            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-sky-400 focus:border-sky-500/50 focus:outline-none disabled:opacity-40 mb-3"
                            placeholder="XAUUSD⇄XAGUSD,EURUSD⇄GBPUSD"
                        />
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {config.correlationPairs.split(',').filter(Boolean).map(pair => (
                                <span key={pair} className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 rounded-md text-[9px] font-bold text-sky-400 uppercase tracking-wider">{pair}</span>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Bloqueia pares opostos simultâneos (ex: comprar XAUUSD e vender XAGUSD)</p>
                    </div>
                </div>
            </div>

            {/* Histórico de Auditoria */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Terminal size={18} className="text-blue-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Histórico de Auditoria</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={filterLevel}
                            onChange={e => setFilterLevel(e.target.value)}
                            className="bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 focus:border-blue-500/50 focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todos</option>
                            <option value="🔴">Crítico</option>
                            <option value="🟡">Atenção</option>
                            <option value="🟢">Sucesso</option>
                        </select>
                        <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
                            <Download size={14} />
                        </button>
                    </div>
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {auditLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText size={32} className="text-slate-700 mx-auto mb-3" />
                            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Nenhum registro de auditoria encontrado</p>
                            <p className="text-[10px] text-slate-700 mt-1">Os eventos de segurança aparecerão aqui automaticamente</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] text-slate-600 font-bold uppercase tracking-widest border-b border-slate-800">
                                    <th className="pb-3 pr-4">Timestamp</th>
                                    <th className="pb-3 pr-4">Nível</th>
                                    <th className="pb-3 pr-4">Ativo</th>
                                    <th className="pb-3 pr-4">Trava</th>
                                    <th className="pb-3 pr-4">Ação</th>
                                    <th className="pb-3 pr-4">Detalhe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.filter(e => filterLevel === 'all' || e.nivel === filterLevel).map(entry => (
                                    <tr key={entry.id} className="text-xs text-slate-400 border-b border-slate-800/50 hover:bg-white/[0.02]">
                                        <td className="py-3 pr-4 font-mono text-[10px] text-slate-500">{entry.timestamp}</td>
                                        <td className="py-3 pr-4">{entry.nivel}</td>
                                        <td className="py-3 pr-4 font-bold">{entry.ativo}</td>
                                        <td className="py-3 pr-4">{entry.trava_acionada}</td>
                                        <td className="py-3 pr-4">{entry.acao_executada}</td>
                                        <td className="py-3 pr-4 text-[10px] text-slate-500">{entry.detalhe_tecnico}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
