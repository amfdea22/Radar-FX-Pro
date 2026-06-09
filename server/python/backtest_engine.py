import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional, Literal
from instruments import get_instrument, compute_pnl, price_to_pips, pips_to_price, get_pip_value


class Position:
    def __init__(self, ticket: int, action: str, entry_price: float, volume: float,
                 entry_time: datetime, symbol: str, tp_price: float = None, sl_price: float = None,
                 comment: str = '', magic: int = 0):
        self.ticket = ticket
        self.action = action.upper()
        self.entry_price = entry_price
        self.volume = volume
        self.entry_time = entry_time
        self.symbol = symbol
        self.tp_price = tp_price
        self.sl_price = sl_price
        self.comment = comment
        self.magic = magic
        self.exit_price = None
        self.exit_time = None
        self.pnl = 0.0
        self.closed_volume = 0.0

    def is_buy(self):
        return self.action == 'BUY'

    def unrealized_pnl(self, current_price: float) -> float:
        diff = (current_price - self.entry_price) if self.is_buy() else (self.entry_price - current_price)
        return compute_pnl(self.symbol, self.entry_price, current_price, self.volume, self.is_buy())

    def check_exit(self, high: float, low: float, current_time: datetime) -> bool:
        sl_hit = False
        tp_hit = False
        sl_price = None
        tp_price = None
        if self.sl_price is not None:
            if self.is_buy() and low <= self.sl_price:
                sl_hit, sl_price = True, self.sl_price
            elif not self.is_buy() and high >= self.sl_price:
                sl_hit, sl_price = True, self.sl_price
        if self.tp_price is not None:
            if self.is_buy() and high >= self.tp_price:
                tp_hit, tp_price = True, self.tp_price
            elif not self.is_buy() and low <= self.tp_price:
                tp_hit, tp_price = True, self.tp_price
        if sl_hit and tp_hit:
            mid = (low + high) / 2
            if self.is_buy():
                self.exit_price = sl_price if mid <= (sl_price + tp_price) / 2 else tp_price
            else:
                self.exit_price = sl_price if mid >= (sl_price + tp_price) / 2 else tp_price
            self.exit_time = current_time
            return True
        if sl_hit:
            self.exit_price = sl_price
            self.exit_time = current_time
            return True
        if tp_hit:
            self.exit_price = tp_price
            self.exit_time = current_time
            return True
        return False


class RadarFXBroker:
    def __init__(self, initial_capital: float = 10000.0, commission_per_lot: float = 3.0,
                 leverage: int = 100, symbol: str = 'EURUSD'):
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.commission_per_lot = commission_per_lot
        self.leverage = leverage
        self.symbol = symbol
        self.positions: list[Position] = []
        self.closed_trades: list[dict] = []
        self.equity_curve: list[dict] = []
        self.ticket_counter = 0
        self.instr = get_instrument(symbol)
        self.contract_multiplier = self.instr['contract_multiplier'] if self.instr else 100000
        self.pip_size = self.instr['pip_size'] if self.instr else 0.0001
        self.spread = self.instr['spread_avg'] if self.instr else 0.0
        self.slippage_pct = self.instr['slippage_pct'] if self.instr else 0.0001
        self._pending_orders: list[dict] = []

    def get_bid(self, price: float) -> float:
        return price - (self.spread * self.pip_size / 2)

    def get_ask(self, price: float) -> float:
        return price + (self.spread * self.pip_size / 2)

    def apply_slippage(self, price: float, is_buy: bool) -> float:
        slippage = price * self.slippage_pct * np.random.uniform(0.5, 1.5)
        return price + slippage if is_buy else price - slippage

    def execute_market_order(self, action: str, price: float, volume: float, timestamp: datetime,
                             tp_pips: float = None, sl_pips: float = None, comment: str = '',
                             magic: int = 0) -> Optional[Position]:
        self._pending_orders.append({
            'action': action, 'volume': volume,
            'tp_pips': tp_pips, 'sl_pips': sl_pips,
            'comment': comment, 'magic': magic,
        })
        return None

    def _fill_market_order(self, action: str, price: float, volume: float, timestamp: datetime,
                           tp_pips: float = None, sl_pips: float = None, comment: str = '',
                           magic: int = 0) -> Optional[Position]:
        exec_price = self.get_ask(price) if action.upper() == 'BUY' else self.get_bid(price)
        exec_price = self.apply_slippage(exec_price, action.upper() == 'BUY')
        commission = self.commission_per_lot * volume
        margin_required = (exec_price * volume * self.contract_multiplier) / self.leverage
        total_cost = commission + margin_required
        if total_cost > self.cash:
            return None
        self.cash -= commission
        self.ticket_counter += 1
        tp_price = None
        sl_price = None
        if tp_pips is not None:
            tp_dist = pips_to_price(self.symbol, tp_pips)
            tp_price = exec_price + tp_dist if action.upper() == 'BUY' else exec_price - tp_dist
        if sl_pips is not None:
            sl_dist = pips_to_price(self.symbol, sl_pips)
            sl_price = exec_price - sl_dist if action.upper() == 'BUY' else exec_price + sl_dist
        pos = Position(self.ticket_counter, action, exec_price, volume, timestamp,
                       self.symbol, tp_price, sl_price, comment, magic)
        self.positions.append(pos)
        return pos

    def process_pending_orders(self, open_price: float, timestamp: datetime):
        orders = self._pending_orders[:]
        self._pending_orders.clear()
        for o in orders:
            self._fill_market_order(
                o['action'], open_price, o['volume'], timestamp,
                o['tp_pips'], o['sl_pips'], o['comment'], o['magic'],
            )

    def execute_limit_order(self, action: str, limit_price: float, volume: float, timestamp: datetime,
                            tp_pips: float = None, sl_pips: float = None, comment: str = '',
                            magic: int = 0) -> Optional[Position]:
        exec_price = limit_price
        commission = self.commission_per_lot * volume
        margin_required = (exec_price * volume * self.contract_multiplier) / self.leverage
        total_cost = commission + margin_required
        if total_cost > self.cash:
            return None
        self.cash -= commission
        self.ticket_counter += 1
        tp_price = None
        sl_price = None
        if tp_pips is not None:
            tp_dist = pips_to_price(self.symbol, tp_pips)
            tp_price = exec_price + tp_dist if action.upper() == 'BUY' else exec_price - tp_dist
        if sl_pips is not None:
            sl_dist = pips_to_price(self.symbol, sl_pips)
            sl_price = exec_price - sl_dist if action.upper() == 'BUY' else exec_price + sl_dist
        pos = Position(self.ticket_counter, action, exec_price, volume, timestamp,
                       self.symbol, tp_price, sl_price, comment, magic)
        self.positions.append(pos)
        return pos

    def close_position(self, position: Position, close_price: float, close_time: datetime,
                       close_pct: float = 1.0, skip_spread: bool = False):
        if position.exit_price is not None:
            return
        if skip_spread:
            exec_price = close_price
        else:
            exec_price = self.get_bid(close_price) if position.is_buy() else self.get_ask(close_price)
            exec_price = self.apply_slippage(exec_price, not position.is_buy())
        close_volume = position.volume * close_pct
        pnl = compute_pnl(self.symbol, position.entry_price, exec_price, close_volume, position.is_buy())
        position.closed_volume += close_volume
        self.cash += pnl
        if close_pct >= 1.0 or position.closed_volume >= position.volume:
            position.exit_price = exec_price
            position.exit_time = close_time
            position.pnl = compute_pnl(self.symbol, position.entry_price, exec_price, position.volume, position.is_buy())
            self.positions.remove(position)
            self.closed_trades.append({
                'ticket': position.ticket,
                'symbol': position.symbol,
                'action': position.action,
                'entry_time': position.entry_time.isoformat(),
                'exit_time': close_time.isoformat(),
                'entry_price': round(position.entry_price, 5),
                'exit_price': round(exec_price, 5),
                'volume': round(position.volume, 5),
                'pnl': round(position.pnl, 2),
                'balance': round(self.cash, 2),
                'comment': position.comment,
                'magic': position.magic,
            })
        else:
            remaining = position.volume - position.closed_volume
            self.closed_trades.append({
                'ticket': position.ticket,
                'symbol': position.symbol,
                'action': position.action,
                'entry_time': position.entry_time.isoformat(),
                'exit_time': close_time.isoformat(),
                'entry_price': round(position.entry_price, 5),
                'exit_price': round(exec_price, 5),
                'volume': round(close_volume, 5),
                'pnl': round(pnl, 2),
                'balance': round(self.cash, 2),
                'comment': f'{position.comment} [PARTIAL {close_pct*100:.0f}%]',
                'magic': position.magic,
            })

    def close_all_positions(self, close_price: float, close_time: datetime):
        for pos in list(self.positions):
            self.close_position(pos, close_price, close_time)

    def cancel_all(self):
        self.positions.clear()

    def total_open_volume(self) -> float:
        return sum(p.volume - p.closed_volume for p in self.positions)

    def open_position_count(self, magic: int = None) -> int:
        if magic is not None:
            return sum(1 for p in self.positions if p.magic == magic)
        return len(self.positions)

    def positions_by_magic(self, magic: int) -> list[Position]:
        return [p for p in self.positions if p.magic == magic]

    def total_unrealized_pnl(self, current_price: float) -> float:
        return sum(p.unrealized_pnl(current_price) for p in self.positions)

    def equity(self, current_price: float) -> float:
        return self.cash + self.total_unrealized_pnl(current_price)

    def margin_used(self) -> float:
        total = 0.0
        for p in self.positions:
            margin = (p.entry_price * (p.volume - p.closed_volume) * self.contract_multiplier) / self.leverage
            total += margin
        return total

    def free_margin(self, current_price: float) -> float:
        return self.equity(current_price) - self.margin_used()

    def record_equity(self, price: float, timestamp: datetime):
        self.equity_curve.append({
            'time': timestamp.isoformat(),
            'equity': round(self.equity(price), 2),
            'balance': round(self.cash, 2),
            'margin': round(self.margin_used(), 2),
        })

    def process_bars(self, high: float, low: float, current_time: datetime):
        for pos in list(self.positions):
            if pos.check_exit(high, low, current_time):
                exit_price = pos.exit_price
                pos.exit_price = None
                self.close_position(pos, exit_price, current_time, skip_spread=True)


class BaseStrategy:
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        self.broker = broker
        self.config = config or {}
        self.symbol = config.get('symbol', 'EURUSD')

    def on_event(self, current_time: datetime, current_data: pd.Series, df: pd.DataFrame = None):
        raise NotImplementedError

    def on_bar(self, current_time: datetime, current_data: pd.Series, df: pd.DataFrame = None):
        pass


class SMCStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.fixed_volume = self.config.get('fixed_volume', 0.1)
        self.tp_pips = self.config.get('tp_pips', 50)
        self.sl_pips = self.config.get('sl_pips', 20)
        self.use_smc = self.config.get('use_smc', True)
        self.sma_period = self.config.get('sma_period', 20)
        self.atr_period = self.config.get('atr_period', 14)
        self.use_sma_filter = self.config.get('use_sma_filter', True)
        self.use_atr_sl = self.config.get('use_atr_sl', False)
        self.max_positions = self.config.get('max_positions', 1)
        self.grid_mode = self.config.get('grid_mode', False)
        self.grid_spacing_pips = self.config.get('grid_spacing_pips', 100)
        self.grid_max_levels = self.config.get('grid_max_levels', 3)

    def _compute_sma(self, df: pd.DataFrame, period: int = None) -> Optional[float]:
        period = period or self.sma_period
        if df is None or len(df) < period:
            return None
        return df['close'].astype(float).iloc[-period:].mean()

    def _compute_atr(self, df: pd.DataFrame, period: int = None) -> Optional[float]:
        period = period or self.atr_period
        if df is None or len(df) < period + 1:
            return None
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ], axis=1).max(axis=1)
        return tr.iloc[-period:].mean()

    def _compute_rsi(self, df: pd.DataFrame, period: int = 14) -> Optional[float]:
        if df is None or len(df) < period + 1:
            return None
        close = df['close'].astype(float)
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.iloc[-period:].mean()
        avg_loss = loss.iloc[-period:].mean()
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def _compute_macd(self, df: pd.DataFrame) -> tuple:
        close = df['close'].astype(float)
        ema12 = close.ewm(span=12).mean()
        ema26 = close.ewm(span=26).mean()
        macd_line = ema12 - ema26
        signal = macd_line.ewm(span=9).mean()
        histogram = macd_line - signal
        return macd_line.iloc[-1], signal.iloc[-1], histogram.iloc[-1]

    def _compute_bollinger(self, df: pd.DataFrame, period: int = 20) -> tuple:
        close = df['close'].astype(float)
        sma = close.iloc[-period:].mean()
        std = close.iloc[-period:].std()
        return sma + 2 * std, sma, sma - 2 * std

    def _compute_stochastic(self, df: pd.DataFrame, period: int = 14) -> tuple:
        low = df['low'].astype(float).iloc[-period:]
        high = df['high'].astype(float).iloc[-period:]
        close = df['close'].astype(float).iloc[-1]
        lowest = low.min()
        highest = high.max()
        if highest == lowest:
            return 50.0, 50.0
        k = ((close - lowest) / (highest - lowest)) * 100
        return k, k

    def on_event(self, current_time: datetime, current_data: pd.Series, df: pd.DataFrame = None):
        close = current_data.get('close', current_data.get('Close', 0))
        high = current_data.get('high', current_data.get('High', 0))
        low = current_data.get('low', current_data.get('Low', 0))
        self.broker.process_bars(high, low, current_time)
        self._manage_grid(current_time, current_data, df)
        self._generate_entry_signals(current_time, current_data, df)
        self.broker.record_equity(close, current_time)

    def _manage_grid(self, current_time: datetime, current_data: pd.Series, df: pd.DataFrame = None):
        if not self.grid_mode or df is None:
            return
        close = current_data.get('close', 0)
        positions = self.broker.positions_by_magic(0)
        if len(positions) >= self.grid_max_levels:
            return
        if len(positions) == 0:
            self._generate_entry_signals(current_time, current_data, df)
            if self.broker.open_position_count(0) == 0 and df is not None and len(df) >= 3:
                prev = df.iloc[-2]
                prev_high = prev.get('high', 0)
                if close > prev_high:
                    self.broker.execute_market_order('BUY', close, self.fixed_volume, current_time,
                                                     tp_pips=self.tp_pips, sl_pips=self.sl_pips,
                                                     comment='GRID', magic=0)
            return
        last_pos = positions[-1]
        if last_pos.is_buy():
            grid_price = last_pos.entry_price - pips_to_price(self.symbol, self.grid_spacing_pips)
            if close <= grid_price:
                self.broker.execute_market_order('BUY', close, self.fixed_volume, current_time,
                                                 tp_pips=self.tp_pips, sl_pips=self.sl_pips,
                                                 comment='GRID', magic=0)
        else:
            grid_price = last_pos.entry_price + pips_to_price(self.symbol, self.grid_spacing_pips)
            if close >= grid_price:
                self.broker.execute_market_order('SELL', close, self.fixed_volume, current_time,
                                                 tp_pips=self.tp_pips, sl_pips=self.sl_pips,
                                                 comment='GRID', magic=0)

    def _generate_entry_signals(self, current_time: datetime, current_data: pd.Series, df: pd.DataFrame = None):
        if self.broker.open_position_count(0) >= self.max_positions:
            return
        close = current_data.get('close', current_data.get('Close', 0))
        open_ = current_data.get('open', current_data.get('Open', 0))
        high = current_data.get('high', current_data.get('High', 0))
        low = current_data.get('low', current_data.get('Low', 0))

        sma = self._compute_sma(df) if self.use_sma_filter else None
        trend_up = (close > sma) if sma is not None else True
        trend_down = (close < sma) if sma is not None else True

        atr = self._compute_atr(df)
        rsi = self._compute_rsi(df)
        macd_line, signal, _ = self._compute_macd(df) if df is not None and len(df) > 26 else (None, None, None)
        bb_upper, bb_mid, bb_lower = self._compute_bollinger(df) if df is not None and len(df) > 20 else (None, None, None)

        signal_type = None
        score_buy = 0
        score_sell = 0

        if df is not None and len(df) >= 3:
            prev = df.iloc[-2]
            prev_close = prev.get('close', 0)
            prev_low = prev.get('low', 0)
            prev_high = prev.get('high', 0)
            is_bullish = close > open_ and low > prev_low and high > prev_high
            is_bearish = close < open_ and high < prev_high and low < prev_low
            fvg_bull = low > prev_high
            fvg_bear = high < prev_low

            if is_bullish:
                score_buy += 30
            if fvg_bull:
                score_buy += 25
            if is_bearish:
                score_sell += 30
            if fvg_bear:
                score_sell += 25

        if sma is not None:
            if close > sma:
                score_buy += 10
            if close < sma:
                score_sell += 10
        if rsi is not None:
            if rsi < 30:
                score_buy += 15
            if rsi > 70:
                score_sell += 15
        if macd_line is not None and signal is not None:
            if macd_line > signal:
                score_buy += 10
            if macd_line < signal:
                score_sell += 10
        if bb_upper is not None and bb_lower is not None:
            if close <= bb_lower:
                score_buy += 10
            if close >= bb_upper:
                score_sell += 10
        if atr is not None and atr > 0:
            pass

        if trend_down:
            score_sell += 5
        if trend_up:
            score_buy += 5

        min_score = self.config.get('min_entry_score', 40)
        if score_buy >= min_score and score_buy > score_sell:
            signal_type = 'BUY'
        elif score_sell >= min_score and score_sell > score_buy:
            signal_type = 'SELL'

        if signal_type:
            tp = self.tp_pips
            sl = self.sl_pips
            if self.use_atr_sl and atr is not None:
                atr_val = atr
                tp = max(int(price_to_pips(self.symbol, atr_val * 2.0)), 10)
                sl = max(int(price_to_pips(self.symbol, atr_val * 1.0)), 5)
            self.broker.execute_market_order(signal_type, close, self.fixed_volume, current_time,
                                             tp_pips=tp, sl_pips=sl, comment='SMC', magic=0)


class GoldScalperStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.fixed_volume = self.config.get('fixed_volume', 0.1)
        self.grid_levels = self.config.get('grid_levels', 3)
        self.grid_multiplier = self.config.get('grid_multiplier', 1.5)
        self.tp_pips = self.config.get('tp_pips', 50)
        self.sl_pips = self.config.get('sl_pips', 20)
        self.atr_period = self.config.get('atr_period', 14)
        self.use_trailing = self.config.get('use_trailing', True)
        self.ma200_period = self.config.get('ma200_period', 200)
        self.session_filter = self.config.get('session_filter', False)
        self.max_spread = self.config.get('max_spread', 5.0)

    def _compute_atr(self, df, period=None):
        period = period or self.atr_period
        if df is None or len(df) < period + 1:
            return None
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.iloc[-period:].mean()

    def _compute_sma(self, df, period):
        if df is None or len(df) < period:
            return None
        return df['close'].astype(float).iloc[-period:].mean()

    def _compute_rsi(self, df, period=14):
        if df is None or len(df) < period + 1:
            return 50.0
        close = df['close'].astype(float)
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.iloc[-period:].mean()
        avg_loss = loss.iloc[-period:].mean()
        if avg_loss == 0:
            return 100.0
        return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))

    def on_event(self, current_time, current_data, df=None):
        close = current_data.get('close', 0)
        high = current_data.get('high', 0)
        low = current_data.get('low', 0)
        spread = current_data.get('spread', self.broker.spread)
        self.broker.process_bars(high, low, current_time)
        if spread > self.max_spread:
            self.broker.record_equity(close, current_time)
            return
        self._manage_grid(current_time, current_data, df)
        self._trail_positions(current_time, current_data, df)
        self.broker.record_equity(close, current_time)

    def _manage_grid(self, current_time, current_data, df=None):
        close = current_data.get('close', 0)
        positions = self.broker.positions_by_magic(9999)
        if len(positions) >= self.grid_levels:
            return
        atr = self._compute_atr(df)
        sma200 = self._compute_sma(df, self.ma200_period) if df is not None else None
        rsi = self._compute_rsi(df) if df is not None else 50

        if sma200 is not None and close < sma200:
            return
        if rsi > 70:
            return

        grid_volume = self.fixed_volume
        if len(positions) > 0:
            grid_volume = self.fixed_volume * (self.grid_multiplier ** len(positions))

        tp = self.tp_pips
        sl = self.sl_pips
        if atr is not None:
            tp = max(int(atr / self.broker.pip_size * 2), 10)
            sl = max(int(atr / self.broker.pip_size * 1), 5)

        if len(positions) == 0 and df is not None and len(df) >= 3:
            prev = df.iloc[-2]
            prev_high = prev.get('high', 0)
            prev_low = prev.get('low', 0)
            if close > prev_high:
                self.broker.execute_market_order('BUY', close, grid_volume, current_time,
                                                 tp_pips=tp, sl_pips=sl, comment='GOLD_GRID', magic=9999)
        if len(positions) > 0:
            last = positions[-1]
            spacing = tp * 0.5
            if last.is_buy() and close <= last.entry_price - pips_to_price(self.symbol, max(spacing, 10)):
                self.broker.execute_market_order('BUY', close, grid_volume, current_time,
                                                 tp_pips=tp, sl_pips=sl, comment='GOLD_GRID', magic=9999)

    def _trail_positions(self, current_time, current_data, df=None):
        if not self.use_trailing:
            return
        close = current_data.get('close', 0)
        atr = self._compute_atr(df)
        for pos in self.broker.positions_by_magic(9999):
            if pos.is_buy() and close > pos.entry_price:
                trail_dist = pips_to_price(self.symbol, max(self.tp_pips, 10)) if atr is None else atr * 1.5
                new_sl = close - trail_dist
                if pos.sl_price is None or new_sl > pos.sl_price:
                    pos.sl_price = new_sl


class SharkBotStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.fixed_volume = self.config.get('fixed_volume', 0.1)
        self.tp_pips = self.config.get('tp_pips', 80)
        self.sl_pips = self.config.get('sl_pips', 30)
        self.atr_period = self.config.get('atr_period', 14)
        self.min_fvg_ratio = self.config.get('min_fvg_ratio', 0.5)
        self.partial_close_pct = self.config.get('partial_close_pct', 0.5)
        self.use_breakeven = self.config.get('use_breakeven', True)
        self.min_volume_ratio = self.config.get('min_volume_ratio', 0.0)

    def _compute_atr(self, df, period=None):
        period = period or self.atr_period
        if df is None or len(df) < period + 1:
            return None
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.iloc[-period:].mean()

    def on_event(self, current_time, current_data, df=None):
        close = current_data.get('close', 0)
        high = current_data.get('high', 0)
        low = current_data.get('low', 0)
        volume = current_data.get('volume', 0)
        self.broker.process_bars(high, low, current_time)
        self._check_partial_close(current_time, current_data)
        if self.broker.open_position_count(9876) == 0:
            self._look_for_fvg(current_time, current_data, df)
        self.broker.record_equity(close, current_time)

    def _check_partial_close(self, current_time, current_data):
        if self.partial_close_pct <= 0 or self.partial_close_pct >= 1.0:
            return
        close = current_data.get('close', 0)
        for pos in list(self.broker.positions_by_magic(9876)):
            if pos.closed_volume > 0:
                continue
            if pos.is_buy() and pos.tp_price and close >= pos.entry_price + (pos.tp_price - pos.entry_price) * 0.5:
                self.broker.close_position(pos, close, current_time, close_pct=self.partial_close_pct)
                # C5: move SL to breakeven after partial close
                if self.use_breakeven:
                    if pos.exit_price is None:
                        pos.sl_price = pos.entry_price
                    else:
                        remaining_pos = [p for p in self.broker.positions_by_magic(9876) if p.ticket == pos.ticket and p.exit_price is None]
                        for rp in remaining_pos:
                            rp.sl_price = rp.entry_price
            elif not pos.is_buy() and pos.tp_price and close <= pos.entry_price - (pos.entry_price - pos.tp_price) * 0.5:
                self.broker.close_position(pos, close, current_time, close_pct=self.partial_close_pct)
                # C5: move SL to breakeven after partial close
                if self.use_breakeven:
                    if pos.exit_price is None:
                        pos.sl_price = pos.entry_price
                    else:
                        remaining_pos = [p for p in self.broker.positions_by_magic(9876) if p.ticket == pos.ticket and p.exit_price is None]
                        for rp in remaining_pos:
                            rp.sl_price = rp.entry_price

    def _look_for_fvg(self, current_time, current_data, df=None):
        if df is None or len(df) < 3:
            return
        close = current_data.get('close', 0)
        volume = current_data.get('volume', 0)
        prev = df.iloc[-2]
        prev2 = df.iloc[-3]
        prev_high = prev.get('high', 0)
        prev_low = prev.get('low', 0)
        prev2_high = prev2.get('high', 0)
        prev2_low = prev2.get('low', 0)
        atr = self._compute_atr(df)
        if atr is None:
            return

        fvg_bull = prev_low > prev2_high
        fvg_bear = prev_high < prev2_low
        fvg_size = abs(prev_low - prev2_high) if fvg_bull else abs(prev_high - prev2_low)
        fvg_ratio = fvg_size / atr if atr > 0 else 0

        # C6: volume filter (match live engine)
        avg_volume = df['volume'].astype(float).iloc[-20:].mean() if len(df) >= 20 else 0
        volume_ok = self.min_volume_ratio <= 0 or volume >= self.min_volume_ratio * avg_volume

        # C6: SMA50 and discount zone (match live engine)
        sma50 = df['close'].astype(float).iloc[-50:].mean() if len(df) >= 50 else None
        swing_high_20 = df['high'].astype(float).iloc[-21:-1].max() if len(df) >= 21 else None
        swing_low_20 = df['low'].astype(float).iloc[-21:-1].min() if len(df) >= 21 else None
        nivel50 = None
        if swing_high_20 is not None and swing_low_20 is not None:
            nivel50 = swing_low_20 + (swing_high_20 - swing_low_20) * 0.5

        if fvg_bull and fvg_ratio >= self.min_fvg_ratio and volume_ok:
            retrace = prev_low * 0.999
            # C6: discount zone + SMA50 filter
            buy_allowed = True
            if sma50 is not None and nivel50 is not None:
                buy_allowed = close <= nivel50 and close > sma50
            if close <= retrace and buy_allowed:
                # C4: dynamic SL/TP based on swing low / ATR
                if swing_low_20 is not None:
                    sl_price = swing_low_20
                    risk_pct = abs(close - sl_price) / close
                    if risk_pct < 0.001:
                        sl_price = close * 0.995
                else:
                    sl_price = close * 0.995
                tp_price = close + (close - sl_price) * 2
                sl_dist = abs(close - sl_price)
                tp_dist = abs(tp_price - close)
                sl_pips = sl_dist / self.broker.pip_size if self.broker.pip_size > 0 else self.sl_pips
                tp_pips = tp_dist / self.broker.pip_size if self.broker.pip_size > 0 else self.tp_pips
                self.broker.execute_market_order('BUY', close, self.fixed_volume, current_time,
                                                 tp_pips=tp_pips, sl_pips=sl_pips,
                                                 comment='SHARK_FVG', magic=9876)

        if fvg_bear and fvg_ratio >= self.min_fvg_ratio and volume_ok:
            retrace = prev_high * 1.001
            # C6: discount zone + SMA50 filter
            sell_allowed = True
            if sma50 is not None and nivel50 is not None:
                sell_allowed = close >= nivel50 and close < sma50
            if close >= retrace and sell_allowed:
                # C4: dynamic SL/TP based on swing high / ATR
                if swing_high_20 is not None:
                    sl_price = swing_high_20
                    risk_pct = abs(sl_price - close) / close
                    if risk_pct < 0.001:
                        sl_price = close * 1.005
                else:
                    sl_price = close * 1.005
                tp_price = close - (sl_price - close) * 2
                sl_dist = abs(sl_price - close)
                tp_dist = abs(close - tp_price)
                sl_pips = sl_dist / self.broker.pip_size if self.broker.pip_size > 0 else self.sl_pips
                tp_pips = tp_dist / self.broker.pip_size if self.broker.pip_size > 0 else self.tp_pips
                self.broker.execute_market_order('SELL', close, self.fixed_volume, current_time,
                                                 tp_pips=tp_pips, sl_pips=sl_pips,
                                                 comment='SHARK_FVG', magic=9876)


class BitcoinProStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.fixed_volume = self.config.get('fixed_volume', 0.01)
        self.tp_pips = self.config.get('tp_pips', 500)
        self.sl_pips = self.config.get('sl_pips', 200)
        self.ema_fast = self.config.get('ema_fast', 50)
        self.ema_slow = self.config.get('ema_slow', 200)
        self.atr_period = self.config.get('atr_period', 14)
        self.min_entry_score = self.config.get('min_entry_score', 50)

    def _compute_ema(self, df, period):
        if df is None or len(df) < period:
            return None
        return df['close'].astype(float).ewm(span=period).mean().iloc[-1]

    def _compute_atr(self, df, period=None):
        period = period or self.atr_period
        if df is None or len(df) < period + 1:
            return None
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.iloc[-period:].mean()

    def _compute_rsi(self, df, period=14):
        if df is None or len(df) < period + 1:
            return 50.0
        close = df['close'].astype(float)
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.iloc[-period:].mean()
        avg_loss = loss.iloc[-period:].mean()
        if avg_loss == 0:
            return 100.0
        return 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))

    def on_event(self, current_time, current_data, df=None):
        close = current_data.get('close', 0)
        high = current_data.get('high', 0)
        low = current_data.get('low', 0)
        self.broker.process_bars(high, low, current_time)
        if self.broker.open_position_count(444111) == 0:
            self._check_entry(current_time, current_data, df)
        self.broker.record_equity(close, current_time)

    def _check_entry(self, current_time, current_data, df=None):
        if df is None or len(df) < self.ema_slow + 5:
            return
        close = current_data.get('close', 0)
        ema_fast_val = self._compute_ema(df, self.ema_fast)
        ema_slow_val = self._compute_ema(df, self.ema_slow)
        atr = self._compute_atr(df)
        rsi = self._compute_rsi(df)
        if None in (ema_fast_val, ema_slow_val, atr):
            return
        prev_ema_fast = df['close'].astype(float).ewm(span=self.ema_fast).mean().iloc[-2]
        prev_ema_slow = df['close'].astype(float).ewm(span=self.ema_slow).mean().iloc[-2]

        score_bull = 0
        score_bear = 0
        score_bull += 30 if ema_fast_val > ema_slow_val else 0
        score_bear += 30 if ema_fast_val < ema_slow_val else 0
        slope_fast = (ema_fast_val - prev_ema_fast) / prev_ema_fast
        score_bull += 15 if slope_fast > 0 else 0
        score_bear += 15 if slope_fast < 0 else 0
        if ema_fast_val > ema_slow_val:
            distance = (close - ema_fast_val) / atr if atr > 0 else 0
            score_bull += 25 if 0 < distance < 2 else 0
        if ema_fast_val < ema_slow_val:
            distance = (ema_fast_val - close) / atr if atr > 0 else 0
            score_bear += 25 if 0 < distance < 2 else 0
        score_bull += 20 if 40 <= (rsi or 50) <= 60 else 0
        score_bear += 20 if 40 <= (rsi or 50) <= 60 else 0

        tp = self.tp_pips
        sl = self.sl_pips
        if atr is not None and atr > 0:
            tp = max(int(atr / self.broker.pip_size * 3), 100)
            sl = max(int(atr / self.broker.pip_size * 1.5), 50)

        if score_bull >= self.min_entry_score and score_bull > score_bear:
            self.broker.execute_market_order('BUY', close, self.fixed_volume, current_time,
                                             tp_pips=tp, sl_pips=sl, comment='BTC_PRO', magic=444111)
        elif score_bear >= self.min_entry_score and score_bear > score_bull:
            self.broker.execute_market_order('SELL', close, self.fixed_volume, current_time,
                                             tp_pips=tp, sl_pips=sl, comment='BTC_PRO', magic=444111)


class TrendFollowingStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.fixed_volume = self.config.get('fixed_volume', 0.1)
        self.tp_pips = self.config.get('tp_pips', 80)
        self.sl_pips = self.config.get('sl_pips', 30)
        self.sma_fast = self.config.get('sma_fast', 10)
        self.sma_slow = self.config.get('sma_slow', 50)
        self.atr_period = self.config.get('atr_period', 14)
        self.use_trailing = self.config.get('use_trailing', True)

    def _compute_sma(self, df, period):
        if df is None or len(df) < period:
            return None
        return df['close'].astype(float).iloc[-period:].mean()

    def _compute_atr(self, df, period=None):
        period = period or self.atr_period
        if df is None or len(df) < period + 1:
            return None
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.iloc[-period:].mean()

    def on_event(self, current_time, current_data, df=None):
        close = current_data.get('close', 0)
        high = current_data.get('high', 0)
        low = current_data.get('low', 0)
        self.broker.process_bars(high, low, current_time)
        if self.broker.open_position_count(0) == 0:
            self._check_entry(current_time, current_data, df)
        self._update_trailing(close)
        self.broker.record_equity(close, current_time)

    def _check_entry(self, current_time, current_data, df=None):
        if df is None or len(df) < self.sma_slow + 5:
            return
        close = current_data.get('close', 0)
        sma_f = self._compute_sma(df, self.sma_fast)
        sma_s = self._compute_sma(df, self.sma_slow)
        atr = self._compute_atr(df)
        if None in (sma_f, sma_s):
            return
        prev_sma_f = df['close'].astype(float).iloc[-(self.sma_fast + 1):-1].mean()
        tp = self.tp_pips
        sl = self.sl_pips
        if atr is not None and atr > 0:
            tp = max(int(atr / self.broker.pip_size * 3), 20)
            sl = max(int(atr / self.broker.pip_size * 1.5), 10)
        if sma_f > sma_s and close > sma_f:
            self.broker.execute_market_order('BUY', close, self.fixed_volume, current_time,
                                             tp_pips=tp, sl_pips=sl, comment='TREND', magic=0)
        elif sma_f < sma_s and close < sma_f:
            self.broker.execute_market_order('SELL', close, self.fixed_volume, current_time,
                                             tp_pips=tp, sl_pips=sl, comment='TREND', magic=0)

    def _update_trailing(self, price):
        if not self.use_trailing:
            return
        for pos in self.broker.positions:
            if pos.is_buy() and price > pos.entry_price:
                new_sl = price - pips_to_price(self.symbol, self.sl_pips * 0.5)
                if pos.sl_price is None or new_sl > pos.sl_price:
                    pos.sl_price = new_sl
            elif not pos.is_buy() and price < pos.entry_price:
                new_sl = price + pips_to_price(self.symbol, self.sl_pips * 0.5)
                if pos.sl_price is None or new_sl < pos.sl_price:
                    pos.sl_price = new_sl


class XGBoostStrategy(SMCStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.model = None
        self.lookback = self.config.get('lookback', 20)
        self.feature_cols = ['close', 'high', 'low', 'volume', 'rsi', 'sma', 'atr']
        self._model_trained = False

    def _train_model(self, df):
        try:
            from xgboost import XGBClassifier
        except ImportError:
            return False
        try:
            n = len(df)
            if n < 100:
                return False
            features = pd.DataFrame()
            close = df['close'].astype(float)
            features['close'] = close
            features['high'] = df['high'].astype(float)
            features['low'] = df['low'].astype(float)
            features['volume'] = df['volume'].astype(float).fillna(0)
            features['sma'] = close.rolling(20).mean().fillna(method='bfill')
            features['atr'] = self._compute_atr_series(df).fillna(method='bfill')
            rsi_series = close.diff()
            gain = rsi_series.clip(lower=0).rolling(14).mean()
            loss = (-rsi_series).clip(lower=0).rolling(14).mean()
            rs = gain / loss.replace(0, float('nan'))
            features['rsi'] = (100.0 - (100.0 / (1.0 + rs))).fillna(50)
            features = features.fillna(0)
            features = features.replace([float('inf'), float('-inf')], 0)
            future_ret = close.shift(-5) / close - 1
            y = (future_ret > 0.005).astype(int)
            valid = y.notna()
            X = features[valid].values
            y = y[valid].values
            if len(X) < 50 or len(np.unique(y)) < 2:
                return False
            self.model = XGBClassifier(n_estimators=50, max_depth=3, random_state=42, use_label_encoder=False, verbosity=0)
            self.model.fit(X, y)
            self._model_trained = True
            self.feature_cols = list(features.columns)
            return True
        except Exception:
            return False

    def _compute_atr_series(self, df, period=14):
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        close = df['close'].astype(float)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.rolling(period).mean()

    def _generate_entry_signals(self, current_time, current_data, df):
        if df is None or len(df) < self.lookback + 1:
            return super()._generate_entry_signals(current_time, current_data, df)
        if not self._model_trained and len(df) >= 100:
            self._train_model(df)
        if self.model is None or not self._model_trained:
            return super()._generate_entry_signals(current_time, current_data, df)
        try:
            recent = df.iloc[-self.lookback:]
            features = pd.DataFrame()
            close = recent['close'].astype(float)
            features['close'] = close
            features['high'] = recent['high'].astype(float)
            features['low'] = recent['low'].astype(float)
            features['volume'] = recent['volume'].astype(float).fillna(0)
            features['sma'] = close.rolling(20, min_periods=1).mean()
            atr_series = self._compute_atr_series(recent)
            features['atr'] = atr_series.fillna(method='bfill')
            rsi_series = close.diff()
            gain = rsi_series.clip(lower=0).rolling(14, min_periods=1).mean()
            loss = (-rsi_series).clip(lower=0).rolling(14, min_periods=1).mean()
            rs = gain / loss.replace(0, float('nan'))
            features['rsi'] = (100.0 - (100.0 / (1.0 + rs))).fillna(50)
            features = features.fillna(0).replace([float('inf'), float('-inf')], 0)
            x_input = features.values.flatten().reshape(1, -1)
            pred = self.model.predict(x_input)[0]
            proba = self.model.predict_proba(x_input)[0]
            if pred == 1 and max(proba) > 0.55:
                return super()._generate_entry_signals(current_time, current_data, df)
        except Exception:
            pass
        return super()._generate_entry_signals(current_time, current_data, df)


class WolfBotStrategy(BaseStrategy):
    def __init__(self, broker: RadarFXBroker, config: dict = None):
        super().__init__(broker, config)
        self.swing_period = self.config.get('swing_period', 10)
        self.fixed_volume = self.config.get('fixed_volume', 0.1)
        self.risk_percent = self.config.get('risk_percent', 1.0)
        self.min_rr = self.config.get('min_rr', 2.0)
        self.breakeven_padding_pips = self.config.get('breakeven_padding_pips', 20)
        self.atr_period = self.config.get('atr_period', 14)
        self.magic_wolf = self.config.get('magic', 7777)
        self.session_filter = self.config.get('session_filter', False)
        self.asian_start = self.config.get('asian_session_start', 0)
        self.asian_end = self.config.get('asian_session_end', 9)
        self.aggressive = self.config.get('aggressive_mode', True)
        self.conf_c_scale = self.config.get('conf_c_scale', 0.33)
        self._tp1_ticket = None
        self._tp2_ticket = None
        self._tp1_hit = False
        self._in_position = False
        self._buf = []
        self._buf_m15 = []
        self._mtf_mode = False
        self._buf_d1 = []

    # ── Helpers using numpy arrays (fast) ──

    def _find_custom_swings_np(self, high, low):
        p = self.swing_period
        n = len(high)
        if n < p * 2 + 1: return [], []
        highs, lows = [], []
        for i in range(p, n - p):
            if high[i] == max(high[i - p:i + p + 1]):
                highs.append({'price': high[i], 'type': 'HIGH'})
            if low[i] == min(low[i - p:i + p + 1]):
                lows.append({'price': low[i], 'type': 'LOW'})
        return highs, lows

    def _get_trading_range_np(self, highs, lows, high_arr, low_arr):
        if len(highs) < 2 or len(lows) < 2 or len(high_arr) < 30: return None
        u, l = highs[-1]['price'], lows[-1]['price']
        if u <= l: return None
        h30, l30 = high_arr[-30:], low_arr[-30:]
        if not np.any(h30 >= u * 0.995) or not np.any(l30 <= l * 1.005): return None
        return {'upper': u, 'lower': l, 'middle': (u + l) / 2}

    def _detect_wyckoff_phase_np(self, o, h, l, c, atr, tr, n):
        if n < 30 or not tr: return 'NONE'
        uf, lf = tr['upper'], tr['lower']
        c_last, h_last, l_last, o_last = c[-1], h[-1], l[-1], o[-1]
        if l_last < lf and c_last > lf: return 'ACCUMULATION_PHASE_C_SPRING'
        if h_last > uf and c_last < uf: return 'DISTRIBUTION_PHASE_C_UTAD'
        if c_last - o_last > atr * 0.6 and c_last > uf and h_last > uf: return 'MARKUP_PHASE_D'
        if o_last - c_last > atr * 0.6 and c_last < lf and l_last < lf: return 'MARKDOWN_PHASE_D'
        pct = (c_last - lf) / (uf - lf + 0.001)
        if pct < 0.3: return 'ACCUMULATION_PHASE_A' if c[-1] > c[-5] else 'ACCUMULATION_PHASE_B'
        if pct > 0.7: return 'DISTRIBUTION_PHASE_A' if c[-1] < c[-5] else 'DISTRIBUTION_PHASE_B'
        rng = max(h[-10:]) - min(l[-10:])
        if c_last > uf + atr * 2 and rng < atr * 1.5: return 'REACCUMULATION_PHASE_E'
        if c_last < lf - atr * 2 and rng < atr * 1.5: return 'DISTRIBUTION_PHASE_E'
        return 'PHASE_NONE'

    def _find_swing_points_np(self, h, l, lookback=3):
        n = len(h)
        if n < lookback * 2: return []
        pts = []
        for i in range(lookback, n - lookback):
            if h[i] > max(h[i - lookback:i]) and h[i] > max(h[i + 1:i + 1 + lookback]):
                ph = [p for p in pts if p['type'] in ('HH', 'LH')]
                pts.append({'price': h[i], 'type': 'HH' if (ph and h[i] > ph[-1]['price']) else 'LH'})
            if l[i] < min(l[i - lookback:i]) and l[i] < min(l[i + 1:i + 1 + lookback]):
                pl = [p for p in pts if p['type'] in ('LL', 'HL')]
                pts.append({'price': l[i], 'type': 'LL' if (pl and l[i] < pl[-1]['price']) else 'HL'})
        return pts

    def _detect_choch(self, swings):
        if len(swings) < 3: return None
        t = [s['type'] for s in swings[-3:]]
        if t[0] in ('LL', 'LH') and t[1] == 'HL' and t[2] == 'HH': return 'BULLISH'
        if t[0] in ('HH', 'HL') and t[1] == 'LH' and t[2] == 'LL': return 'BEARISH'
        return None

    def _detect_bos(self, swings):
        if len(swings) < 2: return None
        s2 = swings[-2:]
        if s2[0]['type'] == 'HL' and s2[1]['type'] == 'HH': return 'BULLISH'
        if s2[0]['type'] == 'LH' and s2[1]['type'] == 'LL': return 'BEARISH'
        return None

    def _detect_liquidity_sweep_np(self, h, l, c, n):
        if n < 15: return None
        pl, ph = min(l[-10:-1]), max(h[-10:-1])
        if l[-1] < pl and c[-1] > pl: return 'SELL_SIDE'
        if h[-1] > ph and c[-1] < ph: return 'BUY_SIDE'
        return None

    def _find_fvgs_np(self, h, l, n):
        if n < 4: return []
        fvgs = []
        for i in range(2, n):
            if l[i] > h[i - 2]:
                gap = l[i] - h[i - 2]
                fvgs.append({'top': l[i], 'bottom': h[i - 2], 'type': 'BULLISH', 'mitigated': False, 'gapSize': gap, 'entry50': h[i - 2] + gap / 2})
            if h[i] < l[i - 2]:
                gap = l[i - 2] - h[i]
                fvgs.append({'top': l[i - 2], 'bottom': h[i], 'type': 'BEARISH', 'mitigated': False, 'gapSize': gap, 'entry50': l[i - 2] - gap / 2})
        for f in fvgs:
            if f['type'] == 'BULLISH' and l[-1] <= f['bottom']: f['mitigated'] = True
            if f['type'] == 'BEARISH' and h[-1] >= f['top']: f['mitigated'] = True
        return fvgs

    def _find_order_blocks_np(self, o, h, l, c, n):
        if n < 5: return []
        blocks = []
        for i in range(3, n - 1):
            if c[i - 1] < o[i - 1] and c[i] > o[i] and c[i] > h[i - 1]:
                blocks.append({'top': max(o[i - 1], c[i - 1]), 'bottom': min(o[i - 1], c[i - 1]), 'type': 'DEMAND', 'mitigated': False})
            if c[i - 1] > o[i - 1] and c[i] < o[i] and c[i] < l[i - 1]:
                blocks.append({'top': max(o[i - 1], c[i - 1]), 'bottom': min(o[i - 1], c[i - 1]), 'type': 'SUPPLY', 'mitigated': False})
        for ob in blocks:
            if ob['type'] == 'DEMAND' and c[-1] < ob['bottom']: ob['mitigated'] = True
            if ob['type'] == 'SUPPLY' and c[-1] > ob['top']: ob['mitigated'] = True
        return blocks

    def _manage_be_custos(self, current_time):
        if self._tp1_hit or self._tp2_ticket is None: return
        positions = self.broker.positions_by_magic(self.magic_wolf)
        tp1_closed = all(p.ticket != self._tp1_ticket for p in positions) if self._tp1_ticket else True
        if not tp1_closed and self._tp1_ticket:
            for p in positions:
                if p.ticket == self._tp1_ticket:
                    if p.exit_price is not None or p.closed_volume >= p.volume:
                        tp1_closed = True
                    break
        if tp1_closed and self._entry_price is not None and not self._tp1_hit:
            self._tp1_hit = True
            padding = pips_to_price(self.symbol, self.breakeven_padding_pips)
            be_sl = self._entry_price + padding if self._setup_direction == 'BUY' else self._entry_price - padding
            for p in self.broker.positions_by_magic(self.magic_wolf):
                if p.ticket == self._tp2_ticket and p.exit_price is None:
                    p.sl_price = be_sl
                    p.comment = f'{p.comment} [BE+CUSTOS]'

    def on_event(self, current_time, current_data, df=None):
        close = float(current_data.get('close', 0))
        high = float(current_data.get('high', 0))
        low = float(current_data.get('low', 0))
        self.broker.process_bars(high, low, current_time)

        row = {k: (float(v) if hasattr(v, 'item') else v) for k, v in current_data.items()}
        self._buf.append(row)
        if len(self._buf) > 200:
            self._buf = self._buf[-200:]

        if self._in_position:
            self._manage_be_custos(current_time)
            if self.broker.open_position_count(self.magic_wolf) == 0:
                self._in_position = False
                self._tp1_ticket = None
                self._tp2_ticket = None
                self._tp1_hit = False

        if not self._in_position and len(self._buf) >= 30:
            self._evaluate_setup_np(current_time, current_data)

        self.broker.record_equity(close, current_time)

    def on_event_m15(self, current_time, current_data, h1_context=None):
        """Multi-timeframe: process M15 bar using H1 macro context"""
        close = float(current_data.get('close', 0))
        high = float(current_data.get('high', 0))
        low = float(current_data.get('low', 0))
        self.broker.process_bars(high, low, current_time)

        row = {k: (float(v) if hasattr(v, 'item') else v) for k, v in current_data.items()}
        self._buf_m15.append(row)
        if len(self._buf_m15) > 200:
            self._buf_m15 = self._buf_m15[-200:]

        if self._in_position:
            self._manage_be_custos(current_time)
            if self.broker.open_position_count(self.magic_wolf) == 0:
                self._in_position = False
                self._tp1_ticket = None
                self._tp2_ticket = None
                self._tp1_hit = False

        if not self._in_position and len(self._buf_m15) >= 30 and h1_context:
            self._evaluate_setup_mtf(current_time, current_data, h1_context)

        self.broker.record_equity(close, current_time)

    def _is_valid_entry_phase(self, phase, side):
        phases_buy = ['ACCUMULATION_PHASE_C_SPRING']
        phases_sell = ['DISTRIBUTION_PHASE_C_UTAD']
        if self.aggressive:
            phases_buy += ['ACCUMULATION_PHASE_B', 'MARKUP_PHASE_D', 'REACCUMULATION_PHASE_E']
            phases_sell += ['DISTRIBUTION_PHASE_B', 'MARKDOWN_PHASE_D', 'DISTRIBUTION_PHASE_E']
        if side == 'BUY': return phase in phases_buy
        if side == 'SELL': return phase in phases_sell
        return False

    def _evaluate_setup_mtf(self, current_time, current_data, h1):
        b = self._buf_m15
        n = len(b)
        if n < 20: return
        o = np.array([r['open'] for r in b], dtype=float)
        h = np.array([r['high'] for r in b], dtype=float)
        l = np.array([r['low'] for r in b], dtype=float)
        c = np.array([r['close'] for r in b], dtype=float)
        atr = float(current_data.get('_atr14', float('nan')))
        if np.isnan(atr) or atr <= 0: return

        if self.session_filter and hasattr(current_time, 'hour'):
            hr = current_time.hour
            if self.asian_start <= hr < self.asian_end:
                return

        tr = h1.get('trading_range')
        phase = h1.get('wyckoff_phase', 'NONE')
        if not tr: return

        sp = self._find_swing_points_np(h, l, 3)
        choch = self._detect_choch(sp)
        bos = self._detect_bos(sp)
        sweep = self._detect_liquidity_sweep_np(h, l, c, n)
        fvgs = self._find_fvgs_np(h, l, n)
        obs = self._find_order_blocks_np(o, h, l, c, n)

        for side in ('BUY', 'SELL'):
            valid, conf = self._classify_entry(phase, sweep, choch, bos, side)
            if not valid: continue
            entry = self._find_entry_price(side, obs, fvgs, h, l, c, n)
            sl = min(l[-10:]) - atr * 0.5 if side == 'BUY' else max(h[-10:]) + atr * 0.5
            self._open_trade(current_time, side, entry, sl, tr, atr, conf, h)
            if self._in_position: return

    def _classify_entry(self, phase, sweep, choch, bos, side):
        """Returns (is_valid, confidence) based on pattern strength"""
        valid_phase = self._is_valid_entry_phase(phase, side)

        has_choch = choch == ('BULLISH' if side == 'BUY' else 'BEARISH')
        has_bos = bos == ('BULLISH' if side == 'BUY' else 'BEARISH')
        has_sweep = sweep == ('SELL_SIDE' if side == 'BUY' else 'BUY_SIDE')

        if not valid_phase:
            return False, None

        if has_sweep and has_choch:
            return True, 'A'
        if has_sweep and has_bos and self.aggressive:
            return True, 'B'
        if has_choch and self.aggressive:
            return True, 'B'
        if has_sweep and self.aggressive:
            return True, 'C'
        if has_bos and self.aggressive:
            return True, 'C'

        return False, None

    def _open_trade(self, current_time, side, entry, sl, tr, atr, confidence, current_data):
        if side == 'BUY':
            if sl >= entry: return
            risk = entry - sl
            buy_liq = max(current_data[-20:]) if isinstance(current_data, np.ndarray) else entry
            range_h = tr['upper'] if tr else buy_liq
            tp1 = range_h
            next_liq = max(buy_liq, range_h) + risk * 0.5
            tp2 = max(entry + risk * self.min_rr, next_liq)
        else:
            if sl <= entry: return
            risk = sl - entry
            sell_liq = min(current_data[-20:]) if isinstance(current_data, np.ndarray) else entry
            range_l = tr['lower'] if tr else sell_liq
            tp1 = range_l
            next_liq = min(sell_liq, range_l) - risk * 0.5
            tp2 = min(entry - risk * self.min_rr, next_liq)
        rr1 = (tp1 - entry) / risk if side == 'BUY' else (entry - tp1) / risk
        rr2 = (tp2 - entry) / risk if side == 'BUY' else (entry - tp2) / risk
        if risk <= 0 or rr2 < self.min_rr: return
        scale = 1.0
        if confidence == 'C':
            scale = self.conf_c_scale
        lot1 = max(0.01, round(self.fixed_volume * 0.6 * scale, 2))
        lot2 = max(0.01, round(self.fixed_volume * 0.4 * scale, 2))
        p1 = self.broker.execute_limit_order(side, entry, lot1, current_time,
            tp_pips=price_to_pips(self.symbol, tp1 - entry) if side == 'BUY' and tp1 > entry else (price_to_pips(self.symbol, entry - tp1) if side == 'SELL' and entry > tp1 else None),
            sl_pips=price_to_pips(self.symbol, entry - sl) if side == 'BUY' and entry > sl else (price_to_pips(self.symbol, sl - entry) if side == 'SELL' and sl > entry else None),
            comment=f'WOLF_S1_{confidence}', magic=self.magic_wolf)
        p2 = self.broker.execute_limit_order(side, entry, lot2, current_time,
            tp_pips=price_to_pips(self.symbol, tp2 - entry) if side == 'BUY' and tp2 > entry else (price_to_pips(self.symbol, entry - tp2) if side == 'SELL' and entry > tp2 else None),
            sl_pips=price_to_pips(self.symbol, entry - sl) if side == 'BUY' and entry > sl else (price_to_pips(self.symbol, sl - entry) if side == 'SELL' and sl > entry else None),
            comment=f'WOLF_S2_{confidence}', magic=self.magic_wolf)
        if p1: self._tp1_ticket = p1.ticket
        if p2: self._tp2_ticket = p2.ticket
        self._in_position = True; self._setup_direction = side; self._entry_price = entry; self._tp1_hit = False

    def _find_entry_price(self, side, obs, fvgs, h, l, c, n):
        """Find best entry using FVG/OB, or fall back to sweep level or current price"""
        if side == 'BUY':
            demand_obs = [o for o in obs if o['type'] == 'DEMAND' and not o['mitigated']]
            bullish_fvgs = [f for f in fvgs if f['type'] == 'BULLISH' and not f['mitigated']]
            if demand_obs: return demand_obs[-1]['bottom']
            if bullish_fvgs: return bullish_fvgs[-1]['entry50']
            return min(l[-5:])  # fallback: recent low
        else:
            supply_obs = [o for o in obs if o['type'] == 'SUPPLY' and not o['mitigated']]
            bearish_fvgs = [f for f in fvgs if f['type'] == 'BEARISH' and not f['mitigated']]
            if supply_obs: return supply_obs[-1]['top']
            if bearish_fvgs: return bearish_fvgs[-1]['entry50']
            return max(h[-5:])  # fallback: recent high

    def _evaluate_setup_np(self, current_time, current_data):
        buf = self._buf
        n = len(buf)
        if n < 20: return
        o = np.array([r['open'] for r in buf], dtype=float)
        h = np.array([r['high'] for r in buf], dtype=float)
        l = np.array([r['low'] for r in buf], dtype=float)
        c = np.array([r['close'] for r in buf], dtype=float)
        atr = float(current_data.get('_atr14', float('nan')))
        if np.isnan(atr) or atr <= 0: return

        if self.session_filter and hasattr(current_time, 'hour'):
            hr = current_time.hour
            if self.asian_start <= hr < self.asian_end:
                return

        if self._mtf_mode: return

        swings_h, swings_l = self._find_custom_swings_np(h, l)
        tr = self._get_trading_range_np(swings_h, swings_l, h, l)
        phase = self._detect_wyckoff_phase_np(o, h, l, c, atr, tr, n)
        if not tr: return
        sp = self._find_swing_points_np(h, l, 3)
        choch = self._detect_choch(sp)
        bos = self._detect_bos(sp)
        sweep = self._detect_liquidity_sweep_np(h, l, c, n)
        fvgs = self._find_fvgs_np(h, l, n)
        obs = self._find_order_blocks_np(o, h, l, c, n)

        for side in ('BUY', 'SELL'):
            valid, conf = self._classify_entry(phase, sweep, choch, bos, side)
            if not valid: continue
            entry = self._find_entry_price(side, obs, fvgs, h, l, c, n)
            sl = min(l[-10:]) - atr * 0.5 if side == 'BUY' else max(h[-10:]) + atr * 0.5
            self._open_trade(current_time, side, entry, sl, tr, atr, conf, h)
            if self._in_position: return


STRATEGY_MAP = {
    'smc': SMCStrategy,
    'xgboost': XGBoostStrategy,
    'trend': TrendFollowingStrategy,
    'gold_scalper': GoldScalperStrategy,
    'shark_bot': SharkBotStrategy,
    'bitcoin_pro': BitcoinProStrategy,
    'wolf_bot': WolfBotStrategy,
}


def compute_metrics(trade_history: list, equity_curve: list, initial_capital: float) -> dict:
    if not trade_history:
        return {
            'total_trades': 0, 'win_trades': 0, 'loss_trades': 0,
            'win_rate': 0, 'total_pnl': 0, 'total_return': 0,
            'avg_win': 0, 'avg_loss': 0, 'profit_factor': 0,
            'max_drawdown': 0, 'max_drawdown_value': 0,
            'final_balance': initial_capital, 'initial_capital': initial_capital,
            'sharpe_ratio': 0, 'avg_bars_held': 0,
            'error': 'Nenhum trade executado',
        }
    df = pd.DataFrame(equity_curve) if equity_curve else pd.DataFrame()
    trades_df = pd.DataFrame(trade_history)

    total_pnl = trades_df['pnl'].sum()
    total_return = (total_pnl / initial_capital) * 100 if initial_capital > 0 else 0
    win_trades = trades_df[trades_df['pnl'] > 0]
    loss_trades = trades_df[trades_df['pnl'] < 0]
    total = len(trades_df)
    wins = len(win_trades)
    losses = len(loss_trades)
    win_rate = (wins / total) * 100 if total > 0 else 0
    gross_profit = win_trades['pnl'].sum() if wins > 0 else 0
    gross_loss = abs(loss_trades['pnl'].sum()) if losses > 0 else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (float('inf') if gross_profit > 0 else 0)
    avg_win = win_trades['pnl'].mean() if wins > 0 else 0
    avg_loss = abs(loss_trades['pnl'].mean()) if losses > 0 else 0

    max_drawdown = 0
    max_drawdown_pct = 0
    if not df.empty and 'equity' in df.columns:
        equity = df['equity'].values
        peak = np.maximum.accumulate(equity)
        drawdown_pct = ((peak - equity) / peak) * 100
        max_drawdown_pct = drawdown_pct.max()
        max_drawdown = (peak - equity).max()

    final_balance = trades_df.iloc[-1]['balance'] if total > 0 else initial_capital

    sharpe = 0
    if total > 1:
        returns = trades_df['pnl'].values / initial_capital
        if returns.std() > 0:
            sharpe = round((returns.mean() / returns.std()) * np.sqrt(252), 2)

    avg_bars_held = 0
    if 'bars_held' in trades_df.columns:
        avg_bars_held = trades_df['bars_held'].mean()

    return {
        'total_trades': total,
        'win_trades': wins,
        'loss_trades': losses,
        'win_rate': round(win_rate, 2),
        'total_pnl': round(total_pnl, 2),
        'total_return': round(total_return, 2),
        'avg_win': round(avg_win, 2),
        'avg_loss': round(avg_loss, 2),
        'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 999.99,
        'max_drawdown': round(max_drawdown_pct, 2),
        'max_drawdown_value': round(max_drawdown, 2),
        'final_balance': round(final_balance, 2),
        'initial_capital': initial_capital,
        'sharpe_ratio': sharpe,
        'avg_bars_held': round(avg_bars_held, 1),
    }


def run_backtest(df: pd.DataFrame, config: dict = None) -> dict:
    config = config or {}
    # Semente determinística para reprodutibilidade
    job_seed = config.get('seed') or hash(str(config)) % (2**31)
    np.random.seed(job_seed)
    initial_capital = config.get('initial_capital', 10000)
    commission = config.get('commission_per_lot', 3.0)
    strategy_type = config.get('strategy', 'smc')
    symbol = config.get('symbol', 'EURUSD')
    leverage = config.get('leverage', 100)

    broker = RadarFXBroker(initial_capital, commission, leverage, symbol)
    strategy_class = STRATEGY_MAP.get(strategy_type)
    if strategy_class is None:
        strategy = SMCStrategy(broker, config)
    else:
        strategy = strategy_class(broker, config)

    df = df.copy()
    col_map = {}
    for c in df.columns:
        cl = c.lower()
        if cl in ('open', 'high', 'low', 'close', 'volume'):
            col_map[c] = cl
    if col_map:
        df = df.rename(columns=col_map)
    required = ['open', 'high', 'low', 'close']
    for r in required:
        if r not in df.columns:
            raise ValueError(f'Coluna obrigatória "{r}" não encontrada no CSV')

    # Pré-computa indicadores no df completo (evita O(n²))
    close_series = df['close'].astype(float)
    df['_sma20'] = close_series.rolling(20).mean()
    df['_sma50'] = close_series.rolling(50).mean()
    df['_sma200'] = close_series.rolling(200).mean()
    high_series = df['high'].astype(float)
    low_series = df['low'].astype(float)
    tr = pd.concat([high_series - low_series,
                    (high_series - close_series.shift(1)).abs(),
                    (low_series - close_series.shift(1)).abs()], axis=1).max(axis=1)
    df['_atr14'] = tr.rolling(14).mean()
    delta = close_series.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta).clip(lower=0).rolling(14).mean()
    rs = gain / loss.replace(0, float('nan'))
    df['_rsi14'] = (100.0 - (100.0 / (1.0 + rs))).fillna(50).replace([float('inf'), float('-inf')], 50)
    ema12 = close_series.ewm(span=12).mean()
    ema26 = close_series.ewm(span=26).mean()
    df['_macd'] = ema12 - ema26
    df['_macd_signal'] = df['_macd'].ewm(span=9).mean()
    df['_bb_upper'] = close_series.rolling(20).mean() + 2 * close_series.rolling(20).std()
    df['_bb_lower'] = close_series.rolling(20).mean() - 2 * close_series.rolling(20).std()

    for idx, row_data in df.iterrows():
        open_price = float(row_data['open'])
        broker.process_pending_orders(open_price, idx)
        strategy.on_event(current_time=idx, current_data=row_data, df=df.loc[:idx])

    broker.process_pending_orders(df.iloc[-1]['close'], df.index[-1])
    if broker.positions:
        broker.close_all_positions(df.iloc[-1]['close'], df.index[-1])

    metrics = compute_metrics(broker.closed_trades, broker.equity_curve, initial_capital)
    return {
        'metrics': metrics,
        'trades': broker.closed_trades,
        'equity_curve': broker.equity_curve,
    }
