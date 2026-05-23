# Gold Scalper UI/UX & Engine Standards

Este documento formaliza os padrões de design e lógica do **Gold Scalper v4.0 (Neuro Convergence)**. Estes padrões devem ser mantidos em todas as atualizações futuras.

## 1. Identidade Visual (Premium Dark Trader)
- **Tema**: Slate-900 / Slate-950 (Fundo), Glassmorphism (Backdrop Blur).
- **Cores de Destaque**: 
  - `Amber-500` (IA / Neuro Score / Botão ON)
  - `Blue-400/500` (Matriz de Cognição / Tooltips)
  - `Emerald-400/500` (TP Dinâmico / Lucros)
  - `Rose-500` (Perdas / Alertas / Proteção)
- **Componentes**: Bordas arredondadas (`rounded-2xl`), Bordas semi-transparentes (`border-white/5`), Fontes em Itálico Black (`font-black italic`) para valores financeiros.

## 2. Componente Padrão de Explicação (InfoTooltip)
Todos os indicadores e configurações estratégicas DEVEM usar o componente `InfoTooltip`.
- **Fundo**: `bg-slate-900`
- **Borda**: `border-white/10`
- **Efeito**: `backdrop-blur-xl`, `shadow-2xl`
- **Comportamento**: Fade-in suave (`transition-all duration-300`) com seta centralizada.

## 3. Lógica do Neuro Core v3.2
- **Maturidade Neural**: Definida pelo `totalAnalyzed`. Cada 100 ciclos = 100% de maturidade da base atual.
- **Rigor Estratégico**: Valor dinâmico de `minScore`. Representa a régua de corte da IA.
- **Humor do Córtex**: Estado comportamental variável (`ANALÍTICO`, `CAUTELOSO`, `AGRESSIVO`, `PROTEÇÃO`) baseado em volatilidade e drawdown.

## 4. Gestão de Alvos Dinâmicos (ATR)
- Lógica de volatilidade baseada em ATR deve ser o pilar de proteção (opcional via toggle).
- Se `dynamicATRMode` for TRUE, os alvos de TP/SL originais são multiplicados por um `volatilityFactor` (0.7x a 2.0x).

## 5. Regras de Implementação
- **NUNCA** remover tooltips explicativos ao adicionar novas funcionalidades.
- **MANTER** a aura azul pulsante na Matriz de Cognição.
- **PRESERVAR** os efeitos de som (Coin/Success/Error) para feedback do usuário.
