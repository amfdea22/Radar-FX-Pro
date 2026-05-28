import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Cpu, Target, Crown, Bitcoin, Zap, TrendingUp, Brain, Shield, BarChart3, Copy, Send, LineChart, PieChart, Calendar, Sigma, Wallet, TrendingDown, Activity, User, Layers, LayoutDashboard } from 'lucide-react';

interface GuideSection {
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  items: { label: string; desc: string }[];
}

const sections: GuideSection[] = [
  {
    title: 'Painéis Principais',
    icon: Layers,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    items: [
      { label: 'Radar Dashboard', desc: 'Visão geral dos ativos em tempo real. Acompanhe saldo, lucro diário, drawdown e performance consolidada do sistema.' },
      { label: 'Sinais', desc: 'Painel de sinais ao vivo. Filtre por ativo, tipo (compra/venda) e nível de confiança. Clique para executar ordens diretamente.' },
      { label: 'Analytics', desc: 'Métricas avançadas de performance: profit factor, sharpe ratio, taxa de acerto, drawdown e relatórios detalhados por período.' },
      { label: 'ML Insights', desc: 'Insights gerados por machine learning. Previsões de tendência, correlações entre ativos e detecção de padrões ocultos.' },
    ],
  },
  {
    title: 'Robôs Automatizados',
    icon: Cpu,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/20',
    items: [
      { label: 'Gold Scalper', desc: 'Robô especializado em XAUUSD (ouro). Usa SMC (Smart Money Concept), grid inteligente, trailing dinâmico e filtro de notícias. Ideal para day trade em alta frequência.' },
      { label: 'Alpha Robot', desc: 'Robô principal multi-ativo. Opera com grade adaptativa, gestão de risco dinâmica e análise técnica combinada. Configurável para vários pares.' },
      { label: 'Supreme IA', desc: 'Robô de altíssima frequência com inteligência artificial. Usa redes neurais para identificar oportunidades de curto prazo com precisão milimétrica.' },
      { label: 'Bitcoin Pro', desc: 'Robô focado em criptomoedas (BTC, ETH, etc.). Opera com análise de sentimento, volatilidade e padrões de acumulação/distribuição.' },
      { label: 'Shark Bot', desc: 'Robô agressivo para mercados voláteis. Utiliza estratégias de breakout e momentum com entrada rápida e stop ajustável.' },
      { label: 'Alpha Cripto', desc: 'Hub completo de criptomoedas com inteligência algorítmica, copy trader digital e social trading. Suporta múltiplas exchanges e tokens.' },
      { label: 'Micro Sniper', desc: 'Sniper de micro-entradas. Opera com lotes reduzidos e alta precisão, ideal para contas menores ou gestão conservadora.' },
      { label: 'Swing IA', desc: 'Robô de swing trade com IA. Identifica tendências de médio prazo usando análise multiframe (M15, H1, H4, D1).' },
      { label: 'Speed Scalper', desc: 'Scalper ultrarrápido para Forex. Opera em M1 com execução em milissegundos. Indicado para mercados de alta liquidez como EURUSD.' },
      { label: 'Omni Prob', desc: 'Robô probabilístico multi-ativo. Usa modelos estatísticos e análise de correlação entre mercados para distribuir risco otimizado.' },
    ],
  },
  {
    title: 'Ferramentas de Trading',
    icon: Send,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    items: [
      { label: 'Recovery', desc: 'Sistema de recuperação de perdas com gestão inteligente de lotes. Ajuda a recuperar posições negativas de forma controlada.' },
      { label: 'Motor IA', desc: 'Motor de execução inteligente. Combina múltiplos sinais e executa ordens com gestão de slippage e timing otimizado.' },
      { label: 'Operar', desc: 'Painel de execução manual. Abra ordens de compra/venda com configuração completa de lote, TP, SL e trailing.' },
      { label: 'Copy Trader', desc: 'Copie operações de traders selecionados automaticamente. Ideal para quem quer seguir estratégias validadas sem análise própria.' },
      { label: 'Análise Técnica', desc: 'Ferramenta completa de análise com indicadores técnicos, suportes/resistências, tendências e padrões de candle.' },
      { label: 'Ranking', desc: 'Ranking de performance entre robôs e estratégias. Compare resultados diários, semanais e mensais.' },
      { label: 'Calendário', desc: 'Calendário econômico com eventos de alto impacto. Filtre por moeda, impacto e tipo (CPI, PIB, juros, etc.).' },
    ],
  },
  {
    title: 'Gestão & Risco',
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    items: [
      { label: 'Gestão Risco', desc: 'Configure limites de perda diária, drawdown máximo, tamanho de lote e stops globais. Essencial para proteger o capital.' },
      { label: 'Financeiro', desc: 'Controle financeiro completo: saldo, equidade, margem, depósitos e retiradas. Acompanhe o crescimento real da conta.' },
      { label: 'Estatísticas', desc: 'Estatísticas detalhadas de performance: win rate, profit factor, drawdown, Sharpe ratio e distribuição de resultados.' },
      { label: 'Relatórios', desc: 'Relatórios de performance por robô, estratégia e período. Exporte dados para análise externa.' },
      { label: 'Diário', desc: 'Diário de trading. Registre suas operações manuais, observações e reflexões para evolução contínua.' },
      { label: 'Simulador', desc: 'Simulador de capital. Teste estratégias sem arriscar dinheiro real. Perfeito para validar novas abordagens.' },
      { label: 'Custos', desc: 'Calculadora de custos operacionais: spreads, comissões e swaps. Estime o impacto dos custos nos resultados.' },
    ],
  },
  {
    title: 'Área do Trader',
    icon: User,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    items: [
      { label: 'Perfil MT5', desc: 'Dados completos da sua conta: saldo, equidade, margem livre, alavancagem e histórico de transações sincronizado.' },
      { label: 'Depósitos e Retiradas', desc: 'Histórico de depósitos (type=2) e retiradas (type=3) sincronizados do MT5. Acompanhe o fluxo financeiro da conta.' },
      { label: 'Sugestões Inteligentes', desc: 'Recomendações baseadas em boas práticas: margem de segurança, drawdown máximo, diversificação, meta diária e mais.' },
    ],
  },
];

export const RadarGuide: React.FC = () => {
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
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Guia</span> Radar
              <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-sm tracking-widest uppercase">Manual do Sistema</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs mt-2 flex items-center gap-2">
              <Cpu size={12} className="text-blue-500" /> Guia Completo do Radar FX — Robôs, Ferramentas e Gestão
            </p>
          </div>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * sIdx }}
          className={`${section.bgColor} ${section.borderColor} backdrop-blur-xl rounded-[2.5rem] border p-8 shadow-2xl relative overflow-hidden`}
        >
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50`}></div>

          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-xl ${section.bgColor} ${section.borderColor} border`}>
              <section.icon size={18} className={section.color} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{section.title}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.items.map((item) => (
              <div
                key={item.label}
                className="bg-slate-800/30 rounded-xl p-4 border border-white/5 hover:bg-slate-800/50 transition-all duration-200"
              >
                <p className="text-sm font-bold text-white mb-1.5">{item.label}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
