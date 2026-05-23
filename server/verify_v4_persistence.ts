import { GoldScalperEngine } from './src/services/GoldScalperEngine';
import fs from 'fs';
import path from 'path';

async function verifyPersistence() {
    console.log('🔍 Verificando persistência da opção Neuro Convergence v4.0...');

    // 1. Simular recebimento de configuração via API
    console.log('📡 Chamando GoldScalperEngine.updateSettings({ neuroConvergence: true })...');
    GoldScalperEngine.updateSettings({ neuroConvergence: true });

    // 2. Aguardar pequeno delay de escrita
    await new Promise(r => setTimeout(r, 500));

    // 3. Ler o arquivo diretamente do disco
    const SETTINGS_PATH = path.resolve(process.cwd(), 'gold_scalper_settings.json');
    if (fs.existsSync(SETTINGS_PATH)) {
        const content = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        console.log('\n📄 Conteúdo do arquivo gold_scalper_settings.json:');
        console.log(`- neuroConvergence: ${content.neuroConvergence}`);
        
        if (content.neuroConvergence === true) {
            console.log('\n✅ SUCESSO: A opção Neuro Convergence foi persistida no disco!');
        } else {
            console.log('\n❌ ERRO: A opção não foi encontrada no arquivo.');
        }
    } else {
        console.log('\n❌ ERRO: Arquivo de configurações não encontrado em ' + SETTINGS_PATH);
    }
}

verifyPersistence();
