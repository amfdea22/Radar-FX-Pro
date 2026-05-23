## Requisitos Funcionais
Lista consolidada e priorizada (MoSCoW).
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
   2. Criar uma gestão de risco com base em parâmetrs configuráveis
   3. Criar uma gestão de risco para carteira pequena com saldo pequeno, medio e grande. 
   4. Configurar a gestão de risco com base: Conservadora, intermediária e agressiva
   5. Configurar a gestão de risco de forma eficiente, lógica com base de daos acertivas e precisas pela I.A.
   6. Configurar Gestão de Risco para os traders manauais e sinais.
   