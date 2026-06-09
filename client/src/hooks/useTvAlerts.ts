import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface TvAlert {
    id: string;
    timestamp: number;
    symbol: string;
    direction: string;
    price: number;
    strategy: string;
}

let sharedAlerts: TvAlert[] = [];
let sharedListeners: Set<() => void> = new Set();
let sharedInterval: ReturnType<typeof setInterval> | null = null;
let sharedLoading = true;

function notifyListeners() {
    sharedListeners.forEach(fn => fn());
}

async function fetchAlerts() {
    try {
        const r = await axios.get('/api/tradingview/alerts?limit=50');
        sharedAlerts = r.data || [];
    } catch {
        sharedAlerts = [];
    }
    sharedLoading = false;
    notifyListeners();
}

function startSharedPolling() {
    if (sharedInterval) return;
    fetchAlerts();
    sharedInterval = setInterval(fetchAlerts, 5000);
}

function stopSharedPolling() {
    if (sharedListeners.size > 0) return;
    if (sharedInterval) {
        clearInterval(sharedInterval);
        sharedInterval = null;
    }
}

export function useTvAlerts() {
    const [, setTick] = useState(0);

    useEffect(() => {
        const listener = () => setTick(t => t + 1);
        sharedListeners.add(listener);
        startSharedPolling();
        return () => {
            sharedListeners.delete(listener);
            stopSharedPolling();
        };
    }, []);

    const clearAlerts = useCallback(async () => {
        await axios.delete('/api/tradingview/alerts');
        sharedAlerts = [];
        notifyListeners();
    }, []);

    return {
        alerts: sharedAlerts,
        loading: sharedLoading,
        clearAlerts,
        buys: sharedAlerts.filter(a => a.direction === 'buy' || a.direction === 'long'),
        sells: sharedAlerts.filter(a => a.direction === 'sell' || a.direction === 'short'),
        lastAlert: sharedAlerts[0] || null,
    };
}
