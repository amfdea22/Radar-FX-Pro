import axios from 'axios';

export interface EconomicEvent {
    date: string;
    time: string;
    currency: string;
    impact: 'H' | 'M' | 'L';
    title: string;
    forecast: string;
    previous: string;
    actual?: string;
}

export interface InvestingAnalysis {
    summary: string;
    rsi: { value: string; action: string };
    macd: { value: string; action: string };
    stochastic: { value: string; action: string };
    adx: { value: string; action: string };
    pivotPoints: {
        classic: { s3: string; s2: string; s1: string; pivot: string; r1: string; r2: string; r3: string };
        fibonacci: { s3: string; s2: string; s1: string; pivot: string; r1: string; r2: string; r3: string };
    };
    movingAverages: { period: string; value: string; signal: string }[];
}

export interface ResearchData {
    calendar: EconomicEvent[];
    analysisSources: { source: string; title: string; summary: string; url: string }[];
    investingTech?: InvestingAnalysis | null;
    fetchedAt: string;
}

export class ResearchService {
    private static readonly BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static readonly FOREX_FACTORY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    private static cache: { data: ResearchData; expiry: number } | null = null;
    private static readonly CACHE_TTL = 15 * 60 * 1000;

    private static symbolToInvesting(symbol: string): { url: string; label: string } {
        const map: Record<string, { url: string; label: string }> = {
            'XAUUSD': { url: 'https://www.investing.com/commodities/gold-technical-analysis', label: 'XAU/USD' },
            'XAGUSD': { url: 'https://www.investing.com/commodities/silver-technical-analysis', label: 'XAG/USD' },
            'GBPUSD': { url: 'https://www.investing.com/technical/gbp-usd-technical-analysis', label: 'GBP/USD' },
            'EURUSD': { url: 'https://www.investing.com/technical/eur-usd-technical-analysis', label: 'EUR/USD' },
            'USDJPY': { url: 'https://www.investing.com/technical/usd-jpy-technical-analysis', label: 'USD/JPY' },
            'AUDUSD': { url: 'https://www.investing.com/technical/aud-usd-technical-analysis', label: 'AUD/USD' },
            'NZDUSD': { url: 'https://www.investing.com/technical/nzd-usd-technical-analysis', label: 'NZD/USD' },
            'USDCAD': { url: 'https://www.investing.com/technical/usd-cad-technical-analysis', label: 'USD/CAD' },
            'EURGBP': { url: 'https://www.investing.com/technical/eur-gbp-technical-analysis', label: 'EUR/GBP' },
            'USOIL': { url: 'https://www.investing.com/commodities/crude-oil-technical-analysis', label: 'US Oil' },
            'BTCUSD': { url: 'https://www.investing.com/technical/btc-usd-technical-analysis', label: 'BTC/USD' },
        };
        return map[symbol.toUpperCase()] || { url: '', label: symbol };
    }

    private static symbolToLiteFinance(symbol: string): string {
        const map: Record<string, string> = {
            'XAUUSD': 'gold,xauusd',
            'XAGUSD': 'silver,xagusd',
            'GBPUSD': 'gbpusd,gbp',
            'EURUSD': 'eurusd,eur',
            'USDJPY': 'usdjpy',
            'AUDUSD': 'audusd',
            'USDCAD': 'usdcad',
            'NZDUSD': 'nzdusd',
            'BTCUSD': 'bitcoin,btc',
            'USOIL': 'oil,wti',
        };
        return map[symbol.toUpperCase()] || symbol.toLowerCase();
    }

    static async getResearch(symbol?: string): Promise<ResearchData> {
        if (this.cache && Date.now() < this.cache.expiry) return this.cache.data;

        const [calendar, analysis, investing] = await Promise.allSettled([
            this.fetchCalendar(),
            this.fetchAnalysis(symbol),
            symbol ? this.fetchInvestingTech(symbol) : Promise.resolve(null),
        ]);

        const data: ResearchData = {
            calendar: calendar.status === 'fulfilled' ? calendar.value : [],
            analysisSources: analysis.status === 'fulfilled' ? analysis.value : [],
            investingTech: investing.status === 'fulfilled' ? investing.value : null,
            fetchedAt: new Date().toISOString(),
        };

        this.cache = { data, expiry: Date.now() + this.CACHE_TTL };
        return data;
    }

    private static async fetchCalendar(): Promise<EconomicEvent[]> {
        try {
            const resp = await axios.get(this.FOREX_FACTORY_URL, { timeout: 8000 });
            const raw = resp.data;
            if (!Array.isArray(raw) || raw.length === 0) return [];
            return raw
                .filter((e: any) => e.impact && e.title)
                .map((e: any) => ({
                    date: e.date || '',
                    time: e.time || '',
                    currency: e.country || '',
                    impact: (e.impact || 'L').charAt(0).toUpperCase() as 'H' | 'M' | 'L',
                    title: e.title || '',
                    forecast: e.forecast ?? '',
                    previous: e.previous ?? '',
                    actual: e.actual ?? '',
                }))
                .slice(0, 30);
        } catch {
            return [];
        }
    }

    private static async fetchAnalysis(symbol?: string): Promise<{ source: string; title: string; summary: string; url: string }[]> {
        const results: { source: string; title: string; summary: string; url: string }[] = [];

        const pair = symbol ? symbol.toLowerCase() : '';

        // LiteFinance Blog (analyst opinions with Elliott Wave & SMC)
        try {
            const resp = await axios.get('https://www.litefinance.org/blog/analysts-opinions/', {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = resp.data;
            const articleRegex = /<a[^>]*href="(https:\/\/www\.litefinance\.org\/blog\/analysts-opinions\/[^"]*\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
            const titleRegex = /<h[23][^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h[23]/i;
            const descRegex = /<p[^>]*class="[^"]*excerpt[^"]*"[^>]*>([\s\S]*?)<\/p>/i;

            const links: { url: string; title: string }[] = [];
            let match;
            while ((match = articleRegex.exec(html)) !== null) {
                const url = match[1];
                const inner = match[2].replace(/<[^>]*>/g, '').trim();
                if (url && inner && !links.some(l => l.url === url)) {
                    links.push({ url, title: inner });
                }
            }

            const seen = new Set<string>();
            for (const link of links) {
                if (seen.size >= 5) break;
                if (seen.has(link.url)) continue;
                if (pair && !link.title.toLowerCase().includes(pair) && !link.url.toLowerCase().includes(pair)) continue;
                seen.add(link.url);
                results.push({
                    source: 'LiteFinance',
                    title: link.title.slice(0, 120),
                    summary: '',
                    url: link.url,
                });
            }
        } catch { /* LiteFinance not available */ }

        // Investing.com Technical Analysis page (full analysis with indicators)
        if (symbol) {
            const investing = this.symbolToInvesting(symbol);
            if (investing.url) {
                try {
                    const resp = await axios.get(investing.url, {
                        timeout: 8000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    const html = resp.data;

                    // Extract meta description (usually has analysis summary)
                    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] || '';
                    const titleMatch = html.match(/<h1[^>]*class="[^"]*technicalH1[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
                    const pageTitle = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || `Análise Técnica ${investing.label}`;

                    results.push({
                        source: 'Investing.com',
                        title: pageTitle,
                        summary: metaDesc.replace(/\s+/g, ' ').slice(0, 300),
                        url: investing.url,
                    });
                } catch { /* Investing.com page not available */ }
            }
        }

        // DailyFX RSS (fallback)
        if (results.length < 3) {
            try {
                const resp = await axios.get('https://www.dailyfx.com/feed', { timeout: 6000, responseType: 'text' });
                const items = resp.data.match(/<item>[\s\S]*?<\/item>/gi) || [];
                for (const item of items) {
                    if (results.length >= 5) break;
                    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || '';
                    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
                    const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || '';
                    if (!title || !link) continue;
                    if (pair && !title.toLowerCase().includes(pair) && !desc.toLowerCase().includes(pair)) continue;
                    results.push({
                        source: 'DailyFX',
                        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
                        summary: desc.replace(/<[^>]*>/g, '').slice(0, 200).trim(),
                        url: link,
                    });
                }
            } catch { /* DailyFX not available */ }
        }

        return results;
    }

    private static async fetchInvestingTech(symbol: string): Promise<InvestingAnalysis | null> {
        const investing = this.symbolToInvesting(symbol);
        if (!investing.url) return null;

        try {
            const resp = await axios.get(investing.url, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = resp.data;

            const extractBetween = (text: string, start: string, end: string): string => {
                const idx = text.indexOf(start);
                if (idx === -1) return '';
                const from = idx + start.length;
                const to = text.indexOf(end, from);
                return to === -1 ? text.slice(from) : text.slice(from, to);
            };

            // Summary: look for the main technical summary text
            const summaryMatch = html.match(/<div[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const summaryText = summaryMatch ? summaryMatch[1].replace(/<[^>]*>/g, '').trim() : '';

            // RSI
            const rsiRow = html.match(/RSI\(14\)[\s\S]{0,200}?<td[^>]*class="[^"]*"\s*data-tname="[^"]*"[^>]*>([^<]*)<\/td>\s*<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>/i);
            const rsi = rsiRow ? { value: rsiRow[1].trim(), action: rsiRow[2].trim() } : { value: '', action: '' };

            // MACD
            const macdRow = html.match(/MACD\(12,26\)[\s\S]{0,200}?<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>\s*<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>/i);
            const macd = macdRow ? { value: macdRow[1].trim(), action: macdRow[2].trim() } : { value: '', action: '' };

            // Stochastic
            const stochRow = html.match(/STOCH\(9,6\)[\s\S]{0,200}?<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>\s*<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>/i);
            const stochastic = stochRow ? { value: stochRow[1].trim(), action: stochRow[2].trim() } : { value: '', action: '' };

            // ADX
            const adxRow = html.match(/ADX\(14\)[\s\S]{0,200}?<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>\s*<td[^>]*class="[^"]*"[^>]*>([^<]*)<\/td>/i);
            const adx = adxRow ? { value: adxRow[1].trim(), action: adxRow[2].trim() } : { value: '', action: '' };

            // Pivot Points table
            const pivotSection = extractBetween(html, 'Pivot Points', '</table>');
            const classicMatch = pivotSection.match(/Classic[\s\S]{0,500}?<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g);
            const pivotPoints = {
                classic: { s3: '', s2: '', s1: '', pivot: '', r1: '', r2: '', r3: '' },
                fibonacci: { s3: '', s2: '', s1: '', pivot: '', r1: '', r2: '', r3: '' },
            };

            // Try to parse pivot table rows
            const pivotRows = pivotSection.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            for (const row of pivotRows) {
                const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                if (!cells || cells.length < 8) continue;
                const name = cells[0].replace(/<[^>]*>/g, '').trim().toLowerCase();
                const vals = cells.slice(1).map((c: string) => c.replace(/<[^>]*>/g, '').trim());
                if (name.startsWith('classic')) {
                    pivotPoints.classic = { s3: vals[0]||'', s2: vals[1]||'', s1: vals[2]||'', pivot: vals[3]||'', r1: vals[4]||'', r2: vals[5]||'', r3: vals[6]||'' };
                } else if (name.startsWith('fibonacc')) {
                    pivotPoints.fibonacci = { s3: vals[0]||'', s2: vals[1]||'', s1: vals[2]||'', pivot: vals[3]||'', r1: vals[4]||'', r2: vals[5]||'', r3: vals[6]||'' };
                }
            }

            // Moving Averages
            const maSection = extractBetween(html, 'Moving Averages', '</table>');
            const maRows = maSection.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            const movingAverages: { period: string; value: string; signal: string }[] = [];
            for (const row of maRows) {
                const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                if (!cells || cells.length < 3) continue;
                const period = cells[0].replace(/<[^>]*>/g, '').trim();
                const sma = (cells[1] || '').replace(/<[^>]*>/g, '').trim();
                const signal = sma.replace(/[0-9.,]/g, '').trim() || '';
                if (period && /MA\d/i.test(period)) {
                    movingAverages.push({ period, value: sma.replace(/[^0-9.]/g, ''), signal });
                }
            }

            return {
                summary: summaryText,
                rsi,
                macd,
                stochastic,
                adx,
                pivotPoints,
                movingAverages,
            };
        } catch {
            return null;
        }
    }

    static formatCalendarMarkdown(events: EconomicEvent[]): string {
        if (!events.length) return 'Nenhum evento econômico encontrado para esta semana.';

        const high = events.filter(e => e.impact === 'H');
        const medium = events.filter(e => e.impact === 'M');
        const top = [...high, ...medium].slice(0, 15);

        if (!top.length) return 'Nenhum evento de alto/medio impacto encontrado.';

        let md = '### EVENTOS ECONÔMICOS (Calendário ForexFactory)\n';
        for (const e of top) {
            const impactIcon = e.impact === 'H' ? '🔴' : '🟡';
            const dateStr = e.date ? e.date.slice(5) : '';
            md += `\`${dateStr} ${e.time}\` ${impactIcon} [${e.currency}] **${e.title}** | Prev: ${e.forecast || '-'} | Ant: ${e.previous || '-'}`;
            if (e.actual) md += ` | Actual: ${e.actual}`;
            md += '\n';
        }
        return md;
    }

    static formatAnalysisMarkdown(sources: { source: string; title: string; summary: string; url: string }[]): string {
        if (!sources.length) return '';
        let md = '\n### ANÁLISES TÉCNICAS DE SITES RENOMADOS\n';
        for (const s of sources) {
            md += `- **[${s.source}]** ${s.title}\n`;
            if (s.summary) md += `  _${s.summary}_\n`;
        }
        return md;
    }

    static formatInvestingMarkdown(tech: InvestingAnalysis | null, symbol: string): string {
        if (!tech) return '';

        let md = `\n### ANÁLISE TÉCNICA INVESTING.COM - ${symbol}\n`;
        md += `**Resumo:** ${tech.summary || 'N/A'}\n\n`;

        md += '**Indicadores:**\n';
        md += `| Indicador | Valor | Sinal |\n|---|---|---|\n`;
        if (tech.rsi.value) md += `| RSI(14) | ${tech.rsi.value} | ${tech.rsi.action} |\n`;
        if (tech.macd.value) md += `| MACD(12,26) | ${tech.macd.value} | ${tech.macd.action} |\n`;
        if (tech.stochastic.value) md += `| Stoch(9,6) | ${tech.stochastic.value} | ${tech.stochastic.action} |\n`;
        if (tech.adx.value) md += `| ADX(14) | ${tech.adx.value} | ${tech.adx.action} |\n`;

        const pp = tech.pivotPoints.classic;
        if (pp.pivot) {
            md += '\n**Pivot Points (Clássico):**\n';
            md += `| S3 | S2 | S1 | Pivot | R1 | R2 | R3 |\n|---|---|---|---|---|---|---|\n`;
            md += `| ${pp.s3} | ${pp.s2} | ${pp.s1} | ${pp.pivot} | ${pp.r1} | ${pp.r2} | ${pp.r3} |\n`;
        }

        if (tech.movingAverages.length > 0) {
            md += '\n**Médias Móveis:**\n';
            for (const ma of tech.movingAverages) {
                md += `- ${ma.period}: ${ma.value} (${ma.signal || 'N/A'})\n`;
            }
        }

        return md;
    }
}
