import React, { useState } from 'react';
import axios from 'axios';
import {
    LayoutGrid,
    Zap,
    Bot,
    BarChart3,
    BookOpen,
    Settings,
    Activity,
    TrendingUp,
    Shield,
    Wallet,
    ChevronDown,
    ChevronUp,
    Monitor,
    RefreshCw,
    X,
    Globe,
    Server,
    Wifi,
    Cpu,
    Key,
    Coins,
    Brain,
    Target,
    PieChart,
    Star,
    GripHorizontal,
    Bitcoin
} from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { RobotControlPanel } from './RobotControlPanel';
import { TradingPanel } from './TradingPanel';
import { StrategyReportHub } from './StrategyReportHub';
import { TradingJournal } from './TradingJournal';
import { MobileHome } from './MobileHome';
import { CryptoIntelligenceHub } from './CryptoIntelligenceHub';
import { SignalScanner } from './SignalScanner';
import { PerformanceAnalytics } from './PerformanceAnalytics';
import { GoldScalperPanel } from './GoldScalperPanel';
import MLInsightsPanel from './MLInsightsPanel';
import { Statistics } from './Statistics';
import { RiskManagement } from './RiskManagement';
import { AgentIAPanel } from './AgentIAPanel';
import { ForexScalperPanel } from './ForexScalperPanel';
import { MicroScalperPanel } from './MicroScalperPanel';
import { SwingTraderPanel } from './SwingTraderPanel';
import { BitcoinProPanel } from './BitcoinProPanel';
import { SharkBotPanel } from './SharkBotPanel';
import { OmniProbabilisticPanel } from './OmniProbabilisticPanel';

type TabType = 'home' | 'intelligence' | 'robot' | 'trade' | 'management' | 'bitcoin_pro' | 'crypto' | 'gold_scalper' | 'micro_sniper' | 'swing_ia' | 'copy' | 'speed_scalper' | 'supreme' | 'analytics' | 'ml' | 'agent_ia' | 'ai_monitoring' | 'alerts' | 'settings' | 'risk' | 'financial' | 'statistics' | 'strategy_reports' | 'journal' | 'simulator' | 'costs' | 'analysis' | 'omni' | 'ranking';

interface RadarAppProps {
    onOverrideDevice?: (mode: 'auto' | 'mobile' | 'tablet' | 'desktop') => void;
}

export const RadarApp: React.FC<RadarAppProps> = ({ onOverrideDevice }) => {
    const [activeTab, setActiveTab] = useState<TabType>('home');
    const [intelTab, setIntelTab] = useState<'signals' | 'crypto' | 'ml'>('crypto');
    const [robotTab, setRobotTab] = useState<'alpha' | 'gold' | 'speed' | 'titan' | 'swing' | 'bitcoin_pro' | 'shark_bot'>('gold');
    const [manageTab, setManageTab] = useState<'reports' | 'journal' | 'stats' | 'risk' | 'agent'>('reports');
    const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
    const [isConnectivityOpen, setIsConnectivityOpen] = useState(false);
    const [accountData, setAccountData] = useState<any>(null);
    const [isLoadingAccount, setIsLoadingAccount] = useState(false);

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState('Pepperstone-Demo');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginStatus, setLoginStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

    const fetchAccountInfo = async () => {
        setIsLoadingAccount(true);
        try {
            const response = await axios.get('/api/mt5/account');
            setAccountData(response.data);
        } catch (error) {
            console.error('Failed to fetch account info:', error);
        } finally {
            setIsLoadingAccount(false);
        }
    };

    const handleOpenConnectivity = () => {
        setIsConnectivityOpen(true);
        setLoginStatus(null);
        fetchAccountInfo();
    };

    const handleConnectBroker = async () => {
        setIsLoggingIn(true);
        setLoginStatus(null);
        try {
            await axios.post('/api/mt5/login', { login, password, server });
            setLoginStatus({ type: 'success', msg: 'Conexão estabelecida com sucesso!' });
            fetchAccountInfo();
        } catch (error: any) {
            setLoginStatus({
                type: 'error',
                msg: error.response?.data?.error || 'Falha na autenticação Alpha'
            });
        } finally {
            setIsLoggingIn(false);
        }
    };

    const tabOrder: TabType[] = ['home', 'intelligence', 'robot', 'trade', 'management'];
    const menuItems: { id: TabType; icon: any; label: string }[] = [
        { id: 'home', icon: LayoutGrid, label: 'Home' },
        { id: 'intelligence', icon: Brain, label: 'Intel' },
        { id: 'robot', icon: Bot, label: 'Robôs' },
        { id: 'trade', icon: Activity, label: 'Trade' },
        { id: 'management', icon: BarChart3, label: 'Gestão' },
    ];

    const handleSwipe = (_: any, info: PanInfo) => {
        const { offset, velocity } = info;
        const threshold = 60;
        const velX = Math.abs(velocity.x);
        const velY = Math.abs(velocity.y);
        if (velY > velX * 1.5) return;
        if (velX < 250) return;
        const delta = offset.x;
        const currentIdx = tabOrder.indexOf(activeTab);
        if (currentIdx === -1) return;
        if (delta < -threshold && currentIdx < tabOrder.length - 1) {
            setActiveTab(tabOrder[currentIdx + 1]);
        } else if (delta > threshold && currentIdx > 0) {
            setActiveTab(tabOrder[currentIdx - 1]);
        }
    };

    const robotOptions = [
        { id: 'bitcoin_pro', label: 'BTC Pro', icon: Bitcoin },
        { id: 'shark_bot', label: 'Shark', icon: Zap },
        { id: 'gold', label: 'Gold', icon: Target },
        { id: 'speed', label: 'Speed', icon: Zap },
        { id: 'titan', label: 'Titan', icon: Star },
        { id: 'swing', label: 'Swing', icon: TrendingUp },
        { id: 'alpha', label: 'Alpha', icon: Bot },
        { id: 'supreme', label: 'Supreme', icon: Crown },
        { id: 'omni', label: 'Omni', icon: Sigma },
    ];

    const renderRobots = () => (
        <div className="p-3 md:p-4 space-y-5 md:space-y-6">
            <div className="flex gap-2 p-1 bg-slate-900/40 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none -mx-1 px-1 md:mx-0 md:px-0">
                {robotOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = robotTab === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => setRobotTab(opt.id as typeof robotTab)}
                            className={`flex items-center gap-1.5 py-2.5 px-3 md:px-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${isActive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Icon size={14} />
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            {robotTab === 'alpha' && <RobotControlPanel />}
            {robotTab === 'gold' && <GoldScalperPanel />}
            {robotTab === 'speed' && <ForexScalperPanel />}
            {robotTab === 'titan' && <MicroScalperPanel />}
            {robotTab === 'swing' && <SwingTraderPanel />}
            {robotTab === 'bitcoin_pro' && <BitcoinProPanel />}
            {robotTab === 'shark_bot' && <SharkBotPanel />}
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <MobileHome onTradeClick={() => setActiveTab('trade')} />;
            case 'robot':
                return renderRobots();
            case 'intelligence':
                return (
                    <div className="p-3 md:p-4 space-y-5 md:space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-900/40 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none -mx-1 px-1 md:mx-0 md:px-0">
                            <button
                                onClick={() => setIntelTab('crypto')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${intelTab === 'crypto' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Coins size={14} /> Crypto</span>
                            </button>
                            <button
                                onClick={() => setIntelTab('signals')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${intelTab === 'signals' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Zap size={14} /> Sinais</span>
                            </button>
                            <button
                                onClick={() => setIntelTab('ml')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${intelTab === 'ml' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Brain size={14} /> ML</span>
                            </button>
                        </div>
                        {intelTab === 'crypto' && <CryptoIntelligenceHub />}
                        {intelTab === 'signals' && <SignalScanner />}
                        {intelTab === 'ml' && <MLInsightsPanel />}
                    </div>
                );
            case 'trade':
                return <div className="p-4"><TradingPanel /></div>;
            case 'management':
                return (
                    <div className="p-3 md:p-4 space-y-5 md:space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-900/40 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none -mx-1 px-1 md:mx-0 md:px-0">
                            <button
                                onClick={() => setManageTab('reports')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${manageTab === 'reports' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><PieChart size={14} /> Reports</span>
                            </button>
                            <button
                                onClick={() => setManageTab('stats')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${manageTab === 'stats' ? 'bg-trader-blue/20 text-trader-blue border border-trader-blue/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><BarChart3 size={14} /> Stats</span>
                            </button>
                            <button
                                onClick={() => setManageTab('risk')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${manageTab === 'risk' ? 'bg-trader-red/20 text-trader-red border border-trader-red/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Shield size={14} /> Risco</span>
                            </button>
                            <button
                                onClick={() => setManageTab('journal')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${manageTab === 'journal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><BookOpen size={14} /> Diário</span>
                            </button>
                            <button
                                onClick={() => setManageTab('agent')}
                                className={`flex-none md:flex-1 py-3 px-4 md:px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${manageTab === 'agent' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Brain size={14} /> Agente</span>
                            </button>
                        </div>
                        {manageTab === 'reports' && <StrategyReportHub />}
                        {manageTab === 'stats' && <Statistics />}
                        {manageTab === 'risk' && <RiskManagement />}
                        {manageTab === 'journal' && <TradingJournal />}
                        {manageTab === 'agent' && <AgentIAPanel />}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-200">
            {/* Header */}
            <div className="bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex justify-between items-center z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center p-1 border border-indigo-500/30 shadow-xl shadow-indigo-500/20">
                        <img
                            src="/radar_fx_super_logo.png"
                            alt="Radar FX"
                            className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                        />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-tighter italic leading-none flex items-center gap-1">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Radar</span>
                            <span className="text-white">Fx</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[7px] font-black bg-trader-blue/20 text-trader-blue px-1 rounded uppercase tracking-[0.1em]">Mobile</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">v3.3</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onOverrideDevice && (
                        <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl border border-slate-700 p-0.5">
                            <button onClick={() => onOverrideDevice('tablet')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Modo Tablet">
                                <Monitor size={16} />
                            </button>
                            <button onClick={() => onOverrideDevice('desktop')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Modo Desktop">
                                <Monitor size={16} className="rotate-90" />
                            </button>
                        </div>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleOpenConnectivity}
                        className="p-2.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors"
                    >
                        <Settings size={18} className="text-slate-400" />
                    </motion.button>
                </div>
            </div>

            {/* Connectivity Modal */}
            <AnimatePresence>
                {isConnectivityOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
                    >
                        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsConnectivityOpen(false)} />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full h-full sm:h-auto sm:max-h-[90vh] max-w-lg bg-slate-900 border-0 sm:border border-white/10 rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Drag Handle for mobile sheet */}
                            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 z-20">
                                <div className="w-10 h-1 rounded-full bg-slate-700" />
                            </div>
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-trader-blue/10 to-transparent pointer-events-none" />
                            <div className="p-6 md:p-8 pt-14 md:pt-8" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-trader-blue/10 rounded-2xl border border-trader-blue/20">
                                            <Globe className="text-trader-blue" size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Central de Rede</h2>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conectividade MT5</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsConnectivityOpen(false)}
                                        className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-slate-950/50 rounded-3xl p-6 border border-white/5">
                                        {isLoadingAccount ? (
                                            <div className="flex flex-col items-center py-6 gap-3">
                                                <RefreshCw size={24} className="text-trader-blue animate-spin" />
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Conectando...</span>
                                            </div>
                                        ) : accountData ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Corretora</p>
                                                    <p className="text-sm font-black text-white uppercase italic truncate">{accountData.company || '---'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Servidor</p>
                                                    <p className="text-sm font-black text-white uppercase italic truncate">{accountData.server || '---'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Conta</p>
                                                    <p className="text-sm font-black text-trader-blue italic">#{accountData.login || '---'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Alavancagem</p>
                                                    <p className="text-sm font-black text-amber-500 uppercase italic">1:{accountData.leverage || '---'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-center py-4 text-[10px] font-black text-slate-500 uppercase">Aguardando credenciais</p>
                                        )}
                                    </div>
                                    <div className="bg-slate-950/30 rounded-3xl p-6 border border-white/5 space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Key size={14} className="text-trader-blue" />
                                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Acesso Direto</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Login MT5</label>
                                                <input type="text" value={login} onChange={e => setLogin(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all" placeholder="Número da conta" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all" placeholder="••••••••" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Servidor</label>
                                                <input type="text" value={server} onChange={e => setServer(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all" placeholder="Ex: Pepperstone-Demo" />
                                            </div>
                                        </div>
                                        {loginStatus && (
                                            <div className={`p-3 rounded-xl border text-[9px] font-black uppercase text-center ${loginStatus.type === 'success' ? 'bg-trader-green/10 border-trader-green/20 text-trader-green' : 'bg-trader-red/10 border-trader-red/20 text-trader-red'}`}>
                                                {loginStatus.msg}
                                            </div>
                                        )}
                                        <button onClick={handleConnectBroker} disabled={isLoggingIn} className="w-full py-4 bg-trader-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-trader-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                            {isLoggingIn ? <RefreshCw className="animate-spin" size={14} /> : 'Conectar Agora'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-950/30 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                                            <Server size={16} className="text-slate-500" />
                                            <span className="text-[7px] font-black text-slate-500 uppercase text-center">Latência<br /><span className="text-trader-blue">24ms</span></span>
                                        </div>
                                        <div className="bg-slate-950/30 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                                            <Wifi size={16} className="text-slate-500" />
                                            <span className="text-[7px] font-black text-slate-500 uppercase text-center">Sync<br /><span className="text-trader-green">1000ms</span></span>
                                        </div>
                                        <div className="bg-slate-950/30 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                                            <Cpu size={16} className="text-slate-500" />
                                            <span className="text-[7px] font-black text-slate-500 uppercase text-center">Carga<br /><span className="text-amber-500">Normal</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <motion.div
                className="flex-1 overflow-y-auto alpha-scrollbar transition-all duration-300"
                style={{ paddingBottom: isMenuCollapsed ? '2rem' : '6rem' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleSwipe}
                whileTap={{ cursor: 'grabbing' }}
            >
                <div className="max-w-3xl md:max-w-5xl lg:max-w-6xl mx-auto w-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="min-h-full px-3 py-4 md:px-5 md:py-6 lg:px-6"
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Bottom Tab Bar */}
            <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${isMenuCollapsed ? 'translate-y-[calc(100%-8px)]' : 'translate-y-0'}`}>
                <div className="flex justify-center -mb-2">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
                        className="bg-slate-900/90 backdrop-blur-xl border border-white/10 px-5 md:px-6 py-1 rounded-t-2xl flex items-center gap-2 group shadow-lg z-10"
                    >
                        <div className={`transition-transform duration-500 ${isMenuCollapsed ? 'rotate-180' : ''}`}>
                            <GripHorizontal size={12} className="text-trader-blue" />
                        </div>
                    </motion.button>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-3xl border-t border-white/10 px-4 md:px-8 py-3 pb-8 md:pb-6 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="flex justify-between items-center max-w-lg md:max-w-xl mx-auto">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as TabType)}
                                    className="relative flex flex-col items-center gap-1 group px-2 md:px-3"
                                >
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                layoutId="bottomTabBg"
                                                className="absolute -inset-x-3 -inset-y-2 bg-trader-blue/10 rounded-2xl -z-10"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            />
                                        )}
                                    </AnimatePresence>
                                    <Icon
                                        size={20}
                                        className={`transition-all duration-300 ${isActive
                                            ? 'text-trader-blue scale-110 drop-shadow-[0_0_8px_rgba(0,163,255,0.5)]'
                                            : 'text-slate-500 group-hover:text-slate-300'
                                            }`}
                                    />
                                    <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-trader-blue' : 'text-slate-500'}`}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="bottomTabDot"
                                            className="absolute -bottom-px w-1 h-1 bg-trader-blue rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};