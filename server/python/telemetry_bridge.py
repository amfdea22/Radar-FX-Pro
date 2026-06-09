import json, time, os, threading
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS

TELEMETRY_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'telemetry.json')

app = Flask(__name__)
CORS(app)

telemetry_cache = {
    'timestamp': None,
    'equity': 0, 'balance': 0,
    'drawdown_aberto': 0, 'drawdown_pct': 0,
    'daily_pnl': 0,
    'ordens_ativas': [],
    'mode': 'simulated', 'connected': False,
    'xgboost_pred': 'NEUTRO', 'xgboost_confianca': 0,
}


def _poll_loop():
    while True:
        _update_from_bridge()
        _update_prediction()
        time.sleep(1)


def _update_from_bridge():
    global telemetry_cache
    try:
        import requests
        api_key = os.environ.get('BRIDGE_API_KEY', '')
        headers = {'X-Api-Key': api_key} if api_key else {}
        account = requests.get('http://localhost:5555/account', headers=headers, timeout=2)
        positions = requests.get('http://localhost:5555/positions', headers=headers, timeout=2)
        if account.status_code == 200:
            acc = account.json()
            pos = positions.json() if positions.status_code == 200 else []
            equity = float(acc.get('equity', 0))
            balance = float(acc.get('balance', 0))
            drawdown_aberto = max(0, balance - equity)
            drawdown_pct = (drawdown_aberto / balance * 100) if balance > 0 else 0
            ordens = [{
                'ativo': p.get('symbol', '?'),
                'tipo': 'BUY' if p.get('type') == 0 else 'SELL',
                'volume': p.get('volume', 0),
                'lucro': round(p.get('profit', 0), 2),
                'preco_abertura': p.get('price_open', 0),
                'preco_atual': p.get('price_current', 0),
            } for p in (pos if isinstance(pos, list) else [])]
            telemetry_cache.update({
                'timestamp': datetime.now().strftime('%H:%M:%S'),
                'equity': round(equity, 2),
                'balance': round(balance, 2),
                'drawdown_aberto': round(drawdown_aberto, 2),
                'drawdown_pct': round(max(0, drawdown_pct), 2),
                'daily_pnl': round(equity - balance, 2),
                'ordens_ativas': ordens,
                'connected': True, 'mode': 'live',
            })
        else:
            _simulate()
    except Exception:
        _simulate()


def _simulate():
    global telemetry_cache
    t = datetime.now().isoformat()
    eq = 10000.0 + (hash(t) % 200) - 100
    telemetry_cache.update({
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'equity': round(eq, 2), 'balance': 10000.0,
        'drawdown_aberto': 0.0, 'drawdown_pct': 0.0,
        'daily_pnl': 0.0, 'ordens_ativas': [],
        'connected': False, 'mode': 'simulated',
    })


def _update_prediction():
    global telemetry_cache
    try:
        import requests
        r = requests.post(
            'http://localhost:5004/api/intel-engine/analyze',
            json={'symbol': 'XAUUSD', 'force_refresh': False},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            agent = data.get('agent_results', {}).get('ml_predictor', {})
            if agent and 'ml_direction' in agent:
                telemetry_cache['xgboost_pred'] = agent['ml_direction']
                telemetry_cache['xgboost_confianca'] = agent.get('ml_confidence', 0)
    except Exception:
        pass


@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    return jsonify(telemetry_cache)


@app.route('/api/telemetry/status', methods=['GET'])
def telemetry_status():
    return jsonify({
        'service': 'Telemetry Bridge',
        'connected': telemetry_cache.get('connected', False),
        'mode': telemetry_cache.get('mode', 'simulated'),
        'last_update': telemetry_cache.get('timestamp'),
        'positions_count': len(telemetry_cache.get('ordens_ativas', [])),
        'xgboost_pred': telemetry_cache.get('xgboost_pred'),
        'xgboost_confianca': telemetry_cache.get('xgboost_confianca'),
    })


if __name__ == '__main__':
    port = int(os.environ.get('TELEMETRY_PORT', 5006))
    threading.Thread(target=_poll_loop, daemon=True).start()
    print(f'[Telemetry] Rodando em :{port}')
    app.run(host='0.0.0.0', port=port, debug=False)
