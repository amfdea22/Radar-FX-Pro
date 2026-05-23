const fs = require('fs');
const filePath = 'c:/Users/Deah/Desktop/Radar-FX/server/src/services/GoldScalperEngine.ts';

let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    static async resetDailyCounters() {\r
        try {\r
            const status = await DisciplineEngine.getDailyStatus();\r
            this.profitOffset = status.profit >= 0 ? status.profit : 0;\r
            this.lossOffset = status.profit < 0 ? Math.abs(status.profit) : 0;\r
\r
            this.globalDailyProfit = 0;\r
            this.globalDailyLoss = 0;\r
\r
            // Reativar o robô se estiver desligado por limites\r
            if (!this.settings.enabled) {\r
                this.settings.enabled = true;\r
                this.saveSettings();\r
            }\r
\r
            this.log('RESET', 'Meta Diária resetada manualmente pelo usuário. Motores reativados.');\r
            AlertEngine.addAlert('GUARDIAN', 'INFO', 'Gold Scalper: Meta Resetada 🔄', 'O limite diário foi zerado manualmente e o robô está ativo novamente.');\r
            return true;\r
        } catch (e) {\r
            return false;\r
        }\r
    }`;

const newCode = `    static async resetDailyCounters() {\r
        try {\r
            // PRESERVAR saldos e lucros reais — NÃO zerar contadores\r
            // Apenas reativar o robô para continuar operando com dados intactos\r
\r
            // Reativar o robô se estiver desligado por limites\r
            if (!this.settings.enabled) {\r
                this.settings.enabled = true;\r
                this.saveSettings();\r
            }\r
\r
            this.log('RESET', 'Robô reativado manualmente. Saldos e lucros preservados.');\r
            AlertEngine.addAlert('GUARDIAN', 'INFO', 'Gold Scalper: Destravado 🔓', 'Robô reativado. Saldos e lucros do dia permanecem intactos.');\r
            return true;\r
        } catch (e) {\r
            return false;\r
        }\r
    }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ resetDailyCounters corrigido com sucesso!');
} else {
    console.log('❌ Código alvo não encontrado. Tentando busca parcial...');
    
    // Busca alternativa sem \r
    const oldCodeLF = oldCode.replace(/\r/g, '');
    const newCodeLF = newCode.replace(/\r/g, '');
    
    if (content.includes(oldCodeLF)) {
        content = content.replace(oldCodeLF, newCodeLF);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅ resetDailyCounters corrigido com sucesso (LF mode)!');
    } else {
        // Regex match
        const regex = /static async resetDailyCounters\(\)\s*\{[\s\S]*?this\.globalDailyProfit\s*=\s*0;[\s\S]*?this\.globalDailyLoss\s*=\s*0;[\s\S]*?AlertEngine\.addAlert\([^)]+\);[\s\S]*?return true;[\s\S]*?return false;[\s\S]*?\}\s*\}/;
        
        if (regex.test(content)) {
            const eol = content.includes('\r\n') ? '\r\n' : '\n';
            const replacement = [
                '    static async resetDailyCounters() {',
                '        try {',
                '            // PRESERVAR saldos e lucros reais — NÃO zerar contadores',
                '            // Apenas reativar o robô para continuar operando com dados intactos',
                '',
                '            // Reativar o robô se estiver desligado por limites',
                '            if (!this.settings.enabled) {',
                '                this.settings.enabled = true;',
                '                this.saveSettings();',
                '            }',
                '',
                "            this.log('RESET', 'Robô reativado manualmente. Saldos e lucros preservados.');",
                "            AlertEngine.addAlert('GUARDIAN', 'INFO', 'Gold Scalper: Destravado 🔓', 'Robô reativado. Saldos e lucros do dia permanecem intactos.');",
                '            return true;',
                '        } catch (e) {',
                '            return false;',
                '        }',
                '    }'
            ].join(eol);
            
            content = content.replace(regex, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('✅ resetDailyCounters corrigido via regex!');
        } else {
            console.log('❌ FALHA: Não foi possível localizar o método resetDailyCounters');
        }
    }
}
