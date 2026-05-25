import axios, { AxiosRequestConfig } from 'axios';

interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    timeoutMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    timeoutMs: 15000,
};

export class RetryService {
    static async get(url: string, config?: AxiosRequestConfig & { retryConfig?: Partial<RetryConfig> }): Promise<any> {
        const timeout = config?.timeout || DEFAULT_CONFIG.timeoutMs;
        const resp = await this.execute(() => axios.get(url, { ...config, timeout }), config?.retryConfig);
        return resp.data;
    }

    static async post(url: string, data?: any, config?: AxiosRequestConfig & { retryConfig?: Partial<RetryConfig> }): Promise<any> {
        const timeout = config?.timeout || DEFAULT_CONFIG.timeoutMs;
        const resp = await this.execute(() => axios.post(url, data, { ...config, timeout }), config?.retryConfig);
        return resp.data;
    }

    private static async execute(fn: () => Promise<any>, userConfig?: Partial<RetryConfig>): Promise<any> {
        const cfg = { ...DEFAULT_CONFIG, ...userConfig };
        let lastError: any;
        for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                if (attempt < cfg.maxRetries) {
                    const isBridgeError = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.message?.includes('timeout');
                    if (!isBridgeError) throw error;
                    const delay = Math.min(cfg.baseDelayMs * Math.pow(2, attempt), cfg.maxDelayMs);
                    console.warn(`🔄 RetryService: Tentativa ${attempt + 1}/${cfg.maxRetries + 1} falhou — tentando novamente em ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }
}
