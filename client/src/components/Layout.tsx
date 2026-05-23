import React from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    BookOpen,
    Settings,
    Bell,
    User,
    Shield,
    TrendingUp,
    BarChart2,
    Crown,
    PieChart,
    Cpu,
    Target,
    Zap,
    Activity,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Brain,
    Smartphone,
    Monitor,
    Bitcoin,
    Copy,
    Send,
    LineChart,
    Sigma,
    Box,
    Wallet
} from 'lucide-react';
import axios from 'axios';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isTablet?: boolean;
    onOverrideDevice?: (mode: 'auto' | 'mobile' | 'tablet' | 'desktop') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isTablet, onOverrideDevice }) => {
    const [isBitcoinProActive, setIsBitcoinProActive] = React.useState(false);
    const [isSharkActive, setIsSharkActive] = React.useState(false);
    const [isRobotActive, setIsRobotActive] = React.useState(false);
    const [isCryptoActive, setIsCryptoActive] = React.useState(false);
    const [isGoldActive, setIsGoldActive] = React.useState(false);
    const [isTitanActive, setIsTitanActive] = React.useState(false);
    const [isSwingActive, setIsSwingActive] = React.useState(false);
    const [isCopyActive, setIsCopyActive] = React.useState(false);
    const [isSpeedActive, setIsSpeedActive] = React.useState(false);
    const [isSupremeActive, setIsSupremeActive] = React.useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const [btcPro, shark, robot, crypto, gold, titan, swing, copy, speed, supreme] = await Promise.all([
                    axios.get('/api/mt5/bitcoin-pro/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/shark-bot/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/robot/status').catch(() => ({ data: { enabled: false } })),
                    axios.get('/api/mt5/crypto-ia/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/gold-scalper/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/micro-scalper/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/swing-trader/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/copy-trader/status').catch(() => ({ data: { activeMasterId: null } })),
                    axios.get('/api/mt5/forex-scalper/status').catch(() => ({ data: { settings: { enabled: false } } })),
                    axios.get('/api/mt5/supreme/status').catch(() => ({ data: { settings: { enabled: false } } }))
                ]);
                setIsBitcoinProActive(btcPro.data?.settings?.enabled || false);
                setIsSharkActive(shark.data?.settings?.enabled || false);
                setIsRobotActive(robot.data?.enabled || false);
                setIsCryptoActive(crypto.data?.settings?.enabled || false);
                setIsGoldActive(gold.data?.settings?.enabled || false);
                setIsTitanActive(titan.data?.settings?.enabled || false);
                setIsSwingActive(swing.data?.settings?.enabled || false);
                setIsCopyActive(!!copy.data?.activeMasterId);
                setIsSpeedActive(speed.data?.settings?.enabled || false);
                setIsSupremeActive(supreme.data?.settings?.enabled || false);
            } catch (error) {
                console.error('Failed to fetch robotic statuses');
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const menuSections = [
        {
            label: 'PRINCIPAL',
            items: [
                { id: 'cockpit', icon: LayoutDashboard, label: 'Cockpit' },
                { id: 'analytics', icon: BarChart2, label: 'Analytics' },
                { id: 'ml', icon: Brain, label: 'ML Insights' },
            ]
        },
        {
            label: 'ROBÔS',
            items: [
                { id: 'robot', icon: Cpu, label: 'Alpha Robot' },
                { id: 'bitcoin_pro', icon: Bitcoin, label: 'Bitcoin Pro' },
                { id: 'shark_bot', icon: Zap, label: 'Shark Bot' },
                { id: 'crypto', icon: Bitcoin, label: 'Alpha Cripto' },
                { id: 'gold_scalper', icon: Target, label: 'Gold Scalper' },
                { id: 'micro_sniper', icon: Zap, label: 'Micro Sniper' },
                { id: 'swing_ia', icon: TrendingUp, label: 'Swing IA' },
                { id: 'copy', icon: Copy, label: 'Copy Trader' },
                { id: 'speed_scalper', icon: Zap, label: 'Speed Scalper' },
            ]
        },
        {
            label: 'TRADING',
            items: [
                { id: 'trade', icon: Send, label: 'Operar' },
                { id: 'supreme', icon: Crown, label: 'Supreme AI' },
                { id: 'analysis', icon: LineChart, label: 'Análise Técnica' },
                { id: 'omni', icon: Sigma, label: 'Omni Prob' },
                { id: 'ranking', icon: PieChart, label: 'Ranking' },
            ]
        },
        {
            label: 'GESTÃO',
            items: [
                { id: 'risk', icon: Shield, label: 'Gestão Risco' },
                { id: 'financial', icon: BookOpen, label: 'Financeiro' },
                { id: 'statistics', icon: BarChart2, label: 'Estatísticas' },
                { id: 'strategy_reports', icon: PieChart, label: 'Relatórios' },
                { id: 'journal', icon: BookOpen, label: 'Diário' },
                { id: 'simulator', icon: Box, label: 'Simulador' },
                { id: 'costs', icon: Wallet, label: 'Custos' },
            ]
        },
        {
            label: 'SISTEMA',
            items: [
                { id: 'ai_monitoring', icon: Cpu, label: 'Monitoramento IA' },
                { id: 'agent_ia', icon: Brain, label: 'Agente IA' },
                { id: 'alerts', icon: Bell, label: 'Alertas' },
                { id: 'settings', icon: Settings, label: 'Ajustes' },
            ]
        },
    ];

    const handleNavClick = (id: string) => {
        setActiveTab(id);
        if (isDrawerOpen) setIsDrawerOpen(false);
    };

    const sidebarContent = (
        <>
            <div className={`p-6 flex items-center ${isSidebarCollapsed && !isTablet ? 'justify-center' : 'gap-3'} h-[88px]`}>
                <div className="w-10 h-10 bg-trader-blue rounded-xl flex items-center justify-center shadow-lg shadow-trader-blue/20 shrink-0">
                    <TrendingUp className="text-white" size={24} />
                </div>
                {(!isSidebarCollapsed || isTablet) && <span className="text-xl font-black text-white tracking-tighter italic whitespace-nowrap overflow-hidden">RADAR-FX</span>}
            </div>

            <nav className="flex-1 pl-4 pr-3 py-6 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
                {menuSections.map((section) => (
                    <div key={section.label} className="mb-4">
                        {(!isSidebarCollapsed || isTablet) && (
                            <div className="px-4 py-1.5 mb-1 text-xs font-semibold text-trader-blue uppercase tracking-[0.15em]">
                                {section.label}
                            </div>
                        )}
                        {section.items.map((item) => (
                            <button
                                key={item.id}
                                title={(!isSidebarCollapsed || isTablet) ? undefined : item.label}
                                onClick={() => handleNavClick(item.id)}
                                className={`w-full flex items-center ${isSidebarCollapsed && !isTablet ? 'justify-center' : 'justify-between'} px-4 py-2.5 rounded-xl transition-all duration-200 mb-0.5 ${activeTab === item.id
                                    ? 'bg-trader-blue text-white shadow-lg shadow-trader-blue/10'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                    }`}
                            >
                                <div className={`flex items-center ${isSidebarCollapsed && !isTablet ? 'justify-center relative' : 'gap-3'}`}>
                                    <item.icon size={18} className="shrink-0" />
                                    {(!isSidebarCollapsed || isTablet) && <span className="font-semibold text-sm tracking-wide uppercase whitespace-nowrap">{item.label}</span>}
                                </div>
                                {item.id === 'robot' && isRobotActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-fuchsia-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '217, 70, 239' } as any}></div>
                                )}
                                {item.id === 'bitcoin_pro' && isBitcoinProActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-green-600 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '22, 163, 74' } as any}></div>
                                )}
                                {item.id === 'shark_bot' && isSharkActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-cyan-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '6, 182, 212' } as any}></div>
                                )}
                                {item.id === 'crypto' && isCryptoActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-orange-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '249, 115, 22' } as any}></div>
                                )}
                                {item.id === 'gold_scalper' && isGoldActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '251, 191, 36' } as any}></div>
                                )}
                                {item.id === 'micro_sniper' && isTitanActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '99, 102, 241' } as any}></div>
                                )}
                                {item.id === 'swing_ia' && isSwingActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-yellow-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '234, 179, 8' } as any}></div>
                                )}
                                {item.id === 'copy' && isCopyActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-violet-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '139, 92, 246' } as any}></div>
                                )}
                                {item.id === 'speed_scalper' && isSpeedActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-cyan-400 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '34, 211, 238' } as any}></div>
                                )}
                                {item.id === 'supreme' && isSupremeActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isSidebarCollapsed && !isTablet ? 'absolute -top-0.5 -right-0.5' : ''}`} style={{ '--pulse-color': '16, 185, 129' } as any}></div>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            <div className={`p-4 border-t border-slate-800 transition-all ${isSidebarCollapsed && !isTablet ? 'flex justify-center items-center h-[88px]' : ''}`}>
                <div className={`flex items-center ${isSidebarCollapsed && !isTablet ? 'justify-center p-2' : 'gap-3 p-3'} bg-slate-800/50 rounded-xl border border-slate-800 w-full`}>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <User size={16} className="text-slate-300" />
                    </div>
                    {(!isSidebarCollapsed || isTablet) && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Trader Pro</p>
                            <p className="text-[10px] text-slate-500 truncate">Sessão Ativa</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    // Modo Tablet: sidebar vira drawer overlay
    if (isTablet) {
        const currentItem = menuSections.flatMap(s => s.items).find(m => m.id === activeTab);
        const CurrentIcon = currentItem?.icon || LayoutDashboard;

        return (
            <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
                {/* Overlay escuro quando drawer aberto */}
                {isDrawerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30"
                        onClick={() => setIsDrawerOpen(false)}
                    />
                )}

                {/* Drawer sidebar (tablet) */}
                <motion.aside
                    initial={false}
                    animate={{ x: isDrawerOpen ? 0 : '-100%' }}
                    transition={{ type: "spring", damping: 28, stiffness: 250 }}
                    className="fixed left-0 top-0 bottom-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl"
                >
                    <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="absolute -right-3 top-6 w-7 h-7 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-30 shadow-xl"
                    >
                        <X size={14} />
                    </button>
                    {sidebarContent}
                </motion.aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative overflow-y-auto">
                    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsDrawerOpen(true)}
                                className="p-2 bg-slate-800 hover:bg-trader-blue/20 text-slate-400 hover:text-trader-blue rounded-xl border border-slate-700 hover:border-trader-blue/30 transition-all"
                            >
                                <Menu size={20} />
                            </motion.button>
                            {CurrentIcon && <CurrentIcon size={16} className="text-trader-blue shrink-0" />}
                            <h1 className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">
                                {currentItem?.label}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            {isBitcoinProActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600/10 border border-green-600/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-green-400 uppercase italic hidden sm:inline">BTC Pro</span>
                                </div>
                            )}
                            {isSharkActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600/10 border border-cyan-600/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-cyan-400 uppercase italic hidden sm:inline">Shark</span>
                                </div>
                            )}
                            {isRobotActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-fuchsia-400 uppercase italic hidden sm:inline">Robot</span>
                                </div>
                            )}
                            {isCryptoActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-orange-400 uppercase italic hidden sm:inline">Cripto</span>
                                </div>
                            )}
                            {isGoldActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-amber-400 uppercase italic hidden sm:inline">Gold</span>
                                </div>
                            )}
                            {isTitanActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-indigo-400 uppercase italic hidden sm:inline">Sniper</span>
                                </div>
                            )}
                            {isSwingActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-yellow-400 uppercase italic hidden sm:inline">Swing</span>
                                </div>
                            )}
                            {isCopyActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-violet-400 uppercase italic hidden sm:inline">Copy</span>
                                </div>
                            )}
                            {isSpeedActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                                    <Zap size={10} className="text-cyan-400 animate-pulse" />
                                    <span className="text-[8px] font-black text-cyan-400 uppercase italic hidden sm:inline">Speed</span>
                                </div>
                            )}
                            {isSupremeActive && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-400 uppercase italic hidden sm:inline">Supreme</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-trader-green/10 border border-trader-green/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-trader-green rounded-full animate-pulse"></div>
                                <span className="text-[8px] font-black text-trader-green uppercase italic hidden sm:inline">MT5</span>
                            </div>
                            {onOverrideDevice && (
                                <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl border border-slate-700 p-0.5">
                                    <button onClick={() => onOverrideDevice('mobile')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Modo Mobile">
                                        <Smartphone size={15} />
                                    </button>
                                    <button onClick={() => onOverrideDevice('auto')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Auto (responsivo)">
                                        <Monitor size={15} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    <section className="flex-1">
                        {children}
                    </section>
                </main>
            </div>
        );
    }

    // Modo Desktop: sidebar fixa
    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
            {/* Sidebar Desktop */}
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 relative z-20 hidden lg:flex`}>
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-30 shadow-xl"
                >
                    {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
                {sidebarContent}
            </aside>

            {/* Header hamburger para telas < lg (quando sidebar desktop some) */}
            <aside className="lg:hidden bg-slate-900 border-r border-slate-800 flex flex-col relative z-20">
                <div className="flex items-center justify-center p-4">
                    <button
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        className="p-2 bg-slate-800 hover:bg-trader-blue/20 text-slate-400 hover:text-trader-blue rounded-xl border border-slate-700 transition-all"
                    >
                        <Menu size={20} />
                    </button>
                </div>
                {isDrawerOpen && (
                    <div className="fixed left-0 top-0 bottom-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl animate-slide-in">
                        <div className="flex justify-end p-4">
                            <button
                                onClick={() => setIsDrawerOpen(false)}
                                className="p-2 bg-slate-800 hover:bg-trader-blue/20 text-slate-400 hover:text-trader-blue rounded-xl"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {sidebarContent}
                    </div>
                )}
                {isDrawerOpen && (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30" onClick={() => setIsDrawerOpen(false)} />
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-y-auto">
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
                    <h1 className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">
                        {menuSections.flatMap(s => s.items).find(m => m.id === activeTab)?.label}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        {isBitcoinProActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-600/10 border border-green-600/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-green-400 uppercase italic">BTC Pro</span>
                            </div>
                        )}
                        {isSharkActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-600/10 border border-cyan-600/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-cyan-400 uppercase italic">Shark</span>
                            </div>
                        )}
                        {isRobotActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-fuchsia-400 uppercase italic">Robot</span>
                            </div>
                        )}
                        {isCryptoActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-orange-400 uppercase italic">Cripto</span>
                            </div>
                        )}
                        {isGoldActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-amber-400 uppercase italic">Gold</span>
                            </div>
                        )}
                        {isTitanActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-indigo-400 uppercase italic">Sniper</span>
                            </div>
                        )}
                        {isSwingActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-yellow-400 uppercase italic">Swing</span>
                            </div>
                        )}
                        {isCopyActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-violet-400 uppercase italic">Copy</span>
                            </div>
                        )}
                        {isSpeedActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                                <Zap size={10} className="text-cyan-400 animate-pulse" />
                                <span className="text-[9px] font-black text-cyan-400 uppercase italic">Speed</span>
                            </div>
                        )}
                        {isSupremeActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-black text-emerald-400 uppercase italic">Supreme</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1 bg-trader-green/10 border border-trader-green/20 rounded-full">
                            <div className="w-1.5 h-1.5 bg-trader-green rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-black text-trader-green uppercase italic">MT5</span>
                        </div>
                        {onOverrideDevice && (
                            <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl border border-slate-700 p-0.5">
                                <button onClick={() => onOverrideDevice('mobile')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Forçar modo Mobile">
                                    <Smartphone size={16} />
                                </button>
                                <button onClick={() => onOverrideDevice('tablet')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Forçar modo Tablet">
                                    <Monitor size={16} />
                                </button>
                                <button onClick={() => onOverrideDevice('auto')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" title="Auto (responsivo)">
                                    <Activity size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <section className="flex-1">
                    {children}
                </section>
            </main>
        </div>
    );
};