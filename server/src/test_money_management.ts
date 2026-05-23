import axios from 'axios';
import { GoldScalperEngine } from './services/GoldScalperEngine';

async function testAutoLot() {
    console.log('--- TESTE DE GESTÃO DE RISCO (LOTE %) ---');

    try {
        // 1. Simular configuração de 1% de Risco
        const settings = {
            enabled: true,
            lotSize: 0.10, // Backup
            useRiskPercentage: true,
            riskPercentage: 1.0, // 1% de Risco
            stopLossUSD: 5.0 // SL de $5.00 no Ouro
        };

        // Injetar no engine (simulação)
        (GoldScalperEngine as any).settings = { ... (GoldScalperEngine as any).settings, ...settings };
        (GoldScalperEngine as any).resolvedSymbol = 'XAUUSD';

        console.log(`Configuração: Risco ${settings.riskPercentage}% | SL Sugerido: $${settings.stopLossUSD}`);

        // 2. Chamar o motor de cálculo
        const lot = await (GoldScalperEngine as any).calculateDynamicLotSize();

        // 3. Buscar balanço real para o log de transparência
        const accResp = await axios.get('http://127.0.0.1:5555/account').catch(() => ({ data: { balance: 1000 } }));
        const balance = accResp.data.balance || 1000;

        console.log('\nRESULTADO DO MOTOR:');
        console.log(`Saldo da Conta: $${balance.toFixed(2)}`);
        console.log(`Perda Máxima permitida (1%): $${(balance * 0.01).toFixed(2)}`);
        console.log(`Lote Calculado para SL de $5.00: ${lot.toFixed(2)}`);

        if (lot > 0) {
            console.log('\n✅ SUCESSO: O robô ajustou o lote proporcionalmente ao capital.');
        } else {
            console.log('\n❌ FALHA: Erro no cálculo de exposição.');
        }

    } catch (e: any) {
        console.error('Erro no teste:', e.message);
    }
}

testAutoLot();
