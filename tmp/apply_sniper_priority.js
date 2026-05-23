const fs = require('fs');
const path = 'c:/Users/Deah/Desktop/Radar-FX/server/src/services/GoldScalperEngine.ts';

let content = fs.readFileSync(path, 'utf8');

// Alvo: Onde começa a lógica de direção no checkNewOpenings
const target = /let direction: 'BUY' \| 'SELL' = 'BUY';\s+const microTrend = this\.getMicroTrend\(\);/g;

const replacement = `let direction: 'BUY' | 'SELL' = 'BUY';
            const microTrend = this.getMicroTrend();

            // --- MODO SNIPER ALPHA (v14.3) ---
            if (this.settings.sniperMode && this.currentM1SniperTrigger) {
                direction = this.currentM1SniperTrigger;
                this.log('SNI-PER', "\\u{1F3AF} EXECUTANDO GATILHO SNIPER: " + direction);
                // Bypass de filtros secundários para teste de stress
            } else if (this.settings.swingTrendFilter) {`;

if (content.match(target)) {
    content = content.replace(target, replacement);
    // Também garante que a soberania do M5 esteja desativada no código se já não estiver
    const sovTarget = /const conflict = \(m1Sig === 'BUY' && this\.currentM5Trend === 'DOWN'\) \|\|[\s\S]+?this\.currentM1SniperTrigger = null;\s+\}/g;
    const sovReplacement = `// MODO STRESS TEST: Soberania M5 desativada
                                this.currentM1SniperTrigger = m1Sig;
                                this.sniperTriggerSource = 'M1';
                                if (m1Sig && Date.now() % 30000 < 5000) this.log('SNI-PER', "\\u{1F680} [STRESS TEST] Gatilho M1 Liberado: " + m1Sig);`;
    
    content = content.replace(sovTarget, sovReplacement);

    fs.writeFileSync(path, content);
    console.log('✅ Sniper Priority (v14.3) + Bypass aplicado com sucesso!');
} else {
    console.log('❌ Erro: Não foi possível localizar o ponto de inserção no checkNewOpenings.');
}
