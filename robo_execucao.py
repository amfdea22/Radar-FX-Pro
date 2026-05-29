import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import joblib
import time
from datetime import datetime
from logger_seguranca import SecurityLogger

# =========================================================
# CONFIGURAÇÕES DA CONTA E GERENCIAMENTO DE RISCO
# =========================================================
ATIVO = "BTCUSD"
TIMEFRAME = mt5.TIMEFRAME_H1 # O mesmo tempo gráfico usado no treinamento
RISCO_POR_TRADE = 0.01 # Risco de 1% da banca
CONFIANCA_MINIMA_IA = 0.60 # A IA precisa ter mais de 60% de certeza para operar
ARQUIVO_IA = "cerebro_smc_btcusd.pkl"

# =========================================================
# 1. FUNÇÕES DE EXECUÇÃO (MetaTrader)
# =========================================================
def iniciar_mt5():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Conectando ao MetaTrader 5...")
    if not mt5.initialize():
        print("Erro crítico: Não foi possível conectar ao MT5.")
        quit()
    print("MT5 Conectado. Sistema Operacional Ativo!")

def calcular_lote(preco_entrada, preco_stop):
    """Calcula o tamanho exato da posição para perder apenas 1% do saldo."""
    info_conta = mt5.account_info()
    if info_conta is None: return 0.0
    
    saldo = info_conta.balance
    risco_financeiro = saldo * RISCO_POR_TRADE
    distancia_stop = abs(preco_entrada - preco_stop)
    
    if distancia_stop == 0: return 0.0
    lote = risco_financeiro / distancia_stop
    
    # Arredonda para o lote mínimo permitido pela corretora
    return round(lote, 2) 

def enviar_ordem(tipo_ordem, lote, preco, stop_loss, take_profit):
    """Envia a ordem para a corretora via API do MT5."""
    request = {
        "action": mt5.TRADE_ACTION_PENDING,
        "symbol": ATIVO,
        "volume": float(lote),
        "type": tipo_ordem, # mt5.ORDER_TYPE_BUY_LIMIT
        "price": float(preco),
        "sl": float(stop_loss),
        "tp": float(take_profit),
        "deviation": 20,
        "magic": 999111, # ID do Robô
        "comment": "Bot_SMC_Inteligencia_Artificial",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_RETURN,
    }
    resultado = mt5.order_send(request)
    if resultado.retcode == mt5.TRADE_RETCODE_DONE:
        print(f">>> SUCESSO! Ordem pendente enviada. Ticket: {resultado.order}")
    else:
        print(f">>> ERRO ao enviar ordem: {resultado.comment}")

# =========================================================
# 2. ANÁLISE DE DADOS E INTELIGÊNCIA ARTIFICIAL
# =========================================================
def obter_e_preparar_dados():
    """Puxa o mercado ao vivo e recria as variáveis matemáticas para a IA ler."""
    rates = mt5.copy_rates_from_pos(ATIVO, TIMEFRAME, 0, 100) # Puxa as últimas 100 velas
    if rates is None: return None
    
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close'}, inplace=True)
    
    # ⚠️ AS REGRAS AQUI PRECISAM SER EXATAMENTE IGUAIS ÀS DO TREINAMENTO DA IA
    df['Volatilidade'] = df['High'] - df['Low']
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['Distancia_Media'] = df['Close'] - df['SMA_50']
    df['Gap_Size'] = df['Low'].shift(2) - df['High']
    df['FVG_Existe'] = np.where(df['Low'].shift(2) > df['High'], 1, 0)
    df['Hora_do_Dia'] = df['time'].dt.hour
    
    return df

# =========================================================
# 3. O LOOP PRINCIPAL (O Cérebro em Ação)
# =========================================================
def rodar_robo():
    iniciar_mt5()
    
    # Inicializa o banco de dados de segurança com alertas Telegram
    auditoria = SecurityLogger(
        db_name="logs_seguranca.db",
        telegram_token="8038675950:AAE_b8tAcd-c_Y0f8-YDN6-fxYmSre64Wo8",
        chat_id="888757616"
    )
    
    # Carrega a Inteligência Artificial salva (Joblib)
    try:
        ia_institucional = joblib.load(ARQUIVO_IA)
        print("Cérebro de Inteligência Artificial carregado com sucesso!")
    except FileNotFoundError:
        print(f"Erro: Arquivo '{ARQUIVO_IA}' não encontrado. Execute a Parte 1 primeiro.")
        quit()

    print("--------------------------------------------------")
    print(f"Monitorando {ATIVO} aguardando formação institucional...")
    
    while True:
        df = obter_e_preparar_dados()
        
        if df is not None:
            # Pega apenas a vela mais recente (índice final)
            vela_atual = df.iloc[-1]
            
            # Condição 1: A vela atual formou um FVG de alta?
            if vela_atual['FVG_Existe'] == 1:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] FVG de Alta detectado! Consultando a IA...")
                
                # Separa as variáveis exatamente na mesma ordem do treinamento
                features_para_ia = pd.DataFrame([{
                    'Volatilidade': vela_atual['Volatilidade'],
                    'Distancia_Media': vela_atual['Distancia_Media'],
                    'Gap_Size': vela_atual['Gap_Size'],
                    'Hora_do_Dia': vela_atual['Hora_do_Dia']
                }])
                
                # Pergunta à IA a probabilidade de Sucesso (Win)
                probabilidade_win = ia_institucional.predict_proba(features_para_ia)[0][1]
                print(f"Probabilidade calculada pela IA: {probabilidade_win * 100:.2f}%")
                
                # Condição 2: A IA autoriza a entrada?
                if probabilidade_win >= CONFIANCA_MINIMA_IA:
                    print(">>> SINAL VERDE DA IA! Armando a armadilha...")
                    
                    # Prepara os alvos
                    preco_entrada = df.iloc[-3]['Low'] # Linha superior do Gap (candle 3)
                    stop_loss = df.iloc[-2]['Low'] - 10 # Fundo do candle que gerou o gap (com margem de segurança)
                    take_profit = preco_entrada + (abs(preco_entrada - stop_loss) * 2) # Risco/Retorno 2:1
                    
                    # Checa a trava de spread antes de calcular lote
                    spread_info = mt5.symbol_info(ATIVO)
                    spread_atual = spread_info.spread if spread_info else 0
                    limite_spread = 25
                    
                    if spread_atual > limite_spread:
                        auditoria.registrar_evento(
                            nivel='🔴',
                            ativo=ATIVO,
                            trava='Trava de Spread',
                            acao='🚫 Ordem Cancelada',
                            detalhe=f'Spread atual ({spread_atual}) maior que o limite ({limite_spread}).'
                        )
                        print(f"Alerta: Ordem abortada no {ATIVO} — Spread {spread_atual} pts. Veja os logs.")
                        time.sleep(60)
                        continue
                    
                    lote = calcular_lote(preco_entrada, stop_loss)
                    
                    if lote <= 0:
                        auditoria.registrar_evento(
                            nivel='🟡',
                            ativo=ATIVO,
                            trava='Lote Inválido',
                            acao='🚫 Ordem Cancelada',
                            detalhe=f'Lote calculado = {lote}. Stop ou saldo inválido.'
                        )
                        time.sleep(60)
                        continue
                    
                    # Dispara a ordem
                    enviar_ordem(mt5.ORDER_TYPE_BUY_LIMIT, lote, preco_entrada, stop_loss, take_profit)
                    
                    # Verifica o retorno da ordem
                    ordem_atual = mt5.orders_get(symbol=ATIVO)
                    if ordem_atual and len(ordem_atual) > 0:
                        ultima = ordem_atual[-1]
                        if ultima.comment == "Bot_SMC_Inteligencia_Artificial":
                            auditoria.registrar_evento(
                                nivel='🟢',
                                ativo=ATIVO,
                                trava='Nenhuma',
                                acao='✅ Ordem Executada',
                                detalhe=f'Lote {lote} | Entrada {preco_entrada} | SL {stop_loss} | TP {take_profit} | IA {probabilidade_win:.2%}'
                            )
                    
                    # Dorme por 1 hora para não enviar ordens duplicadas no mesmo FVG
                    time.sleep(3600)
                else:
                    print(">>> Sinal Vermelho: A IA previu risco de armadilha (Loss). Operação ignorada.")
                    auditoria.registrar_evento(
                        nivel='🟡',
                        ativo=ATIVO,
                        trava='Confiança da IA',
                        acao='🚫 Ordem Ignorada',
                        detalhe=f'Probabilidade {probabilidade_win:.2%} abaixo do mínimo {CONFIANCA_MINIMA_IA:.0%}.'
                    )
        
        # Pausa de 1 minuto antes de verificar o gráfico novamente para não travar o PC
        time.sleep(60)

if __name__ == "__main__":
    rodar_robo()
