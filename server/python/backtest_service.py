import os
import json
import uuid
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from backtest_engine import run_backtest, STRATEGY_MAP
from instruments import INSTRUMENTS, TIMEFRAME_MAP
from data_fetcher import fetch_historical_data, fetch_from_mt5, fetch_from_polygon, fetch_from_litefinance

app = Flask(__name__)
CORS(app)

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'backtests')
os.makedirs(RESULTS_DIR, exist_ok=True)

jobs: dict = {}


def load_history():
    history_path = os.path.join(RESULTS_DIR, '_history.json')
    if os.path.exists(history_path):
        with open(history_path, 'r') as f:
            return json.load(f)
    return []


def save_to_history(entry: dict):
    history = load_history()
    entry['id'] = str(uuid.uuid4())[:8]
    entry['timestamp'] = datetime.now().isoformat()
    history.insert(0, entry)
    history = history[:50]
    history_path = os.path.join(RESULTS_DIR, '_history.json')
    with open(history_path, 'w') as f:
        json.dump(history, f, indent=2, default=str)
    return entry


def _run_backtest_thread(job_id: str, csv_path: str, config: dict):
    try:
        df = pd.read_csv(csv_path, parse_dates=True, index_col=0)
        if 'time' in df.columns:
            df['time'] = pd.to_datetime(df['time'])
            df = df.set_index('time')
        result = run_backtest(df, config)
        result['job_id'] = job_id
        result['status'] = 'completed'
        result['config'] = config
        result['data_source_actual'] = config.get('_data_source_actual', 'unknown')
        result['timestamp'] = datetime.now().isoformat()
        save_to_history(result)
        jobs[job_id] = result
    except Exception as e:
        import traceback
        jobs[job_id] = {'status': 'error', 'error': str(e), 'traceback': traceback.format_exc(), 'job_id': job_id}
    finally:
        if os.path.exists(csv_path):
            os.remove(csv_path)


@app.route('/api/backtest/run', methods=['POST'])
def run():
    config = request.get_json() or {}
    csv_file_path = None
    if 'file' in request.files:
        csv_file = request.files['file']
        csv_file_path = os.path.join(RESULTS_DIR, f'_input_{uuid.uuid4().hex}.csv')
        csv_file.save(csv_file_path)
    elif config.get('symbol') and config.get('timeframe'):
        try:
            symbol = config.get('symbol', 'EURUSD')
            timeframe = config.get('timeframe', '1h')
            periods = config.get('periods', 500)
            data_source = config.get('data_source', 'auto')
            allow_synthetic = config.get('allow_synthetic', True)
            date_from = config.get('date_from')
            date_to = config.get('date_to')

            # Calculate minimum bars based on date range
            if date_from and date_to:
                days_diff = (pd.Timestamp(date_to) - pd.Timestamp(date_from)).days + 1
                freq_min = TIMEFRAME_MAP.get(timeframe, 60)
                bars_per_day = max(1, 1440 // freq_min)
                min_bars_needed = days_diff * bars_per_day
                periods = max(periods, min_bars_needed + 100)
                periods = min(periods, 10000)

            result = fetch_historical_data(symbol, timeframe, periods, data_source, allow_synthetic=allow_synthetic, date_from=date_from, date_to=date_to)
            df = result['dataframe']
            data_source_actual = result['source_actual']
            print(f"[BACKTEST] Fonte: {data_source_actual}, barras obtidas: {len(df)}, solicitadas: {periods}")

            if date_from or date_to:
                if date_from:
                    df = df[df.index >= pd.Timestamp(date_from)]
                if date_to:
                    df = df[df.index <= pd.Timestamp(date_to) + pd.Timedelta(days=1)]
                if len(df) < 10:
                    return jsonify({'error': f'Apenas {len(df)} barras no período selecionado (fonte: {data_source_actual}). O período pode estar além do histórico disponível ou a fonte de dados pode estar limitada. Tente um período mais recente ou ative dados sintéticos.'}), 400

            if len(df) < 50:
                print(f"[BACKTEST] AVISO: Apenas {len(df)} barras ({data_source_actual}). Resultado pode ser impreciso.")

            config['_data_source_actual'] = data_source_actual
            config['_synthetic_used'] = result['is_synthetic']
            csv_file_path = os.path.join(RESULTS_DIR, f'_input_{uuid.uuid4().hex}.csv')
            df.to_csv(csv_file_path)
        except Exception as e:
            return jsonify({'error': f'Falha ao obter dados: {str(e)}'}), 400

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {'status': 'running', 'job_id': job_id}
    thread = threading.Thread(target=_run_backtest_thread, args=(job_id, csv_file_path, config))
    thread.daemon = True
    thread.start()
    return jsonify({'job_id': job_id, 'status': 'running'})


@app.route('/api/backtest/status/<job_id>', methods=['GET'])
def status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job não encontrado'}), 404
    return jsonify(job)


@app.route('/api/backtest/history', methods=['GET'])
def history():
    return jsonify(load_history())


@app.route('/api/backtest/strategies', methods=['GET'])
def strategies():
    return jsonify([
        {'id': 'smc', 'name': 'Smart Money Concepts', 'description': 'FVG + Order Blocks + Score de Entrada (SMA/RSI/MACD/BB)', 'engines': ['AlphaRobot', 'SharkBot', 'GoldScalper']},
        {'id': 'trend', 'name': 'Trend Following', 'description': 'Cruzamento de Médias Móveis com ATR trailing', 'engines': ['SwingTrader']},
        {'id': 'gold_scalper', 'name': 'Gold Scalper Grid', 'description': 'Grid inteligente com trailing, MA200, RSI e ATR para XAUUSD', 'engines': ['GoldScalper']},
        {'id': 'shark_bot', 'name': 'SharkBot FVG', 'description': 'Fair Value Gap com partial close e breakeven', 'engines': ['SharkBot']},
        {'id': 'bitcoin_pro', 'name': 'BitcoinPro EMA', 'description': 'EMA 50/200 crossover com score de entrada (ATR/RSI)', 'engines': ['BitcoinPro']},
        {'id': 'xgboost', 'name': 'XGBoost Preditivo', 'description': 'Predição ML com features técnicas (fallback SMC)', 'engines': []},
        {'id': 'wolf_bot', 'name': 'Wolf Bot SMC+Wyckoff', 'description': 'Custom Swings + FVG 50% + Scale-Out (60/40) + BE+Custos. Sinergia Wyckoff Spring/UTAD + Liquidity Sweep + CHoCH', 'engines': ['WolfBot']},
    ])


@app.route('/api/backtest/instruments', methods=['GET'])
def instruments():
    category = request.args.get('category')
    result = {}
    for sym, data in INSTRUMENTS.items():
        if category and data['category'] != category:
            continue
        result[sym] = data
    return jsonify(result)


@app.route('/api/backtest/instruments/<symbol>', methods=['GET'])
def instrument_detail(symbol):
    from instruments import get_instrument
    inst = get_instrument(symbol)
    if not inst:
        return jsonify({'error': 'Instrumento não encontrado'}), 404
    return jsonify(inst)


@app.route('/api/backtest/data/fetch', methods=['POST'])
def data_fetch():
    body = request.get_json() or {}
    symbol = body.get('symbol', 'EURUSD')
    timeframe = body.get('timeframe', '1h')
    bars = body.get('bars', 500)
    source = body.get('source', 'auto')

    if not symbol or not timeframe:
        return jsonify({'error': 'symbol e timeframe são obrigatórios'}), 400
    if timeframe not in TIMEFRAME_MAP:
        return jsonify({'error': f'Timeframe inválido. Use: {", ".join(TIMEFRAME_MAP.keys())}'}), 400
    if source not in ('auto', 'mt5', 'polygon', 'litefinance'):
        return jsonify({'error': 'source deve ser auto, mt5, polygon, ou litefinance'}), 400

    try:
        allow_synthetic = body.get('allow_synthetic', True)
        date_from = body.get('date_from')
        date_to = body.get('date_to')
        result = fetch_historical_data(symbol, timeframe, bars, source, allow_synthetic=allow_synthetic, date_from=date_from, date_to=date_to)
        df = result['dataframe']
        if df is None or len(df) == 0:
            return jsonify({'error': 'Nenhum dado encontrado para o símbolo/timeframe'}), 404
        if date_from:
            df = df[df.index >= pd.Timestamp(date_from)]
        if date_to:
            df = df[df.index <= pd.Timestamp(date_to) + pd.Timedelta(days=1)]
        if len(df) == 0:
            return jsonify({'error': 'Nenhum dado no período selecionado'}), 404
        csv_path = os.path.join(RESULTS_DIR, f'_data_{uuid.uuid4().hex}.csv')
        df.to_csv(csv_path)
        rows = []
        for idx, row in df.iterrows():
            rows.append({
                'time': idx.isoformat() if hasattr(idx, 'isoformat') else str(idx),
                'open': round(float(row.get('open', 0)), 5),
                'high': round(float(row.get('high', 0)), 5),
                'low': round(float(row.get('low', 0)), 5),
                'close': round(float(row.get('close', 0)), 5),
                'volume': float(row.get('volume', 0)),
            })
        return jsonify({
            'symbol': symbol,
            'timeframe': timeframe,
            'bars': len(rows),
            'source': result['source_actual'],
            'is_synthetic': result['is_synthetic'],
            'data': rows,
            'csv_path': csv_path,
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/backtest/data/sources', methods=['GET'])
def data_sources():
    return jsonify([
        {'id': 'auto', 'name': 'Automático', 'description': 'Tenta MT5 → Polygon → LiteFinance → Sintético'},
        {'id': 'mt5', 'name': 'MT5 Bridge', 'description': 'Dados do MetaTrader 5 local (porta 5555)'},
        {'id': 'polygon', 'name': 'Polygon.io', 'description': 'Dados institucionais Polygon.io (requer API Key)'},
        {'id': 'litefinance', 'name': 'LiteFinance', 'description': 'Dados públicos LiteFinance (forex, indices, crypto)'},
    ])


@app.route('/api/backtest/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'backtest-engine', 'strategies': list(STRATEGY_MAP.keys())})


# ─── MINERAÇÃO DE ESTRATÉGIA ────────────────────────────────────────────────

from strategy_mining import run_wfa, run_monte_carlo, run_mining_metrics, generate_charts


def _normalize_trades_for_mining(trades):
    normalized = []
    for t in trades:
        profit = t.get('profit') or t.get('pnl') or 0
        if isinstance(profit, str):
            profit = float(profit.replace(',', '.'))
        result = t.get('result')
        if not result:
            result = 'WIN' if profit > 0 else 'LOSS'
        normalized.append({
            'profit': profit,
            'result': result,
            'entryTime': t.get('entryTime') or t.get('entry_time') or 0,
        })
    return normalized


@app.route('/api/backtest/mining/metrics', methods=['POST'])
def mining_metrics():
    data = request.get_json(silent=True) or {}
    trades = _normalize_trades_for_mining(data.get('trades', []))
    result = run_mining_metrics(trades)
    return jsonify(result)


@app.route('/api/backtest/mining/wfa', methods=['POST'])
def mining_wfa():
    data = request.get_json(silent=True) or {}
    trades = _normalize_trades_for_mining(data.get('trades', []))
    segments = int(data.get('segments', 4))
    result = run_wfa(trades, segments)
    return jsonify(result)


@app.route('/api/backtest/mining/charts', methods=['POST'])
def mining_charts():
    data = request.get_json(silent=True) or {}
    trades = _normalize_trades_for_mining(data.get('trades', []))
    result = generate_charts(trades)
    return jsonify(result)


@app.route('/api/backtest/mining/monte-carlo', methods=['POST'])
def mining_monte_carlo():
    data = request.get_json(silent=True) or {}
    trades = _normalize_trades_for_mining(data.get('trades', []))
    trials = int(data.get('trials', 1000))
    confidence = float(data.get('confidence', 0.95))
    result = run_monte_carlo(trades, trials, confidence)
    return jsonify(result)


if __name__ == '__main__':
    port = int(os.environ.get('BACKTEST_PORT', 5003))
    print(f'Backtest Engine rodando na porta {port}')
    app.run(host='0.0.0.0', port=port, debug=False)
