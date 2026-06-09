import axios from 'axios';
import { MLInsightsService } from './MLInsightsService';
import { BridgeClient } from './BridgeClient';
import { NLPService, NewsArticle } from './NLPService';
import { PatternDetector, PatternAnalysis } from './PatternDetector';

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
const SERVER_URL = process.env.SERVER_URL || `http://127.0.0.1:${process.env.PORT || 3015}`;
const INTEL_ENGINE_URL = process.env.INTEL_ENGINE_URL || 'http://127.0.0.1:5004';

interface AnalystReport {
    timestamp: number;
    symbol: string;
    direction: AnalystDirection;
    confidence: number;
    summary: string;
    technicalAnalysis: TechnicalAnalysis;
    fundamentalAnalysis: FundamentalAnalysis;
    bestTimes: TradeTimeWindow[];
    statistics: SymbolStats;
    risks: RiskAssessment[];
    recommendations: string[];
    economicEvents: EconomicImpact[];
    score: number;
}

type AnalystDirection = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

interface TechnicalAnalysis {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'INDEFINIDO';
    strength: number;
    shortTerm: string;
    longTerm: string;
    support: number;
    resistance: number;
    indicators: { name: string; value: string; signal: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO' }[];
}

interface FundamentalAnalysis {
    newsSentiment: number;
    newsLabel: string;
    recentNews: NewsArticle[];
    economicImpact: string;
    marketRegime: string;
    regimeDescription: string;
}

interface TradeTimeWindow {
    hour: string;
    label: string;
    winRate: number;
    recommendation: 'ALTA' | 'MEDIA' | 'BAIXA' | 'EVITAR';
}

interface SymbolStats {
    dailyAvgProfit: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    bestDay: string;
    worstDay: string;
}

interface RiskAssessment {
    factor: string;
    level: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
    description: string;
}

interface EconomicImpact {
    event: string;
    date: string;
    impact: 'ALTO' | 'MEDIO' | 'BAIXO';
    currency: string;
    forecast: string;
    previous: string;
}

const SYMBOL_MAP: Record<string, { name: string; type: string; session: string }> = {
    XAUUSD: { name: 'Ouro', type: 'Commodity', session: '24h (pico London/NY)' },
    BTCUSD: { name: 'Bitcoin', type: 'Criptomoeda', session: '24h' },
    ETHUSD: { name: 'Ethereum', type: 'Criptomoeda', session: '24h' },
    EURUSD: { name: 'Euro/Dólar', type: 'Forex', session: 'London/NY' },
    GBPUSD: { name: 'Libra/Dólar', type: 'Forex', session: 'London' },
    USDJPY: { name: 'Dólar/Iene', type: 'Forex', session: 'Asia/London' },
    US30: { name: 'Dow Jones', type: 'Índice', session: 'NY (09:30-16:00)' },
    SP500: { name: 'S&P 500', type: 'Índice', session: 'NY (09:30-16:00)' },
    NASDAQ: { name: 'Nasdaq', type: 'Índice', session: 'NY (09:30-16:00)' },
};

const BEST_TIMES: Record<string, { hour: string; label: string; wr: number }[]> = {
    XAUUSD: [
        { hour: '03:00', label: 'Abertura Londres (sobreposição NY)', wr: 68 },
        { hour: '09:30', label: 'Pré-NY (dados EUA)', wr: 72 },
        { hour: '10:30', label: 'Meio da sessão NY', wr: 65 },
    ],
    EURUSD: [
        { hour: '04:00', label: 'Abertura Londres', wr: 70 },
        { hour: '09:00', label: 'Pré-NY + Londres', wr: 74 },
        { hour: '10:00', label: 'Dados econômicos EUA', wr: 71 },
    ],
    BTCUSD: [
        { hour: '09:00', label: 'Abertura NY (volatilidade cripto)', wr: 62 },
        { hour: '15:00', label: 'Fechamento futuros CME', wr: 66 },
    ],
};

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export class AIAnalystAgent {

    static async analyze(symbol: string): Promise<AnalystReport> {
        const upperSymbol = symbol.toUpperCase();
        const now = Date.now();

        const [mlReport, sentimentNews, calendarData, tradeHistory, currentPrice, patternAnalysis, intelAnalysis] = await Promise.all([
            this.getMLReport(upperSymbol).catch(() => null),
            this.getNewsSentiment(upperSymbol).catch(() => null),
            this.getEconomicCalendar().catch(() => []),
            this.getTradeHistory(upperSymbol).catch(() => []),
            this.getCurrentPrice(upperSymbol).catch(() => null),
            this.getPatternAnalysis(upperSymbol).catch(() => null),
            this.getIntelAnalysis(upperSymbol).catch(() => null),
        ]);

        const technical = this.buildTechnicalAnalysis(mlReport, upperSymbol, currentPrice, patternAnalysis, intelAnalysis);
        const fundamental = this.buildFundamentalAnalysis(mlReport, sentimentNews, upperSymbol);
        const bestTimes = this.getBestTimes(upperSymbol);
        const stats = this.buildStats(tradeHistory);
        const risks = this.assessRisks(technical, fundamental, stats, calendarData, upperSymbol);
        const economicEvents = this.getRelevantEvents(calendarData, upperSymbol);
        const direction = this.determineDirection(technical, fundamental, stats, risks);
        const recommendations = this.generateRecommendations(direction, technical, fundamental, stats, risks, upperSymbol);
        const summary = this.generateSummary(upperSymbol, direction, technical, fundamental, stats, economicEvents);
        const confidence = this.calculateConfidence(technical, fundamental, stats);

        return {
            timestamp: now,
            symbol: upperSymbol,
            direction,
            confidence,
            summary,
            technicalAnalysis: technical,
            fundamentalAnalysis: fundamental,
            bestTimes,
            statistics: stats,
            risks,
            recommendations,
            economicEvents,
            score: this.calculateScore(direction, confidence, stats),
        };
    }

    private static async getPatternAnalysis(symbol: string): Promise<PatternAnalysis | null> {
        try {
            const resp = await axios.get(`${BRIDGE_URL}/candles`, {
                params: { symbol, timeframe: 'H1', count: 60 }, timeout: 5000,
            });
            const candles = Array.isArray(resp.data?.candles) ? resp.data.candles : Array.isArray(resp.data) ? resp.data : [];
            if (!candles || candles.length < 10) return null;
            return PatternDetector.analyze(candles);
        } catch { return null; }
    }

    private static async getIntelAnalysis(symbol: string): Promise<any | null> {
        try {
            const resp = await axios.post(`${INTEL_ENGINE_URL}/api/intel-engine/analyze`, { symbol, force_refresh: false }, { timeout: 8000 });
            return resp.data;
        } catch { return null; }
    }

    private static async getMLReport(symbol: string) {
        try {
            const resp = await axios.get(`${SERVER_URL}/api/mt5/ml-insights/full-report`, { timeout: 8000 });
            return resp.data;
        } catch { return null; }
    }

    private static async getNewsSentiment(symbol: string): Promise<{ news: NewsArticle[]; sentiment: number; label: string } | null> {
        try {
            const articles = await NLPService.fetchNews(['XAUUSD', 'BTCUSD', symbol], 20);
            const relevant = articles.filter((a: NewsArticle) =>
                a.symbols?.some((s: string) => s.toUpperCase() === symbol) ||
                a.title?.toUpperCase().includes(symbol.replace('USD', '').replace('XAU', 'GOLD'))
            ).slice(0, 5);
            const sentiment = relevant.length > 0
                ? relevant.reduce((sum: number, a: NewsArticle) => sum + (a.sentiment?.score || 0), 0) / relevant.length
                : 0;
            const label = sentiment > 0.5 ? 'POSITIVO' : sentiment < -0.5 ? 'NEGATIVO' : 'NEUTRO';
            return { news: relevant, sentiment, label };
        } catch { return null; }
    }

    private static async getEconomicCalendar(): Promise<any[]> {
        try {
            const resp = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 5000 });
            return Array.isArray(resp.data) ? resp.data : [];
        } catch { return []; }
    }

    private static async getTradeHistory(symbol: string): Promise<any[]> {
        try {
            const history = await BridgeClient.getHistory();
            return (Array.isArray(history) ? history : []).filter((t: any) =>
                t.symbol?.toUpperCase() === symbol && t.profit !== undefined
            );
        } catch { return []; }
    }

    private static async getCurrentPrice(symbol: string): Promise<number | null> {
        try {
            const resp = await axios.get(`${BRIDGE_URL}/candles`, { params: { symbol, timeframe: 'H1', count: 1 }, timeout: 5000 });
            const candles = resp.data?.candles || resp.data || [];
            return Array.isArray(candles) && candles.length > 0 ? candles[candles.length - 1].close : null;
        } catch { return null; }
    }

    private static buildTechnicalAnalysis(
        mlReport: any, symbol: string, currentPrice: number | null,
        patternAnalysis: PatternAnalysis | null, intelAnalysis: any | null,
    ): TechnicalAnalysis {
        const prediction = mlReport?.predictions?.[0];
        const regime = mlReport?.regime;
        const tfSignals = prediction?.timeframes || [];

        const shortTerm = tfSignals.length > 0
            ? tfSignals.slice(0, 2).map((t: any) => `${t.timeframe}: ${t.trend} (${t.strength.toFixed(0)}%)`).join(' | ')
            : 'Sem dados intradiários';

        const longTerm = tfSignals.length > 2
            ? tfSignals.slice(2).map((t: any) => `${t.timeframe}: ${t.trend}`).join(' | ')
            : 'Sem dados de longo prazo';

        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (prediction?.direction === 'UP') trend = 'BULLISH';
        else if (prediction?.direction === 'DOWN') trend = 'BEARISH';
        else if (regime?.regime?.includes('BULL')) trend = 'BULLISH';
        else if (regime?.regime?.includes('BEAR')) trend = 'BEARISH';
        else if (intelAnalysis?.final_direction === 'BUY') trend = 'BULLISH';
        else if (intelAnalysis?.final_direction === 'SELL') trend = 'BEARISH';

        let strength = prediction?.confidence || regime?.strength || 50;
        if (intelAnalysis?.final_confidence) {
            strength = Math.round((strength + intelAnalysis.final_confidence) / 2);
        }

        const indicators: { name: string; value: string; signal: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO' }[] = [];

        if (tfSignals.length > 0) {
            for (const tf of tfSignals.slice(0, 4)) {
                const signal = tf.trend === 'BULLISH' ? 'POSITIVO' as const
                    : tf.trend === 'BEARISH' ? 'NEGATIVO' as const
                    : 'NEUTRO' as const;
                indicators.push({
                    name: `${tf.timeframe}`,
                    value: `${tf.trend} (RSI: ${tf.rsi?.toFixed(0) || 'N/A'})`,
                    signal,
                });
            }
        }

        const quantAgent = intelAnalysis?.agent_results?.quant_stats;
        if (quantAgent && !quantAgent.error) {
            for (const tf of ['M5', 'M15', 'H1', 'D1']) {
                const tfData = quantAgent[tf];
                if (!tfData) continue;
                const rsi = tfData.rsi;
                const bbUpper = tfData.bollinger_upper;
                const bbLower = tfData.bollinger_lower;
                if (rsi !== undefined) {
                    const signal = rsi > 70 ? 'NEGATIVO' as const : rsi < 30 ? 'POSITIVO' as const : 'NEUTRO' as const;
                    indicators.push({
                        name: `RSI ${tf}`,
                        value: rsi.toFixed(1),
                        signal,
                    });
                }
                if (bbUpper !== undefined && currentPrice) {
                    const bbSignal = currentPrice > bbUpper ? 'NEGATIVO' as const : currentPrice < bbLower ? 'POSITIVO' as const : 'NEUTRO' as const;
                    indicators.push({
                        name: `BB ${tf}`,
                        value: `Sup ${bbUpper.toFixed(1)} Inf ${bbLower.toFixed(1)}`,
                        signal: bbSignal,
                    });
                }
            }
        }

        if (patternAnalysis && patternAnalysis.candles.length > 0) {
            const topPatterns = patternAnalysis.candles.slice(0, 3);
            for (const p of topPatterns) {
                const signal = p.type === 'bullish' ? 'POSITIVO' as const
                    : p.type === 'bearish' ? 'NEGATIVO' as const
                    : 'NEUTRO' as const;
                indicators.push({
                    name: `Padrão ${p.name}`,
                    value: `${p.type} (${p.confidence.toFixed(0)}%)`,
                    signal,
                });
            }
        }

        let support = prediction?.supportResistance?.support || 0;
        let resistance = prediction?.supportResistance?.resistance || 0;
        if (patternAnalysis && patternAnalysis.supportResistance.length > 0) {
            const supports = patternAnalysis.supportResistance.filter(s => s.type === 'support');
            const resistances = patternAnalysis.supportResistance.filter(s => s.type === 'resistance');
            if (supports.length > 0) support = supports[0].level;
            if (resistances.length > 0) resistance = resistances[0].level;
        }

        return {
            trend,
            strength,
            shortTerm,
            longTerm,
            support,
            resistance,
            indicators,
        };
    }

    private static buildFundamentalAnalysis(
        mlReport: any, sentiment: any, symbol: string
    ): FundamentalAnalysis {
        const regime = mlReport?.regime;
        return {
            newsSentiment: sentiment?.sentiment || 0,
            newsLabel: sentiment?.label || 'NEUTRO',
            recentNews: sentiment?.news || [],
            economicImpact: this.getEconomicImpactDescription(symbol),
            marketRegime: regime?.regime || 'INDEFINIDO',
            regimeDescription: regime?.description || 'Sem dados de regime disponiveis',
        };
    }

    private static getEconomicImpactDescription(symbol: string): string {
        if (symbol.includes('XAU') || symbol.includes('GOLD')) {
            return 'Ouro e diretamente afetado por dados de inflacao (CPI, PPI), decisoes do FOMC e tensoes geopoliticas.';
        }
        if (symbol.includes('BTC') || symbol.includes('ETH')) {
            return 'Criptomoedas sao influenciadas por noticias regulatorias, adocao institucional e fluxo de liquidez global.';
        }
        if (symbol.includes('USD')) {
            return 'Pares com USD reagem a dados de emprego (NFP), CPI, PIB americano e comunicados do Fed.';
        }
        return 'Siga o calendario economico para eventos de alto impacto que afetam este ativo.';
    }

    private static getBestTimes(symbol: string): TradeTimeWindow[] {
        const times = BEST_TIMES[symbol] || BEST_TIMES.XAUUSD;
        return times.map(t => ({
            hour: t.hour,
            label: t.label,
            winRate: t.wr,
            recommendation: t.wr >= 70 ? 'ALTA' as const : t.wr >= 60 ? 'MEDIA' as const : 'BAIXA' as const,
        }));
    }

    private static buildStats(trades: any[]): SymbolStats {
        if (trades.length === 0) {
            return {
                dailyAvgProfit: 0, winRate: 0, totalTrades: 0, profitFactor: 0,
                consecutiveWins: 0, consecutiveLosses: 0, avgWin: 0, avgLoss: 0,
                expectancy: 0, bestDay: 'N/A', worstDay: 'N/A',
            };
        }

        const wins = trades.filter((t: any) => t.profit > 0);
        const losses = trades.filter((t: any) => t.profit < 0);
        const totalProfit = trades.reduce((s: number, t: any) => s + (t.profit || 0), 0);
        const avgWin = wins.length > 0 ? wins.reduce((s: number, t: any) => s + t.profit, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((s: number, t: any) => s + Math.abs(t.profit), 0) / losses.length : 0;
        const winRate = (wins.length / trades.length) * 100;
        const grossProfit = wins.reduce((s: number, t: any) => s + t.profit, 0);
        const grossLoss = losses.reduce((s: number, t: any) => s + Math.abs(t.profit), 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
        const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);

        const dayMap: Record<string, number> = {};
        trades.forEach((t: any) => {
            const d = t.time ? new Date(t.time * 1000).getDay() : 0;
            const dayName = DAYS_PT[d] || 'Dom';
            dayMap[dayName] = (dayMap[dayName] || 0) + (t.profit || 0);
        });
        const sortedDays = Object.entries(dayMap).sort(([, a], [, b]) => b - a);
        const bestDay = sortedDays.length > 0 ? sortedDays[0][0] : 'N/A';
        const worstDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1][0] : 'N/A';

        let consWins = 0, consLosses = 0, maxConsWins = 0, maxConsLosses = 0;
        for (const t of trades) {
            if (t.profit > 0) { consWins++; consLosses = 0; }
            else if (t.profit < 0) { consLosses++; consWins = 0; }
            if (consWins > maxConsWins) maxConsWins = consWins;
            if (consLosses > maxConsLosses) maxConsLosses = consLosses;
        }

        return {
            dailyAvgProfit: Number((totalProfit / Math.max(1, trades.length)).toFixed(2)),
            winRate: Number(winRate.toFixed(1)),
            totalTrades: trades.length,
            profitFactor: Number(profitFactor.toFixed(2)),
            consecutiveWins: maxConsWins,
            consecutiveLosses: maxConsLosses,
            avgWin: Number(avgWin.toFixed(2)),
            avgLoss: Number(avgLoss.toFixed(2)),
            expectancy: Number(expectancy.toFixed(2)),
            bestDay,
            worstDay,
        };
    }

    private static assessRisks(
        technical: TechnicalAnalysis, fundamental: FundamentalAnalysis,
        stats: SymbolStats, calendar: any[], symbol: string
    ): RiskAssessment[] {
        const risks: RiskAssessment[] = [];

        if (stats.consecutiveLosses >= 3) {
            risks.push({
                factor: 'Sequencia de Perdas',
                level: 'ALTO',
                description: `${stats.consecutiveLosses} perdas consecutivas detectadas. Considere pausar ate reverter o ciclo.`,
            });
        }

        if (stats.expectancy < 0 && stats.totalTrades >= 10) {
            risks.push({
                factor: 'Expectativa Negativa',
                level: 'CRITICO',
                description: `Expectativa de $${stats.expectancy} por trade. A estrategia atual esta perdendo dinheiro no longo prazo.`,
            });
        }

        if (fundamental.newsSentiment < -1) {
            risks.push({
                factor: 'Sentimento de Mercado',
                level: 'MEDIO',
                description: 'Noticias recentes negativas podem afetar a direcao do ativo.',
            });
        }

        const highImpactEvents = calendar.filter((e: any) =>
            e.impact === 'High' &&
            (e.currency === 'USD' || e.country === 'United States')
        );
        if (highImpactEvents.length > 0) {
            risks.push({
                factor: 'Eventos Economicos',
                level: 'ALTO',
                description: `${highImpactEvents.length} evento(s) de alto impacto nas proximas horas. Evite entrar antes de dados fortes.`,
            });
        }

        const today = new Date().getDay();
        if (today === 5) {
            risks.push({
                factor: 'Sexta-Feira (Final de Semana)',
                level: 'MEDIO',
                description: 'Reduza posicoes antes do fechamento semanal. Risco de gap na abertura de segunda.',
            });
        }

        if (risks.length === 0) {
            risks.push({
                factor: 'Risco Geral',
                level: 'BAIXO',
                description: 'Nenhum risco significativo detectado. Condicoes favoraveis para operar.',
            });
        }

        return risks;
    }

    private static getRelevantEvents(calendar: any[], symbol: string): EconomicImpact[] {
        const relevantCurrencies: string[] = [];
        if (symbol.includes('USD')) relevantCurrencies.push('USD');
        if (symbol.includes('EUR')) relevantCurrencies.push('EUR');
        if (symbol.includes('GBP')) relevantCurrencies.push('GBP');
        if (symbol.includes('JPY')) relevantCurrencies.push('JPY');
        if (symbol.includes('XAU') || symbol.includes('GOLD')) relevantCurrencies.push('USD', 'EUR');

        return calendar
            .filter((e: any) => relevantCurrencies.includes(e.currency || '') && e.impact === 'High')
            .slice(0, 5)
            .map((e: any) => ({
                event: e.title || e.event || 'Evento economico',
                date: e.date || e.time || '',
                impact: (e.impact === 'High' ? 'ALTO' : e.impact === 'Medium' ? 'MEDIO' : 'BAIXO') as 'ALTO' | 'MEDIO' | 'BAIXO',
                currency: e.currency || '',
                forecast: e.forecast || '-',
                previous: e.previous || '-',
            }));
    }

    private static determineDirection(
        technical: TechnicalAnalysis, fundamental: FundamentalAnalysis,
        stats: SymbolStats, risks: RiskAssessment[]
    ): AnalystDirection {
        let score = 50;

        if (technical.trend === 'BULLISH') score += 15;
        else if (technical.trend === 'BEARISH') score -= 15;

        score += (technical.strength - 50) * 0.3;

        if (stats.winRate > 60) score += 10;
        else if (stats.winRate < 40 && stats.totalTrades > 5) score -= 10;

        if (stats.expectancy > 0) score += 8;
        else if (stats.expectancy < 0) score -= 8;

        if (fundamental.newsSentiment > 0.5) score += 5;
        else if (fundamental.newsSentiment < -0.5) score -= 5;

        const hasCriticalRisk = risks.some(r => r.level === 'CRITICO');
        if (hasCriticalRisk) score -= 15;

        const hasHighRisk = risks.some(r => r.level === 'ALTO');
        if (hasHighRisk) score -= 8;

        if (stats.consecutiveLosses >= 3) score -= 10;

        if (score >= 70) return 'STRONG_BUY';
        if (score >= 55) return 'BUY';
        if (score <= 30) return 'STRONG_SELL';
        if (score <= 45) return 'SELL';
        return 'NEUTRAL';
    }

    private static calculateConfidence(
        technical: TechnicalAnalysis, fundamental: FundamentalAnalysis, stats: SymbolStats
    ): number {
        let confidence = 60;
        confidence += technical.strength * 0.15;
        confidence += stats.winRate * 0.2;
        confidence += Math.min(15, stats.totalTrades * 0.5);
        confidence += Math.min(10, fundamental.newsSentiment * 5);
        return Math.min(99, Math.max(10, Number(confidence.toFixed(0))));
    }

    private static generateRecommendations(
        direction: AnalystDirection, technical: TechnicalAnalysis,
        fundamental: FundamentalAnalysis, stats: SymbolStats,
        risks: RiskAssessment[], symbol: string
    ): string[] {
        const recs: string[] = [];

        if (direction === 'STRONG_BUY' || direction === 'BUY') {
            recs.push('Direcao predominante de COMPRA. Busque entradas em suportes tecnicos.');
            if (stats.expectancy > 0) {
                recs.push(`Expectativa positiva de $${stats.expectancy} por trade. Estrategia viavel.`);
            }
        } else if (direction === 'STRONG_SELL' || direction === 'SELL') {
            recs.push('Direcao predominante de VENDA. Busque entradas em resistencias.');
        } else {
            recs.push('Mercado neutro. Aguarde definicao ou opere apenas em timeframes maiores.');
        }

        if (stats.consecutiveLosses >= 3) {
            recs.push(`ALERTA: ${stats.consecutiveLosses} perdas consecutivas. Reduza lotes ou pare ate reverter.`);
        }

        if (stats.winRate > 60 && stats.totalTrades >= 10) {
            recs.push(`Win rate de ${stats.winRate}% em ${stats.totalTrades} trades. Consistencia positiva.`);
        }

        if (technical.support > 0 && technical.resistance > 0) {
            recs.push(`Zonas-chave: Suporte em $${technical.support.toFixed(2)} | Resistencia em $${technical.resistance.toFixed(2)}`);
        }

        const hasHighRisk = risks.some(r => r.level === 'ALTO' || r.level === 'CRITICO');
        if (hasHighRisk) {
            recs.push('Risco elevado detectado. Considere reduzir exposicao ou usar stops mais curtos.');
        }

        const bestTime = this.getBestTimes(symbol)[0];
        if (bestTime) {
            recs.push(`Melhor horario: ${bestTime.hour} (${bestTime.label} - ${bestTime.winRate}% acerto historico)`);
        }

        return recs;
    }

    private static generateSummary(
        symbol: string, direction: AnalystDirection,
        technical: TechnicalAnalysis, fundamental: FundamentalAnalysis,
        stats: SymbolStats, events: EconomicImpact[]
    ): string {
        const symbolInfo = SYMBOL_MAP[symbol] || { name: symbol, type: 'Ativo', session: 'Variado' };
        let summary = `${symbolInfo.name} (${symbol}) — `;

        const dirLabels: Record<string, string> = {
            STRONG_BUY: 'SINAL FORTE DE COMPRA',
            BUY: 'TENDENCIA DE COMPRA',
            NEUTRAL: 'NEUTRO / LATERAL',
            SELL: 'TENDENCIA DE VENDA',
            STRONG_SELL: 'SINAL FORTE DE VENDA',
        };

        summary += `${dirLabels[direction] || 'ANALISE'}. `;
        summary += `Tendencia ${technical.trend.toLowerCase()} com forca de ${technical.strength.toFixed(0)}%. `;

        if (stats.totalTrades > 0) {
            summary += `${stats.totalTrades} trades analisados | WR: ${stats.winRate}% | PF: ${stats.profitFactor}. `;
        }

        if (events.length > 0) {
            summary += `${events.length} evento(s) economico(s) de alto impacto nos proximos dias. `;
        }

        if (fundamental.newsLabel !== 'NEUTRO') {
            summary += `Sentimento de noticias: ${fundamental.newsLabel}. `;
        }

        summary += `Sessao recomendada: ${symbolInfo.session}.`;
        return summary;
    }

    private static calculateScore(
        direction: AnalystDirection, confidence: number, stats: SymbolStats
    ): number {
        let score = confidence;
        const dirScores: Record<string, number> = {
            STRONG_BUY: 20, BUY: 10, NEUTRAL: 0, SELL: -10, STRONG_SELL: -20,
        };
        score += dirScores[direction] || 0;

        if (stats.totalTrades > 0) {
            score += Math.min(15, (stats.winRate - 50) * 0.3);
            score += Math.min(10, Math.max(-10, stats.expectancy * 2));
        }

        return Math.min(100, Math.max(0, Number(score.toFixed(0))));
    }

    static async getMultiAssetReport(symbols: string[]): Promise<AnalystReport[]> {
        const results = await Promise.allSettled(symbols.map(s => this.analyze(s)));
        return results
            .filter((r): r is PromiseFulfilledResult<AnalystReport> => r.status === 'fulfilled')
            .map(r => r.value);
    }

    static async getMarketOverview(): Promise<{
        reports: AnalystReport[];
        topPick: AnalystReport | null;
        summary: string;
    }> {
        const defaultSymbols = ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'US30'];
        const reports = await this.getMultiAssetReport(defaultSymbols);

        const scored = reports.filter(r => r.direction !== 'NEUTRAL').sort((a, b) => b.score - a.score);
        const topPick = scored.length > 0 ? scored[0] : null;

        const bullish = reports.filter(r => r.direction === 'STRONG_BUY' || r.direction === 'BUY').length;
        const bearish = reports.filter(r => r.direction === 'STRONG_SELL' || r.direction === 'SELL').length;
        const total = reports.length;

        let summary = `Analise de ${total} ativos: ${bullish} compra, ${bearish} venda, ${total - bullish - bearish} neutro. `;
        if (topPick) {
            summary += `Melhor oportunidade: ${topPick.symbol} (Score: ${topPick.score}/100, ${topPick.direction}). `;
        }
        summary += 'Use o filtro de orcamento e calendario economico para refinar suas entradas.';

        return { reports, topPick, summary };
    }
}
