import time
import MetaTrader5 as mt5
import pandas as pd
import numpy as np
class AgenteIAScalper:
    def __init__(self, api_key, symbol="XAU/USD"):
        self.symbol = symbol
        
    def obter_dados_mercado(self):
        """Coleta o histórico recente de velas (M5) para o Ouro via MT5."""
        try:
            rates = mt5.copy_rates_from_pos(self.symbol, mt5.TIMEFRAME_M5, 0, 50)
            if rates is None or len(rates) < 5:
                print("Erro: MT5 não retornou dados.")
                return None
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')
            df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'tick_volume': 'Volume'}, inplace=True)
            df.set_index('time', inplace=True)
            return df
        except Exception as e:
            print(f"Erro ao coletar dados MT5: {e}")
            return None

    def mapear_fair_value_gaps(self, df):
        """
        Varre o histórico de candles adicionando assinaturas de FVG.
        Gaps de Alta (Bullish): Mínima(Vela Atual) > Máxima(Vela 2-atrás)
        Gaps de Baixa (Bearish): Máxima(Vela Atual) < Mínima(Vela 2-atrás)
        """
        df = df.copy()
        df['fvg_tipo'] = "NENHUM"
        df['fvg_topo'] = np.nan
        df['fvg_fundo'] = np.nan
        
        for i in range(2, len(df)):
            v1_high = df.iloc[i-2]['high']
            v1_low  = df.iloc[i-2]['low']
            
            v3_high = df.iloc[i]['high']
            v3_low  = df.iloc[i]['low']
            
            if v3_low > v1_high:
                df.at[i, 'fvg_tipo'] = 'BULLISH'
                df.at[i, 'fvg_fundo'] = v1_high
                df.at[i, 'fvg_topo'] = v3_low
                
            elif v3_high < v1_low:
                df.at[i, 'fvg_tipo'] = 'BEARISH'
                df.at[i, 'fvg_fundo'] = v3_high
                df.at[i, 'fvg_topo'] = v1_low
                
        return df

    def analisar_contexto_ia(self, df):
        """
        O Cérebro Adaptativo do Agente.
        Avalia a proximidade do preço atual em relação aos últimos FVGs gerados.
        """
        df_fvg = self.mapear_fair_value_gaps(df)
        
        preco_atual = df_fvg.iloc[-1]['close']
        
        fvgs_recentes = df_fvg[df_fvg['fvg_tipo'] != "NENHUM"].tail(3)
        
        if fvgs_recentes.empty:
            return "AGUARDAR", 0, 0

        ultimo_fvg = fvgs_recentes.iloc[-1]
        tipo_gap = ultimo_fvg['fvg_tipo']
        topo_gap = ultimo_fvg['fvg_topo']
        fundo_gap = ultimo_fvg['fvg_fundo']
        
        if tipo_gap == 'BULLISH' and (fundo_gap <= preco_atual <= topo_gap):
            return "COMPRA", fundo_gap, topo_gap
            
        elif tipo_gap == 'BEARISH' and (fundo_gap <= preco_atual <= topo_gap):
            return "VENDA", topo_gap, fundo_gap
            
        return "AGUARDAR", 0, 0

    def executar_ordem_mt5(self, direcao, limite_stop, limite_alvo):
        symbol_mt5 = "XAUUSD"
        
        if direcao == "AGUARDAR":
            print("Agente IA: Preço fora de zonas de desequilíbrio importantes. Monitorando...")
            return

        print(f"\n🎯 [SINAL] Agente IA detectou padrão institucional de {direcao}!")
        
        tipo_ordem = mt5.ORDER_TYPE_BUY if direcao == "COMPRA" else mt5.ORDER_TYPE_SELL
        tick = mt5.symbol_info_tick(symbol_mt5)
        preco_entrada = tick.ask if direcao == "COMPRA" else tick.bid
        
        if direcao == "COMPRA":
            stop_loss = limite_stop - 1.5
            take_profit = preco_entrada + 2.0
        else:
            stop_loss = limite_stop + 1.5
            take_profit = preco_entrada - 2.0
            
        requisicao = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol_mt5,
            "volume": 0.02,
            "type": tipo_ordem,
            "price": preco_entrada,
            "sl": stop_loss,
            "tp": take_profit,
            "deviation": 10,
            "magic": 202605,
            "comment": f"IA FVG Mitigação",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        resultado = mt5.order_send(requisicao)
        if resultado.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"❌ Falha operacional ao enviar ordem: {resultado.comment}")
        else:
            print(f"✅ Sucesso! Ordem de {direcao} posicionada. SL: ${stop_loss:.2f} | TP: ${take_profit:.2f}")

if __name__ == "__main__":
    if not mt5.initialize():
        print("Erro crítico: Não foi possível conectar ao terminal do MetaTrader 5.")
        exit()
        
    robo_fvg = AgenteIAScalper(api_key="")
    
    print("Iniciando Robô Inteligente com Filtro Avançado SMC/FVG no Ouro...")
    print("Fonte de dados: MT5 (MetaTrader 5)")
    
    try:
        while True:
            df_atualizado = robo_fvg.obter_dados_mercado()
            
            if df_atualizado is not None and not df_atualizado.empty:
                decisao, stop_ref, alvo_ref = robo_fvg.analisar_contexto_ia(df_atualizado)
                robo_fvg.executar_ordem_mt5(decisao, stop_ref, alvo_ref)
                
            time.sleep(60)
            
    except KeyboardInterrupt:
        print("\nProcesso de Trading automatizado encerrado de forma segura.")
        mt5.shutdown()
