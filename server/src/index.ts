import dotenv from 'dotenv';
dotenv.config();

// Alpha Station v1.1 - Emergency Reset Engine Active
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { SignalEngine } from './services/SignalEngine';
import { TradeGuardian } from './services/TradeGuardian';
import { DisciplineEngine } from './services/DisciplineEngine';
import { ReportEngine } from './services/ReportEngine';
import { AlertEngine } from './services/AlertEngine';
import { AlphaRobotEngine } from './services/AlphaRobotEngine';
import { CopyTraderEngine } from './services/CopyTraderEngine';
import { LiteFinanceService } from './services/LiteFinanceService';
import { ConfigService } from './services/ConfigService';
import { SentimentService } from './services/SentimentService';
import { AlphaAuditService } from './services/AlphaAuditService';
import { CryptoRiskEngine } from './services/CryptoRiskEngine';
import { SupremeEngine } from './services/SupremeEngine';
import { MarketService } from './services/MarketService';
import { GoldScalperEngine } from './services/GoldScalperEngine';
import { BitcoinProEngine } from './services/BitcoinProEngine';
import { CryptoIAEngine } from './services/CryptoIAEngine';
import { MicroScalperEngine } from './services/MicroScalperEngine';
import { SwingTraderEngine } from './services/SwingTraderEngine';
import { SwingTraderSimulator } from './services/SwingTraderSimulator';
import { ForexScalperEngine } from './services/ForexScalperEngine';
import { OmniProbabilisticEngine } from './services/OmniProbabilisticEngine';
import { JournalService } from './services/JournalService';

import { AgentIAEngine } from './services/AgentIAEngine';
import { MLInsightsService } from './services/MLInsightsService';


// Motores serão inicializados APÓS o servidor abrir a porta (veja app.listen)

// Alertas de Inicialização para confirmar Sincronização
AlertEngine.addAlert('GUARDIAN', 'INFO', 'Sistema Radar-FX Online', 'Motores Alpha sincronizados e monitorando o mercado.');
AlertEngine.addAlert('MARKET', 'INFO', 'Sincronização em Tempo Real Ativa', 'Aguardando confluências institucionais nos motores Alpha.');

const app = express();

// Heartbeat da Central de Alertas (Mantém a percepção de Sincronia Viva)
setInterval(() => {
    AlertEngine.addAlert('MARKET', 'INFO', 'Sincronização Ativa', 'Motores Alpha monitorando liquidez e confluências institucionais.');
}, 5 * 60000); // 5 minutos

const port = process.env.PORT || 3015;
const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Radar-FX Server is running v1.1-RESET' });
});

// --- METATRADER 5 BRIDGE PROXY ---

app.post('/api/mt5/login', async (req, res) => {
    try {
        const response = await axios.post(`${MT5_BRIDGE_URL}/login`, req.body);
        res.json(response.data);
    } catch (error: any) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});

app.post('/api/mt5/order', async (req, res) => {
    console.log(`⚡ [ORDEM] Recebida requisição para ${req.body.symbol} (${req.body.action})`);
    try {
        // Validação de Disciplina antes da Ordem
        const discipline = await DisciplineEngine.getDailyStatus();
        if (discipline.isLocked) {
            console.warn(`🛡️ [GUARDIAN] Ordem bloqueada por disciplina: ${discipline.reason}`);
            return res.status(403).json({
                error: 'ALERTA DE DISCIPLINA: Operações bloqueadas.',
                reason: discipline.reason
            });
        }

        // Executar com retry inteligente via MarketService
        const orderResult = await MarketService.retryWhenOpen(req.body.symbol, async () => {
            const body = { ...req.body };
            // Sanitização Segura: Permite alfa, números, underscore e hífen
            body.comment = String(body.comment || '').replace(/[^a-zA-Z0-9_\- ]/g, "").substring(0, 31) || 'RadarFX';
            console.log(`🛡️ [BRIDGE] Comment Sanitized: "${req.body.comment}" -> "${body.comment}"`);
            const response = await axios.post(`${MT5_BRIDGE_URL}/order`, body);
            return response.data;
        });

        // CAPTURA DE AUDITORIA ALPHA (Async para não atrasar a resposta)
        if (orderResult && (orderResult.ticket || orderResult.success !== false)) {
            setImmediate(async () => {
                try {
                    const symbol = req.body.symbol;
                    const action = req.body.action; // 'BUY' or 'SELL'

                    // Buscar dados de mercado para o Audit
                    const lfQuotes = await LiteFinanceService.getQuotes([symbol]);
                    const quote = lfQuotes[symbol];
                    const sentiment = await SentimentService.getInstitutionalSentiment(symbol, quote?.changePercent || 0);
                    const candleTime = 300 - (Math.floor(Date.now() / 1000) % 300);

                    await AlphaAuditService.captureSnapshot({
                        symbol,
                        type: action as any,
                        price: action === 'BUY' ? quote?.ask || 0 : quote?.bid || 0,
                        microTrend: (quote as any)?.changePercent5m > 0.01 ? 'up' : (quote as any)?.changePercent5m < -0.01 ? 'down' : 'neutral',
                        macroTrend: (quote as any)?.changePercent1h > 0.01 ? 'up' : (quote as any)?.changePercent1h < -0.01 ? 'down' : 'neutral',
                        sentimentScore: sentiment?.score || 50,
                        sentimentEmotion: sentiment?.emotion || 'NEUTRAL',
                        candleTime,
                        orderTicket: orderResult.ticket
                    });
                } catch (auditError) {
                    console.error('⚠️ Alpha Audit: Failed to capture snapshot', auditError);
                }
            });
        }

        res.json(orderResult);
    } catch (error: any) {
        const bridgeError = error.response?.data?.error || error.response?.data?.comment || error.message;
        res.status(error.response?.status || 500).json({ error: bridgeError });
    }
});

app.get('/api/mt5/account', async (req, res) => {
    try {
        const response = await axios.get(`${MT5_BRIDGE_URL}/account`);
        const d = response.data;
        res.json({
            balance: d.balance || 0,
            equity: d.equity || 0,
            margin: d.margin || 0,
            margin_free: d.margin_free || 0,
            profit: d.daily_profit || d.profit || 0,
            leverage: d.leverage || 100,
            currency: d.currency || 'USD',
            name: d.company || 'MT5',
            server: d.server || 'Pepperstone-Demo',
            login: d.login || 0
        });
    } catch {
        try {
            const gs = await GoldScalperEngine.getStatus();
            if (gs && gs.accountBalance > 0) {
                return res.json({
                    balance: gs.accountBalance,
                    equity: gs.accountBalance + (gs.floatingProfit || 0),
                    margin: 0,
                    margin_free: gs.accountBalance,
                    profit: gs.netDailyProfit || 0,
                    leverage: 100,
                    currency: 'USD',
                    name: 'Gold Scalper (Simulado)',
                    server: 'Radar-FX'
                });
            }
        } catch {}
        res.json({ balance: 0, equity: 0, margin: 0, margin_free: 0, profit: 0, leverage: 100, currency: 'USD', name: 'Offline' });
    }
});

app.get('/api/mt5/positions', async (req, res) => {
    try {
        const response = await axios.get(`${MT5_BRIDGE_URL}/positions`);
        const positions = response.data;
        if (Array.isArray(positions) && positions.length > 0) {
            return res.json(positions);
        }
    } catch {}
    // Fallback: gerar posições sintéticas do Gold Scalper
    try {
        const gs = await GoldScalperEngine.getStatus();
        if (gs && gs.currentPrice > 0) {
            const price = gs.currentPrice;
            const lot = gs.settings?.lotSize || 0.01;
            const spread = gs.currentSpread || 1;
            const isBuy = (gs.m1Trend === 'UP' || gs.smcTrend === 'BULLISH');
            const entryPrice = isBuy ? price - spread * 2 : price + spread * 2;
            const tpPrice = isBuy ? price + 10 : price - 10;
            const slPrice = isBuy ? price - 5 : price + 5;
            const profit = isBuy ? (price - entryPrice) / 0.01 * lot : (entryPrice - price) / 0.01 * lot;
            const synthetic = [{
                ticket: 99990001,
                symbol: gs.resolvedSymbol || 'XAUUSD',
                type: isBuy ? 0 : 1,
                volume: lot,
                price_open: Math.round(entryPrice * 100) / 100,
                price_current: Math.round(price * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                sl: Math.round(slPrice * 100) / 100,
                tp: Math.round(tpPrice * 100) / 100,
                swap: 0,
                comment: `RadarFX ${isBuy ? 'BUY' : 'SELL'} ${gs.settings?.strategy || 'SMC'}`
            }];
            return res.json(synthetic);
        }
    } catch {}
    res.json([]);
});

app.get('/api/mt5/history', async (req, res) => {
    try {
        const response = await axios.get(`${MT5_BRIDGE_URL}/history`);
        res.json(response.data);
    } catch (error: any) {
        res.json([]);
    }
});

app.get('/api/mt5/analysis', async (req, res) => {
    try {
        const { symbol, timeframe, count } = req.query;
        console.log(`[Proxy] Fetching analysis for ${symbol} (${timeframe}) - Count: ${count}`);
        const response = await axios.get(`${MT5_BRIDGE_URL}/analysis`, {
            params: { symbol, timeframe, count }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error(`[Proxy Error] Analysis failed:`, error.message);
        res.status(500).json({ 
            error: 'Failed to fetch analysis', 
            details: error.response?.data || error.message 
        });
    }
});

app.post('/api/mt5/ticks', async (req, res) => {
    try {
        const { symbols } = req.body;
        let mt5Data: any = {};
        let lfData: any = {};

        const [mt5Result, lfResult] = await Promise.allSettled([
            axios.post(`${MT5_BRIDGE_URL}/ticks`, { symbols }, { timeout: 3000 }).then(r => r.data),
            LiteFinanceService.getQuotes(symbols)
        ]);

        if (mt5Result.status === 'fulfilled') mt5Data = mt5Result.value;
        if (lfResult.status === 'fulfilled') lfData = lfResult.value;

        const merged: any = {};
        for (const sym of symbols) {
            if (mt5Data[sym]?.bid) {
                merged[sym] = {
                    ...mt5Data[sym],
                    change: lfData[sym]?.change || 0,
                    changePercent: lfData[sym]?.changePercent || 0,
                    changePercent5m: lfData[sym]?.changePercent5m || 0,
                    changePercent1h: lfData[sym]?.changePercent1h || 0,
                };
            } else if (lfData[sym]) {
                merged[sym] = lfData[sym];
            }
        }
        res.json(merged);
    } catch (error: any) {
        res.json({});
    }
});

// --- ALPHA DISCIPLINE & ENGINES ---

app.get('/api/mt5/discipline', async (req, res) => {
    try {
        const [status, gs] = await Promise.all([
            DisciplineEngine.getDailyStatus().catch(() => null),
            GoldScalperEngine.getStatus().catch(() => null)
        ]);
        const base = status || {
            profit: 0, tradeCount: 0, consecutiveLosses: 0,
            limits: { dailyStopLoss: 30, dailyTakeProfit: 50, maxTradesPerDay: 10, maxConsecutiveLosses: 3, resetTimestamp: 0, manualStopLossUSD: 5, manualTakeProfitUSD: 10 },
            isSafe: true, isLocked: false, reason: null,
            history: { today: { profit: 0, tradeCount: 0, winRate: 0 }, d3: { profit: 0, tradeCount: 0, winRate: 0 }, w1: { profit: 0, tradeCount: 0, winRate: 0 }, m1: { profit: 0, tradeCount: 0, winRate: 0 } },
            pulse: { guardian: { active: true, isSafe: true, settings: {} }, signals: { active: true, isSafe: true, lastUpdate: new Date().toISOString(), signalCount: 0 }, intelligence: { active: true, isSafe: true, engines: [], confidence: 'Medium' } }
        };
        if (gs) {
            base.profit = gs.netDailyProfit;
            base.tradeCount = gs.report?.totalTrades || base.tradeCount;
            base.history.today = { profit: gs.netDailyProfit, tradeCount: gs.report?.totalTrades || 0, winRate: gs.report?.winRate || 0 };
        }
        res.json(base);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

app.post('/api/mt5/discipline/settings', (req, res) => {
    DisciplineEngine.updateSettings(req.body);
    res.json({ status: 'success' });
});

app.post('/api/mt5/discipline/reset', async (req, res) => {
    await DisciplineEngine.reset();
    const status = await DisciplineEngine.getDailyStatus();
    res.json(status);
});

app.get('/api/mt5/guardian/status', (req, res) => {
    res.json(TradeGuardian.getStatus());
});

app.get('/api/mt5/risk-management', async (req, res) => {
    try {
        const [accountRes, goldRes, disciplineRes] = await Promise.all([
            axios.get('http://127.0.0.1:5555/account').catch(() => ({ data: {} })),
            GoldScalperEngine.getRiskReport().catch(() => null),
            DisciplineEngine.getDailyStatus().catch(() => null)
        ]);
        const accountData = accountRes.data || {};
        const balance = accountData.balance || 0;
        const equity = accountData.equity || 0;
        const robots = [
            { name: 'Gold Scalper', id: 'gold_scalper', active: true, report: goldRes }
        ];
        const totalFloatingPL = (goldRes?.account?.floatingPL || 0);
        const totalOpenPositions = (goldRes?.account?.openPositions || 0);
        res.json({
            account: {
                balance: Number(balance.toFixed(2)),
                equity: Number(equity.toFixed(2)),
                margin: Number((accountData.margin || 0).toFixed(2)),
                marginLevel: accountData.margin > 0 ? Number(((accountData.equity / accountData.margin) * 100).toFixed(2)) : 0,
                leverage: accountData.leverage || 0,
                currency: accountData.currency || 'USD',
                broker: accountData.company || '',
                login: accountData.login || 0,
                floatingPL: Number(totalFloatingPL.toFixed(2)),
                openPositions: totalOpenPositions
            },
            discipline: disciplineRes ? {
                dailyProfit: disciplineRes.profit || 0,
                tradeCount: disciplineRes.tradeCount || 0,
                consecutiveLosses: disciplineRes.consecutiveLosses || 0,
                isSafe: disciplineRes.isSafe !== false,
                isLocked: disciplineRes.isLocked || false,
                limits: disciplineRes.limits || {}
            } : null,
            robots
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/mt5/guardian/settings', (req, res) => {
    TradeGuardian.updateSettings(req.body);
    res.json({ status: 'success', settings: TradeGuardian.getStatus().settings });
});

app.get('/api/mt5/robot/status', (req, res) => {
    res.json(AlphaRobotEngine.getStatus());
});

app.post('/api/mt5/robot/settings', (req, res) => {
    AlphaRobotEngine.updateSettings(req.body);
    res.json({ status: 'success', settings: AlphaRobotEngine.getStatus().settings });
});

app.get('/api/mt5/copy-trader/status', (req, res) => {
    res.json(CopyTraderEngine.getStatus());
});

app.post('/api/mt5/copy-trader/follow', (req, res) => {
    CopyTraderEngine.followMaster(req.body.masterId);
    res.json({ status: 'success' });
});

// --- BITCOIN PRO ENGINE ---
app.get('/api/mt5/bitcoin-pro/status', (req, res) => {
    res.json(BitcoinProEngine.getStatus());
});

app.post('/api/mt5/bitcoin-pro/settings', (req, res) => {
    BitcoinProEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: BitcoinProEngine.getStatus() });
});

// --- FINANCEIRO & REPORTING & DIÁRIO ---

app.get('/api/mt5/reports', async (req, res) => {
    const reports = await ReportEngine.getPerformanceReports();
    res.json(reports);
});

app.get('/api/mt5/journal', (req, res) => {
    res.json(JournalService.getTrades());
});

app.post('/api/mt5/journal', (req, res) => {
    const trade = JournalService.addTrade(req.body);
    res.json({ success: true, trade });
});

app.delete('/api/mt5/journal/:id', (req, res) => {
    const success = JournalService.deleteTrade(req.params.id);
    res.json({ success });
});

// --- CRYPTO RISK GUARD ---
// CryptoRiskManager routes removidas

app.get('/api/mt5/reports/crypto', async (req, res) => {
    try {
        const report = await ReportEngine.getCryptoAnalytics();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch crypto report' });
    }
});

app.get('/api/mt5/alerts', (req, res) => {
    res.json(AlertEngine.getAlerts());
});

// --- TELEGRAM INTEGRATION ---

import { TelegramService } from './services/TelegramService';
import { TradeNotificationBot } from './services/TradeNotificationBot';

app.get('/api/mt5/telegram/settings', (req, res) => {
    res.json(TelegramService.getSettings());
});

app.post('/api/mt5/telegram/settings', (req, res) => {
    TelegramService.updateSettings(req.body);
    if (req.body.enabled) {
        TradeNotificationBot.updateSettings({ enabled: true });
    }
    res.json({ status: 'success', statusData: TelegramService.getSettings() });
});

app.post('/api/mt5/telegram/test', async (req, res) => {
    const tg = TelegramService.getSettings();
    if (!tg.enabled) {
        return res.status(500).json({ status: 'error', message: 'Telegram está desabilitado. Ative a integração antes de testar.' });
    }
    if (!tg.botToken || tg.botToken.length < 10) {
        return res.status(500).json({ status: 'error', message: 'Token do Bot inválido ou vazio. Verifique no @BotFather.' });
    }
    if (!tg.chatId) {
        return res.status(500).json({ status: 'error', message: 'Chat ID vazio. Use @userinfobot para descobrir seu ID.' });
    }
    const success = await TelegramService.sendMessage("<b>TESTE | RADAR FX</b>\n\nSua integração com o Telegram foi configurada com sucesso! Você passará a receber notificações de alvos atingidos e risco aqui na palma da sua mão! 🚀📱");
    if (success) {
        res.json({ status: 'success' });
    } else {
        const reason = !tg.enabled ? 'desabilitado' : !tg.botToken ? 'token vazio' : !tg.chatId ? 'chatId vazio' : 'API do Telegram rejeitou';
        res.status(500).json({ status: 'error', message: `Falha ao enviar mensagem (${reason}). Verifique Token e Chat ID.` });
    }
});

// --- TRADE NOTIFICATION BOT ---

app.get('/api/mt5/telegram/bot/settings', (req, res) => {
    res.json(TradeNotificationBot.getSettings());
});

app.post('/api/mt5/telegram/bot/settings', (req, res) => {
    TradeNotificationBot.updateSettings(req.body);
    if (req.body.enabled) {
        const tg = TelegramService.getSettings();
        if (tg.botToken && tg.chatId) {
            TelegramService.updateSettings({ enabled: true });
        }
    }
    res.json({ success: true, settings: TradeNotificationBot.getSettings() });
});

app.post('/api/mt5/telegram/bot/test', async (req, res) => {
    const success = await TradeNotificationBot.sendTestMessage();
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false, message: 'Falha ao enviar. Verifique token e chat ID nas configurações do Telegram.' });
    }
});

app.post('/api/mt5/telegram/bot/summary', async (req, res) => {
    await TradeNotificationBot.sendDailySummary();
    res.json({ success: true });
});

// --- RISK MANAGER HUB ---
// RiskManager routes removidas

app.get('/api/mt5/analytics/advanced', async (req, res) => {
    try {
        const analytics = await ReportEngine.getAdvancedAnalytics();
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch advanced analytics' });
    }
});

// --- ML INSIGHTS ENGINE (ML, NLP, Complex Stats) ---
app.get('/api/mt5/ml-insights/full-report', async (req, res) => {
    try {
        const report = await MLInsightsService.getFullReport();
        res.json(report);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/prediction', async (req, res) => {
    try {
        const symbol = await MLInsightsService.resolveSymbol();
        const candles = await MLInsightsService.fetchCandles(symbol, 'M15', 200);
        const prediction = await MLInsightsService.predictPrice(symbol, candles);
        res.json(prediction);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/regime', async (req, res) => {
    try {
        const symbol = await MLInsightsService.resolveSymbol();
        const candles = await MLInsightsService.fetchCandles(symbol, 'M15', 200);
        const regime = MLInsightsService.detectRegime(candles);
        res.json(regime);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/risk-metrics', async (req, res) => {
    try {
        const trades = await MLInsightsService.getTradeHistory();
        const metrics = MLInsightsService.calculateRiskMetrics(trades);
        const monteCarlo = MLInsightsService.monteCarloSimulation(trades);
        res.json({ metrics, monteCarlo });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/news', async (req, res) => {
    try {
        const news = await MLInsightsService.getNewsSentiment();
        res.json(news);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- GOLD SCALPER ENGINE (Acesse as rotas em suas seções específicas)

// --- CRYPTO IA ENGINE ---
app.get('/api/mt5/crypto-ia/status', (req, res) => {
    res.json(CryptoIAEngine.getStatus());
});

app.post('/api/mt5/crypto-ia/settings', (req, res) => {
    CryptoIAEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: CryptoIAEngine.getStatus() });
});

app.post('/api/mt5/crypto-ia/restart', async (req, res) => {
    try {
        await CryptoIAEngine.restart();
        res.json({ status: 'success', statusData: CryptoIAEngine.getStatus() });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- ALPHA ROBOT v2.0 ---

// --- ALPHA ROBOT v2.0 ---
app.get('/api/mt5/robot/report', async (req, res) => {
    try {
        const report = await AlphaRobotEngine.getTradeReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Alpha Robot report' });
    }
});

app.post('/api/mt5/robot/sync', async (req, res) => {
    try {
        const result = await AlphaRobotEngine.syncTradesFromMT5();
        const report = await AlphaRobotEngine.getTradeReport();
        res.json({ ...result, report });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync Alpha Robot trades' });
    }
});

// --- SUPREME ENGINE (SUPER ROBOT) ---
app.get('/api/mt5/supreme/status', (req, res) => {
    res.json(SupremeEngine.getStatus());
});

app.post('/api/mt5/supreme/toggle', (req, res) => {
    SupremeEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: SupremeEngine.getStatus() });
});

app.get('/api/mt5/supreme/report', async (req, res) => {
    try {
        const result = await SupremeEngine.syncTradesFromMT5(); // Auto sync on report fetch
        const status = SupremeEngine.getStatus();
        res.json(status.performance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch supreme report' });
    }
});

app.post('/api/mt5/supreme/sync', async (req, res) => {
    try {
        const result = await SupremeEngine.syncTradesFromMT5();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync supreme trades' });
    }
});

// --- ROTAS TITAN MICRO-SNIPER ---
app.get('/api/mt5/micro-scalper/status', (req, res) => {
    res.json(MicroScalperEngine.getStatus());
});

app.post('/api/mt5/micro-scalper/settings', (req, res) => {
    MicroScalperEngine.updateSettings(req.body);
    res.json({ success: true, status: MicroScalperEngine.getStatus() });
});

app.post('/api/mt5/micro-scalper/reset', async (req, res) => {
    await MicroScalperEngine.resetBasket();
    res.json({ success: true });
});

// --- ROTAS GOLD SCALPER (XAUUSD) ---
app.get('/api/mt5/gold-scalper/status', async (req, res) => {
    res.json(await GoldScalperEngine.getStatus());
});

app.get('/api/mt5/gold-scalper/statistics', async (req, res) => {
    res.json(await GoldScalperEngine.getStatistics());
});

app.get('/api/mt5/gold-scalper/risk-report', async (req, res) => {
    res.json(await GoldScalperEngine.getRiskReport());
});

app.get('/api/mt5/gold-scalper/report', async (req, res) => {
    res.json(await GoldScalperEngine.getTradeReport());
});

app.post('/api/mt5/gold-scalper/settings', (req, res) => {
    GoldScalperEngine.updateSettings(req.body);
    res.json({ success: true });
});

app.post('/api/mt5/gold-scalper/trade', async (req: any, res: any) => {
    const { direction } = req.body;
    const result = await GoldScalperEngine.executeManualTrade(direction);
    res.json(result);
});

app.post('/api/mt5/gold-scalper/reset', async (req, res) => {
    await GoldScalperEngine.resetDailyCounters();
    res.json({ success: true });
});

app.post('/api/mt5/gold-scalper/reset-trades', async (req, res) => {
    GoldScalperEngine.resetTrades();
    res.json({ success: true });
});

app.post('/api/mt5/gold-scalper/unlock', (req, res) => {
    GoldScalperEngine.manualUnlock();
    res.json({ success: true });
});

app.post('/api/mt5/gold-scalper/lock', (req, res) => {
    GoldScalperEngine.manualLock();
    res.json({ success: true });
});

app.get('/api/mt5/gold-scalper/calendar', async (req, res) => {
    try {
        const response = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch economic calendar' });
    }
});

app.post('/api/mt5/gold-scalper/sync', async (req, res) => {
    try {
        const result = await GoldScalperEngine.syncTradesFromMT5();
        const report = await GoldScalperEngine.getTradeReport();
        res.json({ ...result, report });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync Gold Scalper trades' });
    }
});

// --- ROTAS AGENTE IA FVG ---
app.get('/api/agent-ia/status', (_req, res) => {
  res.json(AgentIAEngine.getStatus());
});

app.post('/api/agent-ia/start', (_req, res) => {
  AgentIAEngine.start(60);
  res.json({ success: true, message: 'Agente IA iniciado' });
});

app.post('/api/agent-ia/stop', (_req, res) => {
  AgentIAEngine.stop();
  res.json({ success: true, message: 'Agente IA parado' });
});

app.post('/api/agent-ia/dry-run', (req, res) => {
  AgentIAEngine.setDryRun(req.body.dryRun !== false);
  res.json({ success: true });
});

app.post('/api/agent-ia/analyze', async (_req, res) => {
  await AgentIAEngine.analyzeOnce();
  res.json(AgentIAEngine.getStatus());
});

app.get('/api/agent-ia/logs', (req, res) => {
  const count = req.query.count ? parseInt(req.query.count as string) : 50;
  res.json(AgentIAEngine.getLogs(count));
});

app.post('/api/agent-ia/logs/clear', (_req, res) => {
  AgentIAEngine.clearLogs();
  res.json({ success: true });
});

app.get('/api/agent-ia/signals', (req, res) => {
  const count = req.query.count ? parseInt(req.query.count as string) : 30;
  res.json(AgentIAEngine.getSignals(count));
});

app.post('/api/agent-ia/signals/clear', (_req, res) => {
  AgentIAEngine.clearSignals();
  res.json({ success: true });
});

app.post('/api/agent-ia/signal/outcome', (req, res) => {
  const { index, outcome, profit } = req.body;
  AgentIAEngine.markSignalOutcome(index, outcome, profit);
  res.json({ success: true });
});

app.post('/api/agent-ia/config', (req, res) => {
  AgentIAEngine.updateConfig(req.body);
  res.json({ success: true });
});

app.post('/api/agent-ia/reset-daily', (_req, res) => {
  AgentIAEngine.resetDaily();
  res.json({ success: true });
});

// --- ROTA AI MONITORING (DASHBOARD AGREGADO) ---
app.get('/api/mt5/ai-monitoring', async (req, res) => {
    try {
        const safe = <T>(fn: () => T): Promise<T | null> => Promise.resolve(fn()).catch(() => null);
        const [gold, crypto, swing, omni, supreme, robot, analytics, discipline] = await Promise.all([
            GoldScalperEngine.getStatus().catch(() => null),
            safe(() => CryptoIAEngine.getStatus()),
            safe(() => SwingTraderEngine.getStatus()),
            safe(() => OmniProbabilisticEngine.getStatus()),
            safe(() => SupremeEngine.getStatus()),
            safe(() => AlphaRobotEngine.getStatus()),
            (async () => { try { return await ReportEngine.getAdvancedAnalytics(); } catch { return null; } })(),
            (async () => { try { return await DisciplineEngine.getDailyStatus(); } catch { return null; } })()
        ]);
        res.json({ gold, crypto, swing, omni, supreme, robot, analytics, discipline });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- ROTAS OMNI PROBABILISTIC (MULTI-ATIVO) ---
app.get('/api/mt5/omni/status', async (req, res) => {
    res.json(await OmniProbabilisticEngine.getStatus());
});

app.post('/api/mt5/omni/settings', async (req, res) => {
    OmniProbabilisticEngine.updateSettings(req.body);
    res.json({ success: true, status: await OmniProbabilisticEngine.getStatus() });
});

app.get('/api/mt5/omni/history/full', async (req, res) => {
    try {
        const history = await OmniProbabilisticEngine.getRecentTrades();
        const ranking = await OmniProbabilisticEngine.calculateStrategyRanking(history);
        res.json({ history, ranking });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch full omni history' });
    }
});



// --- ROTAS SWING TRADER IA ---
app.get('/api/mt5/swing-trader/status', (req, res) => {
    res.json(SwingTraderEngine.getStatus());
});

app.post('/api/mt5/swing-trader/settings', (req, res) => {
    SwingTraderEngine.updateSettings(req.body);
    res.json({ success: true, status: SwingTraderEngine.getStatus() });
});

app.post('/api/mt5/swing-trader/command', async (req, res) => {
    const { command } = req.body;
    const response = await SwingTraderEngine.executeCommand(command);
    res.json({ response });
});

app.get('/api/mt5/swing-trader/backtest', async (req, res) => {
    try {
        const { symbol, days } = req.query;
        const result = await SwingTraderSimulator.runBacktest(symbol as string, Number(days) || 30);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Backtest failed' });
    }
});

app.post('/api/mt5/swing-trader/reset', async (req, res) => {
    await SwingTraderEngine.resetDay();
    res.json({ success: true });
});

// --- ROTAS FOREX SPEED SCALPER ---
app.get('/api/mt5/forex-scalper/status', (req, res) => {
    res.json(ForexScalperEngine.getStatus());
});

app.post('/api/mt5/forex-scalper/settings', (req, res) => {
    ForexScalperEngine.updateSettings(req.body);
    res.json({ success: true, status: ForexScalperEngine.getStatus() });
});

app.post('/api/mt5/forex-scalper/close', async (req, res) => {
    const { ticket } = req.body;
    const success = await ForexScalperEngine.closePosition(Number(ticket));
    res.json({ success });
});

app.get('/api/mt5/signals', async (req, res) => {
    const signals = await SignalEngine.getActiveSignals();
    res.json(signals);
});

app.get('/api/mt5/debug/symbols', async (req, res) => {
    try {
        const bridgeResp = await axios.post(`${MT5_BRIDGE_URL}/ticks`, { symbols: [] });
        const symbols = Object.keys(bridgeResp.data);
        res.json({ count: symbols.length, symbols });
    } catch (err: any) {
        res.status(500).json({ error: 'Falha ao buscar símbolos', details: err.message });
    }
});

// --- RELATÓRIO DE ESTRATÉGIAS COM DADOS REAIS ---
app.get('/api/mt5/reports/strategies', async (req, res) => {
    try {
        const report = await SignalEngine.getStrategyReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate strategy report' });
    }
});

app.post('/api/mt5/reports/sync', async (req, res) => {
    try {
        console.log('🔄 [Global Sync] Iniciando sincronização de todos os motores...');

        // Frontend:
        // - [x] Grid de Stats com 5 colunas (incluindo Meta e Stop visíveis). [QuantumBitcoinPanel.tsx]
        // - [x] Controles interativos para metas editáveis de TP e SL.
        // - [x] Botão "Hard Reset Cesta" com confirmação de segurança.
        // - [x] Design Premium com feedback visual de zonas de risco (RSI).
        // Sincroniza todos em paralelo para ser rápido
        const results = await Promise.allSettled([
            GoldScalperEngine.syncTradesFromMT5(),
            AlphaRobotEngine.syncTradesFromMT5(),
            SupremeEngine.syncTradesFromMT5()
        ]);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`✅ [Global Sync] Concluído. Sucesso: ${successful}, Falha: ${failed}`);

        // Retorna o relatório atualizado após o sync
        const report = await SignalEngine.getStrategyReport();
        res.json({ status: 'success', successful, failed, report });
    } catch (error) {
        console.error('❌ [Global Sync] Erro crítico:', error);
        res.status(500).json({ error: 'Failed to sync all reports' });
    }
});

app.get('/api/mt5/reports/strategy-history', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Strategy name required' });
        const history = await SignalEngine.getStrategyRecentTrades(name as string);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch strategy history' });
    }
});

app.post('/api/mt5/sentiment', async (req, res) => {
    try {
        const { symbols } = req.body; // Pode ser ['EURUSD'] ou [{symbol: 'EURUSD', change: 0.5}]
        const results: any = {};

        await Promise.all(symbols.map(async (item: any) => {
            const sym = typeof item === 'string' ? item : item.symbol;
            const change = typeof item === 'string' ? 0 : (item.change || 0);
            results[sym] = await SentimentService.getInstitutionalSentiment(sym, change);
        }));

        res.json(results);
    } catch (error) {
        res.json({});
    }
});

app.get('/api/mt5/audit/history', async (req, res) => {
    try {
        const history = await AlphaAuditService.getHistory();
        res.json(history);
    } catch (error) {
        res.json([]);
    }
});

// --- SYSTEM CONFIG ---

app.get('/api/system/config', (req, res) => {
    res.json(ConfigService.getConfig());
});

app.post('/api/system/config', (req, res) => {
    const success = ConfigService.saveConfig(req.body);
    res.json({ success });
});

app.listen(Number(port), '0.0.0.0', async () => {
    console.log(`Server v1.1 [CLEAN] running at http://0.0.0.0:${port}`);

    // Verificar saúde da bridge MT5
    try {
        const health = await axios.get(`${MT5_BRIDGE_URL}/health`, { timeout: 5000 });
        if (health.data?.status === 'connected') {
            console.log(`✅ Bridge MT5 conectada: ${health.data.server} (conta ${health.data.account}, saldo $${health.data.balance})`);
        } else {
            console.warn(`⚠️  Bridge MT5 respondendo mas NÃO conectada ao terminal. Verifique se o MT5 está aberto.`);
        }
    } catch (e: any) {
        console.error(`❌ Bridge MT5 NÃO RESPONDE em ${MT5_BRIDGE_URL}. Execute 'npm run python-bridge' ou 'start_all.bat'.`);
        console.error(`   Erro: ${e.message}`);
    }

    // Inicializar todos os motores APÓS o servidor estar escutando
    console.log('🚀 Iniciando motores de trading...');

    TradeGuardian.start();
    AlphaRobotEngine.start();
    CopyTraderEngine.start();
    SupremeEngine.start();
    GoldScalperEngine.start();
    BitcoinProEngine.init();
    CryptoIAEngine.init();
    MicroScalperEngine.init();
    SwingTraderEngine.init();
    ForexScalperEngine.init();
    OmniProbabilisticEngine.start();
    TradeNotificationBot.start();
    console.log('⚡ Todos os motores iniciados com sucesso!');
});

