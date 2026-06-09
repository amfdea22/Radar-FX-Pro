import requests
import json
from datetime import datetime, timezone, timedelta
from typing import Any

EVENT_CURRENCY_MAP: dict[str, list[str]] = {
    'CPI': ['USD'],
    'Non Farm Payrolls': ['USD'],
    'Unemployment Rate': ['USD'],
    'FOMC': ['USD'],
    'GDP': ['USD', 'GBP'],
    'Retail Sales': ['USD', 'GBP'],
    'ISM': ['USD'],
    'PPI': ['USD'],
    'Durable Goods': ['USD'],
    'Michigan': ['USD'],
    'JOLTS': ['USD'],
    'ADP': ['USD'],
    'Building Permits': ['USD'],
    'Existing Home Sales': ['USD'],
    'New Home Sales': ['USD'],
    'Industrial Production': ['USD', 'EUR', 'GBP'],
    'Consumer Confidence': ['USD'],
    'Philadelphia Fed': ['USD'],
    'Empire State': ['USD'],
    'Treasury': ['USD'],
    'GDP Growth Rate': ['EUR', 'GBP', 'USD'],
    'CPI YoY': ['EUR', 'GBP', 'USD'],
    'Harmonised': ['EUR'],
    'ECB': ['EUR'],
    'ZEW': ['EUR'],
    'German': ['EUR'],
    'Inflation Rate': ['EUR', 'GBP', 'USD'],
    'Services PMI': ['EUR', 'GBP', 'USD'],
    'Manufacturing PMI': ['EUR', 'GBP', 'USD'],
    'Composite PMI': ['EUR', 'GBP', 'USD'],
    'BoE': ['GBP'],
    'Claimant Count': ['GBP'],
    'Average Earnings': ['GBP'],
    'CPI y/y': ['CAD', 'AUD', 'NZD'],
    'Employment Change': ['CAD', 'AUD', 'NZD'],
    'Unemployment Rate': ['CAD', 'AUD', 'NZD'],
    'RBA': ['AUD'],
    'RBNZ': ['NZD'],
    'BOJ': ['JPY'],
    'Tankan': ['JPY'],
}

ASSET_CURRENCY_MAP: dict[str, str] = {
    'XAUUSD': 'USD', 'XAGUSD': 'USD',
    'EURUSD': 'EUR', 'GBPUSD': 'GBP', 'USDJPY': 'JPY',
    'USDCAD': 'CAD', 'AUDUSD': 'AUD', 'NZDUSD': 'NZD',
    'US30': 'USD', 'SP500': 'USD', 'NAS100': 'USD',
    'BTCUSD': 'USD', 'ETHUSD': 'USD',
}

IMPACT_WEIGHTS = {'ALTA': 3, 'MEDIA': 2, 'BAIXA': 1}

def _get_currency(symbol: str) -> str:
    return ASSET_CURRENCY_MAP.get(symbol.upper(), 'USD')

def _fetch_economic_calendar() -> list[dict]:
    try:
        resp = requests.get(
            'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
            timeout=8
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return []


class NewsMacroAgent:
    name = 'news_macro'
    display_name = 'News & Macro Agent'
    weight = 0.30

    def __init__(self) -> None:
        self.cache: list[dict] = []
        self.cache_time: float = 0.0
        self.cache_ttl = 120.0

    def _get_calendar(self) -> list[dict]:
        now = datetime.now().timestamp()
        if not self.cache or (now - self.cache_time) > self.cache_ttl:
            self.cache = _fetch_economic_calendar()
            self.cache_time = now
        return self.cache

    def analyze(self, symbol: str) -> dict[str, Any]:
        currency = _get_currency(symbol)
        events = self._get_calendar()
        now = datetime.now(timezone.utc)
        now_ts = now.timestamp()

        relevant_events: list[dict] = []
        total_impact_score = 0
        pre_news_phase = False
        post_news_phase = False
        nearest_event: dict | None = None
        nearest_dist = float('inf')

        for ev in events:
            try:
                ev_time_str = ev.get('time', '')
                ev_date_str = ev.get('date', '')
                if not ev_date_str:
                    continue

                ev_impact = (ev.get('impact') or '').strip().upper()
                ev_currency = (ev.get('currency') or '').strip().upper()
                ev_title = (ev.get('title') or '').strip()

                if ev_currency != currency:
                    continue

                try:
                    ev_dt = datetime.strptime(f'{ev_date_str} {ev_time_str}', '%Y-%m-%d %H:%M')
                    ev_dt = ev_dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    try:
                        ev_dt = datetime.strptime(ev_date_str, '%Y-%m-%d')
                        ev_dt = ev_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        continue

                ev_ts = ev_dt.timestamp()
                diff_minutes = (ev_ts - now_ts) / 60
                impact_w = IMPACT_WEIGHTS.get(ev_impact, 1)

                if -5 <= diff_minutes <= 5:
                    post_news_phase = True
                elif 0 < diff_minutes <= 30:
                    pre_news_phase = True

                is_high_impact = ev_impact in ('ALTA', 'MEDIA')
                relevance = 0
                if abs(diff_minutes) < 120 and is_high_impact:
                    relevance = impact_w * max(0, 1 - abs(diff_minutes) / 120)
                    total_impact_score += relevance

                if is_high_impact and abs(diff_minutes) < 240:
                    actual = ev.get('actual', '')
                    consensus = ev.get('forecast', '')
                    previous = ev.get('previous', '')
                    event_data = {
                        'event': ev_title,
                        'date': ev_date_str,
                        'time': ev_time_str,
                        'impact': ev_impact,
                        'currency': ev_currency,
                        'forecast': consensus,
                        'previous': previous,
                        'actual': actual,
                        'diff_minutes': round(diff_minutes, 1),
                        'relevance': round(relevance, 2),
                    }
                    relevant_events.append(event_data)

                    if abs(diff_minutes) < abs(nearest_dist):
                        nearest_dist = diff_minutes
                        nearest_event = event_data

                if abs(diff_minutes) < abs(nearest_dist):
                    nearest_dist = diff_minutes
            except Exception:
                continue

        relevant_events.sort(key=lambda x: abs(x['diff_minutes']))
        relevant_events = relevant_events[:8]

        deviation_score = 0
        deviation_detail: str | None = None
        for ev in relevant_events[:3]:
            actual = ev.get('actual', '')
            forecast = ev.get('forecast', '')
            if actual and forecast:
                try:
                    a = float(actual.replace('%', '').replace('M', '').replace('B', '').strip())
                    f = float(forecast.replace('%', '').replace('M', '').replace('B', '').strip())
                    dev = a - f
                    if ev['impact'] == 'ALTA':
                        deviation_score += dev * 2
                    else:
                        deviation_score += dev
                    if deviation_score != 0:
                        deviation_detail = f'Desvio total: {deviation_score:+.2f} (soma dos desvios ponderados)'
                except (ValueError, AttributeError):
                    pass

        news_sentiment = 0
        news_label = 'NEUTRO'
        if deviation_score > 0.3:
            news_sentiment = min(1.0, deviation_score * 0.5)
            news_label = 'POSITIVO para USD' if currency == 'USD' else f'POSITIVO para {currency}'
        elif deviation_score < -0.3:
            news_sentiment = max(-1.0, deviation_score * 0.5)
            news_label = 'NEGATIVO para USD' if currency == 'USD' else f'NEGATIVO para {currency}'

        macro_impact_score = min(100, total_impact_score * 20)

        if pre_news_phase or post_news_phase:
            volatility_alert = True
            if pre_news_phase:
                volatility_detail = f'Noticia de alto impacto em {abs(nearest_dist):.0f} min — ativar modo protecao'
            else:
                volatility_detail = 'Noticia foi liberada nos ultimos 5 min — aguardar estabilizacao do spread'
        else:
            volatility_alert = False
            volatility_detail = 'Nenhum evento de alto impacto iminente. Mercado livre para operar.'
            if nearest_event:
                if nearest_dist < 60:
                    volatility_detail = f'Evento em {nearest_dist:.0f} min — atencao a volatilidade'
                else:
                    volatility_detail = f'Proximo evento relevante em {nearest_dist:.0f} min'

        return {
            'agent': self.name,
            'weight': self.weight,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'symbol': symbol,
            'currency': currency,
            'volatility_alert': volatility_alert,
            'volatility_detail': volatility_detail,
            'pre_news': pre_news_phase,
            'post_news': post_news_phase,
            'total_impact_score': round(total_impact_score, 2),
            'macro_impact_score': macro_impact_score,
            'news_sentiment': round(news_sentiment, 2),
            'news_label': news_label,
            'deviation_detail': deviation_detail,
            'relevant_events': relevant_events,
            'inference': self._generate_inference(symbol, currency, macro_impact_score, news_sentiment, pre_news_phase, post_news_phase, volatility_alert),
        }

    def _generate_inference(
        self, symbol: str, currency: str,
        macro_score: float, sentiment: float,
        pre: bool, post: bool, vol_alert: bool
    ) -> dict[str, Any]:
        bias_result = 'NEUTRO'
        confidence = 50
        reasoning: list[str] = []

        if vol_alert:
            if pre:
                bias_result = 'CAUTELA'
                confidence = 65
                reasoning.append(
                    f'Evento economico iminente. Sugerido: reduzir exposicao, apertar stops, '
                    f'evitar novas entradas ate 5 min apos a divulgacao.'
                )
            elif post:
                bias_result = 'AGUARDAR'
                confidence = 60
                reasoning.append(
                    f'Noticia recém divulgada. Aguardar 5 min para spread normalizar, '
                    f'identificar Fair Value Gaps e reacao inicial.'
                )
            return {'bias': bias_result, 'confidence': confidence, 'action': 'HOLD', 'reasoning': reasoning}

        if sentiment > 0.3:
            if currency == 'USD':
                bias_result = 'USD_ALTA'
                reasoning.append(f'Dados macro acima do consenso: {currency} tende a se fortalecer.')
                if symbol in ('XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'):
                    bias_result = 'ATIVO_QUEDA'
                    confidence = min(80, 50 + abs(sentiment) * 40)
                    reasoning.append(f'Correlacao inversa: {symbol} tende a cair com DXY forte.')
                elif symbol in ('USDJPY', 'USDCAD'):
                    bias_result = 'ATIVO_ALTA'
                    confidence = min(80, 50 + abs(sentiment) * 40)
                    reasoning.append(f'Correlacao direta: {symbol} tende a subir com DXY forte.')
            else:
                bias_result = 'ATIVO_ALTA'
                confidence = min(75, 50 + abs(sentiment) * 40)
                reasoning.append(f'Dados economicos fortes para {currency}: {symbol} favorecido.')
        elif sentiment < -0.3:
            if currency == 'USD':
                bias_result = 'USD_QUEDA'
                reasoning.append(f'Dados macro abaixo do consenso: {currency} tende a enfraquecer.')
                if symbol in ('XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'):
                    bias_result = 'ATIVO_ALTA'
                    confidence = min(80, 50 + abs(sentiment) * 40)
                    reasoning.append(f'Correlacao inversa: {symbol} tende a subir com DXY fraco.')
                elif symbol in ('USDJPY', 'USDCAD'):
                    bias_result = 'ATIVO_QUEDA'
                    confidence = min(80, 50 + abs(sentiment) * 40)
                    reasoning.append(f'Correlacao direta: {symbol} tende a cair com DXY fraco.')
            else:
                bias_result = 'ATIVO_QUEDA'
                confidence = min(75, 50 + abs(sentiment) * 40)
                reasoning.append(f'Dados economicos fracos para {currency}: {symbol} pressionado.')
        else:
            bias_result = 'NEUTRO'
            confidence = 50
            reasoning.append('Sem desvio significativo no calendario economico. Noticias neutras para o ativo.')

        return {
            'bias': bias_result,
            'confidence': round(confidence),
            'action': 'HOLD' if vol_alert else 'ANALYZE',
            'reasoning': reasoning,
        }

    def analyze_multi(self, symbols: list[str]) -> dict[str, Any]:
        results = {}
        for sym in symbols:
            try:
                results[sym] = self.analyze(sym)
            except Exception as e:
                results[sym] = {'error': str(e)}
        return {
            'agent': self.name,
            'results': results,
        }
