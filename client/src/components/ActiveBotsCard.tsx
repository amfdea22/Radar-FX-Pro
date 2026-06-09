import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Activity, Power, PowerOff, Bot, Circle, ArrowUp, ArrowDown, Info } from 'lucide-react';
import axios from 'axios';

interface BotInfo {
    name: string;
    endpoint: string;
    symbol: string;
    timeframe: string;
    strategy: string;
    icon: string;
    magic?: number;
}

interface Position {
    ticket: number;
    symbol: string;
    type: number;
    volume: number;
    price_open: number;
    price_current: number;
    profit: number;
    comment?: string;
    magic?: number;
}

interface BotStatus {
    enabled: boolean;
    symbol?: string;
    lotSize?: number;
    settings?: Record<string, any>;
    state?: { position?: any };
    performance?: { totalTrades: number; winRate: number };
}

const BOTS: BotInfo[] = [
    { name: 'Wolf Bot', endpoint: '/api/mt5/wolf-bot/status', symbol: 'XAUUSD', timeframe: 'M15', strategy: 'SMC + Wyckoff + FVG', icon: '🐺', magic: 7777 },
    { name: 'Motor IA', endpoint: '/api/mt5/motor-ia/status', symbol: 'Multi', timeframe: 'H1', strategy: 'IA Adaptativa', icon: '🧠', magic: 999001 },
    { name: 'Alpha Robot', endpoint: '/api/mt5/robot/status', symbol: 'GBPUSD', timeframe: 'H1', strategy: 'Institucional Score', icon: '🏦', magic: 88881 },
    { name: 'Bitcoin Pro', endpoint: '/api/mt5/bitcoin-pro/status', symbol: 'BTCUSD', timeframe: 'H1', strategy: 'Smart Money + IA', icon: '₿' },
    { name: 'Gold Scalper', endpoint: '/api/mt5/gold-scalper/status', symbol: 'XAUUSD', timeframe: 'M5', strategy: 'Scalping + SMC', icon: '🥇' },
    { name: 'Shark Bot', endpoint: '/api/mt5/shark-bot/status', symbol: 'XAUUSD', timeframe: 'M15', strategy: 'ICT + FVG + OB', icon: '🦈' },
    { name: 'Crypto IA', endpoint: '/api/mt5/crypto-ia/status', symbol: 'BTCUSD', timeframe: 'H1', strategy: 'Crypto + ML', icon: '🔮' },
    { name: 'Supreme AI', endpoint: '/api/mt5/supreme/status', symbol: 'Multi', timeframe: 'H1', strategy: 'Supreme Intelligence', icon: '👑' },
    { name: 'Swing Trader', endpoint: '/api/mt5/swing-trader/status', symbol: 'Multi', timeframe: 'H4', strategy: 'Swing Positional', icon: '📐' },
    { name: 'Forex Scalper', endpoint: '/api/mt5/forex-scalper/status', symbol: 'EURUSD', timeframe: 'M5', strategy: 'Scalping Clássico', icon: '⚡' },
    { name: 'Micro Scalper', endpoint: '/api/mt5/micro-scalper/status', symbol: 'XAUUSD', timeframe: 'M1', strategy: 'Ultra Scalping', icon: '🔬' },
    { name: 'Copy Trader', endpoint: '/api/mt5/copy-trader/status', symbol: 'Multi', timeframe: '-', strategy: 'Copy Trading', icon: '📋' },
];

export const ActiveBotsCard: React.FC = () => {
    const [statuses, setStatuses] = useState<Record<string, BotStatus>>({});
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        const results: Record<string, BotStatus> = {};
        const statusPromises = BOTS.map(async (bot) => {
            try {
                const res = await axios.get(bot.endpoint, { timeout: 3000 });
                const data = res.data;
                const enabled = data?.settings?.enabled ?? data?.enabled ?? false;
                results[bot.name] = { enabled, settings: data?.settings, state: data?.state, performance: data?.performance };
            } catch {
                results[bot.name] = { enabled: false };
            }
        });
        await Promise.all(statusPromises);
        setStatuses(results);

        try {
            const posRes = await axios.get('/api/mt5/positions', { timeout: 3000 });
            setPositions(Array.isArray(posRes.data) ? posRes.data : []);
        } catch { }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const getBotPositions = (bot: BotInfo): Position[] => {
        return positions.filter(p => {
            const sym = p.symbol.toUpperCase();
            const botSym = bot.symbol.toUpperCase();
            if (botSym === 'MULTI') return true;
            return sym === botSym;
        });
    };

    const enabledCount = BOTS.filter(b => statuses[b.name]?.enabled).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 p-6 relative overflow-hidden group"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-sky-500/10 blur-[80px] pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-sky-500/20 to-blue-500/10 rounded-2xl border border-sky-400/30 shadow-lg shadow-sky-500/10">
                            <Bot size={24} className="text-sky-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                                Robôs Ativos
                            </h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                Estratégias em execução no MT5
                            </p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${enabledCount > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${enabledCount > 0 ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{enabledCount}/{BOTS.length} ativos</span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center">
                        <Cpu size={36} className="mx-auto mb-3 text-slate-700 animate-pulse" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Carregando status dos robôs...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {BOTS.map((bot, idx) => {
                            const st = statuses[bot.name];
                            const isEnabled = st?.enabled ?? false;
                            const botPositions = getBotPositions(bot);
                            const perf = st?.performance;
                            return (
                                <motion.div
                                    key={bot.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={`group/card p-3 rounded-2xl border transition-all ${isEnabled
                                        ? 'bg-slate-950/30 border-sky-500/15 hover:border-sky-500/30 hover:bg-sky-500/5'
                                        : 'bg-slate-950/20 border-white/5 opacity-50 hover:opacity-70'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${isEnabled ? 'bg-sky-500/15' : 'bg-slate-800/50'}`}>
                                                <span className={isEnabled ? '' : 'grayscale opacity-50'}>{bot.icon}</span>
                                            </div>
                                            <div>
                                                <p className={`text-xs font-black leading-tight ${isEnabled ? 'text-white' : 'text-slate-500'}`}>
                                                    {bot.name}
                                                </p>
                                                <p className="text-[7px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                                                    {bot.strategy}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${isEnabled
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-slate-800/50 text-slate-600 border border-slate-700/50'
                                        }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                                            {isEnabled ? 'ON' : 'OFF'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-1 mb-1.5">
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {bot.symbol}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {bot.timeframe}
                                        </span>
                                        {perf && perf.totalTrades > 0 && (
                                            <span className="text-[8px] font-bold text-sky-400">
                                                {perf.winRate?.toFixed(0)}% WR
                                            </span>
                                        )}
                                    </div>

                                    {isEnabled && botPositions.length > 0 && (
                                        <div className="mt-1.5 pt-1.5 border-t border-sky-500/10 space-y-1">
                                            {botPositions.map(pos => (
                                                <div key={pos.ticket} className="flex items-center gap-1.5 text-[8px] font-bold">
                                                    <span className={`flex items-center gap-0.5 px-1 py-0.5 rounded ${pos.type === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {pos.type === 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                                                        {pos.type === 0 ? 'COMPRA' : 'VENDA'}
                                                    </span>
                                                    <span className="text-slate-400">{pos.volume}</span>
                                                    <span className={`ml-auto ${pos.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!isEnabled && (
                                        <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                            <p className="text-[7px] font-bold text-slate-700 uppercase tracking-widest">Inativo</p>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[8px] font-bold text-slate-600 uppercase tracking-wider">
                        <Info size={10} className="text-sky-500/50" />
                        <span>Atualizado a cada 10s</span>
                    </div>
                    <div className="flex items-center gap-3 text-[8px] font-bold text-slate-600 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Offline
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
