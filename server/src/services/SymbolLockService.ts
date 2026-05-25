interface SymbolLock {
    symbol: string;
    engineName: string;
    ticket: number;
    direction: string;
    acquiredAt: number;
    expiresAt: number;
}

export class SymbolLockService {
    private static locks: Map<string, SymbolLock> = new Map();
    private static readonly LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24h max
    private static readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 min between same symbol

    static acquire(symbol: string, engineName: string, ticket: number, direction: string): boolean {
        const normalized = symbol.toUpperCase();
        const existing = this.locks.get(normalized);

        // Se já existe lock, verifica se expirou
        if (existing) {
            if (Date.now() < existing.expiresAt) {
                console.warn(`🔒 SymbolLock: ${normalized} já bloqueado por ${existing.engineName} (ticket ${existing.ticket})`);
                return false;
            }
            // Lock expirado, remove
            this.locks.delete(normalized);
        }

        // Mesma engine, mesmo símbolo: verifica cooldown
        if (existing?.engineName === engineName && Date.now() - existing.acquiredAt < this.COOLDOWN_MS) {
            console.warn(`🔒 SymbolLock: Cooldown de ${this.COOLDOWN_MS/1000}s para ${engineName} em ${normalized}`);
            return false;
        }

        this.locks.set(normalized, {
            symbol: normalized,
            engineName,
            ticket,
            direction,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + this.LOCK_DURATION_MS,
        });

        console.log(`🔒 SymbolLock: ${engineName} bloqueou ${normalized} (ticket ${ticket})`);
        return true;
    }

    static release(symbol: string, engineName: string): boolean {
        const normalized = symbol.toUpperCase();
        const lock = this.locks.get(normalized);
        if (lock && lock.engineName === engineName) {
            this.locks.delete(normalized);
            console.log(`🔒 SymbolLock: ${engineName} liberou ${normalized}`);
            return true;
        }
        return false;
    }

    static releaseByTicket(ticket: number): boolean {
        for (const [symbol, lock] of this.locks) {
            if (lock.ticket === ticket) {
                this.locks.delete(symbol);
                console.log(`🔒 SymbolLock: Ticket ${ticket} liberou ${symbol}`);
                return true;
            }
        }
        return false;
    }

    static isLocked(symbol: string): { locked: boolean; by?: string } {
        const normalized = symbol.toUpperCase();
        const lock = this.locks.get(normalized);
        if (lock && Date.now() < lock.expiresAt) {
            return { locked: true, by: lock.engineName };
        }
        if (lock) this.locks.delete(normalized); // cleanup expired
        return { locked: false };
    }

    static getAllLocks(): SymbolLock[] {
        const now = Date.now();
        const active: SymbolLock[] = [];
        for (const [, lock] of this.locks) {
            if (now < lock.expiresAt) active.push(lock);
            else this.locks.delete(lock.symbol);
        }
        return active;
    }

    static getLocksByEngine(engineName: string): SymbolLock[] {
        return this.getAllLocks().filter(l => l.engineName === engineName);
    }

    static reset() {
        this.locks.clear();
        console.log('🔒 SymbolLock: Todos os locks foram resetados');
    }

    static async withLock<T>(
        symbol: string,
        engineName: string,
        direction: string,
        orderFn: () => Promise<{ ticket: number } & T>
    ): Promise<{ ticket: number } & T> {
        const normalized = symbol.toUpperCase();
        const existing = this.locks.get(normalized);
        if (existing && Date.now() < existing.expiresAt) {
            throw new Error(`🔒 ${normalized} já bloqueado por ${existing.engineName} (ticket ${existing.ticket})`);
        }
        if (existing) this.locks.delete(normalized);

        const result = await orderFn();
        if (result.ticket) {
            this.acquire(normalized, engineName, result.ticket, direction);
        }
        return result;
    }
}
