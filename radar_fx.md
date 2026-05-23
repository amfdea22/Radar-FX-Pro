## Visão Geral do Produto
- Descrição concisa  
  Aplicativo web/mobile para simulação de ganhos, multiplicação de capital e controle completo de day trade, focado em Índice (WIN) e Dólar (WDO). Substitui planilhas manuais com cálculos automatizados de risco, stops, resultados e performance, fornecendo disciplina operacional, previsibilidade e visualizações acionáveis para traders iniciantes e intermediários.

- Público-alvo  
  - Day traders iniciantes e intermediários que operam Índice (WIN) e Dólar (WDO)  
  - Usuários que hoje usam planilhas para controlar operações e desejam automação e métricas objetivas  
  - Traders que precisam de disciplina (limite de perdas, bloqueios) e simulações de capital

- Proposta de valor única  
  Substituir planilhas complexas e processos manuais por um sistema dedicado que combina simulação de capital, gestão de risco automatizada, registro simples de trades e análises de performance padronizadas, tudo com baixa latência e interface otimizada para uso durante o pregão.

## Requisitos Funcionais
Lista consolidada e priorizada (MoSCoW).

Must have (essenciais para MVP)
1. Simulador de capital básico
   - Entrada de capital inicial
   - Simulação por dia, semana e mês usando parâmetros configuráveis (% ganho diário, % loss máximo, nº médio de trades/dia)
   - Visualização de curva de crescimento (gráfico)
2. Registro manual de trades
   - Formulário rápido (modal) para inserir ativo, tipo (compra/venda), contratos, pontos gain/stop, resultado financeiro
   - Conversão automática Pontos ↔ Reais com valor do ponto configurável
3. Gestão de risco básica
   - Risco por trade (R$ e %), cálculo automático de nº máximo de contratos
   - Stop financeiro por trade
   - Stop diário (bloqueio quando perda diária atingida)
4. Dashboard simples de resultados
   - Resultado diário, semanal, mensal
   - Win rate, média de gain/loss, drawdown
5. Armazenamento seguro do usuário
   - Auth (email/senha), criptografia at-rest, backups
6. Interface web responsiva e performática
   - Carregamento rápido, interações com latência perceptível <100ms

Should have (prioritários após MVP)
7. Diário de trade completo
   - Campos extra: seguiu o plano (sim/não), setup, emoção
   - Filtragem e busca por período/ativo/setup
8. Conversão e controle de contratos específicos para WIN e WDO
   - Templates por ativo com valor do ponto, tamanho do contrato
9. Alertas e disciplina
   - Alertas de stop diário, meta diária, excesso de trades
   - Bloqueio operacional opcional (modo manual/automático)
10. Simulador de estratégia (comparador A vs B)
    - Alterar variáveis (stop/gain/contratos/frequência) e comparar resultados
11. Exportação/Importação de dados (CSV/Excel)
12. Testes de cálculos com logs e histórico (audit trail)

Could have (desejáveis)
13. Importação automática de ordens via API de corretoras (ativos compatíveis)
14. Integração com feeds de preço em tempo real (cotações)
15. Mobile app PWA/Native com sincronização offline
16. Gráficos avançados com replay de operações no tempo
17. Notificações push (desktop e mobile)
18. Modelos de estratégia compartilháveis entre usuários (templates)
19. Mecanismo de simulação Monte Carlo para avaliação de drawdowns e consistência

Won't have (fora do escopo inicial)
20. Execução automática de ordens em corretora (ordens algorítmicas) — NÃO no MVP  
21. Suporte para classes de ativos fora de WIN/WDO no lançamento inicial (pode ser Fase 2/3)  
22. Ferramentas de backtesting intraday com tick-by-tick por enquanto (após validação de uso)

## Histórias de Usuário
Formato: Como [tipo de usuário], eu quero [ação] para [benefício]

1. Como day trader iniciante, eu quero simular um plano de crescimento diário com % ganho e loss para visualizar quanto meu capital poderia crescer em 3 meses, para decidir tamanho de posição e metas.
2. Como trader que usa planilha, eu quero registrar um trade rapidamente via modal, para não interromper minha rotina de operação.
3. Como trader, eu quero que o sistema calcule automaticamente o nº máximo de contratos baseado no risco por trade, para nunca exceder perda financeira planejada.
4. Como usuário, eu quero configurar valor do ponto para WIN e WDO e converter pontos ↔ reais automaticamente, para evitar erros de cálculo.
5. Como operador disciplinado, eu quero receber um alerta e bloqueio automático quando atingir o stop diário, para evitar overtrade.
6. Como usuário, eu quero visualizar win rate, média de gain/loss e drawdown para o mês atual, para avaliar minha performance objetiva.
7. Como trader, eu quero comparar duas estratégias (A vs B) variando stop/gain/contratos para escolher a estratégia mais robusta.
8. Como usuário, eu quero filtrar meu diário por setup e emoção, para analisar se aspectos comportamentais impactam performance.
9. Como administrador de conta, eu quero exportar o histórico em CSV, para integrar com análises externas.
10. Como usuário móvel, eu quero que os dados sejam persistidos localmente quando offline e sincronizados depois, para registrar trades mesmo com conexão instável.

## Estrutura de Páginas/Seções
- Hierarquia de navegação (nível superior)
  1. Dashboard (home)
  2. Simulador de Capital
  3. Gestão de Risco
  4. Diário de Trade (Journal)
  5. Simulador de Estratégia (Comparador)
  6. Alertas & Disciplina
  7. Relatórios & Export (CSV)
  8. Configurações (conta, ativos, valor do ponto, preferências)
  9. Ajuda / Documentação / Glossário

- Wireframes em texto para cada página principal

1. Dashboard (home)
   - Top bar: logo, período seletor (hoje/semana/mês/personalizado), busca rápida, atalhos (novo trade, novo simulador)
   - Painéis principais (arranjáveis/dashlets):
     - Resumo financeiro: saldo atual, PL do dia, var% vs início do periodo
     - Gráfico de capital (curva) — interativo (hover mostra valor por data)
     - Performance rápida: Win rate, Avg Gain, Avg Loss, Risco Médio
     - Alerts: stop diário status, meta do dia
     - Quick Actions: Botão novo trade (modal), Abrir simulador
   - Lista de trades recentes (tabela com paginação/infinite scroll)

2. Simulador de Capital
   - Formulário lateral esquerdo (inputs): capital inicial, horizonte (dias/sem/mês), % ganho diário médio, % loss máximo, trades/dia média, volatilidade opcional
   - Botões: Rodar simulação, Reset
   - Área principal: gráfico de curva com cenários (média, piores/ melhores) e tabela de valores por período
   - Comparador lateral (opção): adicionar Strategy B para comparação

3. Gestão de Risco
   - Seção: parâmetros globais (risco por trade padrão em R$ e %)
   - Calculadora interativa: inserir stop (pontos/R$), preço atual, o app retorna nº de contratos sugeridos
   - Slider para Stop diário e limite de perdas consecutivas com número visual (barra de progresso)
   - Histórico de bloqueios (quando stop diário foi ativado)

4. Diário de Trade (Journal)
   - Filtro topo (data, ativo, setup, seguiu plano)
   - Lista/tabela com colunas configuráveis: data, hora, ativo, tipo, contratos, pontos gain/stop, resultado, seguiu plano, setup, emoção
   - Row expandida ou modal para ver detalhes e notas
   - Botões inline: editar, duplicar, exportar linha
   - Visualizações agregadas: performance por setup, por emoção, por ativo

5. Simulador de Estratégia
   - Painel de comparação com 2 colunas (Estratégia A / Estratégia B)
   - Inputs por estratégia: stop, gain, contratos, freq trades/dia, risco por trade
   - Rodar simulação e visualizar curvas lado a lado, métricas e tabela comparativa (expectativa matemática, drawdown, consistência)
   - Botão "Salvar modelo" e "Comparar com histórico real"

6. Alertas & Disciplina
   - Lista de regras configuráveis: stop diário, meta diária, limite trades/dia, perdas consecutivas
   - Toggle para Bloqueio Operacional (simulação vs automáticas)
   - Histórico de alertas acionados com opção de desbloquear manualmente

7. Relatórios & Export
   - Gerar relatório por período com métricas chave
   - Export CSV/Excel, PDF com gráficos
   - Agendamento de relatórios por email (fase 2)

8. Configurações
   - Conta: email, senha, 2FA
   - Ativos: templates WIN/WDO com valor do ponto, contrato padrão
   - Preferências: tema, formato moeda, linguagem, reducao de movimento (accessibility)
   - Integrações (conexões com corretoras/feeds) - ligado/desligado

## Design e Interações
- Paleta de cores sugerida
  - Neutros base: Grafite-escuro #1F2937 (background/menus), Cinza-claro #F3F4F6 (cards)
  - Accent primário: Verde trader #16A34A (gains, ações positivas)
  - Accent secundário: Vermelho stop #EF4444 (perdas, stops)
  - Destaque: Amarelo/Âmbar #F59E0B (alertas/metas)
  - Neutros adicionais: Branco #FFFFFF (card background), Azul suave #2563EB (links/ícones)
  - Observação: garantir contraste WCAG AA/AAA para texto principal e elementos críticos

- Tipografia
  - Títulos: Inter SemiBold (ou "Inter" variable) — boa legibilidade em UI
  - Texto corpo: Inter Regular 14px / 16px para visualização densa
  - Mono para valores numéricos/ágregados: JetBrains Mono ou IBM Plex Mono (facilita leitura de números)
  - Escalas responsivas: H1 28–32px, H2 20–24px, body 14–16px

- Animações e microinterações (detalhadas)
  Observações gerais:
  - Animações leves e informativas; evitar efeitos que distraiam durante o pregão.
  - Respeitar preferência do usuário por reduzir movimento (prefers-reduced-motion).
  - Utilizar transformações GPU-accelerated (translate, scale, opacity) e evitar animações que forcem reflows (width/height em muitos elementos).
  - Duração padrão: 180–300ms para microinterações; 400–700ms para transições de tela/seqüências.
  - Easing padrão: cubic-bezier(0.2, 0.8, 0.2, 1) para entradas suaves; ease-out para notificações.

  Detalhes por interação:
  1. Inserção de trade (modal quick-add)
     - Trigger: clique em "Novo Trade" ou atalho (Ctrl/Cmd + Enter)
     - Entrada: modal surge com escala 0.98 → 1 e fade-in (opacidade 0 → 1); duration 200ms, easing ease-out.
     - Campo de valor com animação de foco: border-color + subtle lift (translateY(-2px)) 120ms.
     - Após salvar: row de trade é animada na lista com slide-in from top + fade (translateY: -8px → 0, opacity 0→1) e highlight temporário em fundo (fade em 2s) para dar sensação de confirmação.

  2. Gráfico de curva de capital
     - Hover sobre ponto: tooltip aparece com scale 0.95 → 1 e fade em 120ms.
     - Ao rodar nova simulação: linha antiga dessatura (opacity 0.3 em 200ms) enquanto nova linha cresce com stroke-dashoffset animation (GSAP/Framer Motion) para animar traçado — duration 700ms, easing linear.
     - Animação de zona de drawdown: área preenchida com pulsação sutil quando drawdown ultrapassa threshold (opacity 0.6 → 0.85, 800ms loop de 1 ciclo) — opcional e desativável.

  3. Barra de risco/stop (slider)
     - Drag do slider: thumb escala 1 → 1.05 na interação; pista mostra preenchimento com cor (verde→amarelo→vermelho) dependendo da porcentagem.
     - Enquanto arrasta, o valor numérico atual “flutua” acima do thumb com um pequeno pop (translateY -6px, scale 1.05) 120ms.
     - On release: suavizar para posição com spring (Framer Motion spring config: stiffness 260, damping 20).

  4. Alerts / Bloqueio operacional
     - Quando stop diário é atingido: bandeira vermelha desliza do topo (translateY -100% → 0) com shadow e ícone de bloqueio, dur 300ms.
     - Block overlay: modal de bloqueio com blur do fundo (backdrop-filter) e animação de fade-in; botão "Desbloquear" requer confirmação (double action) para evitar erro.

  5. Feedback de erro/validação
     - Validação inline: shake leve do campo (translateX ±6px) 150ms + texto de erro em vermelho aparecendo com fade 150ms.
     - Sucesso na ação: tick animado com Lottie (micro-animation) tocando por 700ms e sumindo.

  6. Inserção/Remoção em massa (import/export)
     - Bulk insert: rows animam sequentially com stagger 40ms usando GSAP timeline ou Framer Motion staggerChildren.
     - Delete multiple: rows diminuem opacidade e deslizam para esquerda com scale 0.98 (duration 200ms).

  7. Transições entre páginas
     - Transições de layout leves (fade + slide) 200–300ms; evitar animação completa que impacte render de gráficos.

  Acessibilidade:
  - Respeitar prefers-reduced-motion: transformar animações em cross-fade simples ou desativá-las.
  - Todos os elementos com animação devem ser controláveis via preferências de usuário.

- Bibliotecas recomendadas (animação e UI)
  - Framer Motion (React) — para microinterações, page transitions, spring physics e gerenciamento de complexidade em componentes reativos. Excelente para interações UI & composição.
  - GSAP (GreenSock) — para timelines complexas e sequências (por exemplo, animação do gráfico com vários elementos sincronizados); útil quando precisa de performance fina de timeline.
  - Lottie + Bodymovin — para animações vetoriais (confirmações, onboarding) leves e consistentes.
  - D3.js ou ApexCharts / Chart.js / Highcharts / TradingView Lightweight Charts — para gráficos financeiros:
    - Lightweight-charts (TradingView) para curvas de capital e gráficos de preço intraday (leve e otimizado).
    - ApexCharts para gráficos de área/linha com tooltips e exportação.
    - D3.js para custom visuals e cálculo de área de drawdown se necessário.
  - React Spring (alternativa ao Framer Motion) se preferir API física para gestos.
  - Dexie.js / idb — para IndexedDB/local-first sync (PWA/offline).
  - decimal.js / big.js — para cálculos financeiros com precisão decimal evitando float imprecision.

## Considerações Técnicas
- Stack tecnológica sugerida
  - Frontend
    - React + TypeScript (Next.js se precisar SSR/SSG; Vite para app SPA)
    - State management: React Query / TanStack Query (server state), Zustand ou Redux Toolkit (local state)
    - UI: Tailwind CSS + component library (Headless UI / Radix UI / Chakra UI) para acessibilidade
    - Charts: Lightweight-charts para dados de preço; ApexCharts/D3 para análises
    - Animações: Framer Motion + GSAP para casos específicos; Lottie para micro-animations
    - Local persistence: Dexie.js (IndexedDB) para offline-first e sincronização
  - Backend
    - Node.js + TypeScript (NestJS ou Fastify/Express)
    - ORM: Prisma ou TypeORM
    - DB: PostgreSQL (TimescaleDB se históricos de tick forem relevantes)  
    - Cache/real-time: Redis (limites, locks), WebSocket (Socket.IO) para atualizações em tempo real
    - Storage: S3-compatible para backups/exportações
    - Autenticação: OAuth2 / JWT; suporte 2FA (TOTP)
  - Infraestrutura
    - Containerização: Docker; orquestração opcional Kubernetes ou ECS
    - CI/CD: GitHub Actions / GitLab CI
    - Observability: Sentry (errors), Prometheus/Grafana (metrics)
    - Hospedagem: AWS/GCP/Cloud Run / Vercel (frontend)

- Integrações necessárias
  - (Fase 1) Serviços mínimos: email provider (SendGrid), sistema de pagamentos (se monetizar)
  - (Fase 2) Integrações opcionais: APIs de corretoras (Robo/XP/Broker X), feeds de preço em tempo real (WebSocket), login por OAuth (Google/Apple)
  - Exchange rate / mercado: serviços de cotações se necessário para conversão externa

- Requisitos de performance
  - Latência de UI: respostas a interações <100ms percebidos
  - Carregamento inicial (first meaningful paint) <2s em conexões medianas
  - Charts: render incremental para grandes séries, virtualização de tabelas (react-window) para longos históricos
  - Cálculos financeiros: realizar em worker (Web Worker) para não bloquear UI em simulações pesadas ou Monte Carlo
  - Precisão: usar decimal.js/big.js para todas as operações monetárias; testes unitários cobrindo cenários extremos
  - Escalabilidade: arquitetura de backend com filas (RabbitMQ/SQS) para tarefas pesadas (export, simulações em larga escala)
  - Segurança: criptografia at-rest e in-transit (TLS), hashed passwords (bcrypt/argon2), possiblidade de auditoria de ações

## Roadmap Sugerido

MVP (Fase 1)
- Implementar autenticação básica (email/senha, 2FA opcional)
- Simulador de capital básico (parâmetros essenciais e gráfico)
- Registro manual de trades via modal (formulário rápido)
- Conversão pontos ↔ reais com templates WIN/WDO
- Gestão de risco básica: risco por trade, stop financeiro, cálculo de contratos, stop diário
- Dashboard simples com métricas básicas (win rate, avg gain/loss, drawdown)
- Armazenamento seguro (Postgres + criptografia) e export CSV
- UI responsiva web-first; otimização para uso durante pregão
- Animações essenciais com Framer Motion (entradas e feedbacks)
- Testes automáticos básicos e monitoramento de erros

Melhorias futuras (Fase 2)
- Diário de trade completo com campos de emoção, setup e padrões de filtragem avançados
- Simulador de Estratégia comparativo (A vs B) com visualização lado a lado
- Alertas configuráveis (stop diário, meta diária, excesso de trades) com bloqueio operacional
- Importação de ordens via API de corretora (parcial)
- PWA e sincronização offline (IndexedDB + Dexie.js)
- Export/Import avançado e agendamento de relatórios
- Melhoria nas animações com GSAP para timelines complexos e Lottie para onboarding
- Integração com feeds de preços em tempo real (WebSocket), charts avançados (lightweight-charts)
- A/B testing de UX e dashboards personalizáveis

Visão de longo prazo (Fase 3)
- Integração completa com múltiplas corretoras (import e reconciliation automática de trades)
- Backtesting intraday avançado com tick-by-tick e replay
- Motor de simulação Monte Carlo e otimização de portfólio de estratégias
- Marketplace de estratégias e templates compartilháveis entre usuários
- Funcionalidades colaborativas (contas de estudo, coach dashboards)
- Aplicativos nativos mobile com sincronização em tempo real e notificações push
- Recursos de monetização: planos por assinatura, licenciamento de templates, integrações premium