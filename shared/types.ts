export interface Trade {
    id: string;
    asset: 'WIN' | 'WDO';
    type: 'BUY' | 'SELL';
    contracts: number;
    entryPrice: number;
    exitPrice?: number;
    points: number;
    resultFinancial: number;
    timestamp: Date;
    setup?: string;
    emotion?: string;
    followedPlan: boolean;
}

export interface RiskConfig {
    riskPerTradeAmount: number;
    riskPerTradePercent: number;
    dailyStopLoss: number;
    dailyTakeProfit: number;
    maxContractsWIN: number;
    maxContractsWDO: number;
}
