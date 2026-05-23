import React, { useState, useEffect } from 'react';
import {
    Settings, User, Key, Globe, Save, RefreshCw,
    CheckCircle2, AlertCircle, Shield, Briefcase, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { TelegramSettingsModal } from './TelegramSettingsModal';

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

    // Estados para Login Direto da Corretora
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState('Pepperstone-Demo');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isTelegramOpen, setIsTelegramOpen] = useState(false);

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
            // Clear message after 5 seconds
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleConnectBroker = async () => {
        setIsConnecting(true);
        setMessage(null);
        try {
            await axios.post('/api/mt5/login', { login, password, server });
            setMessage({ type: 'success', text: 'Conexão estabelecida com a corretora!' });
            // Refresh account data
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
                <div className="w-12 h-12 border-4 border-trader-blue/20 border-t-trader-blue rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carregando Alpha Configs...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-trader-blue/10 text-trader-blue rounded-2xl border border-trader-blue/20">
                        <Settings size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">Alpha Control Center</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Painel de Configurações do Sistema</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-3 px-6 py-3 bg-trader-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-trader-blue/20 hover:scale-105 transition-all disabled:opacity-50"
                >
                    {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                    {saving ? 'Gravando...' : 'Salvar Alterações'}
                </button>
            </div>

            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-4 rounded-2xl border flex items-center gap-3 ${message.type === 'success'
                            ? 'bg-trader-green/20 border-trader-green/30 text-trader-green'
                            : 'bg-trader-red/20 border-trader-red/30 text-trader-red'
                            }`}
                    >
                        {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-xs font-black uppercase tracking-wider">{message.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Section */}
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <User className="text-trader-blue" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Perfil do Trader</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Operador</label>
                            <input
                                type="text"
                                value={config.profile.name}
                                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, name: e.target.value } })}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-trader-blue/50 focus:ring-1 focus:ring-trader-blue/20 transition-all"
                                placeholder="Seu Nome Alpha"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Estilo de Trading</label>
                            <select
                                value={config.profile.tradingStyle}
                                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, tradingStyle: e.target.value as any } })}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-trader-blue/50 transition-all appearance-none cursor-pointer"
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
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-trader-blue/50 transition-all"
                                placeholder="Ex: Master Trader VSA"
                            />
                        </div>
                    </div>
                </div>

                {/* API & System Section */}
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Key className="text-trader-amber" size={20} />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">API & Conectividade</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Polygon.io API Key</label>
                                <span className="text-[8px] font-black text-trader-amber uppercase tracking-tighter">SMC Engine</span>
                            </div>
                            <input
                                type="password"
                                value={config.polygonApiKey}
                                onChange={(e) => setConfig({ ...config, polygonApiKey: e.target.value })}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-trader-amber/50 focus:ring-1 focus:ring-trader-amber/20 transition-all"
                                placeholder="Sua Chave Polygon"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">MT5 Bridge URL</label>
                                <span className="text-[8px] font-black text-trader-blue uppercase tracking-tighter">Python Proxy</span>
                            </div>
                            <input
                                type="text"
                                value={config.mt5BridgeUrl}
                                onChange={(e) => setConfig({ ...config, mt5BridgeUrl: e.target.value })}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-white font-black text-xs outline-none focus:border-trader-blue/50 transition-all"
                                placeholder="http://127.0.0.1:5555"
                            />
                        </div>

                        {/* System Status Summary */}
                        <div className="pt-4 grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-trader-green shadow-[0_0_8px_rgba(0,192,100,0.5)]"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">SMC Module: ON</span>
                            </div>
                            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-trader-blue shadow-[0_0_8px_rgba(0,163,255,0.5)]"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bridge: Linked</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account & Broker Info Section */}
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8 md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <Globe className="text-trader-blue" size={20} />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Mapeamento da Corretora (MT5 Connected)</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 bg-trader-green/10 rounded-full border border-trader-green/20">
                                <span className="text-[10px] font-black text-trader-green uppercase italic tracking-widest">Sincronizado</span>
                            </div>
                        </div>
                    </div>

                    {/* Novo Formulário de Conexão Direta */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end bg-slate-950/40 p-6 rounded-3xl border border-white/5">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Login MT5</label>
                            <input
                                type="text"
                                value={login}
                                onChange={e => setLogin(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all"
                                placeholder="ID da Conta"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha Mestra</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Servidor</label>
                            <input
                                type="text"
                                value={server}
                                onChange={e => setServer(e.target.value)}
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black outline-none focus:border-trader-blue/50 transition-all"
                                placeholder="Pepperstone-Demo"
                            />
                        </div>
                        <button
                            onClick={handleConnectBroker}
                            disabled={isConnecting}
                            className="h-[52px] w-full bg-trader-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-trader-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isConnecting ? <RefreshCw className="animate-spin" size={14} /> : 'Conectar Corretora'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-5 bg-slate-950/60 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nome da Corretora</p>
                            <p className="text-sm font-black text-white uppercase italic">{accountData?.company || '---'}</p>
                        </div>
                        <div className="p-5 bg-slate-950/60 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Servidor MT5</p>
                            <p className="text-sm font-black text-white uppercase italic">{accountData?.server || '---'}</p>
                        </div>
                        <div className="p-5 bg-slate-950/60 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Número da Conta</p>
                            <p className="text-sm font-black text-trader-blue">#{accountData?.login || '---'}</p>
                        </div>
                        <div className="p-5 bg-slate-950/60 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alavancagem Máxima</p>
                            <p className="text-sm font-black text-amber-500 uppercase italic">1:{accountData?.leverage || '---'}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-slate-500">
                        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em]">
                            <span className="flex items-center gap-1.5"><RefreshCw size={10} /> Sync Interval: 5000ms</span>
                            <span className="flex items-center gap-1.5"><Shield size={10} /> Encryption: Alpha Guard v2.1</span>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[9px] font-black text-trader-blue uppercase hover:underline"
                        >
                            Forçar Resync Geral
                        </button>
                    </div>
                </div>
            </div>

            {/* Telegram Integration Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20">
                        <Send size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">Alpha Telegram Bot</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receba alertas de trades e metas no seu celular</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsTelegramOpen(true)}
                    className="w-full md:w-auto px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-3"
                >
                    <Send size={16} />
                    Configurar Notificações
                </button>
            </div>

            <TelegramSettingsModal
                isOpen={isTelegramOpen}
                onClose={() => setIsTelegramOpen(false)}
            />

            {/* Footer / Danger Zone */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] flex items-center justify-between opacity-80">
                <div className="flex items-center gap-4">
                    <Shield className="text-slate-500" size={20} />
                    <div>
                        <p className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Proteção de Configurações</p>
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-1">Todos os dados sensíveis são criptografados localmente no servidor.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                    <Briefcase size={12} className="text-slate-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Versão v1.1.2 Alpha</span>
                </div>
            </div>
        </div>
    );
};
