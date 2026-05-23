import axios from 'axios';

async function test5PercentRisk() {
    console.log("=== INICIANDO TESTE DE RISCO 5% - GOLD SCALPER ===\n");

    try {
        // 1. Configurar o Robo para 5% de Risco
        console.log("Ajustando configurações para 5% de risco...");
        await axios.post('http://localhost:3000/api/mt5/gold-scalper/settings', {
            useRiskPercentage: true,
            riskPercentage: 5.0
        });

        // 2. Buscar Status para confirmar
        const statusResp = await axios.get('http://localhost:3000/api/mt5/gold-scalper/status');
        const settings = statusResp.data.settings;
        console.log(`Configuração atual: Risco %: ${settings.riskPercentage} | Ativo: ${settings.useRiskPercentage}`);

        // 3. Simular Cálculo de Lote (Chamando o endpoint de status que retorna o lote calculado se disponível ou calculando manualmente aqui para provar)
        const accResp = await axios.get('http://localhost:3000/api/mt5/account');
        const balance = accResp.data.balance;
        const equity = accResp.data.equity;

        console.log(`\nSaldo da Conta: $${balance.toLocaleString()}`);
        console.log(`Patrimônio (Equity): $${equity.toLocaleString()}`);

        // O GoldScalperEngine usa a distância do SL (atualmente fixo em $5 no cálculo)
        const slDistance = 5.0; // Distância do SL em USD (XAUUSD)
        const riskAmount = equity * (5.0 / 100);
        const lotSize = riskAmount / (slDistance * 100);

        console.log(`\n--- RESULTADO DA SIMULAÇÃO ---`);
        console.log(`Valor em Risco (5%): $${riskAmount.toFixed(2)}`);
        console.log(`Lote Calculado para XAUUSD: ${lotSize.toFixed(2)}`);
        console.log(`------------------------------\n`);

    } catch (error: any) {
        console.error("Erro no teste:", error.response?.data || error.message);
    }
}

test5PercentRisk();
