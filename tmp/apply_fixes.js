const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Deah/Desktop/Radar-FX/server/src/services/GoldScalperEngine.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Corrigir a redeclaração da variável 'direction' e limpar a lógica de decisão
console.log('Patch v14.6: Corrigindo sintaxe e unificando lógica...');

const decisionBlockRegex = /let direction: 'BUY' \| 'SELL' = 'BUY';\s+const microTrend = this\.getMicroTrend\(\);\s+\/\/ --- MODO SNIPER ALPHA \(v14\.5\) ---\s+let direction: 'BUY' \| 'SELL' \| null = null;/;
const unifiedDecision = `// --- MODO SNIPER ALPHA (v14.6) ---
            let direction: 'BUY' | 'SELL' | null = null;
            
            if (this.settings.sniperMode && this.currentM1SniperTrigger) {
                direction = this.currentM1SniperTrigger;
                this.log('SNI-PER', "🎯 MODO SNIPER ATIVO: " + direction);
            } else if (this.settings.swingTrendFilter) {
                if (this.currentSwingTrend === 'UP') direction = 'BUY';
                else if (this.currentSwingTrend === 'DOWN') direction = 'SELL';
            } else {
                const microTrend = this.getMicroTrend();
                if (microTrend === 'UP') direction = 'BUY';
                else if (microTrend === 'DOWN') direction = 'SELL';
            }`;

content = content.replace(decisionBlockRegex, unifiedDecision);

// Remover qualquer outra ocorrência de 'const microTrend = this.getMicroTrend();' que ficou órfã logo abaixo se houver
content = content.replace(/const microTrend = this\.getMicroTrend\(\);\s+\/\/ --- MODO SNIPER ALPHA \(v14\.6\)/, '// --- MODO SNIPER ALPHA (v14.6)');

fs.writeFileSync(filePath, content);
console.log('✅ Patch v14.6 aplicado com sucesso. O erro de sintaxe foi removido.');
