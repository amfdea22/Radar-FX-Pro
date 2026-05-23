import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, Square, RefreshCw, TrendingUp, TrendingDown, Activity, Eye, EyeOff, Radio, Terminal, Trash2, Settings, RotateCcw, TrendingUp as TrendUp, TrendingDown as TrendDown, Minus, DollarSign, AlertTriangle, Zap, Target, BarChart3 } from 'lucide-react';
import axios from 'axios';

interface FVG {
  tipo: 'BULLISH' | 'BEARISH';
  topo: number;
  fundo: number;
  size: number;
  time: string;
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

interface AgentConfig {
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
}

interface AgentStatus {
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
}

const logColors: Record<string, string> = {
  info: 'text-slate-400', signal: 'text-green-400', order: 'text-cyan-400',
  error: 'text-red-400', fvg: 'text-purple-400', warning: 'text-amber-400', metric: 'text-sky-400',
};
const logPrefix: Record<string, string> = {
  info: 'ℹ', signal: '◆', order: '▶', error: '✕', fvg: '◈', warning: '⚠', metric: '■',
};

const TrendBadge: React.FC<{ trend: string }> = ({ trend }) => {
  const color = trend === 'ALTA' ? 'text-green-400' : trend === 'BAIXA' ? 'text-red-400' : 'text-slate-400';
  const Icon = trend === 'ALTA' ? TrendUp : trend === 'BAIXA' ? TrendDown : Minus;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${color}`}><Icon size={12} />{trend}</span>;
};

const MiniSparkline: React.FC<{ data: SignalRecord[]; width?: number; height?: number }> = ({ data, width = 200, height = 40 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || data.length < 2) { if (c) { const dpr = window.devicePixelRatio || 1; c.width = width * dpr; c.height = height * dpr; const ctx = c.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, width, height); } } return; }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const profits = data.map(s => s.profit || 0);
    const min = Math.min(0, ...profits);
    const max = Math.max(0, ...profits);
    const range = max - min || 1;
    const pad = 2;
    const cw = width - pad * 2, ch = height - pad * 2;
    ctx.beginPath();
    let eq = 0;
    data.forEach((s, i) => {
      eq += s.profit || 0;
      const x = pad + (i / (data.length - 1)) * cw;
      const y = pad + ch - ((eq - min) / range) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = eq >= 0 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, width, height]);
  return <canvas ref={canvasRef} style={{ width, height, borderRadius: 4 }} />;
};

export const AgentIAPanel: React.FC = () => {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [tab, setTab] = useState<'chart' | 'logs' | 'signals' | 'config'>('chart');
  const [showConfig, setShowConfig] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    try {
      const [s, l, sig] = await Promise.all([
        axios.get('/api/agent-ia/status').catch(() => null),
        axios.get('/api/agent-ia/logs', { params: { count: 100 } }).catch(() => null),
        axios.get('/api/agent-ia/signals', { params: { count: 50 } }).catch(() => null),
      ]);
      if (s?.data) setStatus(s.data);
      if (l?.data) setLogs(l.data);
      if (sig?.data) setSignals(sig.data);
    } catch { /* ignore */ }
    setLoading(false);
    setFirstLoad(false);
  };

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 5000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (autoScroll && terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs, autoScroll]);

  const action = async (url: string, method = 'post') => {
    setLoading(true);
    try { await (method === 'get' ? axios.get(url) : axios.post(url)); await fetchAll(); } catch { /* */ }
    setLoading(false);
  };

  const sig = status?.lastSignal;
  const fvgs = status?.lastFvgs || [];
  const bullishFvgs = fvgs.filter((f: FVG) => f.tipo === 'BULLISH');
  const bearishFvgs = fvgs.filter((f: FVG) => f.tipo === 'BEARISH');
  const isLive = status?.running && !status?.dryRun;
  const wins = signals.filter(s => s.outcome === 'win').length;
  const losses = signals.filter(s => s.outcome === 'loss').length;
  const totalClosed = wins + losses;
  const hitRate = totalClosed > 0 ? ((wins / totalClosed) * 100).toFixed(1) : '-';

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Brain size={20} className="text-purple-400" /> Agente IA v2
          {isLive && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/40 animate-pulse font-mono">AO VIVO</span>}
          {status?.running && status?.dryRun && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono">DRY-RUN</span>}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => action('/api/agent-ia/analyze')} disabled={loading}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Analisar
          </button>
          <button onClick={async () => { await axios.post('/api/agent-ia/dry-run', { dryRun: !status?.dryRun }); await fetchAll(); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
              status?.dryRun ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-green-500/20 border-green-500/50 text-green-400'
            }`}>
            {status?.dryRun ? <EyeOff size={14} /> : <Eye size={14} />} {status?.dryRun ? 'Dry-Run' : 'Ao Vivo'}
          </button>
          {!status?.running ? (
            <button onClick={() => action('/api/agent-ia/start')} disabled={loading}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all flex items-center gap-1.5">
              <Play size={14} /> Iniciar
            </button>
          ) : (
            <button onClick={() => action('/api/agent-ia/stop')} disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-1.5">
              <Square size={14} /> Parar
            </button>
          )}
        </div>
      </div>

      {/* Live/Dry-run Banner */}
      {isLive && (
        <div className="bg-red-600/20 border-2 border-red-500/60 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <Radio size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 font-bold text-sm">⚠ MODO AO VIVO ATIVO</p>
            <p className="text-red-400/80 text-xs">Ordens reais sendo enviadas ao MT5. Lote dinâmico ({status?.config.lotBase}–{status?.config.lotMax}) | TP/SL por ATR</p>
          </div>
        </div>
      )}
      {status?.dryRun && status?.running && (
        <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
          <EyeOff size={16} className="text-amber-400 shrink-0" />
          <p className="text-amber-300 text-xs font-bold">Modo Dry-Run — simulação apenas. Alterne para "Ao Vivo" para execução real.</p>
        </div>
      )}
      {status?.cooldownUntil && Date.now() < status.cooldownUntil && (
        <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-xs font-bold">Cooldown: {Math.round((status.cooldownUntil - Date.now()) / 60000)}min restantes</p>
        </div>
      )}
      {status?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-xs">{status.error}</div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className={`bg-slate-900/60 backdrop-blur-2xl p-4 rounded-xl border ${isLive ? 'border-red-500/40' : 'border-white/5'}`}>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</p>
          <p className={`text-lg font-bold mt-1 flex items-center gap-2 ${status?.running ? 'text-green-400' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${status?.running ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
            {status?.running ? 'Ativo' : 'Parado'}
          </p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-2xl p-4 rounded-xl border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Preço Atual</p>
          <p className="text-lg font-bold mt-1 text-white">{status?.lastPrice ? `$${status.lastPrice.toFixed(2)}` : '-'}</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-2xl p-4 rounded-xl border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">ATR / Spread</p>
          <p className="text-lg font-bold mt-1 text-cyan-400">${status?.atr.toFixed(2) ?? '-'}</p>
          <p className="text-[10px] text-slate-600">Spread: {status?.spread ?? '-'} pts</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-2xl p-4 rounded-xl border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tendências</p>
          <p className="mt-1 flex gap-2 text-xs">
            <TrendBadge trend={status?.trendM5 || 'NEUTRAL'} /> <TrendBadge trend={status?.trendH1 || 'NEUTRAL'} />
          </p>
          <p className="text-[9px] text-slate-600 mt-0.5">M5 / H1</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-2xl p-4 rounded-xl border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">P&L Diário</p>
          <p className={`text-lg font-bold mt-1 ${(status?.dailyPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${status?.dailyPnl?.toFixed(2) ?? '0.00'}
          </p>
          <p className={`text-[10px] ${status?.consecutiveLosses ? 'text-red-400' : 'text-slate-600'}`}>
            Perdas seguidas: {status?.consecutiveLosses ?? 0}
          </p>
        </div>
      </div>

      {/* Sinal Detalhado */}
      {sig && sig.direction !== 'AGUARDAR' && sig.direction !== 'BLOQUEADO' && (
        <div className={`bg-slate-900/60 backdrop-blur-2xl p-5 rounded-2xl border space-y-3 ${sig.direction === 'COMPRA' ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {sig.direction === 'COMPRA' ? <TrendingUp size={16} className="text-green-400" /> : <TrendingDown size={16} className="text-red-400" />}
              Sinal: {sig.direction} <span className="text-[10px] text-slate-500 font-mono">Confiança: {status?.confidence ?? 0}%</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><span className="text-slate-500 text-[10px] uppercase">Entry</span><p className="text-white font-bold font-mono">${sig.entry.toFixed(2)}</p></div>
            <div><span className="text-slate-500 text-[10px] uppercase">Stop Loss</span><p className="text-red-400 font-bold font-mono">${sig.sl.toFixed(2)}</p></div>
            <div><span className="text-slate-500 text-[10px] uppercase">Take Profit</span><p className="text-green-400 font-bold font-mono">${sig.tp.toFixed(2)}</p></div>
            <div><span className="text-slate-500 text-[10px] uppercase">R:R</span><p className="text-white font-bold">{sig.rr.toFixed(2)}:1</p></div>
            <div><span className="text-slate-500 text-[10px] uppercase">Lote</span><p className="text-cyan-400 font-bold">{status?.config.lotBase}</p></div>
          </div>
        </div>
      )}

      {/* Painel Inferior: Tabs */}
      <div className="bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-800 overflow-x-auto">
          <div className="flex gap-2">
            {(['chart', 'signals', 'logs', 'config'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  tab === t ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {t === 'chart' ? '📊 Mapa FVG' : t === 'signals' ? '📈 Sinais' : t === 'logs' ? '📋 Terminal' : '⚙ Config'}
              </button>
            ))}
          </div>
          {tab === 'logs' && (
            <div className="flex gap-2">
              <button onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${autoScroll ? 'text-cyan-400' : 'text-slate-600'}`}>Auto {autoScroll ? 'ON' : 'OFF'}</button>
              <button onClick={() => action('/api/agent-ia/logs/clear')} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1"><Trash2 size={12} /> Limpar</button>
            </div>
          )}
        </div>

        {/* Tab: Mapa FVG */}
        {tab === 'chart' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">▲ FVGs Bullish ({bullishFvgs.length})</h4>
              {bullishFvgs.length === 0 && <p className="text-slate-600 text-[11px]">Nenhum</p>}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bullishFvgs.slice(-10).reverse().map((f, i) => (
                  <div key={i} className="flex justify-between text-[11px] font-mono bg-green-500/5 px-3 py-1.5 rounded border border-green-500/10">
                    <span className="text-slate-400 w-12">{f.time.slice(11, 16)}</span>
                    <span className="text-green-400">${f.fundo.toFixed(2)}</span>
                    <span className="text-green-300">→ ${f.topo.toFixed(2)}</span>
                    <span className="text-slate-500 w-14 text-right">${f.size.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">▼ FVGs Bearish ({bearishFvgs.length})</h4>
              {bearishFvgs.length === 0 && <p className="text-slate-600 text-[11px]">Nenhum</p>}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bearishFvgs.slice(-10).reverse().map((f, i) => (
                  <div key={i} className="flex justify-between text-[11px] font-mono bg-red-500/5 px-3 py-1.5 rounded border border-red-500/10">
                    <span className="text-slate-400 w-12">{f.time.slice(11, 16)}</span>
                    <span className="text-red-400">${f.fundo.toFixed(2)}</span>
                    <span className="text-red-300">→ ${f.topo.toFixed(2)}</span>
                    <span className="text-slate-500 w-14 text-right">${f.size.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <p className="text-[10px] text-slate-500 mb-2">Filtros ativos:</p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">✓ Mín FVG ≥ {status?.config.minFvgAtrRatio}×ATR</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">✓ Spread ≤ {status?.config.maxSpread} pts</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">✓ Preço nos 40% centrais do gap</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">✓ Confirmação H1 + M5</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">✓ TP ATR×{status?.config.atrTpMultiplier} / SL ATR×{status?.config.atrSlMultiplier}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Sinais */}
        {tab === 'signals' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4 text-xs">
                <span className="text-slate-400">Sinais: <strong className="text-white">{signals.length}</strong></span>
                <span className="text-green-400">Ganhos: <strong>{wins}</strong></span>
                <span className="text-red-400">Perdas: <strong>{losses}</strong></span>
                <span className="text-cyan-400">Acerto: <strong>{hitRate}%</strong></span>
              </div>
              <button onClick={() => action('/api/agent-ia/signals/clear')} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1"><Trash2 size={12} /> Limpar</button>
            </div>
            {signals.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-slate-500 mb-1">Equity Curve (últimos {signals.length} sinais)</p>
                <MiniSparkline data={signals} width={600} height={48} />
              </div>
            )}
            {signals.length === 0 && (
              <div className="text-center py-12 text-slate-600">
                <Brain size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold mb-1">Nenhum sinal gerado</p>
                <p className="text-[11px]">{!status?.running ? 'Clique em "Iniciar" para começar a análise.' : 'Aguardando análise do mercado... Verifique o Terminal para mais detalhes.'}</p>
              </div>
            )}
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              {signals.length > 0 && (
              <table className="w-full text-xs text-slate-300">
                <thead><tr className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 px-2">Hora</th><th className="text-left py-2 px-2">Dir</th>
                  <th className="text-right py-2 px-2">Entry</th><th className="text-right py-2 px-2">SL</th>
                  <th className="text-right py-2 px-2">TP</th><th className="text-right py-2 px-2">R:R</th>
                  <th className="text-center py-2 px-2">Resultado</th>
                </tr></thead>
                <tbody>
                    {signals.slice().reverse().map((s, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-1.5 px-2 text-slate-400">{s.time.slice(11, 19)}</td>
                      <td className={`py-1.5 px-2 font-bold ${s.direction === 'COMPRA' ? 'text-green-400' : s.direction === 'VENDA' ? 'text-red-400' : 'text-slate-500'}`}>
                        {s.direction === 'AGUARDAR' ? '⏸︎' : s.direction}
                      </td>
                      <td className="text-right py-1.5 px-2 font-mono">{s.entry ? `$${s.entry.toFixed(2)}` : '-'}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-red-400">{s.sl ? `$${s.sl.toFixed(2)}` : '-'}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-green-400">{s.tp ? `$${s.tp.toFixed(2)}` : '-'}</td>
                      <td className="text-right py-1.5 px-2">{s.rr ? `${s.rr.toFixed(2)}:1` : '-'}</td>
                      <td className="text-center py-1.5 px-2">
                        {s.outcome === 'pending' ? <span className="text-amber-400 text-[10px]">⌛</span> :
                         s.outcome === 'win' ? <span className="text-green-400 text-[10px]">✓ +${s.profit?.toFixed(2)}</span> :
                         s.outcome === 'loss' ? <span className="text-red-400 text-[10px]">✕ ${s.profit?.toFixed(2)}</span> :
                         s.direction === 'AGUARDAR' ? <span className="text-slate-600 text-[10px]">—</span> :
                         <span className="text-red-400 text-[10px]">✕ ${s.profit?.toFixed(2)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>
        )}

        {/* Tab: Terminal */}
        {tab === 'logs' && (
          <div ref={terminalRef} className="h-80 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-slate-950/80" style={{ scrollBehavior: 'smooth' }}>
            {logs.length === 0 && (
              <div className="text-slate-600 text-center py-12">
                <Terminal size={32} className="mx-auto mb-3 opacity-40" />
                <p>Nenhum evento registrado</p>
              </div>
            )}
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-3 hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors">
                <span className="text-slate-700 w-14 shrink-0">{entry.time.slice(11, 19)}</span>
                <span className={`w-4 shrink-0 ${logColors[entry.type]}`}>{logPrefix[entry.type]}</span>
                <span className={logColors[entry.type]}>{entry.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Config */}
        {tab === 'config' && (
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'dailyLossLimit', label: 'Limite Perda Dia', suffix: '$', min: 1, max: 100 },
                { key: 'maxConsecutiveLosses', label: 'Perdas Seguidas', suffix: '', min: 1, max: 10 },
                { key: 'cooldownMinutes', label: 'Cooldown (min)', suffix: 'min', min: 5, max: 120 },
                { key: 'minFvgAtrRatio', label: 'Min FVG/ATR', suffix: '×', min: 0.1, max: 2, step: 0.1 },
                { key: 'maxSpread', label: 'Max Spread', suffix: 'pts', min: 5, max: 100 },
                { key: 'atrSlMultiplier', label: 'SL (ATR×)', suffix: '×', min: 0.3, max: 2, step: 0.1 },
                { key: 'atrTpMultiplier', label: 'TP (ATR×)', suffix: '×', min: 0.5, max: 3, step: 0.1 },
                { key: 'lotBase', label: 'Lote Base', suffix: '', min: 0.01, max: 0.1, step: 0.01 },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{field.label}</label>
                  <input type="number" step={field.step || 1} min={field.min} max={field.max}
                    defaultValue={(status?.config as any)?.[field.key] ?? ''}
                    onBlur={async (e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      await axios.post('/api/agent-ia/config', { [field.key]: val });
                      await fetchAll();
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => action('/api/agent-ia/reset-daily')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5">
                <RotateCcw size={14} /> Resetar Contadores
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
