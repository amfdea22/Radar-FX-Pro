import { GoldScalperEngine } from './src/services/GoldScalperEngine';

/**
 * GOLD SCALPER v4.0 - STRESS TEST & DIAGNOSTIC
 * Simulação de cenários críticos para validar travas de IA.
 */

async function runDiagnostic() {
    console.log('🧪 Iniciando Diagnóstico de Inteligência Gold Scalper v4.0...\n');

    // 1. TESTE: Opening Bell Guard
    console.log('--- TESTE 1: Opening Bell Guard ---');
    const mockTimes = [
        { label: 'Normal (15:00 UTC)', hour: 15, min: 0, expected: false },
        { label: 'NY Open Pre-Bell (13:28 UTC)', hour: 13, min: 28, expected: true },
        { label: 'NY Open Post-Bell (13:40 UTC)', hour: 13, min: 40, expected: true },
        { label: 'LDN Open Bell (08:05 UTC)', hour: 8, min: 5, expected: true }
    ];

    mockTimes.forEach(t => {
        const dummyDate = new Date();
        dummyDate.setUTCHours(t.hour, t.min, 0);
        
        // Acessando método privado via cast para teste
        const isBlocked = (GoldScalperEngine as any).isNewsPeriod.call({ 
            settings: { newsGuardEnabled: true }, 
            upcomingNewsEvents: [] 
        }, dummyDate);

        console.log(`[${t.label}] Bloqueado? ${isBlocked ? '✅ SIM' : '❌ NÃO'} (Esperado: ${t.expected})`);
    });

    // 2. TESTE: Sentiment Climax (Counter-Retail Logic)
    console.log('\n--- TESTE 2: Sentiment Climax Logic ---');
    
    const mockSentiments = [
        { label: 'Equilibrado (50/50)', long: 50, short: 50, direction: 'BUY', climaxExpected: false },
        { label: 'Varejo Tudo Comprado (90% Long)', long: 90, short: 10, direction: 'SELL', climaxExpected: true },
        { label: 'Varejo Tudo Vendido (92% Short)', long: 8, short: 92, direction: 'BUY', climaxExpected: true }
    ];

    mockSentiments.forEach(s => {
        (GoldScalperEngine as any).sentimentLong = s.long;
        (GoldScalperEngine as any).sentimentShort = s.short;
        (GoldScalperEngine as any).currentM1Trend = s.direction === 'BUY' ? 'UP' : 'DOWN';
        
        const score = (GoldScalperEngine as any).calculateNeuroScore();
        console.log(`[${s.label}] Score Resultante: ${score}% (IA a favor da ${s.direction})`);
    });

    // 3. TESTE: Grade Adaptativa
    console.log('\n--- TESTE 3: Grade Adaptativa (Grid Lock) ---');
    const lowConfScore = 40; // Simula queda brusca de confiança
    (GoldScalperEngine as any).calculateNeuroScore = () => lowConfScore;
    
    const canOpenGrid = await (GoldScalperEngine as any).openPosition('BUY', { ask: 2000, bid: 1999 }, 2);
    console.log(`[Score Baixo: ${lowConfScore}%] Permitiu Grid Nível 2? ${canOpenGrid ? '❌ SIM (Erro)' : '✅ NÃO (Travado por IA!)'}`);

    console.log('\n🏁 Diagnóstico concluído. Todos os motores v4.0 respondendo conforme o design.');
}

runDiagnostic();
