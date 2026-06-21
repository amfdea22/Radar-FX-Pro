import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, Plus, ChevronDown, ChevronUp, Calendar, AlertCircle } from 'lucide-react';

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
  const [collapsed, setCollapsed] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'trading',
    dueDate: '',
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
    try {
      await fetch(`/api/agenda/tasks/${id}/toggle`, { method: 'PATCH' });
      fetchTasks();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await fetch(`/api/agenda/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch { /* ignore */ }
  };

  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const isOverdue = (d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-sky-500/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-6 pb-0">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="text-sky-400" size={18} />
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Agenda do Trader</h3>
          <span className="text-[10px] font-black text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-lg border border-slate-700/50">{tasks.length} tarefas</span>
        </div>
        {collapsed ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
      </button>
      {!collapsed && (
        <div className="p-6 pt-4">
          <button onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl text-sky-400 font-black text-xs uppercase tracking-wider transition-all mb-4">
            <Plus size={14} />
            Nova Tarefa
          </button>

          {showForm && (
            <form onSubmit={handleCreate} className="mb-4 p-4 bg-slate-800/40 rounded-2xl border border-sky-500/20 space-y-3">
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Título da tarefa"
                className="w-full p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
              />
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descrição (opcional)"
                rows={2}
                className="w-full p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
              />
              <div className="flex gap-3">
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="flex-1 p-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500/50">
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex-1 p-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500/50">
                  <option value="trading">Trading</option>
                  <option value="study">Estudo</option>
                  <option value="analysis">Análise</option>
                  <option value="review">Revisão</option>
                  <option value="other">Outro</option>
                </select>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="flex-1 p-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500/50 [color-scheme:dark]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit"
                  className="flex-1 p-2.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 rounded-xl text-sky-400 font-black text-xs uppercase tracking-wider transition-all">
                  Criar
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="p-2.5 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 rounded-xl text-slate-400 font-black text-xs uppercase tracking-wider transition-all">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs font-black uppercase tracking-widest">Carregando...</div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-700" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Nenhuma tarefa</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Pendentes ({pending.length})
                  </h4>
                  <div className="space-y-2">
                    {pending.map(task => (
                      <TaskItem key={task.id} task={task} expandedId={expandedId} setExpandedId={setExpandedId} onToggle={handleToggle} onDelete={handleDelete} formatDate={formatDate} isOverdue={isOverdue} />
                    ))}
                  </div>
                </div>
              )}
              {completed.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Concluídas ({completed.length})
                  </h4>
                  <div className="space-y-2">
                    {completed.map(task => (
                      <TaskItem key={task.id} task={task} expandedId={expandedId} setExpandedId={setExpandedId} onToggle={handleToggle} onDelete={handleDelete} formatDate={formatDate} isOverdue={isOverdue} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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

  return (
    <div className={`p-3 rounded-xl border transition-all ${task.status === 'completed' ? 'bg-slate-800/20 border-slate-700/20 opacity-60' : 'bg-slate-800/40 border-slate-700/30 hover:border-sky-500/20'}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(task.id)} className="shrink-0">
          {task.status === 'completed' ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : (
            <Circle size={18} className="text-slate-500 hover:text-sky-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
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
