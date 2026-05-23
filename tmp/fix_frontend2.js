const fs = require('fs');
const filePath = 'c:/Users/Deah/Desktop/Radar-FX/client/src/components/GoldScalperPanel.tsx';

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;
const eol = content.includes('\r\n') ? '\r\n' : '\n';

// ===== FIX 1: Adicionar campos à interface antes do fechamento =====
// Buscar "    coolOffRemainingMs: number;" e adicionar os novos campos depois
const anchor1 = '    coolOffRemainingMs: number;';
const idx1 = content.indexOf(anchor1);
if (idx1 !== -1) {
    const insertAfter = anchor1;
    const newFields = eol + '    floatingProfit?: number;' + eol + '    openPositions?: number;' + eol + '    netDailyProfit?: number;';
    content = content.replace(insertAfter, insertAfter + newFields);
    changes++;
    console.log('✅ FIX 1: Campos floatingProfit, openPositions, netDailyProfit adicionados à interface');
} else {
    console.log('❌ FIX 1: coolOffRemainingMs não encontrado');
}

// ===== FIX 2: Atualizar KPI cards =====
// Buscar label 'Perda (Robô)' e adicionar os novos KPIs depois
const perdaKPI = "{ label: 'Perda (Rob";
const perdaIdx = content.indexOf(perdaKPI);
if (perdaIdx !== -1) {
    // Encontrar o final dessa linha (até o }, do array)
    const lineEndIdx = content.indexOf('},', perdaIdx);
    if (lineEndIdx !== -1) {
        const insertPoint = lineEndIdx + 2; // depois de '},'
        const newKPIs = eol + 
            "                    { label: `Flutuante (${status.openPositions || 0})`, value: `$${(status.floatingProfit || 0).toFixed(2)} `, color: (status.floatingProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Activity size={16} /> }," + eol +
            "                    { label: 'L\\u00edquido Dia', value: `$${(status.netDailyProfit || 0).toFixed(2)} `, color: (status.netDailyProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Target size={16} /> },";
        content = content.substring(0, insertPoint) + newKPIs + content.substring(insertPoint);
        changes++;
        console.log('✅ FIX 2: KPI cards de Flutuante e Líquido Dia adicionados');
    }
} else {
    console.log('❌ FIX 2: KPI Perda (Robô) não encontrado');
}

if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎯 Total: ${changes} correções no frontend!`);
} else {
    console.log('\n❌ Nenhuma correção no frontend');
}
