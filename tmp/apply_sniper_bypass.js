const fs = require('fs');
const path = 'c:/Users/Deah/Desktop/Radar-FX/server/src/services/GoldScalperEngine.ts';

let content = fs.readFileSync(path, 'utf8');

// Substitui o bloco de conflito pela liberação total do Sniper M1
const target = /const conflict = \(m1Sig === 'BUY' && this\.currentM5Trend === 'DOWN'\) \|\| \s+\(m1Sig === 'SELL' && this\.currentM5Trend === 'UP'\);\s+if \(!conflict\) \{[\s\S]+?\} else \{[\s\S]+?\}/g;

const replacement = `// MODO STRESS TEST: Soberania M5 desativada por patch
                                this.currentM1SniperTrigger = m1Sig;
                                this.sniperTriggerSource = 'M1';
                                if (m1Sig && Date.now() % 30000 < 5000) this.log('SNI-PER', "\\u{1F680} [STRESS TEST] Gatilho M1 Liberado: " + m1Sig);`;

if (content.match(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ Sniper Bypass aplicado com sucesso via Patch!');
} else {
    // Fallback: Tenta um match mais genérico se o literal falhar
    const fallbackTarget = /const conflict = \(m1Sig === 'BUY' && this\.currentM5Trend === 'DOWN'\) \|\|[\s\S]+?this\.currentM1SniperTrigger = null;/g;
    if (content.match(fallbackTarget)) {
        content = content.replace(fallbackTarget, replacement);
        fs.writeFileSync(path, content);
        console.log('✅ Sniper Bypass aplicado via Fallback Patch!');
    } else {
        console.log('❌ Erro: Não foi possível localizar o ponto de inserção no arquivo.');
    }
}
