
import { SignalEngine } from './src/services/SignalEngine';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    console.log('--- Checking Active Signals ---');
    const signals = await SignalEngine.getActiveSignals();
    console.log(`Total active signals: ${signals.length}`);
    signals.forEach(s => {
        console.log(`- ${s.symbol} | ${s.setup} | Conf: ${s.confidence}% | Inst: ${s.isInstitutional}`);
    });
}

check();
