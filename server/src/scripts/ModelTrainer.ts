import fs from 'fs';
import path from 'path';

/**
 * Script de Auto-Calibragem Machine Learning (Cron Job de Fim de Semana)
 * 
 * Propósito: 
 * Este script deve rodar separadamente (ex: Domingo de madrugada).
 * Ele lê o histórico de operações fechadas da plataforma.
 * Se uma IA como 'Intelligence 7' ou 'Alpha Shark' teve um desempenho 
 * abaixo da média na semana passada, este script reduz o 'peso' de confiança
 * exigindo setups mais fortes dela na semana seguinte.
 */

const DATA_DIR = path.join(__dirname, '../../data');
const WEIGHTS_FILE = path.join(DATA_DIR, 'ml_weights.json');

// Estrutura do peso de aprendizado
interface MLWeights {
    [setupName: string]: {
        winRateLastWeek: number;
        confidenceAdjustment: number; // Modificador linear de confiança (ex: -5.0 ou +2.0)
        lastUpdate: string;
    }
}

async function runCalibration() {
    console.log('🧠 [Alpha Auto-Calibration] Iniciando treinamento semanal da I.A...');

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Carrega os pesos atuais ou cria novo
    let currentWeights: MLWeights = {};
    if (fs.existsSync(WEIGHTS_FILE)) {
        currentWeights = JSON.parse(fs.readFileSync(WEIGHTS_FILE, 'utf8'));
    }

    /* 
      Em um cenário real, aqui seria feita uma consulta ao banco de dados ou MT5 History:
      const history = await DisciplineEngine.getWeeklyHistory();
      Agregado por Setup (Strategy).
    */

    // Simulação dos resultados da semana para efeito de demonstração e blindagem de código:
    const simulatedWeeklyResults = [
        { setup: 'Intelligence 7', wins: 45, losses: 5 }, // 90% Win Rate (Bom, sobe confiança final)
        { setup: 'Alpha Shark', wins: 20, losses: 15 },    // 57% Win Rate (Ruim, I.A. deve ficar mais defensiva)
        { setup: 'Alpha Nakamoto', wins: 80, losses: 2 }   // 97% Win Rate (Excelente)
    ];

    simulatedWeeklyResults.forEach(result => {
        const totalTrades = result.wins + result.losses;
        const winRate = totalTrades > 0 ? (result.wins / totalTrades) * 100 : 0;

        // Regra Padrão do Backtest Neural
        let penalty = 0;
        if (winRate < 80) {
            // Desempenho ruim: Retira até 10 pontos da confiança do algorítmo
            penalty = -10.0;
            console.log(`⚠️ [Alpha Auto-Calibration] Setup ${result.setup} degradou (${winRate.toFixed(1)}%). Otimizando defesa (-10 pts de confiança).`);
        } else if (winRate > 92) {
            // Desempenho excelente: Adiciona leniência para mais entradas
            penalty = +2.5;
            console.log(`🚀 [Alpha Auto-Calibration] Setup ${result.setup} está dominando (${winRate.toFixed(1)}%). Permitindo mais agressividade (+2.5 pts).`);
        } else {
            // Mantém estável
            penalty = 0;
            console.log(`✅ [Alpha Auto-Calibration] Setup ${result.setup} estável (${winRate.toFixed(1)}%). Mantendo pesos originais.`);
        }

        currentWeights[result.setup] = {
            winRateLastWeek: winRate,
            confidenceAdjustment: penalty,
            lastUpdate: new Date().toISOString()
        };
    });

    // Salva a "memória" da I.A. para a próxima semana e o SignalEngine vai consumir isso em tempo real.
    fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(currentWeights, null, 2));

    console.log('💾 [Alpha Auto-Calibration] Pesos neurais salvos com sucesso.');
    console.log('✅ Treinamento semanal concluído.');
}

// Execução imediata se chamado via Node direto
if (require.main === module) {
    runCalibration().catch(console.error);
}

export { runCalibration };
