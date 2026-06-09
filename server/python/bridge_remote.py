import os, sys, json, time, threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps

API_KEY = os.environ.get('BRIDGE_API_KEY', '')
PORT = int(os.environ.get('BRIDGE_PORT', 5555))

app = Flask(__name__)
CORS(app)

# ─── Auth decorator ───────────────────────────────────────────────
def require_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('X-Api-Key', '')
        if not key or key != API_KEY:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── MT5 wrapper ──────────────────────────────────────────────────
class MT5Client:
    initialized = False
    account = {
        'balance': 0, 'equity': 0, 'margin': 0,
        'margin_free': 0, 'profit': 0, 'leverage': 100,
        'currency': 'USD', 'login': 0, 'server': '---',
        'name': 'MT5 Desktop'
    }
    positions = []
    history = []
    symbols = ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD', 'ETHUSD',
               'USDJPY', 'US30Cash', 'US100Cash', 'US500Cash',
               'GER40Cash', 'UK100', 'OIL', 'BRENT']

    def init(self):
        if self.initialized: return True
        try:
            import MetaTrader5 as mt5
            self.mt5 = mt5
            self.initialized = mt5.initialize()
            if self.initialized:
                self._sync()
                threading.Thread(target=self._poll_loop, daemon=True).start()
            return self.initialized
        except ImportError:
            print('[BRIDGE] MetaTrader5 library not installed — using simulated mode')
            self._simulate_account()
            return True
        except Exception as e:
            print(f'[BRIDGE] MT5 init error: {e}')
            self._simulate_account()
            return True

    def _simulate_account(self):
        self.account = {
            'balance': 10000.00, 'equity': 10000.00,
            'margin': 0.00, 'margin_free': 10000.00,
            'profit': 0.00, 'leverage': 100,
            'currency': 'USD', 'login': 12345,
            'server': 'DemoServer', 'name': 'Simulated Account'
        }
        self.positions = []

    def _sync(self):
        if not self.initialized or not hasattr(self, 'mt5'): return
        try:
            info = self.mt5.account_info()
            if info:
                self.account = {
                    'balance': info.balance,
                    'equity': info.equity,
                    'margin': info.margin,
                    'margin_free': info.margin_free,
                    'profit': info.profit,
                    'leverage': info.leverage,
                    'currency': info.currency or 'USD',
                    'login': info.login,
                    'server': info.server or '---',
                    'name': info.company or 'MT5',
                }
            pos = self.mt5.positions_get()
            self.positions = [{
                'ticket': p.ticket, 'symbol': p.symbol,
                'type': p.type, 'volume': p.volume,
                'price_open': p.price_open,
                'price_current': p.price_current,
                'profit': p.profit,
                'sl': p.sl, 'tp': p.tp,
                'time': p.time,
            } for p in (pos or [])]

            deals = self.mt5.history_deals_get(0, int(time.time()))
            self.history = [{
                'ticket': d.ticket, 'time': d.time,
                'type': d.type, 'symbol': d.symbol,
                'volume': d.volume, 'price': d.price,
                'profit': d.profit, 'comment': d.comment or '',
            } for d in (deals or [])][-200:]
        except Exception as e:
            print(f'[BRIDGE] Sync error: {e}')

    def _poll_loop(self):
        while True:
            time.sleep(3)
            self._sync()

    def login(self, login_id, password, server=''):
        if hasattr(self, 'mt5') and self.initialized:
            self.mt5.shutdown()
            self.initialized = False
        self.init()

    def order_send(self, order):
        if not hasattr(self, 'mt5') or not self.initialized:
            return {'success': True, 'ticket': hash(str(order)) % 1000000, 'simulated': True}
        result = self.mt5.order_send(order)
        return {'success': result.retcode == 10009,
                'ticket': result.order, 'comment': result.comment,
                'retcode': result.retcode}

    def close_order(self, ticket):
        if not hasattr(self, 'mt5') or not self.initialized:
            return {'success': True, 'simulated': True}
        pos = self.mt5.positions_get(ticket=ticket)
        if not pos: return {'success': False, 'error': 'Position not found'}
        p = pos[0]
        order = {
            'action': self.mt5.TRADE_ACTION_DEAL,
            'symbol': p.symbol,
            'volume': p.volume,
            'type': self.mt5.ORDER_TYPE_BUY if p.type == 1 else self.mt5.ORDER_TYPE_SELL,
            'position': p.ticket,
            'price': self.mt5.symbol_info_tick(p.symbol).ask if p.type == 1 else self.mt5.symbol_info_tick(p.symbol).bid,
            'deviation': 20,
            'magic': 123456,
            'comment': 'close by radar-fx',
        }
        result = self.mt5.order_send(order)
        return {'success': result.retcode == 10009, 'ticket': ticket, 'retcode': result.retcode}

mt5_client = MT5Client()

# ─── Rotas ────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
@require_key
def health():
    return jsonify({
        'status': 'connected',
        'server': mt5_client.account.get('server', '---'),
        'account': mt5_client.account.get('login', 0),
        'balance': mt5_client.account.get('balance', 0),
        'mt5_initialized': mt5_client.initialized,
    })

@app.route('/login', methods=['POST'])
@require_key
def bridge_login():
    data = request.get_json() or {}
    mt5_client.login(
        data.get('login', ''),
        data.get('password', ''),
        data.get('server', ''),
    )
    return jsonify({'success': True, 'message': 'Login OK'})

@app.route('/account', methods=['GET'])
@require_key
def account():
    return jsonify(mt5_client.account)

@app.route('/positions', methods=['GET'])
@require_key
def positions():
    return jsonify(mt5_client.positions)

@app.route('/history', methods=['GET'])
@require_key
def history():
    return jsonify(mt5_client.history)

@app.route('/symbols', methods=['GET'])
@require_key
def symbols():
    try:
        if hasattr(mt5_client, 'mt5') and mt5_client.initialized:
            syms = mt5_client.mt5.symbols_get()
            if syms:
                return jsonify([s.name for s in syms])
    except: pass
    return jsonify(mt5_client.symbols)

@app.route('/candles', methods=['GET'])
@require_key
def candles():
    symbol = request.args.get('symbol', 'XAUUSD')
    timeframe = request.args.get('timeframe', 'M1')
    count = int(request.args.get('count', 60))

    tf_map = {'M1': 1, 'M5': 5, 'M15': 15, 'M30': 30,
              'H1': 60, 'H4': 240, 'D1': 1440, 'W1': 10080}

    if hasattr(mt5_client, 'mt5') and mt5_client.initialized:
        try:
            rates = mt5_client.mt5.copy_rates_from_pos(
                symbol, tf_map.get(timeframe, 1), 0, count
            )
            if rates is not None and len(rates) > 0:
                return jsonify([{
                    'time': r.time, 'open': r.open,
                    'high': r.high, 'low': r.low,
                    'close': r.close,
                    'tick_volume': r.tick_volume,
                } for r in rates])
        except: pass

    # Fallback sintético
    now = int(time.time())
    interval = 60
    result = []
    for i in range(count):
        t = now - (count - i) * interval
        base = 2300.0 if 'XAU' in symbol else 1.08
        drift = (hash(f'{symbol}_{i}') % 100) / 1000
        result.append({
            'time': t, 'open': base + drift,
            'high': base + drift + 0.5,
            'low': base + drift - 0.3,
            'close': base + drift + 0.1,
            'tick_volume': 50,
        })
    return jsonify(result)

@app.route('/ticks', methods=['POST'])
@require_key
def ticks():
    data = request.get_json() or {}
    symbols = data.get('symbols', ['XAUUSD'])
    result = {}
    for sym in symbols:
        tick = {'symbol': sym, 'bid': 0, 'ask': 0, 'time': int(time.time())}
        if hasattr(mt5_client, 'mt5') and mt5_client.initialized:
            try:
                t = mt5_client.mt5.symbol_info_tick(sym)
                if t:
                    tick['bid'] = t.bid
                    tick['ask'] = t.ask
            except: pass
        if tick['bid'] == 0:
            tick['bid'] = 2300.0 if 'XAU' in sym else 1.0800
            tick['ask'] = tick['bid'] + 0.01
        result[sym] = tick
    return jsonify(result)

@app.route('/order', methods=['POST'])
@require_key
def order():
    data = request.get_json() or {}
    result = mt5_client.order_send(data)
    return jsonify(result)

@app.route('/close_order', methods=['POST'])
@require_key
def close_order():
    data = request.get_json() or {}
    ticket = data.get('ticket', 0)
    result = mt5_client.close_order(ticket)
    return jsonify(result)

@app.route('/update_order', methods=['POST'])
@require_key
def update_order():
    data = request.get_json() or {}
    if hasattr(mt5_client, 'mt5') and mt5_client.initialized:
        try:
            order = {
                'action': mt5_client.mt5.TRADE_ACTION_SLTP,
                'position': data.get('ticket', 0),
                'sl': data.get('sl', 0),
                'tp': data.get('tp', 0),
            }
            result = mt5_client.mt5.order_send(order)
            return jsonify({'success': result.retcode == 10009, 'retcode': result.retcode})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    return jsonify({'success': True, 'simulated': True})

@app.route('/smc_levels', methods=['GET'])
@require_key
def smc_levels():
    symbol = request.args.get('symbol', 'XAUUSD')
    return jsonify({
        'symbol': symbol,
        'market_trend': 'BULLISH',
        'tp1': 2350.00, 'tp2': 2360.00,
        'sl': 2320.00, 'bos_count': 3,
        'atr': 12.5, 'partial_level': 2340.00,
        'risk_distance': 20.0,
    })

if __name__ == '__main__':
    if not API_KEY:
        print('[BRIDGE] AVISO: BRIDGE_API_KEY não definida! Usando apenas para teste local.')
    mt5_client.init()
    print(f'[BRIDGE] MT5 Bridge rodando em :{PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=False)
