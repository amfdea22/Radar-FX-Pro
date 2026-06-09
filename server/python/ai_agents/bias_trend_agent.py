import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Any

YFINANCE_MAP: dict[str, str] = {
    'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X',
    'USDCAD': 'USDCAD=X', 'AUDUSD': 'AUDUSD=X', 'NZDUSD': 'NZDUSD=X',
    'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F',
    'US30': 'YM=F', 'SP500': 'ES=F', 'NAS100': 'NQ=F',
    'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD',
}

TIMEFRAMES = {
    'H4': {'period': '30d', 'interval': '60m', 'label': '4 horas', 'swing_window': 5},
    'H1': {'period': '10d', 'interval': '60m', 'label': '1 hora', 'swing_window': 3},
    'D1': {'period': '6mo', 'interval': '1d', 'label': 'Diario', 'swing_window': 3},
}


def _get_ticker(symbol: str) -> str:
    return YFINANCE_MAP.get(symbol.upper(), symbol.upper())


def _fetch_data(ticker: str, period: str, interval: str) -> pd.DataFrame:
    try:
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        if df.empty:
            return pd.DataFrame()
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df
    except Exception:
        return pd.DataFrame()


def _swing_points(high: pd.Series, low: pd.Series, window: int = 3) -> tuple[list[int], list[int]]:
    highs = high.values
    lows = low.values
    n = len(highs)
    swing_highs: list[int] = []
    swing_lows: list[int] = []
    for i in range(window, n - window):
        if all(highs[i] > highs[i - j] and highs[i] > highs[i + j] for j in range(1, window + 1)):
            swing_highs.append(i)
        if all(lows[i] < lows[i - j] and lows[i] < lows[i + j] for j in range(1, window + 1)):
            swing_lows.append(i)
    return swing_highs, swing_lows


def _detect_fvg(df: pd.DataFrame) -> list[dict[str, Any]]:
    fvg_list: list[dict[str, Any]] = []
    highs = df['High'].values
    lows = df['Low'].values
    for i in range(1, len(df) - 1):
        prev_low = lows[i - 1]
        prev_high = highs[i - 1]
        curr_high = highs[i]
        curr_low = lows[i]
        next_low = lows[i + 1]
        next_high = highs[i + 1]
        bullish_gap = next_low - curr_high
        bearish_gap = curr_low - next_high
        if bullish_gap > 0:
            fvg_list.append({
                'index': i,
                'type': 'BULLISH_FVG',
                'gap_high': float(curr_high),
                'gap_low': float(next_low),
                'size': float(bullish_gap),
                'timestamp': str(df.index[i]),
            })
        if bearish_gap > 0:
            fvg_list.append({
                'index': i,
                'type': 'BEARISH_FVG',
                'gap_low': float(curr_low),
                'gap_high': float(next_high),
                'size': float(bearish_gap),
                'timestamp': str(df.index[i]),
            })
    return fvg_list[-10:] if len(fvg_list) > 10 else fvg_list


def _detect_order_blocks(df: pd.DataFrame, swing_highs: list[int], swing_lows: list[int]) -> list[dict[str, Any]]:
    obs: list[dict[str, Any]] = []
    for idx in swing_highs[-5:]:
        if idx > 0:
            obs.append({
                'type': 'BEARISH_OB',
                'index': idx,
                'high': float(df['High'].iloc[idx]),
                'low': float(df['Low'].iloc[idx]),
                'timestamp': str(df.index[idx]),
            })
    for idx in swing_lows[-5:]:
        if idx > 0:
            obs.append({
                'type': 'BULLISH_OB',
                'index': idx,
                'high': float(df['High'].iloc[idx]),
                'low': float(df['Low'].iloc[idx]),
                'timestamp': str(df.index[idx]),
            })
    return obs


class BiasTrendAgent:
    name = 'bias_trend'
    display_name = 'Bias & Trend Agent'
    weight = 0.35

    def analyze(self, symbol: str) -> dict[str, Any]:
        ticker = _get_ticker(symbol)
        tf_results: dict[str, Any] = {}

        for tf_key, tf_cfg in TIMEFRAMES.items():
            df = _fetch_data(ticker, tf_cfg['period'], tf_cfg['interval'])
            if df.empty or len(df) < 10:
                tf_results[tf_key] = {'error': 'Dados insuficientes'}
                continue

            closes = df['Close'].values
            highs = df['High'].values if 'High' in df.columns else closes
            lows = df['Low'].values if 'Low' in df.columns else closes

            swh, swl = _swing_points(
                pd.Series(highs), pd.Series(lows), tf_cfg['swing_window']
            )

            structure = 'RANGING'
            last_high = max(highs[-10:]) if len(highs) >= 10 else highs[-1]
            last_low = min(lows[-10:]) if len(lows) >= 10 else lows[-1]
            prev_high = max(highs[-20:-10]) if len(highs) >= 20 else last_high
            prev_low = min(lows[-20:-10]) if len(lows) >= 20 else last_low

            if last_high > prev_high and last_low > prev_low:
                structure = 'BULLISH'
            elif last_low < prev_low and last_high < prev_high:
                structure = 'BEARISH'

            bos_detected = False
            choch_detected = False
            if len(swh) >= 2 and highs[swh[-1]] > highs[swh[-2]]:
                bos_detected = True
            if len(swl) >= 2 and lows[swl[-1]] < lows[swl[-2]]:
                bos_detected = True
            if len(swh) >= 2 and highs[swh[-1]] < highs[swh[-2]] and lows[swl[-1]] < lows[swl[-2]]:
                choch_detected = True
            if len(swl) >= 2 and lows[swl[-1]] > lows[swl[-2]] and highs[swh[-1]] > highs[swh[-2]]:
                choch_detected = True

            sma20 = np.mean(closes[-20:]) if len(closes) >= 20 else closes[-1]
            sma50 = np.mean(closes[-50:]) if len(closes) >= 50 else closes[-1]
            sma200 = np.mean(closes[-200:]) if len(closes) >= 200 else closes[-1]

            trend_strength = 0
            if structure == 'BULLISH':
                if sma20 > sma50:
                    trend_strength = min(100, ((sma20 / sma50) - 1) * 500 + 50)
                if sma50 > sma200:
                    trend_strength = min(100, trend_strength + 15)
            elif structure == 'BEARISH':
                if sma20 < sma50:
                    trend_strength = min(100, ((sma50 / sma20) - 1) * 500 + 50)
                if sma50 < sma200:
                    trend_strength = min(100, trend_strength + 15)
            else:
                trend_strength = 20

            fvg_list = _detect_fvg(df)
            ob_list = _detect_order_blocks(df, swh, swl)

            recent_fvg = [f for f in fvg_list if f['index'] > len(df) - 20]
            recent_ob = [o for o in ob_list if o['index'] > len(df) - 20]

            nearest_fvg = None
            current_price = float(closes[-1])
            for fvg in recent_fvg:
                if fvg['type'] == 'BULLISH_FVG' and current_price > fvg['gap_low']:
                    dist = abs(current_price - fvg['gap_low'])
                    if nearest_fvg is None or dist < nearest_fvg.get('_dist', float('inf')):
                        nearest_fvg = {**fvg, 'distance_from_price': round(float(dist), 5)}
                        nearest_fvg['_dist'] = float(dist)
                elif fvg['type'] == 'BEARISH_FVG' and current_price < fvg['gap_high']:
                    dist = abs(current_price - fvg['gap_high'])
                    if nearest_fvg is None or dist < nearest_fvg.get('_dist', float('inf')):
                        nearest_fvg = {**fvg, 'distance_from_price': round(float(dist), 5)}
                        nearest_fvg['_dist'] = float(dist)
            for k in ['_dist', 'index']:
                if nearest_fvg and k in nearest_fvg:
                    del nearest_fvg[k]

            tf_results[tf_key] = {
                'structure': structure,
                'trend_strength': round(trend_strength, 1),
                'bos_detected': bos_detected,
                'choch_detected': choch_detected,
                'swing_highs': len(swh),
                'swing_lows': len(swl),
                'active_fvg': len(recent_fvg),
                'active_order_blocks': len(recent_ob),
                'nearest_fvg': nearest_fvg,
                'current_price': round(float(closes[-1]), 5),
                'sma20': round(float(sma20), 5),
                'sma50': round(float(sma50), 5),
                'sma200': round(float(sma200), 5),
            }

        overall_bias, overall_confidence = self._aggregate_bias(tf_results)

        return {
            'agent': self.name,
            'weight': self.weight,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'symbol': symbol,
            'bias': overall_bias,
            'confidence': overall_confidence,
            'timeframes': tf_results,
            'inference': self._generate_inference(overall_bias, overall_confidence, tf_results),
        }

    def _aggregate_bias(self, tf_results: dict[str, Any]) -> tuple[str, int]:
        votes: dict[str, float] = {'BULLISH': 0, 'BEARISH': 0, 'RANGING': 0}
        for tf_key, data in tf_results.items():
            if 'error' in data:
                continue
            w = {'H4': 0.45, 'H1': 0.30, 'D1': 0.25}.get(tf_key, 0.33)
            s = data.get('structure', 'RANGING')
            strength = data.get('trend_strength', 0)
            if s == 'BULLISH':
                votes['BULLISH'] += w * (strength / 100)
            elif s == 'BEARISH':
                votes['BEARISH'] += w * (strength / 100)
            else:
                votes['RANGING'] += w * 0.5

        total = sum(votes.values()) or 1
        bias = max(votes, key=votes.get)
        confidence = int((votes[bias] / total) * 100)
        confidence = max(30, min(95, confidence))
        return bias, confidence

    def _generate_inference(self, bias: str, confidence: int, tf_results: dict) -> dict[str, Any]:
        h4 = tf_results.get('H4', {})
        h1 = tf_results.get('H1', {})
        d1 = tf_results.get('D1', {})
        reasoning: list[str] = []
        key_levels: list[dict[str, Any]] = []

        if 'error' not in h4:
            reasoning.append(f'H4: Estrutura {h4["structure"]}, forca {h4["trend_strength"]}/100')
            if h4.get('nearest_fvg'):
                fvg = h4['nearest_fvg']
                reasoning.append(f'FVG {fvg["type"]} a {fvg.get("distance_from_price", "?")} do preco')
            if h4.get('bos_detected'):
                reasoning.append('BOS (Break of Structure) detectado no H4')
        if 'error' not in d1:
            reasoning.append(f'D1: Estrutura {d1["structure"]}, forca {d1["trend_strength"]}/100')
            if d1.get('active_order_blocks', 0) > 0:
                reasoning.append(f'{d1["active_order_blocks"]} Order Blocks ativos no Diario')

        direction = bias
        action = 'BUY' if bias == 'BULLISH' else 'SELL' if bias == 'BEARISH' else 'HOLD'
        if confidence >= 70:
            action = 'STRONG_BUY' if bias == 'BULLISH' else 'STRONG_SELL' if bias == 'BEARISH' else 'HOLD'

        return {
            'direction': direction,
            'confidence': confidence,
            'action': action,
            'reasoning': reasoning,
            'key_levels': key_levels,
        }

    def analyze_multi(self, symbols: list[str]) -> dict[str, Any]:
        results = {}
        for sym in symbols:
            try:
                results[sym] = self.analyze(sym)
            except Exception as e:
                results[sym] = {'error': str(e)}
        return {'agent': self.name, 'results': results}
