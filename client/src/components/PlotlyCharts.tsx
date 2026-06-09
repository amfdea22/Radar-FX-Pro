import React, { useEffect, useRef } from 'react';

interface Props {
    charts: Record<string, any>;
}

declare global {
    interface Window { Plotly: any; }
}

export const PlotlyCharts: React.FC<Props> = ({ charts }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotlyLoaded = useRef(false);

    useEffect(() => {
        if (typeof window.Plotly !== 'undefined') {
            plotlyLoaded.current = true;
            renderAll();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
        script.onload = () => {
            plotlyLoaded.current = true;
            renderAll();
        };
        document.head.appendChild(script);
        return () => { try { script.remove(); } catch {} };
    }, []);

    useEffect(() => {
        if (plotlyLoaded.current) renderAll();
    }, [charts]);

    const renderAll = () => {
        if (!window.Plotly || !containerRef.current || !charts) return;
        const container = containerRef.current;
        container.innerHTML = '';
        const entries = Object.entries(charts);
        entries.forEach(([key, fig], i) => {
            const div = document.createElement('div');
            div.id = `plotly-${key}`;
            div.style.width = '100%';
            div.style.height = '340px';
            div.style.marginBottom = '16px';
            container.appendChild(div);
            try {
                window.Plotly.react(div, fig.data || [], fig.layout || {}, {
                    responsive: true, displayModeBar: false,
                });
            } catch (e) {
                console.error('Plotly render error:', e);
            }
        });
    };

    const count = Object.keys(charts || {}).length;

    if (count === 0) {
        return (
            <div className="bg-slate-950/30 rounded-2xl border border-white/5 p-8 text-center">
                <p className="text-xs text-slate-600">Nenhum gráfico disponível. Execute os testes primeiro.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-950/30 rounded-3xl border border-violet-500/10 p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg> Gráficos — Plotly
            </h4>
            <div ref={containerRef} className="space-y-4" />
        </div>
    );
};
