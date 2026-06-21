import React, { useState, useEffect } from 'react';
import {
    CheckCircle2, Circle, Trash2, Plus, ChevronDown, ChevronUp,
    Calendar, AlertCircle, ClipboardList, Target, Clock, ListChecks, X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    category: string;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CATEGORY_COLORS: Record<string, string> = {
    trading: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    study: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    analysis: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    review: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

const CATEGORY_LABELS: Record<string, string> = {
    trading: 'Trading', study: 'Estudo', analysis: 'Análise', review: 'Revisão', other: 'Outro',
};

export const AgendaPanel: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [form, setForm] = useState({
        title: '', description: '', priority: 'medium', category: 'trading', dueDate: '',
    });

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/agenda/tasks');
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { fetchTasks(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        try {
            const res = await fetch('/api/agenda/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    priority: form.priority,
                    category: form.category,
                    dueDate: form.dueDate || undefined,
                }),
            });
            if (res.ok) {
                setForm({ title: '', description: '', priority: 'medium', category: 'trading', dueDate: '' });
                setShowForm(false);
                fetchTasks();
            }
        } catch { /* ignore */ }
    };

    const handleToggle = async (id: number) => {
        try { await fetch(`/api/agenda/tasks/${id}/toggle`, { method: 'PATCH' }); fetchTasks(); } catch { /* ignore */ }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir esta tarefa?')) return;
        try { await fetch(`/api/agenda/tasks/${id}`, { method: 'DELETE' }); fetchTasks(); } catch { /* ignore */ }
    };

    const pending = tasks.filter(t => t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');
    const completionPct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    const overdue = tasks.filter(t => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString()));

    const formatDate = (d: string | null) => {
        if (!d) return null;
        return new Date(d).toLocaleDateString('pt-BR');
    };

    const isOverdue = (d: string | null) => {
        if (!d) return false;
        return new Date(d) < new Date(new Date().toDateString());
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carregando Agenda...</p>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HERO HEADER */}
            <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.1)] p-6 lg:p-8">
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-5">
                        <div className="p-3.5 bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-xl shadow-sky-500/10">
                            <ClipboardList className="text-sky-400" size={28} />
                        </div>
                        <div>
                            <h2 className="text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3 flex-wrap">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Agenda</span> do Trader
                                <span className="px-2 py-1 rounded-lg text-xs tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                    {tasks.length} tarefas
                                </span>
                            </h2>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                                <ListChecks size={12} className="text-sky-500" /> Gerencie suas tarefas de trading, estudo e análise
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowForm(!showForm)}
                        className={`px-5 py-2.5 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${showForm ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20'}`}>
                        {showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nova Tarefa</>}
                    </button>
                </div>
            </div>

            {/* STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400">
                        <ClipboardList size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total</p>
                        <p className="text-xl font-black text-white italic">{tasks.length}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                        <Clock size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pendentes</p>
                        <p className="text-xl font-black text-white italic">{pending.length}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Concluídas</p>
                        <p className="text-xl font-black text-white italic">{completed.length}</p>
                    </div>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-500/20 text-red-400">
                        <AlertCircle size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Atrasadas</p>
                        <p className="text-xl font-black text-white italic">{overdue.length}</p>
                    </div>
                </div>
            </div>

            {/* PROGRESS BAR */}
            {tasks.length > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Target size={12} /> Progresso
                        </p>
                        <span className="text-[10px] font-black text-sky-400">{completionPct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${completionPct}%` }}
                            transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                            className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400"
                        />
                    </div>
                </div>
            )}

            {/* NEW TASK FORM */}
            {showForm && (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/20 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
                    <p className="text-lg font-black text-white italic uppercase tracking-tighter mb-4">Nova Tarefa</p>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <input
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Título da tarefa"
                            className="w-full bg-slate-800 text-white font-mono rounded-lg px-3 py-2 border border-transparent focus:border-sky-500 focus:ring-0 placeholder:text-slate-600"
                        />
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descrição (opcional)"
                            rows={2}
                            className="w-full bg-slate-800 text-white font-mono rounded-lg px-3 py-2 border border-transparent focus:border-sky-500 focus:ring-0 placeholder:text-slate-600 resize-none"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Prioridade</p>
                                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-transparent focus:border-sky-500 text-xs">
                                    <option value="low">Baixa</option>
                                    <option value="medium">Média</option>
                                    <option value="high">Alta</option>
                                    <option value="critical">Crítica</option>
                                </select>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Categoria</p>
                                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-transparent focus:border-sky-500 text-xs">
                                    <option value="trading">Trading</option>
                                    <option value="study">Estudo</option>
                                    <option value="analysis">Análise</option>
                                    <option value="review">Revisão</option>
                                    <option value="other">Outro</option>
                                </select>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Data</p>
                                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-transparent focus:border-sky-500 text-xs [color-scheme:dark]" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="submit"
                                className="flex-1 py-2.5 rounded-2xl border font-black text-[10px] uppercase tracking-widest bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all">
                                <Plus size={12} className="inline mr-1.5" /> Criar Tarefa
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-6 py-2.5 rounded-2xl border font-black text-[10px] uppercase tracking-widest bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-700/50 transition-all">
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TASK LISTS */}
            {tasks.length === 0 ? (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-12 text-center">
                    <ClipboardList size={48} className="mx-auto mb-3 text-slate-700 opacity-30" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Nenhuma tarefa ainda</p>
                    <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-widest">Crie sua primeira tarefa para começar</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* PENDING */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <Clock size={16} className="text-amber-400" /> Pendentes
                                </h3>
                                <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                    {pending.length}
                                </span>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                                {pending.length === 0 ? (
                                    <p className="text-[10px] text-slate-500 text-center py-6 uppercase tracking-widest">Nenhuma pendente</p>
                                ) : pending.map(task => (
                                    <TaskItem key={task.id} task={task} expandedId={expandedId} setExpandedId={setExpandedId} onToggle={handleToggle} onDelete={handleDelete} formatDate={formatDate} isOverdue={isOverdue} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* COMPLETED */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" /> Concluídas
                                </h3>
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                    {completed.length}
                                </span>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                                {completed.length === 0 ? (
                                    <p className="text-[10px] text-slate-500 text-center py-6 uppercase tracking-widest">Nenhuma concluída</p>
                                ) : completed.map(task => (
                                    <TaskItem key={task.id} task={task} expandedId={expandedId} setExpandedId={setExpandedId} onToggle={handleToggle} onDelete={handleDelete} formatDate={formatDate} isOverdue={isOverdue} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function TaskItem({ task, expandedId, setExpandedId, onToggle, onDelete, formatDate, isOverdue }: {
    task: Task;
    expandedId: number | null;
    setExpandedId: (id: number | null) => void;
    onToggle: (id: number) => void;
    onDelete: (id: number) => void;
    formatDate: (d: string | null) => string | null;
    isOverdue: (d: string | null) => boolean;
}) {
    const expanded = expandedId === task.id;
    const overdue = task.status === 'pending' && isOverdue(task.dueDate);
    const done = task.status === 'completed';

    return (
        <div className={`bg-slate-950/40 p-3 rounded-2xl border transition-all ${done ? 'border-emerald-500/10 opacity-60' : 'border-white/5 hover:border-sky-500/20'}`}>
            <div className="flex items-center gap-3">
                <button onClick={() => onToggle(task.id)} className="shrink-0">
                    {done ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                    ) : (
                        <Circle size={20} className="text-slate-500 hover:text-sky-400 transition-colors" />
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold ${done ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {task.title}
                        </span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.other}`}>
                            {CATEGORY_LABELS[task.category] || task.category}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        {task.dueDate && (
                            <span className={`flex items-center gap-1 text-[9px] font-bold ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                                <Calendar size={10} />
                                {formatDate(task.dueDate)}
                                {overdue && ' (atrasada)'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {task.description && (
                        <button onClick={() => setExpandedId(expanded ? null : task.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-500 hover:text-slate-300 transition-all">
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    <button onClick={() => onDelete(task.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {expanded && task.description && (
                <div className="mt-2 ml-9 p-3 bg-slate-900/60 rounded-lg border border-slate-700/30">
                    <p className="text-xs text-slate-400 whitespace-pre-wrap">{task.description}</p>
                </div>
            )}
        </div>
    );
}
