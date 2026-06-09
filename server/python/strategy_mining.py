import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import random
import json
import math


def clean_nan(obj):
    """Recursively replace NaN/Inf in dicts/lists with 0.0 for safe JSON serialization."""
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
    return obj

@dataclass
class SegmentResult:
    in_sample: Dict[str, float]
    out_sample: Dict[str, float]
    wfe: float

def compute_sharpe(returns: List[float], rf: float = 0.0) -> float:
    arr = np.array(returns)
    if len(arr) < 2 or np.std(arr) < 1e-9:
        return 0.0
    val = float((np.mean(arr) - rf) / np.std(arr) * np.sqrt(252))
    if np.isnan(val) or np.isinf(val):
        return 0.0
    return val

def compute_profit_factor(gross_profit: float, gross_loss: float) -> float:
    if abs(gross_loss) < 1e-9:
        return float('inf') if gross_profit > 0 else 0.0
    return abs(gross_profit / gross_loss)

def compute_recovery_factor(net_profit: float, max_drawdown: float) -> float:
    if abs(max_drawdown) < 1e-9:
        return 0.0
    return abs(net_profit / max_drawdown)

def compute_metrics_from_trades(trades: List[Dict]) -> Dict[str, float]:
    if not trades:
        return {'total_trades': 0, 'win_rate': 0, 'profit_factor': 0, 'sharpe': 0, 'recovery_factor': 0, 'net_profit': 0, 'max_drawdown': 0, 'avg_win': 0, 'avg_loss': 0}
    pnl = [t.get('profit', 0) for t in trades if t.get('result') in ('WIN', 'LOSS')]
    wins = [p for p in pnl if p > 0]
    losses = [p for p in pnl if p <= 0]
    total_trades = len(pnl)
    win_rate = len(wins) / total_trades * 100 if total_trades > 0 else 0
    gross_profit = sum(wins) if wins else 0
    gross_loss = sum(losses) if losses else 0
    net_profit = gross_profit + gross_loss
    profit_factor = compute_profit_factor(gross_profit, abs(gross_loss))
    sharpe = compute_sharpe(pnl)
    equity_curve = np.cumsum(pnl)
    peak = np.maximum.accumulate(equity_curve) if len(equity_curve) > 0 else equity_curve
    drawdown = peak - equity_curve
    max_dd = float(np.max(drawdown)) if len(drawdown) > 0 else 0
    recovery_factor = compute_recovery_factor(net_profit, max_dd)
    avg_win = float(np.mean(wins)) if wins else 0
    avg_loss = float(np.mean(losses)) if losses else 0
    return {
        'total_trades': total_trades, 'win_rate': round(win_rate, 2),
        'profit_factor': round(profit_factor, 4), 'sharpe': round(sharpe, 4),
        'recovery_factor': round(recovery_factor, 4),
        'net_profit': round(net_profit, 2), 'max_drawdown': round(max_dd, 2),
        'avg_win': round(avg_win, 2), 'avg_loss': round(avg_loss, 2),
    }

def run_wfa(trades: List[Dict], segments: int = 4) -> Dict[str, Any]:
    if len(trades) < segments * 4:
        return {'error': f'Poucos trades ({len(trades)}) para {segments} segmentos. Mínimo ~{segments * 4}.'}
    sorted_trades = sorted(trades, key=lambda t: t.get('entryTime', 0))
    chunk_size = len(sorted_trades) // segments
    results = []
    total_wfe = 0.0
    for s in range(segments - 1):
        in_start = s * chunk_size
        in_end = (s + 1) * chunk_size
        out_start = in_end
        out_end = min((s + 2) * chunk_size, len(sorted_trades))
        in_trades = sorted_trades[in_start:in_end]
        out_trades = sorted_trades[out_start:out_end]
        in_metrics = compute_metrics_from_trades(in_trades)
        out_metrics = compute_metrics_from_trades(out_trades)
        in_sharpe = in_metrics['sharpe']
        out_sharpe = out_metrics['sharpe']
        if in_sharpe <= 0 or out_sharpe <= 0:
            wfe = 0.0
        else:
            wfe = (out_sharpe / in_sharpe * 100) if abs(in_sharpe) > 1e-9 else 0.0
        if np.isnan(wfe) or np.isinf(wfe): wfe = 0.0
        wfe = max(0, min(200, wfe))
        total_wfe += wfe
        results.append(SegmentResult(in_metrics, out_metrics, round(wfe, 2)))
    overall_wfe = round(total_wfe / (segments - 1), 2) if segments > 1 else 0.0
    result = {
        'segments': [{'in_sample': r.in_sample, 'out_sample': r.out_sample, 'wfe': r.wfe} for r in results],
        'overall_wfe': overall_wfe,
        'segments_count': segments - 1,
    }
    return clean_nan(result)

def run_monte_carlo(trades: List[Dict], trials: int = 1000, confidence: float = 0.95) -> Dict[str, Any]:
    pnl = [t.get('profit', 0) for t in trades if t.get('result') in ('WIN', 'LOSS')]
    if len(pnl) < 5:
        return {'error': 'Poucos trades para Monte Carlo.'}
    n = len(pnl)
    trial_results = []
    for _ in range(trials):
        sampled = random.choices(pnl, k=n)
        trial_results.append(float(np.sum(sampled)))
    arr = np.array(trial_results)
    low_pct = (1 - confidence) / 2 * 100
    high_pct = (1 + confidence) / 2 * 100
    percentiles = {
        'p5': float(np.percentile(arr, 5)),
        'p10': float(np.percentile(arr, 10)),
        'p25': float(np.percentile(arr, 25)),
        'p50': float(np.percentile(arr, 50)),
        'p75': float(np.percentile(arr, 75)),
        'p90': float(np.percentile(arr, 90)),
        'p95': float(np.percentile(arr, 95)),
    }
    actual_total = float(np.sum(pnl))
    prob_positive = float(np.mean(arr > 0) * 100)
    prob_negative = float(np.mean(arr < 0) * 100)
    return clean_nan({
        'trials': trials,
        'actual_total': round(actual_total, 2),
        'mean': round(float(np.mean(arr)), 2),
        'std': round(float(np.std(arr)), 2),
        'percentiles': {k: round(v, 2) for k, v in percentiles.items()},
        'prob_positive': round(prob_positive, 2),
        'prob_negative': round(prob_negative, 2),
        'confidence': confidence,
    })

def generate_charts(trades: List[Dict]) -> Dict[str, Any]:
    import plotly.graph_objects as go
    import plotly.express as px

    pnl = [t.get('profit', 0) for t in trades if t.get('result') in ('WIN', 'LOSS')]
    charts = {}

    # 1. Monte Carlo Distribution
    if len(pnl) >= 5:
        np.random.seed(42)
        n = len(pnl)
        trials = 2000
        trial_results = [float(np.sum(np.random.choice(pnl, size=n))) for _ in range(trials)]
        fig = go.Figure()
        fig.add_trace(go.Histogram(x=trial_results, nbinsx=50, name='Simulações',
            marker_color='rgba(139, 92, 246, 0.6)', marker_line_color='rgba(139, 92, 246, 1)',
            marker_line_width=1))
        actual = float(np.sum(pnl))
        fig.add_vline(x=actual, line_dash='dash', line_color='rgb(52, 211, 153)',
            annotation_text=f'Real: ${actual:.0f}', annotation_position='top right')
        fig.add_vline(x=0, line_color='rgb(239, 68, 68)', line_width=1)
        fig.update_layout(
            title='Distribuição Monte Carlo — P&L Total',
            xaxis_title='P&L Total ($)', yaxis_title='Frequência',
            plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#94a3b8', size=10), margin=dict(l=40, r=40, t=40, b=40),
            showlegend=False, height=300,
            xaxis=dict(gridcolor='rgba(148,163,184,0.1)', zerolinecolor='rgba(148,163,184,0.2)'),
            yaxis=dict(gridcolor='rgba(148,163,184,0.1)'),
        )
        charts['monte_carlo'] = json.loads(fig.to_json())

    # 2. WFA Segment Comparison
    if len(trades) >= 16:
        wfa = run_wfa(trades, segments=4)
        if 'segments' in wfa:
            segs = wfa['segments']
            labels = [f'Seg {i+1}' for i in range(len(segs))]
            fig = go.Figure()
            fig.add_trace(go.Bar(name='In Sample (Sharpe)', x=labels,
                y=[s['in_sample']['sharpe'] for s in segs],
                marker_color='rgba(52, 211, 153, 0.7)', marker_line_color='rgb(52, 211, 153)',
                marker_line_width=1))
            fig.add_trace(go.Bar(name='Out Sample (Sharpe)', x=labels,
                y=[s['out_sample']['sharpe'] for s in segs],
                marker_color='rgba(251, 191, 36, 0.7)', marker_line_color='rgb(251, 191, 36)',
                marker_line_width=1))
            fig.add_trace(go.Scatter(name='WFE %', x=labels, y=[s['wfe'] for s in segs],
                yaxis='y2', line=dict(color='rgb(139, 92, 246)', width=2),
                mode='lines+markers', marker=dict(size=8)))
            fig.update_layout(
                title='WFA — Sharpe In/Out Sample por Segmento',
                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#94a3b8', size=10), margin=dict(l=40, r=40, t=40, b=40),
                height=300, barmode='group',
                xaxis=dict(gridcolor='rgba(148,163,184,0.1)'),
                yaxis=dict(gridcolor='rgba(148,163,184,0.1)', title='Sharpe'),
                yaxis2=dict(overlaying='y', side='right', title='WFE %',
                    gridcolor='rgba(148,163,184,0.05)', range=[0, 100]),
                legend=dict(orientation='h', y=1.12, x=0, font=dict(size=9)),
            )
            charts['wfa'] = json.loads(fig.to_json())

    # 3. Equity Curves (real + MC simulations)
    if len(pnl) >= 10:
        real_curve = list(np.cumsum(pnl))
        fig = go.Figure()
        # Real equity
        fig.add_trace(go.Scatter(y=real_curve, name='Real',
            line=dict(color='rgb(52, 211, 153)', width=2)))
        # MC simulation sample (10 random paths)
        np.random.seed(42)
        for i in range(10):
            sim = list(np.cumsum(np.random.choice(pnl, size=n)))
            fig.add_trace(go.Scatter(y=sim, name=f'MC {i+1}' if i == 0 else '',
                line=dict(color='rgba(139, 92, 246, 0.15)', width=1),
                showlegend=i == 0))
        fig.add_hline(y=0, line_color='rgba(239, 68, 68, 0.5)', line_width=1)
        fig.update_layout(
            title='Curva de Equity — Real vs Simulações Monte Carlo',
            xaxis_title='Trade #', yaxis_title='P&L Acumulado ($)',
            plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#94a3b8', size=10), margin=dict(l=40, r=40, t=40, b=40),
            height=300,
            xaxis=dict(gridcolor='rgba(148,163,184,0.1)'),
            yaxis=dict(gridcolor='rgba(148,163,184,0.1)'),
            legend=dict(orientation='h', y=1.12, x=0, font=dict(size=9)),
        )
        charts['equity'] = json.loads(fig.to_json())

    return clean_nan(charts)


def run_mining_metrics(trades: List[Dict]) -> Dict[str, Any]:
    metrics = compute_metrics_from_trades(trades)
    return clean_nan({
        'recovery_factor': metrics['recovery_factor'],
        'profit_factor': metrics['profit_factor'],
        'sharpe': metrics['sharpe'],
        'total_trades': metrics['total_trades'],
        'win_rate': metrics['win_rate'],
        'net_profit': metrics['net_profit'],
        'max_drawdown': metrics['max_drawdown'],
    })
