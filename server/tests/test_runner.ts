let passed = 0;
let failed = 0;
let currentSuite = '';

export function describe(name: string, fn: () => void) {
    currentSuite = name;
    console.log(`\n🧪 ${name}`);
    fn();
}

export function it(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e: any) {
        failed++;
        console.log(`  ❌ ${name} — ${e.message}`);
    }
}

export const assert = {
    isTrue(condition: boolean, message: string) {
        if (!condition) throw new Error(message || 'Expected true');
    },
    isFalse(condition: boolean, message: string) {
        if (condition) throw new Error(message || 'Expected false');
    },
    equal<T>(a: T, b: T, message?: string) {
        if (a !== b) throw new Error(message || `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
    },
};

export function printResults() {
    const total = passed + failed;
    console.log(`\n📊 Results: ${passed}/${total} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}
