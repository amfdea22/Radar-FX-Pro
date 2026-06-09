import concurrent.futures
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any

from .news_macro_agent import NewsMacroAgent
from .quant_stats_agent import QuantStatsAgent
from .bias_trend_agent import BiasTrendAgent
from .session_agent import SessionAgent
from .risk_guardian import RiskGuardianAgent
from .ml_predictor_agent import MLPredictorAgent

DEFAULT_WEIGHTS = {
    'bias_trend': 0.30,
    'news_macro': 0.25,
    'quant_stats': 0.15,
    'session_intel': 0.10,
    'ml_predictor': 0.20,
}

SYMBOLS_DEFAULT = ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'US30', 'ETHUSD', 'USDJPY', 'SP500']

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'intel_cache.json')


class IntelOrchestrator:
    def __init__(self) -> None:
        self.agents: dict[str, Any] = {
            'bias_trend': BiasTrendAgent(),
            'news_macro': NewsMacroAgent(),
            'quant_stats': QuantStatsAgent(),
            'session_intel': SessionAgent(),
            'ml_predictor': MLPredictorAgent(),
        }
        self.risk_guardian = RiskGuardianAgent()
        self.weights = dict(DEFAULT_WEIGHTS)
        self.cache: dict[str, dict[str, Any]] = {}
        self.cache_ttl: dict[str, float] = {}
        self.cache_duration = 60.0
        self._cache_lock = threading.Lock()
        self._load_cache()

    def analyze_symbol(self, symbol: str, force_refresh: bool = False) -> dict[str, Any]:
        cache_key = f'full_{symbol}'
        if not force_refresh and cache_key in self.cache:
            age = datetime.now().timestamp() - self.cache_ttl.get(cache_key, 0)
            if age < self.cache_duration:
                return self.cache[cache_key]

        agent_results: dict[str, Any] = {}
        agent_names = list(self.agents.keys())
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(agent_names)) as executor:
            future_map = {
                executor.submit(self.agents[name].analyze, symbol): name
                for name in agent_names
            }
            for future in concurrent.futures.as_completed(future_map):
                name = future_map[future]
                try:
                    agent_results[name] = future.result()
                except Exception as e:
                    agent_results[name] = {
                        'agent': name,
                        'error': str(e),
                        'weight': self.weights.get(name, 0.25),
                    }

        risk_data = {}
        try:
            risk_data = self.risk_guardian.analyze(symbol)
        except Exception:
            risk_data = {'error': 'Risk Guardian failed', 'trading_allowed': False}

        decision = self._compute_decision(agent_results, symbol)

        result = {
            'symbol': symbol,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'orchestrator': 'Intel Engine',
            'agent_results': agent_results,
            'decision_matrix': decision['matrix'],
            'final_direction': decision['direction'],
            'final_confidence': decision['confidence'],
            'summary': decision['summary'],
            'recommendations': decision['recommendations'],
            'alerts': decision['alerts'],
            'session_info': decision['session_info'],
            'risk_guardian': risk_data,
        }

        self.cache[cache_key] = result
        self.cache_ttl[cache_key] = datetime.now().timestamp()
        self._save_cache()
        return result

    def _compute_decision(self, agent_results: dict[str, Any], symbol: str) -> dict[str, Any]:
        matrix: dict[str, Any] = {}
        weighted_bullish = 0.0
        weighted_bearish = 0.0
        weighted_neutral = 0.0
        total_weight = 0.0
        alerts: list[str] = []
        recommendations: list[str] = []

        for name, result in agent_results.items():
            w = self.weights.get(name, 0.25)
            if 'error' in result:
                matrix[name] = {'weight': w, 'status': 'ERROR', 'error': result['error'], 'bias': 'ERRO', 'confidence': 0}
                total_weight += w
                continue

            agent_bias = 'NEUTRO'
            agent_confidence = 50
            agent_direction = 0

            if name == 'bias_trend':
                agent_bias = result.get('bias', 'RANGING')
                agent_confidence = result.get('confidence', 50)
                agent_direction = self._bias_to_score(agent_bias)
                inference = result.get('inference', {})
                if inference.get('reasoning'):
                    recommendations.extend(inference['reasoning'])
                matrix[name] = {
                    'weight': w,
                    'bias': agent_bias,
                    'confidence': agent_confidence,
                    'structure': {tf: d.get('structure') for tf, d in result.get('timeframes', {}).items() if 'error' not in d},
                    'trend_strength': {tf: d.get('trend_strength') for tf, d in result.get('timeframes', {}).items() if 'error' not in d},
                }

            elif name == 'news_macro':
                agent_bias = result.get('inference', {}).get('bias', 'NEUTRO')
                agent_confidence = result.get('inference', {}).get('confidence', 50)
                if agent_bias in ('ATIVO_ALTA', 'USD_ALTA'):
                    agent_direction = 0.5 if symbol in ('XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD') and agent_bias == 'USD_ALTA' else 1
                elif agent_bias in ('ATIVO_QUEDA', 'USD_QUEDA'):
                    agent_direction = -0.5 if symbol in ('XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD') and agent_bias == 'USD_QUEDA' else -1
                if result.get('volatility_alert'):
                    alerts.append(f'VOLATILIDADE: {result["volatility_detail"]}')
                matrix[name] = {
                    'weight': w,
                    'bias': agent_bias,
                    'confidence': agent_confidence,
                    'volatility_alert': result.get('volatility_alert', False),
                    'pre_news': result.get('pre_news', False),
                    'post_news': result.get('post_news', False),
                    'news_sentiment': result.get('news_sentiment'),
                    'relevant_events': result.get('relevant_events', [])[:3],
                }

            elif name == 'quant_stats':
                agent_bias = result.get('bias', 'NEUTRO')
                agent_confidence = result.get('confidence', 50)
                agent_direction = 1 if agent_bias == 'BULLISH' else (-1 if agent_bias == 'BEARISH' else 0)
                regime = result.get('regime', {})
                if regime.get('regime') == 'SQUEEZE':
                    alerts.append(f'SQUEEZE: {regime["description"]}')
                elif regime.get('regime') == 'EXTREMO':
                    alerts.append(f'EXTREMO: {regime["description"]}')
                matrix[name] = {
                    'weight': w,
                    'bias': agent_bias,
                    'confidence': agent_confidence,
                    'regime': regime,
                    'max_reversal_prob': result.get('max_reversal_probability'),
                    'max_reversal_tf': result.get('max_reversal_tf'),
                }

            elif name == 'ml_predictor':
                agent_bias = result.get('ml_direction', 'NEUTRO')
                agent_confidence = result.get('ml_confidence', 50)
                agent_direction = 1 if agent_bias == 'BULLISH' else (-1 if agent_bias == 'BEARISH' else 0)
                matrix[name] = {
                    'weight': w,
                    'bias': agent_bias,
                    'confidence': agent_confidence,
                    'prob_up': result.get('prob_up'),
                    'prob_down': result.get('prob_down'),
                    'model_accuracy': result.get('model_accuracy'),
                    'features': result.get('features'),
                }

            elif name == 'session_intel':
                agent_bias = result.get('session_bias', 'NEUTRO')
                agent_confidence = result.get('confidence', 50)
                if result.get('in_kill_zone'):
                    alerts.append(f'KILL ZONE: {", ".join(kz["name"] for kz in result.get("active_kill_zones", []))}')
                    agent_direction = 0
                elif result.get('is_optimal_hour'):
                    agent_direction = 0.3
                elif result.get('is_suboptimal_hour'):
                    agent_direction = -0.3
                matrix[name] = {
                    'weight': w,
                    'bias': agent_bias,
                    'confidence': agent_confidence,
                    'in_kill_zone': result.get('in_kill_zone'),
                    'is_optimal_hour': result.get('is_optimal_hour'),
                    'recommended_strategy': result.get('recommended_strategy', {}).get('name'),
                    'active_sessions': [s['name'] for s in result.get('active_sessions', []) if s['is_active']],
                }

            if agent_direction > 0:
                weighted_bullish += w * (agent_confidence / 100) * agent_direction
            elif agent_direction < 0:
                weighted_bearish += w * (agent_confidence / 100) * abs(agent_direction)
            else:
                weighted_neutral += w * 0.5

            total_weight += w

        total_weight = total_weight or 1
        net_score = (weighted_bullish - weighted_bearish) / total_weight

        direction = 'NEUTRAL'
        confidence = 50
        if net_score > 0.15:
            if net_score > 0.4:
                direction = 'STRONG_BUY'
                confidence = min(95, 50 + net_score * 80)
            else:
                direction = 'BUY'
                confidence = min(85, 50 + net_score * 70)
        elif net_score < -0.15:
            if net_score < -0.4:
                direction = 'STRONG_SELL'
                confidence = min(95, 50 + abs(net_score) * 80)
            else:
                direction = 'SELL'
                confidence = min(85, 50 + abs(net_score) * 70)
        else:
            confidence = 50

        summary_parts: list[str] = []
        if direction in ('STRONG_BUY', 'BUY'):
            summary_parts.append(f'Vies COMPRA para {symbol} (score {net_score:+.2f}, confianca {confidence}%)')
        elif direction in ('STRONG_SELL', 'SELL'):
            summary_parts.append(f'Vies VENDA para {symbol} (score {net_score:+.2f}, confianca {confidence}%)')
        else:
            summary_parts.append(f'Vies NEUTRO para {symbol} — aguardar Setup')

        if any(m.get('volatility_alert') for m in matrix.values() if isinstance(m, dict)):
            summary_parts.append('ALTA VOLATILIDADE: Eventos macroeconomicos nas proximas horas')
        if any(m.get('in_kill_zone') for m in matrix.values() if isinstance(m, dict)):
            summary_parts.append('ATENCAO: Kill Zone ativa — cuidado com spreads e manipulacao')

        direction_map = {'STRONG_BUY': 'COMPRA FORTE', 'BUY': 'COMPRA', 'SELL': 'VENDA', 'STRONG_SELL': 'VENDA FORTE', 'NEUTRAL': 'NEUTRO'}

        return {
            'matrix': matrix,
            'direction': direction,
            'direction_label': direction_map.get(direction, 'NEUTRO'),
            'confidence': round(confidence),
            'net_score': round(net_score, 4),
            'summary': ' | '.join(summary_parts),
            'recommendations': recommendations[:5],
            'alerts': alerts[:5],
            'session_info': {
                'in_kill_zone': any(m.get('in_kill_zone') for m in matrix.values() if isinstance(m, dict)),
                'volatility_alert': any(m.get('volatility_alert') for m in matrix.values() if isinstance(m, dict)),
                'optimal_hour': any(m.get('is_optimal_hour') for m in matrix.values() if isinstance(m, dict)),
            },
        }

    def _bias_to_score(self, bias: str) -> float:
        mapping = {
            'BULLISH': 1.0, 'ATIVO_ALTA': 1.0, 'USD_QUEDA': 1.0,
            'BEARISH': -1.0, 'ATIVO_QUEDA': -1.0, 'USD_ALTA': -1.0,
            'RANGING': 0.0, 'NEUTRO': 0.0, 'CAUTELA': 0.0, 'AGUARDAR': 0.0,
        }
        return mapping.get(bias, 0.0)

    def analyze_multi(self, symbols: list[str] | None = None, force_refresh: bool = False) -> list[dict[str, Any]]:
        if symbols is None:
            symbols = SYMBOLS_DEFAULT
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as executor:
            future_map = {
                executor.submit(self.analyze_symbol, sym, force_refresh): sym
                for sym in symbols
            }
            for future in concurrent.futures.as_completed(future_map):
                sym = future_map[future]
                try:
                    results.append(future.result())
                except Exception as e:
                    results.append({
                        'symbol': sym,
                        'error': str(e),
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                    })
        results.sort(key=lambda r: r.get('final_score', 0) if 'final_score' in r else 0, reverse=True)
        return results

    def get_market_overview(self) -> dict[str, Any]:
        symbols = SYMBOLS_DEFAULT
        reports = self.analyze_multi(symbols)

        ranked = [r for r in reports if 'error' not in r and r.get('final_confidence', 0) >= 50]
        ranked.sort(
            key=lambda r: abs(r.get('decision_matrix', {}).get('net_score', 0)) * r.get('final_confidence', 0),
            reverse=True,
        )

        top_pick = ranked[0] if ranked else None

        summary_parts = [
            f'Intel Engine analisou {len(reports)} ativos',
        ]
        if top_pick:
            summary_parts.append(
                f'Top Pick: {top_pick["symbol"]} ({top_pick.get("final_direction", "NEUTRO")} '
                f'confianca {top_pick.get("final_confidence", 0)}%)'
            )
        bullish_count = sum(1 for r in reports if r.get('final_direction') in ('STRONG_BUY', 'BUY'))
        bearish_count = sum(1 for r in reports if r.get('final_direction') in ('STRONG_SELL', 'SELL'))
        neutral_count = sum(1 for r in reports if r.get('final_direction') == 'NEUTRAL')
        summary_parts.append(f'Compra: {bullish_count} | Venda: {bearish_count} | Neutro: {neutral_count}')

        alerts: list[str] = []
        for r in reports:
            for a in r.get('alerts', []):
                if a not in alerts:
                    alerts.append(a)

        return {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'total_assets': len(reports),
            'bullish_count': bullish_count,
            'bearish_count': bearish_count,
            'neutral_count': neutral_count,
            'top_pick': top_pick,
            'summary': ' | '.join(summary_parts),
            'reports': reports,
            'alerts': alerts[:10],
            'market_regime': self._market_regime(bullish_count, bearish_count, len(reports)),
        }

    def _market_regime(self, bullish: int, bearish: int, total: int) -> dict[str, Any]:
        if total == 0:
            return {'regime': 'INDETERMINADO', 'description': ''}
        ratio = (bullish - bearish) / total
        if ratio > 0.3:
            return {'regime': 'OTIMISTA', 'description': 'Maioria dos ativos com vies de alta. Risk-on.'}
        elif ratio < -0.3:
            return {'regime': 'PESSIMISTA', 'description': 'Maioria dos ativos com vies de baixa. Risk-off.'}
        elif abs(ratio) < 0.1:
            return {'regime': 'MISTO', 'description': 'Mercado sem direcao clara. Seletividade.'}
        return {'regime': 'NEUTRO', 'description': 'Mercado equilibrado entre compras e vendas.'}

    def get_weights(self) -> dict[str, float]:
        return dict(self.weights)

    def set_weight(self, agent_name: str, weight: float) -> None:
        if agent_name in self.weights:
            self.weights[agent_name] = max(0, min(0.5, weight))

    def _cache_path(self) -> str:
        path = os.path.abspath(CACHE_FILE)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def _load_cache(self) -> None:
        try:
            path = self._cache_path()
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                with self._cache_lock:
                    self.cache = data.get('cache', {})
                    self.cache_ttl = {k: float(v) for k, v in data.get('ttl', {}).items()}
                print(f'[Cache] Carregado {len(self.cache)} entradas de {path}')
        except Exception as e:
            print(f'[Cache] Erro ao carregar cache: {e}')

    def _save_cache(self) -> None:
        try:
            path = self._cache_path()
            with self._cache_lock:
                data = {
                    'cache': self.cache,
                    'ttl': self.cache_ttl,
                    'updated': datetime.now().isoformat(),
                }
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f'[Cache] Erro ao salvar cache: {e}')

    def clear_cache(self) -> None:
        self.cache.clear()
        self.cache_ttl.clear()
        try:
            path = self._cache_path()
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
