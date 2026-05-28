import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TradeModal } from './components/TradeModal';
import { TradingJournal } from './components/TradingJournal';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { SystemAlerts } from './components/SystemAlerts';
import { FinancialControl } from './components/FinancialControl';
import { RiskManagement } from './components/RiskManagement';
import { Statistics } from './components/Statistics';
import { AiMonitoring } from './components/AiMonitoring';
import { AlphaSupremeHub } from './components/AlphaSupremeHub';
import { StrategyReportHub } from './components/StrategyReportHub';
import { MicroScalperPanel } from './components/MicroScalperPanel';
import { SwingTraderPanel } from './components/SwingTraderPanel';
import { ForexScalperPanel } from './components/ForexScalperPanel';
import { RadarApp } from './components/RadarApp';
import { AgentIAPanel } from './components/AgentIAPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { CopyTraderPanel } from './components/CopyTraderPanel';
import { TradingPanel } from './components/TradingPanel';
import { TechnicalAnalysisPanel } from './components/TechnicalAnalysisPanel';
import { OmniProbabilisticPanel } from './components/OmniProbabilisticPanel';
import { StrategyRanking } from './components/StrategyRanking';
import { CapitalSimulator } from './components/CapitalSimulator';
import { CostEstimator } from './components/CostEstimator';
import MLInsightsPanel from './components/MLInsightsPanel';
import { GoldScalperPanel } from './components/GoldScalperPanel';
import { SharkBotPanel } from './components/SharkBotPanel';
import { CryptoIntelligenceHub } from './components/CryptoIntelligenceHub';
import { RobotControlPanel } from './components/RobotControlPanel';
import { BitcoinProPanel } from './components/BitcoinProPanel';
import { RecoveryPanel } from './components/RecoveryPanel';
import { MotorIAPanel } from './components/MotorIAPanel';
import { EconomicCalendarPanel } from './components/EconomicCalendarPanel';
import { RadarDashboard } from './components/RadarDashboard';
import { SystemSettings } from './components/SystemSettings';
import { TraderArea } from './components/TraderArea';
import { QuickStart } from './components/QuickStart';
import { RadarGuide } from './components/RadarGuide';
import { isAuthenticated } from './services/auth';
import LoginPage from './pages/LoginPage';

function useDeviceDetect() {
    const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
        const w = window.innerWidth;
        return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    });

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const handler = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                const w = window.innerWidth;
                if (w < 640) setDevice('mobile');
                else if (w < 1024) setDevice('tablet');
                else setDevice('desktop');
            }, 100);
        };
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('resize', handler);
            clearTimeout(timeoutId);
        };
    }, []);

    return device;
}

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
    const autoDevice = useDeviceDetect();
    const [activeTab, setActiveTab] = useState('cockpit');
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [trades, setTrades] = useState<any[]>([]);
    const [manualOverride, setManualOverride] = useState<'auto' | 'mobile' | 'tablet' | 'desktop'>('auto');

    const device = manualOverride !== 'auto' ? manualOverride : autoDevice;

    const handleSaveTrade = (trade: any) => {
        setTrades([trade, ...trades]);
    };

    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e.detail) setActiveTab(e.detail);
        };
        window.addEventListener('switchTab', handleSwitchTab);
        return () => window.removeEventListener('switchTab', handleSwitchTab);
    }, []);

    const pageVariants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 }
    };

    if (!isLoggedIn) {
        return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
    }

    if (device === 'mobile') {
        return (
            <RadarApp onOverrideDevice={setManualOverride} />
        );
    }

    return (
        <>
            <Layout
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isTablet={device === 'tablet'}
                onOverrideDevice={setManualOverride}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={pageVariants}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="h-full"
                    >
                        {activeTab === 'cockpit' && <Dashboard onNewTrade={() => setIsTradeModalOpen(true)} />}
                        {activeTab === 'dashboard' && <RadarDashboard />}
                        {activeTab === 'analytics' && <PerformanceAnalytics />}
                        {activeTab === 'ml' && <MLInsightsPanel />}
                        {activeTab === 'robot' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><RobotControlPanel /></React.Suspense>}
                        {activeTab === 'bitcoin_pro' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><BitcoinProPanel /></React.Suspense>}
                        {activeTab === 'shark_bot' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><SharkBotPanel /></React.Suspense>}
                        {activeTab === 'crypto' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><CryptoIntelligenceHub /></React.Suspense>}
                        {activeTab === 'gold_scalper' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><GoldScalperPanel /></React.Suspense>}
                        {activeTab === 'micro_sniper' && <MicroScalperPanel />}
                        {activeTab === 'swing_ia' && <SwingTraderPanel />}
                        {activeTab === 'copy' && <CopyTraderPanel />}
                        {activeTab === 'speed_scalper' && <ForexScalperPanel />}
                        {activeTab === 'trade' && <TradingPanel />}
                        {activeTab === 'supreme' && <AlphaSupremeHub />}
                        {activeTab === 'analysis' && <TechnicalAnalysisPanel />}
                        {activeTab === 'omni' && <OmniProbabilisticPanel />}
                        {activeTab === 'ranking' && <StrategyRanking />}
                        {activeTab === 'risk' && <RiskManagement />}
                        {activeTab === 'financial' && <FinancialControl />}
                        {activeTab === 'statistics' && <Statistics />}
                        {activeTab === 'strategy_reports' && <StrategyReportHub />}
                        {activeTab === 'journal' && <TradingJournal />}
                        {activeTab === 'simulator' && <CapitalSimulator />}
                        {activeTab === 'costs' && <CostEstimator />}
                        {activeTab === 'ai_monitoring' && <AiMonitoring />}
                        {activeTab === 'agent_ia' && <AgentIAPanel />}
                        {activeTab === 'alerts' && <SystemAlerts />}
                        {activeTab === 'recovery' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><RecoveryPanel /></React.Suspense>}
                        {activeTab === 'motor_ia' && <React.Suspense fallback={<div className="text-cyan-400 text-xs p-4">Carregando...</div>}><MotorIAPanel /></React.Suspense>}
                        {activeTab === 'calendario' && <EconomicCalendarPanel />}
                        {activeTab === 'trader_area' && <TraderArea />}
                        {activeTab === 'quick_start' && <QuickStart />}
                        {activeTab === 'radar_guide' && <RadarGuide />}
                        {activeTab === 'settings' && <SystemSettings />}
                    </motion.div>
                </AnimatePresence>
            </Layout>

            <AnimatePresence>
                {isTradeModalOpen && (
                    <TradeModal
                        isOpen={isTradeModalOpen}
                        onClose={() => setIsTradeModalOpen(false)}
                        onSave={handleSaveTrade}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

export default App;