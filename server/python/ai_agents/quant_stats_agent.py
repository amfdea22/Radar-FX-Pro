import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Any

YFINANCE_MAP: dict[str, str] = {
    'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X',
    'USDCAD': 'USDCAD=X', 'AUDUSD': 'AUDUSD=X', 'NZDUSD': 'NZDUSD=X',
    'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F',
    'US30': 'YM=F', 'SP500': 'ES=F', 'NAS100': 'NQ=F',
    'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD',
    'UK100': 'FTSE', 'GER40': '^GDAXI',
}


def _get_ticker(symbol: str) -> str:
    return YFINANCE_MAP.get(symbol.upper(), symbol.upper())


TIMEFRAME_CONFIG: dict[str, dict[str, Any]] = {
    'M5':  {'period': '2d', 'interval': '5m',  'label': '5 minutos',  'weight': 0.25},
    'M15': {'period': '5d', 'interval': '15m', 'label': '15 minutos', 'weight': 0.30},
    'H1':  {'period': '1mo', 'interval': '60m', 'label': '1 hora',     'weight': 0.25},
    'D1':  {'period': '3mo', 'interval': '1d',  'label': 'Diario',    'weight': 0.20},
}


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


def _calc_indicators(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    if df.empty or 'Close' not in df.columns:
        return df
    close = df['Close']
    high = df['High'] if 'High' in df.columns else close
    low = df['Low'] if 'Low' in df.columns else close
    volume = df['Volume'] if 'Volume' in df.columns else pd.Series(0, index=df.index)

    df['SMA'] = close.rolling(window=window).mean()
    df['STD'] = close.rolling(window=window).std()
    df['Z_Score'] = (close - df['SMA']) / df['STD'].replace(0, np.nan)
    df['Upper_BB'] = df['SMA'] + 2 * df['STD']
    df['Lower_BB'] = df['SMA'] - 2 * df['STD']
    df['BB_Width'] = (df['Upper_BB'] - df['Lower_BB']) / df['SMA'] * 100

    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df['RSI'] = 100 - (100 / (1 + rs))

    df['ATR'] = (high - low).rolling(window=14).mean()
    df['ATR_Pct'] = df['ATR'] / close * 100

    df['Volume_MA'] = volume.rolling(window=20).mean()
    df['Volume_Ratio'] = volume / df['Volume_MA'].replace(0, np.nan)

    df['Momentum'] = close.pct_change(periods=5) * 100
    df['Rate_of_Change'] = close.pct_change(periods=10) * 100

    return df


class QuantStatsAgent:
    name = 'quant_stats'
    display_name = 'Quant Stats Agent'
    weight = 0.20

    def _analyze_timeframe(self, symbol: str, tf_config: dict[str, Any]) -> dict[str, Any]:
        ticker = _get_ticker(symbol)
        df = _fetch_data(ticker, tf_config['period'], tf_config['interval'])
        if df.empty:
            return {'error': f'Sem dados para {symbol} em {tf_config["label"]}', 'tf': tf_config['label']}

        df = _calc_indicators(df)
        if df.empty or len(df) < 20:
            return {'error': f'Dados insuficientes para {tf_config["label"]}', 'tf': tf_config['label']}

        last = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else last

        z = float(last['Z_Score']) if pd.notna(last.get('Z_Score')) else 0.0
        rsi = float(last['RSI']) if pd.notna(last.get('RSI')) else 50.0
        bbw = float(last['BB_Width']) if pd.notna(last.get('BB_Width')) else 0.0
        atr_pct = float(last['ATR_Pct']) if pd.notna(last.get('ATR_Pct')) else 0.0
        vol_ratio = float(last['Volume_Ratio']) if pd.notna(last.get('Volume_Ratio')) else 1.0
        mom = float(last['Momentum']) if pd.notna(last.get('Momentum')) else 0.0
        roc = float(last['Rate_of_Change']) if pd.notna(last.get('Rate_of_Change')) else 0.0

        close_v = float(last['Close'].item()) if hasattr(last['Close'], 'item') else float(last['Close'])
        sma_v = float(last['SMA'].item()) if hasattr(last['SMA'], 'item') else float(last['SMA']) if pd.notna(last.get('SMA')) else close_v
        upper_v = float(last['Upper_BB'].item()) if hasattr(last['Upper_BB'], 'item') else float(last['Upper_BB']) if pd.notna(last.get('Upper_BB')) else close_v
        lower_v = float(last['Lower_BB'].item()) if hasattr(last['Lower_BB'], 'item') else float(last['Lower_BB']) if pd.notna(last.get('Lower_BB')) else close_v

        status = 'NEUTRO'
        strength = 0
        z_score_signal = 0
        rsi_signal = 0

        if z >= 2.0:
            status = 'SOBRECOMPRADO'
            strength = min(100, z * 20)
            z_score_signal = -1
        elif z <= -2.0:
            status = 'SOBREVENDIDO'
            strength = min(100, abs(z) * 20)
            z_score_signal = 1
        elif z > 1.0:
            status = 'ESTICADO_ALTA'
            strength = min(70, z * 20)
            z_score_signal = -0.5
        elif z < -1.0:
            status = 'ESTICADO_BAIXA'
            strength = min(70, abs(z) * 20)
            z_score_signal = 0.5
        else:
            strength = 10
            z_score_signal = 0

        if rsi >= 70:
            rsi_signal = -1
        elif rsi <= 30:
            rsi_signal = 1
        elif rsi > 60:
            rsi_signal = -0.3
        elif rsi < 40:
            rsi_signal = 0.3

        composite_signal = (z_score_signal * 0.5 + rsi_signal * 0.5)
        reversal_prob = 0.0
        continuation_prob = 0.0

        if abs(composite_signal) > 0.4:
            reversal_prob = min(95, abs(composite_signal) * 60 + strength * 0.3 + (100 - rsi) * 0.1 if rsi > 50 else rsi * 0.1)
            continuation_prob = 100 - reversal_prob
        else:
            continuation_prob = 55 + abs(mom) * 2
            continuation_prob = min(90, continuation_prob)
            reversal_prob = 100 - continuation_prob

        bb_position = (close_v - lower_v) / (upper_v - lower_v) * 100 if (upper_v - lower_v) > 0 else 50

        return {
            'tf': tf_config['label'],
            'tf_weight': tf_config['weight'],
            'current_price': round(close_v, 5),
            'sma': round(sma_v, 5),
            'z_score': round(z, 2),
            'rsi': round(rsi, 1),
            'status': status,
            'strength': round(strength, 1),
            'bb_position_pct': round(bb_position, 1),
            'bb_width_pct': round(bbw, 2),
            'atr_pct': round(atr_pct, 2),
            'volume_ratio': round(vol_ratio, 2),
            'momentum_pct': round(mom, 2),
            'roc_pct': round(roc, 2),
            'composite_signal': round(composite_signal, 3),
            'reversal_probability': round(reversal_prob, 1),
            'continuation_probability': round(continuation_prob, 1),
            'deviation_from_mean': round(((close_v - sma_v) / sma_v) * 100, 3),
        }

    def analyze(self, symbol: str) -> dict[str, Any]:
        tf_results: list[dict[str, Any]] = []
        bias_votes_bullish = 0.0
        bias_votes_bearish = 0.0
        max_reversal_tf: str | None = None
        max_reversal_prob = 0.0
        max_continuation_tf: str | None = None
        max_continuation_prob = 0.0

        for tf_key, tf_config in TIMEFRAME_CONFIG.items():
            result = self._analyze_timeframe(symbol, tf_config)
            if 'error' not in result:
                tf_results.append(result)
                w = tf_config['weight']
                if result['composite_signal'] > 0.2:
                    bias_votes_bullish += w * result['composite_signal']
                elif result['composite_signal'] < -0.2:
                    bias_votes_bearish += w * abs(result['composite_signal'])
                if result['reversal_probability'] > max_reversal_prob:
                    max_reversal_prob = result['reversal_probability']
                    max_reversal_tf = result['tf']
                if result['continuation_probability'] > max_continuation_prob:
                    max_continuation_prob = result['continuation_probability']
                    max_continuation_tf = result['tf']

        total_bias = bias_votes_bullish - bias_votes_bearish
        quant_bias = 'NEUTRO'
        quant_confidence = 50
        if total_bias > 0.15:
            quant_bias = 'BULLISH'
            quant_confidence = min(95, 50 + total_bias * 80)
        elif total_bias < -0.15:
            quant_bias = 'BEARISH'
            quant_confidence = min(95, 50 + abs(total_bias) * 80)
        else:
            quant_confidence = 50

        avg_volatility = np.mean([r.get('atr_pct', 0) for r in tf_results]) if tf_results else 0
        avg_vol_ratio = np.mean([r.get('volume_ratio', 1) for r in tf_results]) if tf_results else 1

        return {
            'agent': self.name,
            'weight': self.weight,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'symbol': symbol,
            'bias': quant_bias,
            'confidence': round(quant_confidence),
            'total_bias_score': round(total_bias, 4),
            'avg_volatility_pct': round(float(avg_volatility), 3),
            'avg_volume_ratio': round(float(avg_vol_ratio), 2),
            'max_reversal_tf': max_reversal_tf,
            'max_reversal_probability': round(max_reversal_prob, 1),
            'max_continuation_tf': max_continuation_tf,
            'max_continuation_probability': round(max_continuation_prob, 1),
            'timeframes': tf_results,
            'regime': self._classify_regime(tf_results),
        }

    def _classify_regime(self, tf_results: list[dict]) -> dict[str, Any]:
        if not tf_results:
            return {'regime': 'INDETERMINADO', 'description': 'Dados insuficientes para classificacao'}
        tf_map = {r['tf']: r for r in tf_results}
        d1 = tf_map.get('Diario')
        h1 = tf_map.get('1 hora')
        m15 = tf_map.get('15 minutos')
        m5 = tf_map.get('5 minutos')

        bbw_d1 = d1['bb_width_pct'] if d1 else 0
        bbw_m15 = m15['bb_width_pct'] if m15 else 0
        z_d1 = d1['z_score'] if d1 else 0

        if bbw_d1 < 2 and bbw_m15 < 3:
            regime = 'SQUEEZE'
            desc = 'Bandas de Bollinger contraidas — possivel explosao de volatilidade iminente'
        elif abs(z_d1) > 2:
            regime = 'EXTREMO'
            desc = f'Preco em zona extrema no Diario (Z={z_d1:.1f}) — alta prob. de reversao'
        elif bbw_d1 > 6:
            regime = 'ALTA_VOLATILIDADE'
            desc = 'Volatilidade elevada no Diario — usar stops largos'
        else:
            regime = 'NORMAL'
            desc = 'Condicoes de mercado normais — seguir estrutura'

        return {'regime': regime, 'description': desc}

    def analyze_multi(self, symbols: list[str]) -> dict[str, Any]:
        results = {}
        for sym in symbols:
            try:
                results[sym] = self.analyze(sym)
            except Exception as e:
                results[sym] = {'error': str(e)}
        return {'agent': self.name, 'results': results}
