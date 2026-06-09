from datetime import datetime, timezone, timedelta
from typing import Any

SESSION_CONFIG = {
    'asia': {
        'name': 'Sessao Asiatica',
        'name_en': 'Asian Session',
        'open_utc': 0, 'close_utc': 9,
        'open_label': '00:00 UTC', 'close_label': '09:00 UTC',
        'strategy': 'MEAN_REVERSION',
        'strategy_label': 'Retorno a Media / Consolidacao',
        'relative_volume': 'MEDIO',
        'description': 'Baixa volatilidade, movimentos de consolidacao. Ideal para scalping em pares JPY, AUD, NZD.',
    },
    'london': {
        'name': 'Sessao Londres',
        'name_en': 'London Session',
        'open_utc': 7, 'close_utc': 16,
        'open_label': '07:00 UTC', 'close_label': '16:00 UTC',
        'strategy': 'BREAKOUT',
        'strategy_label': 'Breakout / Rompimento',
        'relative_volume': 'ALTO',
        'description': 'Alta liquidez nos pares EUR, GBP. Inicio do verdadeiro volume europeu.',
    },
    'ny': {
        'name': 'Sessao Nova York',
        'name_en': 'New York Session',
        'open_utc': 12, 'close_utc': 21,
        'open_label': '12:00 UTC', 'close_label': '21:00 UTC',
        'strategy': 'BREAKOUT',
        'strategy_label': 'Breakout / Rompimento',
        'relative_volume': 'MUITO_ALTO',
        'description': 'Maior liquidez do dia. Sobreposicao com Londres (12-16 UTC) gera os maiores movimentos.',
    },
    'london_ny_overlap': {
        'name': 'Sobreposicao Londres-NY',
        'name_en': 'London-NY Overlap',
        'open_utc': 12, 'close_utc': 16,
        'open_label': '12:00 UTC', 'close_label': '16:00 UTC',
        'strategy': 'MOMENTUM',
        'strategy_label': 'Momentum / Rompimento Agressivo',
        'relative_volume': 'MAXIMO',
        'description': 'Pico de volume global. Maior probabilidade de movimentos direcionais fortes.',
    },
    'asia_london_overlap': {
        'name': 'Sobreposicao Asia-Londres',
        'name_en': 'Asia-London Overlap',
        'open_utc': 7, 'close_utc': 9,
        'open_label': '07:00 UTC', 'close_label': '09:00 UTC',
        'strategy': 'TRANSITION',
        'strategy_label': 'Transicao / Preparacao',
        'relative_volume': 'MEDIO_ALTO',
        'description': 'Transicao da Asia para Londres. Possivel aumento de volatilidade com a abertura europeia.',
    },
}

KILL_ZONES = [
    {'name': 'NY Kill Zone', 'open_utc': 12, 'close_utc': 13.5, 'label': '09:30-11:00 EST (primeiros 90 min NY)'},
    {'name': 'London Kill Zone', 'open_utc': 7, 'close_utc': 8.5, 'label': '07:00-08:30 UTC (primeiros 90 min Londres)'},
    {'name': 'Asia Kill Zone', 'open_utc': 0, 'close_utc': 1.5, 'label': '00:00-01:30 UTC (primeiros 90 min Asia)'},
]

OPTIMAL_HOURS = {
    'XAUUSD': {'best': [13, 14, 15, 8, 9], 'worst': [1, 2, 3, 4, 5], 'reason': 'Ouro acompanha sobreposicao Londres-NY'},
    'EURUSD': {'best': [12, 13, 14, 15, 7], 'worst': [1, 2, 3, 22, 23], 'reason': 'EURUSD tem maior liquidez no overlap Londres-NY'},
    'GBPUSD': {'best': [12, 13, 14, 15, 7], 'worst': [1, 2, 3, 22, 23], 'reason': 'Cable segue horario de Londres e NY'},
    'USDJPY': {'best': [0, 1, 2, 7, 8], 'worst': [16, 17, 18, 19, 20], 'reason': 'JPY tem maior liquidez na Asia e inicio de Londres'},
    'BTCUSD': {'best': [12, 13, 14, 15, 16], 'worst': [4, 5, 6, 7, 8], 'reason': 'BTC opera 24/7 mas tem maior volume em NY'},
    'ETHUSD': {'best': [12, 13, 14, 15, 16], 'worst': [4, 5, 6, 7, 8], 'reason': 'ETH segue padrao similar ao BTC'},
    'AUDUSD': {'best': [0, 1, 2, 7, 8], 'worst': [16, 17, 18, 19, 20], 'reason': 'AUD tem maior liquidez durante Asia'},
    'NZDUSD': {'best': [0, 1, 2, 7, 8], 'worst': [16, 17, 18, 19, 20], 'reason': 'NZD segue horario da Asia/Pacifico'},
    'USDCAD': {'best': [12, 13, 14, 15, 16], 'worst': [0, 1, 2, 3, 4], 'reason': 'CAD tem maior volume em NY'},
    'US30': {'best': [12, 13, 14, 15, 16], 'worst': [22, 23, 0, 1, 2], 'reason': 'Indices seguem horario de NY'},
    'SP500': {'best': [12, 13, 14, 15, 16], 'worst': [22, 23, 0, 1, 2], 'reason': 'Indices seguem horario de NY'},
    'NAS100': {'best': [12, 13, 14, 15, 16], 'worst': [22, 23, 0, 1, 2], 'reason': 'Indices seguem horario de NY'},
}

SESSION_STRATEGY_MAP: dict[str, dict[str, Any]] = {
    'MEAN_REVERSION': {
        'name': 'Retorno a Media',
        'indicators': ['RSI', 'Bollinger Bands', 'Z-Score'],
        'risk_level': 'BAIXO',
        'best_for': 'Sessoes de baixa liquidez (Asia, finais de sessao)',
    },
    'BREAKOUT': {
        'name': 'Breakout de Rompimento',
        'indicators': ['ATR', 'Volume', 'Suporte/Resistencia'],
        'risk_level': 'MEDIO',
        'best_for': 'Abertura de sessoes principais (Londres, NY)',
    },
    'MOMENTUM': {
        'name': 'Momentum',
        'indicators': ['MACD', 'Forca de Tendencia', 'Order Flow'],
        'risk_level': 'ALTO',
        'best_for': 'Sobreposicao Londres-NY, noticias de alto impacto',
    },
    'TRANSITION': {
        'name': 'Transicao',
        'indicators': ['Volume Profile', 'Estresse de Volatilidade'],
        'risk_level': 'MEDIO',
        'best_for': 'Periodos entre sessoes, preparacao para breakouts',
    },
}


class SessionAgent:
    name = 'session_intel'
    display_name = 'Session Intelligence Agent'
    weight = 0.15

    def analyze(self, symbol: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        current_hour_utc = now.hour + now.minute / 60.0

        active_sessions: list[dict[str, Any]] = []
        for key, s_cfg in SESSION_CONFIG.items():
            open_h = s_cfg['open_utc']
            close_h = s_cfg['close_utc']
            is_active = False
            if open_h <= close_h:
                if open_h <= current_hour_utc < close_h:
                    is_active = True
            else:
                if current_hour_utc >= open_h or current_hour_utc < close_h:
                    is_active = True
            active_sessions.append({
                'key': key,
                **s_cfg,
                'is_active': is_active,
                'time_until_open': self._time_until(current_hour_utc, open_h),
                'time_until_close': self._time_until(current_hour_utc, close_h),
            })

        in_kill_zone = False
        active_kill_zones: list[dict[str, Any]] = []
        for kz in KILL_ZONES:
            if kz['open_utc'] <= current_hour_utc < kz['close_utc']:
                in_kill_zone = True
                active_kill_zones.append(kz)

        session_bias = 'NEUTRO'
        session_confidence = 50
        recommended_strategy = SESSION_STRATEGY_MAP['MEAN_REVERSION']
        reasoning: list[str] = []

        active_high_volume = [s for s in active_sessions if s['is_active'] and s['relative_volume'] in ('ALTO', 'MUITO_ALTO', 'MAXIMO')]
        active_low_volume = [s for s in active_sessions if s['is_active'] and s['relative_volume'] in ('BAIXO', 'MEDIO')]

        if active_high_volume:
            primary = active_high_volume[0]
            session_bias = 'ALTA_VOLATILIDADE'
            session_confidence = 80
            recommended_strategy = SESSION_STRATEGY_MAP.get(primary['strategy'], SESSION_STRATEGY_MAP['BREAKOUT'])
            reasoning.append(f'{primary["name"]} ativa — {primary["relative_volume"]}')
            strategy_label = SESSION_STRATEGY_MAP.get(primary['strategy'], {})
            reasoning.append(f'Estrategia recomendada: {strategy_label.get("name", "Breakout")}')

        if in_kill_zone:
            session_bias = 'KILL_ZONE_ATIVA'
            session_confidence = 85
            for kz in active_kill_zones:
                reasoning.append(f'{kz["name"]} ativa — {kz["label"]}')
            reasoning.append('ATENCAO: Alta manipulacao de preco nos primeiros minutos. Evitar entradas emocionais.')
            if any(s['is_active'] and s['relative_volume'] == 'MAXIMO' for s in active_sessions):
                recommended_strategy = SESSION_STRATEGY_MAP['MOMENTUM']
                reasoning.append('Sobreposicao Londres-NY + Kill Zone: estrategia de Momentum')

        if not active_high_volume and not in_kill_zone:
            if active_low_volume:
                primary = active_low_volume[0]
                session_bias = 'BAIXA_VOLATILIDADE'
                session_confidence = 65
                reasoning.append(f'{primary["name"]} — baixa liquidez esperada')
                strategy_label = SESSION_STRATEGY_MAP.get(primary['strategy'], SESSION_STRATEGY_MAP['MEAN_REVERSION'])
                reasoning.append(f'Estrategia recomendada: {strategy_label.get("name", "Retorno a Media")}')
                recommended_strategy = SESSION_STRATEGY_MAP.get(primary['strategy'], SESSION_STRATEGY_MAP['MEAN_REVERSION'])
            else:
                session_bias = 'ENTRE_SESSOES'
                session_confidence = 40
                reasoning.append('Entre sessoes principais — liquidez reduzida')
                recommended_strategy = SESSION_STRATEGY_MAP['TRANSITION']

        optimal_hours = OPTIMAL_HOURS.get(symbol.upper(), {
            'best': [12, 13, 14, 15, 16], 'worst': [0, 1, 2, 3, 4],
            'reason': 'Horario otimo generico (seguindo NY)',
        })
        is_optimal = int(current_hour_utc) in optimal_hours['best']
        is_suboptimal = int(current_hour_utc) in optimal_hours['worst']

        return {
            'agent': self.name,
            'weight': self.weight,
            'timestamp': now.isoformat(),
            'symbol': symbol,
            'current_utc_hour': round(current_hour_utc, 2),
            'current_time': now.strftime('%H:%M UTC'),
            'session_bias': session_bias,
            'confidence': session_confidence,
            'active_sessions': active_sessions,
            'in_kill_zone': in_kill_zone,
            'active_kill_zones': active_kill_zones,
            'recommended_strategy': recommended_strategy,
            'is_optimal_hour': is_optimal,
            'is_suboptimal_hour': is_suboptimal,
            'optimal_hours': optimal_hours,
            'reasoning': reasoning,
            'next_session_open': self._next_session(active_sessions),
        }

    def _time_until(self, current: float, target: float) -> float:
        if target > current:
            return target - current
        return (24 - current) + target

    def _next_session(self, sessions: list[dict]) -> dict | None:
        upcoming = [s for s in sessions if not s['is_active']]
        if upcoming:
            upcoming.sort(key=lambda x: x['time_until_open'])
            return upcoming[0]
        return None

    def analyze_multi(self, symbols: list[str]) -> dict[str, Any]:
        results = {}
        for sym in symbols:
            try:
                results[sym] = self.analyze(sym)
            except Exception as e:
                results[sym] = {'error': str(e)}
        return {'agent': self.name, 'results': results}
