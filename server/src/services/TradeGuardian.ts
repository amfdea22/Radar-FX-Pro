import axios from 'axios';
import { AlertEngine } from './AlertEngine';
import { MarketService } from './MarketService';
import { DisciplineEngine } from './DisciplineEngine';
import { GoldScalperEngine } from './GoldScalperEngine';
import fs from 'fs';
import path from 'path';

interface Position {
    ticket: number;
    symbol: string;
    type: number; // 0 = BUY, 1 = SELL
    volume: number;
    price_open: number;
    sl: number;
    tp: number;
    price_current: number;
    profit: number;
    point: number;
    digits: number;
}

export class TradeGuardian {
    private static MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5555';
    private static isRunning = false;
    private static SETTINGS_PATH = path.resolve(process.cwd(), 'guardian_settings.json');
    private static beProtectedTickets = new Set<number>();
    private static enforcedTickets = new Set<number>();

    // Configurações dinâmicas
    private static settings = {
        trailingStopPoints: 100,
        trailingStepPoints: 30,
        enableGrid: false,
        gridDistancePoints: 300,
        gridMultiplier: 1.5,
        maxGridLevels: 5,
        enableBreakEven: true,
        breakEvenTriggerPoints: 150, // Move para BE ao atingir 150 pontos
        basketTargetProfit: 10.0      // Lucro alvo da "cesta" de ordens em $
    };

    static start() {
        if (this.isRunning) return;
        this.loadSettings();
        this.isRunning = true;
        console.log('🛡️ Alpha Guardian: Scalper Grid & Protection service ACTIVE');

        // Check positions every 2 seconds para Grid de alta frequência
        setInterval(() => this.monitorPositions(), 2000);
    }

    private static loadSettings() {
        if (fs.existsSync(this.SETTINGS_PATH)) {
            try {
                const data = fs.readFileSync(this.SETTINGS_PATH, 'utf-8');
                this.settings = { ...this.settings, ...JSON.parse(data) };
                console.log('🛡️ Guardian: Persisted settings loaded');
            } catch (e) {
                console.error('❌ Guardian: Failed to load settings', e);
            }
        }
    }

    private static saveSettings() {
        try {
            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('❌ Guardian: Failed to save settings', e);
        }
    }

    static updateSettings(newSettings: any) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        console.log('🛡️ Guardian: Settings updated & saved');
    }

    private static async monitorPositions() {
        try {
            const response = await axios.get(`${this.MT5_BRIDGE_URL}/positions`);
            const positions: Position[] = response.data;

            if (positions.length === 0) return;

            // Agrupar por símbolo para gestão de Grid/Basket
            const symbolGroups: Record<string, Position[]> = {};
            for (const pos of positions) {
                if (!symbolGroups[pos.symbol]) symbolGroups[pos.symbol] = [];
                symbolGroups[pos.symbol].push(pos);
            }

            for (const symbol in symbolGroups) {
                const group = symbolGroups[symbol];

                // 1. Verificar Basket TP (Lucro Acumulado da Cesta)
                await this.processBasketTP(symbol, group);

                for (const pos of group) {
                    // 2. Proteção Forçada Inicial
                    if (!this.enforcedTickets.has(pos.ticket) && (pos.sl === 0 || pos.tp === 0)) {
                        await this.enforceProtection(pos);
                    }

                    // 3. Break-Even Inteligente
                    if (this.settings.enableBreakEven) {
                        await this.processBreakEven(pos);
                    }

                    // 4. Trailing Stop
                    await this.processTrailingStop(pos);
                }

                // 5. Motor de Grid (DCA)
                if (this.settings.enableGrid) {
                    await this.processGridDCA(symbol, group);
                }
            }
        } catch (error) {
            // Silencioso para evitar logs excessivos em caso de timeout da bridge
        }
    }

    private static async processBasketTP(symbol: string, positions: Position[]) {
        const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);

        if (totalProfit >= this.settings.basketTargetProfit && positions.length > 1) {
            console.log(`💰 [BASKET TP] Alvo atingido para ${symbol}: $${totalProfit.toFixed(2)}. Fechando todos...`);
            AlertEngine.addAlert('GUARDIAN', 'INFO', `Cesta Lucrativa: ${symbol}`, `Lucro de $${totalProfit.toFixed(2)} atingido no Grid. Fechando...`);

            for (const pos of positions) {
                try {
                    // Envia comando de fechamento para a bridge
                    await axios.post(`${this.MT5_BRIDGE_URL}/close_order`, { ticket: pos.ticket });
                } catch (err) {
                    console.error(`❌ Guardian: Erro ao fechar basket ticket #${pos.ticket}`, err);
                }
            }
        }
    }

    private static async processBreakEven(pos: Position) {
        if (this.beProtectedTickets.has(pos.ticket)) return;

        // Se já está no BE ou além, ignora
        if (pos.sl !== 0) {
            const isBuy = pos.type === 0;
            if (isBuy && pos.sl >= pos.price_open) return;
            if (!isBuy && pos.sl <= pos.price_open) return;
        }

        const pointSize = pos.point || 0.00001;
        const profitPoints = Math.abs(pos.price_current - pos.price_open) / pointSize;

        if (profitPoints >= this.settings.breakEvenTriggerPoints) {
            // Lucro de 15 pips atingido -> Move para BE + 1 pip de segurança
            const offset = 10 * pointSize; // 1 pip
            const newSl = pos.type === 0 ? pos.price_open + offset : pos.price_open - offset;

            this.beProtectedTickets.add(pos.ticket);
            await this.updateOrderSL(pos.ticket, Number(newSl.toFixed(pos.digits)));
            if (this.beProtectedTickets.size > 100) this.beProtectedTickets.clear();
            AlertEngine.addAlert('GUARDIAN', 'INFO', `Break-Even Ativado`, `${pos.symbol}: Trade #${pos.ticket} protegido no zero a zero.`);
        }
    }

    private static async processGridDCA(symbol: string, positions: Position[]) {
        if (positions.length >= this.settings.maxGridLevels) return;

        // Pega a última posição aberta do grupo
        const lastPos = positions.sort((a, b) => b.ticket - a.ticket)[0];
        const drawdownPoints = Math.abs(lastPos.price_current - lastPos.price_open) / (lastPos.point || 0.00001);

        if (drawdownPoints >= this.settings.gridDistancePoints) {
            // VERIFICA DISCIPLINA ANTES DE ABRIR DCA
            const status = await DisciplineEngine.getDailyStatus();
            if (!status.isSafe) {
                console.warn(`🛡️ Guardian DCA: Bloqueado por Disciplina em ${symbol}. Motivo: ${status.reason}`);
                return;
            }

            // Contra a posição x pontos -> Abre novo nível
            const newLot = Number((lastPos.volume * this.settings.gridMultiplier).toFixed(2));
            const action = lastPos.type === 0 ? 'BUY' : 'SELL';

            console.log(`⛓️ [GRID] Abrindo Nível ${positions.length + 1} para ${symbol} | Lote: ${newLot}`);
            const type = positions[0].type === 0 ? 'BUY' : 'SELL';
            const lot = positions[0].volume;
            const level = positions.length + 1; // Define level here

            console.log(`🛡️ Guardian: Opening DCA Order for ${symbol} at level ${level}`);

            // Executar com retry inteligente via MarketService
            const orderResult = await MarketService.retryWhenOpen(symbol, async () => {
                const response = await axios.post(`${this.MT5_BRIDGE_URL}/order`, {
                    symbol: symbol,
                    action: type,
                    lot: newLot,
                    sl: positions[0].sl,
                    tp: positions[0].tp,
                    comment: `Guardian DCA Level ${level}`.substring(0, 31)
                });
                return response.data;
            });

            if (orderResult && (orderResult.status === 'success' || orderResult.order_id)) {
                AlertEngine.addAlert('GUARDIAN', 'INFO', 'DCA Executado', `${symbol}: Ordem de Grid/DCA aberta para equilibrar cesta.`);
            }
        }
    }

    private static async enforceProtection(pos: Position) {
        this.enforcedTickets.add(pos.ticket);
        if (this.enforcedTickets.size > 100) this.enforcedTickets.clear();

        const pointSize = pos.point || 0.00001;
        const isBuy = pos.type === 0;
        let updateNeeded = false;
        let sl = pos.sl;
        let tp = pos.tp;

        const tickValue = (pos as any).tick_value || 1.0;
        const volume = pos.volume || 0.1;

        // --- LÓGICA DE HERANÇA DE RISCO ---
        let slUSD = 0;
        let tpUSD = 0;

        // 1. Verificar se é Ouro para herdar do GoldScalper
        const goldRisk = GoldScalperEngine.getActiveRiskParams();
        const isGold = pos.symbol.toUpperCase().includes('GOLD') || pos.symbol.toUpperCase().includes('XAU');

        if (isGold && goldRisk.enabled) {
            slUSD = goldRisk.slUSD;
            tpUSD = goldRisk.tpUSD;
        } else {
            // 2. Fallback para configurações manuais globais (DisciplineEngine)
            const disciplineStatus: any = await DisciplineEngine.getDailyStatus();
            slUSD = disciplineStatus.limits.manualStopLossUSD || 5.0;
            tpUSD = disciplineStatus.limits.manualTakeProfitUSD || 10.0;
        }

        if (sl === 0) {
            const pointsNeeded = slUSD / (volume * tickValue);
            const dist = pointsNeeded * pointSize;
            sl = isBuy ? pos.price_open - dist : pos.price_open + dist;
            updateNeeded = true;
        }

        if (tp === 0) {
            const pointsNeeded = tpUSD / (volume * tickValue);
            const dist = pointsNeeded * pointSize;
            tp = isBuy ? pos.price_open + dist : pos.price_open - dist;
            updateNeeded = true;
        }

        if (updateNeeded) {
            sl = Number(sl.toFixed(pos.digits));
            tp = Number(tp.toFixed(pos.digits));
            await axios.post(`${this.MT5_BRIDGE_URL}/update_order`, {
                ticket: pos.ticket,
                sl,
                tp,
                comment: `Guardian Protection [${isGold ? 'ROBOT' : 'MANUAL'}]`.substring(0, 31)
            });
            console.log(`🛡️ Guardian: Force Protected #${pos.ticket} (${pos.symbol}) | SL: $${slUSD} TP: $${tpUSD}`);
        }
    }

    private static async processTrailingStop(pos: Position) {
        const isBuy = pos.type === 0;
        const currentPrice = pos.price_current;
        const pointSize = pos.point || 0.00001;

        const trailDist = this.settings.trailingStopPoints * pointSize;
        const stepDist = this.settings.trailingStepPoints * pointSize;

        // Só inicia o Trailing se o lucro for maior que o trailDist
        const profit = isBuy ? currentPrice - pos.price_open : pos.price_open - currentPrice;
        if (profit < trailDist) return;

        let newSl = isBuy ? currentPrice - trailDist : currentPrice + trailDist;
        newSl = Number(newSl.toFixed(pos.digits));

        if (isBuy) {
            if (newSl > pos.sl + stepDist) {
                await this.updateOrderSL(pos.ticket, newSl);
            }
        } else {
            if (pos.sl === 0 || newSl < pos.sl - stepDist) {
                await this.updateOrderSL(pos.ticket, newSl);
            }
        }
    }

    private static async updateOrderSL(ticket: number, sl: number) {
        try {
            await axios.post(`${this.MT5_BRIDGE_URL}/update_order`, { ticket, sl });
        } catch (e) {
            // console.error(`🛡️ Guardian: Failed to update #${ticket}`);
        }
    }

    static getStatus() {
        return {
            active: this.isRunning,
            isSafe: this.isRunning,
            settings: this.settings
        };
    }
}

