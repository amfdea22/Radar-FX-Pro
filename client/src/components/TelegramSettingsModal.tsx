import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Send, ShieldCheck, HelpCircle, Key, Hash, Power } from 'lucide-react';
import axios from 'axios';

interface TelegramSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({ isOpen, onClose }) => {
    const [enabled, setEnabled] = useState(false);
    const [botToken, setBotToken] = useState('');
    const [chatId, setChatId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [testStatus, setTestStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
            setTestStatus('IDLE');
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/mt5/telegram/settings');
            setEnabled(res.data.enabled || false);
            setBotToken(res.data.botToken || '');
            setChatId(res.data.chatId || '');
        } catch (error) {
            console.error('Failed to load telegram settings', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.post('/api/mt5/telegram/settings', {
                enabled,
                botToken,
                chatId
            });
            setTimeout(() => setIsSaving(false), 500);
            onClose();
        } catch (error) {
            console.error('Failed to save settings', error);
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setTestStatus('LOADING');
        // Force save current typed settings first temporarily for the test to read
        try {
            await axios.post('/api/mt5/telegram/settings', { enabled: true, botToken, chatId });
            const res = await axios.post('/api/mt5/telegram/test');
            if (res.data.status === 'success') {
                setTestStatus('SUCCESS');
                setTestMessage('Mensagem enviada com sucesso! Verifique seu Telegram.');
            }
        } catch (error: any) {
            setTestStatus('ERROR');
            setTestMessage(error.response?.data?.message || 'Falha ao conectar.');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl overflow-hidden relative"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                                    <Send size={28} className="text-trader-blue" />
                                    Telegram Bot
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    Notificações no Celular
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center justify-between p-5 bg-slate-950/50 rounded-2xl border border-slate-800 mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-white tracking-widest uppercase">Ativar Integração</h3>
                                <p className="text-xs text-slate-500 mt-1">Habilita disparos de Metas, Stops e Trade Open</p>
                            </div>
                            <button
                                onClick={() => setEnabled(!enabled)}
                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${enabled ? 'bg-trader-green' : 'bg-slate-700'}`}
                            >
                                <motion.div
                                    className="w-6 h-6 bg-white rounded-full shadow-md"
                                    animate={{ x: enabled ? 24 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Forms */}
                        <div className={`space-y-4 transition-all duration-300 ${!enabled ? 'opacity-40 pointer-events-none filter grayscale' : ''}`}>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <Key size={12} className="text-trader-blue" /> Bot Token (Fornecido pelo @BotFather)
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={botToken}
                                        onChange={(e) => setBotToken(e.target.value)}
                                        placeholder="Ex: 123456789:ABCdefGHIjklmNOPqrstUVWxyz"
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-trader-blue transition-colors font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <Hash size={12} className="text-trader-blue" /> Chat ID
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={chatId}
                                        onChange={(e) => setChatId(e.target.value)}
                                        placeholder="Ex: -1001234567890 ou Seu ID Pessoal"
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-trader-blue transition-colors font-mono"
                                    />
                                </div>
                                <p className="text-[9px] text-slate-500 font-medium">Use bots como @userinfobot para descobrir seu ID.</p>
                            </div>

                            {/* Test Area */}
                            <div className="pt-2">
                                <button
                                    onClick={handleTest}
                                    disabled={testStatus === 'LOADING'}
                                    className="w-full py-3 bg-trader-blue/10 border border-trader-blue/30 text-trader-blue font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-trader-blue hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {testStatus === 'LOADING' ? <Power size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                    Testar Conexão do Robô
                                </button>

                                <AnimatePresence>
                                    {testStatus === 'SUCCESS' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-trader-green/10 border border-trader-green/20 text-trader-green text-xs rounded-xl text-center">
                                            {testMessage}
                                        </motion.div>
                                    )}
                                    {testStatus === 'ERROR' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-trader-red/10 border border-trader-red/20 text-trader-red text-xs rounded-xl text-center">
                                            {testMessage}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800/50">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-[2] py-3 bg-gradient-to-r from-trader-blue to-blue-600 hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-trader-blue/20 flex justify-center items-center gap-2"
                            >
                                {isSaving ? <Power size={14} className="animate-spin" /> : <Save size={14} />}
                                Salvar Configuração
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
