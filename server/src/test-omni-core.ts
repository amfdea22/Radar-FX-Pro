// Teste Funcional Nucleo Omni
const strategies = {
    MHI: (colors: string[]) => {
        const sample = colors.slice(2); // Últimas 3 velas
        const redCount = sample.filter(c => c === 'R').length;
        const greenCount = sample.filter(c => c === 'G').length;
        return redCount < greenCount ? 'SELL' : 'BUY';
    },
    TWIN_TOWERS: (colors: string[]) => colors[0] === 'G' ? 'BUY' : 'SELL',
    CYCLE_OF_3: (colors: string[]) => {
        if (colors[2] === colors[3] && colors[3] === colors[4]) {
            return colors[4] === 'G' ? 'SELL' : 'BUY';
        }
        return 'WAIT';
    }
};

function runValidation() {
    console.log('🧪 VALIDANDO NÚCLEO OMNI PROBABILISTIC');

    // Cenário 1: MHI 1 (G, G, V) -> Minoria Vermelha -> SELL? 
    // Wait, MHI original: 3 velas finais, aposta na minoria.
    // Se G-G-V -> Minoria é V -> Sinal é SELL (se for contra a maioria).
    // No meu código: redCount (1) < greenCount (2) -> minority = SELL. Correto.
    
    const c1 = ['G','G','G','G','R']; 
    const res1 = strategies.MHI(c1);
    console.log(`[Cenário 1] MHI (G,G,R): Esperado SELL, Resultado: ${res1}`);

    // Cenário 2: Ciclo de 3 (G, G, G) -> Reversão SELL
    const c2 = ['G','R','G','G','G'];
    const res2 = strategies.CYCLE_OF_3(c2);
    console.log(`[Cenário 2] Ciclo de 3 (G,G,G): Esperado SELL, Resultado: ${res2}`);

    // Cenário 3: Torres Gêmeas (1ª Verde) -> Buy
    const c3 = ['G','V','V','V','V'];
    const res3 = strategies.TWIN_TOWERS(c3);
    console.log(`[Cenário 3] Torres Gêmeas (1ª G): Esperado BUY, Resultado: ${res3}`);

    if (res1 === 'SELL' && res2 === 'SELL' && res3 === 'BUY') {
        console.log('\n✅ TODAS AS LÓGICAS NUCLEARES VALIDADAS COM SUCESSO.');
    } else {
        console.log('\n❌ ERRO NA VALIDAÇÃO DAS REGRAS.');
    }
}

runValidation();
