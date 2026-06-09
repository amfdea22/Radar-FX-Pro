# DEPRECATED: Protótipo standalone usando MT5 diretamente.
# A lógica ativa está em:
#   - server/src/services/SharkBotEngine.ts (live trading via bridge)
#   - server/python/backtest_engine.py (SharkBotStrategy, backtesting via broker)
# Mantido apenas para referência.

import MetaTrader5 as mt5
import pandas as pd
import time
from datetime import datetime

def iniciar_mt5():
    if not mt5.initialize():
        print("Erro ao inicializar MT5:", mt5.last_error())
        quit()
    print("MetaTrader 5 Conectado com Sucesso!")

def obter_dados_mt5(symbol, timeframe, numero_velas=100):
    """
    Puxa os últimos N candles do MetaTrader e transforma 
    no DataFrame que nossa lógica institucional precisa.
    """
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, numero_velas)
    if rates is None:
        return None
        
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df = df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close'})
    return df

def enviar_ordem_limit(symbol, tipo_ordem, lote, preco_entrada, stop_loss, take_profit):
    """
    Envia ordem pendente (limit) para a corretora via MT5.
    """
    point = mt5.symbol_info(symbol).point
    
    request = {
        "action": mt5.TRADE_ACTION_PENDING,
        "symbol": symbol,
        "volume": float(lote),
        "type": tipo_ordem,
        "price": float(preco_entrada),
        "sl": float(stop_loss),
        "tp": float(take_profit),
        "deviation": 20,
        "magic": 123456,
        "comment": "Robo_SMC_Institucional",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_RETURN,
    }
    
    resultado = mt5.order_send(request)
    if resultado.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"Erro ao enviar ordem: {resultado.comment}")
    else:
        print(f"Ordem {symbol} enviada com sucesso! Ticket: {resultado.order}")

def rodar_robo_institucional():
    symbol = "BTCUSD"
    timeframe = mt5.TIMEFRAME_H1
    
    iniciar_mt5()
    
    while True:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Analisando o mercado...")
        
        df_atual = obter_dados_mt5(symbol, timeframe)
        
        if df_atual is not None:
            from shark_bot_core import InstitucionalSMCBot
            robo = InstitucionalSMCBot(df_atual, balance=10000, risk_per_trade=0.01)
            sinais = robo.gerar_sinais()
            
            if len(sinais) > 0:
                ultimo = sinais.iloc[-1]
                entrada = float(ultimo['Entrada_Limit'])
                stop = float(ultimo['Stop_Loss'])
                lote = float(ultimo['Tamanho_Posicao'])
                
                enviar_ordem_limit(symbol, mt5.ORDER_TYPE_BUY_LIMIT, lote, entrada, stop, entrada + (entrada - stop) * 2)
            
        time.sleep(60 * 60)

if __name__ == "__main__":
    print("Estrutura de execução do robô apresentada.")
