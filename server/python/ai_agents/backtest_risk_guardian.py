import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Any


def backtest_risk_guardian(
    equity_curve: list[float],
    max_drawdown_limit: float = 0.10,
    max_daily_limit: float = 0.05,
    risk_per_trade: float = 0.01,
    lot_multiplier: float = 1.0,
) -> dict[str, Any]:
    """
    Vectorized backtest for Risk Guardian drawdown protection logic.

    Args:
        equity_curve: List of equity values over time
        max_drawdown_limit: Maximum total drawdown (e.g. 0.10 = 10%)
        max_daily_limit: Maximum daily drawdown (e.g. 0.05 = 5%)
        risk_per_trade: Risk per trade as fraction of balance
        lot_multiplier: Base lot multiplier

    Returns:
        Dict with backtest results
    """
    arr = np.array(equity_curve, dtype=float)
    n = len(arr)

    peak = np.maximum.accumulate(arr)
    drawdown = (peak - arr) / peak

    daily_starts = arr[::96] if len(arr) > 96 else [arr[0]]
    daily_starts = np.array(daily_starts[:len(arr)])
    daily_dd = np.zeros(n)
    for i in range(n):
        day_idx = i // 96
        if day_idx < len(daily_starts):
            daily_dd[i] = max(0, (daily_starts[day_idx] - arr[i]) / daily_starts[day_idx]) if daily_starts[day_idx] > 0 else 0

    risk_levels = np.where(
        drawdown >= max_drawdown_limit * 0.8, 'CRITICAL',
        np.where(
            drawdown >= max_drawdown_limit * 0.6, 'HIGH',
            np.where(drawdown >= max_drawdown_limit * 0.3, 'MODERATE', 'LOW')
        )
    )

    lot_reduction = np.where(
        drawdown >= max_drawdown_limit * 0.8, 0.0,
        np.where(
            drawdown >= max_drawdown_limit * 0.6, 0.3,
            np.where(drawdown >= max_drawdown_limit * 0.3, 0.7, 1.0)
        )
    )

    trades_allowed = lot_reduction > 0
    num_blocked = int(np.sum(~trades_allowed))
    num_allowed = int(np.sum(trades_allowed))

    time_in_market_pct = num_allowed / n * 100 if n > 0 else 0

    dd_at_risk = drawdown[drawdown >= max_drawdown_limit * 0.3]
    avg_dd_when_risky = float(np.mean(dd_at_risk)) * 100 if len(dd_at_risk) > 0 else 0

    max_dd = float(np.max(drawdown)) * 100
    breaches = int(np.sum(drawdown >= max_drawdown_limit))

    protection_efficiency = 0.0
    if max_dd > 0:
        protection_efficiency = (1 - max_dd / (max_drawdown_limit * 100)) * 100

    worst_dd_drawdown = max_dd

    return {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'metrics': {
            'total_points': n,
            'max_drawdown_pct': round(max_dd, 2),
            'avg_drawdown_when_risky_pct': round(avg_dd_when_risky, 2),
            'breaches': breaches,
            'max_drawdown_limit': max_drawdown_limit * 100,
            'trades_blocked': num_blocked,
            'trades_allowed': num_allowed,
            'time_in_market_pct': round(time_in_market_pct, 1),
            'protection_efficiency_pct': round(protection_efficiency, 1),
        },
        'config': {
            'max_total_drawdown': max_drawdown_limit * 100,
            'max_daily_drawdown': max_daily_limit * 100,
            'risk_per_trade': risk_per_trade * 100,
        },
        'summary': (
            f'Backtest: {n} pontos, Drawdown Max {max_dd:.1f}% (limite {max_drawdown_limit*100:.0f}%), '
            f'{breaches} violacoes, {num_blocked}/{n} bloqueios de risco, '
            f'Eficiencia: {protection_efficiency:.0f}%'
        ),
    }


def backtest_lot_sizer(
    trade_returns: list[float],
    initial_balance: float = 100000.0,
    risk_per_trade: float = 0.01,
) -> dict[str, Any]:
    """
    Backtest the impact of Risk Guardian lot sizing on a series of trades.

    Args:
        trade_returns: List of fractional returns per trade (e.g. 0.02 for +2%)
        initial_balance: Starting account balance
        risk_per_trade: Risk per trade as fraction

    Returns:
        Dict with backtest results comparing fixed vs dynamic lot sizing
    """
    arr = np.array(trade_returns, dtype=float)
    n = len(arr)

    fixed_balance = initial_balance
    fixed_curve = [fixed_balance]
    for ret in arr:
        fixed_balance *= 1 + ret
        fixed_curve.append(fixed_balance)

    dyn_balance = initial_balance
    dyn_curve = [dyn_balance]
    peak = initial_balance

    for ret in arr:
        peak = max(peak, dyn_balance)
        current_dd = (peak - dyn_balance) / peak

        if current_dd >= 0.08:
            reduction = 0.0
        elif current_dd >= 0.06:
            reduction = 0.3
        elif current_dd >= 0.03:
            reduction = 0.7
        else:
            reduction = 1.0

        effective_ret = ret * reduction
        dyn_balance *= 1 + effective_ret
        dyn_curve.append(dyn_balance)

    fixed_final = fixed_curve[-1]
    dyn_final = dyn_curve[-1]

    fixed_return = (fixed_final - initial_balance) / initial_balance * 100
    dyn_return = (dyn_final - initial_balance) / initial_balance * 100

    fixed_peak = max(fixed_curve)
    dyn_peak = max(dyn_curve)
    fixed_dd = (fixed_peak - min(fixed_curve)) / fixed_peak * 100
    dyn_dd = (dyn_peak - min(dyn_curve)) / dyn_peak * 100

    return {
        'initial_balance': initial_balance,
        'fixed': {
            'final_balance': round(fixed_final, 2),
            'return_pct': round(fixed_return, 2),
            'max_drawdown_pct': round(fixed_dd, 2),
            'sharpe_approx': round(np.mean(arr) / np.std(arr) * np.sqrt(252) if np.std(arr) > 0 else 0, 2),
        },
        'dynamic_risk_guardian': {
            'final_balance': round(dyn_final, 2),
            'return_pct': round(dyn_return, 2),
            'max_drawdown_pct': round(dyn_dd, 2),
            'sharpe_approx': round(np.mean(arr * 0.7) / np.std(arr * 0.7) * np.sqrt(252) if np.std(arr) > 0 else 0, 2),
        },
    }


def run_validation():
    """Run a complete validation of the Risk Guardian logic."""
    np.random.seed(42)
    hours = 1000
    base = 100000

    noise = np.random.randn(hours) * 50
    drift = np.linspace(0, 2000, hours)
    equity = base + drift + np.cumsum(noise)
    equity = np.maximum(equity, base * 0.85)

    dd_result = backtest_risk_guardian(
        equity_curve=list(equity),
        max_drawdown_limit=0.10,
        max_daily_limit=0.05,
        risk_per_trade=0.01,
    )

    np.random.seed(99)
    trades = np.random.randn(200) * 0.02 + 0.003

    lot_result = backtest_lot_sizer(
        trade_returns=list(trades),
        initial_balance=100000,
        risk_per_trade=0.01,
    )

    return {
        'drawdown_backtest': dd_result,
        'lot_sizing_backtest': lot_result,
    }


if __name__ == '__main__':
    import json
    result = run_validation()
    print(json.dumps(result, indent=2, default=str))
