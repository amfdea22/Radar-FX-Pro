import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUser } from '../services/auth';
import { User, Wallet, TrendingUp, TrendingDown, RefreshCw, ArrowDownToLine, ArrowUpFromLine, BarChart3, Activity, Shield, Zap, PieChart, Target, Flag, Cpu, DollarSign } from 'lucide-react';

interface Account {
  login: number; balance: number; equity: number; margin: number;
  margin_free: number; profit: number; leverage: number;
  currency: string; name: string; server: string;
}

interface Deal {
  ticket: number; time: number; amount: number; comment: string;
}

interface BalPoint {
  time: number; balance: number; type: number; symbol: string;
}

interface Profile {
  account: Account | null;
  deposits: Deal[];
  withdrawals: Deal[];
  totalDeposits: number;
  totalWithdrawals: number;
  totalDeals: number;
  balanceHistory: BalPoint[];
}

export const TraderArea: React.FC = () => {
  const username = getUser() || 'Trader';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trader/profile');
      if (res.ok) setProfile(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleDateString('pt-BR');
  const formatCurr = (v: number) => `${v >= 0 ? '' : '-'}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw size={32} className="text-blue-500 animate-spin" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carregando Perfil do Trader...</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Headline Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-xl shadow-blue-500/10">
            <User size={40} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Trader</span> Area
              <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-xs tracking-widest uppercase">Sessão Ativa</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
              <Cpu size={12} className="text-blue-500" /> Perfil Financeiro & Acompanhamento MT5
            </p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10 items-center">
          <button
            onClick={fetchProfile}
            className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl hover:bg-blue-500/20 transition-all flex items-center gap-2 group"
            title="Sincronizar Dados">
            <RefreshCw size={18} className={loading ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Sincronizar</span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Conta MT5</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
              <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></div>
              <span className="text-[10px] font-black uppercase">{profile?.account?.login || '---'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Saldo', value: formatCurr(profile?.account?.balance || 0), color: 'text-emerald-400', delay: 0 },
          { label: 'Equidade', value: formatCurr(profile?.account?.equity || 0), color: 'text-cyan-400', delay: 0.1 },
          { label: 'Margem Livre', value: formatCurr(profile?.account?.margin_free || 0), color: 'text-blue-400', delay: 0.2 },
          { label: 'Lucro Diário', value: formatCurr(profile?.account?.profit || 0), color: (profile?.account?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400', delay: 0.3 },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: s.delay }}
            className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-3xl border border-white/5"
          >
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-black ${s.color} italic`}>{s.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content - Perfil + Depósitos/Retiradas */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-blue-500/10 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
              <User className="text-blue-400" /> Perfil <span className="text-blue-400">MT5</span>
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{username} — Dados da Conta em Tempo Real</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/30 rounded-2xl p-5 border border-white/5 col-span-1 lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <User size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-black text-white">{username}</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Trader</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Conta MT5', value: profile?.account?.login || '---' },
                { label: 'Servidor', value: profile?.account?.server || '---' },
                { label: 'Alavancagem', value: `1:${profile?.account?.leverage || '---'}` },
                { label: 'Moeda', value: profile?.account?.currency || '---' },
              ].map((f) => (
                <div key={f.label} className="bg-slate-900/40 rounded-xl p-3 border border-white/5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{f.label}</p>
                  <p className="text-sm font-bold text-white">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-2xl p-5 border border-white/5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownToLine size={14} className="text-emerald-400" />
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Depósitos</p>
              </div>
              <p className="text-xl font-black text-emerald-400 italic">{formatCurr(profile?.totalDeposits || 0)}</p>
              <p className="text-[10px] text-slate-600">{profile?.deposits.length || 0} transações</p>
            </div>
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpFromLine size={14} className="text-red-400" />
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Retiradas</p>
              </div>
              <p className="text-xl font-black text-red-400 italic">{formatCurr(profile?.totalWithdrawals || 0)}</p>
              <p className="text-[10px] text-slate-600">{profile?.withdrawals.length || 0} transações</p>
            </div>
          </div>
        </div>

        {/* Histórico Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-800/30 rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={14} className="text-emerald-400" />
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Depósitos Recentes</p>
            </div>
            {!profile?.deposits.length ? (
              <p className="text-xs text-slate-600 text-center py-6">Nenhum depósito encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      <th className="py-2 pr-3 text-left font-black text-[8px] uppercase tracking-widest">Data</th>
                      <th className="py-2 pr-3 text-left font-black text-[8px] uppercase tracking-widest">Valor</th>
                      <th className="py-2 text-left font-black text-[8px] uppercase tracking-widest">Comentário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.deposits.slice(0, 10).map(d => (
                      <tr key={d.ticket} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 pr-3 text-slate-400">{formatTime(d.time)}</td>
                        <td className="py-2 pr-3 text-emerald-400 font-bold">+{formatCurr(d.amount)}</td>
                        <td className="py-2 text-slate-500 truncate max-w-[120px]">{d.comment || '---'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} className="text-red-400" />
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Retiradas Recentes</p>
            </div>
            {!profile?.withdrawals.length ? (
              <p className="text-xs text-slate-600 text-center py-6">Nenhuma retirada encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      <th className="py-2 pr-3 text-left font-black text-[8px] uppercase tracking-widest">Data</th>
                      <th className="py-2 pr-3 text-left font-black text-[8px] uppercase tracking-widest">Valor</th>
                      <th className="py-2 text-left font-black text-[8px] uppercase tracking-widest">Comentário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.withdrawals.slice(0, 10).map(w => (
                      <tr key={w.ticket} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 pr-3 text-slate-400">{formatTime(w.time)}</td>
                        <td className="py-2 pr-3 text-red-400 font-bold">-{formatCurr(w.amount)}</td>
                        <td className="py-2 text-slate-500 truncate max-w-[120px]">{w.comment || '---'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sugestões */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

        <div className="flex items-center gap-2 mb-6">
          <Zap size={16} className="text-amber-400" />
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sugestões para o Trader</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { icon: Shield, color: 'text-cyan-400', title: 'Margem de Segurança', desc: 'Mantenha sua margem livre acima de 50% do saldo para evitar chamadas de margem em períodos de alta volatilidade.' },
            { icon: BarChart3, color: 'text-cyan-400', title: 'Histórico de Depósitos', desc: 'Registre seus depósitos e retiradas para acompanhar o crescimento real da sua conta ao longo do tempo.' },
            { icon: Activity, color: 'text-cyan-400', title: 'Consistência', desc: 'Busque consistência nos resultados diários. Um profit factor acima de 1.5 indica performance saudável.' },
            { icon: TrendingDown, color: 'text-red-400', title: 'Drawdown Máximo', desc: 'Limite suas perdas máximas a 10% do saldo da conta para preservar capital durante períodos adversos.' },
            { icon: Target, color: 'text-emerald-400', title: 'Relação Risco/Retorno', desc: 'Busque operações com relação risco/retorno mínima de 1:3 para garantir que acertos menores superem perdas.' },
            { icon: PieChart, color: 'text-blue-400', title: 'Diversificação', desc: 'Evite concentrar mais de 30% da banca em um único ativo ou estratégia para reduzir riscos sistêmicos.' },
            { icon: Flag, color: 'text-amber-400', title: 'Meta Diária', desc: 'Estabeleça uma meta de lucro diário e pare ao atingi-la. Disciplina é a chave para resultados consistentes.' },
          ].map((item) => (
            <div key={item.title} className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} className={item.color} />
                <p className="text-xs font-bold text-white">{item.title}</p>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
