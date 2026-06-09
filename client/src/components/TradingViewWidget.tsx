import React, { useEffect, useRef } from 'react';

interface Props {
    symbol: string;
    interval?: '1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W' | 'M';
    height?: number;
}

export const TradingViewWidget: React.FC<Props> = ({ symbol, interval = '60', height = 500 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const containerId = `tv-chart-${symbol}-${interval}`.replace(/[^a-zA-Z0-9\-]/g, '_');
        containerRef.current.id = containerId;

        const loadWidget = () => {
            if (!(window as any).TradingView || widgetRef.current) return;
            widgetRef.current = new (window as any).TradingView.widget({
                container_id: containerId,
                symbol: symbol,
                interval: interval,
                timezone: 'America/Sao_Paulo',
                theme: 'dark',
                style: '1',
                locale: 'br',
                toolbar_bg: '#0f172a',
                enable_publishing: false,
                allow_symbol_change: true,
                hide_top_toolbar: false,
                save_image: false,
                studies: [
                    'RSI@tv-basicstudies',
                    'MASimple@tv-basicstudies',
                    'MACD@tv-basicstudies',
                ],
                show_popup_button: true,
                popup_width: '1000',
                popup_height: '650',
                autosize: true,
            });
        };

        if ((window as any).TradingView) {
            loadWidget();
        } else {
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = loadWidget;
            document.head.appendChild(script);
        }

        return () => {
            if (widgetRef.current) {
                try {
                    widgetRef.current.remove();
                } catch { /* ignore */ }
                widgetRef.current = null;
            }
        };
    }, [symbol, interval]);

    return (
        <div
            ref={containerRef}
            className="w-full rounded-2xl overflow-hidden"
            style={{ height }}
        />
    );
};
