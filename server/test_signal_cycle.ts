import { SignalEngine } from './src/services/SignalEngine';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSignalCycle() {
    console.log('🤖 Iniciando Teste de Ciclo do SignalEngine...\n');

    try {
        // Iniciando o ciclo (que agora é paralelo e otimizado)
        // @ts-ignore - Acessando método privado para teste (generateNewSignals)
        await SignalEngine.generateNewSignals();

        const signals = SignalEngine.getSignals();
        console.log(`📊 Total de Sinais Ativos: ${signals.length}`);

        if (signals.length > 0) {
            console.log('\n--- Amostra de Sinais Gerados ---');
            signals.slice(0, 5).forEach(s => {
                console.log(`📍 [${s.setup}] ${s.symbol} - ${s.type} (Conf: ${s.confidence}%) - SL: ${s.sl} TP: ${s.tp}`);
            });
        } else {
            console.log('⚪ Nenhum sinal gerado neste ciclo (volatilidade baixa ou mercado parado).');
        }

    } catch (err) {
        console.error('❌ Erro no ciclo do SignalEngine:', err);
    }
}

testSignalCycle();
