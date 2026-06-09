import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Shield, Zap, ChevronRight, Activity, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface LogLine {
    time: string;
    msg: string;
    type: string;
}

export const SwingTerminal: React.FC = () => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [output, setOutput] = useState<{ type: 'cmd' | 'resp' | 'log', text: string }[]>([]);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const resp = await axios.get('/api/mt5/swing-trader/status');
            const newLogs = resp.data.logs || [];
            if (newLogs.length > 0) setLogs(newLogs);
        } catch (err) {
            console.error('Terminal fetch logs error:', err);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output, logs]);

    const handleCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const cmd = input.trim();
        setHistory(prev => [cmd, ...prev]);
        setOutput(prev => [...prev, { type: 'cmd', text: `swing-ia> ${cmd}` }]);
        setInput('');

        if (cmd === 'clear') {
            setOutput([]);
            return;
        }

        try {
            const resp = await axios.post('/api/mt5/swing-trader/command', { command: cmd });
            setOutput(prev => [...prev, { type: 'resp', text: resp.data.response }]);
        } catch (err) {
            setOutput(prev => [...prev, { type: 'resp', text: 'Erro ao conectar com o motor Swing IA.' }]);
        }
    };

    return (
        <div className="p-4 lg:p-6 h-[calc(100vh-100px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-950 border border-slate-800 rounded-[2rem] h-full flex flex-col shadow-2xl relative overflow-hidden">

                {/* Terminal Header */}
                <div className="bg-slate-900/80 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-rose-500/50" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                        <div className="h-4 w-[1px] bg-slate-800 mx-2" />
                        <div className="flex items-center gap-2 text-slate-400">
                            <TerminalIcon size={14} className="text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest italic">Swing IA Interactive Terminal v1.1</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black text-emerald-500 uppercase">Gateway Connected</span>
                        </div>
                    </div>
                </div>

                {/* Main Viewport */}
                <div
                    ref={terminalRef}
                    className="flex-1 p-6 font-mono text-xs overflow-y-auto selection:bg-amber-500/30 custom-scrollbar"
                >
                    <div className="space-y-4 max-w-4xl">
                        {/* Welcome Message */}
                        <div>
                            <p className="text-amber-500 font-bold mb-1">Radar-FX Swing Trader IA [Version 1.1.0-PRO]</p>
                            <p className="text-slate-500">Copyright (c) 2026 Antigravity Labs. All rights reserved.</p>
                            <p className="text-slate-500 mt-2 italic">Digite 'help' para ver os comandos disponíveis.</p>
                        </div>

                        {/* Analysis Logs (Historical) */}
                        <div className="pt-4 border-t border-slate-900">
                            {logs.slice().reverse().map((log, i) => (
                                <div key={i} className="flex gap-4 mb-1.5 leading-relaxed group">
                                    <span className="text-slate-700 shrink-0">[{log.time}]</span>
                                    <span className={
                                        log.type === 'TRADE' ? 'text-emerald-400 font-bold' :
                                            log.type === 'SCORE' ? 'text-amber-400 font-medium' :
                                                log.type === 'WARN' ? 'text-rose-500' : 'text-slate-400'
                                    }>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Interactive Output */}
                        <div className="pt-4 mt-4 border-t border-slate-900 space-y-3">
                            {output.map((line, i) => (
                                <div key={i} className={
                                    line.type === 'cmd' ? 'text-white font-bold flex gap-2' :
                                        'text-amber-300 pl-4 whitespace-pre-wrap'
                                }>
                                    {line.type === 'cmd' && <ChevronRight size={14} className="text-slate-500 mt-0.5" />}
                                    {line.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Terminal Input */}
                <div className="p-6 bg-black/20 border-t border-slate-900">
                    <form onSubmit={handleCommand} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-800 flex-1">
                            <span className="text-amber-500 font-black italic text-[10px] tracking-tighter uppercase shrink-0">swing-ia {'>'}</span>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="bg-transparent border-none outline-none text-white font-mono w-full text-sm placeholder:text-slate-700"
                                placeholder="execute command..."
                                autoFocus
                            />
                            <Command size={14} className="text-slate-700" />
                        </div>
                        <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-amber-900/20 active:scale-95 shrink-0"
                        >
                            Execute
                        </button>
                    </form>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #fbbf24;
                }
            `}} />
        </div>
    );
};
