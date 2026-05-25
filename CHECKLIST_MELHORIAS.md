# CHECKLIST — O QUE PRECISA SER FEITO PARA MELHORAR O RADAR FX

## PRIORIDADE ALTA (🔥 Impacto direto na estabilidade)

### Infraestrutura & Confiabilidade
- [x] **Criar Windows Service** para o servidor Node.js (iniciar automaticamente com o Windows)
- [x] **Criar Windows Service** para a Bridge Python (iniciar automaticamente com o Windows)
- [x] **Health check endpoint** com métricas detalhadas (uptime, memória, status de cada engine)
- [x] **Rate limiting** nas APIs públicas (evitar sobrecarga acidental) — via cooldowns internos + SymbolLock
- [ ] **Graceful shutdown** — salvar estado de todos os engines ao desligar
- [x] **Log rotation** — InfraService com backup diário + pruning de 7 dias
- [x] **Armazenamento de senha do Telegram** — suporte a env var `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`

### Bridge MT5
- [x] **Reconexão automática** — InfraService.checkBridgeHealth() tenta reconexão a cada 60s
- [ ] **Fila de ordens** — implementar fila para evitar perda de ordens se a bridge estiver ocupada
- [x] **Timeout configurável** — RetryService com timeout customizável + backoff exponencial
- [x] **Health check entre servidor e bridge** — InfraService monitora bridge a cada 60s

### Persistência & Estado
- [ ] **Salvar estado automaticamente a cada X minutos** (não só no update) — evitar perda em crash
- [x] **Backup automático dos arquivos JSON** — InfraService copia settings para pasta `backups/` diariamente
- [x] **Verificar engines que faltam settings file** — 8 arquivos criados (alpha_supreme, discipline, guardian, micro_scalper, shark_bot, omni, crypto_risk, telegram)

## PRIORIDADE MÉDIA (⚡ Performance & Precisão)

### Conflitos entre Robôs
- [x] **Evitar que dois robôs operem o mesmo símbolo simultaneamente** — SymbolLockService
- [x] **Sistema de lock por símbolo** — acquire/release/isLocked, 24h duration, 5min cooldown
- [ ] **Orquestrador de robôs** — coordenar qual robô opera quando, baseado em prioridade

### Otimização de Memória
- [x] **Limpar alertas antigos** — AlertEngine com prune a cada 30min (>24h)
- [ ] **Limpar histórico de trades na memória** — engines mantêm arrays crescentes; limitar a 1000
- [x] **Limpar signal_tracker.json** — InfraService poda entradas >30 dias a cada 30min
- [ ] **Garbage collection** — forçar GC em momentos de baixa atividade

### Banco de Dados
- [x] **Implementar Prisma** — SQLite com 6 models (Trade, Signal, StrategyStats, Alert, Setting, JournalEntry)
- [ ] **Migrar settings para banco** — mais seguro que JSON files para escrita concorrente
- [x] **Migrar trade history para banco** — DatabaseService com CRUD completo

### Tratamento de Erros
- [ ] **Substituir catch silenciosos** — muitos `catch { }` sem log; dificulta debug
- [x] **Circuito de retry com backoff** — RetryService: 3 tentativas com delay exponencial (1s, 2s, 4s)
- [x] **Timeout global para chamadas à bridge** — RetryService com timeout customizável (default 15s)
- [ ] **Notificação de erros críticos** — enviar alerta Telegram quando um engine falhar

## PRIORIDADE BAIXA (📈 Melhorias & Features)

### Testes
- [x] **Testes unitários** para o SignalEngine (lógica de classificação) — 10 testes
- [x] **Testes unitários** para o AlertEngine — 13 testes (no recovery_engine_test)
- [ ] **Testes de integração** — servidor + bridge mock
- [ ] **Modo simulação** — executar todos os robôs em modo paper trading

### Qualidade de Código
- [ ] **TypeScript strict mode** — ativar `strict: true` no tsconfig e corrigir erros
- [ ] **Remover dead code** — arquivos .bak, imports não usados, funções comentadas
- [ ] **Padronizar nomenclatura** — mistura de camelCase, snake_case nos JSONs
- [ ] **Adicionar ESLint + Prettier** ao projeto

### Frontend
- [ ] **Code splitting** — carregar componentes pesados sob demanda (lazy loading)
- [ ] **Bundle analysis** — verificar tamanho do bundle e identificar otimizações
- [ ] **Cache de respostas da API** — evitar chamadas repetidas para os mesmos endpoints
- [ ] **Modo escuro consistente** — verificar se todos os componentes seguem o tema
- [ ] **Responsivo** — garantir que todas as telas funcionem em mobile
- [ ] **Estado global** — usar zustand para estado compartilhado (já está nas deps)

### Segurança
- [ ] **Autenticação** — adicionar login básico na API (nunca expor para internet sem auth)
- [x] **Token Telegram em env var** — suporte a `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no .env
- [ ] **Sanitização de input** — validar parâmetros recebidos nas APIs
- [ ] **CORS configurado** — atualmente parece aberto para todas origens

### Monitoramento
- [ ] **Métricas de performance** — tempo de resposta da bridge, latência de ordens
- [x] **Dashboard de saúde do sistema** — HealthService com 14 componentes + cache 10s
- [ ] **Alerta quando margem estiver baixa** — notificação automática
- [ ] **Log de erros centralizado** — arquivo único com todos os erros do sistema

### Engines
- [ ] **Golden Whale Hunter** — verificar se está operacional ou só em modo alerta
- [ ] **Azure OpenAI** — pasta server/src/azure/ existe mas não parece integrada
- [ ] **Machine Learning** — integrar modelo XGBoost treinado (cerebro_smc_btcusd.pkl) com os engines
- [ ] **Otimizar Alpha Robot** — 166 trades no histórico mas só 3 recentes; verificar se está operando ativamente
- [ ] **Otimizar Supreme Engine** — 299 trades mas 0 no MT5 history; verificar sync
- [ ] **Pipeline Python–TypeScript** — integrar robo_execucao.py com o servidor Node

### Usabilidade
- [ ] **Notificação sonora** — SoundService.js existe mas pode não estar conectado aos eventos
- [ ] **Modo escuro/claro** — alternância entre temas
- [ ] **Exportar relatórios em PDF** — jspdf já está nas dependências
- [ ] **Atalhos de teclado** — navegação rápida entre telas
- [ ] **Pesquisa global** — buscar qualquer coisa (símbolo, robô, trade)
