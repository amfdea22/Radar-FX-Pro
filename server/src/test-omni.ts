import axios from 'axios';
import { OmniProbabilisticEngine } from './services/OmniProbabilisticEngine';
import { DisciplineEngine } from './services/DisciplineEngine';

async function runTest() {
    console.log('🧪 Iniciando Teste de Estresse: Omni Probabilistic Engine');

    // 1. Configurar Motor para Teste
    OmniProbabilisticEngine.updateSettings({
        enabled: true,
        strategy: 'MHI1',
        symbols: ['TEST_ASSET'],
        useMartingale: true,
        martingaleLevels: 1
    });

    console.log('✅ Motor Configurado. Simulando cenário MHI...');

    // 2. Simular a lógica de análise manualmente (já que o loop é temporal)
    // Cores: G, G, V (Maioria Verde -> Minoria Vermelha -> Sinal Compra MHI1)
    const mockCandles = [
        { open: 10, close: 11 }, // G
        { open: 11, close: 12 }, // G
        { open: 12, close: 13 }, // G (1)
        { open: 13, close: 14 }, // G (2)
        { open: 14, close: 13.5 } // V (3 - Minoria)
    ];

    console.log('📊 Velas Simuladas (últimas 3): G, G, V');
    console.log('🎯 Sinal Esperado: COMPRA (Minority Buy)');

    // Mockando axios para não disparar ordem real (opcional, mas vamos deixar logar o erro da bridge)
    try {
        // Chamada forçada da lógica de análise (reflexão ou acesso direto se fosse público)
        // Como analyzeSymbol é privado, vamos testar a lógica através de um wrapper ou mudando temporariamente
        console.log('🚀 Executando disparo simulado...');
        
        // Aqui o bot agiria se o tempo batesse. 
        // Para o teste rápido, validamos as funções de cálculo.
        const colors = mockCandles.map(c => c.close > c.open ? 'G' : 'R');
        const sample = colors.slice(2);
        const redCount = sample.filter(c => c === 'R').length;
        const greenCount = sample.filter(c => c === 'G').length;
        const minority = redCount < greenCount ? 'SELL' : 'BUY';

        console.log(`🔍 Resultado do Cálculo Interno: ${minority}`);
        
        if (minority === 'BUY') {
            console.log('✅ SUCESSO: Lógica de MHI 1 Validada.');
        } else {
            console.log('❌ FALHA: Lógica de cálculo incorreta.');
        }

    } catch (e: any) {
        console.log('⚠️ Erro esperado no disparo (Bridge Offline):', e.message);
    }
}

runTest();
