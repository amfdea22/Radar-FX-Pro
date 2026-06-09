import pandas as pd
import numpy as np

# DEPRECATED: Este arquivo é um protótipo standalone não conectado ao sistema.
# A lógica SMC principal está em:
#   - server/src/services/SharkBotEngine.ts (live trading)
#   - server/python/backtest_engine.py (SharkBotStrategy, backtesting)
# Mantido apenas para referência histórica.

class InstitucionalSMCBot:
    def __init__(self, dataframe, balance=10000.0, risk_per_trade=0.01, fvg_atr_ratio=0.5):
        self.df = dataframe.copy()
        self.balance = balance
        self.risk = risk_per_trade
        self.fvg_atr_ratio = fvg_atr_ratio  # B2: configurable threshold

    def _calcular_atr(self, period=14):
        high_low = self.df['High'] - self.df['Low']
        high_close = np.abs(self.df['High'] - self.df['Close'].shift())
        low_close = np.abs(self.df['Low'] - self.df['Close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        self.df['ATR'] = tr.rolling(window=period).mean()

    def _mapear_estrutura_mercado(self):
        self.df['Swing_High_20'] = self.df['High'].rolling(window=20).max().shift(1)
        self.df['Swing_Low_20']  = self.df['Low'].rolling(window=20).min().shift(1)
        self.df['BOS_Alta'] = self.df['Close'] > self.df['Swing_High_20']
        self.df['Nivel_50_Desconto'] = self.df['Swing_Low_20'] + ((self.df['Swing_High_20'] - self.df['Swing_Low_20']) * 0.5)

    def _detectar_fvg_alta(self):
        self.df['Gap_Size'] = self.df['Low'].shift(2) - self.df['High']
        fvg_existe = self.df['Low'].shift(2) > self.df['High']
        fvg_relevante = self.df['Gap_Size'] > (self.fvg_atr_ratio * self.df['ATR'])
        self.df['FVG_Valido'] = fvg_existe & fvg_relevante
        self.df['Entrada_Limit'] = np.where(self.df['FVG_Valido'], self.df['Low'].shift(2), np.nan)

    def gerar_sinais(self):
        self._calcular_atr()
        self._mapear_estrutura_mercado()
        self._detectar_fvg_alta()
        self.df['SMA_50'] = self.df['Close'].rolling(window=50).mean()
        self.df['Setup_Armado'] = (
            self.df['FVG_Valido'] &
            (self.df['Entrada_Limit'] <= self.df['Nivel_50_Desconto']) &
            (self.df['Close'] > self.df['SMA_50'])
        )
        oportunidades = self.df[self.df['Setup_Armado']].copy()
        oportunidades['Stop_Loss'] = oportunidades['Swing_Low_20']
        oportunidades['Tamanho_Posicao'] = oportunidades.apply(
            lambda row: self.calcular_lote(row['Entrada_Limit'], row['Stop_Loss']), axis=1
        )
        return oportunidades[['Entrada_Limit', 'Stop_Loss', 'Tamanho_Posicao', 'Gap_Size']]

    def calcular_lote(self, preco_entrada, preco_stop):
        risco_financeiro = self.balance * self.risk
        distancia_stop = abs(preco_entrada - preco_stop)
        if distancia_stop == 0:
            return 0.0
        tamanho_posicao = risco_financeiro / distancia_stop
        return round(tamanho_posicao, 4)

if __name__ == "__main__":
    np.random.seed(42)
    dados_simulados = pd.DataFrame({
        'Open': np.random.uniform(60000, 65000, 100),
        'High': np.random.uniform(62000, 66000, 100),
        'Low': np.random.uniform(59000, 64000, 100),
        'Close': np.random.uniform(60000, 65000, 100)
    })
    
    robo = InstitucionalSMCBot(dados_simulados, balance=10000.0, risk_per_trade=0.01)
    sinais = robo.gerar_sinais()
    
    print("SINAIS DE ENTRADA ENCONTRADOS:")
    print(sinais)
