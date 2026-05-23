import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

# =========================================================
# 1. CONEXÃO E EXTRAÇÃO DE DADOS (MetaTrader 5)
# =========================================================
print("Conectando ao MetaTrader 5...")
if not mt5.initialize():
    print("Erro ao inicializar MT5")
    quit()

ativo = "BTCUSD" # Pode ser trocado por XAUUSD
timeframe = mt5.TIMEFRAME_H1 # Gráfico de 1 Hora
numero_velas = 10000 # Histórico longo para a IA aprender padrões (aprox. 1 a 2 anos)

print(f"Baixando histórico de {numero_velas} velas do {ativo}...")
rates = mt5.copy_rates_from_pos(ativo, timeframe, 0, numero_velas)
df = pd.DataFrame(rates)
df['time'] = pd.to_datetime(df['time'], unit='s')
df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close'}, inplace=True)

# =========================================================
# 2. FEATURE ENGINEERING (Traduzindo o Gráfico para a IA)
# =========================================================
print("Calculando Estrutura de Mercado e Padrões Institucionais...")

# Volatilidade (Amplitude da vela)
df['Volatilidade'] = df['High'] - df['Low']

# Tendência Macro (Distância do preço para a média de 50)
df['SMA_50'] = df['Close'].rolling(window=50).mean()
df['Distancia_Media'] = df['Close'] - df['SMA_50']

# Detecção Matemática do FVG (Fair Value Gap de Alta)
df['Gap_Size'] = df['Low'].shift(2) - df['High']
df['FVG_Existe'] = np.where(df['Low'].shift(2) > df['High'], 1, 0) # 1 se tem Gap, 0 se não

# Horário do dia (A IA aprende se operar de madrugada é pior que na abertura de NY)
df['Hora_do_Dia'] = df['time'].dt.hour

# =========================================================
# 3. CRIAÇÃO DO GABARITO (O que é Win e o que é Loss?)
# =========================================================
# Simulamos o futuro: O preço subiu nas próximas 5 horas após o FVG se formar?
# Se o preço de fechamento daqui a 5 velas for MAIOR que o de hoje = 1 (Win). Senão = 0 (Loss).
df['Alvo_Atingido'] = np.where(df['Close'].shift(-5) > df['Close'], 1, 0)

# Limpa todas as linhas vazias (necessário para algoritmos de IA)
df.dropna(inplace=True)

# Filtramos os dados para a IA treinar APENAS nos momentos em que um FVG de fato existiu
df_fvg_apenas = df[df['FVG_Existe'] == 1].copy()

# =========================================================
# 4. PREPARAÇÃO DO MOTOR XGBOOST (Treino e Teste)
# =========================================================
colunas_pistas = ['Volatilidade', 'Distancia_Media', 'Gap_Size', 'Hora_do_Dia']
X = df_fvg_apenas[colunas_pistas]
y = df_fvg_apenas['Alvo_Atingido']

# Separamos 80% para estudo e 20% para a prova cega
# shuffle=False é fundamental no mercado financeiro para não misturarmos o futuro com o passado!
X_treino, X_teste, y_treino, y_teste = train_test_split(X, y, test_size=0.20, shuffle=False)

print("\nIniciando o treinamento do modelo XGBoost...")
modelo_ia = xgb.XGBClassifier(
    n_estimators=150,
    learning_rate=0.05,
    max_depth=4,
    random_state=42
)

# A IA encontra as regras ocultas do mercado
modelo_ia.fit(X_treino, y_treino)

# =========================================================
# 5. AVALIAÇÃO DA INTELIGÊNCIA ARTIFICIAL
# =========================================================
previsoes = modelo_ia.predict(X_teste)
acuracia = accuracy_score(y_teste, previsoes)

print(f"\n[RESULTADO DA PROVA]")
print(f"Acurácia do Algoritmo em dados desconhecidos: {acuracia * 100:.2f}%")
print("\nRelatório de Classificação Institucional:")
print(classification_report(y_teste, previsoes))

# =========================================================
# 6. EXPORTAÇÃO E SALVAMENTO (O Joblib)
# =========================================================
nome_arquivo = f"cerebro_smc_{ativo.lower()}.pkl"
joblib.dump(modelo_ia, nome_arquivo)

print(f"\n[SUCESSO] Modelo exportado! O arquivo '{nome_arquivo}' foi salvo na sua pasta.")
print("Ele agora está pronto para ser carregado pelo seu Robô de Execução Ao Vivo.")

mt5.shutdown()
