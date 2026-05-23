const fs = require('fs');
const filePath = 'c:/Users/Deah/Desktop/Radar-FX/client/src/components/GoldScalperPanel.tsx';

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// ===== FIX 1: Adicionar campos ao type GoldScalperStatus =====
const oldInterface = `    coolOffRemainingMs: number;
    operationLog: Array<{ time: string; action: string; details: string }>;

}`;

const newInterface = `    coolOffRemainingMs: number;
    floatingProfit?: number;
    openPositions?: number;
    netDailyProfit?: number;
    operationLog: Array<{ time: string; action: string; details: string }>;

}`;

if (content.includes(oldInterface)) {
    content = content.replace(oldInterface, newInterface);
    changes++;
    console.log('✅ FIX 1: Campos floatingProfit, openPositions, netDailyProfit adicionados à interface');
} else {
    console.log('❌ FIX 1: Interface não encontrada');
}

// ===== FIX 2: Atualizar KPI cards para mostrar o lucro real do MT5 =====
const oldKPI = `                    { label: 'Lucro (Robô)', value: \`$\${status.dailyProfit.toFixed(2)} \`, color: 'text-trader-green', icon: <DollarSign size={16} /> },
                    { label: 'Perda (Robô)', value: \`$\${status.dailyLoss.toFixed(2)} \`, color: 'text-trader-red', icon: <AlertTriangle size={16} /> },`;

const newKPI = `                    { label: 'Lucro (Robô)', value: \`$\${status.dailyProfit.toFixed(2)} \`, color: 'text-trader-green', icon: <DollarSign size={16} /> },
                    { label: 'Perda (Robô)', value: \`$\${status.dailyLoss.toFixed(2)} \`, color: 'text-trader-red', icon: <AlertTriangle size={16} /> },
                    { label: \`Flutuante (\${status.openPositions || 0})\`, value: \`$\${(status.floatingProfit || 0).toFixed(2)} \`, color: (status.floatingProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Activity size={16} /> },
                    { label: 'Líquido Dia', value: \`$\${(status.netDailyProfit || 0).toFixed(2)} \`, color: (status.netDailyProfit || 0) >= 0 ? 'text-trader-green' : 'text-trader-red', icon: <Target size={16} /> },`;

if (content.includes(oldKPI)) {
    content = content.replace(oldKPI, newKPI);
    changes++;
    console.log('✅ FIX 2: KPI cards de Flutuante e Líquido Dia adicionados');
} else {
    console.log('❌ FIX 2: KPI cards não encontrados');
}

// ===== FIX 3: Ajustar grid de 6 para 8 colunas (ou manter 4-col grid) =====
const oldGrid = `<div className="grid grid-cols-6 gap-4">`;
const newGrid = `<div className="grid grid-cols-4 lg:grid-cols-8 gap-4">`;
if (content.includes(oldGrid)) {
    content = content.replace(oldGrid, newGrid);
    changes++;
    console.log('✅ FIX 3: Grid ajustado para 8 colunas (responsivo)');
} else {
    console.log('⚠️ FIX 3: Grid não encontrado (pode já estar OK)');
}

// ===== FIX 4: Verificar se Activity e Target estão importados =====
// Verificar imports do lucide-react
if (!content.includes('Activity') || !content.includes('Target')) {
    // Buscar a linha de import do lucide-react
    const lucideImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/;
    const match = content.match(lucideImportRegex);
    if (match) {
        let imports = match[1];
        const iconsToAdd = [];
        if (!imports.includes('Activity')) iconsToAdd.push('Activity');
        if (!imports.includes('Target')) iconsToAdd.push('Target');
        
        if (iconsToAdd.length > 0) {
            const newImports = imports.trimEnd() + ', ' + iconsToAdd.join(', ') + ' ';
            content = content.replace(match[1], newImports);
            changes++;
            console.log(`✅ FIX 4: Importações adicionadas: ${iconsToAdd.join(', ')}`);
        }
    } else {
        console.log('⚠️ FIX 4: Import lucide-react não encontrado');
    }
} else {
    console.log('✅ FIX 4: Activity e Target já importados');
}

if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎯 Total: ${changes} correções no frontend aplicadas!`);
} else {
    console.log('\n❌ Nenhuma correção no frontend aplicada');
}
