import React, { useState, useEffect } from 'react';
import {
    Settings, User, Key, Globe, Save, RefreshCw,
    CheckCircle2, AlertCircle, Shield, Briefcase, Send,
    Cpu, TrendingUp, Copy, Trash2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { TelegramSettingsModal } from './TelegramSettingsModal';
import { TradingViewWidget } from './TradingViewWidget';
import { useTvAlerts } from '../hooks/useTvAlerts';

interface Profile {
    name: string;
    tradingStyle: 'SCALPER' | 'DAY_TRADER' | 'SWING';
    experience: string;
}

interface Config {
    polygonApiKey: string;
    mt5BridgeUrl: string;
    profile: Profile;
}

interface AccountData {
    login: number;
    company: string;
    server: string;
    leverage: number;
    balance: number;
    equity: number;
}

export const SystemSettings: React.FC = () => {
    const [config, setConfig] = useState<Config>({
        polygonApiKey: '',
        mt5BridgeUrl: '',
        profile: {
            name: '',
            tradingStyle: 'DAY_TRADER',
            experience: ''
        }
    });

    const [accountData, setAccountData] = useState<AccountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState('Pepperstone-Demo');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isTelegramOpen, setIsTelegramOpen] = useState(false);

    const [tvSymbol, setTvSymbol] = useState('XAUUSD');
    const [tvInterval, setTvInterval] = useState<'1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W' | 'M'>('60');
    const [tvCopied, setTvCopied] = useState(false);

    const tvSymbols = [
        { sym: 'XAUUSD', name: 'Ouro' },
        { sym: 'XAGUSD', name: 'Prata' },
        { sym: 'EURUSD', name: 'Euro/Dólar' },
        { sym: 'GBPUSD', name: 'Libra/Dólar' },
        { sym: 'USDJPY', name: 'Dólar/Iene' },
        { sym: 'USDCAD', name: 'Dólar/Canadense' },
        { sym: 'AUDUSD', name: 'Australiano/Dólar' },
        { sym: 'BTCUSD', name: 'Bitcoin' },
        { sym: 'ETHUSD', name: 'Ethereum' },
        { sym: 'SOLUSD', name: 'Solana' },
        { sym: 'SP500', name: 'S&P 500' },
        { sym: 'US30', name: 'Dow Jones' },
        { sym: 'NAS100', name: 'Nasdaq' },
        { sym: 'UK100', name: 'FTSE 100' },
    ];

    const { alerts: tvAlerts, clearAlerts: clearTvAlerts } = useTvAlerts();
    const webhookUrl = `${window.location.origin}/api/tradingview/webhook`;

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [configRes, accountRes] = await Promise.all([
                    axios.get('/api/system/config'),
                    axios.get('/api/mt5/account').catch(() => ({ data: null }))
                ]);
                setConfig(configRes.data);
                if (accountRes.data) setAccountData(accountRes.data);
            } catch (error) {
                console.error('Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await axios.post('/api/system/config', config);
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso! Reinicie o servidor se alterou chaves de API.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleConnectBroker = async () => {
        setIsConnecting(true);
        setMessage(null);
        try {
            await axios.post('/api/mt5/login', { login, password, server });
            setMessage({ type: 'success', text: 'Conexão estabelecida com a corretora!' });
            const accountRes = await axios.get('/api/mt5/account');
            if (accountRes.data) setAccountData(accountRes.data);
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Falha na conexão Alpha MT5'
            });
        } finally {
            setIsConnecting(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-lime-500/20 border-t-lime-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carregando Alpha Configs...</p>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADLINE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-lime-500/20 shadow-[0_0_50px_rgba(132,204,22,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-lime-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-lime-500/10 rounded-3xl border border-lime-500/20 shadow-xl shadow-lime-500/10">
                        <Settings size={40} className="text-lime-400" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-600">Radar</span>
                            Control Center
                            <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-lime-500/10 border border-lime-500/20 text-lime-500">
                                v1.1.2
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Cpu size={12} className="text-lime-400" /> Painel de Configurações do Sistema
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-lime-500/10 hover:border-lime-500/20 transition-all"
                >
                    {saving ? <RefreshCw size={14} className="animate-spin text-lime-400" /> : <Save size={14} className="text-lime-400" />}
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
                </button>
            </div>

            {/* MESSAGE BANNER */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-4 rounded-2xl border flex items-center gap-3 ${message.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                    >
                        {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-xs font-black uppercase tracking-wider">{message.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SECTIONS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Profile Section */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-lime-500/40 to-transparent"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <User className="text-lime-400" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Perfil do Trader</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Operador</label>
                            <input
                                type="text"
                                value={config.profile.name}
                                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, name: e.target.value } })}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-lime-500/30 focus:ring-1 focus:ring-lime-500/10 transition-all"
                                placeholder="Seu Nome Alpha"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Estilo de Trading</label>
                            <select
                                value={config.profile.tradingStyle}
                                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, tradingStyle: e.target.value as any } })}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-lime-500/30 transition-all appearance-none cursor-pointer"
                            >
                                <option value="SCALPER">SCALPER (Alta Frequência)</option>
                                <option value="DAY_TRADER">DAY TRADER (Equilibrado)</option>
                                <option value="SWING">SWING TRADER (Longo Prazo)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nível de Experiência</label>
                            <input
                                type="text"
                                value={config.profile.experience}
                                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, experience: e.target.value } })}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-lime-500/30 transition-all"
                                placeholder="Ex: Master Trader VSA"
                            />
                        </div>
                    </div>
                </div>

                {/* API & Connectivity Section */}
                <div className="bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-lime-500/40 to-transparent"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <Key className="text-amber-400" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">API & Conectividade</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Polygon.io API Key</label>
                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-tighter">SMC Engine</span>
                            </div>
                            <input
                                type="password"
                                value={config.polygonApiKey}
                                onChange={(e) => setConfig({ ...config, polygonApiKey: e.target.value })}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-lime-500/30 focus:ring-1 focus:ring-lime-500/10 transition-all"
                                placeholder="Sua Chave Polygon"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">MT5 Bridge URL</label>
                                <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Python Proxy</span>
                            </div>
                            <input
                                type="text"
                                value={config.mt5BridgeUrl}
                                onChange={(e) => setConfig({ ...config, mt5BridgeUrl: e.target.value })}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-lime-500/30 transition-all"
                                placeholder="http://127.0.0.1:5555"
                            />
                        </div>

                        <div className="pt-4 grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-950/50 border border-white/5 rounded-xl flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">SMC Module: ON</span>
                            </div>
                            <div className="p-3 bg-slate-950/50 border border-white/5 rounded-xl flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bridge: Linked</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Broker Section */}
                <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-lime-500/40 to-transparent"></div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Globe className="text-lime-400" size={20} />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Mapeamento da Corretora</h2>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase italic tracking-widest">Sincronizado</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end mb-6 bg-slate-950/40 p-6 rounded-3xl border border-white/5">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Login MT5</label>
                            <input
                                type="text"
                                value={login}
                                onChange={e => setLogin(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-lime-500/30 transition-all"
                                placeholder="ID da Conta"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha Mestra</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-lime-500/30 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Servidor</label>
                            <input
                                type="text"
                                value={server}
                                onChange={e => setServer(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-lime-500/30 transition-all"
                                placeholder="Pepperstone-Demo"
                            />
                        </div>
                        <button
                            onClick={handleConnectBroker}
                            disabled={isConnecting}
                            className="h-[52px] w-full bg-lime-500/20 border border-lime-500/30 text-lime-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-lime-500/30 transition-all disabled:opacity-50"
                        >
                            {isConnecting ? <RefreshCw className="animate-spin inline" size={14} /> : 'Conectar Corretora'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-lime-500/20 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nome da Corretora</p>
                            <p className="text-sm font-black text-white uppercase italic mt-1">{accountData?.company || '---'}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-lime-500/20 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Servidor MT5</p>
                            <p className="text-sm font-black text-white uppercase italic mt-1">{accountData?.server || '---'}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-lime-500/20 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Número da Conta</p>
                            <p className="text-sm font-black text-lime-400 mt-1">#{accountData?.login || '---'}</p>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 hover:border-lime-500/20 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alavancagem Máxima</p>
                            <p className="text-sm font-black text-amber-400 uppercase italic mt-1">1:{accountData?.leverage || '---'}</p>
                        </div>
                    </div>

                    <div className="pt-4 mt-6 border-t border-white/5 flex items-center justify-between text-slate-500">
                        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em]">
                            <span className="flex items-center gap-1.5"><RefreshCw size={10} /> Sync Interval: 5000ms</span>
                            <span className="flex items-center gap-1.5"><Shield size={10} /> Encryption: Alpha Guard v2.1</span>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[9px] font-black text-lime-400 uppercase hover:underline"
                        >
                            Forçar Resync Geral
                        </button>
                    </div>
                </div>

                {/* Telegram Section */}
                <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-lime-500/40 to-transparent"></div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20">
                                <Send size={24} className="text-sky-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">Alpha Telegram Bot</h2>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receba alertas de trades e metas no seu celular</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsTelegramOpen(true)}
                            className="w-full md:w-auto px-6 py-3 bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-sky-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Send size={16} />
                            Configurar Notificações
                        </button>
                    </div>
                </div>

                {/* TradingView Section */}
                <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <TrendingUp size={22} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">TradingView Sync</h2>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gráfico em tempo real + Webhook de Alertas</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Ativo</label>
                            <select
                                value={tvSymbol}
                                onChange={e => setTvSymbol(e.target.value)}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-3 text-white font-black text-xs outline-none focus:border-blue-500/30 transition-all appearance-none cursor-pointer"
                            >
                                {tvSymbols.map(s => (
                                    <option key={s.sym} value={s.sym}>{s.sym} - {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Timeframe</label>
                            <select
                                value={tvInterval}
                                onChange={e => setTvInterval(e.target.value as any)}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-3 text-white font-black text-xs outline-none focus:border-blue-500/30 transition-all appearance-none cursor-pointer"
                            >
                                <option value="1">1 minuto</option>
                                <option value="5">5 minutos</option>
                                <option value="15">15 minutos</option>
                                <option value="30">30 minutos</option>
                                <option value="60">1 hora</option>
                                <option value="240">4 horas</option>
                                <option value="D">Diário</option>
                                <option value="W">Semanal</option>
                                <option value="M">Mensal</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Webhook URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrl}
                                    className="flex-1 bg-slate-950/80 border border-white/5 rounded-2xl p-3 text-blue-400 font-mono text-[10px] outline-none truncate"
                                />
                                <button
                                    onClick={() => { navigator.clipboard.writeText(webhookUrl); setTvCopied(true); setTimeout(() => setTvCopied(false), 2000); }}
                                    className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl hover:bg-blue-500/20 transition-all"
                                >
                                    {tvCopied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4 bg-slate-950/30 rounded-2xl border border-blue-500/10 overflow-hidden">
                        <TradingViewWidget symbol={tvSymbol} interval={tvInterval} height={450} />
                    </div>

                    <div className="bg-slate-950/40 rounded-2xl border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <ExternalLink size={14} className="text-blue-400" />
                                Alertas Recebidos
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px]">{tvAlerts.length}</span>
                            </h3>
                            {tvAlerts.length > 0 && (
                                <button onClick={clearTvAlerts} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-[9px] font-black uppercase tracking-widest">
                                    <Trash2 size={12} /> Limpar
                                </button>
                            )}
                        </div>
                        {tvAlerts.length === 0 ? (
                            <p className="text-[10px] text-slate-500 text-center py-4">Nenhum alerta recebido. Configure o webhook no TradingView para começar.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {tvAlerts.map((a: any) => (
                                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 bg-slate-900/60 rounded-xl border border-white/5">
                                        <span className={`text-[10px] font-black uppercase ${a.direction === 'buy' || a.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {a.direction === 'buy' || a.direction === 'long' ? 'COMPRA' : 'VENDA'}
                                        </span>
                                        <span className="text-xs font-black text-white">{a.symbol}</span>
                                        <span className="text-[10px] font-mono text-slate-400">@{a.price.toFixed(2)}</span>
                                        <span className="text-[8px] text-slate-500 ml-auto">{new Date(a.timestamp).toLocaleTimeString('pt-BR')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer / Danger Zone */}
                <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-lime-500/40 to-transparent"></div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Shield className="text-slate-500" size={20} />
                            <div>
                                <p className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Proteção de Configurações</p>
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-1">Todos os dados sensíveis são criptografados localmente no servidor.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-white/5">
                            <Briefcase size={12} className="text-slate-500" />
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Versão v1.1.2 Alpha</span>
                        </div>
                    </div>
                </div>

            </div>

            <TelegramSettingsModal
                isOpen={isTelegramOpen}
                onClose={() => setIsTelegramOpen(false)}
            />

        </div>
    );
};
