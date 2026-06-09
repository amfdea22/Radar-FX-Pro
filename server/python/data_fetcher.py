import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Literal
from instruments import TIMEFRAME_MAP

MT5_BRIDGE_URL = 'http://127.0.0.1:5555'
POLYGON_API_KEY = 'YOUR_POLYGON_KEY'


def fetch_from_mt5(symbol: str, timeframe: str, bars: int = 500) -> Optional[pd.DataFrame]:
    try:
        mt5_symbol = symbol
        tf_map = {'1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30', '1h': 'H1', '4h': 'H4', '1d': 'D1', '1w': 'W1'}
        tf = tf_map.get(timeframe, 'H1')
        resp = requests.get(f'{MT5_BRIDGE_URL}/candles', params={
            'symbol': mt5_symbol, 'timeframe': tf, 'count': bars
        }, timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data or not isinstance(data, list):
            return None
        rows = []
        for c in data:
            ts = c.get('time', c.get('timestamp', 0))
            if isinstance(ts, str):
                ts = int(datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp())
            rows.append({
                'time': datetime.fromtimestamp(ts),
                'open': float(c.get('open', 0)),
                'high': float(c.get('high', 0)),
                'low': float(c.get('low', 0)),
                'close': float(c.get('close', 0)),
                'volume': float(c.get('volume', 0)),
                'tick_volume': float(c.get('tick_volume', 0)),
                'spread': float(c.get('spread', 0)),
            })
        df = pd.DataFrame(rows)
        if 'time' in df.columns:
            df = df.set_index('time')
        df = df.sort_index()
        return df
    except Exception:
        return None


def fetch_from_polygon(symbol: str, timeframe: str, bars: int = 500) -> Optional[pd.DataFrame]:
    try:
        api_key = POLYGON_API_KEY
        if not api_key or api_key == 'YOUR_POLYGON_KEY':
            return None
        multiplier = TIMEFRAME_MAP.get(timeframe, 60)
        timespan = 'minute' if multiplier < 1440 else ('hour' if multiplier < 1440 else 'day')
        if multiplier >= 1440:
            timespan = 'day'
            multiplier = multiplier // 1440
        elif multiplier >= 60:
            timespan = 'hour'
            multiplier = multiplier // 60
        else:
            timespan = 'minute'
        end = datetime.now()
        start = end - timedelta(days=bars * multiplier * 2)
        crypto_tokens = ['BTC', 'ETH', 'BNB', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'LTC', 'BCH', 'XLM', 'TRX', 'SHIB', 'ETC']
        is_crypto = any(symbol.upper().startswith(t) for t in crypto_tokens)
        if is_crypto:
            poly_symbol = f'X:{symbol}'
        elif symbol.startswith('X'):
            poly_symbol = f'C:{symbol}'
        else:
            poly_symbol = symbol
        url = (f'https://api.polygon.io/v2/aggs/ticker/{poly_symbol}/range/'
               f'{multiplier}/{timespan}/{start.date()}/{end.date()}?adjusted=true&sort=asc&limit={bars}&apiKey={api_key}')
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        results = data.get('results', [])
        if not results:
            return None
        rows = []
        for r in results:
            rows.append({
                'time': datetime.fromtimestamp(r['t'] / 1000),
                'open': float(r['o']),
                'high': float(r['h']),
                'low': float(r['l']),
                'close': float(r['c']),
                'volume': float(r.get('v', 0)),
            })
        df = pd.DataFrame(rows)
        if 'time' in df.columns:
            df = df.set_index('time')
        df = df.sort_index()
        return df
    except Exception:
        return None


def fetch_from_litefinance(symbol: str, timeframe: str, bars: int = 500) -> Optional[pd.DataFrame]:
    try:
        tf_map = {'1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W'}
        tf = tf_map.get(timeframe, '60')

        lf_symbols = {
            'XAUUSD': 'XAUUSD', 'XAGUSD': 'XAGUSD',
            'NAS100': 'NAS100', 'US30': 'US30', 'US500': 'US500',
            'GER40': 'GER40', 'UK100': 'UK100', 'FRA40': 'FRA40',
            'JPN225': 'JPN225', 'HK50': 'HK50',
            'OIL': 'WTI', 'BRENT': 'BRENT', 'GAS': 'NGAS',
            'BTCUSD': 'BTCUSD', 'ETHUSD': 'ETHUSD',
        }
        lf_sym = lf_symbols.get(symbol, symbol)

        url = f'https://my.litefinance.org/pt/chart/get-history?symbol={lf_sym}&resolution={tf}&from={int((datetime.now()-timedelta(days=bars*2)).timestamp())}&to={int(datetime.now().timestamp())}'
        resp = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            return None
        raw = resp.json()
        # Handle both the old format (direct arrays) and new format (nested in data)
        payload = raw if raw.get('t') else (raw.get('data') if raw.get('data') and raw['data'].get('t') else None)
        if not payload:
            return None
        rows = []
        for i in range(len(payload['t'])):
            rows.append({
                'time': datetime.fromtimestamp(payload['t'][i]),
                'open': float(payload['o'][i]),
                'high': float(payload['h'][i]),
                'low': float(payload['l'][i]),
                'close': float(payload['c'][i]),
                'volume': float(payload.get('v', [0])[i] if payload.get('v') else 0),
            })
        df = pd.DataFrame(rows)
        if 'time' in df.columns:
            df = df.set_index('time')
        df = df.sort_index()
        return df
    except Exception:
        return None


def fetch_historical_data(symbol: str, timeframe: str = '1h', bars: int = 500,
                          source: Literal['auto', 'mt5', 'polygon', 'litefinance'] = 'auto',
                          allow_synthetic: bool = False,
                          date_from: str = None, date_to: str = None) -> dict:
    result = {'symbol': symbol, 'timeframe': timeframe, 'source_actual': None, 'dataframe': None, 'is_synthetic': False}
    if source == 'auto':
        sources = [fetch_from_mt5, fetch_from_polygon, fetch_from_litefinance]
    elif source == 'mt5':
        sources = [fetch_from_mt5]
    elif source == 'polygon':
        sources = [fetch_from_polygon]
    elif source == 'litefinance':
        sources = [fetch_from_litefinance]
    else:
        sources = []

    # Adjust bar count if date range is far in the past — real sources don't cover it
    if date_from:
        try:
            target_start = pd.Timestamp(date_from)
            now = pd.Timestamp.now()
            days_ago = (now - target_start).days
            if days_ago > 60:
                sources = [s for s in sources if s != fetch_from_mt5]
        except Exception:
            pass

    source_names = {'fetch_from_mt5': 'mt5', 'fetch_from_polygon': 'polygon', 'fetch_from_litefinance': 'litefinance'}
    errors = []
    for fetcher in sources:
        df = fetcher(symbol, timeframe, bars)
        if df is not None and len(df) >= 10:
            result['dataframe'] = df
            result['source_actual'] = source_names.get(fetcher.__name__, source)
            return result
        errors.append(fetcher.__name__)

    if not allow_synthetic:
        raise ValueError(
            f'Todas as fontes falharam ({", ".join(errors)}). '
            f'Não foram encontrados dados para {symbol} {timeframe}. '
            f'Ative "allow_synthetic" para gerar dados sintéticos de teste.'
        )

    df = _generate_synthetic(symbol, timeframe, bars, date_from=date_from, date_to=date_to)
    result['dataframe'] = df
    result['source_actual'] = 'synthetic'
    result['is_synthetic'] = True
    return result


def _generate_synthetic(symbol: str, timeframe: str, bars: int, seed: int = None,
                        date_from: str = None, date_to: str = None) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)
    now = datetime.now()
    freq_min = TIMEFRAME_MAP.get(timeframe, 60)
    base_price = {
        'XAUUSD': 2350.0, 'XAGUSD': 28.0, 'EURUSD': 1.08, 'GBPUSD': 1.27,
        'USDJPY': 150.0, 'BTCUSD': 65000.0, 'ETHUSD': 3500.0,
        'NAS100': 18500.0, 'US30': 39000.0, 'US500': 5200.0,
        'OIL': 78.0, 'BRENT': 82.0,
    }.get(symbol.upper(), 100.0)

    if date_from:
        start = pd.Timestamp(date_from)
        if date_to:
            end = pd.Timestamp(date_to)
        else:
            end = start + pd.Timedelta(days=bars * freq_min // 1440 + 1)
        dates = pd.date_range(start=start, end=end, freq=f'{freq_min}min')
        if len(dates) < 10:
            dates = pd.date_range(start=start, periods=max(bars, 100), freq=f'{freq_min}min')
        bars = len(dates)
    else:
        dates = pd.date_range(end=now, periods=bars, freq=f'{freq_min}min')

    prices = [base_price]
    for _ in range(1, bars):
        ret = np.random.normal(0, base_price * 0.001)
        prices.append(max(prices[-1] + ret, base_price * 0.5))

    df = pd.DataFrame({
        'time': dates,
        'open': prices,
        'high': [p * (1 + abs(np.random.normal(0, 0.002))) for p in prices],
        'low': [p * (1 - abs(np.random.normal(0, 0.002))) for p in prices],
        'close': [p * (1 + np.random.normal(0, 0.001)) for p in prices],
        'volume': np.random.randint(100, 10000, bars),
    })
    df['high'] = df[['open', 'close', 'high']].max(axis=1)
    df['low'] = df[['open', 'close', 'low']].min(axis=1)
    df = df.set_index('time')
    return df
