import axios from 'axios';

const Sentiment = require('sentiment');

export interface SentimentResult {
    score: number;
    comparative: number;
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
    keywords: string[];
    symbols: string[];
    positive: string[];
    negative: string[];
}

export interface NewsArticle {
    id: string;
    title: string;
    text?: string;
    source: string;
    url?: string;
    time: string;
    symbols?: string[];
    sentiment?: SentimentResult;
    category?: string;
}

const FMP_API_KEY = process.env.FMP_API_KEY || '38H3sDW3t09VitCF3QJe3f0X2g8ZlQJc';

const FINANCIAL_LEXICON: Record<string, number> = {
    bullish: 4, bearish: -4, rally: 3, rallying: 3, rallied: 3,
    dump: -3, dumped: -3, dumping: -3, moon: 4, moons: 4,
    crash: -5, crashed: -5, crashing: -5, correction: -2,
    volatility: -1, volatile: -1,
    outperform: 3, outperformed: 3, outperforming: 3,
    underperform: -3, underperformed: -3, underperforming: -3,
    upgrade: 3, upgraded: 3, downgrade: -3, downgraded: -3,
    'beat estimates': 3, 'miss estimates': -3,
    'earnings beat': 3, 'earnings miss': -3,
    'raised guidance': 4, 'lowered guidance': -4,
    'price target raised': 3, 'price target lowered': -3,
    'buy': 2, 'sell': -2, 'strong buy': 4, 'strong sell': -4,
    'overweight': 2, 'underweight': -2, 'equal weight': 0,
    'positive outlook': 3, 'negative outlook': -3,
    'revenue growth': 2, 'profit growth': 3, 'loss': -3,
    'profit': 3, 'record high': 4, 'record low': -4,
    'all-time high': 4, 'all-time low': -4,
    'beat': 2, 'miss': -2, 'above expectations': 3,
    'below expectations': -3, 'in-line': 0,
    'expansion': 2, 'contraction': -2, 'growth': 2,
    'decline': -2, 'recovery': 3, 'slowdown': -2,
    'recession': -4, 'boom': 4, 'bubble': -2,
    'bounce': 2, 'rebound': 3, 'sell-off': -3,
    'selloff': -3, 'buying pressure': 2, 'selling pressure': -2,
    'accumulation': 2, 'distribution': -2, 'breakout': 3,
    'breakdown': -3, 'bull market': 4, 'bear market': -4,
    'bull run': 4, 'bear trap': -2, 'bull trap': -2,
    'merger': 1, 'acquisition': 1, 'ipo': 1,
    'dividend increase': 3, 'dividend cut': -3,
    'stock buyback': 2, 'share buyback': 2,
    'sec investigation': -3, 'lawsuit': -3, 'settlement': -1,
    'positive': 3, 'negative': -3, 'record': 2,
    'surge': 3, 'surges': 3, 'surged': 3, 'plunge': -4,
    'plunges': -4, 'plunged': -4, 'soar': 3, 'soars': 3,
    'soared': 3, 'tumble': -3, 'tumbles': -3, 'tumbled': -3,
    'skyrocket': 4, 'skyrockets': 4, 'skyrocketed': 4,
    'insider buying': 3, 'insider selling': -3,
    'institutional buying': 2, 'institutional selling': -2,
    'hawkish': -2, 'dovish': 2, 'rate hike': -2, 'rate cut': 3,
    'tightening': -2, 'stimulus': 3, 'inflation': -1,
    'deflation': 1, 'unemployment': -2, 'gdp growth': 3,
    'strong data': 2, 'weak data': -2,
    'short squeeze': 3, 'gamma squeeze': 4,
    'oversold': 3, 'overbought': -2,
    'capitulation': -4, 'panic selling': -4, 'fear': -2, 'greed': 2,
    'risk-on': 2, 'risk-off': -2, 'safe haven': 1,
    'flight to quality': 1, 'yield curve': -1,
    'inverted yield curve': -3, 'steepening': 1, 'flattening': -1,
    'liquidity': 1, 'illiquid': -2, 'margin call': -4,
    'forced selling': -3, 'stop loss': -1,
    'dead cat bounce': -2, 'fakeout': -2,
    'consolidation': 0, 'accumulation phase': 2,
    'markup phase': 3, 'distribution phase': -2,
    'support level': 1, 'resistance level': -1,
    'golden cross': 3, 'death cross': -3,
    'divergence': -1, 'bullish divergence': 3,
    'bearish divergence': -3, 'double bottom': 2,
    'double top': -2, 'head and shoulders': -2,
    'cup and handle': 2, 'flag pattern': 1,
    'wedge': -1, 'breakout above': 3, 'breakdown below': -3,
    'retracement': 0, 'pullback': 1, 'throwback': -1,
    'follow-through': 2, 'exhaustion': -2,
    'nonfarm payrolls': 2, 'nfp': 2, 'cpi': -1,
    'fomc': -1, 'central bank': -1,
    'quantitative easing': 3, 'qe': 3,
    'quantitative tightening': -2, 'qt': -2,
    'hawkish pause': -1, 'dovish hike': 2,
    'artificial intelligence': 3, 'ai': 2, 'machine learning': 2,
    'semiconductor': 2, 'semiconductors': 2, 'chip': 1, 'chips': 1,
    'supply chain': -1, 'supply chain disruption': -3,
    'supply chain recovery': 2, 'bottleneck': -2,
    'geopolitical risk': -3, 'geopolitical tension': -3,
    'trade war': -3, 'tariff': -2, 'tariffs': -2,
    'sanctions': -2, 'sanction': -2,
    'earnings season': 1, 'earnings': 1, 'quarterly results': 1,
    'guidance raise': 3, 'guidance cut': -3,
    'forward guidance': 1, 'market sentiment': 0, 'risk appetite': 2,
    'risk aversion': -2, 'flight to safety': 2,
    'commodity': 1, 'commodities': 1, 'crude oil': 1,
    'natural gas': 1, 'gold': 1, 'silver': 1, 'copper': 2,
    'lithium': 3, 'rare earth': 2, 'uranium': 2,
    'hydrogen': 2, 'renewable energy': 2, 'clean energy': 2,
    'esg': 1, 'sustainability': 1, 'green energy': 2,
    'carbon credit': 1, 'carbon tax': -2,
    'cybersecurity': 1, 'cyber attack': -3, 'data breach': -3,
    'cloud computing': 2, 'cloud': 1, 'saas': 1,
    'electric vehicle': 2, 'ev': 2, 'autonomous driving': 2,
    'biotech': 2, 'pharma': 1, 'fda approval': 3,
    'clinical trial': 1, 'pipeline': 1,
    'metaverse': 1, 'web3': 1, 'blockchain technology': 2,
    'digital asset': 1, 'tokenization': 1,
    'spac': -1, 'de-spac': -3, 'blank check': -1,
    'insider trading': -3, 'pump and dump': -4,
    'wash trading': -3, 'front running': -3,
    'catalyst': 2, 'tailwind': 2, 'headwind': -2,
    'secular growth': 2, 'structural growth': 2,
    'disruption': 2, 'disruptive': 2,
    'soft landing': 2, 'hard landing': -3, 'no landing': 1,
    'base effect': 1, 'priced in': 0, 'discounted': 0,
    'buy the dip': 2, 'buying opportunity': 2,
    'value trap': -2, 'growth trap': -2,
    'crowded trade': -1, 'contrarian': 1,
    'momentum': 1, 'mean reversion': 0,
    'arbitrage': 1, 'carry trade': 1,
    'volatility index': -1, 'vix': -1, 'fear index': -1,
    'put option': -1, 'call option': 1, 'options expiry': -1,
    'max pain': -1, 'open interest': 0,
    'delisting': -3, 'bankruptcy': -5, 'default': -4,
    'restructuring': -1, 'bailout': 1, 'nationalization': -2,
    'fdi': 2, 'capital inflow': 2, 'capital outflow': -2,
    'remittance': 1, 'current account': 0,
    'sovereign debt': -1, 'credit rating': 0,
    'junk bond': -2, 'investment grade': 2,
    'treasury yield': -1, 'real yield': 1,
    'basis point': 0, 'bps': 0,
    'economic moat': 2, 'competitive advantage': 2,
    'market share': 1, 'pricing power': 2,
    'top line': 1, 'bottom line': 1, 'operating leverage': 1,
};

const PT_LEXICON: Record<string, number> = {
    alta: 2, altas: 2, sobe: 2, sobir: 2, subiu: 2, subindo: 2,
    baixa: -2, baixas: -2, cai: -2, cair: -2, caiu: -2, caindo: -2,
    queda: -3, quedas: -3, recuperação: 3, recuperou: 3,
    recorde: 3, máximo: 2, mínima: -2, pior: -3, melhor: 3,
    lucro: 3, lucros: 3, prejuízo: -3, perda: -3, perdas: -3,
    receita: 2, receitas: 2, crescimento: 3, cresceu: 3,
    declínio: -2, declinou: -2,
    expansão: 2, contração: -2, recessão: -4,
    positivo: 3, positiva: 3, negativo: -3, negativa: -3,
    otimista: 3, pessimista: -3, confiança: 2,
    incerteza: -2, instabilidade: -3, estabilidade: 2,
    investimento: 1, investidor: 1, investidores: 1,
    compra: 2, comprar: 2, venda: -2, vender: -2,
    recomendação: 1, 'recomendação de compra': 3,
    'recomendação de venda': -3, 'rating': 1,
    'elevação': 2, 'rebaixamento': -2,
    dividendo: 2, dividendos: 2, 'juros': -1,
    'selic': -1, 'inflação': -2, 'ipca': -1,
    'pib': 2, 'emprego': 2, 'desemprego': -2,
    'fusão': 1, 'aquisição': 1, 'oferta pública': 1,
    'rombo': -3, 'déficit': -2, 'superávit': 3,
    'balança comercial': 1, 'exportação': 1, 'importação': -1,
    'guidance': 1, 'guidance positivo': 3, 'guidance negativo': -3,
    'acima do esperado': 3, 'abaixo do esperado': -3,
    'em linha': 0, 'neutro': 0,
    'estouro': -2, 'explosão': -2, 'disparada': 3,
    'derretimento': -4, 'tombo': -3, 'ressaca': -2,
    'folga': 1, 'aperto': -2, 'estímulo': 3,
    pacote: 1, 'ajuda': 1, 'socorro': 1,
    'tarifa': -2, 'tarifas': -2, 'guerra comercial': -3,
    'sanção': -2, 'sanções': -2, embargo: -2,
    'criptomoeda': 1, 'bitcoin': 1, 'altcoin': 1,
    'stablecoin': 1, 'blockchain': 1,
    'mineração': 1, 'halving': 2, 'fork': -1,
    'token': 1, 'defi': 2, 'nft': 1,
    'swap': 0, 'staking': 1, 'yield': 1,
    'alavancagem': -2, 'liquidação': -3,
    'long': 1, 'short': -1, 'comprado': 1, 'vendido': -1,
    'day trade': 1, 'swing trade': 1, 'position': 1,
    'stop': -1, 'stop loss': -1, 'take profit': 1,
    'martingale': -2, 'hedge': 1, 'cobertura': 1,
    'sobrecomprado': -2, 'sobrevendido': 3,
    'suporte': 1, 'resistência': -1,
    'topo': -1, 'fundo': 1, 'sinal de compra': 3,
    'sinal de venda': -3, 'rompeu': 2, 'romper': 2,
    'suportou': 1, 'respeitou': 1,
    'análise técnica': 0, 'análise fundamentalista': 0,
    'fluxo de caixa': 2, 'dívida': -2, 'endividamento': -2,
    'patrimônio': 2, 'ativos': 1, 'passivos': -1,
    'receita líquida': 2, 'ebitda': 2,
    'margem': 1, 'margem bruta': 1, 'margem líquida': 1,
    'retorno': 2, 'rentabilidade': 2, 'ROI': 2,
    'benchmark': 0, 'ibovespa': 1, 'ifix': 1,
    'índice': 1, 'ação': 1, 'ações': 1,
    'fii': 1, 'fiis': 1, 'fundos imobiliários': 1,
    'tesouro direto': 1, 'renda fixa': 1, 'renda variável': -1,
    'poupança': 1, 'cdb': 1, 'lci': 1, 'lca': 1,
    'corretagem': -1, 'taxa': -1, 'imposto': -2,
    'isenção': 2, 'isenção fiscal': 2,
    'abertura': 1, 'fechamento': -1,
    'gap': -1, 'gap de abertura': -2,
    'lote': 0, 'minilote': 0, 'centavo': 0,
    'ponto': 0, 'pip': 0, 'pips': 0,
    'volátil': -2, 'liquidez': 1, 'ilíquido': -2,
    'book': 0, 'ordem': 0, 'ordens': 0,
    'inteligência artificial': 3, 'ia': 2, 'machine learning': 2,
    'aprendizado de máquina': 2, 'deep learning': 2,
    'semicondutor': 2, 'semicondutores': 2, 'chip': 1,
    'cadeia de suprimentos': -1, 'desabastecimento': -3,
    'risco geopolítico': -3, 'tensão geopolítica': -3,
    'guerra tarifária': -3, 'protecionismo': -2,
    'commodities': 1, 'petróleo': 1, 'minério': 1,
    'minério de ferro': 1, 'soja': 1, 'milho': 1,
    'lítio': 3, 'terras raras': 2, 'urânio': 2,
    'energia renovável': 2, 'energia limpa': 2, 'energia solar': 2,
    'energia eólica': 2, 'hidrogênio verde': 2,
    'carbono': 1, 'crédito de carbono': 1,
    'agronegócio': 1, 'agro': 1, 'safra': 2,
    'clima': -1, 'secas': -2, 'enchentes': -2, 'geada': -2,
    'industrial': 1, 'manufatura': 1, 'produção': 1,
    'varejo': 1, 'e-commerce': 2, 'digital': 1,
    'tecnologia': 2, 'startup': 1, 'inovação': 2,
    'fintech': 2, 'banco digital': 2, 'open banking': 1,
    'cripto': 1, 'criptomoedas': 1, 'ethereum': 1,
    'real digital': 1, 'drex': 1, 'pix': 1,
    'privatização': 1, 'concessão': 1, 'leilão': 1,
    'reforma tributária': 1, 'reforma fiscal': 1,
    'reforma da previdência': 1,
    'arcabouço fiscal': 1, 'regra fiscal': 1,
    'teto de gastos': 1, 'gasto público': -1,
    'dívida pública': -2, 'dívida bruta': -2,
    'resultado primário': 1, 'superávit primário': 3,
    'déficit primário': -2, 'nominal': -1,
    'copom': -1, 'taxa básica': -1,
    'corte de juros': 3, 'aumento de juros': -2,
    'cdi': 0, 'igpm': -1, 'inpc': -1,
    'focus': 1, 'boletim focus': 1, 'relatório de inflação': 1,
    'ptax': 0, 'dólar': -1, 'real': 1, 'câmbio': 0,
    'apreciação': 2, 'depreciação': -2,
    'desvalorização': -2, 'valorização': 2,
    'intervenção': -1, 'swap cambial': 1,
    'b3': 1, 'idiv': 1,
    'small cap': 1, 'large cap': 2, 'blue chip': 2,
    'ipo': 1, 'follow-on': 1,
    'subscrição': 1, 'desdobramento': 1, 'grupamento': -1,
    'bonificação': 1, 'jcp': 1, 'juros sobre capital': 1,
    'provento': 2, 'proventos': 2, 'rendimento': 2,
    'amortização': 1, 'resgate': 1, 'vencimento': -1,
    'duration': -1, 'marcação a mercado': -1,
    'risco de crédito': -2, 'calote': -4, 'inadimplência': -2,
    'recuperação judicial': -2, 'falência': -5,
    'classificação de risco': 0,
    'governança': 1, 'compliance': 1, 'auditoria': 0,
    'greenwashing': -2, 'green bond': 1,
    'lava jato': -2, 'carf': -1, 'receita federal': -1,
    'cvm': -1, 'regulamentação': 0,
    'concorrência': -1, 'monopólio': -2, 'oligopólio': -1,
    'barreira de entrada': -1, 'market share': 1,
    'fusão e aquisição': 1, 'f&a': 1, 'joint venture': 1,
    'venda de participação': 1, 'equity': 1,
    'private equity': 1, 'venture capital': 2, 'seed': 1,
    'pré-operacional': 0, 'break-even': 1,
    'ebit': 1, 'lucro líquido': 3,
    'margem ebitda': 2,
    'alavancagem financeira': -1,
    'capital de giro': 1, 'working capital': 1,
    'fluxo de caixa livre': 2, 'fcf': 2,
    'retorno sobre patrimônio': 2, 'roe': 2,
    'retorno sobre ativos': 2, 'roa': 2,
    'p/l': -1, 'preço/lucro': -1, 'p/vp': -1,
    'dividend yield': 2, 'dy': 2, 'payout': 1,
    'enterprise value': 0, 'ev': 0, 'ev/ebitda': 0,
    'dívida líquida': -1, 'dívida líquida/ebitda': -1,
    'valuation': -1, 'estressado': -1,
    'justo': 1, 'cara': -2, 'barata': 2,
    'oscilação': -1, 'volatilidade': -1,
    'pânico': -4, 'euforia': -2, 'otimismo': 2, 'pessimismo': -2,
    'cisão': 0, 'incorporação': 0, 'reorganização': 0,
};

const SYMBOL_PATTERN = /\b[A-Z]{2,5}\b(?:\.[A-Z]{1,2})?/g;
const KNOWN_SYMBOLS = new Set(['XAUUSD', 'XAGUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD',
    'AUDUSD', 'NZDUSD', 'USDCHF', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD',
    'LINKUSD', 'AVAXUSD', 'MATICUSD', 'UNIUSD', 'BNBUSD', 'DOGEUSD', 'SHIBUSD',
    'TRXUSD', 'ATOMUSD', 'FTMUSD', 'NEARUSD', 'APTUSD', 'ARBUSD', 'OPUSD',
    'AAVEUSD', 'CRVUSD', 'MKRUSD', 'COMPUSD', 'SUSHIUSD', 'CAKEUSD',
    'APEUSD', 'SANDUSD', 'MANAUSD', 'AXSUSD', 'GALAUSD', 'ENJUSD',
    'AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'META', 'NVDA', 'SPY', 'QQQ',
    'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'NFLX', 'DIS', 'BA', 'GE', 'CAT',
    'JPM', 'GS', 'BAC', 'V', 'MA', 'PYPL', 'SQ', 'COIN', 'HOOD',
    'XOM', 'CVX', 'COP', 'OXY', 'SHEL', 'TTE',
    'JNJ', 'PFE', 'MRNA', 'ABBV', 'MRK', 'UNH', 'LLY',
    'WMT', 'COST', 'TGT', 'HD', 'LOW', 'MCD', 'SBUX', 'NKE',
    'PG', 'KO', 'PEP', 'MO', 'PM', 'CL', 'KMB',
    'IBM', 'CSCO', 'QCOM', 'TXN', 'AVGO', 'MU', 'PLTR', 'SNOW', 'DDOG',
    'LMT', 'RTX', 'NOC', 'GD', 'HON', 'MMM',
    'UBER', 'LYFT', 'ABNB', 'RIVN', 'LCID', 'SNAP', 'PINS', 'RBLX',
    'DXY', 'VIX', 'WTI', 'BRENT', 'SP500', 'NASDAQ', 'DJI',
    'IBOV', 'IFIX', 'IDIV', 'SMLL', 'BOVA', 'BOVA11',
    'PETR3', 'PETR4', 'VALE3', 'ITUB3', 'ITUB4', 'BBDC3', 'BBDC4',
    'ABEV3', 'BBAS3', 'B3SA3', 'RENT3', 'WEGE3', 'LREN3', 'MGLU3',
    'VIIA3', 'AMER3', 'HAPV3', 'RAIL3', 'CCRO3', 'ECOR3',
    'EQTL3', 'NEOE3', 'ELET3', 'ELET6', 'CMIG3', 'CMIG4',
    'PRIO3', 'PETR3', 'CSNA3', 'GGBR3', 'GGBR4', 'USIM3', 'USIM4']);

export class NLPService {
    private static analyzer = new Sentiment();
    private static cache: Map<string, { data: any; time: number }> = new Map();
    private static readonly CACHE_TTL = 120000;

    static analyzeText(text: string, language: 'en' | 'pt' = 'en'): SentimentResult {
        if (!text || text.trim().length === 0) {
            return { score: 0, comparative: 0, label: 'NEUTRAL', confidence: 0, keywords: [], symbols: [], positive: [], negative: [] };
        }

        const lexicon: Record<string, number> = language === 'pt' ? PT_LEXICON : {};
        Object.assign(lexicon, FINANCIAL_LEXICON);

        const result = this.analyzer.analyze(text, { extras: lexicon });

        const words = text.toLowerCase().split(/\s+/);
        const keywords = this.extractKeywords(text, language);
        const symbols = this.extractSymbols(text);

        const score = result.score;
        const comparative = result.comparative;
        const maxPossible = words.length * 4;
        const confidence = maxPossible > 0 ? Math.min(Math.abs(score) / maxPossible * 2, 1) : 0;

        let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        if (comparative > 0.1) label = 'POSITIVE';
        else if (comparative < -0.1) label = 'NEGATIVE';
        else label = 'NEUTRAL';

        return {
            score,
            comparative: Math.round(comparative * 1000) / 1000,
            label,
            confidence: Math.round(confidence * 100) / 100,
            keywords,
            symbols,
            positive: result.positive || [],
            negative: result.negative || [],
        };
    }

    static analyzeArticles(articles: NewsArticle[]): NewsArticle[] {
        for (const article of articles) {
            const text = `${article.title} ${article.text || ''}`;
            const hasPortuguese = /[à-úÀ-Ú]/.test(text);
            article.sentiment = this.analyzeText(text, hasPortuguese ? 'pt' : 'en');
            if (!article.symbols || article.symbols.length === 0) {
                article.symbols = article.sentiment.symbols;
            }
        }
        return articles;
    }

    static extractKeywords(text: string, language: 'en' | 'pt' = 'en'): string[] {
        const stopwords = new Set(language === 'pt'
            ? ['de', 'da', 'do', 'em', 'para', 'com', 'uma', 'um', 'os', 'as', 'na', 'no',
               'que', 'é', 'por', 'mais', 'dos', 'das', 'aos', 'nas', 'nos', 'se', 'sua',
               'seu', 'suas', 'seus', 'pelo', 'pela', 'como', 'entre', 'foi', 'ser']
            : ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or',
               'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
               'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
               'this', 'that', 'these', 'those', 'it', 'its', 'by', 'from', 'as', 'but']);

        const words = text.toLowerCase()
            .replace(/[^a-záàâãéèêíïóôõöúçñ\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopwords.has(w));

        const freq: Record<string, number> = {};
        for (const w of words) freq[w] = (freq[w] || 0) + 1;

        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    static extractSymbols(text: string): string[] {
        const found = text.match(SYMBOL_PATTERN) || [];
        return [...new Set(found.filter(s => KNOWN_SYMBOLS.has(s)))];
    }

    static async fetchNews(symbols: string[] = ['XAUUSD', 'BTCUSD'], limit = 10): Promise<NewsArticle[]> {
        const cacheKey = `news_${symbols.join('_')}_${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.CACHE_TTL) return cached.data;

        try {
            const articles: NewsArticle[] = [];

            const resp = await axios.get('https://financialmodelingprep.com/api/v3/stock_news', {
                params: { tickers: symbols.join(','), limit, apikey: FMP_API_KEY },
                timeout: 8000,
            }).catch(() => ({ data: [] }));

            const items = resp.data || [];
            for (const item of items) {
                articles.push({
                    id: `fmp_${item.publishedDate || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    title: item.title || '',
                    text: item.text || item.content || '',
                    source: item.site || item.source || 'FMP',
                    url: item.url,
                    time: item.publishedDate || new Date().toISOString(),
                    symbols: item.symbols || symbols.filter(s => (item.title || '').includes(s)),
                    category: item.category || 'general',
                });
            }

            if (articles.length < 3) {
                const altResp = await axios.get(
                    `https://financialmodelingprep.com/api/v3/fmp/articles?limit=${limit}&apikey=${FMP_API_KEY}`,
                    { timeout: 8000 }
                ).catch(() => ({ data: { content: [] } }));

                const altItems = altResp.data?.content || [];
                for (const item of altItems) {
                    articles.push({
                        id: `fmpa_${item.date || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        title: item.title || '',
                        text: item.content || '',
                        source: 'FMP Articles',
                        url: item.url,
                        time: item.date || item.publishedDate || new Date().toISOString(),
                        symbols: item.tickers || [],
                        category: 'general',
                    });
                }
            }

            this.analyzeArticles(articles);
            this.cache.set(cacheKey, { data: articles, time: Date.now() });
            return articles;
        } catch (e) {
            console.error('❌ NLPService: fetchNews error', e);
            return [];
        }
    }

    static getAggregatedSentiment(symbol: string): {
        symbol: string;
        sentiment: number;
        label: string;
        articleCount: number;
        positiveCount: number;
        negativeCount: number;
        recents: SentimentResult[];
    } | null {
        const cached = [...this.cache.entries()]
            .filter(([k]) => k.startsWith('news_'))
            .sort((a, b) => b[1].time - a[1].time);

        if (cached.length === 0) return null;

        const latestData = cached[0][1].data as NewsArticle[];
        const relevant = latestData.filter(a =>
            a.symbols?.includes(symbol) || a.title.includes(symbol)
        );
        const articles = relevant.length > 0 ? relevant : latestData.slice(0, 5);

        if (articles.length === 0) return null;

        const positive = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
        const negative = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
        const avgScore = articles.reduce((s, a) => s + (a.sentiment?.comparative || 0), 0) / articles.length;

        return {
            symbol,
            sentiment: Math.round(avgScore * 100) / 100,
            label: avgScore > 0.1 ? 'POSITIVE' : avgScore < -0.1 ? 'NEGATIVE' : 'NEUTRAL',
            articleCount: articles.length,
            positiveCount: positive,
            negativeCount: negative,
            recents: articles.slice(0, 5).map(a => a.sentiment!),
        };
    }
}
