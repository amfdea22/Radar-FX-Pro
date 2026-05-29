export type BotState =
    | 'IDLE'
    | 'AWAITING_CONFIRM_CLOSE_ALL'
    | 'AWAITING_SYMBOL'
    | 'AWAITING_LOT';

export interface BotSession {
    chatId: number | string;
    state: BotState;
    data: Record<string, any>;
    createdAt: number;
    lastActivity: number;
}

export class BotSessionManager {
    private static sessions = new Map<string, BotSession>();
    private static readonly SESSION_TIMEOUT_MS = 5 * 60 * 1000;

    static getSession(chatId: number | string): BotSession {
        const key = String(chatId);
        const existing = this.sessions.get(key);
        if (existing && Date.now() - existing.lastActivity < this.SESSION_TIMEOUT_MS) {
            return existing;
        }
        const session: BotSession = {
            chatId,
            state: 'IDLE',
            data: {},
            createdAt: Date.now(),
            lastActivity: Date.now(),
        };
        this.sessions.set(key, session);
        return session;
    }

    static setState(chatId: number | string, state: BotState, data?: Record<string, any>) {
        const session = this.getSession(chatId);
        session.state = state;
        session.lastActivity = Date.now();
        if (data) {
            Object.assign(session.data, data);
        }
    }

    static clearSession(chatId: number | string) {
        this.sessions.delete(String(chatId));
    }

    static cleanup() {
        const now = Date.now();
        for (const [key, s] of this.sessions) {
            if (now - s.lastActivity > this.SESSION_TIMEOUT_MS) {
                this.sessions.delete(key);
            }
        }
    }
}
