import sqlite3
import pandas as pd
import requests
import threading
from datetime import datetime

class SecurityLogger:
    def __init__(self, db_name="shark_security_logs.db", telegram_token=None, chat_id=None):
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        # Novas variáveis para o Telegram
        self.telegram_token = telegram_token
        self.chat_id = chat_id
        
        self._criar_tabela()

    def _criar_tabela(self):
        query = """
        CREATE TABLE IF NOT EXISTS logs_auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            nivel TEXT,
            ativo TEXT,
            trava_acionada TEXT,
            acao_executada TEXT,
            detalhe_tecnico TEXT
        )
        """
        cursor = self.conn.cursor()
        cursor.execute(query)
        self.conn.commit()

    def _enviar_alerta_telegram(self, mensagem):
        """Envia a mensagem em uma thread separada para não causar latência no MT5."""
        if not self.telegram_token or not self.chat_id:
            return

        def disparar_api():
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            payload = {
                "chat_id": self.chat_id, 
                "text": mensagem, 
                "parse_mode": "Markdown"
            }
            try:
                requests.post(url, json=payload, timeout=5)
            except Exception as e:
                print(f"Erro silencioso ao enviar Telegram: {e}")

        thread = threading.Thread(target=disparar_api)
        thread.start()

    def registrar_evento(self, nivel, ativo, trava, acao, detalhe):
        """Grava no banco SQLite e, se for crítico, avisa no celular."""
        agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # 1. Grava no Banco de Dados
        query = """
        INSERT INTO logs_auditoria (timestamp, nivel, ativo, trava_acionada, acao_executada, detalhe_tecnico)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor = self.conn.cursor()
        cursor.execute(query, (agora, nivel, ativo, trava, acao, detalhe))
        self.conn.commit()

        # 2. Gatilho Automático do Telegram
        if nivel == '🔴':
            msg = f"🚨 *ALERTA RADAR FX* 🚨\n\n" \
                  f"🛑 *Trava:* {trava}\n" \
                  f"📊 *Ativo:* {ativo}\n" \
                  f"⚙️ *Ação:* {acao}\n" \
                  f"📝 *Detalhe:* {detalhe}\n" \
                  f"🕒 *Hora:* {agora}"
            
            self._enviar_alerta_telegram(msg)

    def exportar_para_ml(self, nivel_filtro=None):
        query = "SELECT * FROM logs_auditoria"
        if nivel_filtro:
            query += f" WHERE nivel = '{nivel_filtro}'"
            
        df = pd.read_sql_query(query, self.conn)
        return df

    def fechar_conexao(self):
        self.conn.close()
