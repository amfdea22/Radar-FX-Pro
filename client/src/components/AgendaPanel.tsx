import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, GripHorizontal } from 'lucide-react';

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

const STRIP_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const CATEGORY_PILL: Record<string, string> = {
  trading: 'bg-[#4c3ac1] text-white',
  study: 'bg-[#0050cd] text-white',
  analysis: 'bg-[#0866ff] text-white',
  review: 'bg-[#893b00] text-white',
  other: 'bg-[#787585] text-white',
};

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading', study: 'Estudo', analysis: 'Análise', review: 'Revisão', other: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

const COLUMNS = [
  { id: 'pending', label: 'A Fazer', color: '#4c3ac1' },
  { id: 'in_progress', label: 'Em Andamento', color: '#0050cd' },
  { id: 'completed', label: 'Concluído', color: '#10b981' },
];

export const AgendaPanel: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/agenda/tasks');
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleQuickAdd = async (status: string) => {
    if (!quickTitle.trim()) return;
    try {
      await fetch('/api/agenda/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: quickTitle.trim(), status }),
      });
      setQuickTitle('');
      setAddingTo(null);
      fetchTasks();
    } catch { /* ignore */ }
  };

  const handleMove = async (id: number, status: string) => {
    try {
      await fetch(`/api/agenda/tasks/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchTasks();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/agenda/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch { /* ignore */ }
  };

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[#4c3ac1]/10 rounded-xl border border-[#4c3ac1]/20">
          <CalendarIcon size={20} className="text-[#4c3ac1]" />
        </div>
        <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Inter' }}>
          Kinetic Board
        </h2>
        <span className="text-xs font-semibold text-[#787585] bg-white/5 px-2.5 py-1 rounded-full border border-white/10" style={{ fontFamily: 'Inter' }}>
          {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-[#4c3ac1] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1" style={{ scrollbarWidth: 'thin' }}>
          {COLUMNS.map(col => {
            const colTasks = getTasksByStatus(col.id);
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-[280px] rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col max-h-full"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-white uppercase tracking-wider" style={{ fontFamily: 'Inter' }}>
                      {col.label}
                    </span>
                    <span className="text-xs font-semibold text-[#787585] bg-white/5 px-2 py-0.5 rounded" style={{ fontFamily: 'Inter' }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <GripHorizontal size={14} className="text-[#787585]" />
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]" style={{ scrollbarWidth: 'thin' }}>
                  {colTasks.map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={handleMove}
                      onDelete={handleDelete}
                      formatDate={formatDate}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-xs text-[#787585] italic" style={{ fontFamily: 'Inter' }}>
                      Nenhuma tarefa
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-white/5">
                  {addingTo === col.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleQuickAdd(col.id); }} className="space-y-2">
                      <input
                        value={quickTitle}
                        onChange={e => setQuickTitle(e.target.value)}
                        placeholder="Título da tarefa"
                        autoFocus
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-[#787585] focus:outline-none focus:border-[#4c3ac1]"
                        style={{ fontFamily: 'Inter' }}
                      />
                      <div className="flex gap-2">
                        <button type="submit"
                          className="flex-1 py-1.5 bg-[#4c3ac1] hover:bg-[#4c3ac1]/80 text-white text-xs font-semibold rounded-lg transition-colors"
                          style={{ fontFamily: 'Inter' }}>
                          Adicionar
                        </button>
                        <button type="button" onClick={() => { setAddingTo(null); setQuickTitle(''); }}
                          className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-[#787585] text-xs rounded-lg transition-colors"
                          style={{ fontFamily: 'Inter' }}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setAddingTo(col.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[#787585] hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors uppercase tracking-wider"
                      style={{ fontFamily: 'Inter' }}>
                      <Plus size={14} />
                      Adicionar Card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function KanbanCard({ task, onMove, onDelete, formatDate }: {
  task: Task;
  onMove: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  formatDate: (d: string | null) => string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString()) && task.status !== 'completed';
  const stripColor = STRIP_COLORS[task.priority] || '#f59e0b';

  return (
    <div
      className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.1)] border border-[#d8e2ff] overflow-hidden hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-shadow cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="h-1 w-full" style={{ backgroundColor: stripColor }} />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-[#051a3e] leading-tight flex-1" style={{ fontFamily: 'Inter' }}>
            {task.title}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="p-0.5 rounded hover:bg-red-50 text-[#787585] hover:text-red-500 transition-colors shrink-0">
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider"
            style={{ backgroundColor: stripColor + '20', color: stripColor }}>
            {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${CATEGORY_PILL[task.category] || CATEGORY_PILL.other}`}>
            {CATEGORY_LABELS[task.category] || task.category}
          </span>
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-[#787585]'}`} style={{ fontFamily: 'Inter' }}>
              <CalendarIcon size={10} />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {expanded && task.description && (
          <p className="text-xs text-[#474554] pt-1 border-t border-[#d8e2ff]" style={{ fontFamily: 'Inter' }}>
            {task.description}
          </p>
        )}

        <div className="pt-1">
          <button onClick={(e) => { e.stopPropagation(); onMove(task.id, nextStatus); }}
            className="w-full py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-[#f1f3ff] hover:bg-[#e4e9ff] text-[#4c3ac1] transition-colors"
            style={{ fontFamily: 'Inter' }}>
            {task.status === 'completed' ? 'Reabrir' : 'Mover para ' + (task.status === 'pending' ? 'Em Andamento' : 'Concluído')}
          </button>
        </div>
      </div>
    </div>
  );
}
