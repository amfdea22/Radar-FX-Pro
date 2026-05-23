
import { MarketDataService } from './src/services/MarketDataService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function testSymbols() {
    const symbols = ['EURUSD', 'GBPUSD', 'NAS100', 'US30', 'JPN225', 'BTCUSD'];

    console.log('🧪 Testing MarketDataService for multiples symbols...');

    for (const sym of symbols) {
        console.log(`\n--- Testing ${sym} ---`);
        try {
            const bars = await MarketDataService.getRecentBars(sym, 5);
            if (bars && bars.length > 0) {
                console.log(`✅ ${sym}: Found ${bars.length} bars.`);
                console.log(`   Sample: O:${bars[0].o} H:${bars[0].h} L:${bars[0].l} C:${bars[0].c} V:${bars[0].v}`);
            } else {
                console.warn(`❌ ${sym}: No bars found.`);
            }
        } catch (e: any) {
            console.error(`💥 ${sym}: Error -> ${e.message}`);
        }
    }
}

testSymbols();
