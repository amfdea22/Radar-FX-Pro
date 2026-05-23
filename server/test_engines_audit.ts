import { VSAEngine } from './src/services/VSAEngine';
import { InstitutionalEngine } from './src/services/InstitutionalEngine';
import { GoldenWhaleEngine } from './src/services/GoldenWhaleEngine';
import { MarketDataService } from './src/services/MarketDataService';
import * as dotenv from 'dotenv';

dotenv.config();

async function runAudit() {
    console.log('🕵️‍♂️ Iniciando Auditoria de Motores Radar FX...\n');

    const testAssets = ['XAUUSD', 'EURUSD', 'BTCUSD', 'NAS100'];

    for (const symbol of testAssets) {
        console.log(`--- Auditando Ativo: ${symbol} ---`);

        try {
            // 1. Teste de Dados de Mercado (Redundância Tripla)
            const bars = await MarketDataService.getRecentBars(symbol, 20);
            console.log(`📊 Dados de Mercado: ${bars.length > 0 ? '✅ OK (' + bars.length + ' bars)' : '❌ FALHA'}`);

            if (bars.length >= 5) {
                // 2. Teste VSA
                const vsa = VSAEngine.analyze(bars);
                console.log(`🔍 VSA Engine: ${vsa ? '🎯 Sinal Detectado: ' + vsa.name : '⚪ Sem padrão no momento'}`);

                // 3. Teste Institutional (SMC)
                const smc = await InstitutionalEngine.detectSharkActivity(symbol);
                console.log(`🦈 Institutional: ${smc ? '🎯 Pegada Detectada (' + smc.type + ')' : '⚪ Sem atividade institucional'}`);

                // 4. Teste Golden Whale (apenas XAU)
                if (symbol === 'XAUUSD') {
                    const whale = await GoldenWhaleEngine.evaluate(symbol);
                    console.log(`🏆 Golden Whale: ${whale ? '🎯 Oportunidade Gerada (' + whale.type + ')' : '⚪ Condições não atendidas'}`);
                }
            } else {
                console.warn(`⚠️ Barras insuficientes para análise de motores.`);
            }

        } catch (err) {
            console.error(`❌ Erro durante auditoria de ${symbol}:`, err instanceof Error ? err.message : err);
        }
        console.log('');
    }

    console.log('✅ Auditoria de Motores Concluída.');
}

runAudit();
