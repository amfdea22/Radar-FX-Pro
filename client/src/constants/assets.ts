export type AssetCategory = 'B3' | 'CRYPTO' | 'FOREX' | 'CUSTOM';

export interface Asset {
    id: string;
    name: string;
    category: AssetCategory;
    symbol: string; // Pepperstone/MT5 Symbol
    pointValue: number; // Value in BRL/USD per unit/point/pip
    precision: number;
    description?: string;
}

export const ASSETS: Asset[] = [
    // B3 Assets
    { id: 'wdo', name: 'WDO (Mini Dólar)', category: 'B3', symbol: 'USD/BRL', pointValue: 10.00, precision: 3, description: 'Micro-moeda Pepperstone' },

    // Crypto Assets
    { id: 'btc', name: 'BTC/USD', category: 'CRYPTO', symbol: 'BTCUSD', pointValue: 1.00, precision: 2 },
    { id: 'eth', name: 'ETH/USD', category: 'CRYPTO', symbol: 'ETHUSD', pointValue: 1.00, precision: 2 },
    { id: 'sol', name: 'SOL/USD', category: 'CRYPTO', symbol: 'SOLUSD', pointValue: 1.00, precision: 2 },
    { id: 'bnb', name: 'BNB/USD', category: 'CRYPTO', symbol: 'BNBUSD', pointValue: 1.00, precision: 2 },
    { id: 'xrp', name: 'XRP/USD', category: 'CRYPTO', symbol: 'XRPUSD', pointValue: 1.00, precision: 4 },
    { id: 'ada', name: 'ADA/USD', category: 'CRYPTO', symbol: 'ADAUSD', pointValue: 1.00, precision: 4 },
    { id: 'doge', name: 'DOGE/USD', category: 'CRYPTO', symbol: 'DOGEUSD', pointValue: 1.00, precision: 5 },
    { id: 'dot', name: 'DOT/USD', category: 'CRYPTO', symbol: 'DOTUSD', pointValue: 1.00, precision: 3 },

    // Forex & Metals
    { id: 'eurusd', name: 'EUR/USD', category: 'FOREX', symbol: 'EURUSD', pointValue: 10.00, precision: 5 },
    { id: 'gbpusd', name: 'GBP/USD', category: 'FOREX', symbol: 'GBPUSD', pointValue: 10.00, precision: 5 },
    { id: 'usdjpy', name: 'USD/JPY', category: 'FOREX', symbol: 'USDJPY', pointValue: 10.00, precision: 3 },
    { id: 'audusd', name: 'AUD/USD', category: 'FOREX', symbol: 'AUDUSD', pointValue: 10.00, precision: 5 },
    { id: 'usdchf', name: 'USD/CHF', category: 'FOREX', symbol: 'USDCHF', pointValue: 10.00, precision: 5 },
    { id: 'usdcad', name: 'USD/CAD', category: 'FOREX', symbol: 'USDCAD', pointValue: 10.00, precision: 5 },
    { id: 'nzdusd', name: 'NZD/USD', category: 'FOREX', symbol: 'NZDUSD', pointValue: 10.00, precision: 5 },
    { id: 'eurgbp', name: 'EUR/GBP', category: 'FOREX', symbol: 'EURGBP', pointValue: 10.00, precision: 5 },
    { id: 'eurjpy', name: 'EUR/JPY', category: 'FOREX', symbol: 'EURJPY', pointValue: 10.00, precision: 3 },
    { id: 'gbpjpy', name: 'GBP/JPY', category: 'FOREX', symbol: 'GBPJPY', pointValue: 10.00, precision: 3 },
    { id: 'xauusd', name: 'XAU/USD (GOLD)', category: 'FOREX', symbol: 'XAUUSD', pointValue: 1.00, precision: 2 },
    { id: 'xagusd', name: 'XAG/USD (SILVER)', category: 'FOREX', symbol: 'XAGUSD', pointValue: 1.00, precision: 3 },

    // Indices
    { id: 'nas100', name: 'NAS100 (Nasdaq)', category: 'CUSTOM', symbol: 'NAS100', pointValue: 1.00, precision: 2 },
    { id: 'us30', name: 'US30 (Dow Jones)', category: 'CUSTOM', symbol: 'US30', pointValue: 1.00, precision: 2 },
    { id: 'us500', name: 'US500 (S&P 500)', category: 'CUSTOM', symbol: 'US500', pointValue: 1.00, precision: 2 },
    { id: 'ger40', name: 'GER40 (Dax)', category: 'CUSTOM', symbol: 'GER40', pointValue: 1.00, precision: 2 },
];
