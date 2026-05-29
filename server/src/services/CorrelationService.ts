import yahooFinance from 'yahoo-finance2';

export interface CorrelationMatrix {
  assets: string[];
  matrix: Record<string, Record<string, number>>;
  lastUpdated: string;
}

export class CorrelationService {
  static async getXAUUSDCorrelationMatrix(period: string = '6mo'): Promise<CorrelationMatrix> {
    try {
      // Define assets to compare with XAUUSD
      const assets = ['XAUUSD=X', 'EURUSD=X', 'GBPUSD=X', '^GSPC', 'GC=F'];
      const assetNames = ['XAUUSD', 'EURUSD', 'GBPUSD', 'SPX', 'GOLD'];
      
      // Download historical data for each asset individually
      const prices: Record<string, number[]> = {};
      
      for (let i = 0; i < assets.length; i++) {
        const symbol = assets[i];
        const assetName = assetNames[i];
        
        // Get historical data for this symbol - explicitly request history data
        const quoteData = await yahooFinance.historical(symbol, {
          period1: Date.now() - (180 * 24 * 60 * 60 * 1000), // 6 months ago
          period2: Date.now(), // Now
          interval: '1d',
          events: 'history'
        }) as any[];
        
        // Extract adjusted close prices
        prices[assetName] = quoteData
          .map(q => q.adjClose || 0)
          .filter((price): boolean => price > 0); // Filter out invalid prices
      }

      // Calculate correlation matrix
      const correlationMatrix: Record<string, Record<string, number>> = {};
      
      assetNames.forEach((asset1) => {
        correlationMatrix[asset1] = {};
        assetNames.forEach((asset2) => {
          correlationMatrix[asset1][asset2] = this.calculateCorrelation(
            prices[asset1], 
            prices[asset2]
          );
        });
      });

      return {
        assets: assetNames,
        matrix: correlationMatrix,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating correlation matrix:', error);
      // Return empty matrix on error to prevent frontend crashes
      return {
        assets: ['XAUUSD', 'EURUSD', 'GBPUSD', 'SPX', 'GOLD'],
        matrix: {
          XAUUSD: { XAUUSD: 1, EURUSD: 0, GBPUSD: 0, SPX: 0, GOLD: 0 },
          EURUSD: { XAUUSD: 0, EURUSD: 1, GBPUSD: 0, SPX: 0, GOLD: 0 },
          GBPUSD: { XAUUSD: 0, EURUSD: 0, GBPUSD: 1, SPX: 0, GOLD: 0 },
          SPX: { XAUUSD: 0, EURUSD: 0, GBPUSD: 0, SPX: 1, GOLD: 0 },
          GOLD: { XAUUSD: 0, EURUSD: 0, GBPUSD: 0, SPX: 0, GOLD: 1 }
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private static calculateCorrelation(x: number[], y: number[]): number {
    // Ensure we have enough data points
    if (x.length < 2 || y.length < 2 || x.length !== y.length) {
      return 0;
    }

    const n = x.length;
    
    // Calculate sums
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    
    // Calculate correlation using Pearson formula
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
}