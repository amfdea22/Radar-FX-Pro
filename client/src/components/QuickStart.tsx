import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Cpu, User, Zap, Shield, TrendingUp, BarChart3, ArrowRight, CheckCircle, Bot, Wallet } from 'lucide-react';

const steps = [
  {
    icon: User,
    title: 'Crie sua Conta',
    desc: 'Registre-se ou faça login para acessar o Radar FX. Use o menu "Área Trader" para visualizar seu perfil e dados da conta MT5.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    icon: Wallet,
    title: 'Conecte sua Conta MT5',
    desc: 'Certifique-se de que o MT5 Bridge está rodando (porta 5555). Seu saldo, equidade e margem serão sincronizados automaticamente.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  {
    icon: Bot,
    title: 'Ative um Robô',
    desc: 'Escolha entre Gold Scalper, Alpha Robot, Supreme IA, Bitcoin Pro e outros. Ative o robô desejado no menu "Robôs" e configure os parâmetros.',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/20',
  },
  {
    icon: Shield,
    title: 'Configure a Gestão de Risco',
    desc: 'Defina limites de perda diária, drawdown máximo e tamanho de lote no menu "Gestão de Risco". Mantenha a margem livre acima de 50%.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Acompanhe os Sinais',
    desc: 'Visualize sinais em tempo real no painel "Sinais". Filtre por ativo, direção e confiança para tomar decisões informadas.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    icon: BarChart3,
    title: 'Analise Resultados',
    desc: 'Use Analytics e ML Insights para avaliar performance. Acompanhe métricas como profit factor, sharpe ratio e taxa de acerto.',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
  },
];

const tips = [
  'Mantenha a margem livre acima de 50% do saldo para evitar chamadas de margem.',
  'Busque consistência — profit factor acima de 1.5 indica performance saudável.',
  'Limite o drawdown máximo a 10% do saldo para preservar capital.',
  'Estabeleça metas diárias de lucro e pare ao atingi-las.',
  'Diversifique: não concentre mais de 30% da banca em um único ativo.',
];

export const QuickStart: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Headline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-xl shadow-blue-500/10">
            <BookOpen size={40} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Início</span> Rápido
              <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs tracking-widest uppercase">Quick Start</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
              <Cpu size={12} className="text-blue-500" /> Guia Essencial para Começar com o Radar FX
            </p>
          </div>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {steps.map((step, idx) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`${step.bgColor} ${step.borderColor} backdrop-blur-xl p-6 rounded-[2rem] border relative overflow-hidden group hover:scale-[1.02] transition-all duration-300`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${step.bgColor} ${step.borderColor} border`}>
                <step.icon size={22} className={step.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Passo {idx + 1}</span>
                  <ArrowRight size={10} className="text-slate-600" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-2">{step.title}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tips Section */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-amber-500/10 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

        <div className="flex items-center gap-2 mb-6">
          <Zap size={16} className="text-amber-400" />
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Dicas Rápidas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
