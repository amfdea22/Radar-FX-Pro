export const MAGIC_MAP: Record<number, string> = {
    888111: 'Micro Sniper',
    777111: 'Speed Scalper',
    9999: 'Gold Scalper',
    8888: 'Crypto IA',
    88881: 'Alpha Robot',
    7777: 'Supreme',
    999111: 'Omni',
    9876: 'Shark Bot',
    777222: 'Swing Trader',
    444111: 'Bitcoin Pro',
    202605: 'Agent IA',
    999001: 'Motor IA',
    999000: 'Recovery Engine',
};

export const MAGIC_BY_ID: Record<string, number> = {
    'micro-scalper': 888111,
    'forex-scalper': 777111,
    'gold-scalper': 9999,
    'crypto-ia': 8888,
    robot: 88881,
    supreme: 7777,
    omni: 999111,
    'shark-bot': 9876,
    'swing-trader': 777222,
    'bitcoin-pro': 444111,
    'agent-ia': 202605,
    'motor-ia': 999001,
    recovery: 999000,
};

export function getEngineName(magic: number): string {
    return MAGIC_MAP[magic] || `Magic ${magic}`;
}
