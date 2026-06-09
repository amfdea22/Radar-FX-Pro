import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

from .orchestrator import IntelOrchestrator, SYMBOLS_DEFAULT

app = Flask(__name__)
CORS(app)

orchestrator = IntelOrchestrator()
START_TIME = datetime.now(timezone.utc)


@app.route('/api/intel-engine/status', methods=['GET'])
def status():
    return jsonify({
        'service': 'Radar FX Intel Engine',
        'version': '1.0.0',
        'status': 'running',
        'uptime': (datetime.now(timezone.utc) - START_TIME).total_seconds(),
        'agents': list(orchestrator.agents.keys()),
        'weights': orchestrator.get_weights(),
        'cache_size': len(orchestrator.cache),
    })


@app.route('/api/intel-engine/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json(silent=True) or {}
        symbol = (data.get('symbol') or 'XAUUSD').upper()
        force_refresh = data.get('force_refresh', False)
        result = orchestrator.analyze_symbol(symbol, force_refresh=force_refresh)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/agent/<agent_name>', methods=['POST'])
def analyze_agent(agent_name: str):
    try:
        data = request.get_json(silent=True) or {}
        symbol = (data.get('symbol') or 'XAUUSD').upper()

        if agent_name not in orchestrator.agents:
            return jsonify({'error': f'Unknown agent: {agent_name}. Available: {list(orchestrator.agents.keys())}'}), 400

        agent = orchestrator.agents[agent_name]
        result = agent.analyze(symbol)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/multi-asset', methods=['POST'])
def multi_asset():
    try:
        data = request.get_json(silent=True) or {}
        symbols = data.get('symbols', SYMBOLS_DEFAULT)
        force_refresh = data.get('force_refresh', False)
        if isinstance(symbols, str):
            symbols = [s.strip().upper() for s in symbols.split(',')]
        else:
            symbols = [s.upper() for s in symbols]
        results = orchestrator.analyze_multi(symbols, force_refresh=force_refresh)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/market-overview', methods=['GET'])
def market_overview():
    try:
        overview = orchestrator.get_market_overview()
        return jsonify(overview)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/weights', methods=['GET', 'POST'])
def weights():
    if request.method == 'GET':
        return jsonify(orchestrator.get_weights())
    try:
        data = request.get_json(silent=True) or {}
        for agent_name, weight in data.items():
            orchestrator.set_weight(agent_name, weight)
        return jsonify({'status': 'ok', 'weights': orchestrator.get_weights()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/cache/clear', methods=['POST'])
def clear_cache():
    old_size = len(orchestrator.cache)
    orchestrator.clear_cache()
    return jsonify({'status': 'ok', 'cleared': old_size})


@app.route('/api/intel-engine/health', methods=['GET'])
def health():
    return jsonify({
        'service': 'Intel Engine',
        'status': 'healthy',
        'agents_loaded': len(orchestrator.agents),
        'cache_entries': len(orchestrator.cache),
        'uptime_seconds': (datetime.now(timezone.utc) - START_TIME).total_seconds(),
    })


@app.route('/api/intel-engine/risk-guardian/analyze', methods=['POST'])
def risk_guardian_analyze():
    try:
        data = request.get_json(silent=True) or {}
        symbol = (data.get('symbol') or 'XAUUSD').upper()
        result = orchestrator.risk_guardian.analyze(symbol)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/risk-guardian/status', methods=['GET'])
def risk_guardian_status():
    try:
        g = orchestrator.risk_guardian.guardian
        symbol = request.args.get('symbol', '')
        return jsonify(g.get_status(symbol))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/risk-guardian/backtest', methods=['POST'])
def risk_guardian_backtest():
    try:
        from .backtest_risk_guardian import run_validation
        result = run_validation()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intel-engine/risk-guardian/configure', methods=['POST'])
def risk_guardian_configure():
    try:
        data = request.get_json(silent=True) or {}
        balance = data.get('account_balance')
        prop_firm = data.get('prop_firm')
        risk_pct = data.get('risk_per_trade')
        g = orchestrator.risk_guardian.guardian
        if balance is not None:
            g.equity.initial_balance = float(balance)
            g.lot.account_balance = float(balance)
        if prop_firm:
            g.equity.prop_firm = prop_firm.upper()
            from .risk_guardian import PROP_FIRM_LIMITS
            g.equity.limits = PROP_FIRM_LIMITS.get(prop_firm.upper(), PROP_FIRM_LIMITS['DEFAULT'])
        if risk_pct is not None:
            g.lot.risk_per_trade = float(risk_pct) / 100
        return jsonify({
            'status': 'ok',
            'account_balance': g.equity.initial_balance,
            'prop_firm': g.equity.prop_firm,
            'risk_per_trade': g.lot.risk_per_trade * 100,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def create_app():
    return app


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5004
    print(f'[Intel Engine] Starting on port {port}')
    print(f'[Intel Engine] Agents: {list(orchestrator.agents.keys())}')
    print(f'[Intel Engine] Weights: {orchestrator.get_weights()}')
    app.run(host='0.0.0.0', port=port, debug=False)
