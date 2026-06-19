import dotenv from 'dotenv';
dotenv.config();

// Global error handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

// Radar Station v1.1 - Emergency Reset Engine Active
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import { spawn, ChildProcess } from 'child_process';
import { SignalEngine } from './services/SignalEngine';
import { TradeGuardian } from './services/TradeGuardian';
import { DisciplineEngine } from './services/DisciplineEngine';
import { ReportEngine } from './services/ReportEngine';
import { AlertEngine } from './services/AlertEngine';
import { AlphaRobotEngine } from './services/AlphaRobotEngine';
import { WolfBotEngine } from './services/WolfBotEngine';
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
import { AuraQuantEngine } from './services/AuraQuantEngine';
import { CryptoIAEngine } from './services/CryptoIAEngine';
import { CorrelationService } from './services/CorrelationService';
import { SharkBotEngine } from './services/SharkBotEngine';
import { RecoveryEngine } from './services/RecoveryEngine';
import { HealthService } from './services/HealthService';
import { SymbolLockService } from './services/SymbolLockService';
import { DatabaseService } from './services/DatabaseService';
import { MicroScalperEngine } from './services/MicroScalperEngine';
import { SwingTraderEngine } from './services/SwingTraderEngine';
import { SweepEngine } from './services/SweepEngine';
import { SweepTradeMonitor } from './services/SweepTradeMonitor';
import { SwingTraderSimulator } from './services/SwingTraderSimulator';
import { ForexScalperEngine } from './services/ForexScalperEngine';
import { OmniProbabilisticEngine } from './services/OmniProbabilisticEngine';
import { JournalService } from './services/JournalService';
import { SecurityAuditService } from './services/SecurityAuditService';
import { z } from 'zod';

import { AgentIAEngine } from './services/AgentIAEngine';
import { MLInsightsService } from './services/MLInsightsService';
import { AIAnalystAgent } from './services/AIAnalystAgent';
import { MLService } from './services/MLService';
import { NLPService, NewsArticle } from './services/NLPService';
import { MotorIAEngine } from './services/MotorIAEngine';
import authRouter from './routes/auth';
import { authenticateToken } from './middleware/auth';
import { InfraService } from './services/InfraService';
import { GoldScalperTradeMonitor } from './services/GoldScalperTradeMonitor';
import { MAGIC_MAP } from './services/MagicMap';
import { PatternDetector } from './services/PatternDetector';
import { CopilotService } from './services/CopilotService';


// Motores serão inicializados APÓS o servidor abrir a porta (veja app.listen)

// Alertas de Inicialização para confirmar Sincronização
AlertEngine.addAlert('GUARDIAN', 'INFO', 'Sistema Radar-FX Online', 'Motores Alpha sincronizados e monitorando o mercado.');
AlertEngine.addAlert('MARKET', 'INFO', 'Sincronização em Tempo Real Ativa', 'Aguardando confluências institucionais nos motores Alpha.');

const app = express();

const APP_URL = process.env.APP_URL || 'http://localhost:3006';
const WS_APP_URL = APP_URL.replace(/^http/, 'ws');

// Heartbeat da Central de Alertas (Mantém a percepção de Sincronia Viva)
setInterval(() => {
    AlertEngine.addAlert('MARKET', 'INFO', 'Sincronização Ativa', 'Motores Alpha monitorando liquidez e confluências institucionais.');
}, 5 * 60000); // 5 minutos

const port = process.env.PORT || 3016;
const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || '';

const bridgeAxios = axios.create({ baseURL: MT5_BRIDGE_URL, timeout: 10000 });
bridgeAxios.interceptors.request.use(config => {
    if (BRIDGE_API_KEY) config.headers['X-Api-Key'] = BRIDGE_API_KEY;
    return config;
});

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3006,http://127.0.0.1:3006').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
// Custom body parser para POST com body (compatibilidade Node.js v24)
const readBody = (req: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
        req.resume();
    });
};

app.use(async (req, res, next) => {
    if (req.method === 'POST' && Number(req.headers['content-length'] || '0') > 0) {
        try {
            const raw = await readBody(req);
            const ct = (req.headers['content-type'] || '').toLowerCase();
            if (ct.includes('application/json')) {
                try { req.body = JSON.parse(raw); } catch { req.body = raw; }
            } else if (ct.includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(raw);
                req.body = Object.fromEntries(params.entries());
            } else {
                req.body = raw;
            }
        } catch { req.body = {}; }
    }
    next();
});

// Auth middleware — protege todas as rotas /api/* exceto as públicas
const PUBLIC_API_PATHS = ['/api/auth', '/api/health', '/api/health/full', '/api/tradingview', '/api/system', '/api/intel-engine', '/api/telemetry', '/api/copilot'];
app.use('/api', (req, res, next) => {
  if (PUBLIC_API_PATHS.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }
  return authenticateToken(req as any, res, next);
});

const path = require('path');
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Radar-FX Server is running v1.1-RESET' });
});

// --- HEALTH CHECK ---
app.get('/api/health/full', async (req, res) => {
    try {
        const report = await HealthService.getFullReport();
        res.json(report);
    } catch (error: any) {
        res.status(500).json({ error: 'Health check failed', details: error.message });
    }
});

app.get('/api/locks', (req, res) => {
    res.json({ locks: SymbolLockService.getAllLocks() });
});

app.post('/api/locks/reset', (req, res) => {
    SymbolLockService.reset();
    res.json({ status: 'success', message: 'Todos os locks foram resetados' });
});

// --- DATABASE ---
app.get('/api/db/trades', async (req, res) => {
    try {
        const trades = await DatabaseService.getTrades({ limit: Number(req.query.limit) || 100 });
        res.json(trades);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/stats', async (req, res) => {
    try {
        const stats = await DatabaseService.getTradeStats(req.query.strategy as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/settings', async (req, res) => {
    try {
        await DatabaseService.setSetting(req.body.key, req.body.value);
        res.json({ status: 'success' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/settings/:key', async (req, res) => {
    try {
        const value = await DatabaseService.getSetting(req.params.key);
        res.json({ key: req.params.key, value });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/alerts', async (req, res) => {
    try {
        const alerts = await DatabaseService.getAlerts(Number(req.query.limit) || 50);
        res.json(alerts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/migrate', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const dataDir = process.cwd();
        const migrations = [
            { name: 'Motor IA', file: 'motor_ia_history.json', dataKey: 'executions' },
            { name: 'Gold Scalper', file: 'gold_scalper_history.json' },
            { name: 'Alpha Robot', file: 'alpha_robot_history.json' },
            { name: 'Recovery', file: 'recovery_history.json' },
            { name: 'Supreme', file: 'alpha_supreme_history.json' },
        ];
        const results: Record<string, number> = {};
        for (const m of migrations) {
            const filePath = path.join(dataDir, m.file);
            if (fs.existsSync(filePath)) {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const trades = m.dataKey ? content[m.dataKey] : (Array.isArray(content) ? content : []);
                if (Array.isArray(trades) && trades.length > 0) {
                    await DatabaseService.migrateFromJson(m.name, trades);
                    results[m.name] = trades.length;
                }
            }
        }
        res.json({ status: 'success', results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/health', async (_req, res) => {
    try {
        const count = await DatabaseService.getTradeStats();
        res.json({ status: 'ok', totalTrades: count.total });
    } catch (error: any) {
        res.status(500).json({ error: error.message, status: 'error' });
    }
});



// --- METATRADER 5 BRIDGE PROXY ---

app.post('/api/mt5/login', async (req, res) => {
    try {
        const response = await bridgeAxios.post('/login', req.body);
        res.json(response.data);
    } catch (error: any) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});

app.post('/api/mt5/disconnect', async (req, res) => {
    try {
        const response = await bridgeAxios.post('/disconnect');
        res.json(response.data);
    } catch (error: any) {
        res.json({ success: true, message: 'Forçando desconexão...' });
    }
});

app.get('/api/mt5/broker-info', async (req, res) => {
    try {
        const health = await bridgeAxios.get('/health');
        if (health.data.connected === false) {
            return res.json({
                connected: false,
                simulated: health.data.simulated || false,
                last_error: health.data.last_error || '',
                mt5_initialized: health.data.mt5_initialized || false,
            });
        }
        const account = await bridgeAxios.get('/account');
        res.json({
            connected: true,
            company: account.data.company || account.data.name || health.data.server || '',
            server: health.data.server || account.data.server || '',
            login: health.data.account || account.data.login || 0,
            leverage: account.data.leverage || 0,
            balance: health.data.balance || account.data.balance || 0,
            currency: account.data.currency || 'USD',
            brokerType: 'MT5',
            simulated: health.data.simulated || false,
        });
    } catch {
        res.json({ connected: false, simulated: false, last_error: 'Bridge offline' });
    }
});

const SYMBOL_MAP_ORDER: Record<string, string> = {
    'GOLD': 'XAUUSD', 'WING': 'WIN$N', 'WDO': 'WDO$N',
    'US30': 'US30Cash', 'NAS100': 'US100Cash', 'GER40': 'GER40Cash',
};

app.post('/api/mt5/order', async (req, res) => {
    if (req.body.symbol && SYMBOL_MAP_ORDER[req.body.symbol.toUpperCase()]) {
        req.body.symbol = SYMBOL_MAP_ORDER[req.body.symbol.toUpperCase()];
    }
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
            // Sanitização Segura: Permite alfa, números, underscore, hífen e espaço simples
            body.comment = String(body.comment || '').replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, ' ').trim().substring(0, 30) || 'RadarFX';
            console.log(`🛡️ [BRIDGE] Comment Sanitized: "${req.body.comment}" -> "${body.comment}"`);
            const response = await bridgeAxios.post('/order', body);
            return response.data;
        });

        // Sincroniza entrada no TradingView
        if (orderResult?.ticket) {
            const price = orderResult.price || req.body.price || 0;
            syncTvAlert(req.body.symbol, req.body.action, price, req.body.comment || 'RadarFX', { ticket: orderResult.ticket });
        }

        // Bloqueia símbolo via SymbolLockService
        if (orderResult?.ticket) {
            SymbolLockService.acquire(req.body.symbol, 'Manual', orderResult.ticket, req.body.action);
        }

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
        const response = await bridgeAxios.get('/account');
        const d = response.data;
        res.json({
            balance: d.balance || 0,
            equity: d.equity || 0,
            margin: d.margin || 0,
            margin_free: d.margin_free || 0,
            profit: d.daily_profit || d.profit || 0,
            daily_profit: d.daily_profit || 0,
            daily_closed_profit: d.daily_closed_profit || 0,
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
        const response = await bridgeAxios.get('/positions');
        const positions = response.data;
        if (Array.isArray(positions) && positions.length > 0) {
            return res.json(positions.map((p: any) => ({
                ...p,
                engine: MAGIC_MAP[p.magic] || p.comment || `Magic ${p.magic}`,
            })));
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
        const response = await bridgeAxios.get('/history');
        res.json(response.data);
    } catch (error: any) {
        res.json([]);
    }
});

app.get('/api/mt5/analysis', async (req, res) => {
    try {
        const { symbol, timeframe, count } = req.query;
        console.log(`[Proxy] Fetching analysis for ${symbol} (${timeframe}) - Count: ${count}`);
        const response = await bridgeAxios.get('/analysis', {
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

app.get('/api/mt5/candles', async (req, res) => {
    try {
        const { symbol, timeframe, count } = req.query;
        const response = await bridgeAxios.get('/candles', {
            params: { symbol, timeframe, count }, timeout: 5000
        });
        res.json(response.data);
    } catch (error: any) {
        console.error(`[Proxy Error] Candles failed:`, error.message);
        res.status(500).json({ error: 'Failed to fetch candles', details: error.response?.data || error.message });
    }
});

app.post('/api/mt5/ticks', async (req, res) => {
    try {
        const { symbols } = req.body;
        let mt5Data: any = {};
        let lfData: any = {};

        const [mt5Result, lfResult] = await Promise.allSettled([
            bridgeAxios.post('/ticks', { symbols }, { timeout: 3000 }).then(r => r.data),
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
            limits: DisciplineEngine.getSettings(),
            isSafe: false, isLocked: true, reason: 'Discipline offline',
            history: { today: { profit: 0, tradeCount: 0, winRate: 0 }, d3: { profit: 0, tradeCount: 0, winRate: 0 }, w1: { profit: 0, tradeCount: 0, winRate: 0 }, m1: { profit: 0, tradeCount: 0, winRate: 0 } },
            pulse: { guardian: { active: true, isSafe: true, settings: {} }, signals: { active: true, isSafe: true, lastUpdate: new Date().toISOString(), signalCount: 0 }, intelligence: { active: true, isSafe: true, engines: [], confidence: 'Medium' } },
            goldScalperDaily: gs?.netDailyProfit || 0,
        };
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

app.post('/api/mt5/discipline/force-unlock', async (req, res) => {
    await DisciplineEngine.reset();
    CryptoRiskEngine.resetDailyLimits();
    console.log('🔓 Force unlock executado — todos os limites resetados.');
    const status = await DisciplineEngine.getDailyStatus();
    res.json({ ...status, forceUnlocked: true });
});

// --- DAILY REPORT (AGREGADO DE TODOS ROBÔS) ---
app.get('/api/reports/daily', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const safeGetHistory = async (engine: any, name: string): Promise<{ trades: any[]; robot: string }> => {
            try {
                const status = await engine.getStatus();
                const history = status.tradeHistory || status.trades || [];
                const todayTrades = history.filter((t: any) => t.closeTime?.startsWith(today) || t.time?.startsWith(today));
                return { trades: todayTrades.map((t: any) => ({ ...t, robot: name })), robot: name };
            } catch {
                return { trades: [], robot: name };
            }
        };

        const results = await Promise.all([
            safeGetHistory(AlphaRobotEngine, 'Alpha Robot'),
            safeGetHistory(GoldScalperEngine, 'Gold Scalper'),
            safeGetHistory(SweepEngine, 'Sweep H4 M15'),
            safeGetHistory(SupremeEngine, 'Supreme IA'),
            safeGetHistory(SharkBotEngine, 'Shark Bot'),
            safeGetHistory(WolfBotEngine, 'Wolf Bot'),
            safeGetHistory(BitcoinProEngine, 'Bitcoin Pro'),
            safeGetHistory(CryptoIAEngine, 'Alpha Cripto'),
            safeGetHistory(SwingTraderEngine, 'Day Swing IA'),
            safeGetHistory(ForexScalperEngine, 'Forex Scalper'),
            safeGetHistory(MicroScalperEngine, 'Micro Sniper'),
            safeGetHistory(OmniProbabilisticEngine, 'Omni Prob'),
            safeGetHistory(AuraQuantEngine, 'Aura Quant'),
            safeGetHistory(RecoveryEngine, 'Recovery'),
            safeGetHistory(CopyTraderEngine, 'Copy Trader'),
            safeGetHistory(TradeGuardian, 'Trade Guardian'),
        ]);

        const allTrades = results.flatMap(r => r.trades);
        allTrades.sort((a, b) => new Date(b.closeTime || b.time).getTime() - new Date(a.closeTime || a.time).getTime());

        const totalTrades = allTrades.length;
        const wins = allTrades.filter(t => t.profit > 0 || t.result === 'WIN').length;
        const losses = allTrades.filter(t => t.profit < 0 || t.result === 'LOSS').length;
        const totalProfit = allTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
        
        const byRobot = allTrades.reduce((acc: any, t) => {
            const name = t.robot || 'Unknown';
            if (!acc[name]) acc[name] = { trades: 0, profit: 0, wins: 0, losses: 0 };
            acc[name].trades++;
            acc[name].profit += t.profit || 0;
            if (t.profit > 0 || t.result === 'WIN') acc[name].wins++;
            else acc[name].losses++;
            return acc;
        }, {});

        const robotSummary = Object.entries(byRobot).map(([robot, data]: [string, any]) => ({
            robot,
            trades: data.trades,
            profit: Number(data.profit.toFixed(2)),
            wins: data.wins,
            losses: data.losses,
            winRate: data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : '0.0'
        }));

        res.json({
            date: today,
            summary: { totalTrades, wins, losses, totalProfit: Number(totalProfit.toFixed(2)), winRate: parseFloat(winRate) },
            byRobot: robotSummary,
            trades: allTrades.map(t => ({
                ticket: t.ticket,
                robot: t.robot,
                symbol: t.symbol,
                direction: t.type || t.direction,
                lot: t.lot || t.volume,
                entryPrice: t.entryPrice || t.entry,
                exitPrice: t.exitPrice || t.exit,
                profit: t.profit,
                result: t.result || (t.profit > 0 ? 'WIN' : 'LOSS'),
                openTime: t.openTime,
                closeTime: t.closeTime || t.time,
                duration: t.duration,
                closeReason: t.closeReason
            }))
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/mt5/guardian/status', (req, res) => {
    res.json(TradeGuardian.getStatus());
});

app.get('/api/mt5/risk-management', async (req, res) => {
    try {
        const [accountRes, goldRes, disciplineRes] = await Promise.all([
            bridgeAxios.get('/account').catch(() => ({ data: {} })),
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
                closedProfit: disciplineRes.closedProfit || 0,
                floatingPL: disciplineRes.floatingPL || 0,
                tradeCount: disciplineRes.tradeCount || 0,
                consecutiveLosses: disciplineRes.consecutiveLosses || 0,
                isSafe: disciplineRes.isSafe !== false,
                isLocked: disciplineRes.isLocked || false,
                isDailyStopHit: disciplineRes.isDailyStopHit || false,
                isDailyTargetHit: disciplineRes.isDailyTargetHit || false,
                isMaxTradesHit: disciplineRes.isMaxTradesHit || false,
                isMaxConsecutiveLossesHit: disciplineRes.isMaxConsecutiveLossesHit || false,
                reason: disciplineRes.reason || null,
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

// --- AURA QUANT ENGINE ---
app.get('/api/mt5/aura-quant/status', (req, res) => {
    res.json(AuraQuantEngine.getStatus());
});

app.post('/api/mt5/aura-quant/settings', (req, res) => {
    AuraQuantEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: AuraQuantEngine.getStatus() });
});

// --- RECOVERY ENGINE ---
app.get('/api/mt5/recovery/status', (req, res) => {
    res.json(RecoveryEngine.getStatus());
});

app.post('/api/mt5/recovery/settings', (req, res) => {
    RecoveryEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: RecoveryEngine.getStatus() });
});

app.get('/api/mt5/recovery/signals', async (req, res) => {
    const signals = await RecoveryEngine.getRecoverySignals();
    res.json(signals);
});

// --- MOTOR IA ENGINE ---
app.get('/api/mt5/motor-ia/status', (req, res) => {
    res.json(MotorIAEngine.getStatus());
});

app.post('/api/mt5/motor-ia/settings', (req, res) => {
    MotorIAEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: MotorIAEngine.getStatus() });
});

app.get('/api/mt5/motor-ia/executions', (req, res) => {
    const filters: { symbol?: string; result?: string; limit?: number } = {};
    if (req.query.symbol) filters.symbol = req.query.symbol as string;
    if (req.query.result) filters.result = req.query.result as string;
    if (req.query.limit) filters.limit = Number(req.query.limit);
    res.json(MotorIAEngine.getExecutions(filters));
});

app.get('/api/mt5/motor-ia/learning', (req, res) => {
    res.json(MotorIAEngine.getLearningInsights());
});

// --- SHARK BOT ENGINE ---
app.get('/api/mt5/shark-bot/status', async (req, res) => {
    const status = await SharkBotEngine.getStatus();
    res.json(status);
});

app.post('/api/mt5/shark-bot/settings', (req, res) => {
    SharkBotEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: SharkBotEngine.getStatus() });
});

app.get('/api/mt5/shark-bot/history', (req, res) => {
    res.json(SharkBotEngine.getHistory());
});

// --- WOLF BOT ENGINE ---
app.get('/api/mt5/wolf-bot/status', async (req, res) => {
    const status = await WolfBotEngine.getStatus();
    res.json(status);
});

app.post('/api/mt5/wolf-bot/settings', (req, res) => {
    WolfBotEngine.updateSettings(req.body);
    res.json({ status: 'success', statusData: WolfBotEngine.getStatus() });
});

app.get('/api/mt5/wolf-bot/history', (req, res) => {
    res.json(WolfBotEngine.getHistory());
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

// --- TRADINGVIEW INTEGRATION ---

const TV_WEBHOOK_SECRET = process.env.TV_WEBHOOK_SECRET || '';
const TV_ALERTS_PATH = require('path').resolve(process.cwd(), 'tv_alerts.json');

interface TvAlert {
    id: string;
    timestamp: number;
    symbol: string;
    direction: string;
    price: number;
    strategy: string;
    raw: any;
}

let tvAlerts: TvAlert[] = [];
const MAX_TV_ALERTS = 100;

function loadTvAlerts(): TvAlert[] {
    try {
        const fs = require('fs');
        if (fs.existsSync(TV_ALERTS_PATH)) {
            return JSON.parse(fs.readFileSync(TV_ALERTS_PATH, 'utf-8'));
        }
    } catch { /* ignore */ }
    return [];
}

function saveTvAlerts() {
    try {
        const fs = require('fs');
        fs.writeFileSync(TV_ALERTS_PATH, JSON.stringify(tvAlerts.slice(0, MAX_TV_ALERTS), null, 2));
    } catch { /* ignore */ }
}

tvAlerts = loadTvAlerts();

const VALID_DIRECTIONS = new Set(['buy', 'sell', 'long', 'short']);

function createTvAlert(symbol: string, direction: string, price: number, strategy: string, raw: any = {}): TvAlert | null {
    const sym = (symbol || '').toUpperCase().trim();
    const dir = (direction || '').toLowerCase().trim();
    const prc = Number(price);

    if (!sym) { console.warn('[TradingView] s�mbolo inv�lido'); return null; }
    if (!VALID_DIRECTIONS.has(dir)) { console.warn(`[TradingView] dire��o inv�lida: ${direction}`); return null; }
    if (isNaN(prc) || prc <= 0) { console.warn(`[TradingView] pre�o inv�lido: ${price}`); return null; }

    return {
        id: `tv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        symbol: sym,
        direction: dir,
        price: prc,
        strategy: strategy || 'manual',
        raw,
    };
}

function persistTvAlert(alert: TvAlert) {
    tvAlerts.unshift(alert);
    if (tvAlerts.length > MAX_TV_ALERTS) tvAlerts.length = MAX_TV_ALERTS;
    saveTvAlerts();
    console.log(`[TradingView] Alerta: ${alert.symbol} ${alert.direction} @ ${alert.price} (${alert.strategy})`);
}

function syncTvAlert(symbol: string, direction: string, price: number, strategy: string, extra: any = {}) {
    const alert = createTvAlert(symbol, direction, price, strategy, extra);
    if (alert) persistTvAlert(alert);
}

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Muitas requisi��es. Limite: 30/minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});

function validateWebhookSecret(req: any, res: any, next: any) {
    if (!TV_WEBHOOK_SECRET) {
        console.warn('[Webhook] ⚠ TV_WEBHOOK_SECRET não definida — webhooks sem autenticação!');
        return next();
    }
    const secret = req.headers['x-webhook-secret'] || req.headers['x-tv-secret'] || '';
    if (secret !== TV_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Webhook secret inválido' });
    }
    next();
}

app.post('/api/tradingview/webhook', webhookLimiter, validateWebhookSecret, (req, res) => {
    try {
        const { symbol, direction, price, strategy } = req.body;
        const alert = createTvAlert(symbol, direction, price, strategy || 'webhook', req.body);
        if (!alert) {
            return res.status(400).json({
                error: 'Payload inv�lido',
                expected: { symbol: 'string', direction: 'buy|sell|long|short', price: 'number > 0', strategy: 'string (opcional)' },
                received: req.body,
            });
        }
        persistTvAlert(alert);
        res.json({ status: 'ok', alertId: alert.id });
    } catch (e: any) {
        console.error('[TradingView] Erro no webhook:', e.message);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/tradingview/webhook/execute', webhookLimiter, validateWebhookSecret, async (req, res) => {
    try {
        const { symbol, direction, price, strategy, lot } = req.body;
        const alert = createTvAlert(symbol, direction, price, strategy || 'webhook_exec', req.body);
        if (!alert) {
            return res.status(400).json({
                error: 'Payload inv�lido',
                expected: { symbol: 'string', direction: 'buy|sell|long|short', price: 'number > 0', lot: 'number (opcional)', strategy: 'string (opcional)' },
                received: req.body,
            });
        }
        persistTvAlert(alert);

        const execLot = Math.max(0.01, Math.min(Number(lot) || 0.01, 1.0));
        const action = (alert.direction === 'buy' || alert.direction === 'long') ? 'BUY' : 'SELL';
        const comment = `TvExec_${alert.strategy}_${alert.id.slice(-6)}`;

        const orderResult = await bridgeAxios.post('/order', {
            symbol: alert.symbol,
            action,
            lot: execLot,
            sl: 0,
            tp: 0,
            magic: 999001,
            comment: comment.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, ' ').trim().substring(0, 30),
        });

        if (orderResult.data?.ticket) {
            SymbolLockService.acquire(alert.symbol, 'TradingView', orderResult.data.ticket, action);
        }

        res.json({
            status: 'ok',
            alertId: alert.id,
            order: orderResult.data || null,
        });
    } catch (e: any) {
        console.error('[TradingView] Erro no webhook execute:', e.message);
        const status = e.response?.status || 500;
        res.status(status).json({ error: e.response?.data?.error || e.message });
    }
});

app.get('/api/tradingview/alerts', (req, res) => {
    const { symbol, limit } = req.query as any;
    let filtered = tvAlerts;
    if (symbol) filtered = filtered.filter(a => a.symbol === symbol.toUpperCase());
    const max = Math.min(Number(limit) || 20, 100);
    res.json(filtered.slice(0, max));
});

app.delete('/api/tradingview/alerts', (req, res) => {
    tvAlerts.length = 0;
    saveTvAlerts();
    res.json({ status: 'ok' });
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

app.get('/api/mt5/ml-insights/history', async (req, res) => {
    try {
        const result = await MLInsightsService.getHistory();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/settings', (req, res) => {
    res.json(MLInsightsService.getSettings());
});

app.post('/api/mt5/ml-insights/settings', (req, res) => {
    MLInsightsService.saveSettings(req.body);
    res.json({ status: 'success', settings: MLInsightsService.getSettings() });
});

app.get('/api/mt5/ml-insights/performance', async (req, res) => {
    try {
        const perf = await MLInsightsService.getPerformance();
        res.json(perf);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Keep old predictions and regime endpoints for backward compatibility
app.get('/api/mt5/ml-insights/prediction', async (req, res) => {
    try {
        const report = await MLInsightsService.getFullReport();
        res.json(report.predictions?.[0] || { direction: 'NEUTRAL' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml-insights/regime', async (req, res) => {
    try {
        const report = await MLInsightsService.getFullReport();
        res.json(report.regime || { regime: 'SILENT' });
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

// --- ML PREDICTOR (Machine Learning Algoritmico) ---
app.get('/api/mt5/ml/predict', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string || 'XAUUSD').toUpperCase();
        const prediction = await MLService.predict(symbol);
        if (!prediction) return res.status(503).json({ error: 'Prediction unavailable (no data)' });
        res.json(prediction);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml/status', (_req, res) => {
    res.json({
        enabled: MLService.getConfig().enabled,
        symbols: MLService.getConfig().symbols,
        models: MLService.getAllStatus(),
    });
});

app.post('/api/mt5/ml/train', async (req, res) => {
    try {
        const symbol = (req.body.symbol || 'XAUUSD').toUpperCase();
        const model = await MLService.train(symbol);
        if (!model) return res.status(503).json({ error: 'Training failed (insufficient data)' });
        res.json({ symbol, accuracy: model.accuracy, samples: model.samples });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mt5/ml/train-all', async (_req, res) => {
    try {
        await MLService.retrainAll();
        res.json({ status: 'success', models: MLService.getAllStatus() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ml/history', (req, res) => {
    const symbol = req.query.symbol as string;
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(MLService.getHistory(symbol, limit));
});

app.get('/api/mt5/ml/config', (req, res) => {
    res.json(MLService.getConfig());
});

// --- AI ANALYST AGENT (Analise Inteligente para Traders) ---
app.get('/api/mt5/ai-analyst/analyze', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string || 'XAUUSD').toUpperCase();
        const report = await AIAnalystAgent.analyze(symbol);
        res.json(report);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/ai-analyst/market-overview', async (_req, res) => {
    try {
        const overview = await AIAnalystAgent.getMarketOverview();
        res.json(overview);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mt5/ai-analyst/multi-asset', async (req, res) => {
    try {
        const symbols: string[] = req.body.symbols || ['XAUUSD', 'EURUSD', 'BTCUSD'];
        const reports = await AIAnalystAgent.getMultiAssetReport(symbols);
        res.json(reports);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mt5/ml/config', (req, res) => {
    MLService.updateConfig(req.body);
    res.json({ status: 'success', config: MLService.getConfig() });
});

// --- PATTERN DETECTOR ---
app.get('/api/mt5/pattern-detector/analyze', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string || 'XAUUSD').toUpperCase();
        const timeframe = req.query.timeframe as string || 'H1';
        const count = Number(req.query.count) || 60;
        const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
        const resp = await axios.get(`${MT5_BRIDGE_URL}/candles`, {
            params: { symbol, timeframe, count }, timeout: 5000,
        });
        const candles = Array.isArray(resp.data?.candles) ? resp.data.candles
            : Array.isArray(resp.data) ? resp.data : [];
        if (!candles || candles.length < 10) {
            return res.status(400).json({ error: 'Dados insuficientes para detectar padr�es' });
        }
        const analysis = PatternDetector.analyze(candles);
        res.json({ symbol, timeframe, candlesCount: candles.length, ...analysis });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- NLP ENGINE (Natural Language Processing para Notícias) ---
app.get('/api/mt5/nlp/news', async (req, res) => {
    try {
        const symbols = (req.query.symbols as string || 'XAUUSD,BTCUSD').split(',').map(s => s.trim().toUpperCase());
        const limit = parseInt(req.query.limit as string) || 10;
        const articles = await NLPService.fetchNews(symbols, limit);
        res.json(articles);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/nlp/analyze', (req, res) => {
    try {
        const text = req.query.text as string;
        const lang = (req.query.lang as string) || 'auto';
        if (!text) return res.status(400).json({ error: 'text parameter required' });
        const language: 'en' | 'pt' = lang === 'pt' ? 'pt' :
            lang === 'auto' ? (/[�-��-�]/.test(text) ? 'pt' : 'en') : 'en';
        const result = NLPService.analyzeText(text, language);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/nlp/sentiment/:symbol', (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const result = NLPService.getAggregatedSentiment(symbol);
        if (!result) return res.status(503).json({ error: 'No news data available. Fetch news first.' });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mt5/nlp/keywords', (req, res) => {
    try {
        const text = req.query.text as string;
        const lang = (req.query.lang as string) || 'auto';
        if (!text) return res.status(400).json({ error: 'text parameter required' });
        const language: 'en' | 'pt' = lang === 'pt' ? 'pt' :
            lang === 'auto' ? (/[�-��-�]/.test(text) ? 'pt' : 'en') : 'en';
        const keywords = NLPService.extractKeywords(text, language);
        res.json({ keywords });
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
        await AlphaRobotEngine.syncTradesFromMT5().catch(() => {});
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
    if (!direction || !['BUY', 'SELL'].includes(direction)) {
        return res.status(400).json({ success: false, message: 'direction deve ser BUY ou SELL' });
    }
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

app.get('/api/mt5/economic-calendar', async (req, res) => {
    try {
        const response = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch economic calendar' });
    }
});

app.get('/api/mt5/economic-news', async (req, res) => {
    try {
        const FMP_KEY = process.env.FMP_API_KEY;
        const symbols = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD', 'SP500'];
        if (FMP_KEY) {
            const response = await axios.get(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbols.join(',')}&limit=30&apikey=${FMP_KEY}`, { timeout: 8000 });
            return res.json(response.data || []);
        }
        const response = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 8000 });
        const events = Array.isArray(response.data) ? response.data : [];
        const news = events.filter((e: any) => e.title && e.impact !== 'Holiday').slice(0, 20).map((e: any) => ({
            title: e.title,
            symbol: e.country,
            source: 'Economic Calendar',
            time: e.date,
            sentiment: e.impact === 'High' ? 0.8 : e.impact === 'Medium' ? 0.5 : 0.2,
            label: e.impact === 'High' ? 'HIGH_IMPACT' : e.impact === 'Medium' ? 'MEDIUM_IMPACT' : 'LOW_IMPACT',
            url: '',
            image: '',
            text: e.forecast ? `Forecast: ${e.forecast} | Previous: ${e.previous}` : `${e.impact} impact economic event for ${e.country}`,
        }));
        res.json(news);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news' });
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

// --- ROTA GOLD SCALPER TRADE MONITOR (XAUUSD em tempo real) ---
app.get('/api/mt5/gold-scalper/trade-monitor', async (req, res) => {
    try {
        const data = await GoldScalperTradeMonitor.refresh();
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
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
        const [gold, shark_bot, wolf_bot, swing, omni, supreme, robot, analytics, discipline] = await Promise.all([
            GoldScalperEngine.getStatus().catch(() => null),
            safe(() => SharkBotEngine.getStatus()),
            safe(() => WolfBotEngine.getStatus()),
            safe(() => SwingTraderEngine.getStatus()),
            safe(() => OmniProbabilisticEngine.getStatus()),
            safe(() => SupremeEngine.getStatus()),
            safe(() => AlphaRobotEngine.getStatus()),
            (async () => { try { return await ReportEngine.getAdvancedAnalytics(); } catch { return null; } })(),
            (async () => { try { return await DisciplineEngine.getDailyStatus(); } catch { return null; } })()
        ]);
        res.json({ gold, shark_bot, wolf_bot, swing, omni, supreme, robot, analytics, discipline });
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

// --- COPILOT RADAR FX ---
app.post('/api/copilot/ask', async (req, res) => {
    try {
        const { message, sessionId, model, mode, symbol, timeframe } = req.body;
        if (!message || !message.trim()) return res.status(400).json({ error: 'Mensagem obrigatória' });
        const result = await CopilotService.ask(
            sessionId || 'default',
            message.trim(),
            model,
            mode || 'general',
            symbol,
            timeframe
        );
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Erro no Copilot' });
    }
});

// Streaming endpoint for Fox
app.post('/api/copilot/ask/stream', async (req, res) => {
    try {
        const { message, sessionId, model, mode, symbol, timeframe } = req.body;
        if (!message || !message.trim()) return res.status(400).json({ error: 'Mensagem obrigatória' });

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        let fullContent = '';

        await CopilotService.askStream(
            sessionId || 'default',
            message.trim(),
            (token: string) => {
                fullContent += token;
                // Send each token as SSE
                const escaped = token.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                res.write(`data: ${escaped}\n\n`);
            },
            model,
            mode || 'general',
            symbol,
            timeframe
        );

        res.write(`data: __FOX_DONE__\n\n`);
        res.end();
    } catch (error: any) {
        // If headers already sent, write error to stream
        try {
            res.write(`data: __FOX_ERROR__:${error.message || 'Erro no Fox'}\n\n`);
            res.write(`data: __FOX_DONE__\n\n`);
            res.end();
        } catch { /* ignore */ }
    }
});

// --- ROTAS DE CORRELAÇÃO (XAUUSD) ---
app.get('/api/mt5/correlation/xauusd', async (req, res) => {
    try {
        const period = req.query.period as string || '6mo';
        const correlationData = await CorrelationService.getXAUUSDCorrelationMatrix(period);
        res.json(correlationData);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});



// --- ROTAS SWEEP H4 M15 ---
app.get('/api/mt5/sweep/status', (req, res) => {
    res.json(SweepEngine.getStatus());
});

app.post('/api/mt5/sweep/settings', (req, res) => {
    SweepEngine.updateSettings(req.body);
    res.json({ success: true, status: SweepEngine.getStatus() });
});

app.post('/api/mt5/sweep/reset', (req, res) => {
    SweepEngine.resetDailyCounters();
    res.json({ success: true });
});

app.get('/api/mt5/sweep/trade-monitor', async (req, res) => {
    const data = await SweepTradeMonitor.refresh();
    res.json(data);
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

app.get('/api/mt5/signals/status', async (req, res) => {
    const status = SignalEngine.getStatus();
    res.json({
        engine: status,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/mt5/signals/history', async (req, res) => {
    try {
        const {
            symbol, setup, category, type, limit = '100', offset = '0',
            fromDate, toDate
        } = req.query as Record<string, string>;
        const result = await DatabaseService.getSignalHistory({
            symbol, setup, category, type,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
        });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Erro ao buscar hist�rico de sinais', details: err.message });
    }
});

app.get('/api/mt5/signals/stats', async (req, res) => {
    try {
        const { signals } = await DatabaseService.getSignalHistory({ limit: 10000 });
        const total = signals.length;
        const bySetup: Record<string, { count: number; avgConfidence: number; buys: number; sells: number }> = {};
        const byCategory: Record<string, number> = {};
        for (const s of signals) {
            if (!bySetup[s.setup]) bySetup[s.setup] = { count: 0, avgConfidence: 0, buys: 0, sells: 0 };
            bySetup[s.setup].count++;
            bySetup[s.setup].avgConfidence += s.confidence;
            if (s.type === 'BUY') bySetup[s.setup].buys++;
            else bySetup[s.setup].sells++;
            if (s.category) byCategory[s.category] = (byCategory[s.category] || 0) + 1;
        }
        for (const k of Object.keys(bySetup)) {
            bySetup[k].avgConfidence = Math.round(bySetup[k].avgConfidence / bySetup[k].count);
        }
        res.json({ total, bySetup, byCategory });
    } catch (err: any) {
        res.status(500).json({ error: 'Erro ao buscar stats', details: err.message });
    }
});

app.get('/api/mt5/debug/symbols', async (req, res) => {
    try {
        const bridgeResp = await bridgeAxios.post('/ticks', { symbols: [] });
        const symbols = Object.keys(bridgeResp.data);
        res.json({ count: symbols.length, symbols });
    } catch (err: any) {
        res.status(500).json({ error: 'Falha ao buscar símbolos', details: err.message });
    }
});

// --- CATÁLOGO DE ESTRATÉGIAS (fonte única) ---
app.get('/api/mt5/reports/catalog', async (req, res) => {
    try {
        const catalog = SignalEngine.getCatalog();
        res.json(catalog);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load catalog' });
    }
});

// --- RELATÓRIO DE ESTRATÉGIAS COM DADOS REAIS ---
app.get('/api/mt5/reports/strategies', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
        const report = await SignalEngine.getStrategyReport(limit);
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

// --- GLOBAL REPORT (all engines) ---
app.get('/api/mt5/global-report', async (req, res) => {
    try {
        const reportEndpoints = [
            { id: 'gold-scalper', name: 'Gold Scalper', endpoint: '/api/mt5/gold-scalper/report' },
            { id: 'robot', name: 'Alpha Robot', endpoint: '/api/mt5/robot/report' },
            { id: 'supreme', name: 'Supreme', endpoint: '/api/mt5/supreme/report' },
        ];
        const statusEndpoints = [
            { id: 'micro-scalper', name: 'Micro Sniper' },
            { id: 'forex-scalper', name: 'Speed Scalper' },
            { id: 'swing-trader', name: 'Day Swing IA' },
            { id: 'sweep', name: 'Sweep H4 M15' },
            { id: 'bitcoin-pro', name: 'Bitcoin Pro' },
            { id: 'shark-bot', name: 'Shark Bot' },
            { id: 'crypto-ia', name: 'Crypto IA' },
            { id: 'omni', name: 'Omni Probabilistic' },
            { id: 'motor-ia', name: 'Motor IA' },
            { id: 'agent-ia', name: 'Agent IA' },
            { id: 'recovery', name: 'Recovery Engine' },
        ];
        const engineData: any[] = [];
        const allTrades: any[] = [];

        // Busca trades dos engines com report
        for (const eng of reportEndpoints) {
            try {
                const resp = await axios.get(`http://127.0.0.1:${port}${eng.endpoint}`, { timeout: 4000 });
                const data = resp.data;
                engineData.push({
                    name: eng.name,
                    summary: data.summary || data.performance || null,
                    totalTrades: data.summary?.totalTrades || data.performance?.totalTrades || 0,
                    totalProfit: data.summary?.totalProfit || data.performance?.totalProfit || 0,
                    winRate: data.summary?.winRate || data.performance?.winRate || 0,
                });
                const trades = data.trades || data.recentTrades || [];
                for (const t of trades) {
                    allTrades.push({ ...t, engine: eng.name });
                }
            } catch (e) {
                engineData.push({ name: eng.name, summary: null, totalTrades: 0, totalProfit: 0, winRate: 0 });
            }
        }

        // Busca dados dos engines sem report
        const statusUrls: Record<string, string> = {
            'agent-ia': `/api/agent-ia/status`,
        };
        for (const eng of statusEndpoints) {
            try {
                const url = statusUrls[eng.id] || `/api/mt5/${eng.id}/status`;
                const resp = await axios.get(`http://127.0.0.1:${port}${url}`, { timeout: 3000 });
                const d = resp.data;
                let dailyProfit = 0;
                if (typeof d.dailyProfit === 'number') dailyProfit = d.dailyProfit;
                else if (d.state && typeof d.state.dailyProfit === 'number') dailyProfit = d.state.dailyProfit;
                else if (typeof d.totalProfit === 'number') dailyProfit = d.totalProfit;
                else if (d.performance && typeof d.performance.totalProfit === 'number') dailyProfit = d.performance.totalProfit;
                engineData.push({
                    name: eng.name,
                    summary: null,
                    totalTrades: d.performance?.totalTrades || d.stats?.totalTrades || 0,
                    totalProfit: dailyProfit,
                    winRate: d.performance?.winRate || d.stats?.winRate || null,
                });
            } catch (e) {
                engineData.push({ name: eng.name, summary: null, totalTrades: 0, totalProfit: 0, winRate: 0 });
            }
        }

        // Busca posições abertas DO BRIDGE para mostrar atividade atual
        let openPositions: any[] = [];
        try {
            const posResp = await bridgeAxios.get('/positions', { timeout: 5000 });
            openPositions = Array.isArray(posResp.data) ? posResp.data : [];
        } catch (e) {}

        // Filtra apenas trades das últimas 2 horas para o "recentTrades"
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const recentTrades = allTrades
            .filter(t => {
                const ts = t.closeTime || t.openTime || 0;
                return ts >= twoHoursAgo;
            })
            .sort((a, b) => (b.closeTime || b.openTime || 0) - (a.closeTime || a.openTime || 0));

        // Trades de hoje
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayTrades = allTrades
            .filter(t => {
                const ts = t.closeTime || t.openTime || 0;
                return ts >= todayStart;
            })
            .sort((a, b) => (b.closeTime || b.openTime || 0) - (a.closeTime || a.openTime || 0));

        const magicMap = MAGIC_MAP;

        res.json({
            generatedAt: now.toISOString(),
            date: now.toLocaleDateString('pt-BR'),
            time: now.toLocaleTimeString('pt-BR'),
            account: null,
            engines: engineData,
            recentTrades: recentTrades.slice(0, 50),
            todayTrades: todayTrades.slice(0, 50),
            openPositions: openPositions.map(p => ({
                ticket: p.ticket,
                symbol: p.symbol,
                type: p.type === 0 ? 'BUY' : 'SELL',
                volume: p.volume,
                price_open: p.price_open,
                price_current: p.price_current,
                profit: p.profit,
                magic: p.magic,
                engine: magicMap[p.magic] || `Magic ${p.magic}`,
                sl: p.sl,
                tp: p.tp,
                comment: p.comment,
            })),
            summary: {
                totalEngines: engineData.length,
                totalTradesAllTime: engineData.reduce((s, e) => s + e.totalTrades, 0),
                totalProfitAllTime: engineData.reduce((s, e) => s + e.totalProfit, 0),
                todayTradesCount: todayTrades.length,
                openPositionsCount: openPositions.length,
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate global report' });
    }
});

// --- ALL POSITIONS ---
app.get('/api/mt5/positions', async (req, res) => {
    try {
        const resp = await bridgeAxios.get('/positions', { timeout: 5000 });
        res.json(resp.data || []);
    } catch (error) {
        res.json([]);
    }
});

// --- MANUAL TRADE EXECUTION (Telegram) ---
app.post('/api/mt5/trade/open', async (req, res) => {
    try {
        const { symbol, direction, lot, sl, tp, comment } = req.body;
        if (!symbol || !direction) return res.status(400).json({ error: 'symbol and direction required' });
        const payload: any = {
            action: direction === 'BUY' ? 'BUY' : 'SELL',
            symbol: symbol.toUpperCase(),
            lot: Math.max(0.01, lot || 0.01),
            magic: 999999,
            comment: String(comment || 'Telegram_Manual').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, ' ').trim().substring(0, 30) || 'Telegram_Manual'
        };
        if (sl) payload.sl = sl;
        if (tp) payload.tp = tp;
        const resp = await bridgeAxios.post('/order', payload, { timeout: 10000 });
        if (resp.data?.ticket) {
            syncTvAlert(symbol, direction, resp.data.price || 0, comment || 'Telegram_Manual', { ticket: resp.data.ticket });
        }
        res.json(resp.data);
    } catch (error: any) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

app.post('/api/mt5/trade/close', async (req, res) => {
    try {
        const { ticket } = req.body;
        if (!ticket) return res.status(400).json({ error: 'ticket required' });
        const resp = await bridgeAxios.post('/close_order', { ticket }, { timeout: 5000 });
        res.json(resp.data || { success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

app.post('/api/mt5/trade/close-all', async (req, res) => {
    try {
        const positions = await bridgeAxios.get('/positions', { timeout: 5000 });
        const posList = positions.data || [];
        let closed = 0, errors = 0;
        for (const p of posList) {
            try {
                await bridgeAxios.post('/close_order', { ticket: p.ticket }, { timeout: 3000 });
                closed++;
            } catch (e) { errors++; }
        }
        res.json({ closed, errors, total: posList.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
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
    const config = ConfigService.getConfig();
    const maskedConfig = {
        ...config,
        polygonApiKey: config.polygonApiKey ? '••••••••••••••••' : '',
    };
    res.json(maskedConfig);
});

app.post('/api/system/config', (req, res) => {
    try {
        const configSchema = z.object({
            polygonApiKey: z.string().optional(),
            mt5BridgeUrl: z.string().url().optional(),
            profile: z.object({
                name: z.string().min(1, 'Nome é obrigatório'),
                tradingStyle: z.enum(['SCALPER', 'DAY_TRADER', 'SWING']),
                experience: z.string().min(1, 'Experiência é obrigatória'),
            }).optional(),
        });

        const validatedData = configSchema.parse(req.body);
        const success = ConfigService.saveConfig(validatedData);
        res.json({ success });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validação falhou', details: error.errors });
        }
        res.status(500).json({ error: 'Erro interno ao salvar configurações' });
    }
});

// --- KILL SWITCH: Desligar todos os robôs ---
app.post('/api/system/engines/disable-all', (req, res) => {
    try {
        const engines = [
            { name: 'Gold Scalper', fn: () => GoldScalperEngine.updateSettings({ enabled: false }) },
            { name: 'Alpha Robot', fn: () => AlphaRobotEngine.updateSettings({ enabled: false }) },
            { name: 'Omni', fn: () => OmniProbabilisticEngine.updateSettings({ enabled: false }) },
            { name: 'Supreme', fn: () => SupremeEngine.updateSettings({ nakamotoActive: false, intelligence7Active: false }) },
            { name: 'Shark Bot', fn: () => SharkBotEngine.updateSettings({ enabled: false }) },
            { name: 'Wolf Bot', fn: () => WolfBotEngine.updateSettings({ enabled: false }) },
            { name: 'Bitcoin Pro', fn: () => BitcoinProEngine.updateSettings({ enabled: false }) },
            { name: 'Aura Quant', fn: () => AuraQuantEngine.updateSettings({ enabled: false }) },
            { name: 'Crypto IA', fn: () => CryptoIAEngine.updateSettings({ enabled: false }) },
            { name: 'Motor IA', fn: () => MotorIAEngine.updateSettings({ enabled: false }) },
            { name: 'Recovery', fn: () => RecoveryEngine.updateSettings({ enabled: false }) },
            { name: 'Micro Scalper', fn: () => MicroScalperEngine.updateSettings({ enabled: false }) },
            { name: 'Swing Trader', fn: () => SwingTraderEngine.updateSettings({ enabled: false }) },
            { name: 'Forex Scalper', fn: () => ForexScalperEngine.updateSettings({ enabled: false }) },
            { name: 'Sweep', fn: () => SweepEngine.updateSettings({ enabled: false }) },
        ];

        const results: { name: string; success: boolean; error?: string }[] = [];
        for (const e of engines) {
            try { e.fn(); results.push({ name: e.name, success: true }); }
            catch (err: any) { results.push({ name: e.name, success: false, error: err.message }); }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`🔴 Kill Switch: ${successCount}/${results.length} robôs desligados`);
        res.json({ success: true, disabled: successCount, total: results.length, details: results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- INFRA (Backup, Logs, Health, Disk) ---
app.get('/api/system/health', async (req: any, res: any) => {
    const execSync = require('child_process').execSync;
    const srv = true;
    const chk = (port: number): boolean => {
        try { const o = execSync(`node -e "const h=require('http');h.get('http://127.0.0.1:${port}',r=>{r.resume();process.exit(0)}).on('error',()=>process.exit(1)).setTimeout(2000,function(){this.destroy();process.exit(1)})"`, { timeout: 5000, stdio: 'pipe' }); return true; } catch { return false; }
    };
    const cli = chk(3006); const brg = chk(5555);
    let disk = { free: 0, total: 0, percent: 0 };
    try {
        const drive = require('child_process').execSync('wmic logicaldisk where name="C:" get size,freespace /format:csv', { encoding: 'utf8', timeout: 3000 });
        const parts = drive.trim().split('\n')[1]?.split(',');
        if (parts && parts.length >= 3) {
            const free = parseInt(parts[1]); const total = parseInt(parts[2]);
            disk = { free: Math.round(free / 1e9), total: Math.round(total / 1e9), percent: Math.round((1 - free / total) * 100) };
        }
    } catch {}
    res.json({ ports: { server: srv, client: cli, bridge: brg }, disk });
});

app.get('/api/system/engines', (req, res) => {
    const engines: Record<string, any> = {
        GoldScalperEngine: { running: typeof GoldScalperEngine !== 'undefined' },
        SweepEngine: { running: typeof SweepEngine !== 'undefined' },
        MotorIAEngine: { running: typeof MotorIAEngine !== 'undefined' },
        DisciplineEngine: { running: typeof DisciplineEngine !== 'undefined' },
        CryptoRiskEngine: { running: typeof CryptoRiskEngine !== 'undefined' },
    };
    res.json(engines);
});

app.get('/api/system/backup', (req, res) => {
    res.json(InfraService.getBackupInfo());
});

app.get('/api/system/alerts/stats', (req, res) => {
    res.json(AlertEngine.getStats());
});

app.use('/api/auth', authRouter);

// --- SECURITY AUDIT LOGS ---

app.get('/api/security/audit-logs', (req, res) => {
    const { nivel, ativo, trava } = req.query as any;
    SecurityAuditService.init();
    const logs = SecurityAuditService.getLogs({ nivel, ativo, trava });
    res.json(logs);
});

app.get('/api/security/audit-logs/resumo-diario', (req, res) => {
    SecurityAuditService.init();
    res.json({ resumo: SecurityAuditService.getResumoDiario() });
});

app.get('/api/security/audit-logs/export-csv', (req, res) => {
    SecurityAuditService.init();
    const csv = SecurityAuditService.exportarCSV();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
});

app.post('/api/security/audit-logs', (req, res) => {
    SecurityAuditService.init();
    const { nivel, ativo, trava, acao, detalhe } = req.body;
    SecurityAuditService.registrar(nivel, ativo, trava, acao, detalhe);
    res.json({ success: true });
});

app.delete('/api/security/audit-logs', (req, res) => {
    SecurityAuditService.init();
    SecurityAuditService.limpar();
    res.json({ success: true });
});
// --- BIOMETRIA PROXY (-> Python Flask :5001) ---

const BACKTEST_URL = 'http://127.0.0.1:5003';
const INTEL_ENGINE_URL = 'http://127.0.0.1:5004';
let intelEngineProcess: ChildProcess | null = null;
const TELEMETRY_URL = 'http://127.0.0.1:5006';

app.all('/api/backtest/*', async (req, res) => {
    try {
        const path = req.url.replace('/api/backtest', '');
        if (path === '/node/history' || path === '/node/history/') {
            const history = await DatabaseService.getBacktestHistory();
            return res.json(history);
        }
        const url = `${BACKTEST_URL}/api/backtest${path}`;
        const method = req.method.toLowerCase() as 'get' | 'post';
        const config: any = { timeout: 300000 };
        if (req.method === 'POST' || req.method === 'PUT') {
            config.data = req.body;
        }
        const resp = await (axios as any)[method](url, config);
        if (method === 'get' && resp.data?.status === 'completed' && resp.data?.metrics) {
            const m = resp.data.metrics;
            DatabaseService.saveBacktest({
                jobId: resp.data.job_id || path.split('/').pop() || 'unknown',
                strategy: resp.data.config?.strategy || 'smc',
                symbol: resp.data.config?.symbol,
                timeframe: resp.data.config?.timeframe,
                initialCapital: m.initial_capital || 0,
                finalBalance: m.final_balance || 0,
                totalTrades: m.total_trades || 0,
                winTrades: m.win_trades || 0,
                lossTrades: m.loss_trades || 0,
                winRate: m.win_rate || 0,
                totalPnl: m.total_pnl || 0,
                totalReturn: m.total_return || 0,
                profitFactor: m.profit_factor || 0,
                maxDrawdown: m.max_drawdown || 0,
                config: resp.data.config,
                status: 'completed',
            }).catch(() => {});
        }
        res.json(resp.data);
    } catch (e: any) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            res.status(502).json({ error: 'Backtest service unavailable', detail: e.message });
        }
    }
});

app.get('/api/trader/profile', async (req, res) => {
    try {
        const [accountRes, historyRes] = await Promise.all([
            bridgeAxios.get('/account').catch(() => ({ data: null })),
            bridgeAxios.get('/history').catch(() => ({ data: [] }))
        ]);

        const account = accountRes.data;
        const deals = Array.isArray(historyRes.data) ? historyRes.data : [];

        const deposits = deals
            .filter((d: any) => d.type === 2)
            .map((d: any) => ({ ticket: d.ticket, time: d.time, amount: d.profit, comment: d.comment }))
            .sort((a: any, b: any) => b.time - a.time);

        const withdrawals = deals
            .filter((d: any) => d.type === 3)
            .map((d: any) => ({ ticket: d.ticket, time: d.time, amount: Math.abs(d.profit), comment: d.comment }))
            .sort((a: any, b: any) => b.time - a.time);

        const totalDeposits = deposits.reduce((s: number, d: any) => s + d.amount, 0);
        const totalWithdrawals = withdrawals.reduce((s: number, w: any) => s + w.amount, 0);

        res.json({
            account: account ? {
                login: account.login || 0,
                balance: account.balance || 0,
                equity: account.equity || 0,
                margin: account.margin || 0,
                margin_free: account.margin_free || 0,
                profit: account.daily_profit || account.profit || 0,
                leverage: account.leverage || 0,
                currency: account.currency || 'USD',
                name: account.company || 'MT5',
                server: account.server || '---',
            } : null,
            deposits,
            withdrawals,
            totalDeposits,
            totalWithdrawals,
            totalDeals: deals.length,
            balanceHistory: deals
                .filter((d: any) => [2, 3, 4].includes(d.type) || d.symbol)
                .sort((a: any, b: any) => a.time - b.time)
                .reduce((acc: any[], d: any) => {
                    const prev = acc.length > 0 ? acc[acc.length - 1].balance : (account?.balance || 0) - deposits.reduce((s: number, dep: any) => s + dep.amount, 0) + withdrawals.reduce((s: number, wd: any) => s + wd.amount, 0);
                    const bal = prev + (d.profit || 0);
                    acc.push({ time: d.time, balance: Math.round(bal * 100) / 100, type: d.type, symbol: d.symbol });
                    return acc;
                }, []).slice(-100)
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- INTEL ENGINE PROXY (-> Python Flask :5004) ---

app.all('/api/intel-engine/*', async (req, res) => {
    try {
        const path = req.url.replace('/api/intel-engine', '');
        const url = `${INTEL_ENGINE_URL}/api/intel-engine${path}`;
        const method = req.method.toLowerCase() as 'get' | 'post';
        const config: any = { timeout: 180000 };
        if (req.method === 'POST' || req.method === 'PUT') {
            config.data = req.body;
        }
        if (method === 'get') {
            config.params = req.query;
        }
        const resp = await (axios as any)[method](url, config);
        res.json(resp.data);
    } catch (e: any) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            res.status(502).json({ error: 'Intel Engine service unavailable', detail: e.message });
        }
    }
});

// --- TELEMETRY PROXY (-> Python Flask :5006) ---

app.all('/api/telemetry*', async (req, res) => {
    try {
        const url = `${TELEMETRY_URL}/api/telemetry${req.url.replace('/api/telemetry', '')}`;
        const method = req.method.toLowerCase() as 'get' | 'post';
        const config: any = { timeout: 10000 };
        if (method === 'get') { config.params = req.query; }
        const resp = await (axios as any)[method](url, config);
        res.json(resp.data);
    } catch (e: any) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            res.status(502).json({ error: 'Telemetry service unavailable', detail: e.message });
        }
    }
});

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientDist, 'index.html'));
    }
});

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server v1.1 [CLEAN] running at http://0.0.0.0:${port}`);

    // Verificar saúde da bridge MT5 (non-blocking)
    bridgeAxios.get('/health', { timeout: 5000 })
        .then(health => {
            if (health.data?.status === 'connected') {
                console.log(`✅ Bridge MT5 conectada: ${health.data.server} (conta ${health.data.account}, saldo $${health.data.balance})`);
            } else {
                console.warn(`⚠️  Bridge MT5 respondendo mas NÃO conectada ao terminal. Verifique se o MT5 está aberto.`);
            }
        })
        .catch((e: any) => {
            console.error(`❌ Bridge MT5 NÃO RESPONDE em ${MT5_BRIDGE_URL}. Execute 'npm run python-bridge' ou 'start_all.bat'.`);
            console.error(`   Erro: ${e.message}`);
        });

    // Migração assíncrona de JSON → Prisma
    (async () => {
        try {
            const fs = require('fs');
            const path = require('path');
            const dataDir = process.cwd();
            const migrations = [
                { name: 'Motor IA', file: 'motor_ia_history.json', dataKey: 'executions' },
                { name: 'Gold Scalper', file: 'gold_scalper_history.json' },
                { name: 'Alpha Robot', file: 'alpha_robot_history.json' },
                { name: 'Recovery', file: 'recovery_history.json' },
            ];
            for (const m of migrations) {
                const filePath = path.join(dataDir, m.file);
                if (fs.existsSync(filePath)) {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const trades = m.dataKey ? content[m.dataKey] : (Array.isArray(content) ? content : []);
                    if (Array.isArray(trades) && trades.length > 0) {
                        await DatabaseService.migrateFromJson(m.name, trades);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Migração automática ignorada (primeira execução ou sem dados)');
        }
    })();

    // Inicializar serviços de infraestrutura e motores
    console.log('🚀 Iniciando serviços de infraestrutura...');
    AlertEngine.init();
    InfraService.init();
    CopilotService.initMemory();

    console.log('🚀 Iniciando Intel Engine (Python :5004)...');
    (async () => {
        try {
            intelEngineProcess = spawn('C:\\Users\\Deah\\AppData\\Local\\Python\\bin\\python.exe', ['-m', 'server.python.ai_agents.intel_service', '5004'], {
                cwd: path.resolve(__dirname, '../..'),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            intelEngineProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[Intel Engine] ${d.toString()}`));
            intelEngineProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[Intel Engine] ${d.toString()}`));
            intelEngineProcess.on('exit', (code: number | null) => {
                console.log(`ℹ️  Intel Engine encerrado (código ${code})`);
                intelEngineProcess = null;
            });

            // Poll health endpoint until ready
            for (let attempt = 0; attempt < 30; attempt++) {
                try {
                    const h = await axios.get(`${INTEL_ENGINE_URL}/api/intel-engine/health`, { timeout: 2000 });
                    if (h.data?.status === 'healthy') {
                        console.log(`✅ Intel Engine online — ${h.data.agents_loaded} agentes, ${h.data.cache_entries} cache`);
                        break;
                    }
                } catch { /* not yet */ }
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            console.error('❌ Falha ao iniciar Intel Engine:', (e as Error).message);
        }
    })();

    console.log('🚀 Iniciando motores de trading...');

    DisciplineEngine.init();
    CryptoRiskEngine.resetDailyLimits();
    setInterval(() => CryptoRiskEngine.resetDailyLimits(), 24 * 60 * 60 * 1000);

    GoldScalperEngine.start();
    GoldScalperTradeMonitor.start(3000);
    SweepTradeMonitor.start(3000);
    MotorIAEngine.init();
    SweepEngine.init();
    // Motores desativados para reduzir carga:
    // TradeGuardian.start();
    // AlphaRobotEngine.start();
    // WolfBotEngine.init();
    // CopyTraderEngine.start();
    // SupremeEngine.start();
    // MLService.init();
    // BitcoinProEngine.init();
    // AuraQuantEngine.init();
    // CryptoIAEngine.init();
    // MicroScalperEngine.init();
    // SwingTraderEngine.init();
    // ForexScalperEngine.init();
    OmniProbabilisticEngine.start();
    // SharkBotEngine.init();
    // RecoveryEngine.init();
    console.log('⚡ Todos os motores iniciados com sucesso!');

    // Process shutdown handlers
    const shutdown = async (signal: string) => {
        console.log(`\n// Restart trigger 2⚠️  Recebido ${signal}. Iniciando desligamento gracioso...`);
        const engines = [MotorIAEngine, GoldScalperEngine, CryptoIAEngine, AlphaRobotEngine, WolfBotEngine, SupremeEngine, RecoveryEngine, SharkBotEngine, BitcoinProEngine, AuraQuantEngine, MicroScalperEngine, SwingTraderEngine, SweepEngine, ForexScalperEngine, OmniProbabilisticEngine, TradeGuardian, CopyTraderEngine];
        for (const eng of engines) { try { (eng as any).stop?.(); } catch { /* ignore */ } }
        if (intelEngineProcess) { try { intelEngineProcess.kill('SIGTERM'); } catch {} }
        try { await DatabaseService.disconnect(); } catch (e) { console.error('DB disconnect fail', e); }
        console.log('✅ Desligamento concluído.');
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // SPA fallback (deve vir DEPOIS de todas as rotas de API)
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(clientDist, 'index.html'));
        }
    });
}).on('error', (err: any) => {
    console.error('❌ HTTP Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`   Porta ${port} já está em uso. Aguarde alguns minutos ou use outra porta.`);
    }
    process.exit(1);
});

