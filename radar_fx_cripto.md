## Ativos criptomoedas
BTC
ETH
BNB
DOGE
SOL
XRP
ADA
AVAX
MATIC
DOT
LINK
TRX
LTC
SHIB
BCH
ETC
XLM
XMR
ZEC
EOS
DAI
USDC
USDT

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
23. Criar um menu exclusivo no Radar FX uma area de Inteligencia e sinais copy trader para Criptomoedas com alta acertividade para operações 24h e todos os dias com todas criptomedas e todos os dados de informações estatisticas de acertividade e lucros e perdas e tudo mais