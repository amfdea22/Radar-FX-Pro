import React, { useRef, useEffect } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

interface EquityPoint {
    time: string;
    equity: number;
    balance: number;
}

interface Props {
    data: EquityPoint[];
    symbol?: string;
    timeframe?: string;
}

export const EquityChart: React.FC<Props> = ({ data, symbol, timeframe }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

    useEffect(() => {
        if (!containerRef.current || !data?.length) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#020617' },
                textColor: '#64748b',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            },
            grid: {
                vertLines: { color: '#1e293b', style: LineStyle.Dotted },
                horzLines: { color: '#1e293b', style: LineStyle.Dotted },
            },
            crosshair: {
                vertLine: { color: '#6366f1', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#6366f1' },
                horzLine: { color: '#6366f1', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#6366f1' },
            },
            rightPriceScale: {
                borderColor: '#334155',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: '#334155',
                timeVisible: false,
                ticksVisible: true,
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            handleScroll: { vertTouchDrag: true, horzTouchDrag: true },
            handleScale: { axisPressedMouseMove: true, pinch: true },
        });

        const equitySeries = chart.addLineSeries({
            color: '#818cf8',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Equity',
        });

        const balanceSeries = chart.addLineSeries({
            color: '#475569',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Balance',
        });

        const chartData = data.map((d, i) => ({
            time: Math.floor(new Date(d.time).getTime() / 1000) as any,
            value: d.equity,
        }));

        const balanceData = data.map((d, i) => ({
            time: Math.floor(new Date(d.time).getTime() / 1000) as any,
            value: d.balance,
        }));

        equitySeries.setData(chartData);
        balanceSeries.setData(balanceData);
        chart.timeScale().fitContent();

        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);

        chartRef.current = chart;

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [data]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full touch-pan-y"
            style={{ minHeight: '100%' }}
        />
    );
};
