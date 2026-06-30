import MetaTrader5 as mt5
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import pandas as pd
# import pandas_ta as ta
import numpy as np
import json

# ─── Smart Money Concept (SMC) Utilities ─────────────────────────────────────

def detect_order_blocks(df, lookback=60):
    """Detecta Order Blocks de alta e baixa nos últimos `lookback` candles."""
    obs = {'bullish': [], 'bearish': []}
    if len(df) < 5:
        return obs
    src = df.iloc[-lookback:]
    for i in range(2, len(src) - 1):
        prev, curr, nxt = src.iloc[i - 1], src.iloc[i], src.iloc[i + 1]
        # Bearish OB: candle bearish forte (close < open) após um movimento de alta
        if curr['close'] < curr['open'] and prev['close'] > prev['open']:
            body_ratio = abs(curr['close'] - curr['open']) / (curr['high'] - curr['low'] + 0.001)
            move = abs(curr['close'] - prev['close']) / (prev['close'] + 0.001)
            if body_ratio > 0.5 and move > 0.001:
                ts = curr.get('time', i)
                try: ts = int(ts.timestamp())
                except: pass
                obs['bearish'].append({'price': curr['low'], 'high': curr['high'], 'low': curr['low'],
                                       'time': ts, 'strength': round(body_ratio * move * 100, 1)})
        # Bullish OB: candle bullish forte (close > open) após um movimento de baixa
        if curr['close'] > curr['open'] and prev['close'] < prev['open']:
            body_ratio = abs(curr['close'] - curr['open']) / (curr['high'] - curr['low'] + 0.001)
            move = abs(curr['close'] - prev['close']) / (prev['close'] + 0.001)
            if body_ratio > 0.5 and move > 0.001:
                ts = curr.get('time', i)
                try: ts = int(ts.timestamp())
                except: pass
                obs['bullish'].append({'price': curr['high'], 'high': curr['high'], 'low': curr['low'],
                                       'time': ts, 'strength': round(body_ratio * move * 100, 1)})
    # Ordenar por força e manter top 5
    obs['bullish'] = sorted(obs['bullish'], key=lambda x: x['strength'], reverse=True)[:5]
    obs['bearish'] = sorted(obs['bearish'], key=lambda x: x['strength'], reverse=True)[:5]
    return obs

def detect_fvg(df, lookback=60):
    """Detecta Fair Value Gaps (FVG) — gap entre o candle anterior e o posterior."""
    fvgs = {'bullish': [], 'bearish': []}
    if len(df) < 3:
        return fvgs
    src = df.iloc[-lookback:]
    for i in range(1, len(src) - 1):
        prev, curr, nxt = src.iloc[i - 1], src.iloc[i], src.iloc[i + 1]
        # Bullish FVG: gap entre low do candle anterior e high do posterior
        if nxt['high'] < prev['low']:
            gap_size = prev['low'] - nxt['high']
            gap_pct = gap_size / (prev['low'] + 0.001) * 100
            if gap_pct > 0.005:
                ts = curr.get('time', i)
                try: ts = int(ts.timestamp())
                except: pass
                fvgs['bullish'].append({'top': prev['low'], 'bottom': nxt['high'],
                                        'mid': (prev['low'] + nxt['high']) / 2,
                                        'size': round(gap_pct, 3),
                                        'time': ts})
        # Bearish FVG: gap entre high do candle anterior e low do posterior
        if nxt['low'] > prev['high']:
            gap_size = nxt['low'] - prev['high']
            gap_pct = gap_size / (prev['high'] + 0.001) * 100
            if gap_pct > 0.005:
                ts = curr.get('time', i)
                try: ts = int(ts.timestamp())
                except: pass
                fvgs['bearish'].append({'top': nxt['low'], 'bottom': prev['high'],
                                        'mid': (nxt['low'] + prev['high']) / 2,
                                        'size': round(gap_pct, 3),
                                        'time': ts})
    fvgs['bullish'] = sorted(fvgs['bullish'], key=lambda x: x['size'], reverse=True)[:5]
    fvgs['bearish'] = sorted(fvgs['bearish'], key=lambda x: x['size'], reverse=True)[:5]
    return fvgs

def detect_liquidity_levels(df, lookback=80):
    """Detecta níveis de liquidez — swing highs/lows recentes."""
    levels = {'highs': [], 'lows': []}
    if len(df) < 5:
        return levels
    src = df.iloc[-lookback:]
    for i in range(2, len(src) - 2):
        if (src.iloc[i]['high'] > src.iloc[i - 1]['high'] and
            src.iloc[i]['high'] > src.iloc[i - 2]['high'] and
            src.iloc[i]['high'] > src.iloc[i + 1]['high'] and
            src.iloc[i]['high'] > src.iloc[i + 2]['high']):
            levels['highs'].append({'price': src.iloc[i]['high'], 'time': i, 'type': 'SWING_HIGH'})
        if (src.iloc[i]['low'] < src.iloc[i - 1]['low'] and
            src.iloc[i]['low'] < src.iloc[i - 2]['low'] and
            src.iloc[i]['low'] < src.iloc[i + 1]['low'] and
            src.iloc[i]['low'] < src.iloc[i + 2]['low']):
            levels['lows'].append({'price': src.iloc[i]['low'], 'time': i, 'type': 'SWING_LOW'})
    # Manter apenas os 3 mais próximos do preço atual
    latest = src.iloc[-1]['close']
    levels['highs'] = sorted(levels['highs'], key=lambda x: abs(x['price'] - latest))[:3]
    levels['lows'] = sorted(levels['lows'], key=lambda x: abs(x['price'] - latest))[:3]
    return levels

def detect_market_structure(df, lookback=40):
    """Detecta quebra de estrutura (BOS) e mudança de caráter (CHoCH)."""
    result = {'trend': 'NEUTRAL', 'bos': [], 'choch': []}
    if len(df) < 10:
        return result
    src = df.iloc[-lookback:]
    # Identificar micro-tendência com EMA9/EMA21
    closes = src['close'].values
    ema9 = pd.Series(closes).ewm(span=9, adjust=False).mean().values
    ema21 = pd.Series(closes).ewm(span=21, adjust=False).mean().values
    if len(ema9) > 1 and len(ema21) > 1:
        if ema9[-1] > ema21[-1] and closes[-1] > ema9[-1]:
            result['trend'] = 'BULLISH'
        elif ema9[-1] < ema21[-1] and closes[-1] < ema9[-1]:
            result['trend'] = 'BEARISH'
    # BOS: quebra de swing high/low relevante
    highs = [src.iloc[i]['high'] for i in range(len(src))]
    lows = [src.iloc[i]['low'] for i in range(len(src))]
    for i in range(3, len(src) - 1):
        if lows[i] < lows[i - 1] and lows[i] < lows[i - 2] and lows[i] < lows[i - 3]:
            if closes[i] > highs[i - 1]:
                result['bos'].append({'type': 'BULLISH_BOS', 'price': closes[i], 'time': i})
        if highs[i] > highs[i - 1] and highs[i] > highs[i - 2] and highs[i] > highs[i - 3]:
            if closes[i] < lows[i - 1]:
                result['bos'].append({'type': 'BEARISH_BOS', 'price': closes[i], 'time': i})
    result['bos'] = result['bos'][-3:]
    return result

def calculate_smc_levels(df, direction, entry_price):
    """
    Calcula TP e SL baseados em Smart Money Concepts v2 (Risco Assimétrico).
    direction: 'BUY' ou 'SELL'
    SL = mínima do OB (BUY) / máxima do OB (SELL) + buffer 0.5×ATR
    TP1 = micro-alvo que cobre o risco (1:1) ou preenchimento de FVG
    TP2 = próxima zona de liquidez (EQH/EQL)
    Retorna dict com sl, tp1, tp2, partial_level, risk_distance, e metadados SMC.
    """
    if len(df) < 10:
        return {'sl': None, 'tp1': None, 'tp2': None, 'error': 'Dados insuficientes'}

    obs = detect_order_blocks(df, lookback=80)
    fvgs = detect_fvg(df, lookback=80)
    liq = detect_liquidity_levels(df, lookback=100)
    mkt = detect_market_structure(df, lookback=60)

    # Extrair arrays completos (com high/low)
    bullish_obs_full = obs.get('bullish', [])
    bearish_obs_full = obs.get('bearish', [])
    bullish_obs_prices = [o['price'] for o in bullish_obs_full]
    bearish_obs_prices = [o['price'] for o in bearish_obs_full]
    fvg_bullish = [f['mid'] for f in fvgs.get('bullish', [])]
    fvg_bearish = [f['mid'] for f in fvgs.get('bearish', [])]
    liq_highs = [l['price'] for l in liq.get('highs', [])]
    liq_lows = [l['price'] for l in liq.get('lows', [])]

    # ATR
    atr = 0
    if len(df) > 14:
        trs = []
        for i in range(1, 15):
            tr = max(df.iloc[-i]['high'] - df.iloc[-i]['low'],
                     abs(df.iloc[-i]['high'] - df.iloc[-i - 1]['close']),
                     abs(df.iloc[-i]['low'] - df.iloc[-i - 1]['close']))
            trs.append(tr)
        atr = sum(trs) / len(trs) if trs else 0

    sl = None
    tp1 = None
    tp2 = None
    partial_level = None
    risk_distance = None

    if direction == 'BUY':
        # SL: Baseado no Order Block de alta
        # Pegar o OB bullish mais próximo abaixo do entry, usar seu low - 0.5×ATR
        valid_obs = [o for o in bullish_obs_full if o['low'] < entry_price]
        if valid_obs:
            best_ob = max(valid_obs, key=lambda x: x['low'])
            ob_low = best_ob['low']
            sl = ob_low - atr * 0.5
        elif liq_lows:
            liq_below = [l for l in liq_lows if l < entry_price]
            if liq_below:
                sl = max(liq_below) - atr * 0.5
            else:
                sl = entry_price - atr * 1.5 if atr > 0 else entry_price * 0.995
        else:
            sl = entry_price - atr * 1.5 if atr > 0 else entry_price * 0.995

        risk_distance = entry_price - sl

        # TP1: 1:1 base, inclui FVG/liquidez apenas se derem ≥0.8:1
        candidates_tp1 = [entry_price + risk_distance]
        if fvg_bearish:
            candidates_tp1 += [f for f in fvg_bearish if f > entry_price and (f - entry_price) >= risk_distance * 0.8]
        if liq_highs:
            candidates_tp1 += [h for h in liq_highs if h > entry_price and (h - entry_price) >= risk_distance * 0.8]
        above = [c for c in candidates_tp1 if c > entry_price]
        tp1 = min(above) if above else entry_price + atr * 2.0

        # Nível da parcial = TP1 (fechar 50% quando atingir)
        partial_level = tp1

        # TP2: próxima liquidez alta (EQH) + 0.5 ATR de extensão
        tp2_candidates = [h for h in liq_highs if h > (tp1 or entry_price)]
        if tp2_candidates:
            tp2 = min(tp2_candidates) + atr * 0.5
        else:
            tp2 = (tp1 or entry_price) * 1.015

    else:  # SELL
        # SL: Baseado no Order Block de baixa
        valid_obs = [o for o in bearish_obs_full if o['high'] > entry_price]
        if valid_obs:
            best_ob = min(valid_obs, key=lambda x: x['high'])
            ob_high = best_ob['high']
            sl = ob_high + atr * 0.5
        elif liq_highs:
            liq_above = [h for h in liq_highs if h > entry_price]
            if liq_above:
                sl = min(liq_above) + atr * 0.5
            else:
                sl = entry_price + atr * 1.5 if atr > 0 else entry_price * 1.005
        else:
            sl = entry_price + atr * 1.5 if atr > 0 else entry_price * 1.005

        risk_distance = sl - entry_price

        # TP1: 1:1 base, inclui FVG/liquidez apenas se derem ≥0.8:1
        candidates_tp1 = [entry_price - risk_distance]
        if fvg_bullish:
            candidates_tp1 += [f for f in fvg_bullish if f < entry_price and (entry_price - f) >= risk_distance * 0.8]
        if liq_lows:
            candidates_tp1 += [l for l in liq_lows if l < entry_price and (entry_price - l) >= risk_distance * 0.8]
        below = [c for c in candidates_tp1 if c < entry_price]
        tp1 = max(below) if below else entry_price - atr * 2.0

        # Nível da parcial = TP1
        partial_level = tp1

        # TP2: próxima liquidez baixa (EQL) - 0.5 ATR
        tp2_candidates = [l for l in liq_lows if l < (tp1 or entry_price)]
        if tp2_candidates:
            tp2 = max(tp2_candidates) - atr * 0.5
        else:
            tp2 = (tp1 or entry_price) * 0.985

    # Garantir valores mínimos
    if sl and tp1:
        min_dist = atr * 0.3 if atr > 0 else 0.5
        if direction == 'BUY':
            if sl < entry_price and entry_price - sl < min_dist:
                sl = entry_price - min_dist
            if tp1 - entry_price < min_dist:
                tp1 = entry_price + min_dist
        else:
            if sl > entry_price and sl - entry_price < min_dist:
                sl = entry_price + min_dist
            if entry_price - tp1 < min_dist:
                tp1 = entry_price - min_dist

    return {
        'sl': round(sl, 2) if sl else None,
        'tp1': round(tp1, 2) if tp1 else None,
        'tp2': round(tp2, 2) if tp2 else None,
        'partial_level': round(partial_level, 2) if partial_level else None,
        'risk_distance': round(risk_distance, 2) if risk_distance else 0,
        'atr': round(atr, 4) if atr else 0,
        'market_trend': mkt.get('trend', 'NEUTRAL'),
        'bos_count': len(mkt.get('bos', [])),
        'order_blocks': {
            'bullish': [{'price': round(o['price'], 2), 'high': round(o['high'], 2), 'low': round(o['low'], 2), 'strength': o['strength']} for o in bullish_obs_full[:2]],
            'bearish': [{'price': round(o['price'], 2), 'high': round(o['high'], 2), 'low': round(o['low'], 2), 'strength': o['strength']} for o in bearish_obs_full[:2]]
        },
        'fvg': {
            'bullish': [{'mid': round(f['mid'], 2), 'size': f['size']} for f in fvgs.get('bullish', [])[:2]],
            'bearish': [{'mid': round(f['mid'], 2), 'size': f['size']} for f in fvgs.get('bearish', [])[:2]]
        },
        'liquidity': {
            'highs': [round(l, 2) for l in liq_highs[:3]],
            'lows': [round(l, 2) for l in liq_lows[:3]]
        }
    }

app = Flask(__name__)
CORS(app) # Habilitar CORS para o backend Node
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("bridge_operations.log"),
        logging.StreamHandler()
    ]
)

# Credenciais para auto-reconexão
_last_login_credentials = {"login": None, "password": None, "server": None}

# Global initialization
if not mt5.initialize():
    logging.error("Failed to initialize MT5 at startup")
else:
    logging.info("MT5 Proxy Initialized Successfully [v1.1 - Verbose Diagnostics]")

def _try_relogin():
    """Tenta restabelecer a conexão com o broker usando credenciais armazenadas."""
    global _last_login_credentials
    creds = _last_login_credentials
    if creds["login"] and creds["password"] and creds["server"]:
        logging.info(f"Tentando re-login automático na conta {creds['login']}...")
        try:
            result = mt5.login(int(creds["login"]), password=creds["password"], server=creds["server"])
            if result:
                term_info = mt5.terminal_info()
                if term_info and term_info.connected:
                    logging.info(f"Re-login automático bem-sucedido: conta {creds['login']}")
                    return True
            logging.warning(f"Falha no re-login automático: {mt5.last_error()}")
        except Exception as e:
            logging.warning(f"Exceção no re-login automático: {e}")
    else:
        # Tenta login com o terminal (usando sessão ativa do terminal)
        try:
            acc = mt5.account_info()
            if acc and acc.login:
                result = mt5.login(acc.login)
                if result:
                    logging.info(f"Sessão MT5 restaurada para conta {acc.login} (sem senha)")
                    return True
        except Exception:
            pass
        logging.info("Nenhuma credencial armazenada para re-login automático")
    return False

def ensure_connected():
    """Garante que a conexão com o terminal está ativa antes de operações críticas."""
    if mt5.account_info() is None:
        logging.info("Conexão perdida. Tentando reinicializar...")
        if not mt5.initialize():
            return False
    
    # Verifica se o terminal está realmente conectado ao servidor de trading
    try:
        term_info = mt5.terminal_info()
        if term_info and not term_info.connected:
            logging.warning("Terminal MT5 detectado mas sem conexão com o servidor. Tentando reconexão completa...")
            mt5.shutdown()
            import time
            time.sleep(2)
            if not mt5.initialize():
                logging.error("Falha ao reinicializar MT5 após perda de conexão")
                return False
            # Tenta re-login automático com credenciais armazenadas
            if _try_relogin():
                return True
            # Verifica novamente
            term_info = mt5.terminal_info()
            if term_info and not term_info.connected:
                logging.error("Terminal MT5 reinicializado mas ainda sem conexão com o servidor")
                return False
    except Exception as e:
        logging.warning(f"Não foi possível verificar terminal_info: {e}")
    
    return mt5.account_info() is not None

def sanitize_comment(comment):
    """Sanitiza o comentário para garantir compatibilidade com MT5 (máx 30 chars, apenas ASCII)."""
    if comment is None:
        return "Radar-FX"

    try:
        import re
        text = str(comment).strip()
        # Remove tudo que não for ASCII letra, dígito, espaço, hífen ou underscore
        clean = re.sub(r'[^a-zA-Z0-9 \-_]', '', text)
        # Colapsa espaços múltiplos em um único
        clean = re.sub(r' +', ' ', clean).strip()
    except Exception:
        return "Radar-FX"

    if not clean:
        return "Radar-FX"

    return clean[:30]

@app.route('/health', methods=['GET'])
def health():
    account_info = mt5.account_info()
    connected = False
    try:
        term_info = mt5.terminal_info()
        connected = term_info.connected if term_info else False
    except:
        pass
    
    if account_info is None or not connected:
        # Tenta reinicializar se a conexão caiu
        if mt5.initialize():
            account_info = mt5.account_info()
            # Tenta re-login automático
            if account_info is not None:
                _try_relogin()
                try:
                    term_info = mt5.terminal_info()
                    connected = term_info.connected if term_info else False
                except:
                    connected = False
    
    if account_info is None:
        return jsonify({"status": "disconnected", "connected": False, "error": "Terminal MT5 não detectado", "version": "v1.1.3-DIAG"})
        
    return jsonify({
        "status": "connected" if connected else "degraded", 
        "connected": connected,
        "account": account_info.login,
        "server": account_info.server,
        "balance": account_info.balance,
        "version": "v1.1.3-DIAG"
    })

@app.route('/login', methods=['POST'])
def login():
    global _last_login_credentials
    data = request.json
    login_id = int(data.get('login'))
    password = data.get('password')
    server = data.get('server')
    path = data.get('path')
    
    # Se um caminho for fornecido, tentamos reinicializar com ele
    if path:
        logging.info(f"Attempting to launch and initialize with specific path: {path}")
        import subprocess
        import os
        try:
            # Garante que o terminal seja aberto/mostrado
            if os.path.exists(path):
                subprocess.Popen([path])
                import time
                time.sleep(1.5) # Aguarda o processo processar a abertura
            else:
                logging.warning(f"Path {path} does not exist, falling back to default initialization")
        except Exception as e:
            logging.error(f"Failed to launch terminal via Popen: {e}")

        mt5.shutdown() # Garante que a conexão anterior seja fechada
        if not mt5.initialize(path=path):
            return jsonify({"error": f"Failed to initialize MT5 at {path}", "code": mt5.last_error()}), 500
    
    authorized = mt5.login(login_id, password=password, server=server)
    if not authorized:
        error_code = mt5.last_error()
        logging.error(f"Login failed for {login_id} on {server}. Error: {error_code}")
        return jsonify({"error": "Login failed", "code": error_code}), 401
    
    # Armazena credenciais para auto-reconexão futura
    _last_login_credentials["login"] = login_id
    _last_login_credentials["password"] = password
    _last_login_credentials["server"] = server
    logging.info(f"Credenciais armazenadas para auto-reconexão: conta {login_id}")
        
    return jsonify({"status": "success", "message": f"Connected to {server}"})

@app.route('/order', methods=['POST'])
def place_order():
    try:
        data = request.json
        logging.info(f"Order Request Received: {data}")
        if not data:
            return jsonify({"error": "No JSON data received"}), 400

        symbol = data.get('symbol')
        action = data.get('action') # 'BUY' or 'SELL'
        lot = data.get('lot', 0.01)
        sl = data.get('sl')
        tp = data.get('tp')
        sl_points = data.get('sl_points')
        tp_points = data.get('tp_points')
        
        # Check if connected
        if not ensure_connected():
            return jsonify({"error": "Terminal MT5 não detectado ou desconectado"}), 401

        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return jsonify({"error": f"Symbol {symbol} not found"}), 404
            
        # Verificação preventiva: Mercado Fechado (Erro 10018)
        if symbol_info.trade_mode != mt5.SYMBOL_TRADE_MODE_FULL:
            modes = {
                mt5.SYMBOL_TRADE_MODE_DISABLED: "Desativado",
                mt5.SYMBOL_TRADE_MODE_READONLY: "Apenas Leitura",
                mt5.SYMBOL_TRADE_MODE_CLOSEONLY: "Apenas Fechamento"
            }
            mode_desc = modes.get(symbol_info.trade_mode, "Fechado")
            return jsonify({
                "error": f"⚠️ Mercado {mode_desc} para {symbol}. Tente ativos de Cripto (BTCUSD) ou aguarde a abertura da sessão.",
                "code": 10018
            }), 400

        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                return jsonify({"error": f"Failed to select symbol {symbol}"}), 500

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return jsonify({"error": f"Preço para {symbol} não disponível no momento"}), 400
            
        order_type = mt5.ORDER_TYPE_BUY if action == 'BUY' else mt5.ORDER_TYPE_SELL
        price = tick.ask if action == 'BUY' else tick.bid

        # Calc SL/TP from points if needed
        point = symbol_info.point
        if sl_points and not sl:
            dist = float(sl_points) * point
            sl = price - dist if action == 'BUY' else price + dist
        if tp_points and not tp:
            dist = float(tp_points) * point
            tp = price + dist if action == 'BUY' else price - dist
        
        # Detect filling mode (using integer constants as some MT5 versions miss SYMBOL_FILLING_*)
        filling_type = mt5.ORDER_FILLING_IOC
        if symbol_info.filling_mode & 1: # SYMBOL_FILLING_FOK
            filling_type = mt5.ORDER_FILLING_FOK
        elif symbol_info.filling_mode & 2: # SYMBOL_FILLING_IOC
            filling_type = mt5.ORDER_FILLING_IOC
        else:
            filling_type = mt5.ORDER_FILLING_RETURN

        request_dict = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lot),
            "type": order_type,
            "price": price,
            "magic": int(data.get('magic', 123456)),
            "comment": sanitize_comment(data.get('comment', "Radar-FX Alpha")),
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling_type,
        }

        if sl: request_dict["sl"] = float(sl)
        if tp: request_dict["tp"] = float(tp)
        
        logging.info(f"MT5 Order: {request_dict['action']} {request_dict['symbol']} {request_dict['volume']} @ {request_dict['price']}")
        result = mt5.order_send(request_dict)
        if result is None:
            err = mt5.last_error()
            error_message = f"MT5 Request Failed: Error {err}"
            logging.error(f"Critical Bridge Error: {error_message}")
            return jsonify({"error": error_message, "code": err[0] if err else -1}), 400
            
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            error_code = result.retcode
            
            # Tratamento para erro de rede (10031) — tenta reconectar automaticamente
            if error_code == 10031:
                logging.warning("⚠️ Erro 10031 — Rede MT5 perdida. Tentando reconexão automática...")
                mt5.shutdown()
                import time
                time.sleep(2)
                if mt5.initialize():
                    logging.info("MT5 reconectado após erro 10031. Tentando re-login...")
                    # Tenta re-login com credenciais armazenadas
                    if _try_relogin():
                        logging.info("Re-login OK. Reenviando ordem...")
                        result = mt5.order_send(request_dict)
                        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
                            logging.info(f"✅ Ordem reenviada com sucesso após reconexão: #{result.order}")
                            return jsonify({"status": "success", "order_id": result.order, "retcode": result.retcode})
                    else:
                        logging.warning("Re-login automático falhou. Tentando reenviar ordem mesmo assim...")
                        result = mt5.order_send(request_dict)
                        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
                            logging.info(f"✅ Ordem reenviada com sucesso (sem re-login): #{result.order}")
                            return jsonify({"status": "success", "order_id": result.order, "retcode": result.retcode})
                
                error_message = "🔌 Conexão com o servidor MT5 perdida. O terminal pode estar desconectado ou a conta expirou. Verifique seu MetaTrader 5 e tente novamente."
                logging.error(f"Order failed after reconnection attempt: 10031")
                return jsonify({"error": error_message, "code": 10031}), 503
            
            error_message = f"MT5 Error: {result.comment} (Code: {error_code})"
            
            # Tratamento amigável para AutoTrading desativado (10027)
            if error_code == 10027:
                error_message = "❌ Erro 10027: Algo Trading (Negociação Algorítmica) está DESATIVADO no seu Terminal MT5. Por favor, clique no botão 'Algo Trading' (ícone de Play verde) no topo do seu MetaTrader 5 para permitir que o Radar-FX envie ordens."
            
            logging.error(f"Order failed: {error_message}")
            return jsonify({"error": error_message, "code": error_code, "comment": result.comment}), 400
            
        # Se a ordem foi aberta mas o broker ignorou SL/TP (comum em IOC), tentamos aplicar via SLTP
        if (sl or tp) and result.order:
            import time
            time.sleep(0.5) # Aguarda o terminal processar a abertura
            sltp_request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "position": result.order,
                "magic": 123456
            }
            if sl: sltp_request["sl"] = float(sl)
            if tp: sltp_request["tp"] = float(tp)
            mt5.order_send(sltp_request)
            logging.info(f"Secondary SL/TP sync sent for #{result.order}")

        return jsonify({"status": "success", "order_id": result.order, "retcode": result.retcode})
    except Exception as e:
        logging.error(f"Critical Bridge Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return jsonify({"error": f"Bridge Internal Error: {str(e)}"}), 500

@app.route('/close_order', methods=['POST'])
def close_order():
    try:
        if not ensure_connected():
            return jsonify({"error": "Terminal MT5 não detectado"}), 401
        data = request.json
        ticket = data.get('ticket')
        if not ticket:
            return jsonify({"error": "No ticket provided"}), 400
            
        pos = mt5.positions_get(ticket=int(ticket))
        if pos is None or len(pos) == 0:
            return jsonify({"error": f"Position {ticket} not found"}), 404
        pos = pos[0]
        
        symbol_info = mt5.symbol_info(pos.symbol)
        if not symbol_info:
            return jsonify({"error": "Symbol not found"}), 404

        tick = mt5.symbol_info_tick(pos.symbol)
        if not tick:
            return jsonify({"error": "Price not found"}), 400
            
        order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
        
        filling_type = mt5.ORDER_FILLING_IOC
        if symbol_info.filling_mode & 1:
            filling_type = mt5.ORDER_FILLING_FOK
        elif symbol_info.filling_mode & 2:
            filling_type = mt5.ORDER_FILLING_IOC
        else:
            filling_type = mt5.ORDER_FILLING_RETURN

        request_dict = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": float(pos.volume),
            "type": order_type,
            "position": int(pos.ticket),
            "price": price,
            "magic": int(data.get('magic', 123456)),
            "comment": sanitize_comment(data.get('comment', "Close Position")),
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling_type,
        }
        
        logging.info(f"Closing request: {request_dict}")
        result = mt5.order_send(request_dict)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            err = mt5.last_error() if result is None else result.comment
            logging.error(f"Close failed: {err}")
            return jsonify({"error": "Close failed", "details": str(err)}), 400
            
        return jsonify({"status": "success", "order_id": result.order, "retcode": result.retcode})
    except Exception as e:
        logging.error(f"Bridge Internal Error (close_order): {str(e)}")
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500

@app.route('/account', methods=['GET'])
def get_account():
    if not ensure_connected():
        return jsonify({"error": "Failed to connect to MT5"}), 500
        
    account_info = mt5.account_info()
    result = account_info._asdict()
    
    # Compute real daily profit using MT5 server time
    try:
        import datetime as dt
        
        # Get all deals from last 48h (wide window for timezone safety)
        now = dt.datetime.now()
        from_date = now - dt.timedelta(hours=48)
        to_date = now + dt.timedelta(hours=24)
        
        deals = mt5.history_deals_get(from_date, to_date)
        if deals is not None and len(deals) > 0:
            # MT5 deal timestamps are in UTC (Unix timestamps)
            # Broker server time is typically UTC+2 or UTC+3
            # Determine the broker's current date by checking the latest deal time
            last_ts = max(d.time for d in deals)
            
            # Try common broker offsets to find which gives a valid "today"
            best_sum = 0.0
            best_offset = 3  # default
            for offset in [2, 3]:
                broker_dt = dt.datetime.fromtimestamp(last_ts, dt.timezone.utc) + dt.timedelta(hours=offset)
                today_str = broker_dt.strftime('%Y-%m-%d')
                # Convert today's start/end to UTC timestamps for filtering
                # Create today 00:00:00 in broker timezone, then convert to UTC timestamp
                today_broker_start = dt.datetime.strptime(today_str, '%Y-%m-%d').replace(tzinfo=dt.timezone(dt.timedelta(hours=offset)))
                today_start_utc = today_broker_start.astimezone(dt.timezone.utc).timestamp()
                today_end_utc = today_start_utc + 86400
                
                deal_sum = 0.0
                for d in deals:
                    if today_start_utc <= d.time < today_end_utc:
                        deal_sum += (d.profit or 0) + (d.commission or 0) + (d.swap or 0)
                
                if abs(deal_sum) > abs(best_sum) or offset == 3:
                    best_sum = deal_sum
                    best_offset = offset
            
            # Use the best matching offset
            broker_dt = dt.datetime.fromtimestamp(last_ts, dt.timezone.utc) + dt.timedelta(hours=best_offset)
            today_str = broker_dt.strftime('%Y-%m-%d')
            today_broker_start = dt.datetime.strptime(today_str, '%Y-%m-%d').replace(tzinfo=dt.timezone(dt.timedelta(hours=best_offset)))
            today_start_utc = today_broker_start.astimezone(dt.timezone.utc).timestamp()
            today_end_utc = today_start_utc + 86400
            
            deal_sum = 0.0
            for d in deals:
                if today_start_utc <= d.time < today_end_utc:
                    deal_sum += (d.profit or 0) + (d.commission or 0) + (d.swap or 0)
            
            result['daily_closed_profit'] = round(deal_sum, 2)
        else:
            result['daily_closed_profit'] = 0.0
        
        # Daily total = closed today + floating
        result['daily_profit'] = round(result.get('daily_closed_profit', 0) + (account_info.profit or 0), 2)
    except Exception as e:
        print(f"Error computing daily profit: {e}")
        import traceback
        traceback.print_exc()
        result['daily_profit'] = account_info.profit or 0
        result['daily_closed_profit'] = 0.0
    
    return jsonify(result)

@app.route('/positions', methods=['GET'])
def get_positions():
    magic = request.args.get('magic')
    positions = mt5.positions_get()
    if positions is None:
        return jsonify([])
    
    # Filtrar por magic se fornecido
    if magic:
        try:
            magic_int = int(magic)
            positions = [p for p in positions if p.magic == magic_int]
        except ValueError:
            pass
        
    return jsonify([
        {
            **p._asdict(),
            "point": mt5.symbol_info(p.symbol).point if mt5.symbol_info(p.symbol) else 0.00001,
            "digits": mt5.symbol_info(p.symbol).digits if mt5.symbol_info(p.symbol) else 5,
            "tick_value": mt5.symbol_info(p.symbol).trade_tick_value if mt5.symbol_info(p.symbol) else 1.0,
            "contract_size": mt5.symbol_info(p.symbol).trade_contract_size if mt5.symbol_info(p.symbol) else 1.0
        } for p in positions
    ])

@app.route('/history', methods=['GET'])
def get_history():
    import datetime
    from_date = datetime.datetime.now() - datetime.timedelta(days=30)
    # Adicionando dias ao to_date pois datetime.now() é Local Time (GMT-3) 
    # e MT5 Broker Time é (GMT+2/3). Sem isso, trades das últimas horas são cortados.
    to_date = datetime.datetime.now() + datetime.timedelta(days=2)
    
    deals = mt5.history_deals_get(from_date, to_date)
    if deals is None:
        return jsonify([])
        
    return jsonify([d._asdict() for d in deals])

@app.route('/candles', methods=['GET'])
def get_candles():
    symbol = request.args.get('symbol')
    count = int(request.args.get('count', 10))
    timeframe_str = request.args.get('timeframe', 'M1')
    
    # Mapeamento de timeframe
    tf_map = {
        'M1': mt5.TIMEFRAME_M1,
        'M5': mt5.TIMEFRAME_M5,
        'M15': mt5.TIMEFRAME_M15,
        'H1': mt5.TIMEFRAME_H1,
        'H4': mt5.TIMEFRAME_H4,
        'D1': mt5.TIMEFRAME_D1
    }
    tf = tf_map.get(timeframe_str, mt5.TIMEFRAME_M1)
    
    if not ensure_connected():
        return jsonify({"error": "Failed to connect to MT5"}), 500
        
    logging.info(f"Candles request for {symbol} ({count} bars, {timeframe_str})")
    
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if rates is None or len(rates) == 0:
        logging.warning(f"No candles found for {symbol}")
        return jsonify([])
        
    # Conversão robusta via dict comprehension
    result = []
    for r in rates:
        d = {name: r[name] for name in rates.dtype.names}
        # Garantir que tipos numpy sejam convertidos para tipos Python (JSON serializable)
        d['time'] = int(d['time'])
        for key in ['open', 'high', 'low', 'close']:
            d[key] = float(d[key])
        for key in ['tick_volume', 'spread', 'real_volume']:
            d[key] = int(d[key])
        result.append(d)
        
    return jsonify(result)

@app.route('/update_order', methods=['POST'])
def update_order():
    data = request.json
    ticket = data.get('ticket')
    sl = data.get('sl')
    tp = data.get('tp')
    
    if not ticket:
        return jsonify({"error": "Ticket is required"}), 400
        
    # Buscar símbolo automaticamente se não for fornecido
    symbol = data.get('symbol')
    if not symbol:
        pos = mt5.positions_get(ticket=int(ticket))
        if pos and len(pos) > 0:
            symbol = pos[0].symbol
        else:
            # Tenta buscar no histórico se a posição já fechou (raro para SL/TP mas seguro)
            history = mt5.history_orders_get(ticket=int(ticket))
            if history and len(history) > 0:
                symbol = history[0].symbol

    if not symbol:
        return jsonify({"error": "Symbol not found for this ticket"}), 404

    request_dict = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": symbol,
        "position": int(ticket),
        "magic": int(data.get('magic', 123456)),
        "comment": sanitize_comment(data.get('comment', "Radar-FX SL/TP Change"))
    }
    
    if sl is not None: request_dict["sl"] = float(sl)
    if tp is not None: request_dict["tp"] = float(tp)
    
    result = mt5.order_send(request_dict)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({"error": "Update failed", "code": result.retcode, "comment": result.comment}), 400
        
    return jsonify({"status": "success", "message": "Order updated"})

@app.route('/symbols', methods=['GET'])
def get_all_symbols():
    if not ensure_connected():
        return jsonify({"error": "Failed to connect to MT5"}), 500
    
    symbols = mt5.symbols_get()
    if symbols is None:
        return jsonify([])
    
    # Retorna apenas os nomes para ser leve
    return jsonify([s.name for s in symbols])

@app.route('/symbol_info', methods=['GET'])
def get_symbol_info():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({"error": "Symbol parameter required"}), 400
    if not ensure_connected():
        return jsonify({"error": "Failed to connect to MT5"}), 500
    info = mt5.symbol_info(symbol)
    if info is None:
        return jsonify({"error": f"Symbol {symbol} not found"}), 404
    return jsonify({
        "symbol": info.name,
        "point": info.point,
        "digits": info.digits,
        "trade_tick_size": info.trade_tick_size,
        "trade_tick_value": info.trade_tick_value,
        "trade_contract_size": info.trade_contract_size,
        "trade_stops_level": info.trade_stops_level,
        "trade_mode": info.trade_mode,
        "visible": info.visible,
        "filling_mode": info.filling_mode
    })

@app.route('/ticks', methods=['POST'])
def get_ticks():
    data = request.json
    symbols = data.get('symbols', [])
    results = {}
    
    for symbol in symbols:
        info = mt5.symbol_info(symbol)
        tick = mt5.symbol_info_tick(symbol)
        
        if info:
            # trade_mode: 0=Full, 1=Disabled, 2=ReadOnly, 3=CloseOnly
            is_open = info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL
            results[symbol] = {
                "bid": tick.bid if tick else 0,
                "ask": tick.ask if tick else 0,
                "last": tick.last if tick else 0,
                "volume": tick.volume if tick else 0,
                "time": tick.time if tick else 0,
                "trade_mode": info.trade_mode,
                "is_open": is_open
            }
            
    return jsonify(results)

@app.route('/analysis', methods=['GET'])
def get_analysis():
    try:
        symbol = request.args.get('symbol')
        count = int(request.args.get('count', 300))
        timeframe_str = request.args.get('timeframe', 'H1')
        
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400
            
        tf_map = {
            'M1': mt5.TIMEFRAME_M1, 'M5': mt5.TIMEFRAME_M5, 'M15': mt5.TIMEFRAME_M15,
            'H1': mt5.TIMEFRAME_H1, 'H4': mt5.TIMEFRAME_H4, 'D1': mt5.TIMEFRAME_D1
        }
        tf = tf_map.get(timeframe_str, mt5.TIMEFRAME_M1)
        
        if not ensure_connected():
            return jsonify({"error": "Failed to connect to MT5"}), 500
            
        # Extrair mais dados do que o solicitado para garantir o cálculo dos indicadores (ex: SMA 200 precisa de 200 barras)
        fetch_count = count + 250
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, fetch_count)
        if rates is None or len(rates) == 0:
            return jsonify({"error": f"No candles found for {symbol}"}), 404
            
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        
        # Calcular Indicadores com proteção
        try:
            # df['rsi'] = ta.rsi(df['close'], length=14)
            # df['ema9'] = ta.ema(df['close'], length=9)
            # df['ema21'] = ta.ema(df['close'], length=21)
            # if len(df) >= 200:
            #     df['sma200'] = ta.sma(df['close'], length=200)
            # else:
            #     df['sma200'] = None
            # 
            # macd = ta.macd(df['close'])
            # if macd is not None and not macd.empty:
            #     df = pd.concat([df, macd], axis=1)
            # 
            # bbands = ta.bbands(df['close'], length=20, std=2)
            # if bbands is not None and not bbands.empty:
            #     df = pd.concat([df, bbands], axis=1)
            pass
        except Exception as indicator_err:
            logging.warning(f"Indicator calculation warning: {str(indicator_err)}")

        # Cortar para o tamanho solicitado originalmente (mantendo os mais recentes)
        df = df.iloc[-count:]
        df = df.where(pd.notnull(df), None)
        
        # Processamento ultra-seguro usando to_dict('records')
        raw_records = df.to_dict('records')
        result = []
        
        for record in raw_records:
            # Cria um novo dicionário limpo para a resposta
            d = {
                "time": int(record['time'].timestamp()),
                "open": record.get('open'),
                "high": record.get('high'),
                "low": record.get('low'),
                "close": record.get('close'),
                "rsi": record.get('rsi'),
                "ema9": record.get('ema9'),
                "ema21": record.get('ema21'),
                "sma200": record.get('sma200')
            }
            
            # Mapeamento dinâmico sem iterar sobre o próprio d
            for k, v in record.items():
                if not isinstance(k, str): continue
                if k.startswith('MACD_'): d['macd'] = v
                elif k.startswith('MACDh_'): d['macd_h'] = v
                elif k.startswith('MACDs_'): d['macd_s'] = v
                elif k.startswith('BBL_'): d['bb_low'] = v
                elif k.startswith('BBM_'): d['bb_mid'] = v
                elif k.startswith('BBU_'): d['bb_high'] = v
            
            result.append(d)
        
        last = df.iloc[-1]
        last_rsi = last['rsi'] if last['rsi'] is not None else 50
        
        sentiment = "Neutral"
        if last_rsi > 70: sentiment = "Overbought"
        elif last_rsi < 30: sentiment = "Oversold"
        elif last.get('ema9') and last.get('ema21') and last.get('sma200'):
            if last['ema9'] > last['ema21'] and last['close'] > last['sma200']: sentiment = "Strong Bullish"
            elif last['ema9'] < last['ema21'] and last['close'] < last['sma200']: sentiment = "Strong Bearish"
            elif last['ema9'] > last['ema21']: sentiment = "Bullish"
            elif last['ema9'] < last['ema21']: sentiment = "Bearish"

        return jsonify({
            "version": "1.1.7-ULTRA-SAFE",
            "symbol": symbol,
            "timeframe": timeframe_str,
            "sentiment": sentiment,
            "data": result
        })
    except Exception as e:
        logging.error(f"Analysis Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/smc_levels', methods=['GET'])
def get_smc_levels():
    """
    Retorna níveis de TP/SL baseados em Smart Money Concepts para um par.
    Parâmetros: symbol, direction (BUY/SELL), entry_price (opcional)
    """
    try:
        symbol = request.args.get('symbol')
        direction = request.args.get('direction', 'BUY').upper()
        entry_price = request.args.get('entry_price', type=float, default=None)

        if not symbol:
            return jsonify({"error": "symbol é obrigatório"}), 400
        if direction not in ('BUY', 'SELL'):
            return jsonify({"error": "direction deve ser BUY ou SELL"}), 400

        if not ensure_connected():
            return jsonify({"error": "Conexão MT5 perdida"}), 500

        # Buscar candles M5 para análise SMC
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, 200)
        if rates is None or len(rates) < 20:
            # Fallback para M1 se M5 não disponível
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 200)

        if rates is None or len(rates) == 0:
            return jsonify({"error": f"Dados não encontrados para {symbol}"}), 404

        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')

        # Se não veio entry_price, usar o último close
        if entry_price is None:
            entry_price = float(df.iloc[-1]['close'])

        levels = calculate_smc_levels(df, direction, entry_price)
        levels['symbol'] = symbol
        levels['direction'] = direction
        levels['entry_price'] = round(entry_price, 2)

        return jsonify(levels)

    except Exception as e:
        logging.error(f"SMC Levels Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/smc_analysis', methods=['GET'])
def get_smc_analysis():
    """
    Análise SMC completa de um símbolo: Order Blocks, FVG, Liquidez, Estrutura.
    """
    try:
        symbol = request.args.get('symbol')
        if not symbol:
            return jsonify({"error": "symbol é obrigatório"}), 400

        if not ensure_connected():
            return jsonify({"error": "Conexão MT5 perdida"}), 500

        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, 150)
        if rates is None or len(rates) < 20:
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 150)
        if rates is None or len(rates) == 0:
            return jsonify({"error": f"Dados não encontrados para {symbol}"}), 404

        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')

        obs = detect_order_blocks(df, lookback=80)
        fvgs = detect_fvg(df, lookback=80)
        liq = detect_liquidity_levels(df, lookback=100)
        mkt = detect_market_structure(df, lookback=60)

        last = df.iloc[-1]

        return jsonify({
            'symbol': symbol,
            'price': {
                'close': round(float(last['close']), 2),
                'high': round(float(last['high']), 2),
                'low': round(float(last['low']), 2)
            },
            'market_structure': mkt,
            'order_blocks': {
                'bullish': [{'price': round(o['price'], 2), 'strength': o['strength']} for o in obs.get('bullish', [])[:3]],
                'bearish': [{'price': round(o['price'], 2), 'strength': o['strength']} for o in obs.get('bearish', [])[:3]]
            },
            'fvg': {
                'bullish': [{'mid': round(f['mid'], 2), 'size': f['size']} for f in fvgs.get('bullish', [])[:3]],
                'bearish': [{'mid': round(f['mid'], 2), 'size': f['size']} for f in fvgs.get('bearish', [])[:3]]
            },
            'liquidity': {
                'highs': [round(l, 2) for l in [x['price'] for x in liq.get('highs', [])][:3]],
                'lows': [round(l, 2) for l in [x['price'] for x in liq.get('lows', [])][:3]]
            }
        })

    except Exception as e:
        logging.error(f"SMC Analysis Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/disconnect', methods=['POST'])
def disconnect():
    global _last_login_credentials
    try:
        mt5.shutdown()
        _last_login_credentials = {"login": None, "password": None, "server": None}
        return jsonify({"success": True, "message": "Desconectado do MT5"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    # No Pepperstone, é importante rodar o MT5 primeiro
    if not mt5.initialize():
        print("Initialize failed, check if MT5 terminal is open")
    else:
        print("MT5 Connected and ready for login")
    
    app.run(port=5555)
