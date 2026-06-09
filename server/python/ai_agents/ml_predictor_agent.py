import yfinance as yf
import pandas as pd
import numpy as np
import xgboost as xgb
import os
import pickle
from datetime import datetime, timezone, timedelta
from typing import Any
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

YFINANCE_MAP: dict[str, str] = {
    'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X',
    'USDCAD': 'USDCAD=X', 'AUDUSD': 'AUDUSD=X', 'NZDUSD': 'NZDUSD=X',
    'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F',
    'US30': 'YM=F', 'SP500': 'ES=F', 'NAS100': 'NQ=F',
    'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD',
}

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'ml_models')


class MLPredictorAgent:
    name = 'ml_predictor'
    display_name = 'ML Predictor'
    weight = 0.20

    def __init__(self):
        self.models: dict[str, xgb.XGBClassifier] = {}
        self.feature_cols = ['Retorno', 'Volatilidade', 'Distancia_SMA', 'RSI_14', 'Volume']
        os.makedirs(MODEL_DIR, exist_ok=True)

    def _get_ticker(self, symbol: str) -> str:
        return YFINANCE_MAP.get(symbol.upper(), symbol.upper())

    def _model_path(self, symbol: str) -> str:
        return os.path.join(MODEL_DIR, f'{symbol.upper()}.pkl')

    def _build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df['Retorno'] = df['Close'].pct_change()
        df['Volatilidade'] = (df['High'] - df['Low']) / df['Close']
        df['SMA_10'] = df['Close'].rolling(window=10).mean()
        df['Distancia_SMA'] = (df['Close'] - df['SMA_10']) / df['SMA_10']
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI_14'] = 100 - (100 / (1 + rs))
        return df

    def _train(self, symbol: str) -> xgb.XGBClassifier:
        ticker = self._get_ticker(symbol)
        df = yf.download(ticker, period='6mo', interval='15m', progress=False, auto_adjust=True)
        if df.empty or len(df) < 200:
            df = yf.download(ticker, period='6mo', interval='1h', progress=False, auto_adjust=True)
        if df.empty or len(df) < 50:
            df = yf.download(ticker, period='2y', interval='1d', progress=False, auto_adjust=True)
        if df.empty or len(df) < 50:
            raise ValueError(f'Dados insuficientes para {symbol}')

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = self._build_features(df)
        df.dropna(inplace=True)
        df['Target'] = np.where(df['Close'].shift(-1) > df['Close'], 1, 0)
        df = df[:-1]

        if len(df) < 30:
            raise ValueError(f'Apos feature engineering, dados insuficientes para {symbol}')

        X = df[self.feature_cols]
        y = df['Target']
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

        model = xgb.XGBClassifier(
            n_estimators=100, learning_rate=0.05, max_depth=4,
            subsample=0.8, colsample_bytree=0.8, random_state=42,
        )
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)

        path = self._model_path(symbol)
        with open(path, 'wb') as f:
            pickle.dump(model, f)

        print(f'[ML] {symbol}: modelo treinado M15 (acc {acc:.2%}, {len(df)} amostras)')
        return model

    def _load_or_train(self, symbol: str) -> xgb.XGBClassifier:
        path = self._model_path(symbol)
        if os.path.exists(path):
            try:
                with open(path, 'rb') as f:
                    return pickle.load(f)
            except Exception:
                pass
        return self._train(symbol)

    def analyze(self, symbol: str) -> dict[str, Any]:
        try:
            model = self._load_or_train(symbol)
            ticker = self._get_ticker(symbol)
            df = yf.download(ticker, period='5d', interval='15m', progress=False, auto_adjust=True)
            if df.empty or len(df) < 10:
                df = yf.download(ticker, period='5d', interval='1h', progress=False, auto_adjust=True)
            if df.empty or len(df) < 5:
                return {'agent': self.name, 'symbol': symbol, 'error': 'Dados insuficientes', 'weight': self.weight}

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = self._build_features(df)
            df.dropna(inplace=True)
            if df.empty:
                return {'agent': self.name, 'symbol': symbol, 'error': 'Dados insuficientes apos features', 'weight': self.weight}

            latest = df[self.feature_cols].iloc[-1:].values
            proba = model.predict_proba(latest)[0]
            pred = model.predict(latest)[0]

            direction = 'BULLISH' if pred == 1 else 'BEARISH'
            confidence = int(max(proba) * 100)
            accuracy_history = self._compute_recent_accuracy(model, df)

            return {
                'agent': self.name,
                'weight': self.weight,
                'symbol': symbol,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'ml_direction': direction,
                'ml_confidence': confidence,
                'prob_up': round(float(proba[1]), 4),
                'prob_down': round(float(proba[0]), 4),
                'bias': direction,
                'confidence': confidence,
                'model_accuracy': round(float(accuracy_history), 2),
                'features': {
                    'retorno': round(float(latest[0][0]), 6),
                    'volatilidade': round(float(latest[0][1]), 6),
                    'distancia_sma': round(float(latest[0][2]), 6),
                    'rsi_14': round(float(latest[0][3]), 2),
                    'volume': round(float(latest[0][4]), 2),
                },
            }
        except Exception as e:
            return {'agent': self.name, 'symbol': symbol, 'error': str(e), 'weight': self.weight}

    def _compute_recent_accuracy(self, model: xgb.XGBClassifier, df: pd.DataFrame) -> float:
        if len(df) < 20:
            return 0.0
        try:
            X = df[self.feature_cols].values
            y_true = np.where(df['Close'].shift(-1) > df['Close'], 1, 0)[:-1]
            X = X[:-1]
            preds = model.predict(X)
            return float(accuracy_score(y_true, preds))
        except Exception:
            return 0.0
