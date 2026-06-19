import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2, ChevronDown, TrendingUp, Brain, FileText, AlertTriangle, DollarSign, HelpCircle } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    id: string;
}

const MODELS = [
    { id: 'gemini', label: 'Gemini 2.0 Flash', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { id: 'groq', label: 'Groq Llama 3', color: 'text-orange-400', bg: 'bg-orange-500/20' },
] as const;

type ModelId = typeof MODELS[number]['id'];
type FoxMode = 'general' | 'analyst';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const SLASH_COMMANDS = [
    '/omni', '/gsl1', '/ranking', '/relatorio', '/conta', '/alertas', '/ajuda'
];

export const Fox: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Olá! Sou a **FOX**, sua Assistente do **Radar FX**. Ative o modo **Analista Técnico** para análises FOREX completas com ativos, tempo de vela, candles, indicadores, calendário econômico e notícias reais do mercado Forex.', id: '0' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId] = useState(() => 'fox_' + Math.random().toString(36).slice(2, 10));
    const [model, setModel] = useState<ModelId>('groq');
    const [mode, setMode] = useState<FoxMode>('general');
    const [symbol, setSymbol] = useState('GBPUSD');
    const [timeframe, setTimeframe] = useState('H1');
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showTfPicker, setShowTfPicker] = useState(false);
    const [showSlashHint, setShowSlashHint] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const tfPickerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowModelPicker(false);
            if (tfPickerRef.current && !tfPickerRef.current.contains(e.target as Node)) setShowTfPicker(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const sendStream = async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;
        setInput('');
        setShowSlashHint(false);

        const userChat: ChatMessage = { role: 'user', content: msg, id: Date.now().toString() };
        const assistantId = (Date.now() + 1).toString();
        const assistantChat: ChatMessage = { role: 'assistant', content: '', id: assistantId };
        setMessages(m => [...m, userChat, assistantChat]);
        setLoading(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const resp = await fetch('/api/copilot/ask/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    sessionId,
                    model,
                    mode,
                    symbol: mode === 'analyst' ? symbol : undefined,
                    timeframe: mode === 'analyst' ? timeframe : undefined,
                }),
                signal: controller.signal,
            });

            if (!resp.body) throw new Error('No response body');

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    const data = trimmed.slice(6);

                    if (data === '__FOX_DONE__') break;
                    if (data.startsWith('__FOX_ERROR__:')) {
                        const errMsg = data.slice(14);
                        setMessages(m => m.map(msg =>
                            msg.id === assistantId ? { ...msg, content: `❌ ${errMsg}` } : msg
                        ));
                        break;
                    }

                    const token = data.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
                    setMessages(m => m.map(msg =>
                        msg.id === assistantId ? { ...msg, content: msg.content + token } : msg
                    ));
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setMessages(m => m.map(msg =>
                    msg.id === assistantId ? { ...msg, content: msg.content + '\n\n_⏹️ Interrompido_' } : msg
                ));
            } else {
                setMessages(m => m.map(msg =>
                    msg.id === assistantId ? { ...msg, content: '❌ Erro ao contactar a FOX. Verifique se o servidor está rodando.' } : msg
                ));
            }
        }

        setLoading(false);
        abortRef.current = null;
    };

    const send = () => {
        if (abortRef.current) {
            abortRef.current.abort();
            return;
        }
        sendStream();
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);
        setShowSlashHint(val === '/');
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') send();
        if (e.key === 'Escape') setShowSlashHint(false);
    };

    const runSlash = (cmd: string) => {
        setInput(cmd + ' ');
        setShowSlashHint(false);
        setTimeout(() => sendStream(cmd + ' '), 50);
    };

    const runDailyReport = () => {
        setInput('/relatorio');
        setTimeout(() => sendStream('/relatorio'), 50);
    };

    const renderContent = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let inCode = false;
        let codeBuffer: string[] = [];
        let key = 0;

        const flushCode = () => {
            if (codeBuffer.length) {
                elements.push(<pre key={key++} className="bg-slate-950 text-[10px] text-green-400 p-2 rounded-lg overflow-x-auto my-1 font-mono leading-snug">{codeBuffer.join('\n')}</pre>);
                codeBuffer = [];
            }
        };

        lines.forEach((line) => {
            if (line.trim().startsWith('```')) {
                if (inCode) { flushCode(); inCode = false; }
                else { flushCode(); inCode = true; }
                return;
            }
            if (inCode) { codeBuffer.push(line); return; }
            if (line.startsWith('**') && line.endsWith('**')) {
                elements.push(<p key={key++} className="text-white font-black text-sm mb-2">{line.slice(2, -2)}</p>);
                return;
            }
            if (line.startsWith('- ')) {
                elements.push(<p key={key++} className="text-slate-300 text-xs ml-2 mb-0.5">{line}</p>);
                return;
            }
            if (line.startsWith('# ')) {
                elements.push(<p key={key++} className="text-cyan-300 font-black text-base mt-3 mb-1">{line.slice(2)}</p>);
                return;
            }
            if (line.startsWith('## ')) {
                elements.push(<p key={key++} className="text-white font-bold text-sm mt-2 mb-1">{line.slice(3)}</p>);
                return;
            }
            if (line.match(/^\*\*(.*?)\*\*:/)) {
                const parts = line.split(/(\*\*.*?\*\*:)/);
                elements.push(<p key={key++} className="text-slate-300 text-xs mb-1 leading-relaxed">
                    {parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**:')) return <span key={j} className="text-cyan-300 font-bold">{part.slice(2, -3)}:</span>;
                        if (part.startsWith('**')) return <span key={j} className="font-bold text-white">{part.slice(2, -2)}</span>;
                        return part;
                    })}
                </p>);
                return;
            }
            if (!line.trim()) { elements.push(<div key={key++} className="h-1" />); return; }
            elements.push(<p key={key++} className="text-slate-300 text-xs mb-1 leading-relaxed">{line}</p>);
        });

        // If there's streaming content with no complete lines yet, show raw
        if (text && elements.length === 0 && inCode === false) {
            return <p className="text-slate-300 text-xs leading-relaxed">{text}</p>;
        }

        return elements;
    };

    const activeModel = MODELS.find(m => m.id === model)!;

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(!open)}
                className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all group"
            >
                {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-24 right-6 z-50 w-[420px] h-[600px] bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-orange-500/20 shadow-[0_0_60px_rgba(249,115,22,0.15)] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500/10 rounded-xl">
                                    <Bot size={18} className="text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Fox</h3>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Sparkles size={10} className="text-orange-400" /> Radar FX Assistant
                                    </p>
                                </div>
                                <div className="relative" ref={pickerRef}>
                                    <button
                                        onClick={() => setShowModelPicker(!showModelPicker)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider ${activeModel.bg} ${activeModel.color} border border-white/5 hover:opacity-80 transition-all`}
                                    >
                                        {activeModel.label.split(' ')[0]}
                                        <ChevronDown size={12} />
                                    </button>
                                    <AnimatePresence>
                                        {showModelPicker && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                                className="absolute top-full right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50"
                                            >
                                                {MODELS.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                                                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-xs font-bold transition-all ${model === m.id ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${m.id === 'groq' ? 'bg-orange-400' : 'bg-cyan-400'}`} />
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Mode Tabs */}
                            <div className="flex gap-1 mt-3 bg-slate-800/50 rounded-xl p-1">
                                <button
                                    onClick={() => setMode('general')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        mode === 'general' ? 'bg-orange-500/20 text-orange-300' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <Brain size={12} />
                                    Fox
                                </button>
                                <button
                                    onClick={() => setMode('analyst')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        mode === 'analyst' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <TrendingUp size={12} />
                                    Analista Técnico
                                </button>
                            </div>

                            {/* Analyst inputs */}
                            {mode === 'analyst' && (
                                <div className="flex gap-2 mt-2">
                                    <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="Símbolo" className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/50 uppercase font-bold" />
                                    <div className="relative flex-1" ref={tfPickerRef}>
                                        <button onClick={() => setShowTfPicker(!showTfPicker)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-white font-bold flex items-center justify-between">
                                            {timeframe}
                                            <ChevronDown size={11} />
                                        </button>
                                        <AnimatePresence>
                                            {showTfPicker && (
                                                <motion.div initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }} className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50 w-full">
                                                    {TIMEFRAMES.map(tf => (
                                                        <button key={tf} onClick={() => { setTimeframe(tf); setShowTfPicker(false); }} className={`w-full px-3 py-1.5 text-[11px] font-bold text-left transition-all ${timeframe === tf ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>{tf}</button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <button onClick={() => { setInput(`Analisar ${symbol} ${timeframe}`); sendStream(`Analisar ${symbol} ${timeframe}`); }} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/30 transition-all whitespace-nowrap">Analisar</button>
                                </div>
                            )}

                            {/* Quick action buttons */}
                            {mode === 'general' && (
                                <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none">
                                    <button onClick={runDailyReport} className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-300 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-blue-500/20 whitespace-nowrap transition-all">
                                        <FileText size={10} /> Relatório
                                    </button>

                                    <button onClick={() => runSlash('/conta')} className="flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-300 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-green-500/20 whitespace-nowrap transition-all">
                                        <DollarSign size={10} /> Conta
                                    </button>
                                    <button onClick={() => runSlash('/ajuda')} className="flex items-center gap-1 px-2.5 py-1 bg-slate-500/10 text-slate-300 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-slate-500/20 whitespace-nowrap transition-all">
                                        <HelpCircle size={10} /> Ajuda
                                    </button>
                                    <button onClick={() => runSlash('/alertas')} className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-300 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-500/20 whitespace-nowrap transition-all">
                                        <AlertTriangle size={10} /> Alertas
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Messages */}
                        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-orange-500/20' : 'bg-emerald-500/20'}`}>
                                        {msg.role === 'user' ? <User size={14} className="text-orange-400" /> : <Bot size={14} className="text-emerald-400" />}
                                    </div>
                                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                                        msg.role === 'user'
                                            ? 'bg-orange-500/10 border border-orange-500/20 text-white'
                                            : 'bg-slate-800/60 border border-slate-700/50 text-slate-200'
                                    }`}>
                                        {msg.content ? renderContent(msg.content) : <Loader2 size={14} className="text-orange-400 animate-spin" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/5 bg-slate-950/30 relative">
                            {/* Slash command hint */}
                            <AnimatePresence>
                                {showSlashHint && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                                        <div className="px-3 py-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-700/50">Comandos</div>
                                        {SLASH_COMMANDS.map(cmd => (
                                            <button key={cmd} onClick={() => runSlash(cmd)} className="w-full px-3 py-2 flex items-center gap-2 text-xs font-bold text-slate-300 hover:bg-white/5 transition-all text-left">
                                                <span className="text-orange-400">{cmd}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex gap-2">
                                <input
                                    value={input}
                                    onChange={onInputChange}
                                    onKeyDown={onKeyDown}
                                    placeholder="Pergunte ou use / para comandos..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-all font-medium"
                                    disabled={loading}
                                />
                                <button
                                    onClick={send}
                                    disabled={!input.trim() && !loading}
                                    className="p-2.5 bg-orange-500 rounded-xl text-white hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
