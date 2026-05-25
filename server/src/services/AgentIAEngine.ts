import axios from 'axios';
import { SymbolLockService } from './SymbolLockService';

interface Candle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface FVG {
  tipo: 'BULLISH' | 'BEARISH';
  topo: number;
  fundo: number;
  time: string;
  size: number;
}

interface LogEntry {
  time: string;
  type: 'info' | 'signal' | 'order' | 'error' | 'fvg' | 'warning' | 'metric';
  message: string;
}

interface SignalRecord {
  time: string;
  direction: string;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  outcome: 'pending' | 'win' | 'loss';
  exitTime?: string;
  exitPrice?: number;
  profit?: number;
}

type AgentConfig = {
  dailyLossLimit: number;
  maxConsecutiveLosses: number;
  cooldownMinutes: number;
  minFvgAtrRatio: number;
  maxSpread: number;
  atrSlMultiplier: number;
  atrTpMultiplier: number;
  lotBase: number;
  lotMin: number;
  lotMax: number;
};

const DEFAULT_CONFIG: AgentConfig = {
  dailyLossLimit: 10,
  maxConsecutiveLosses: 3,
  cooldownMinutes: 30,
  minFvgAtrRatio: 0.5,
  maxSpread: 30,
  atrSlMultiplier: 0.8,
  atrTpMultiplier: 1.5,
  lotBase: 0.02,
  lotMin: 0.01,
  lotMax: 0.05,
};

class AgentIAEngineClass {
  private state: {
    running: boolean;
    dryRun: boolean;
    config: AgentConfig;
    lastSignal: { direction: string; entry: number; sl: number; tp: number; rr: number; time: string } | null;
    lastFvgs: FVG[];
    lastPrice: number | null;
    atr: number;
    spread: number;
    trendM5: string;
    trendH1: string;
    confidence: number;
    dailyPnl: number;
    consecutiveLosses: number;
    cooldownUntil: number | null;
    lastUpdate: string | null;
    error: string | null;
    logs: LogEntry[];
    signals: SignalRecord[];
    lastResetDate: string | null;
  };
  private intervalId: NodeJS.Timeout | null = null;
  private symbol = 'XAU/USD';
  private symbolMt5 = 'XAUUSD';
  private maxLogs = 300;
  private maxSignals = 100;
  private pendingTickets: Map<number, { signalIndex: number; entryPrice: number; sl: number; tp: number; direction: string }> = new Map();

  constructor() {
    this.state = this.freshState();
  }

  private freshState() {
    return {
      running: false,
      dryRun: true,
      config: { ...DEFAULT_CONFIG },
      lastSignal: null,
      lastFvgs: [],
      lastPrice: null,
      atr: 0,
      spread: 0,
      trendM5: 'NEUTRAL',
      trendH1: 'NEUTRAL',
      confidence: 0,
      dailyPnl: 0,
      consecutiveLosses: 0,
      cooldownUntil: null,
      lastUpdate: null,
      error: null,
      logs: [] as LogEntry[],
      signals: [] as SignalRecord[],
      lastResetDate: null,
    };
  }

  private log(type: LogEntry['type'], message: string) {
    this.state.logs.push({ time: new Date().toISOString(), type, message });
    if (this.state.logs.length > this.maxLogs) this.state.logs = this.state.logs.slice(-this.maxLogs);
  }

  getStatus() {
    return {
      running: this.state.running,
      dryRun: this.state.dryRun,
      config: this.state.config,
      lastSignal: this.state.lastSignal,
      lastFvgs: this.state.lastFvgs.slice(-5),
      lastPrice: this.state.lastPrice,
      atr: this.state.atr,
      spread: this.state.spread,
      trendM5: this.state.trendM5,
      trendH1: this.state.trendH1,
      confidence: this.state.confidence,
      dailyPnl: this.state.dailyPnl,
      consecutiveLosses: this.state.consecutiveLosses,
      cooldownUntil: this.state.cooldownUntil,
      lastUpdate: this.state.lastUpdate,
      error: this.state.error,
    };
  }

  getLogs(count = 50) { return this.state.logs.slice(-count); }
  getSignals(count = 30) { return this.state.signals.slice(-count); }
  clearLogs() { this.state.logs = []; }
  clearSignals() { this.state.signals = []; }

  updateConfig(partial: Partial<AgentConfig>) {
    this.state.config = { ...this.state.config, ...partial };
    this.log('info', `Config atualizada: ${JSON.stringify(partial)}`);
  }

  setDryRun(v: boolean) {
    this.state.dryRun = v;
    this.log('info', v ? 'Modo Dry-Run ativado' : '⚠ Modo AO VIVO ativado — ordens reais serão enviadas');
  }

  private calcATR(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) return 0;
    let sum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const c = candles[i];
      const pc = candles[i - 1].close;
      const tr = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
      sum += tr;
    }
    return sum / period;
  }

  private async fetchTfData(timeframe: string, count: number): Promise<Candle[] | null> {
    try {
      const bridgeUrl = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
      const tfMap: Record<string, string> = { '5min': 'M5', '15min': 'M15' };
      const mt5Tf = tfMap[timeframe] || 'M5';
      const r = await axios.get(`${bridgeUrl}/candles`, {
        params: { symbol: this.symbolMt5, count, timeframe: mt5Tf },
        timeout: 10000,
      });
      const c = r.data;
      if (!c || c.length < 3) return null;
      return c.map((v: any) => ({
        datetime: v.time ? new Date(v.time * 1000).toISOString() : '',
        open: v.open, high: v.high, low: v.low, close: v.close, volume: v.tick_volume || v.volume || 0,
      }));
    } catch { return null; }
  }

  private detectFVGs(candles: Candle[], atr: number): FVG[] {
    const fvgs: FVG[] = [];
    for (let i = 2; i < candles.length; i++) {
      const v1 = candles[i - 2], v3 = candles[i];
      if (v3.low > v1.high) {
        const size = v3.low - v1.high;
        fvgs.push({ tipo: 'BULLISH', fundo: v1.high, topo: v3.low, size, time: candles[i].datetime });
      } else if (v3.high < v1.low) {
        const size = v1.low - v3.high;
        fvgs.push({ tipo: 'BEARISH', fundo: v3.high, topo: v1.low, size, time: candles[i].datetime });
      }
    }
    return fvgs;
  }

  private detectTrend(candles: Candle[]): string {
    if (candles.length < 20) return 'NEUTRAL';
    const emaFast = candles.slice(-10).reduce((s, c) => s + c.close, 0) / 10;
    const emaSlow = candles.slice(-20).reduce((s, c) => s + c.close, 0) / 20;
    if (emaFast > emaSlow * 1.002) return 'ALTA';
    if (emaFast < emaSlow * 0.998) return 'BAIXA';
    return 'NEUTRAL';
  }

  private async getMt5Data(): Promise<{ spread: number; obs: any[]; smcTrend: string }> {
    const bridgeUrl = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    try {
      const [tickRes, smcRes] = await Promise.all([
        axios.post(`${bridgeUrl}/ticks`, { symbols: [this.symbolMt5] }, { timeout: 5000 }),
        axios.get(`${bridgeUrl}/smc_levels`, { params: { symbol: this.symbolMt5, direction: 'BUY' }, timeout: 8000 }),
      ]);
      const tickData = tickRes.data || {};
      const tick = tickData[this.symbolMt5] || tickData;
      const spread = tick?.spread || 99;
      const trend = smcRes.data?.market_trend || 'NEUTRAL';
      return { spread, obs: smcRes.data?.order_blocks || {}, smcTrend: trend };
    } catch {
      return { spread: 99, obs: [], smcTrend: 'NEUTRAL' };
    }
  }

  async analyzeOnce() {
    if (this.state.cooldownUntil && Date.now() < this.state.cooldownUntil) {
      const minLeft = Math.round((this.state.cooldownUntil - Date.now()) / 60000);
      this.log('info', `⏳ Cooldown ativo — ${minLeft}min restantes`);
      return;
    }

    try {
      // Auto daily reset
      if (!this.state.lastResetDate || this.isNewDay(this.state.lastResetDate)) {
        this.resetDaily();
      }

      await this.resolvePendingSignals(this.state.lastPrice || 0);

      this.log('info', '🔍 Analisando XAU/USD multi-timeframe...');

      // 1. Fetch M5 and M15 data + MT5 data in parallel
      const [m5Candles, m15Candles, mt5Data] = await Promise.all([
        this.fetchTfData('5min', 60),
        this.fetchTfData('15min', 40),
        this.getMt5Data(),
      ]);

      if (!m5Candles || !m15Candles) {
        this.state.error = 'Dados insuficientes (MT5 bridge)';
        this.log('error', 'Dados insuficientes do MT5 bridge');
        this.state.signals.push({
          time: new Date().toISOString(),
          direction: 'AGUARDAR', entry: 0, sl: 0, tp: 0, rr: 0,
          outcome: 'pending',
        });
        return;
      }

      // 2. Calculate ATR from M15 (more stable)
      const atr = this.calcATR(m15Candles, 14);
      this.state.atr = Math.round(atr * 100) / 100;
      this.state.spread = mt5Data.spread;

      // 3. Detect trends
      const trendM5 = this.detectTrend(m5Candles);
      const trendH1 = mt5Data.smcTrend === 'BEARISH' ? 'BAIXA' : mt5Data.smcTrend === 'BULLISH' ? 'ALTA' : 'NEUTRAL';
      this.state.trendM5 = trendM5;
      this.state.trendH1 = trendH1;

      // 4. Detect FVGs on M5
      const fvgs = this.detectFVGs(m5Candles, atr);
      this.state.lastFvgs = fvgs;
      const bullishFvgs = fvgs.filter(f => f.tipo === 'BULLISH');
      const bearishFvgs = fvgs.filter(f => f.tipo === 'BEARISH');

      if (bullishFvgs.length > 0) this.log('fvg', `▲ ${bullishFvgs.length} FVG Bullish (ATR: $${atr.toFixed(2)})`);
      if (bearishFvgs.length > 0) this.log('fvg', `▼ ${bearishFvgs.length} FVG Bearish (ATR: $${atr.toFixed(2)})`);
      this.log('metric', `📊 Tendências — M5: ${trendM5} | H1: ${trendH1} | Spread: ${mt5Data.spread} | ATR: $${atr.toFixed(2)}`);

      // 5. Decision logic
      const preco = m5Candles[m5Candles.length - 1].close;
      this.state.lastPrice = Math.round(preco * 100) / 100;

      let decisao = 'AGUARDAR';
      let stopRef = 0;
      let alvoRef = 0;
      let confianca = 0;
      let motivo = '';

      const recentes = fvgs.slice(-5);

      for (const fvg of recentes.reverse()) {
        const inside = preco >= fvg.fundo && preco <= fvg.topo;
        if (!inside) continue;

        // Filter 1: Min FVG size >= 0.5×ATR
        if (fvg.size < atr * this.state.config.minFvgAtrRatio) {
          this.log('warning', `⏭ FVG ${fvg.tipo} ignorado — tamanho ${fvg.size.toFixed(2)} < ${(atr * this.state.config.minFvgAtrRatio).toFixed(2)} (0.5×ATR)`);
          continue;
        }

        // Filter 2: Price in central 40% of gap
        const gapCenter = (fvg.topo + fvg.fundo) / 2;
        const gapHalf = (fvg.topo - fvg.fundo) / 2;
        const centerZone = gapHalf * 0.4;
        if (Math.abs(preco - gapCenter) > centerZone) {
          this.log('warning', `⏭ FVG ${fvg.tipo} ignorado — preço nos extremos do gap (${((Math.abs(preco - gapCenter) / gapHalf) * 100).toFixed(0)}% do centro)`);
          continue;
        }

        // Filter 3: Max spread
        if (mt5Data.spread > this.state.config.maxSpread) {
          this.log('warning', `⏭ FVG ${fvg.tipo} ignorado — spread ${mt5Data.spread} > ${this.state.config.maxSpread}`);
          continue;
        }

        if (fvg.tipo === 'BULLISH') {
          // Filter 4: Trend confirmation
          if (trendH1 === 'BAIXA' && trendM5 !== 'ALTA') {
            this.log('warning', `⏭ COMPRA ignorada — H1 baixista, M5 sem alta`);
            continue;
          }
          decisao = 'COMPRA';
          stopRef = fvg.fundo;
          alvoRef = fvg.topo;
          confianca = trendH1 === 'ALTA' ? 85 : trendM5 === 'ALTA' ? 70 : 55;
          motivo = `FVG Bullish [${fvg.fundo.toFixed(2)}-${fvg.topo.toFixed(2)}] | H1: ${trendH1} | M5: ${trendM5}`;
          break;
        } else {
          if (trendH1 === 'ALTA' && trendM5 !== 'BAIXA') {
            this.log('warning', `⏭ VENDA ignorada — H1 altista, M5 sem baixa`);
            continue;
          }
          decisao = 'VENDA';
          stopRef = fvg.topo;
          alvoRef = fvg.fundo;
          confianca = trendH1 === 'BAIXA' ? 85 : trendM5 === 'BAIXA' ? 70 : 55;
          motivo = `FVG Bearish [${fvg.fundo.toFixed(2)}-${fvg.topo.toFixed(2)}] | H1: ${trendH1} | M5: ${trendM5}`;
          break;
        }
      }

      this.state.confidence = confianca;

      if (decisao !== 'AGUARDAR') {
        this.log('signal', `🚀 SINAL ${decisao} (${confianca}%) — ${motivo}`);
      } else {
        this.log('info', 'Nenhum sinal — sem FVG válido com confirmação');
      }

      // 6. Calculate adaptive TP/SL
      let sl = 0, tp = 0, rr = 0;
      if (decisao !== 'AGUARDAR') {
        if (decisao === 'COMPRA') {
          sl = stopRef - atr * 0.3;
          tp = preco + atr * this.state.config.atrTpMultiplier;
          if (tp < alvoRef + atr * 0.5) tp = alvoRef + atr * 0.5;
        } else {
          sl = stopRef + atr * 0.3;
          tp = preco - atr * this.state.config.atrTpMultiplier;
          if (tp > alvoRef - atr * 0.5) tp = alvoRef - atr * 0.5;
        }
        sl = Math.round(sl * 100) / 100;
        tp = Math.round(tp * 100) / 100;
        rr = Math.abs((tp - preco) / (preco - sl));
      }

      // 7. Check daily loss limit
      if (this.state.dailyPnl <= -this.state.config.dailyLossLimit) {
        this.log('warning', `⛔ Limite de perda diária atingido ($${this.state.dailyPnl.toFixed(2)}). Aguardando reset.`);
        this.state.lastSignal = {
          direction: 'BLOQUEADO', entry: preco, sl: 0, tp: 0, rr: 0,
          time: new Date().toISOString(),
        };
        this.state.lastUpdate = new Date().toISOString();
        return;
      }

      // 8. Calculate dynamic lot size
      let lot = this.state.config.lotBase;
      if (this.state.consecutiveLosses > 0) {
        lot = Math.max(this.state.config.lotMin, lot * (1 - this.state.consecutiveLosses * 0.25));
      }
      if (confianca >= 85) lot = Math.min(this.state.config.lotMax, lot * 1.5);
      lot = Math.round(lot * 100) / 100;

      // 9. Execute or simulate
      if (decisao !== 'AGUARDAR' && !this.state.dryRun) {
        this.log('order', `⏳ Enviando ${decisao} ${lot} lotes... SL: $${sl} | TP: $${tp}`);
        await this.enviarOrdemMT5(decisao, sl, tp, lot);
      } else if (decisao !== 'AGUARDAR' && this.state.dryRun) {
        this.log('warning', `🧪 Dry-Run: ${decisao} ${lot} lotes | SL: $${sl} | TP: $${tp} | ATR: $${atr.toFixed(2)} | Conf: ${confianca}%`);
      }

      // 10. Record signal (always — AGUARDAR entries show analysis history)
      this.state.signals.push({
        time: new Date().toISOString(),
        direction: decisao,
        entry: Math.round(preco * 100) / 100,
        sl, tp, rr: rr ? Math.round(rr * 100) / 100 : 0,
        outcome: 'pending',
      });
      if (this.state.signals.length > this.maxSignals) this.state.signals = this.state.signals.slice(-this.maxSignals);

      // 11. Auto-resolve Dry-Run signal after 2 cycles by simulating outcome
      if (decisao !== 'AGUARDAR' && this.state.dryRun) {
        const sigIdx = this.state.signals.length - 1;
        this.resolvePendingSignals(preco);
      }

      this.state.lastSignal = {
        direction: decisao,
        entry: Math.round(preco * 100) / 100,
        sl, tp, rr: Math.round(rr * 100) / 100,
        time: new Date().toISOString(),
      };
      this.state.lastUpdate = new Date().toISOString();
      this.state.error = null;
    } catch (e: any) {
      this.state.error = e.message;
      this.log('error', `Erro: ${e.message}`);
    }
  }

  private async enviarOrdemMT5(direcao: string, sl: number, tp: number, lot: number) {
    try {
      const bridgeUrl = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
      const action = direcao === 'COMPRA' ? 'BUY' : 'SELL';

      const resp = await axios.post(`${bridgeUrl}/order`, {
        symbol: this.symbolMt5, action, lot,
        sl, tp, magic: 202605, comment: 'IA FVG v2',
      }, { timeout: 10000 });

      if (resp.data?.status === 'success') {
        SymbolLockService.acquire(this.symbolMt5, 'Agent IA', resp.data.order_id || 0, action);
        this.log('order', `✅ Ordem #${resp.data.order_id} — ${action} ${lot} XAUUSD`);
        this.pendingTickets.set(resp.data.order_id, {
          signalIndex: this.state.signals.length - 1,
          entryPrice: this.state.lastPrice || 0,
          sl, tp,
          direction: direcao,
        });
        try {
          const { TradeNotificationBot } = require('./TradeNotificationBot');
          TradeNotificationBot.notifyTradeOpened('Agent IA', this.symbolMt5, action, lot, resp.data.price || this.state.lastPrice || 0, sl, tp);
        } catch (e) { /* notif fail */ }
      } else {
        this.log('error', `❌ Falha ordem: ${resp.data?.error || 'desconhecida'}`);
      }
    } catch (e: any) {
      this.log('error', `❌ Erro MT5: ${e.response?.data?.error || e.message}`);
    }
  }

  private async resolvePendingSignals(currentPrice: number) {
    for (const sig of this.state.signals) {
      if (sig.outcome !== 'pending') continue;
      if (sig.direction === 'AGUARDAR') { sig.outcome = 'loss'; continue; }
      if (sig.direction === 'COMPRA') {
        if (currentPrice <= sig.sl) {
          const loss = -Math.abs(sig.entry - sig.sl) * 100;
          await this.markSignalOutcome(this.state.signals.indexOf(sig), 'loss', loss);
        } else if (currentPrice >= sig.tp) {
          const gain = Math.abs(sig.tp - sig.entry) * 100;
          await this.markSignalOutcome(this.state.signals.indexOf(sig), 'win', gain);
        }
      } else if (sig.direction === 'VENDA') {
        if (currentPrice >= sig.sl) {
          const loss = -Math.abs(sig.entry - sig.sl) * 100;
          await this.markSignalOutcome(this.state.signals.indexOf(sig), 'loss', loss);
        } else if (currentPrice <= sig.tp) {
          const gain = Math.abs(sig.entry - sig.tp) * 100;
          await this.markSignalOutcome(this.state.signals.indexOf(sig), 'win', gain);
        }
      }
    }

    for (const [ticket, info] of this.pendingTickets) {
      try {
        const bridgeUrl = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
        const posRes = await axios.get(`${bridgeUrl}/positions`, { timeout: 5000 });
        const positions = posRes.data || [];
        const pos = positions.find((p: any) => p.ticket === Number(ticket));
        if (!pos) {
          const histRes = await axios.get(`${bridgeUrl}/history`, { timeout: 5000 });
          const history = histRes.data || [];
          const closed = history.find((t: any) => t.ticket === Number(ticket) || t.order === Number(ticket));
          const profit = closed?.profit || closed?.pl || 0;
          await this.markSignalOutcome(info.signalIndex, profit >= 0 ? 'win' : 'loss', profit);
          this.pendingTickets.delete(ticket);
        }
      } catch { }
    }
  }

  async markSignalOutcome(index: number, outcome: 'win' | 'loss', profit?: number) {
    if (index < 0 || index >= this.state.signals.length) return;
    this.state.signals[index].outcome = outcome;
    this.state.signals[index].exitTime = new Date().toISOString();
    if (profit !== undefined) {
      this.state.signals[index].profit = profit;
      this.state.dailyPnl += profit;
      if (outcome === 'loss') {
        this.state.consecutiveLosses++;
        if (this.state.consecutiveLosses >= this.state.config.maxConsecutiveLosses) {
          this.state.cooldownUntil = Date.now() + this.state.config.cooldownMinutes * 60000;
          this.log('warning', `⛔ ${this.state.consecutiveLosses} perdas consecutivas — cooldown ${this.state.config.cooldownMinutes}min`);
        }
      } else {
        this.state.consecutiveLosses = 0;
      }
      try {
        const { TradeNotificationBot } = require('./TradeNotificationBot');
        const sig = this.state.signals[index];
        TradeNotificationBot.notifyTradeClosed('Agent IA', this.symbolMt5, sig.direction === 'COMPRA' ? 'BUY' : 'SELL', profit, outcome === 'win' ? 'WIN' : 'LOSS', outcome === 'win' ? 'Take Profit' : 'Stop Loss', this.state.config.lotBase);
      } catch (e) { /* notif fail */ }
    }
  }

  private isNewDay(lastDate: string): boolean {
    const last = new Date(lastDate);
    const now = new Date();
    return last.getDate() !== now.getDate() || last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear();
  }

  resetDaily() {
    this.state.dailyPnl = 0;
    this.state.consecutiveLosses = 0;
    this.state.cooldownUntil = null;
    this.state.lastResetDate = new Date().toISOString();
    this.log('info', '🔄 Contadores diários resetados');
  }

  start(intervalSeconds = 60) {
    if (this.state.running) return;
    this.state.running = true;
    this.log('info', `🚀 Agente IA v2 iniciado (${intervalSeconds}s)`);
    this.log('info', this.state.dryRun ? 'Modo: Dry-Run' : '⚠ MODO AO VIVO');
    this.analyzeOnce();
    this.intervalId = setInterval(() => this.analyzeOnce(), intervalSeconds * 1000);
  }

  stop() {
    this.state.running = false;
    this.log('info', '⏹ Agente IA v2 parado');
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }
}

export const AgentIAEngine = new AgentIAEngineClass();
