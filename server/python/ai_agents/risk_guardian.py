import yfinance as yf
import pandas as pd
import numpy as np
import requests
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

PROP_FIRM_LIMITS: dict[str, dict[str, float]] = {
    'FTMO': {'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10, 'profit_target': 0.10},
    'MFF': {'max_daily_drawdown': 0.04, 'max_total_drawdown': 0.08, 'profit_target': 0.08},
    'FUNDEDNEXT': {'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10, 'profit_target': 0.08},
    'THE_FUNDED_TRADER': {'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10, 'profit_target': 0.08},
    'DEFAULT': {'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10, 'profit_target': 0.10},
}

SMC_LOT_MULTIPLIERS: dict[str, float] = {
    'FVG': 1.0,
    'OB': 0.8,
    'BOS': 1.2,
    'CHOCH': 1.0,
    'LIQUIDITY': 0.7,
    'DEFAULT': 0.5,
}

YFINANCE_MAP: dict[str, str] = {
    'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X',
    'USDCAD': 'USDCAD=X', 'AUDUSD': 'AUDUSD=X', 'NZDUSD': 'NZDUSD=X',
    'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F',
    'US30': 'YM=F', 'SP500': 'ES=F', 'NAS100': 'NQ=F',
    'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD',
}

ASSET_CALIBRATION: dict[str, dict[str, float]] = {
    'DEFAULT': {
        'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10,
        'spread_multiplier': 3.0, 'base_risk_pct': 0.01,
        'smc_fvg': 1.0, 'smc_ob': 0.8, 'smc_bos': 1.2,
        'smc_choch': 1.0, 'smc_liquidity': 0.7, 'smc_default': 0.5,
        'max_lot': 10.0,
    },
    'XAUUSD': {
        'max_daily_drawdown': 0.045, 'max_total_drawdown': 0.09,
        'spread_multiplier': 3.5, 'base_risk_pct': 0.008,
        'smc_fvg': 0.9, 'smc_ob': 0.7, 'smc_bos': 1.0,
        'smc_choch': 0.9, 'smc_liquidity': 0.6, 'smc_default': 0.4,
        'max_lot': 5.0,
    },
    'BTCUSD': {
        'max_daily_drawdown': 0.06, 'max_total_drawdown': 0.12,
        'spread_multiplier': 4.0, 'base_risk_pct': 0.005,
        'smc_fvg': 0.7, 'smc_ob': 0.6, 'smc_bos': 0.9,
        'smc_choch': 0.7, 'smc_liquidity': 0.5, 'smc_default': 0.3,
        'max_lot': 3.0,
    },
    'ETHUSD': {
        'max_daily_drawdown': 0.06, 'max_total_drawdown': 0.12,
        'spread_multiplier': 4.0, 'base_risk_pct': 0.005,
        'smc_fvg': 0.7, 'smc_ob': 0.6, 'smc_bos': 0.9,
        'smc_choch': 0.7, 'smc_liquidity': 0.5, 'smc_default': 0.3,
        'max_lot': 3.0,
    },
    'EURUSD': {
        'max_daily_drawdown': 0.04, 'max_total_drawdown': 0.08,
        'spread_multiplier': 2.5, 'base_risk_pct': 0.012,
        'smc_fvg': 1.1, 'smc_ob': 0.9, 'smc_bos': 1.3,
        'smc_choch': 1.1, 'smc_liquidity': 0.8, 'smc_default': 0.6,
        'max_lot': 15.0,
    },
    'GBPUSD': {
        'max_daily_drawdown': 0.04, 'max_total_drawdown': 0.08,
        'spread_multiplier': 2.5, 'base_risk_pct': 0.012,
        'smc_fvg': 1.1, 'smc_ob': 0.9, 'smc_bos': 1.3,
        'smc_choch': 1.1, 'smc_liquidity': 0.8, 'smc_default': 0.6,
        'max_lot': 15.0,
    },
    'USDJPY': {
        'max_daily_drawdown': 0.04, 'max_total_drawdown': 0.08,
        'spread_multiplier': 2.5, 'base_risk_pct': 0.012,
        'smc_fvg': 1.1, 'smc_ob': 0.9, 'smc_bos': 1.3,
        'smc_choch': 1.1, 'smc_liquidity': 0.8, 'smc_default': 0.6,
        'max_lot': 15.0,
    },
    'US30': {
        'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10,
        'spread_multiplier': 3.0, 'base_risk_pct': 0.008,
        'smc_fvg': 1.0, 'smc_ob': 0.8, 'smc_bos': 1.2,
        'smc_choch': 1.0, 'smc_liquidity': 0.7, 'smc_default': 0.5,
        'max_lot': 5.0,
    },
    'SP500': {
        'max_daily_drawdown': 0.05, 'max_total_drawdown': 0.10,
        'spread_multiplier': 3.0, 'base_risk_pct': 0.008,
        'smc_fvg': 1.0, 'smc_ob': 0.8, 'smc_bos': 1.2,
        'smc_choch': 1.0, 'smc_liquidity': 0.7, 'smc_default': 0.5,
        'max_lot': 5.0,
    },
}


def _get_ticker(symbol: str) -> str:
    return YFINANCE_MAP.get(symbol.upper(), symbol.upper())


class EquityGuardian:
    def __init__(self, account_balance: float = 100000.0, prop_firm: str = 'FTMO'):
        self.initial_balance = account_balance
        self.peak_equity = account_balance
        self.daily_start_equity = account_balance
        self.daily_reset_date = datetime.now(timezone.utc).date()
        self.prop_firm = prop_firm
        self.limits = PROP_FIRM_LIMITS.get(prop_firm, PROP_FIRM_LIMITS['DEFAULT'])
        self._bridge_url = os.environ.get('BRIDGE_URL', 'http://localhost:5555')
        self._bridge_api_key = os.environ.get('BRIDGE_API_KEY', '')

    def _fetch_bridge_equity(self) -> float | None:
        try:
            headers = {'X-Api-Key': self._bridge_api_key} if self._bridge_api_key else {}
            r = requests.get(f'{self._bridge_url}/account', headers=headers, timeout=2)
            if r.status_code == 200:
                data = r.json()
                equity = float(data.get('equity', 0))
                balance = float(data.get('balance', 0))
                if equity > 0:
                    if self.initial_balance == 0:
                        self.initial_balance = balance
                    return equity
            return None
        except (requests.RequestException, ValueError, TypeError):
            return None

    def update(self, current_equity: float | None = None) -> dict[str, Any]:
        bridge_equity = self._fetch_bridge_equity()
        if bridge_equity is not None:
            effective_equity = bridge_equity
        else:
            effective_equity = current_equity if current_equity is not None else self.initial_balance
        now = datetime.now(timezone.utc)
        if now.date() > self.daily_reset_date:
            self.daily_start_equity = effective_equity
            self.daily_reset_date = now.date()

        if effective_equity > self.peak_equity:
            self.peak_equity = effective_equity

        current_drawdown = max(0, (self.peak_equity - effective_equity) / self.peak_equity)
        daily_drawdown = max(0, (self.daily_start_equity - effective_equity) / self.daily_start_equity)
        remaining_total = max(0, self.limits['max_total_drawdown'] - current_drawdown)
        remaining_daily = max(0, self.limits['max_daily_drawdown'] - daily_drawdown)

        drawdown_ratio = current_drawdown / self.limits['max_total_drawdown'] if self.limits['max_total_drawdown'] > 0 else 0
        if drawdown_ratio >= 0.8:
            risk_level = 'CRITICAL'
            lot_reduction = 0.0
        elif drawdown_ratio >= 0.6:
            risk_level = 'HIGH'
            lot_reduction = 0.3
        elif drawdown_ratio >= 0.3:
            risk_level = 'MODERATE'
            lot_reduction = 0.7
        else:
            risk_level = 'LOW'
            lot_reduction = 1.0

        profit_pct = (effective_equity - self.initial_balance) / self.initial_balance * 100
        profit_progress = max(0, profit_pct / (self.limits['profit_target'] * 100)) * 100

        return {
            'current_equity': round(effective_equity, 2),
            'peak_equity': round(self.peak_equity, 2),
            'current_drawdown_pct': round(current_drawdown * 100, 2),
            'daily_drawdown_pct': round(daily_drawdown * 100, 2),
            'remaining_drawdown_pct': round(remaining_total * 100, 2),
            'remaining_daily_pct': round(remaining_daily * 100, 2),
            'max_drawdown_limit': self.limits['max_total_drawdown'] * 100,
            'max_daily_limit': self.limits['max_daily_drawdown'] * 100,
            'risk_level': risk_level,
            'lot_reduction_factor': lot_reduction,
            'prop_firm': self.prop_firm,
            'profit_target_pct': self.limits['profit_target'] * 100,
            'profit_progress_pct': round(min(100, profit_progress), 1),
        }


class LotSizer:
    def __init__(self, account_balance: float = 100000.0, risk_per_trade: float = 0.01, max_lot: float = 10.0):
        self.account_balance = account_balance
        self.risk_per_trade = risk_per_trade
        self.max_lot = max_lot

    def calculate(self, entry_price: float, stop_loss: float, structure_type: str = 'DEFAULT',
                  confidence: float = 0.5, equity_reduction: float = 1.0) -> dict[str, Any]:
        sl_pips = abs(entry_price - stop_loss) / entry_price * 10000 if entry_price > 0 else 1
        base_risk_amount = self.account_balance * self.risk_per_trade
        structure_mult = SMC_LOT_MULTIPLIERS.get(structure_type, SMC_LOT_MULTIPLIERS['DEFAULT'])
        confidence_mult = 0.5 + confidence
        risk_amount = base_risk_amount * structure_mult * confidence_mult * equity_reduction
        raw_lot = risk_amount / (sl_pips * 10) if sl_pips > 0 else 0.01
        lot = max(0.01, min(self.max_lot, round(raw_lot, 2)))

        return {
            'suggested_lot': lot,
            'raw_lot': round(raw_lot, 4),
            'risk_amount': round(risk_amount, 2),
            'sl_pips': round(sl_pips, 1),
            'structure_multiplier': structure_mult,
            'confidence_multiplier': confidence_mult,
            'equity_reduction': equity_reduction,
            'structure_type': structure_type,
            'risk_per_trade_pct': self.risk_per_trade * 100,
        }

    def calculate_table(self, entry_price: float, structure_types: Optional[list[str]] = None,
                        confidences: Optional[list[float]] = None, equity_reduction: float = 1.0) -> list[dict]:
        if structure_types is None:
            structure_types = ['FVG', 'OB', 'BOS', 'CHOCH', 'LIQUIDITY']
        if confidences is None:
            confidences = [0.3, 0.5, 0.7, 0.9]
        rows = []
        for st in structure_types:
            for conf in confidences:
                sl = entry_price * 0.995 if 'USD' in str(entry_price) else entry_price * 0.99
                result = self.calculate(entry_price, sl, st, conf, equity_reduction)
                rows.append(result)
        return rows


class SpreadFilter:
    def __init__(self):
        self.history: dict[str, list[dict]] = {}

    def analyze(self, symbol: str, current_spread: float, atr_pips: float, spread_mult: float = 3.0) -> dict[str, Any]:
        if symbol not in self.history:
            self.history[symbol] = []

        self.history[symbol].append({
            'spread': current_spread, 'atr_pips': atr_pips,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        })
        if len(self.history[symbol]) > 100:
            self.history[symbol] = self.history[symbol][-100:]

        spreads = [s['spread'] for s in self.history[symbol]]
        avg_spread = float(np.mean(spreads)) if spreads else current_spread
        std_spread = float(np.std(spreads)) if len(spreads) > 1 else 0
        max_allowed = max(avg_spread * spread_mult, atr_pips * 0.1)
        blocked = current_spread > max_allowed
        spread_ratio = current_spread / max_allowed if max_allowed > 0 else 1
        reason = f'Spread {current_spread:.1f} > maximo {max_allowed:.1f} ({spread_mult:.0f}x media {avg_spread:.1f})' if blocked else None

        return {
            'symbol': symbol,
            'current_spread': round(current_spread, 2),
            'avg_spread': round(avg_spread, 2),
            'spread_std': round(std_spread, 2),
            'max_allowed': round(max_allowed, 2),
            'atr_pips': round(atr_pips, 4),
            'blocked': blocked,
            'spread_ratio': round(spread_ratio, 2),
            'reason': reason,
            'data_points': len(self.history[symbol]),
        }

    def get_status(self, symbol: str) -> dict:
        if symbol not in self.history or not self.history[symbol]:
            return {'blocked': True, 'reason': 'Sem dados de spread'}
        return self.history[symbol][-1]


class RiskGuardian:
    def __init__(self, account_balance: float = 100000.0, prop_firm: str = 'FTMO'):
        self.equity = EquityGuardian(account_balance, prop_firm)
        self.lot = LotSizer(account_balance, max_lot=10.0)
        self.spread = SpreadFilter()

    def _get_calibration(self, symbol: str) -> dict[str, float]:
        base = symbol.upper().split('Cash')[0].split('.')[0]
        return ASSET_CALIBRATION.get(base, ASSET_CALIBRATION['DEFAULT'])

    def _update_limits_from_symbol(self, symbol: str) -> None:
        cal = self._get_calibration(symbol)
        if self.equity.limits['max_daily_drawdown'] == PROP_FIRM_LIMITS.get(self.equity.prop_firm, PROP_FIRM_LIMITS['DEFAULT'])['max_daily_drawdown']:
            self.equity.limits = {
                'max_daily_drawdown': cal['max_daily_drawdown'],
                'max_total_drawdown': cal['max_total_drawdown'],
                'profit_target': self.equity.limits.get('profit_target', 0.10),
            }
        self.lot.risk_per_trade = cal['base_risk_pct']
        self.lot.max_lot = cal['max_lot']
        smc_map = {
            'FVG': cal['smc_fvg'], 'OB': cal['smc_ob'], 'BOS': cal['smc_bos'],
            'CHOCH': cal['smc_choch'], 'LIQUIDITY': cal['smc_liquidity'], 'DEFAULT': cal['smc_default'],
        }
        SMC_LOT_MULTIPLIERS.update(smc_map)

    def analyze(self, symbol: str) -> dict[str, Any]:
        try:
            self._update_limits_from_symbol(symbol)
            cal = self._get_calibration(symbol)
            ticker_str = _get_ticker(symbol)
            hist = yf.download(ticker_str, period='5d', interval='1h', progress=False, auto_adjust=True)
            if hist.empty:
                hist = yf.download(ticker_str, period='10d', interval='1d', progress=False, auto_adjust=True)
            if hist.empty:
                return self._empty(symbol, 'Sem dados de mercado para este ativo')

            if isinstance(hist.columns, pd.MultiIndex):
                hist.columns = hist.columns.get_level_values(0)

            current_price = float(hist['Close'].iloc[-1])
            high_low = hist['High'] - hist['Low']
            atr = high_low.rolling(14).mean().iloc[-1] if len(hist) >= 14 else high_low.mean()
            atr_pct = atr / current_price if current_price > 0 else 0
            atr_pips = atr_pct * 10000

            avg_candle = (hist['High'] - hist['Low']).mean()
            current_spread = (avg_candle / current_price * 10000 * 1.5).item() if hasattr(avg_candle, 'item') else float(avg_candle) / current_price * 10000 * 1.5

            equity_status = self.equity.update()
            spread_status = self.spread.analyze(symbol, current_spread, atr_pips, spread_mult=cal['spread_multiplier'])

            lot_example = self.lot.calculate(
                entry_price=current_price,
                stop_loss=current_price * 0.995,
                structure_type='FVG',
                confidence=0.7,
                equity_reduction=equity_status['lot_reduction_factor'],
            )

            return {
                'agent': 'risk_guardian',
                'weight': 0.0,
                'symbol': symbol,
                'calibration': {
                    'max_daily_drawdown': cal['max_daily_drawdown'] * 100,
                    'max_total_drawdown': cal['max_total_drawdown'] * 100,
                    'spread_multiplier': cal['spread_multiplier'],
                    'base_risk_pct': cal['base_risk_pct'] * 100,
                    'max_lot': cal['max_lot'],
                },
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'current_price': round(current_price, 2),
                'atr_pct': round(atr_pct, 4),
                'atr_pips': round(atr_pips, 2),
                'equity': equity_status,
                'spread': spread_status,
                'trading_allowed': not spread_status['blocked'] and equity_status['risk_level'] != 'CRITICAL',
                'block_reasons': self._block_reasons(equity_status, spread_status),
                'lot_sizing_example': lot_example,
            }
        except Exception as e:
            return self._empty(symbol, str(e))

    def _empty(self, symbol: str, error: str) -> dict:
        return {
            'agent': 'risk_guardian', 'weight': 0.0, 'symbol': symbol,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'error': error, 'trading_allowed': False, 'block_reasons': [error],
        }

    def _block_reasons(self, equity: dict, spread: dict) -> list[str]:
        reasons = []
        if equity['risk_level'] == 'CRITICAL':
            reasons.append(f'Drawdown critico: {equity["current_drawdown_pct"]}% (limite {equity["max_drawdown_limit"]}%)')
        if spread.get('blocked'):
            reasons.append(spread['reason'])
        if equity['remaining_daily_pct'] < 1:
            reasons.append(f'Daily drawdown proximo do limite: {equity["remaining_daily_pct"]}% restante')
        if equity['lot_reduction_factor'] < 0.5:
            reasons.append(f'Modo seguro ativo: lotes reduzidos a {equity["lot_reduction_factor"]*100:.0f}%')
        return reasons

    def get_status(self, symbol: str = '') -> dict:
        cal = self._get_calibration(symbol) if symbol else ASSET_CALIBRATION['DEFAULT']
        return {
            'agent': 'risk_guardian',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'prop_firm': self.equity.prop_firm,
            'initial_balance': self.equity.initial_balance,
            'risk_per_trade': self.lot.risk_per_trade,
            'max_lot': self.lot.max_lot,
            'limits': self.equity.limits,
            'calibration': {
                'max_daily_drawdown': cal['max_daily_drawdown'] * 100,
                'max_total_drawdown': cal['max_total_drawdown'] * 100,
                'spread_multiplier': cal['spread_multiplier'],
                'base_risk_pct': cal['base_risk_pct'] * 100,
                'max_lot': cal['max_lot'],
            },
        }


class RiskGuardianAgent:
    name = 'risk_guardian'
    display_name = 'Risk Guardian'
    weight = 0.0

    def __init__(self, account_balance: float = 100000.0, prop_firm: str = 'FTMO'):
        self.guardian = RiskGuardian(account_balance, prop_firm)

    def analyze(self, symbol: str) -> dict[str, Any]:
        return self.guardian.analyze(symbol)

    def analyze_multi(self, symbols: list[str]) -> dict[str, Any]:
        results = {}
        for sym in symbols:
            try:
                results[sym] = self.guardian.analyze(sym)
            except Exception as e:
                results[sym] = {'error': str(e)}
        return {'agent': self.name, 'results': results}
