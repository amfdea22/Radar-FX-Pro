import React, { useState, useEffect, useRef } from 'react';
import {
    Power, Settings, TrendingUp, TrendingDown, Minus, Plus, Activity,
    Shield, Target, Layers, Clock, AlertTriangle, RefreshCw,
    Zap, CalendarDays, BarChart3, ArrowUpDown, DollarSign, Trophy, XCircle, Percent, Flame,
    Wallet, ShieldAlert, Calculator, Cpu, Brain, Crosshair, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import GoldScalperTradeMonitor from './GoldScalperTradeMonitor';
interface GoldScalperStatus {
    enabled: boolean;
    settings: {
        enabled: boolean;
        lotSize: number;
        gridLevels: number;
        gridDistance: number;
        gridMultiplier: number;
        trailingStart: number;
        trailingStop: number;
        trailingStep: number;
        breakEvenTrigger: number;
        breakEvenOffset: number;
        takeProfitUSD: number;
        stopLossUSD: number;
        useFixedTP?: boolean;
        useFixedSL?: boolean;
        basketTP: number;
        basketSL: number;
        basketTPEnabled?: boolean;
        basketSLEnabled?: boolean;
        maxDailyLoss: number;
        maxDailyProfit: number;
        sessionFilter: boolean;
        direction: 'BOTH' | 'BUY' | 'SELL';
        cooldownSeconds: number;
        maxSpreadPoints: number;
        newsGuardEnabled: boolean;
        strategyMode: 'CONSERVATIVE' | 'NORMAL' | 'AGGRESSIVE';
        dynamicATRMode?: boolean;
        dynamicStopLoss?: boolean;
        dynamicSLMultiplier?: number;
        smartBreakeven?: boolean;
        swingTrendFilter?: boolean;
        antiMartingale?: boolean;
        orderBlockFilter?: boolean;
        smartGridIA?: boolean;
        smartTargeting?: boolean;
        smartTrailing?: boolean;
        atrTrailingPeriod?: number;
        atrTrailingMultiplier?: number;
        atrTrailingTimeframe?: string;
        dxyFilter?: boolean;
        sentimentFilter?: boolean;
        rsiFilter?: boolean;
        volumeFilter?: boolean;
        trendFiltroM5?: boolean;
        trendFiltroM1?: boolean;
        useRiskPercentage?: boolean;
        riskPercentage?: number;
        smartNeuroIA?: boolean;
        neuroConvergence?: boolean; // NOVO v4.0
        smartAdaptiveIA?: boolean;
        sniperMode?: boolean; // NOVO
        strategy?: 'USD' | 'SMC';
        smcOnly?: boolean;
        basketModeEnabled?: boolean;
        trailingStopGrid?: boolean;
        timeExitMinutes?: number;
        ma200CrossExit?: boolean;
    };
    resolvedSymbol: string;
    currentSpread: number;
    microTrend: 'UP' | 'DOWN' | 'FLAT';
    m1Trend?: 'UP' | 'DOWN' | 'FLAT' | 'OFF';
    m5Trend?: 'UP' | 'DOWN' | 'FLAT' | 'OFF';
    m5Strength?: number;
    m5Gap?: number;
    m5Vol?: number;
    predictions?: {
        m1: { direction: 'UP' | 'DOWN' | 'FLAT', confidence: number };
        m5: { direction: 'UP' | 'DOWN' | 'FLAT', confidence: number };
        m15: { direction: 'UP' | 'DOWN' | 'FLAT', confidence: number };
        h1: { direction: 'UP' | 'DOWN' | 'FLAT', confidence: number };
    };
    dxyTrend?: string;
    sentiment?: { long: number, short: number };
    rsi?: number;
    volume?: number;
    iaScore?: number;
    dailyProfit: number;
    dailyLoss: number;
    iaLearning?: {
        minScore: number;
        totalAnalyzed: number;
        lastOptimized: number;
    };
    isKillZone: boolean;
    isCoolingOff: boolean;
    coolOffRemainingMs: number;
    floatingProfit?: number;
    openPositions?: number;
    netDailyProfit?: number;
    accountBalance?: number;
    accountDailyProfit?: number;
    cortexHumor?: string;
    decisionPillars?: {
        trend: number;
        dxy: number;
        rsi: number;
        volume: number;
    };
    dxyDivergence?: { status: string; correlation: number };
    drawdownHeatmap?: { percent: number; status: string; floating: number };
    operationLog: Array<{ time: string; action: string; details: string }>;
    smc?: {
        market_structure?: { trend: string; bos: Array<{ type: string; price: number }> };
        order_blocks?: { bullish: Array<{ price: number; strength: number }>; bearish: Array<{ price: number; strength: number }> };
        fvg?: { bullish: Array<{ mid: number; size: number }>; bearish: Array<{ mid: number; size: number }> };
        liquidity?: { highs: number[]; lows: number[] };
    };
    smcLevels?: {
        market_trend: string;
        tp1: number;
        tp2: number;
        sl: number;
        bos_count: number;
        atr: number;
        partial_level: number;
        risk_distance: number;
    } | null;
    basket?: {
        net: number;
        tp: number;
        sl: number;
        progress: number;
    };
    ma200?: number;
    ma200_M15?: number;
    ma200_M5?: number;
    ma14?: number;
    ma21?: number;
    ma50?: number;
    ma100?: number;
    currentPrice?: number;
    ma200Ready?: boolean;
}

interface TradeReport {
    summary: {
        totalTrades: number;
        wins: number;
        losses: number;
        ties?: number;
        winRate: number;
        totalProfit: number;
        avgWin: number;
        avgLoss: number;
        profitFactor: number;
        bestTrade: number;
        worstTrade: number;
        currentStreak: number;
        streakType: 'WIN' | 'LOSS' | 'NONE';
    };
    robotSummary: {
        totalTrades: number;
        wins: number;
        losses: number;
        ties?: number;
        winRate: number;
        totalProfit: number;
        avgWin: number;
        avgLoss: number;
        profitFactor: number;
        bestTrade: number;
        worstTrade: number;
        currentStreak: number;
        streakType: 'WIN' | 'LOSS' | 'NONE';
    };
    trades: Array<{
        id: string;
        ticket: number;
        type: 'BUY' | 'SELL';
        lot: number;
        entryPrice: number;
        exitPrice: number;
        profit: number;
        result: 'WIN' | 'LOSS' | 'TIE';
        gridLevel: number;
        closeReason: string;
        closeTime: string;
    }>;
}

// COMPONENTE PREMIUM DE TOOLTIP (PADRÃO DARK)
const InfoTooltip: React.FC<{ header: string, content: React.ReactNode, children: React.ReactNode }> = ({ header, content, children }) => (
    <div className="group relative">
        {children}
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] backdrop-blur-xl pointer-events-none">
            <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <Brain size={14} className="text-blue-400" />
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter">{header}</span>
                </div>
                <div className="text-[9px] text-slate-300 leading-relaxed font-medium">
                    {content}
                </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
        </div>
    </div>
);

// NOVO COMPONENTE: CONTADOR DE VELA
const CandleCountdown: React.FC<{ tf: 'M1' | 'M5' | 'M15' | 'H1' }> = ({ tf }) => {
    const [timeLeft, setTimeLeft] = useState('--:--');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const s = now.getSeconds();
            const m = now.getMinutes();
            
            if (tf === 'M1') {
                const remS = 60 - s;
                setTimeLeft(`00:${remS.toString().padStart(2, '0')}`);
            } else if (tf === 'M5') {
                const remM = 4 - (m % 5);
                const remS = 60 - s;
                setTimeLeft(`0${remM}:${remS.toString().padStart(2, '0')}`);
            } else if (tf === 'M15') {
                const remM = 14 - (m % 15);
                const remS = 60 - s;
                setTimeLeft(`${remM.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`);
            } else {
                const remM = 59 - m;
                const remS = 60 - s;
                setTimeLeft(`${remM.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [tf]);

    return (
        <div className="flex items-center justify-center bg-slate-950/80 border border-white/10 rounded-md mt-1.5 px-2 py-1 min-w-[38px] shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-800/50 to-transparent pointer-events-none" />
            <div className="flex items-center gap-1 relative z-10">
                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_5px_#06b6d4]" />
                <span className="text-[8px] font-mono font-black text-cyan-50 tracking-widest drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{timeLeft}</span>
            </div>
        </div>
    );
};

// NOVO COMPONENTE: RELÓGIO DE TENDÊNCIA (TREND GAUGE)
const TrendClock: React.FC<{ m1: string, m5: string, m5Strength: number }> = ({ m1, m5, m5Strength }) => {
    const [mode, setMode] = useState<'M1' | 'M5' | 'M15' | 'H1'>('M5');
    
    // Calcula o score baseado no modo selecionado e arredonda
    const getScore = () => {
        let raw = 0;
        if (mode === 'M5') {
            raw = m5 === 'UP' ? m5Strength : m5 === 'DOWN' ? -m5Strength : 0;
        } else if (mode === 'M1') {
            raw = m1 === 'UP' ? 75 : m1 === 'DOWN' ? -75 : 0;
        } else if (mode === 'M15') {
            raw = m5 === 'UP' ? Math.round(m5Strength * 0.7) : m5 === 'DOWN' ? -Math.round(m5Strength * 0.7) : 0;
        } else if (mode === 'H1') {
            raw = m5 === 'UP' ? Math.round(m5Strength * 0.5) : m5 === 'DOWN' ? -Math.round(m5Strength * 0.5) : 0;
        }
        return Math.max(-100, Math.min(100, Math.round(raw)));
    };

    const score = getScore();
    const rotation = (score / 100) * 90;

    const labelMap: Record<string, string> = {
        M1: 'Micro-Trend Tick',
        M5: 'Trend Estrutural',
        M15: 'Trend M15',
        H1: 'Trend H1',
    };

    return (
        <div className="relative flex flex-col items-center bg-slate-900/60 p-5 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-2xl w-52 shrink-0 overflow-hidden group transition-all hover:border-amber-500/20">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50"></div>
            
            {/* Modo Selector - Floating Style */}
            <div className="flex gap-1 mb-4 relative z-10 bg-black/40 p-1 rounded-xl border border-white/5">
                {(['M1', 'M5', 'M15', 'H1'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-3 py-1 rounded-lg text-[8px] font-black tracking-widest transition-all ${
                            mode === m 
                                ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div className="relative w-40 h-20 overflow-hidden mb-2">
                {/* % Labels */}
                <div className="absolute top-2 left-1 text-[7px] font-black text-rose-500 opacity-70">-100%</div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] font-black text-slate-500 opacity-70">0%</div>
                <div className="absolute top-2 right-1 text-[7px] font-black text-emerald-500 opacity-70">+100%</div>

                {/* Gauge Background */}
                <svg className="w-full h-full transform translate-y-4">
                    <path 
                        d="M 15 75 A 65 65 0 0 1 145 75" 
                        fill="none" 
                        stroke="#1e293b" 
                        strokeWidth="14" 
                        strokeLinecap="round"
                    />
                    <path 
                        d="M 15 75 A 65 65 0 0 1 145 75" 
                        fill="none" 
                        stroke={`url(#gaugeGradient)`}
                        strokeWidth="14" 
                        strokeLinecap="round"
                        strokeDasharray="210"
                        strokeDashoffset={210 - (210 * (score + 100) / 200)}
                        className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f43f5e" />
                            <stop offset="50%" stopColor="#475569" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center Point */}
                <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)] z-30 ring-4 ring-slate-900"></div>

                {/* Needle */}
                <motion.div 
                    animate={{ rotate: rotation }}
                    transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                    style={{ originX: '50%', originY: '100%' }}
                    className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-1.5 h-16 bg-gradient-to-t from-white to-slate-200 rounded-full z-20 shadow-2xl"
                />
            </div>

            <div className="flex flex-col items-center gap-1 relative z-10 mt-1">
                <span className={`text-2xl font-black italic tracking-tighter drop-shadow-md ${score > 30 ? 'text-emerald-400' : score < -30 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {score > 0 ? '+' : ''}{score}%
                </span>
            </div>
            
            {/* Glow effect matching trend */}
            <div className={`absolute -bottom-10 w-24 h-24 blur-3xl opacity-30 transition-colors duration-1000 ${score > 30 ? 'bg-emerald-500' : score < -30 ? 'bg-rose-600' : 'bg-transparent'}`}></div>

            <span className="text-[7px] font-black uppercase text-slate-500 tracking-[0.3em] mt-1 opacity-60">
                {labelMap[mode]}
            </span>
        </div>
    );
};

export const GoldScalperPanel: React.FC = () => {
    const [status, setStatus] = useState<GoldScalperStatus | null>(null);
    const [report, setReport] = useState<TradeReport | null>(null);
    const [account, setAccount] = useState<{ balance?: number } | null>(null);
    const [globalDailyProfit, setGlobalDailyProfit] = useState<number | null>(null);
    const [isDisciplineLocked, setIsDisciplineLocked] = useState(false);
    const [disciplineTarget, setDisciplineTarget] = useState(0);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Alertas Web Audio & Toast
    const [uiAlert, setUiAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [tradeStatus, setTradeStatus] = useState<{ BUY: 'idle' | 'loading' | 'success' | 'error', SELL: 'idle' | 'loading' | 'success' | 'error' }>({ BUY: 'idle', SELL: 'idle' });
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [masCollapsed, setMasCollapsed] = useState(false);
    const [tradeMonitorCollapsed, setTradeMonitorCollapsed] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<any[] | null>(null);
    const [loadingCalendar, setLoadingCalendar] = useState(false);
    const robot = report?.robotSummary;
    const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    const prevEnabled = useRef<boolean | null>(null);
    const prevWins = useRef<number | null>(null);
    const prevLosses = useRef<number | null>(null);
    const playSuccessSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { console.warn("Audio disabled"); }
    };

    const playErrorSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { }
    };

    const playCoinSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const t = ctx.currentTime;
            
            // Jingle de Vitória (Arpejo Maior: C5 -> E5 -> G5 -> C6)
            const notes = [
                { f: 523.25, time: 0 },    // C5
                { f: 659.25, time: 0.1 },  // E5
                { f: 783.99, time: 0.2 },  // G5
                { f: 1046.50, time: 0.3 }  // C6 (Clímax de vitória)
            ];

            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'triangle'; // Timbre doce, lembrando jogos / aprovação
                osc.frequency.setValueAtTime(note.f, t + note.time);
                
                gain.gain.setValueAtTime(0, t + note.time);
                gain.gain.linearRampToValueAtTime(0.3, t + note.time + 0.03); // Ataque suave
                
                if (note.time === 0.3) {
                    // Nota final ressoa bastante como vitória
                    const oscBell = ctx.createOscillator();
                    oscBell.type = 'sine';
                    oscBell.frequency.setValueAtTime(note.f, t + note.time);
                    oscBell.connect(gain);
                    oscBell.start(t + note.time);
                    oscBell.stop(t + note.time + 1.5);
                    
                    gain.gain.exponentialRampToValueAtTime(0.001, t + note.time + 1.2);
                } else {
                    // Notas da escada rápidas
                    gain.gain.exponentialRampToValueAtTime(0.001, t + note.time + 0.15);
                }
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(t + note.time);
                osc.stop(t + note.time + (note.time === 0.3 ? 1.5 : 0.15));
            });
        } catch (e) { console.warn("Audio error:", e) }
    };

    const playLoserSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const t = ctx.currentTime;
            
            // Efeito de Derrota Moderno (Power Down / Queda de Sistema Eletrônico)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sawtooth'; // Timbre eletrônico e grave
            
            // Deslize brusco das frequências (como um desligamento ou energia caindo)
            osc.frequency.setValueAtTime(350, t);
            osc.frequency.exponentialRampToValueAtTime(20, t + 0.9);
            
            // Controle de volume seco e abrupto
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.05); // Impacto rápido
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9); // Morre junto com o grave
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(t);
            osc.stop(t + 1.0);
        } catch (e) { console.warn("Audio error:", e) }
    };

    const fetchStatus = async () => {
        try {
            const resp = await axios.get('/api/mt5/gold-scalper/status');
            setStatus(resp.data);
            setLoading(false);
        } catch (err) {
            console.error('Gold Scalper fetch error:', err);
        }
    };

    const fetchReport = async () => {
        try {
            const resp = await axios.get('/api/mt5/gold-scalper/report');
            setReport(resp.data);
        } catch (err) {
            console.error('Gold Scalper report error:', err);
        }
    };

    const fetchAccount = async () => {
        try {
            const [accResp, discResp] = await Promise.all([
                axios.get('/api/mt5/account'),
                axios.get('/api/mt5/discipline').catch(() => ({ data: { profit: 0 } }))
            ]);
            setAccount(accResp.data);
            setGlobalDailyProfit(discResp.data?.profit || 0);
            setIsDisciplineLocked(discResp.data?.isLocked || false);
            setDisciplineTarget(discResp.data?.target || 0);
        } catch (err) {
            console.error('Account fetch error:', err);
        }
    };

    const handleUnlock = async () => {
        if (!window.confirm('Atenção: Ao destravar o sistema, você assume o risco de operar além dos limites de segurança estabelecidos. Deseja continuar?')) return;
        setSyncing(true);
        try {
            await axios.post('/api/mt5/discipline/reset');
            await fetchAccount();
            playSuccessSound();
            setUiAlert({ type: 'success', message: 'Sistema Destravado!' });
        } catch (e) {
            playErrorSound();
            setUiAlert({ type: 'error', message: 'Falha ao destravar sistema.' });
        } finally {
            setSyncing(false);
            setTimeout(() => setUiAlert(null), 3000);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchReport();
        fetchAccount();
        const interval = setInterval(() => {
            fetchStatus();
            fetchAccount();
        }, 3000);
        const reportInterval = setInterval(fetchReport, 10000);
        return () => { clearInterval(interval); clearInterval(reportInterval); };
    }, []);
    useEffect(() => {
        if (!status) return;

        // Detecta se o robô foi desligado automaticamente pela trava de risco
        if (prevEnabled.current === true && status.settings.enabled === false) {
            if (status.dailyProfit >= status.settings.maxDailyProfit && status.settings.maxDailyProfit > 0) {
                playSuccessSound();
                setUiAlert({ type: 'success', message: `TOP WIN Alcançado: $${status.dailyProfit.toFixed(2)} ` });
                setTimeout(() => setUiAlert(null), 5000);
            } else if (Math.abs(status.dailyLoss) >= status.settings.maxDailyLoss && status.settings.maxDailyLoss > 0) {
                playErrorSound();
                setUiAlert({ type: 'error', message: `STOP LOSS Atingido: -$${Math.abs(status.dailyLoss).toFixed(2)} ` });
                setTimeout(() => setUiAlert(null), 5000);
            }
        }

        prevEnabled.current = status.settings.enabled;
    }, [status]);

    useEffect(() => {
        if (!report) return;
        // Monitoramos apenas os ganhos/perdas do ROBÔ para disparar alertas sonoros/visuais
        const robotWins = report.robotSummary?.wins ?? 0;
        
        if (prevWins.current !== null && robotWins > prevWins.current) {
            playCoinSound();
            setUiAlert(prev => prev?.message.includes('TOP WIN') ? prev : { type: 'success', message: '💸 GOLD SCALPER: GAIN REGISTRADO! 💸' });
            setTimeout(() => setUiAlert(null), 4000);
        }
        prevWins.current = robotWins;

        const robotLosses = report.robotSummary?.losses ?? 0;
        if (prevLosses.current !== null && robotLosses > prevLosses.current) {
            playLoserSound();
            setUiAlert(prev => prev?.message.includes('STOP LOSS') ? prev : { type: 'error', message: '❌ GOLD SCALPER: LOSS REGISTRADO. ❌' });
            setTimeout(() => setUiAlert(null), 4000);
        }
        prevLosses.current = robotLosses;
    }, [report]);

    // Auto-scroll do terminal quando novos logs chegarem
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [status?.operationLog?.length]);

    const updateSetting = async (key: string, value: any) => {
        try {
            await axios.post('/api/mt5/gold-scalper/settings', { [key]: value });
            fetchStatus();
        } catch (err) {
            console.error('Failed to update setting:', err);
        }
    };

    const updateSettings = async (settings: Record<string, any>) => {
        try {
            await axios.post('/api/mt5/gold-scalper/settings', settings);
            fetchStatus();
        } catch (err) {
            console.error('Failed to update settings:', err);
        }
    };

    const toggleEnabled = () => {
        updateSetting('enabled', !status?.settings.enabled);
    };

    const handleManualTrade = async (direction: 'BUY' | 'SELL') => {
        if (!status?.settings.enabled) {
            setUiAlert({ type: 'error', message: 'Ative o robô primeiro!' });
            setTimeout(() => setUiAlert(null), 3000);
            return;
        }

        if (syncing) return;
        setSyncing(true);
        setTradeStatus(prev => ({ ...prev, [direction]: 'loading' }));
        try {
            const resp = await axios.post('/api/mt5/gold-scalper/trade', { direction });
            if (resp.data.success) {
                playSuccessSound();
                setUiAlert({ type: 'success', message: resp.data.message });
                setTradeStatus(prev => ({ ...prev, [direction]: 'success' }));
                fetchStatus();
            } else {
                playErrorSound();
                setUiAlert({ type: 'error', message: resp.data.message });
                setTradeStatus(prev => ({ ...prev, [direction]: 'error' }));
            }
        } catch (err) {
            playErrorSound();
            setUiAlert({ type: 'error', message: 'Erro na conexão com o servidor.' });
            setTradeStatus(prev => ({ ...prev, [direction]: 'error' }));
        } finally {
            setSyncing(false);
            setTimeout(() => setUiAlert(null), 4000);
            setTimeout(() => setTradeStatus(prev => ({ ...prev, [direction]: 'idle' })), 2500);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const resp = await axios.post('/api/mt5/gold-scalper/sync');
            if (resp.data?.report) {
                setReport(resp.data.report);
                const synced = resp.data.synced || 0;
                const total = resp.data.total || 0;
                setUiAlert({ type: 'success', message: `Sincronizado: ${synced} novo(s) · Total: ${total} trades` });
            } else {
                await fetchReport();
                setUiAlert({ type: 'success', message: 'Relatório atualizado' });
            }
            await fetchStatus();
            await fetchAccount();
        } catch (err) {
            console.error('Sync error:', err);
            setUiAlert({ type: 'error', message: 'Erro ao sincronizar. Verifique conexão MT5.' });
        }
        setSyncing(false);
        setTimeout(() => setUiAlert(null), 4000);
    };

    const handleReset = async () => {
        if (!window.confirm('Deseja realmente resetar os contadores de meta diária? Isso permitirá que o robô continue operando ignorando os lucros/perdas atuais do dia.')) return;
        setSyncing(true);
        try {
            await axios.post('/api/mt5/gold-scalper/reset');
            await fetchStatus();
            window.alert('Meta diária resetada! Robô reativado.');
        } catch (e) {
            window.alert('Falha ao resetar meta.');
        } finally {
            setSyncing(false);
        }
    };
    
    const handleResetTrades = async () => {
        if (!window.confirm('Deseja realmente resetar todo o histórico de trades do Gold Scalper? Esta ação não pode ser desfeita.')) return;
        setSyncing(true);
        try {
            await axios.post('/api/mt5/gold-scalper/reset-trades');
            await fetchReport();
            window.alert('Histórico de trades resetado com sucesso!');
        } catch (e) {
            window.alert('Falha ao resetar histórico de trades.');
        } finally {
            setSyncing(false);
        }
    };

    const printTradeReport = () => {
        if (!report || !robot || report.trades.length === 0) return;

        const doc = new jsPDF();
        const now = new Date().toLocaleString('pt-BR');

        // Title
        doc.setFontSize(18);
        doc.setTextColor(245, 158, 11);
        doc.text('RADAR-FX: GOLD SCALPER - RELATÓRIO DE TRADES', 14, 22);

        // Date/time
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Gerado em: ${now}`, 14, 30);

        // Summary section
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('RESUMO DO ROBÔ', 14, 40);

        const summaryHeaders = [['Indicador', 'Valor']];
        const summaryData = [
            ['Total de Trades', String(robot.totalTrades)],
            ['% Acerto', `${robot.winRate}%`],
            ['Lucro Total', `$${robot.totalProfit.toFixed(2)}`],
            ['Profit Factor', String(robot.profitFactor)],
            ['Média Win', `$${robot.avgWin.toFixed(2)}`],
            ['Média Loss', `$${robot.avgLoss.toFixed(2)}`],
            ['Melhor Trade', `$${robot.bestTrade.toFixed(2)}`],
            ['Pior Trade', `$${robot.worstTrade.toFixed(2)}`],
            ['Streak Atual', `${robot.currentStreak}x ${robot.streakType}`]
        ];

        autoTable(doc, {
            head: summaryHeaders,
            body: summaryData,
            startY: 44,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40, halign: 'right' } }
        });

        // Trade History Table
        const finalY = (doc as any).lastAutoTable.finalY || 44;
        doc.setFontSize(11);
        doc.text('HISTÓRICO DE TRADES', 14, finalY + 12);

        const tradeHeaders = [['Resultado', 'Ticket', 'Tipo', 'Lote', 'Entrada', 'Saída', 'P&L', 'Motivo', 'Grid', 'Data/Hora']];
        const tradeData = report.trades.map(t => [
            t.result,
            `#${t.ticket}`,
            t.type,
            String(t.lot),
            t.entryPrice?.toFixed(2) || '-',
            t.exitPrice?.toFixed(2) || '-',
            `${t.profit >= 0 ? '+' : ''}$${t.profit?.toFixed(2)}`,
            t.closeReason || '-',
            `L${t.gridLevel}`,
            t.closeTime ? new Date(t.closeTime).toLocaleString('pt-BR') : '-'
        ]);

        autoTable(doc, {
            head: tradeHeaders,
            body: tradeData,
            startY: finalY + 16,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 18 },
                2: { cellWidth: 12 },
                3: { cellWidth: 10 },
                4: { cellWidth: 20 },
                5: { cellWidth: 20 },
                6: { cellWidth: 22 },
                7: { cellWidth: 25 },
                8: { cellWidth: 10 },
                9: { cellWidth: 35 }
            },
            didDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 0) {
                    const val = String(data.cell.raw);
                    if (val === 'WIN') {
                        data.cell.styles.textColor = [52, 211, 153];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val === 'LOSS') {
                        data.cell.styles.textColor = [251, 113, 133];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
                if (data.section === 'body' && data.column.index === 6) {
                    const val = String(data.cell.raw);
                    if (val.startsWith('+')) {
                        data.cell.styles.textColor = [52, 211, 153];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val.startsWith('-')) {
                        data.cell.styles.textColor = [251, 113, 133];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Radar-FX Gold Scalper | Relatório de Trades | Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
        }

        doc.save(`Gold_Scalper_Trades_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const handleOpenCalendar = async () => {
        setShowCalendar(true);
        if (!calendarEvents) {
            setLoadingCalendar(true);
            try {
                const resp = await axios.get('/api/mt5/gold-scalper/calendar');
                setCalendarEvents(resp.data);
            } catch (e) {
                console.error('Calendar error:', e);
            }
            setLoadingCalendar(false);
        }
    };

    const handleManualLockToggle = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            if (status?.isCoolingOff) {
                await axios.post('/api/mt5/gold-scalper/unlock');
                playSuccessSound();
                setUiAlert({ type: 'success', message: 'Filtro de Segurança Liberado! 🔓' });
            } else {
                if (!window.confirm('Deseja ativar a trava de segurança manual de 15 minutos?')) return;
                await axios.post('/api/mt5/gold-scalper/lock');
                playErrorSound();
                setUiAlert({ type: 'error', message: 'Trava Manual Ativada 🔒' });
            }
            await fetchStatus();
        } catch (e) {
            setUiAlert({ type: 'error', message: 'Erro ao processar trava.' });
        } finally {
            setSyncing(false);
            setTimeout(() => setUiAlert(null), 3000);
        }
    };

    if (loading || !status) {
        return (
            <div className="flex items-center justify-center h-full p-12">
                <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const s = status.settings;
    const trendColor = status.microTrend === 'UP' ? 'text-trader-green' : status.microTrend === 'DOWN' ? 'text-trader-red' : 'text-slate-500';
    const trendIcon = status.microTrend === 'UP' ? <TrendingUp size={16} /> : status.microTrend === 'DOWN' ? <TrendingDown size={16} /> : <Minus size={16} />;
    const rpt = report?.summary;
    const dirM5 = status.predictions?.m5?.direction || 'FLAT';
    const confM5 = status.predictions?.m5?.confidence || 50;
    const dirM15 = status.predictions?.m15?.direction || 'FLAT';
    const confM15 = status.predictions?.m15?.confidence || 50;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Custom Alert Toast */}
            {/* ULTRA MODERN ALERT TOAST SYSTEM (FLASHY / AGGRESSIVE) */}
            <AnimatePresence>
                {uiAlert && (
                    <>
                        {/* SCREEN FLASH (Screaming Background) */}
                        <motion.div 
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`fixed inset-0 z-[998] pointer-events-none mix-blend-overlay ${uiAlert.type === 'success' ? 'bg-emerald-500' : 'bg-rose-600'}`}
                        />

                        {/* AGGRESSIVE TOAST CENTER (COMPACT PREMIUM PILL) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 2, y: -50, filter: 'blur(20px)' }}
                            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.8, y: -20, filter: 'blur(10px)' }}
                            transition={{ type: "spring", damping: 15, stiffness: 300 }}
                            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] flex flex-row items-center justify-center gap-5 px-6 py-4 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/20 backdrop-blur-3xl min-w-[280px] sm:min-w-[340px] overflow-hidden ${
                                uiAlert.type === 'success'
                                    ? 'bg-emerald-950/90 text-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.4)] border-emerald-500/50'
                                    : 'bg-rose-950/90 text-rose-400 shadow-[0_0_60px_rgba(244,63,94,0.4)] border-rose-500/50'
                            }`}
                        >
                            {/* Glow Intensive Background Effect */}
                            <div className={`absolute inset-0 opacity-30 bg-gradient-to-r ${uiAlert.type === 'success' ? 'from-emerald-400 via-transparent to-emerald-400' : 'from-rose-500 via-transparent to-rose-500'} animate-pulse`} />
                            
                            <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border ${uiAlert.type === 'success' ? 'bg-emerald-400/20 border-emerald-400 animate-bounce shadow-[0_0_15px_#10b981]' : 'bg-rose-500/20 border-rose-500 animate-bounce shadow-[0_0_15px_#f43f5e]'}`}>
                                {uiAlert.type === 'success' ? (
                                    <Trophy size={20} className="drop-shadow-[0_0_8px_rgba(52,211,153,1)]" />
                                ) : (
                                    <XCircle size={20} className="drop-shadow-[0_0_8px_rgba(244,63,94,1)]" />
                                )}
                            </div>

                            <div className="relative flex flex-col items-start justify-center pr-4">
                                <span className={`text-[8px] font-black uppercase tracking-[0.3em] mb-0.5 animate-pulse ${uiAlert.type === 'success' ? 'text-emerald-200' : 'text-rose-200'}`}>
                                    Alerta Radar-FX
                                </span>
                                <span className="text-xl sm:text-2xl font-black italic tracking-tight leading-none text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                    {uiAlert.message}
                                </span>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* GOLD SCALPER TITLE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-xl shadow-amber-500/10">
                        <TrendingUp size={40} className="text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Gold</span> Scalper
                            <span className={`px-2 py-1 rounded-lg text-xs tracking-widest uppercase ${s.enabled ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'}`}>
                                {s.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-amber-500" /> Scalping Inteligente | Neuro Core IA | Sniper Entry
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <div className="flex items-center gap-3 px-4 py-2 bg-black/40 rounded-2xl border border-white/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                        <span className={`text-[8px] font-black tracking-[0.2em] uppercase transition-colors duration-500 ${s.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {s.enabled ? 'ON' : 'OFF'}
                        </span>
                        <button
                            onClick={toggleEnabled}
                            className={`relative w-12 h-6 flex items-center rounded-full transition-all duration-500 px-1 ${s.enabled ? 'bg-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]' : 'bg-slate-800 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-500 ${s.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-tighter transition-all border ${
                                syncing
                                ? 'bg-slate-900 border-slate-800 text-slate-600'
                                : 'bg-slate-950 text-slate-300 hover:text-amber-400 hover:bg-slate-900 border-white/10 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                                } `}
                        >
                            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>

                        <button
                            onClick={handleManualLockToggle}
                            className={`group relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-all duration-300 active:scale-95 overflow-hidden ${
                                status.isCoolingOff
                                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)]'
                                    : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-amber-500 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                            }`}
                            title={status.isCoolingOff ? `Desbloquear (${Math.ceil(status.coolOffRemainingMs / 60000)}m)` : 'Trava Manual'}
                        >
                            {status.isCoolingOff && <div className="absolute inset-0 bg-rose-500/20 animate-pulse pointer-events-none" />}
                            {status.isCoolingOff ? <ShieldAlert size={16} className="relative z-10 animate-bounce" /> : <Shield size={16} className="relative z-10 group-hover:scale-110 transition-transform" />}
                        </button>

                        <button
                            onClick={handleReset}
                            className="group relative flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900/40 border border-white/5 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] transition-all duration-300 active:scale-95 overflow-hidden"
                            title="Reset Diário"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Power size={16} className="relative z-10 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* NOVO Header Premium */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => toggleSection('header')}>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Cockpit</span> Principal
                        </h3>
                    <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                        {collapsedSections['header'] ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${collapsedSections['header'] ? 'max-h-0 opacity-0' : 'max-h-[20000px] opacity-100'}`}>
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                
                {/* HEADER: INTELLIGENT DISTRIBUTION */}
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 py-2">
                    {/* LEFT ZONE: AI TELEMETRY COCKPIT */}
                    <div className="flex flex-wrap items-center bg-slate-950/30 p-2.5 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
                        
                        {/* Status Compacto */}
                        <div className="flex flex-col justify-center px-4 pr-6">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${s.enabled ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-slate-600'}`} />
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{s.enabled ? 'Motor On' : 'Espera'}</span>
                            </div>
                            {status.resolvedSymbol ? (
                                <span className="text-[11px] font-black text-amber-500 tracking-[0.3em] uppercase bg-amber-500/10 px-2 py-0.5 rounded shadow-sm w-fit">{status.resolvedSymbol}</span>
                            ) : (
                                <span className="text-[11px] font-black text-slate-600 tracking-[0.3em] uppercase bg-slate-800/50 px-2 py-0.5 rounded shadow-sm w-fit">Aguardando</span>
                            )}
                            {s.swingTrendFilter && status.ma200Ready !== undefined && !status.ma200Ready && (
                                <span className="text-[10px] font-black text-amber-500/70 tracking-[0.2em] uppercase bg-amber-500/10 px-2 py-0.5 rounded shadow-sm w-fit mt-1">MA200: CALCULANDO...</span>
                            )}
                            {s.swingTrendFilter && status.ma200Ready && (
                                <span className="text-[10px] font-black text-emerald-500/70 tracking-[0.2em] uppercase bg-emerald-500/10 px-2 py-0.5 rounded shadow-sm w-fit mt-1">MA200: OK</span>
                            )}
                        </div>

                        {/* Divisor */}
                        <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-2"></div>

                        {/* Clock Hub */}
                        <div className="px-4">
                            <TrendClock 
                                m1={status.m1Trend || 'FLAT'}
                                m5={status.m5Trend || 'FLAT'}
                                m5Strength={status.m5Strength || 50}
                            />
                            <div className="flex gap-1.5 mt-2 justify-center">
                                <CandleCountdown tf="M15" />
                                <CandleCountdown tf="H1" />
                            </div>
                        </div>

                        {/* Divisor */}
                        <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-2"></div>

                        {/* NEURO PREDICTOR AREA */}
                        {status.predictions ? (
                            <div className="flex flex-col gap-1 px-4 justify-center">
                                <span className="text-[7px] font-black uppercase text-slate-500 tracking-[0.3em] mb-1 text-center">Previsão Neural</span>
                                <div className="flex items-center gap-5">
                                    {/* 1M Prediction */}
                                    <div className="flex flex-col items-center gap-2 group cursor-help">
                                        <span className="text-[6px] font-black text-slate-500 tracking-widest leading-none">1M</span>
                                        <motion.div 
                                            animate={status.predictions?.m1?.direction !== 'FLAT' ? { 
                                                scale: [1, 1.05, 1],
                                                boxShadow: status.predictions.m1.direction === 'UP' 
                                                    ? ['0 0 10px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.4)', '0 0 10px rgba(16,185,129,0.2)']
                                                    : ['0 0 10px rgba(244,63,94,0.2)', '0 0 20px rgba(244,63,94,0.4)', '0 0 10px rgba(244,63,94,0.2)']
                                            } : {}}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            className={`relative w-8 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden transition-all duration-700 ${
                                            status.predictions.m1.direction === 'UP' 
                                                ? 'bg-emerald-500/10 border-emerald-400/50' 
                                                : status.predictions.m1.direction === 'DOWN'
                                                ? 'bg-rose-500/10 border-rose-400/50'
                                                : 'bg-slate-800/40 border-slate-700/50'
                                        }`}>
                                            {status.predictions.m1.direction !== 'FLAT' && (
                                                <motion.div 
                                                    animate={{ y: ['150%', '-150%'] }}
                                                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                                    className={`absolute left-0 w-full h-full bg-gradient-to-t ${status.predictions.m1.direction === 'UP' ? 'from-transparent via-emerald-400/30 to-transparent' : 'from-transparent via-rose-400/30 to-transparent'}`}
                                                />
                                            )}

                                            <div className={`absolute inset-0 opacity-20 bg-gradient-to-tr ${status.predictions.m1.direction === 'UP' ? 'from-emerald-400 to-transparent' : 'from-rose-400 to-transparent'}`} />
                                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                            <div className={`w-1 h-10 rounded-full relative z-10 transition-all duration-700 ${
                                                status.predictions.m1.direction === 'UP' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : status.predictions.m1.direction === 'DOWN' ? 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' : 'bg-slate-600'
                                            }`} />
                                        </motion.div>
                                        <span className={`text-[9px] font-black tracking-tighter leading-none ${status.predictions.m1.direction === 'UP' ? 'text-emerald-400' : status.predictions.m1.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {status.predictions.m1.confidence}%
                                        </span>
                                        <CandleCountdown tf="M1" />
                                    </div>
                                    {/* 5M Prediction */}
                                    <div className="flex flex-col items-center gap-2 group cursor-help">
                                        <span className="text-[6px] font-black text-slate-500 tracking-widest leading-none">5M</span>
                                        <motion.div 
                                            animate={status.predictions?.m5?.direction !== 'FLAT' ? { 
                                                scale: [1, 1.05, 1],
                                                boxShadow: status.predictions.m5.direction === 'UP' 
                                                    ? ['0 0 10px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.4)', '0 0 10px rgba(16,185,129,0.2)']
                                                    : ['0 0 10px rgba(244,63,94,0.2)', '0 0 20px rgba(244,63,94,0.4)', '0 0 10px rgba(244,63,94,0.2)']
                                            } : {}}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                            className={`relative w-8 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden transition-all duration-700 ${
                                            status.predictions.m5.direction === 'UP' 
                                                ? 'bg-emerald-500/10 border-emerald-400/50' 
                                                : status.predictions.m5.direction === 'DOWN'
                                                ? 'bg-rose-500/10 border-rose-400/50'
                                                : 'bg-slate-800/40 border-slate-700/50'
                                        }`}>
                                            {status.predictions.m5.direction !== 'FLAT' && (
                                                <motion.div 
                                                    animate={{ y: ['150%', '-150%'] }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                    className={`absolute left-0 w-full h-full bg-gradient-to-t ${status.predictions.m5.direction === 'UP' ? 'from-transparent via-emerald-400/30 to-transparent' : 'from-transparent via-rose-400/30 to-transparent'}`}
                                                />
                                            )}

                                            <div className={`absolute inset-0 opacity-20 bg-gradient-to-tr ${status.predictions.m5.direction === 'UP' ? 'from-emerald-400 to-transparent' : 'from-rose-400 to-transparent'}`} />
                                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                            <div className={`w-1 h-10 rounded-full relative z-10 transition-all duration-700 ${
                                                status.predictions.m5.direction === 'UP' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : status.predictions.m5.direction === 'DOWN' ? 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' : 'bg-slate-600'
                                            }`} />
                                        </motion.div>
                                        <span className={`text-[9px] font-black tracking-tighter leading-none ${status.predictions.m5.direction === 'UP' ? 'text-emerald-400' : status.predictions.m5.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {status.predictions.m5.confidence}%
                                        </span>
                                        <CandleCountdown tf="M5" />
                                    </div>
                                    {/* 15M Prediction */}
                                    <div className="flex flex-col items-center gap-2 group cursor-help">
                                        <span className="text-[6px] font-black text-slate-500 tracking-widest leading-none">15M</span>
                                        <motion.div 
                                            animate={status.predictions?.m15?.direction !== 'FLAT' ? { 
                                                scale: [1, 1.05, 1],
                                                boxShadow: status.predictions.m15.direction === 'UP' 
                                                    ? ['0 0 10px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.4)', '0 0 10px rgba(16,185,129,0.2)']
                                                    : ['0 0 10px rgba(244,63,94,0.2)', '0 0 20px rgba(244,63,94,0.4)', '0 0 10px rgba(244,63,94,0.2)']
                                            } : {}}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            className={`relative w-8 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden transition-all duration-700 ${
                                            status.predictions.m15.direction === 'UP' 
                                                ? 'bg-emerald-500/10 border-emerald-400/50' 
                                                : status.predictions.m15.direction === 'DOWN'
                                                ? 'bg-rose-500/10 border-rose-400/50'
                                                : 'bg-slate-800/40 border-slate-700/50'
                                        }`}>
                                            {status.predictions.m15.direction !== 'FLAT' && (
                                                <motion.div 
                                                    animate={{ y: ['150%', '-150%'] }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                    className={`absolute left-0 w-full h-full bg-gradient-to-t ${status.predictions.m15.direction === 'UP' ? 'from-transparent via-emerald-400/30 to-transparent' : 'from-transparent via-rose-400/30 to-transparent'}`}
                                                />
                                            )}

                                            <div className={`absolute inset-0 opacity-20 bg-gradient-to-tr ${status.predictions.m15.direction === 'UP' ? 'from-emerald-400 to-transparent' : 'from-rose-400 to-transparent'}`} />
                                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                            <div className={`w-1 h-10 rounded-full relative z-10 transition-all duration-700 ${
                                                status.predictions.m15.direction === 'UP' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : status.predictions.m15.direction === 'DOWN' ? 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' : 'bg-slate-600'
                                            }`} />
                                        </motion.div>
                                        <span className={`text-[9px] font-black tracking-tighter leading-none ${status.predictions.m15.direction === 'UP' ? 'text-emerald-400' : status.predictions.m15.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {status.predictions.m15.confidence}%
                                        </span>
                                        <CandleCountdown tf="M15" />
                                    </div>
                                    {/* 1H Prediction */}
                                    <div className="flex flex-col items-center gap-2 group cursor-help">
                                        <span className="text-[6px] font-black text-slate-500 tracking-widest leading-none">1H</span>
                                        <motion.div 
                                            animate={status.predictions?.h1?.direction !== 'FLAT' ? { 
                                                scale: [1, 1.05, 1],
                                                boxShadow: status.predictions.h1.direction === 'UP' 
                                                    ? ['0 0 10px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.4)', '0 0 10px rgba(16,185,129,0.2)']
                                                    : ['0 0 10px rgba(244,63,94,0.2)', '0 0 20px rgba(244,63,94,0.4)', '0 0 10px rgba(244,63,94,0.2)']
                                            } : {}}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                            className={`relative w-8 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden transition-all duration-700 ${
                                            status.predictions.h1.direction === 'UP' 
                                                ? 'bg-emerald-500/10 border-emerald-400/50' 
                                                : status.predictions.h1.direction === 'DOWN'
                                                ? 'bg-rose-500/10 border-rose-400/50'
                                                : 'bg-slate-800/40 border-slate-700/50'
                                        }`}>
                                            {status.predictions.h1.direction !== 'FLAT' && (
                                                <motion.div 
                                                    animate={{ y: ['150%', '-150%'] }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                    className={`absolute left-0 w-full h-full bg-gradient-to-t ${status.predictions.h1.direction === 'UP' ? 'from-transparent via-emerald-400/30 to-transparent' : 'from-transparent via-rose-400/30 to-transparent'}`}
                                                />
                                            )}

                                            <div className={`absolute inset-0 opacity-20 bg-gradient-to-tr ${status.predictions.h1.direction === 'UP' ? 'from-emerald-400 to-transparent' : 'from-rose-400 to-transparent'}`} />
                                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                            <div className={`w-1 h-10 rounded-full relative z-10 transition-all duration-700 ${
                                                status.predictions.h1.direction === 'UP' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : status.predictions.h1.direction === 'DOWN' ? 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' : 'bg-slate-600'
                                            }`} />
                                        </motion.div>
                                        <span className={`text-[9px] font-black tracking-tighter leading-none ${status.predictions.h1.direction === 'UP' ? 'text-emerald-400' : status.predictions.h1.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {status.predictions.h1.confidence}%
                                        </span>
                                        <CandleCountdown tf="H1" />
                                    </div>

                                </div>
                            </div>
                        ) : (
                            <div className="w-32 h-16 flex items-center justify-center">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest animate-pulse">Carregando IA...</span>
                            </div>
                        )}

                        {/* MATRIZ DE COGNIÇÃO IA */}
                        {status.iaLearning && (
                            <div className="flex-1 min-w-0 md:min-w-[360px] max-w-lg bg-slate-950/40 p-5 rounded-2xl border border-amber-500/20 flex flex-col gap-4 shadow-lg mx-2">
                                <div className="flex items-center justify-between">
                                    <InfoTooltip 
                                        header="Guia do Córtex IA v3.2"
                                        content={
                                            <div className="flex flex-col gap-2">
                                                <p><strong className="text-blue-400">Matriz de Cognição:</strong> Card que indica o processamento ativo do core v3.2.</p>
                                                <p><strong className="text-blue-400">Maturidade Neural:</strong> Evolui conforme os trades (100 trades = 100% de maturidade).</p>
                                                <p><strong className="text-blue-400">Rigor Estratégico:</strong> Confiança mínima exigida para autorizar o trade.</p>
                                                <p><strong className="text-blue-400">Base de Conhecimento:</strong> Ciclos de mercado analisados e aprendidos.</p>
                                            </div>
                                        }
                                    >
                                        <div className="flex items-center gap-2 cursor-help">
                                            <div className="relative">
                                                <Cpu size={18} className="text-blue-400 animate-pulse" />
                                                <div className="absolute inset-0 bg-blue-400/20 blur-md rounded-full animate-ping"></div>
                                            </div>
                                            <span className="text-[11px] font-black text-white uppercase tracking-tighter">Matriz de Cognição IA</span>
                                        </div>
                                    </InfoTooltip>
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                                        status.cortexHumor === 'PROTEÇÃO' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]' :
                                        status.cortexHumor === 'CAUTELOSO' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' :
                                        status.cortexHumor === 'AGRESSIVO' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-pulse' :
                                        'bg-blue-500/10 border-blue-500/40 text-blue-400'
                                    }`}>
                                        {status.cortexHumor || 'ANALÍTICO'}
                                    </div>
                                </div>
                                
                                {/* Pilares de Decisão */}
                                {status.decisionPillars && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-y border-white/5 py-3">
                                        {[
                                            { label: 'TREND', val: status.decisionPillars.trend },
                                            { label: 'DXY', val: status.decisionPillars.dxy },
                                            { label: 'RSI', val: status.decisionPillars.rsi },
                                            { label: 'VSA', val: status.decisionPillars.volume }
                                        ].map(p => (
                                            <div key={p.label} className="flex flex-col gap-1.5 items-center">
                                                <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${p.val >= 70 ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : p.val >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                                                        style={{ width: `${p.val}%` }} 
                                                    />
                                                </div>
                                                <span className="text-[8px] font-black text-slate-500 tracking-widest">{p.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                                }

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                        <span className="text-slate-400">Maturidade Neural</span>
                                        <span className="text-blue-400">{Math.min(100, Math.round((status.iaLearning.totalAnalyzed / 100) * 100))}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000" style={{ width: `${Math.min(100, (status.iaLearning.totalAnalyzed / 100) * 100)}%` }} />
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Rigor IA</span>
                                        <span className="text-[12px] font-black text-white italic tracking-tighter">{status.iaLearning.minScore}% Confiança</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Aprendizado</span>
                                        <span className="text-lg font-black text-white italic tracking-tighter">{status.iaLearning.totalAnalyzed} Ciclos</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Bottom Row: Telemetry Bar */}
                <div className="relative z-10 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-3">
                        {status.iaScore !== undefined && (
                            <InfoTooltip 
                                header="Neuro Core IA v3.2" 
                                content="Confiança baseada em Alinhamento Triplo, Exaustão, Fluxo VSA e Correlação Macro DXY."
                            >
                                <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl group relative overflow-hidden cursor-help">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                                    <Brain size={16} className="text-amber-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase text-amber-500/70">Neuro Score</span>
                                        <span className="text-sm font-black text-amber-400 leading-none">{status.iaScore}%</span>
                                    </div>
                                </div>
                            </InfoTooltip>
                        )}
                        
                        <div className="w-px h-8 bg-white/5 hidden sm:block mx-1"></div>

                        {/* Badges */}
                        <InfoTooltip header="Market Spread" content="Custo da transação em tempo real. Se estiver muito alto (vermelho), o robô aguarda condições melhores.">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help ${status.currentSpread > s.maxSpreadPoints ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/60 border-slate-700/50 text-slate-300'}`}>
                                <Activity size={12} className={status.currentSpread <= s.maxSpreadPoints ? "text-blue-400" : ""} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Spread: <span className="text-white">{status.currentSpread}</span></span>
                            </div>
                        </InfoTooltip>

                        {status.isKillZone && (
                            <InfoTooltip header="Kill Zone" content="Período de alta liquidez e volatilidade (Londres/NY). Condições ideais para scalping.">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-help">
                                    <Clock size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Kill Zone Ativa</span>
                                </div>
                            </InfoTooltip>
                        )}

                        <InfoTooltip header="Micro Trend" content="Direção imediata do preço baseada em fluxo de ordens de curto prazo.">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help bg-slate-800/60 border-slate-700/50 ${trendColor}`}>
                                {trendIcon}
                                <span className="text-[9px] font-black uppercase tracking-widest">Micro: <span className="text-white">{status.microTrend}</span></span>
                            </div>
                        </InfoTooltip>

                        {status?.m1Trend && (status.m1Trend as any) !== 'OFF' && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-800/60 ${status.m1Trend === 'UP' ? 'border-amber-500/30 text-amber-400' : status.m1Trend === 'DOWN' ? 'border-rose-500/30 text-rose-400' : 'border-slate-700/50 text-slate-400'}`}>
                                <Zap size={12} className={status.m1Trend !== 'OFF' ? "animate-pulse" : ""} />
                                <span className="text-[9px] font-black uppercase tracking-widest">M1: <span className="text-white">{status.m1Trend}</span></span>
                            </div>
                        )}

                        {status?.m5Trend && (status.m5Trend as any) !== 'OFF' && (
                             <InfoTooltip header="M5 Pro Trend" content="Tendência estrutural com análise de força e gap de preço. Crucial para validação IA.">
                                <div className={`flex flex-col justify-center gap-0.5 px-3 py-1 rounded-lg border cursor-help bg-slate-800/60 ${status.m5Trend === 'UP' ? 'border-emerald-500/30 text-emerald-400' : status.m5Trend === 'DOWN' ? 'border-rose-500/30 text-rose-400' : 'border-slate-700/50 text-slate-400'}`}>
                                    <div className="flex items-center gap-2">
                                        {status.m5Trend === 'UP' ? <TrendingUp size={10} /> : status.m5Trend === 'DOWN' ? <TrendingDown size={10} /> : <Minus size={10} />}
                                        <span className="text-[9px] font-black uppercase tracking-widest">M5 Pro: <span className="text-white">{status.m5Trend}</span></span>
                                    </div>
                                    {status.m5Strength !== undefined && (
                                         <div className="w-full h-[2px] bg-slate-900 rounded-full overflow-hidden">
                                             <div className={`h-full ${status.m5Trend === 'UP' ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${status.m5Strength}%` }} />
                                         </div>
                                     )}
                                </div>
                            </InfoTooltip>
                        )}

                        {status?.dxyTrend && (status.dxyTrend as any) !== 'OFF' && (
                            <InfoTooltip header="DXY Index" content="Correlação com o Índice do Dólar. Fundamental para prever movimentos contrários no Ouro.">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help bg-slate-800/60 ${status.dxyTrend === 'UP' ? 'border-amber-500/30 text-amber-400' : status.dxyTrend === 'DOWN' ? 'border-blue-500/30 text-blue-400' : 'border-slate-700/50 text-slate-400'}`}>
                                    <DollarSign size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">DXY: <span className="text-white">{status.dxyTrend}</span></span>
                                </div>
                            </InfoTooltip>
                        )}

                        {status.rsi !== undefined && status.rsi !== null && s.rsiFilter && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-800/60 ${status.rsi > 70 ? 'border-rose-500/30 text-rose-400' : status.rsi < 30 ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-700/50 text-slate-400'}`}>
                                <Activity size={12} />
                                <span className="text-[9px] font-black uppercase tracking-widest">RSI: <span className="text-white">{status.rsi.toFixed(0)}</span></span>
                            </div>
                        )}

                         {status.volume !== undefined && status.volume !== null && s.volumeFilter && (
                              <InfoTooltip header="HFT Volume" content="Valida se o movimento atual tem participação de grandes instituições (HFT/VSA).">
                                 <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help bg-slate-800/60 ${status.volume > 1.2 ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-700/50 text-slate-400'}`}>
                                     <BarChart3 size={12} />
                                     <span className="text-[9px] font-black uppercase tracking-widest">VOL: <span className="text-white">{status.volume.toFixed(1)}x</span></span>
                                 </div>
                             </InfoTooltip>
                         )}

                         {/* Sugestão 2: Divergência DXY */}
                         {status.dxyDivergence && (
                             <InfoTooltip 
                                header="Sincronia Macro (XAU/DXY)" 
                                content="Mede a saúde da correlação inversa entre o Ouro e o Dólar. Sincronia 'SAUDÁVEL' indica movimentos técnicos limpos. 'CRÍTICA' indica anomalias de mercado ou manipulação."
                             >
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help bg-slate-800/60 ${status.dxyDivergence.status === 'SAUDÁVEL' ? 'border-emerald-500/30 text-emerald-400' : status.dxyDivergence.status === 'CRÍTICA' ? 'border-rose-600/50 text-rose-400 animate-pulse' : 'border-slate-700/50 text-slate-400'}`}>
                                    <ShieldAlert size={12} className={status.dxyDivergence.status === 'CRÍTICA' ? 'text-rose-500' : 'text-emerald-500'} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Sincronia: <span className="text-white">{status.dxyDivergence.status}</span></span>
                                </div>
                             </InfoTooltip>
                         )}

                         {/* Sugestão 3: Heatmap de Drawdown */}
                        {status.drawdownHeatmap && (
                             <InfoTooltip 
                                header="Saúde da Grade (Drawdown)" 
                                content="Indica o nível de exposição atual do capital em relação ao Stop Loss Diário. Se atingir 'CRÍTICO', a proteção IA é ativada para travar novos grids."
                             >
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-help bg-slate-800/60 ${status.drawdownHeatmap.status === 'CRÍTICO' ? 'border-rose-600/50 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : status.drawdownHeatmap.status === 'ALERTA' ? 'border-amber-500/30 text-amber-500' : 'border-emerald-500/30 text-emerald-400'}`}>
                                    <Flame size={12} className={status.drawdownHeatmap.status === 'CRÍTICO' ? 'animate-bounce' : ''} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Saúde Grade: <span className="text-white">{status.drawdownHeatmap.percent}%</span></span>
                                </div>
                             </InfoTooltip>
                        )}

                        {/* TP por Cesta: Status */}
                        {status.basket && (
                            <InfoTooltip 
                                header="Status da Cesta"
                                content="Lucro/prejuízo líquido atual de todas as posições do robô. A cesta é fechada automaticamente quando o lucro atinge o TP ou o prejuízo atinge o SL definidos nas configurações."
                            >
                                <div className="px-3 py-1.5 rounded-lg border border-trader-green/30 bg-trader-green/5 cursor-help min-w-[140px]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">CESTA</span>
                                        <span className={`text-[10px] font-black ${status.basket.net >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                                            ${status.basket.net.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-700 rounded-full ${
                                                status.basket.progress >= 80 ? 'bg-trader-green shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' :
                                                status.basket.progress >= 50 ? 'bg-trader-green' :
                                                status.basket.progress >= -50 ? 'bg-amber-500' : 'bg-trader-red'
                                            }`}
                                            style={{ 
                                                width: `${Math.min(100, Math.abs(status.basket.progress))}%`,
                                                marginLeft: status.basket.net < 0 ? 0 : undefined
                                            }} 
                                        />
                                    </div>
                                    <div className="flex justify-between text-[6.5px] font-bold text-slate-600 mt-0.5">
                                        <span>SL ${status.basket.sl.toFixed(2)}</span>
                                        <span>TP $<span className="text-trader-green">{status.basket.tp}</span></span>
                                    </div>
                                </div>
                            </InfoTooltip>
                        )}

                        {/* SMC: Análise Estrutural */}
                        {status.smc && status.settings?.strategy === 'SMC' && (
                            <InfoTooltip 
                                header="Smart Money Concept (ICT)"
                                content="Análise estrutural de mercado: Order Blocks indicam zonas de interesse institucional. FVGs (Fair Value Gaps) são gaps de preço que tendem a ser preenchidos. Níveis de Liquidez são onde o preço pode buscar liquidez antes de reverter."
                            >
                                <div className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-900/20 cursor-help">
                                    <div className="flex items-center gap-2">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                            <path d="M2 17l10 5 10-5" />
                                            <path d="M2 12l10 5 10-5" />
                                        </svg>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${
                                            status.smc.market_structure?.trend === 'BULLISH' ? 'text-emerald-400' :
                                            status.smc.market_structure?.trend === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                                        }`}>
                                            {status.smc.market_structure?.trend || 'NEUTRAL'}
                                        </span>
                                        <span className="text-[7px] text-slate-600">|</span>
                                        <span className="text-[7px] text-slate-500 font-bold">OB: {status.smc.order_blocks?.bullish?.length || 0}▲ {status.smc.order_blocks?.bearish?.length || 0}▼</span>
                                        <span className="text-[7px] text-slate-600">|</span>
                                        <span className="text-[7px] text-slate-500 font-bold">FVG: {status.smc.fvg?.bullish?.length || 0}▲ {status.smc.fvg?.bearish?.length || 0}▼</span>
                                    </div>
                                </div>
                            </InfoTooltip>
                        )}
                        
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'financial' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest text-[9px] transition-all bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-700 hover:text-white shrink-0"
                        >
                            <Calculator size={12} />
                            Planilha VIP
                        </button>
                    </div>
                </div>

                {/* Sentiment Gauge Bar */}
                {status.sentiment && s.sentimentFilter && (
                    <div className="mt-6 pt-6 border-t border-amber-500/10">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-trader-blue uppercase tracking-widest flex items-center gap-1.5">
                                <Layers size={12} /> Sentimento Varejo (SSI)
                            </span>
                            <div className="flex items-center gap-4 text-[9px] font-bold">
                                <span className="text-trader-green">LONGS: {status.sentiment.long}%</span>
                                <span className="text-trader-red">SHORTS: {status.sentiment.short}%</span>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-trader-green to-emerald-400 transition-all duration-1000 ease-out"
                                style={{ width: `${status.sentiment.long}%` }}
                            />
                            <div
                                className="h-full bg-gradient-to-r from-red-500 to-trader-red transition-all duration-1000 ease-out"
                                style={{ width: `${status.sentiment.short}%` }}
                            />
                        </div>
                        <p className="text-[8px] text-slate-500 mt-2 italic text-center uppercase tracking-widest opacity-60">
                            {status.sentiment.long > 70 ? 'Alerta de Liquidação: Varejo Exposto em Compras. Robô priorizando Vendas.' :
                                status.sentiment.short > 70 ? 'Alerta de Squeeze: Varejo Exposto em Vendas. Robô priorizando Compras.' :
                                    'Equilíbrio Institucional Detectado. Operando em Fluxo Normal.'}
                        </p>
                    </div>
                )}
                </div>
            </div>

            {/* KPI Cards Header */}
            <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => toggleSection('monitoramento')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <Activity size={18} className="text-amber-400" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Monitoramento</span> Rápido
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400"
                            title="Zera o lucro/perda do dia para o robô"
                        >
                            <RefreshCw size={12} /> Reset Meta
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSync(); }}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest ${syncing
                                ? 'border-amber-500/30 text-amber-400 cursor-wait bg-amber-500/10'
                                : 'border-white/5 text-slate-400 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400'
                                } `}
                            title="Sincronizar relatório de trades"
                        >
                            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenCalendar(); }}
                            disabled={loadingCalendar}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-400"
                            title="Abrir calendário econômico"
                        >
                            <CalendarDays size={12} /> Calendário
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-slate-400 hover:text-amber-400">
                            {collapsedSections['monitoramento'] ? <Plus size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                </div>
                {!collapsedSections['monitoramento'] && (
                <>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                    { label: 'Saldo', value: status?.accountBalance !== undefined ? `$${status.accountBalance.toFixed(2)}` : (account?.balance ? `$${account.balance.toFixed(2)}` : '...'), color: 'text-trader-blue', icon: <Wallet size={16} />, tooltip: 'Saldo total disponível na sua conta MT5.' },
                    { label: 'S. Diário (Conta)', value: status?.accountDailyProfit !== undefined ? `$${status.accountDailyProfit.toFixed(2)}` : (globalDailyProfit !== null ? `$${globalDailyProfit.toFixed(2)}` : '...'), color: (status?.accountDailyProfit ?? globalDailyProfit ?? 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <TrendingUp size={16} />, tooltip: 'Lucro ou perda consolidada da conta no dia de hoje.' },
                    { label: 'Lucro (Robô)', value: `$${(status?.dailyProfit || 0).toFixed(2)}`, color: 'text-trader-green', icon: <DollarSign size={16} />, tooltip: 'Total de lucro bruto gerado especificamente pelo Gold Scalper hoje.' },
                    { label: 'Perda (Robô)', value: `$${(status?.dailyLoss || 0).toFixed(2)}`, color: 'text-trader-red', icon: <AlertTriangle size={16} />, tooltip: 'Total de perdas brutas registradas pelo Gold Scalper hoje.' },
                    { label: 'Líquido Dia', value: `$${(status?.netDailyProfit || 0).toFixed(2)}`, color: (status?.netDailyProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Target size={16} />, tooltip: 'Resultado líquido do robô: (Lucro - Perda) + Resultado Flutuante atual.' },
                    { label: 'Lote Base', value: s.lotSize.toString(), color: 'text-amber-400', icon: <Layers size={16} />, tooltip: 'Volume inicial configurado para a primeira ordem do ciclo.' },
                    { label: 'Níveis Grid', value: `${s.gridLevels} x`, color: 'text-trader-blue', icon: <BarChart3 size={16} />, tooltip: 'Número máximo de ordens simultâneas permitidas pela estratégia de grade.' }
                ].map((kpi, i) => (
                    <InfoTooltip key={i} header={kpi.label} content={kpi.tooltip}>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-all cursor-help h-full">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                                <span className={`${kpi.color} opacity-60`}>{kpi.icon}</span>
                            </div>
                            <span className={`text-2xl font-black italic ${kpi.color} `}>{kpi.value}</span>
                        </div>
                    </InfoTooltip>
                ))}
            </div>
                </>
                )}
            </div>

            {/* GS MONITOR - Trade Monitor ao Vivo */}
            <div className="p-6 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <Activity size={18} className="text-amber-500" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Trade Monitor</span> ao Vivo
                        </h3>
                    </div>
                    <button onClick={() => setTradeMonitorCollapsed(!tradeMonitorCollapsed)} className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                        {tradeMonitorCollapsed ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                </div>
                {!tradeMonitorCollapsed && <GoldScalperTradeMonitor embedded />}
            </div>

            {/* ==================== MA14 · MA21 · MA50 · MA100 · MA200 (H1) ==================== */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-trader-blue/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setMasCollapsed(!masCollapsed)}>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                            <Activity className="text-trader-blue" size={16} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Médias Móveis</span> — H1
                        </h3>
                        <span className="text-[8px] text-slate-500 italic tracking-wider">14 · 21 · 50 · 100 · 200</span>
                    </div>
                    <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                        {masCollapsed ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                </div>
                {!masCollapsed && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {[
                        { period: 14, value: status.ma14 },
                        { period: 21, value: status.ma21 },
                        { period: 50, value: status.ma50 },
                        { period: 100, value: status.ma100 },
                        { period: 200, value: status.ma200 },
                    ].map((ma) => {
                        const price = status.currentPrice || 0;
                        const v = ma.value || 0;
                        const above = price >= v;
                        const dist = price - v;
                        const distPct = v > 0 ? (dist / v) * 100 : 0;
                        return (
                            <div key={ma.period} className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">MA{ma.period}</span>
                                <span className={`text-sm font-black font-mono ${above ? 'text-trader-green' : 'text-trader-red'}`}>
                                    {v.toFixed(1)}
                                </span>
                                <div className="flex items-center gap-1 mt-1">
                                    <span className={`text-[8px] font-bold ${above ? 'text-trader-green' : 'text-trader-red'}`}>
                                        {dist >= 0 ? '+' : ''}{dist.toFixed(1)}
                                    </span>
                                    <span className={`text-[7px] font-bold ${above ? 'text-trader-green/60' : 'text-trader-red/60'}`}>
                                        ({distPct >= 0 ? '+' : ''}{distPct.toFixed(2)}%)
                                    </span>
                                </div>
                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
                                    <div
                                        className={`h-full rounded-full ${above ? 'bg-trader-green' : 'bg-trader-red'}`}
                                        style={{
                                            width: `${Math.min(100, Math.abs(dist) / (v * 0.02) * 100)}%`,
                                            maxWidth: '100%',
                                            float: above ? 'left' : 'right'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}
            </div>

            {/* ==================== SMC — SMART MONEY CONCEPT ==================== */}
            {(s.strategy === 'SMC' || s.smcOnly) && status.smcLevels && (
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-violet-500/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Smart Money</span> Concept
                        </h3>
                    </div>
                    <button onClick={() => setMasCollapsed(!masCollapsed)} className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                        {masCollapsed ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                </div>
                {!masCollapsed && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Estrutura de Mercado */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Market Structure</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className={`w-3 h-3 rounded-full ${status.smcLevels.market_trend === 'BULLISH' ? 'bg-trader-green shadow-[0_0_10px_rgba(16,185,129,0.6)]' : status.smcLevels.market_trend === 'BEARISH' ? 'bg-trader-red shadow-[0_0_10px_rgba(244,63,94,0.6)]' : 'bg-slate-500'}`} />
                            <span className={`text-lg font-black italic ${status.smcLevels.market_trend === 'BULLISH' ? 'text-trader-green' : status.smcLevels.market_trend === 'BEARISH' ? 'text-trader-red' : 'text-slate-400'}`}>
                                {status.smcLevels.market_trend === 'BULLISH' ? 'BULLISH' : status.smcLevels.market_trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-slate-400">
                            <BarChart3 size={11} className="text-violet-400" />
                            BOS: <span className="text-white">{status.smcLevels.bos_count}</span> quebras
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[9px] font-bold text-slate-400">
                            <Activity size={11} className="text-amber-400" />
                            ATR: <span className="text-white">{status.smcLevels.atr.toFixed(1)}</span>
                        </div>
                    </div>

                    {/* Decisão de Entrada */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Decisão de Entrada</span>
                        {(() => {
                            const dir = status.smcLevels.market_trend === 'BULLISH' ? 'BUY' : status.smcLevels.market_trend === 'BEARISH' ? 'SELL' : null;
                            if (!dir) return <span className="text-base font-black text-slate-600 italic">AGUARDANDO</span>;
                            return (
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`flex items-center gap-2 px-5 py-2 rounded-xl border ${dir === 'BUY' ? 'bg-trader-green/10 border-trader-green/30' : 'bg-trader-red/10 border-trader-red/30'}`}>
                                        {dir === 'BUY' ? <TrendingUp size={20} className="text-trader-green" /> : <TrendingDown size={20} className="text-trader-red" />}
                                        <span className={`text-xl font-black italic ${dir === 'BUY' ? 'text-trader-green' : 'text-trader-red'}`}>{dir}</span>
                                    </div>
                                    {s.smcOnly && s.swingTrendFilter && status.ma200Ready && (
                                        <span className="text-[9px] font-black text-emerald-500/70 mt-1">SMC + MA200 • Confluência OK</span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Níveis TP/SL */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Níveis SMC</span>
                        <div className="space-y-2 mt-2">
                            <div className="flex items-center justify-between bg-slate-900/40 px-3 py-2 rounded-lg">
                                <span className="text-[9px] font-bold text-trader-green flex items-center gap-1.5">
                                    <Target size={11} /> TP1
                                </span>
                                <span className="text-[11px] font-mono font-black text-trader-green">{status.smcLevels.tp1?.toFixed(2) || '---'}</span>
                            </div>
                            <div className="flex items-center justify-between bg-slate-900/40 px-3 py-2 rounded-lg">
                                <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1.5">
                                    <Target size={11} /> TP2
                                </span>
                                <span className="text-[11px] font-mono font-black text-emerald-400">{status.smcLevels.tp2?.toFixed(2) || '---'}</span>
                            </div>
                            <div className="flex items-center justify-between bg-slate-900/40 px-3 py-2 rounded-lg">
                                <span className="text-[9px] font-bold text-trader-red flex items-center gap-1.5">
                                    <Shield size={11} /> SL
                                </span>
                                <span className="text-[11px] font-mono font-black text-trader-red">{status.smcLevels.sl?.toFixed(2) || '---'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>
            )}

            {/* ==================== TRADE REPORT WIN/LOSS ==================== */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-amber-500/10">
                <div className="flex items-center justify-between mb-5 cursor-pointer select-none" onClick={() => toggleSection('trades')}>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                        <Trophy className="text-amber-500" size={18} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Relatório de Trades</span> — Win & Loss
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleResetTrades(); }}
                            disabled={syncing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border bg-slate-800 text-rose-400 hover:text-rose-300 hover:bg-slate-700 border-slate-700"
                            title="Resetar histórico de trades do Gold Scalper"
                        >
                            <XCircle size={12} /> Reset Trades
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSync(); }}
                            disabled={syncing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${syncing
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-wait'
                                : 'bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 border-slate-700'
                                } `}
                            title="Sincronizar relatório de trades"
                        >
                            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando...' : 'Sincronizar Histórico'}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); printTradeReport(); }}
                            disabled={!report?.trades || report.trades.length === 0}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                                report?.trades && report.trades.length > 0
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-600 cursor-not-allowed'
                            }`}
                            title="Imprimir relatório de trades em PDF"
                        >
                            <Printer size={12} /> PDF
                        </button>
                        <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                            {collapsedSections['trades'] ? <Plus size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                </div>
                {!collapsedSections['trades'] && (
                    <div>

                {/* Report KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    {[
                        { label: 'Total Trades', value: robot?.totalTrades || 0, color: 'text-white', icon: <BarChart3 size={14} /> },
                        { label: '% Acerto', value: `${robot?.winRate || 0}% `, color: (robot?.winRate || 0) >= 50 ? 'text-trader-green' : 'text-trader-red', icon: <Percent size={14} /> },
                        { label: 'Lucro Total', value: `$${(robot?.totalProfit || 0).toFixed(2)} `, color: (robot?.totalProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <DollarSign size={14} /> },
                        { label: 'Profit Factor', value: robot?.profitFactor || 0, color: (robot?.profitFactor || 0) >= 1 ? 'text-trader-green' : 'text-trader-red', icon: <TrendingUp size={14} /> },
                        { label: 'Streak', value: `${robot?.currentStreak || 0}x ${robot?.streakType === 'WIN' ? '🔥' : robot?.streakType === 'LOSS' ? '❄️' : '-'} `, color: robot?.streakType === 'WIN' ? 'text-trader-green' : robot?.streakType === 'LOSS' ? 'text-trader-red' : 'text-slate-500', icon: <Flame size={14} /> }
                    ].map((kpi, i) => (
                        <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-1.5 mb-1.5" title={kpi.label === 'Profit Factor' ? 'Fator de Lucro: Ganho Bruto/Perda Bruta (Ideal > 1.5)' : undefined}>
                                <span className="text-slate-500 opacity-60">{kpi.icon}</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest ${kpi.label === 'Profit Factor' ? 'cursor-help border-b border-slate-600 border-dotted text-slate-400' : 'text-slate-500'} `}>{kpi.label}</span>
                            </div>
                            <span className={`text-xl font-black italic ${kpi.color} `}>{kpi.value}</span>
                        </div>
                    ))}
                </div>

                {/* Win/Loss Modern Visual Chart */}
                {robot && robot.totalTrades > 0 && (
                    <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/40 p-4 rounded-3xl border border-slate-800 shadow-xl">
                        
                        {/* Modern Donut Chart */}
                        <div className="relative h-32 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'WINS', value: robot.wins },
                                            { name: 'LOSSES', value: robot.losses },
                                            { name: 'TIES', value: robot.ties || 0 }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={55}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={3}
                                    >
                                        <Cell key="cell-wins" fill="#34d399" />
                                        <Cell key="cell-losses" fill="#fb7185" />
                                        <Cell key="cell-ties" fill="#6b7280" />
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: '9px', textTransform: 'uppercase', fontWeight: 900, color: '#fff', boxShadow: '0 8px 12px -3px rgba(0, 0, 0, 0.5)' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: number) => [`${value} Trades`, undefined]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center mt-0.5">
                                    <span className="text-xl font-black text-white drop-shadow-md tracking-tighter">{robot.winRate}%</span>
                                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">% Acerto</span>
                                </div>
                            </div>
                        </div>

                        {/* WINS Counter */}
                        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-3 shadow-inner relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl rounded-full"></div>
                            <div 
                                className="relative z-10 flex flex-col items-center cursor-pointer hover:scale-110 hover:brightness-150 active:scale-95 transition-all" 
                                onClick={playCoinSound} 
                                title="Testar Som de Gaín!"
                            >
                                <Trophy size={16} className="text-emerald-400 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70">Total Ganhos</span>
                            </div>
                            <span className="text-2xl font-black italic text-emerald-400 drop-shadow-sm relative z-10">{robot.wins}</span>
                            <div className="mt-2 text-[11px] text-slate-400 space-y-1 text-center font-bold relative z-10">
                                <div className="bg-slate-900/50 px-2 py-0.5 rounded-md">Méd G: <span className="text-emerald-400">${robot.avgWin}</span></div>
                                <div className="bg-slate-900/50 px-2 py-0.5 rounded-md">Melhor: <span className="text-emerald-400">${robot.bestTrade}</span></div>
                            </div>
                        </div>

                        {/* LOSSES Counter */}
                        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-rose-500/10 to-transparent border border-rose-500/20 rounded-xl p-3 shadow-inner relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/10 blur-3xl rounded-full"></div>
                            <div 
                                className="relative z-10 flex flex-col items-center cursor-pointer hover:scale-110 hover:brightness-150 active:scale-95 transition-all" 
                                onClick={playLoserSound} 
                                title="Testar Som de Loss"
                            >
                                <XCircle size={16} className="text-rose-300 mb-1" />
                                <span className="text-rose-300 text-[9px] font-black uppercase tracking-widest">Total Perdas</span>
                            </div>
                            <span className="text-2xl font-black italic text-rose-300 drop-shadow-sm relative z-10">{robot.losses}</span>
                            <div className="mt-2 text-[11px] text-slate-400 space-y-1 text-center font-bold relative z-10">
                                <div className="bg-slate-900/50 px-2 py-0.5 rounded-md">Méd P: <span className="text-rose-400">${robot.avgLoss}</span></div>
                                <div className="bg-slate-900/50 px-2 py-0.5 rounded-md">Pior: <span className="text-rose-400">${robot.worstTrade}</span></div>
                            </div>
                        </div>

                        {/* TIES Counter */}
                        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-slate-500/10 to-transparent border border-slate-500/20 rounded-xl p-3 shadow-inner relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-24 h-24 bg-slate-500/10 blur-3xl rounded-full"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <Minus size={16} className="text-slate-400 mb-1" />
                                <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Empates</span>
                            </div>
                            <span className="text-2xl font-black italic text-slate-300 drop-shadow-sm relative z-10">{robot.ties || 0}</span>
                            <div className="mt-2 text-xs text-slate-500 space-y-1 text-center font-bold relative z-10">
                                <div className="bg-slate-900/50 px-2 py-0.5 rounded-md">Sem ganho/perda</div>
                            </div>
                        </div>
                        
                    </div>
                )}

                {/* Trade History Table */}
                <div className="max-h-64 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-[11px] min-w-[500px]">
                        <thead className="sticky top-0 bg-slate-900">
                            <tr className="text-slate-500 uppercase tracking-widest text-[8px] border-b border-slate-800">
                                <th className="text-left p-2">Resultado</th>
                                <th className="text-left p-2">Ticket</th>
                                <th className="text-left p-2">Tipo</th>
                                <th className="text-right p-2">Lote</th>
                                <th className="text-right p-2">Entrada</th>
                                <th className="text-right p-2">Saída</th>
                                <th className="text-right p-2">P&L</th>
                                <th className="text-left p-2">Motivo</th>
                                <th className="text-left p-2">Grid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report?.trades && report.trades.length > 0 ? (
                                report.trades.map((trade, i) => (
                                    <tr key={trade.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="p-2">
                                            <div className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter overflow-hidden border ${
                                                trade.result === 'WIN'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]'
                                                    : trade.result === 'LOSS'
                                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-[0_0_10px_rgba(148,163,184,0.1)]'
                                            }`}>
                                                <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${trade.result === 'WIN' ? 'from-emerald-400 to-transparent' : trade.result === 'LOSS' ? 'from-rose-400 to-transparent' : 'from-slate-400 to-transparent'}`} />
                                                {trade.result === 'WIN' ? (
                                                    <Trophy size={10} className="relative z-10" />
                                                ) : trade.result === 'LOSS' ? (
                                                    <XCircle size={10} className="relative z-10" />
                                                ) : (
                                                    <Minus size={10} className="relative z-10" />
                                                )}
                                                <span className="relative z-10">{trade.result}</span>
                                            </div>
                                        </td>
                                        <td className="p-2 text-slate-400 font-mono">#{trade.ticket}</td>
                                        <td className="p-2">
                                            <span className={trade.type === 'BUY' ? 'text-trader-green' : 'text-trader-red'}>{trade.type}</span>
                                        </td>
                                        <td className="p-2 text-right text-slate-300">{trade.lot}</td>
                                        <td className="p-2 text-right text-slate-300 font-mono">{trade.entryPrice?.toFixed(2)}</td>
                                        <td className="p-2 text-right text-slate-300 font-mono">{trade.exitPrice?.toFixed(2)}</td>
                                        <td className={`p-2 text-right font-black ${trade.profit >= 0 ? 'text-trader-green' : 'text-trader-red'} `}>
                                            {trade.profit >= 0 ? '+' : ''}${trade.profit?.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-slate-500 text-[9px]">{trade.closeReason}</td>
                                        <td className="p-2 text-amber-400/70">L{trade.gridLevel}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-6 text-center text-slate-600 italic">
                                        Nenhum trade registrado ainda. Ative o robô para iniciar...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Configurações Principais */}
                <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-5 cursor-pointer select-none" onClick={() => toggleSection('parametros')}>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                            <Settings className="text-amber-500" size={18} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Parâmetros de Scalping</span>
                        </h3>
                        <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                            {collapsedSections['parametros'] ? <Plus size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                    {!collapsedSections['parametros'] && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-transparent rounded-2xl border border-amber-500/30 shadow-lg mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-xl">
                                    <Brain size={20} className="text-amber-400 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-white italic uppercase tracking-tighter">Neuro Core IA v3.2 (Autoaprendizado)</span>
                                        {status.settings.smartAdaptiveIA && (
                                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[7px] font-black rounded border border-purple-500/30 animate-pulse">ADAPTATIVE</span>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-amber-500/70 font-bold uppercase tracking-widest flex items-center gap-2">
                                        Precisão Dinâmica: {status.iaLearning?.minScore || 80}% {status.iaLearning && <span className="text-[8px] text-slate-500">| Trades: {status.iaLearning.totalAnalyzed}</span>}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('smartNeuroIA', !s.smartNeuroIA)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${s.smartNeuroIA
                                    ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'} `}
                            >
                                {s.smartNeuroIA ? 'IA ATIVA' : 'IA OFF'}
                            </button>
                        </div>

                        {/* Sniper Mode Trigger */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-trader-cyan/10 to-transparent rounded-2xl border border-trader-cyan/30 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-trader-cyan/20 rounded-xl">
                                    <Target size={20} className="text-trader-cyan animate-pulse" />
                                </div>
                                <div>
                                    <span className="text-sm font-black text-white italic uppercase tracking-tighter">Sniper Entry Trigger (M1 Pattern)</span>
                                    <p className="text-[9px] text-trader-cyan/70 font-bold uppercase tracking-widest">
                                        Filtro de Precisão: Pin Bar / Rejeição de Vela / Engolfo
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('sniperMode', !s.sniperMode)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${s.sniperMode
                                    ? 'bg-trader-cyan text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'} `}
                            >
                                {s.sniperMode ? 'SNIPER ATIVO' : 'SNIPER OFF'}
                            </button>
                        </div>

                        {/* Estratégia: USD Fixo vs SMC ICT */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-transparent rounded-2xl border border-amber-500/30 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-xl">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5" />
                                        <path d="M2 12l10 5 10-5" />
                                    </svg>
                                </div>
                                <div>
                                    <span className="text-sm font-black text-white italic uppercase tracking-tighter">Estratégia de TP/SL</span>
                                    <p className="text-[9px] text-slate-400/70 font-bold uppercase tracking-widest">
                                        {s.strategy === 'SMC' && s.smcOnly && s.swingTrendFilter ? 'SMC + MA200 • Structure + Macro • Máxima Confluência' : s.strategy === 'SMC' ? 'TP/SL Estrutural por SMC • Risco Proporcional (1% banca) • Order Blocks + FVG' : 'Valor Fixo em USD • Simples • Direto'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => updateSettings({ strategy: 'USD', smcOnly: false, swingTrendFilter: false })}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${s.strategy === 'USD'
                                        ? 'bg-blue-500 text-black shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'} `}
                                >
                                    USD
                                </button>
                                <button
                                    onClick={() => updateSettings({ strategy: 'SMC', smcOnly: false, swingTrendFilter: false })}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${s.strategy === 'SMC'
                                        ? 'bg-violet-500 text-black shadow-[0_0_20px_rgba(139,92,246,0.4)]'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'} `}
                                >
                                    SMC
                                </button>
                                <button
                                    onClick={() => updateSettings({ strategy: 'SMC', smcOnly: true, swingTrendFilter: true })}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${s.strategy === 'SMC' && s.smcOnly && s.swingTrendFilter
                                        ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'} `}
                                >
                                    SMC+MA200
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <TrendingUp size={14} className="text-emerald-500" /> Risco Automático (%)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Calcula lote baseado no saldo (Ex: 1% p/ trade)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('useRiskPercentage', !s.useRiskPercentage)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.useRiskPercentage ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.useRiskPercentage ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">{s.useRiskPercentage ? 'Risco (%) por Trade' : 'Lote por Posição'}</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">{s.useRiskPercentage ? 'Exposição de capital (%)' : 'Volume de cada entrada'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => s.useRiskPercentage ? updateSetting('riskPercentage', Math.max(0.1, (s.riskPercentage || 1.0) - 0.1)) : updateSetting('lotSize', Math.max(0.01, s.lotSize - 0.01))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">-</button>
                                <span className={`text-sm font-black w-16 text-center ${s.useRiskPercentage ? 'text-emerald-500' : 'text-amber-400'} `}>
                                    {s.useRiskPercentage ? `${s.riskPercentage}% ` : s.lotSize}
                                </span>
                                <button onClick={() => s.useRiskPercentage ? updateSetting('riskPercentage', Math.min(5.0, (s.riskPercentage || 1.0) + 0.1)) : updateSetting('lotSize', Math.min(2.0, s.lotSize + 0.01))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">Níveis do Grid</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Máximo de posições simultâneas</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateSetting('gridLevels', Math.max(1, s.gridLevels - 1))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">-</button>
                                <span className="text-sm font-black text-trader-blue w-8 text-center">{s.gridLevels}</span>
                                <button onClick={() => updateSetting('gridLevels', Math.min(10, s.gridLevels + 1))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">Distância Grid (pts)</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Espaço entre cada nível (~$0.10/pt)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateSetting('gridDistance', Math.max(1, s.gridDistance - 0.5))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">-</button>
                                <span className="text-sm font-black text-white w-10 text-center">{s.gridDistance}pts</span>
                                <button onClick={() => updateSetting('gridDistance', Math.min(20, s.gridDistance + 0.5))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">Direção</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Restrição de direção de trade</p>
                            </div>
                            <div className="flex gap-1">
                                {(['BOTH', 'BUY', 'SELL'] as const).map(dir => (
                                    <button
                                        key={dir}
                                        onClick={() => updateSetting('direction', dir)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.direction === dir
                                            ? dir === 'BUY' ? 'bg-trader-green/20 text-trader-green border border-trader-green/30'
                                                : dir === 'SELL' ? 'bg-trader-red/20 text-trader-red border border-trader-red/30'
                                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                                            } `}
                                    >
                                        {dir === 'BOTH' ? '↕ Ambos' : dir === 'BUY' ? '↑ Compra' : '↓ Venda'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">Estratégia</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Perfil de agressividade</p>
                            </div>
                            <div className="flex gap-1">
                                {(['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => updateSetting('strategyMode', mode)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.strategyMode === mode
                                            ? mode === 'CONSERVATIVE' ? 'bg-trader-blue/20 text-trader-blue border border-trader-blue/30'
                                                : mode === 'AGGRESSIVE' ? 'bg-trader-red/20 text-trader-red border border-trader-red/30'
                                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                                            } `}
                                    >
                                        {mode === 'CONSERVATIVE' ? '🛡️ Seguro' : mode === 'AGGRESSIVE' ? '🔥 Agressivo' : '⚖️ Normal'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white">Kill Zones</span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Operar apenas London/NY</p>
                            </div>
                            <button
                                onClick={() => updateSetting('sessionFilter', !s.sessionFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.sessionFilter ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.sessionFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Activity size={14} className="text-purple-400" /> Volatilidade ATR (H1)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Motor Dinâmico de Stop, Grade e Alvo</p>
                            </div>
                            <button
                                onClick={() => updateSetting('dynamicATRMode', !s.dynamicATRMode)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.dynamicATRMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.dynamicATRMode ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Target size={14} className="text-purple-400" /> Smart TP/SL (Price Action)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Ajusta Alvo/Stop pelo fundo/topo real (M15 RRR 1.5x)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('smartTargeting', !s.smartTargeting)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartTargeting ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.smartTargeting ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <InfoTooltip 
                            header="Smart Grid IA" 
                            content="Inteligência que ajusta o distanciamento entre ordens baseado na volatilidade e níveis de Fibonacci, evitando a abertura de ordens próximas demais em movimentos direcionais fortes."
                        >
                            <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-help">
                                <div>
                                    <span className="text-xs font-bold text-white flex items-center gap-2">
                                        <Cpu size={14} className="text-amber-500" /> Smart Grid IA (Adaptativo)
                                    </span>
                                    <p className="text-[9px] text-slate-500 mt-0.5">Grade Dinâmica com distanciamento Fibonacci + ATR</p>
                                </div>
                                <button
                                    onClick={() => updateSetting('smartGridIA', !s.smartGridIA)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartGridIA ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                >
                                    {s.smartGridIA ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                            </div>
                        </InfoTooltip>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <TrendingUp size={14} className="text-amber-500" /> Swing Trend Filtro (H1)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Seguir tendência SMAs (Operar a favor do Fluxo)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('swingTrendFilter', !s.swingTrendFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.swingTrendFilter ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.swingTrendFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        {/* TRAILING STOP NO GRID */}
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Activity size={14} className="text-cyan-400" /> Trailing Stop no Grid
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Quando o lucro total das ordens abertas chegar a +$5, um trailing de $3 é ativado no preço médio. Se o mercado reverter e o lucro cair para $3, todas as ordens são fechadas. Protege o gain sem limitar o loss máximo.</p>
                            </div>
                            <button
                                onClick={() => updateSetting('trailingStopGrid', !s.trailingStopGrid)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.trailingStopGrid ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.trailingStopGrid ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        {/* TIME EXIT */}
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Clock size={14} className="text-orange-400" /> Time Exit (60 min)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Se uma posição ficar aberta por mais de 60 minutos sem atingir o Take Profit, o robô fecha tudo automaticamente. Evita ordens esquecidas no mercado.</p>
                            </div>
                            <button
                                onClick={() => updateSetting('timeExitMinutes', s.timeExitMinutes ? 0 : 60)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.timeExitMinutes ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.timeExitMinutes ? 'LIGADO' : 'DESLIGADO'}
                            </button>
                        </div>

                        {/* MA200 CROSS EXIT */}
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <TrendingDown size={14} className="text-trader-red" /> MA200 Cross Exit
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Monitora a Média Móvel de 200 períodos (H1). Se o preço cruzar para o lado oposto da entrada, todas as ordens são fechadas imediatamente. Ex: se entrou comprado e o preço cai abaixo da MA200, sai na hora. Trabalha junto com o Guard da estratégia.</p>
                            </div>
                            <button
                                onClick={() => updateSetting('ma200CrossExit', !s.ma200CrossExit)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.ma200CrossExit ? 'bg-trader-red/20 text-trader-red border border-trader-red/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.ma200CrossExit ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Shield size={14} className="text-trader-red" /> Order Blocks (H4)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Bloqueio contra topos/fundos institucionais</p>
                            </div>
                            <button
                                onClick={() => updateSetting('orderBlockFilter', !s.orderBlockFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.orderBlockFilter ? 'bg-trader-red/20 text-trader-red border border-trader-red/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.orderBlockFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Zap size={14} className="text-trader-green" /> Lote Anti-Martingale
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Escala lote em Sequências de Vitórias (Proteção de Capital)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('antiMartingale', !s.antiMartingale)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.antiMartingale ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.antiMartingale ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <DollarSign size={14} className="text-amber-500" /> DXY Correlation Filtro
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Bloqueia trades contra a tendência macro do Dólar</p>
                            </div>
                            <button
                                onClick={() => updateSetting('dxyFilter', !s.dxyFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.dxyFilter ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.dxyFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Layers size={14} className="text-trader-blue" /> Sentiment Engine (SSI)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Filtro Contrariano (Evita armadilhas de varejo)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('sentimentFilter', !s.sentimentFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.sentimentFilter ? 'bg-trader-blue/20 text-trader-blue border border-trader-blue/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.sentimentFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Zap size={14} className="text-amber-500" /> RSI Momentum Filter
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Evita topos/fundos exaustos (M15/H1)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('rsiFilter', !s.rsiFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.rsiFilter ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.rsiFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Zap size={14} className="text-amber-400" /> Trend Filtro M1
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Scalper Ultra Rápido (Médias 9, 21, 55)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('trendFiltroM1', !s.trendFiltroM1)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.trendFiltroM1 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.trendFiltroM1 ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Zap size={14} className="text-amber-500" /> Trend Filtro PRO (M5)
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Filtro de IA: Alinhamento, Inclinação, Gap e Volume</p>
                            </div>
                            <button
                                onClick={() => updateSetting('trendFiltroM5', !s.trendFiltroM5)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.trendFiltroM5 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.trendFiltroM5 ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <BarChart3 size={14} className="text-emerald-500" /> Volume HFT Filter
                                </span>
                                <p className="text-[9px] text-slate-500 mt-0.5">Valida força institucional (VSA &gt; 1.2x)</p>
                            </div>
                            <button
                                onClick={() => updateSetting('volumeFilter', !s.volumeFilter)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.volumeFilter ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.volumeFilter ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>
                    </div>
                    )}
                </div>

                {/* Risco & Proteção */}
                <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-5 cursor-pointer select-none" onClick={() => toggleSection('blindagem')}>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                            <Shield className="text-trader-red" size={18} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Blindagem</span> & Risco
                        </h3>
                        <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                            {collapsedSections['blindagem'] ? <Plus size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                    {!collapsedSections['blindagem'] && (
                    <>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2">
                                <Target size={14} className="text-trader-green" />
                                <div>
                                    <span className="text-xs font-bold text-white">Take Profit</span>
                                    <p className="text-[9px] text-slate-500">Por posição (USD)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateSetting('useFixedTP', !s.useFixedTP)}
                                    className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${s.useFixedTP ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                >
                                    {s.useFixedTP ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => updateSetting('takeProfitUSD', Math.max(1, s.takeProfitUSD - 0.5))} disabled={!s.useFixedTP} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.useFixedTP ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}>-</button>
                                <span className={`text-sm font-black w-10 text-center ${s.useFixedTP ? 'text-trader-green' : 'text-slate-600'}`}>${s.takeProfitUSD}</span>
                                <button onClick={() => updateSetting('takeProfitUSD', Math.min(50, s.takeProfitUSD + 0.5))} disabled={!s.useFixedTP} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.useFixedTP ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}>+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-trader-red" />
                                <div>
                                    <span className="text-xs font-bold text-white">Stop Loss</span>
                                    <p className="text-[9px] text-slate-500">Por posição (USD)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateSetting('useFixedSL', !s.useFixedSL)}
                                    className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${s.useFixedSL ? 'bg-trader-red/20 text-trader-red border border-trader-red/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                >
                                    {s.useFixedSL ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => updateSetting('stopLossUSD', Math.max(1, s.stopLossUSD - 0.5))} disabled={!s.useFixedSL} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.useFixedSL ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}>-</button>
                                <span className={`text-sm font-black w-10 text-center ${s.useFixedSL ? 'text-trader-red' : 'text-slate-600'}`}>${s.stopLossUSD}</span>
                                <button onClick={() => updateSetting('stopLossUSD', Math.min(50, s.stopLossUSD + 0.5))} disabled={!s.useFixedSL} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.useFixedSL ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}>+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-rose-900/20 to-transparent rounded-xl border border-rose-800/30">
                            <div className="flex items-center gap-2">
                                <Activity size={14} className="text-rose-400" />
                                <div>
                                    <span className="text-xs font-bold text-white">Stop Loss Dinâmico</span>
                                    <p className="text-[9px] text-slate-500">SL baseado em ATR × multiplicador</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateSetting('dynamicStopLoss', !s.dynamicStopLoss)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.dynamicStopLoss ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                >
                                    {s.dynamicStopLoss ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                                {s.dynamicStopLoss && (
                                    <div className="flex items-center gap-1 ml-1">
                                        <button onClick={() => updateSetting('dynamicSLMultiplier', Math.max(0.5, Number((s.dynamicSLMultiplier - 0.5).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">-</button>
                                        <span className="text-sm font-black w-9 text-center text-rose-400">{s.dynamicSLMultiplier}x</span>
                                        <button onClick={() => updateSetting('dynamicSLMultiplier', Math.min(5, Number((s.dynamicSLMultiplier + 0.5).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">+</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <InfoTooltip 
                            header="Take Profit Dinâmico (ATR)" 
                            content="Ajusta automaticamente a distância do TP e SL com base na volatilidade do mercado em tempo real. Em mercados voláteis, o robô expande os alvos para capturar movimentos maiores."
                        >
                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all group cursor-help">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                                        <Activity size={14} className="text-emerald-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white uppercase tracking-tighter">Take Profit Dinâmico (ATR)</span>
                                        <p className="text-[9px] text-slate-500 leading-tight">Alvos variam conforme a volatilidade</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('dynamicATRMode', !s.dynamicATRMode)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.dynamicATRMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                >
                                    {s.dynamicATRMode ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                            </div>
                        </InfoTooltip>

                        <InfoTooltip 
                            header="Neuro Convergence v4.0" 
                            content="Tecnologia de elite que exige o alinhamento de 5 fatores neurais antes de qualquer entrada: Tendência H1, Micro-Trend M1, Correlação DXY, Injeção Institucional VSA e RSI de exaustão."
                        >
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-transparent rounded-2xl border border-amber-500/30 hover:border-amber-500/50 transition-all group relative overflow-hidden cursor-help">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full pointer-events-none"></div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-xl group-hover:bg-amber-500/30 transition-colors shadow-lg shadow-amber-500/10">
                                    <Cpu size={18} className="text-amber-400" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-white italic tracking-tighter uppercase">Neuro Convergence v4.0</span>
                                        <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[8px] font-black rounded uppercase">Premium</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Auto-ajuste institucional, travas de abertura e grade adaptativa.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('neuroConvergence', !s.neuroConvergence)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${s.neuroConvergence 
                                    ? 'bg-amber-500 text-black shadow-amber-500/20 hover:scale-105 active:scale-95' 
                                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'}`}
                            >
                                {s.neuroConvergence ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>
                        </InfoTooltip>

                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-transparent rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                                    <Brain size={14} className="text-purple-400" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                        Aprendizado Adaptativo (v3.2)
                                    </span>
                                    <p className="text-[9px] text-slate-500 mt-0.5">Otimiza pesos e seletividade via feedback</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('smartAdaptiveIA', !s.smartAdaptiveIA)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartAdaptiveIA ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.smartAdaptiveIA ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2">
                                <Shield size={14} className="text-trader-blue" />
                                <div>
                                    <span className="text-xs font-bold text-white">Breakeven (Fixo)</span>
                                    <p className="text-[9px] text-slate-500">Ativa quando lucro ≥ (USD)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateSetting('breakEvenTrigger', Math.max(0.5, s.breakEvenTrigger - 0.5))} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.smartBreakeven ? 'bg-slate-900 text-slate-700 cursor-not-allowed' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} `} disabled={s.smartBreakeven}>-</button>
                                <span className={`text-sm font-black w-10 text-center ${s.smartBreakeven ? 'text-slate-600' : 'text-trader-blue'} `}>{s.breakEvenTrigger}</span>
                                <button onClick={() => updateSetting('breakEvenTrigger', Math.min(20, s.breakEvenTrigger + 0.5))} className={`w-7 h-7 rounded-lg text-sm font-bold ${s.smartBreakeven ? 'bg-slate-900 text-slate-700 cursor-not-allowed' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} `} disabled={s.smartBreakeven}>+</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div>
                            <span className="text-xs font-bold text-white flex items-center gap-2">
                                <ShieldAlert size={14} className="text-trader-blue" /> Smart Breakeven (Auto-Spread)
                            </span>
                            <p className="text-[9px] text-slate-500 mt-0.5">Gatilho ATR 1.0x (Trava lucro exato do Spread)</p>
                        </div>
                        <button
                            onClick={() => updateSetting('smartBreakeven', !s.smartBreakeven)}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartBreakeven ? 'bg-trader-blue/20 text-trader-blue border border-trader-blue/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                        >
                            {s.smartBreakeven ? 'ATIVADO' : 'DESATIVADO'}
                        </button>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-purple-900/20 to-transparent rounded-xl border border-purple-800/30">
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowUpDown size={14} className="text-purple-400" />
                            <span className="text-xs font-bold text-white">Estratégia de Trailing</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-slate-500">Gatilho (lucro ≥ USD)</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateSetting('trailingStart', Math.max(0.5, s.trailingStart - 0.5))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">-</button>
                                    <span className="text-sm font-black w-9 text-center text-purple-400">{s.trailingStart}</span>
                                    <button onClick={() => updateSetting('trailingStart', Math.min(30, s.trailingStart + 0.5))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">+</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-slate-500">Distância (stop do preço USD)</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateSetting('trailingStop', Math.max(0.5, s.trailingStop - 0.5))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">-</button>
                                    <span className="text-sm font-black w-9 text-center text-amber-400">{s.trailingStop}</span>
                                    <button onClick={() => updateSetting('trailingStop', Math.min(30, s.trailingStop + 0.5))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">+</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-slate-500">Passo (mínimo p/ atualizar USD)</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateSetting('trailingStep', Math.max(0.1, Number((s.trailingStep - 0.1).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">-</button>
                                    <span className="text-sm font-black w-9 text-center text-cyan-400">{s.trailingStep}</span>
                                    <button onClick={() => updateSetting('trailingStep', Math.min(5, Number((s.trailingStep + 0.1).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-purple-900/20 to-transparent rounded-xl border border-purple-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-white flex items-center gap-2">
                                <Activity size={14} className="text-purple-400" /> Chandelier Exit (ATR)
                            </span>
                            <button
                                onClick={() => updateSetting('smartTrailing', !s.smartTrailing)}
                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartTrailing ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.smartTrailing ? 'ATIVADO' : 'DESATIVADO'}
                            </button>
                        </div>
                        {s.smartTrailing && (
                            <div className="space-y-2 border-t border-purple-800/20 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-slate-500">Multiplicador ATR</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateSetting('atrTrailingMultiplier', Math.max(1.0, Number((s.atrTrailingMultiplier - 0.5).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">-</button>
                                        <span className="text-sm font-black w-9 text-center text-purple-400">{s.atrTrailingMultiplier}x</span>
                                        <button onClick={() => updateSetting('atrTrailingMultiplier', Math.min(5.0, Number((s.atrTrailingMultiplier + 0.5).toFixed(1))))} className="w-6 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-slate-500">Período ATR</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateSetting('atrTrailingPeriod', s.atrTrailingPeriod === 14 ? 22 : 14)} className="px-2 h-6 rounded text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700">{s.atrTrailingPeriod === 14 ? '22' : '14'}</button>
                                        <span className="text-sm font-black w-7 text-center text-amber-400">{s.atrTrailingPeriod}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-slate-500">Timeframe</span>
                                    <button onClick={() => updateSetting('atrTrailingTimeframe', s.atrTrailingTimeframe === 'M15' ? 'H1' : 'M15')} className={`px-3 h-6 rounded text-[9px] font-bold ${s.atrTrailingTimeframe === 'M15' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{s.atrTrailingTimeframe}</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* TP por Cesta de Ordens (Basket TP) */}
                    <div className="p-3 bg-gradient-to-r from-trader-green/5 to-transparent rounded-xl border border-trader-green/20 mb-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Zap size={14} className="text-trader-green" />
                                <div>
                                    <span className="text-xs font-bold text-white">TP por Cesta de Ordens</span>
                                    <p className="text-[9px] text-slate-500">Gerencia múltiplas posições como uma única cesta</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('basketModeEnabled', !s.basketModeEnabled)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.basketModeEnabled ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                            >
                                {s.basketModeEnabled ? 'CESTA ATIVA' : 'CESTA OFF'}
                            </button>
                        </div>
                        {s.basketModeEnabled && (
                            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
                                {/* Basket TP */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-trader-green uppercase">TP</span>
                                        <button onClick={() => updateSetting('basketTP', Math.max(2, s.basketTP - 1))} className="w-5 h-5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-[9px] font-bold">-</button>
                                        <span className="text-sm font-black text-trader-green w-10 text-center">${s.basketTP}</span>
                                        <button onClick={() => updateSetting('basketTP', Math.min(100, s.basketTP + 1))} className="w-5 h-5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-[9px] font-bold">+</button>
                                    </div>
                                    <button
                                        onClick={() => updateSetting('basketTPEnabled', !(s.basketTPEnabled ?? true))}
                                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${(s.basketTPEnabled ?? true) ? 'bg-trader-green/20 text-trader-green border border-trader-green/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                    >
                                        {(s.basketTPEnabled ?? true) ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                {/* Basket SL */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-trader-red uppercase">SL</span>
                                        <button onClick={() => updateSetting('basketSL', Math.max(-100, (s.basketSL || 0) - 0.5))} className="w-5 h-5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-[9px] font-bold">-</button>
                                        <span className="text-sm font-black text-trader-red w-14 text-center">{(s.basketSL || 0) < 0 ? '-' : ''}${Math.abs(s.basketSL || 0).toFixed(2)}</span>
                                        <button onClick={() => updateSetting('basketSL', Math.min(-0.5, (s.basketSL || 0) + 0.5))} className="w-5 h-5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-[9px] font-bold">+</button>
                                    </div>
                                    <button
                                        onClick={() => updateSetting('basketSLEnabled', !(s.basketSLEnabled ?? true))}
                                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${(s.basketSLEnabled ?? true) ? 'bg-trader-red/20 text-trader-red border border-trader-red/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                                    >
                                        {(s.basketSLEnabled ?? true) ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metas Diárias: Top Win & Stop Loss */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-trader-green/10 to-transparent rounded-xl border border-trader-green/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                        <div className="flex items-center gap-2">
                            <Trophy size={14} className="text-trader-green" />
                            <div>
                                <span className="text-xs font-bold text-white">Top Win Diário (Meta)</span>
                                <p className="text-[9px] text-slate-500">Pausa robô ao atingir lucro</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => updateSetting('maxDailyProfit', Math.max(10, s.maxDailyProfit - 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold border border-slate-700 flex items-center justify-center">-</button>
                            <div className="relative">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-trader-green/50 text-xs">$</span>
                                <input
                                    type="number"
                                    value={s.maxDailyProfit}
                                    onChange={(e) => updateSetting('maxDailyProfit', Number(e.target.value))}
                                    className="w-16 bg-slate-900/50 text-center text-sm font-black text-trader-green outline-none border border-trader-green/20 rounded hover:border-trader-green/50 focus:border-trader-green focus:bg-slate-900 transition-all py-0.5 pl-3 pr-1 appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <button onClick={() => updateSetting('maxDailyProfit', Math.min(5000, s.maxDailyProfit + 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold border border-slate-700 flex items-center justify-center">+</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-trader-red/10 to-transparent rounded-xl border border-trader-red/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-trader-red" />
                            <div>
                                <span className="text-xs font-bold text-white">Stop Loss Diário (Perda)</span>
                                <p className="text-[9px] text-slate-500">Desliga robô automaticamente</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => updateSetting('maxDailyLoss', Math.max(10, s.maxDailyLoss - 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold border border-slate-700 flex items-center justify-center">-</button>
                            <div className="relative">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-trader-red/50 text-xs">$</span>
                                <input
                                    type="number"
                                    value={s.maxDailyLoss}
                                    onChange={(e) => updateSetting('maxDailyLoss', Number(e.target.value))}
                                    className="w-16 bg-slate-900/50 text-center text-sm font-black text-trader-red outline-none border border-trader-red/20 rounded hover:border-trader-red/50 focus:border-trader-red focus:bg-slate-900 transition-all py-0.5 pl-3 pr-1 appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <button onClick={() => updateSetting('maxDailyLoss', Math.min(5000, s.maxDailyLoss + 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold border border-slate-700 flex items-center justify-center">+</button>
                        </div>
                    </div>

                    {/* NOVOS FILTROS DE SEGURANÇA */}
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-amber-500" />
                            <div>
                                <span className="text-xs font-bold text-white">Limite de Spread</span>
                                <p className="text-[9px] text-slate-500">Bloquear acima de (pts)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => updateSetting('maxSpreadPoints', Math.max(10, s.maxSpreadPoints - 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">-</button>
                            <span className="text-sm font-black text-amber-500 w-10 text-center">{s.maxSpreadPoints}</span>
                            <button onClick={() => updateSetting('maxSpreadPoints', Math.min(500, s.maxSpreadPoints + 10))} className="w-7 h-7 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 text-sm font-bold">+</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-white tracking-tighter">NEURO CORE v3.2</span>
                                {status.settings.smartAdaptiveIA && (
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-black rounded border border-purple-500/30 animate-pulse">AUTOAPRENDIZADO</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-trader-green"></div> IA ATIVA
                                </span>
                                {status.iaLearning && (
                                    <span className="text-[10px] text-purple-400/80 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Cpu size={10} /> Limiar: {status.iaLearning.minScore}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('smartAdaptiveIA', !s.smartAdaptiveIA)}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.smartAdaptiveIA ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                        >
                            {s.smartAdaptiveIA ? 'ATIVADO' : 'DESATIVADO'}
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                            <Flame size={14} className={s.newsGuardEnabled ? 'text-orange-500' : 'text-slate-500'} />
                            <div>
                                <span className="text-xs font-bold text-white">News Guard</span>
                                <p className="text-[9px] text-slate-500">Pausar em alta volatilidade</p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('newsGuardEnabled', !s.newsGuardEnabled)}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${s.newsGuardEnabled ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'} `}
                        >
                            {s.newsGuardEnabled ? 'ATIVADO' : 'DESATIVADO'}
                        </button>
                    </div>
                    </>
                    )}
                </div>
            </div>

            {/* ==================== NEURAL CORE — CÉREBRO MACHINE LEARNING ==================== */}
            <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.05)] relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex items-center justify-between mb-5 cursor-pointer select-none" onClick={() => toggleSection('neural')}>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Cpu size={20} className="text-purple-400" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-50" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Córtex Neural</span> IA
                            </h3>
                            <p className="text-[7px] text-purple-500/50 font-mono tracking-[0.2em] uppercase">Machine Learning • Autoaprendizado • v3.2</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {status.iaLearning && (
                            <span className="text-[8px] font-mono text-purple-400/60 bg-purple-500/5 px-2 py-1 rounded border border-purple-500/10">
                                {status.iaLearning.totalAnalyzed} ciclos
                            </span>
                        )}
                        <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:text-purple-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                            {collapsedSections['neural'] ? <Plus size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                </div>

                {!collapsedSections['neural'] && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
                    {/* COLUNA 1: NEURO SCORE & CÓRTEX */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Neuro Score</span>
                        <div className="relative w-24 h-24 mb-3">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6" />
                                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#neuroGradient)" strokeWidth="6"
                                    strokeDasharray={`${2 * Math.PI * 42}`}
                                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - (status.iaScore || 0) / 100)}`}
                                    strokeLinecap="round" className="transition-all duration-1000 ease-out"
                                />
                                <defs>
                                    <linearGradient id="neuroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="50%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#06b6d4" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-4xl font-black italic tracking-tighter ${(status.iaScore || 0) >= 80 ? 'text-purple-400' : (status.iaScore || 0) >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                                    {status.iaScore || 0}<span className="text-xl font-bold">%</span>
                                </span>
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                            status.cortexHumor === 'AGRESSIVO' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' :
                            status.cortexHumor === 'CAUTELOSO' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            status.cortexHumor === 'PROTEÇÃO' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                            'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                            {status.cortexHumor || 'ANALÍTICO'}
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-xs font-mono text-slate-400">
                            <span>Rigor: <span className="text-purple-400 font-bold">{status.iaLearning?.minScore || 70}%</span></span>
                            <span className="text-slate-700">|</span>
                            <span>Score: <span className={(status.iaScore || 0) >= 80 ? 'text-purple-400 font-bold' : (status.iaScore || 0) >= 50 ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold'}>{status.iaScore || 0}%</span></span>
                        </div>
                    </div>

                    {/* COLUNA 2: PILARES DE DECISÃO + PREVISÕES */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pilares de Decisão</span>
                        {status.decisionPillars && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                {[
                                    { label: 'TREND', val: status.decisionPillars.trend, icon: <TrendingUp size={12} />, color: status.decisionPillars.trend >= 70 ? 'text-emerald-400' : status.decisionPillars.trend >= 40 ? 'text-amber-400' : 'text-rose-400' },
                                    { label: 'DXY', val: status.decisionPillars.dxy, icon: <DollarSign size={12} />, color: status.decisionPillars.dxy >= 70 ? 'text-emerald-400' : status.decisionPillars.dxy >= 40 ? 'text-amber-400' : 'text-rose-400' },
                                    { label: 'RSI', val: status.decisionPillars.rsi, icon: <Activity size={12} />, color: status.decisionPillars.rsi >= 70 ? 'text-emerald-400' : status.decisionPillars.rsi >= 40 ? 'text-amber-400' : 'text-rose-400' },
                                    { label: 'VSA', val: status.decisionPillars.volume, icon: <BarChart3 size={12} />, color: status.decisionPillars.volume >= 70 ? 'text-emerald-400' : status.decisionPillars.volume >= 40 ? 'text-amber-400' : 'text-rose-400' },
                                ].map(p => (
                                    <div key={p.label} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[8px] font-black uppercase tracking-widest ${p.color}`}>{p.label}</span>
                                            <span className={p.color}>{p.icon}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${p.val >= 70 ? 'bg-emerald-400' : p.val >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                                style={{ width: `${p.val}%` }} />
                                        </div>
                                        <span className={`text-[10px] font-black font-mono mt-1 block ${p.color}`}>{p.val}%</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Previsões Neurais */}
                        {status.predictions && (
                            <div className="mt-4 pt-3 border-t border-slate-800">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Previsões Neurais</span>
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {(['m1', 'm5', 'm15', 'h1'] as const).map(tf => {
                                        const p = status.predictions?.[tf];
                                        if (!p) return null;
                                        const isUp = p.direction === 'UP';
                                        const isDown = p.direction === 'DOWN';
                                        return (
                                            <div key={tf} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                                                <span className="text-xs font-black text-slate-400 uppercase">{tf.toUpperCase()}</span>
                                                <div className={`text-xl font-black mt-1 ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {isUp ? '▲' : isDown ? '▼' : '◆'}
                                                </div>
                                                <span className="text-[11px] font-mono text-slate-400">{p.confidence}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUNA 3: APRENDIZADO & MATURIDADE */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Aprendizado da Rede</span>

                        {status.iaLearning && (
                            <div className="space-y-4 mt-3">
                                {/* Maturidade Neural */}
                                <div>
                                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                                        <span className="text-slate-300">Maturidade Neural</span>
                                        <span className="text-purple-400 font-black">{Math.min(100, Math.round((status.iaLearning.totalAnalyzed / 100) * 100))}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-cyan-400 transition-all duration-1000 rounded-full"
                                            style={{ width: `${Math.min(100, (status.iaLearning.totalAnalyzed / 100) * 100)}%` }} />
                                    </div>
                                </div>

                                {/* Rigor / Confiança */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                                        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Rigor</span>
                                        <p className="text-lg font-black text-white mt-0.5">{status.iaLearning.minScore}%</p>
                                        <span className="text-xs font-mono text-slate-400">Confiança mínima</span>
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                                        <span className="text-sm font-mono text-slate-300 uppercase tracking-wider">Ciclos</span>
                                        <p className="text-lg font-black text-white mt-0.5">{status.iaLearning.totalAnalyzed}</p>
                                        <span className="text-xs font-mono text-slate-400">Trades analisados</span>
                                    </div>
                                </div>

                                {/* Última otimização */}
                                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                        <RefreshCw size={12} className="text-purple-400" />
                                        Última otimização: {status.iaLearning.lastOptimized ? new Date(status.iaLearning.lastOptimized).toLocaleString('pt-BR') : '---'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Smart Adaptive IA toggle */}
                        <div className="mt-4 pt-3 border-t border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-slate-200 flex items-center gap-1.5">
                                    <Cpu size={14} className="text-purple-400" /> Smart Adaptive IA
                                </span>
                                <button
                                    onClick={() => updateSetting('smartAdaptiveIA', !s.smartAdaptiveIA)}
                                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${s.smartAdaptiveIA ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                                >
                                    {s.smartAdaptiveIA ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono leading-relaxed">
                                Ajusta automaticamente o rigor de entrada baseado no histórico de acertos. Mais rigor após perdas consecutivas, mais flexibilidade após ganhos.
                            </p>
                        </div>

                        {/* Neuro Convergence toggle */}
                        <div className="mt-3 pt-3 border-t border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-slate-200 flex items-center gap-1.5">
                                    <Zap size={14} className="text-amber-400" /> Neuro Convergence
                                </span>
                                <button
                                    onClick={() => updateSetting('neuroConvergence', !s.neuroConvergence)}
                                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${s.neuroConvergence ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                                >
                                    {s.neuroConvergence ? 'ATIVADO' : 'DESATIVADO'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-mono leading-relaxed">
                                Exige convergência de 3+ timeframes (M1, M5, M15) na mesma direção para liberar entrada. Reduz falsos sinais em mercados laterais.
                            </p>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* MONITORAMENTO EM TEMPO REAL — TERMINAL DE OPERAÇÕES */}
            <div className="relative overflow-hidden">
                {/* Scan line overlay */}
                <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.04]" style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.3) 1px, rgba(0,255,0,0.3) 2px)',
                    backgroundSize: '100% 2px'
                }} />
                <div className="bg-slate-950/90 backdrop-blur-xl p-6 rounded-2xl border border-emerald-500/20 shadow-[0_0_40px_rgba(0,255,100,0.05)] relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-500/10 cursor-pointer select-none" onClick={() => toggleSection('terminal')}>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Activity size={16} className="text-emerald-400" />
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-50" />
                            </div>
                            <div>
                                <h3 className="text-emerald-400 font-black uppercase tracking-tighter text-xs flex items-center gap-2">
                                    Terminal de Monitoramento
                                    <span className="text-[7px] text-emerald-500/50 font-mono tracking-[0.3em]">v3.2</span>
                                </h3>
                                <p className="text-[7px] text-emerald-600/60 font-mono tracking-wider">SYS::MONITOR // GOLD SCALPER // REAL-TIME</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(0,255,100,0.6)]" />
                                <span className="text-[8px] font-mono text-emerald-500/70 tracking-widest">
                                    {status.operationLog?.length || 0} eventos
                                </span>
                            </div>
                            <button className="w-6 h-6 rounded-lg bg-slate-800/50 text-slate-500 hover:text-emerald-400 hover:bg-slate-700 flex items-center justify-center transition-all border border-emerald-500/10">
                                {collapsedSections['terminal'] ? <Plus size={14} /> : <Minus size={14} />}
                            </button>
                        </div>
                    </div>

                    {!collapsedSections['terminal'] && (
                    <>
                    {/* Stats bar */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                            { label: 'Trades Hoje', value: status.operationLog?.filter(l => l.action === 'OPEN' || l.action === 'TRADE').length || 0, color: 'text-emerald-400' },
                            { label: 'Fechamentos', value: status.operationLog?.filter(l => l.action === 'CLOSE' || l.action === 'STOP' || l.action === 'PROFIT').length || 0, color: 'text-amber-400' },
                            { label: 'Erros', value: status.operationLog?.filter(l => l.action === 'ERROR').length || 0, color: status.operationLog?.filter(l => l.action === 'ERROR').length ? 'text-red-400' : 'text-emerald-400' },
                            { label: 'Basket TP', value: status.operationLog?.filter(l => l.action === 'BASKET_TP').length || 0, color: 'text-trader-green' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-900/60 border border-emerald-500/10 rounded-lg px-4 py-3 text-center">
                                <span className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-[0.2em]">{stat.label}</span>
                                <p className={`text-lg font-black font-mono ${stat.color} mt-0.5`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Terminal Feed */}
                    <div className="bg-black/60 rounded-xl border border-emerald-500/10 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] relative">
                        {/* Terminal top bar */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-emerald-500/10 bg-slate-900/40 rounded-t-xl">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                            </div>
                            <span className="text-[7px] font-mono text-emerald-600/40 tracking-[0.3em] ml-3 uppercase">gold_scalper_terminal.log</span>
                            <span className="text-[7px] font-mono text-emerald-600/30 ml-auto">-- INSERT --</span>
                        </div>

                        {/* Log lines */}
                        <div className="max-h-72 overflow-y-auto p-3 font-mono text-[11px] space-y-0.5 custom-scrollbar-terminal" ref={terminalRef}>
                            {!status?.operationLog?.length ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <span className="text-2xl mb-2 opacity-30">⎔</span>
                                    <p className="text-emerald-600/40 font-mono text-[10px] italic tracking-wider">[ SISTEMA AGUARDANDO OPERAÇÕES ]</p>
                                    <p className="text-emerald-700/30 font-mono text-[8px] mt-1">Nenhum evento registrado nesta sessão</p>
                                </div>
                            ) : (
                                status.operationLog.slice().reverse().map((log, i) => {
                                    const actionColors: Record<string, string> = {
                                        OPEN: 'text-emerald-400',
                                        CLOSE: 'text-amber-400',
                                        BE: 'text-cyan-400',
                                        TRAIL: 'text-purple-400',
                                        BASKET_TP: 'text-emerald-300',
                                        BASKET_SL: 'text-red-400',
                                        ERROR: 'text-red-400',
                                        PROFIT: 'text-emerald-300',
                                        STOP: 'text-red-400',
                                        SMC: 'text-violet-400',
                                        SMC_PARTIAL: 'text-violet-300',
                                        SMC_DEFENSE: 'text-cyan-400',
                                        SMC_v2: 'text-violet-400',
                                        INFO: 'text-slate-400',
                                        WARN: 'text-amber-400',
                                    };
                                    const c = actionColors[log.action] || 'text-emerald-300/70';
                                    return (
                                        <div key={i} className="flex items-start gap-2 hover:bg-emerald-950/20 px-2 py-0.5 rounded transition-colors">
                                            <span className="text-emerald-700/50 shrink-0 font-mono text-[9px]">[{log.time}]</span>
                                            <span className={`shrink-0 font-bold font-mono text-[10px] ${c}`}>
                                                [{log.action.padEnd(12, ' ')}]
                                            </span>
                                            <span className="text-emerald-300/80 font-mono text-[10px] leading-relaxed">{log.details}</span>
                                        </div>
                                    );
                                })
                            )}
                            {/* Cursor blink */}
                            <div className="flex items-center gap-1 px-2 pt-1">
                                <span className="text-emerald-500/50 font-mono text-[10px]">$</span>
                                <span className="w-2 h-4 bg-emerald-400/70 animate-pulse" />
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </div>

            {/* Discipline Lock Overlay */}
            <AnimatePresence>
                {isDisciplineLocked && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-slate-900 border border-trader-red/30 rounded-[2.5rem] p-10 shadow-2xl shadow-trader-red/20 text-center relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-trader-red to-transparent opacity-50" />
                            
                            <div className="w-20 h-20 bg-trader-red/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-trader-red/20">
                                <ShieldAlert size={40} className="text-trader-red animate-pulse" />
                            </div>

                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Safety Lock Ativo</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8 leading-relaxed">
                                O sistema de disciplina bloqueou novas operações.<br/>
                                <span className="text-trader-green">Meta: ${disciplineTarget}</span> | <span className="text-white">Atual: ${globalDailyProfit?.toFixed(2)}</span>
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={handleUnlock}
                                    disabled={syncing}
                                    className="w-full py-4 bg-trader-red hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-trader-red/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                                    {syncing ? 'DESTRAVANDO...' : 'DESTRAVAR SISTEMA'}
                                </button>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">
                                    Ao destravar, você assume responsabilidade total pelos novos trades.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CALENDÁRIO ECONÔMICO MODAL */}
            {showCalendar && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center" onClick={() => setShowCalendar(false)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl p-6 border-b border-white/5 flex items-center justify-between rounded-t-[2rem] z-10">
                            <h2 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2">
                                <CalendarDays size={18} className="text-blue-400" /> Calendário Econômico
                            </h2>
                            <button onClick={() => setShowCalendar(false)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                                <Minus size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {loadingCalendar ? (
                                <div className="text-center py-12 text-slate-500 text-sm font-bold uppercase tracking-widest">Carregando...</div>
                            ) : calendarEvents && calendarEvents.length > 0 ? (
                                (() => {
                                    const grouped: Record<string, any[]> = {};
                                    const now = new Date();
                                    const today = now.toISOString().split('T')[0];
                                    calendarEvents.forEach((ev: any) => {
                                        const d = new Date(ev.date);
                                        const key = d.toISOString().split('T')[0];
                                        if (!grouped[key]) grouped[key] = [];
                                        grouped[key].push(ev);
                                    });
                                    const sortedKeys = Object.keys(grouped).sort();
                                    return sortedKeys.map(dateKey => {
                                        const d = new Date(dateKey + 'T12:00:00');
                                        const isToday = dateKey === today;
                                        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                        const dateStr = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
                                        return (
                                            <div key={dateKey}>
                                                <div className={`text-xs font-black uppercase tracking-widest mb-3 pb-2 border-b ${isToday ? 'text-blue-400 border-blue-400/30' : 'text-slate-500 border-white/5'}`}>
                                                    {isToday ? '🔥 ' : ''}{dayName}, {dateStr}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {grouped[dateKey].map((ev: any, idx: number) => {
                                                        const time = new Date(ev.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                        const starCount: Record<string, number> = { High: 5, Medium: 3, Low: 1, Holiday: 0 };
                                                        const stars = '★'.repeat(starCount[ev.impact] || 1);
                                                        const starColors: Record<string, string> = { High: 'text-rose-400', Medium: 'text-amber-400', Low: 'text-slate-500', Holiday: 'text-blue-400' };
                                                        const starColor = starColors[ev.impact] || 'text-slate-500';
                                                        const countryColors: Record<string, string> = { USD: 'text-trader-green', EUR: 'text-blue-400', GBP: 'text-blue-300', JPY: 'text-amber-400', AUD: 'text-orange-400', NZD: 'text-purple-400', CAD: 'text-red-400', CNY: 'text-yellow-400', All: 'text-slate-400' };
                                                        const countryColor = countryColors[ev.country] || 'text-slate-400';
                                                        return (
                                                            <div key={idx} className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                                                <div className="flex flex-col items-center min-w-[40px]">
                                                                    <span className={`text-[11px] leading-none ${starColor}`} title={ev.impact}>{stars}</span>
                                                                    <span className="text-[6px] text-slate-600 font-bold uppercase mt-0.5">{ev.impact === 'Holiday' ? 'Feriado' : ev.impact}</span>
                                                                </div>
                                                                <span className={`text-[10px] font-black w-8 ${countryColor}`}>{ev.country}</span>
                                                                <span className="text-[10px] text-slate-500 font-bold w-10">{time}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[11px] text-white font-bold truncate">{ev.title}</p>
                                                                    {(ev.forecast || ev.previous) && (
                                                                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                                            {ev.forecast ? `Prev: ${ev.forecast}` : ''}{ev.forecast && ev.previous ? ' | ' : ''}{ev.previous ? `Ant: ${ev.previous}` : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                <div className="text-center py-12 text-slate-500 text-sm font-bold uppercase tracking-widest">Nenhum evento encontrado</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
