import { describe, it, assert, printResults } from './test_runner';

describe('SignalEngine — Classificação de Trades', () => {

    const catalog = [
        { name: 'Alpha Robot', category: 'Forex', magic: 88881, symbols: ['XAUUSD', 'EURUSD'], priority: 1 },
        { name: 'Gold Scalper', category: 'Metais', magic: 9999, symbols: ['XAUUSD'], priority: 0 },
        { name: 'Shark Bot', category: 'Metais', magic: 9876, symbols: ['XAUUSD', 'BTCUSD'], priority: 0 },
        { name: 'Supreme Engine', category: 'Forex', magic: 7777, symbols: ['EURUSD'], priority: 1 },
        { name: 'Shark Hunt XAU', category: 'Metais', symbols: ['XAUUSD'], priority: 1 },
        { name: 'Golden Rejection', category: 'Metais', symbols: ['XAUUSD', 'XAGUSD'], priority: 2 },
        { name: 'Alpha Shark', category: 'Metais/Cripto', symbols: ['XAUUSD', 'BTCUSD'], priority: 3 },
    ];

    function classifyTrade(comment: string, magic: number, symbol: string): string {
        const c = comment.toLowerCase();
        const sym = symbol.toUpperCase();

        for (const s of catalog) {
            if (c.includes(s.name.toLowerCase())) return s.name;
        }
        for (const s of catalog) {
            if (s.magic && magic === s.magic) return s.name;
        }
        const candidates = catalog
            .filter(s => s.symbols.includes(sym))
            .sort((a, b) => a.priority - b.priority);
        if (candidates.length > 0) return candidates[0].name;
        return 'UNKNOWN';
    }

    it('classifica por comment com nome exato', () => {
        assert.equal(classifyTrade('AlphaV2 Alpha Shark', 88881, 'XAUUSD'), 'Alpha Shark');
    });

    it('classifica por comment Golden Rejection', () => {
        assert.equal(classifyTrade('AlphaV2 Golden Rejection', 88881, 'XAUUSD'), 'Golden Rejection');
    });

    it('classifica por magic quando comment genérico', () => {
        assert.equal(classifyTrade('AlphaInst ML_SIG', 88881, 'XAUUSD'), 'Alpha Robot');
    });

    it('classifica Shark Bot por magic 9876', () => {
        assert.equal(classifyTrade('SharkBot', 9876, 'XAUUSD'), 'Shark Bot');
    });

    it('classifica Gold Scalper por magic 9999', () => {
        assert.equal(classifyTrade('GSL1', 9999, 'XAUUSD'), 'Gold Scalper');
    });

    it('fallback por símbolo (priority 0 = Gold Scalper)', () => {
        assert.equal(classifyTrade('manual', 0, 'XAUUSD'), 'Gold Scalper');
    });

    it('UNKNOWN para símbolo não mapeado', () => {
        assert.equal(classifyTrade('manual', 0, 'INVALID'), 'UNKNOWN');
    });

    it('case insensitive no comment', () => {
        assert.equal(classifyTrade('ALPHA ROBOT', 0, 'XAUUSD'), 'Alpha Robot');
    });

    it('comment tem prioridade sobre magic', () => {
        assert.equal(classifyTrade('SharkBot', 9999, 'XAUUSD'), 'Gold Scalper');
    });

    it('AlphaV2 comentário com nome parcial', () => {
        assert.equal(classifyTrade('AlphaV2 Golden Rejection', 0, 'XAUUSD'), 'Golden Rejection');
    });
});

printResults();
