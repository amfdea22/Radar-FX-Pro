import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Globe, Activity, AlertTriangle, Info, RefreshCw, Filter, ChevronDown, Newspaper, TrendingUp } from 'lucide-react';
import axios from 'axios';

interface CalendarEvent {
    title: string; country: string; date: string; impact: string; forecast: string; previous: string;
}

const countryConfig: Record<string, { bg: string; text: string; flag: string }> = {
    USD: { bg: 'bg-trader-green/20', text: 'text-trader-green', flag: '🇺🇸' },
    EUR: { bg: 'bg-trader-blue/20', text: 'text-trader-blue', flag: '🇪🇺' },
    GBP: { bg: 'bg-purple-500/20', text: 'text-purple-400', flag: '🇬🇧' },
    JPY: { bg: 'bg-trader-red/20', text: 'text-trader-red', flag: '🇯🇵' },
    AUD: { bg: 'bg-orange-500/20', text: 'text-orange-400', flag: '🇦🇺' },
    NZD: { bg: 'bg-teal-500/20', text: 'text-teal-400', flag: '🇳🇿' },
    CAD: { bg: 'bg-amber-500/20', text: 'text-amber-400', flag: '🇨🇦' },
    CHF: { bg: 'bg-pink-500/20', text: 'text-pink-400', flag: '🇨🇭' },
    CNY: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', flag: '🇨🇳' },
};

const impactConfig = {
    High: { icon: AlertTriangle, color: 'text-trader-red', bg: 'bg-trader-red/20', border: 'border-trader-red/30', label: 'Alto' },
    Medium: { icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: 'Médio' },
    Low: { icon: Info, color: 'text-trader-blue', bg: 'bg-trader-blue/20', border: 'border-trader-blue/30', label: 'Baixo' },
    Holiday: { icon: Calendar, color: 'text-slate-500', bg: 'bg-slate-500/20', border: 'border-slate-500/30', label: 'Feriado' },
};

const getCountry = (c: string) => countryConfig[c] || { bg: 'bg-slate-500/20', text: 'text-slate-400', flag: '' };
const getImpact = (i: string) => impactConfig[i as keyof typeof impactConfig] || impactConfig.Low;

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
}
function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function isToday(dateStr: string) { return new Date(dateStr).toDateString() === new Date().toDateString(); }
function isTomorrow(dateStr: string) { const t = new Date(); t.setDate(t.getDate() + 1); return new Date(dateStr).toDateString() === t.toDateString(); }
function formatDateGroup(dateStr: string) {
    if (isToday(dateStr)) return 'HOJE';
    if (isTomorrow(dateStr)) return 'AMANHÃ';
    return formatDate(dateStr).toUpperCase();
}

interface FilterProps { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; }
const FilterGroup: React.FC<FilterProps> = ({ label, options, value, onChange }) => (
    <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        <div className="flex gap-1.5 flex-wrap">
            {options.map(opt => (
                <button key={opt.value} onClick={() => onChange(opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${value === opt.value ? 'bg-trader-blue/20 text-trader-blue border-trader-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-950/40 text-slate-500 border-white/5 hover:text-slate-300 hover:border-slate-700'}`}>
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

export const EconomicCalendarPanel: React.FC = () => {
    const [tab, setTab] = React.useState<'calendario' | 'noticias'>('calendario');
    const [events, setEvents] = React.useState<CalendarEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filterImpact, setFilterImpact] = React.useState('all');
    const [filterCountry, setFilterCountry] = React.useState('all');
    const [showFilters, setShowFilters] = React.useState(false);
    const [newsFilter, setNewsFilter] = React.useState('all');

    const fetchCalendar = React.useCallback(async () => {
        try { const { data } = await axios.get('/api/mt5/economic-calendar'); setEvents(Array.isArray(data) ? data : []); } catch { setEvents([]); }
    }, []);

    React.useEffect(() => {
        setLoading(true);
        fetchCalendar().finally(() => setLoading(false));
        const iv = setInterval(fetchCalendar, 30000);
        return () => clearInterval(iv);
    }, [fetchCalendar]);

    const countries = React.useMemo(() => Array.from(new Set(events.map(e => e.country).filter(Boolean))).sort(), [events]);

    const filtered = React.useMemo(() => {
        let list = events;
        if (filterImpact !== 'all') list = list.filter(e => e.impact === filterImpact);
        if (filterCountry !== 'all') list = list.filter(e => e.country === filterCountry);
        const grouped: Record<string, CalendarEvent[]> = {};
        list.forEach(e => { const key = new Date(e.date).toDateString(); if (!grouped[key]) grouped[key] = []; grouped[key].push(e); });
        return Object.entries(grouped).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([date, evts]) => ({ dateLabel: formatDateGroup(evts[0].date), date, events: evts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) }));
    }, [events, filterImpact, filterCountry]);

    const filteredNews = React.useMemo(() => {
        let list = events;
        if (newsFilter !== 'all') list = list.filter(e => e.impact === newsFilter.replace('_IMPACT', ''));
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [events, newsFilter]);

    const stats = React.useMemo(() => {
        const high = events.filter(e => e.impact === 'High').length;
        const medium = events.filter(e => e.impact === 'Medium').length;
        const low = events.filter(e => e.impact === 'Low').length;
        return { total: events.length, high, medium, low };
    }, [events]);

    if (loading && events.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={28} className="text-trader-blue animate-spin" style={{ filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.5))' }} />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Carregando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-trader-blue/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-trader-blue/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-trader-blue/20 rounded-3xl border border-trader-blue/30 shadow-xl shadow-trader-blue/10">
                        <Calendar size={40} className="text-trader-blue" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-trader-blue to-cyan-300">Calendário</span> Econômico
                            <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-lg text-xs tracking-widest uppercase">{stats.high} Alto</span>
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                            <Globe size={12} className="text-trader-blue" /> Eventos Macroeconômicos & Notícias — Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 items-center">
                    <button onClick={fetchCalendar} className="p-3 bg-trader-blue/20 border border-trader-blue/30 text-trader-blue rounded-2xl hover:bg-trader-blue/30 transition-all group" title="Recarregar">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-trader-green/10 border-trader-green/20">
                        <div className="w-2 h-2 rounded-full bg-trader-green animate-pulse" />
                        <span className="text-[10px] font-black text-trader-green uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-1 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-1.5 w-fit shadow-2xl">
                {[
                    { id: 'calendario' as const, icon: Calendar, label: 'Calendário' },
                    { id: 'noticias' as const, icon: Newspaper, label: `Notícias (${events.length})` },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tab === t.id ? 'bg-trader-blue/20 text-trader-blue border border-trader-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}>
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'calendario' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-trader-blue/20 text-trader-blue rounded-xl"><Globe size={20} /></div>
                            <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Eventos</p><p className="text-xl font-black text-white italic">{stats.total}</p></div>
                        </div>
                        {[
                            { label: 'Impacto Alto', value: stats.high, color: 'text-trader-red', icon: AlertTriangle, bg: 'bg-trader-red/20' },
                            { label: 'Impacto Médio', value: stats.medium, color: 'text-amber-400', icon: Activity, bg: 'bg-amber-500/20' },
                            { label: 'Impacto Baixo', value: stats.low, color: 'text-trader-blue', icon: Info, bg: 'bg-trader-blue/20' },
                        ].map((m, i) => (
                            <div key={i} className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                                <div className={`p-3 ${m.bg} ${m.color} rounded-xl`}><m.icon size={20} /></div>
                                <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p><p className={`text-xl font-black italic ${m.color}`}>{m.value}</p></div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                        <button onClick={() => setShowFilters(!showFilters)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                <Filter className="text-trader-blue" size={18} /> Filtros
                                {(filterImpact !== 'all' || filterCountry !== 'all') && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-trader-blue/20 text-trader-blue border border-trader-blue/30">Ativo</span>}
                            </h3>
                            <ChevronDown size={18} className={`text-slate-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <div className="px-8 pb-6 space-y-5">
                                        <FilterGroup label="Impacto" value={filterImpact} onChange={setFilterImpact}
                                            options={[{ value: 'all', label: 'Todos' }, ...Object.entries(impactConfig).map(([k, v]) => ({ value: k, label: v.label }))]} />
                                        <FilterGroup label="País" value={filterCountry} onChange={setFilterCountry}
                                            options={[{ value: 'all', label: 'Todos' }, ...countries.map(c => ({ value: c, label: `${getCountry(c).flag} ${c}` }))]} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="space-y-4">
                        {filtered.length === 0 && (
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-12 text-center">
                                <Calendar size={40} className="text-slate-700 mx-auto mb-3" />
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum evento encontrado</p>
                            </div>
                        )}
                        {filtered.map(group => (
                            <motion.div key={group.date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                                <div className="px-8 py-4 bg-slate-950/40 border-b border-white/5 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-trader-blue animate-pulse" />
                                    <span className="text-sm font-black text-white italic tracking-tight">{group.dateLabel}</span>
                                    <span className="text-[10px] font-bold text-slate-500">{new Date(group.date).toLocaleDateString('pt-BR')}</span>
                                    <span className="ml-auto text-[9px] font-black text-slate-600 uppercase tracking-widest">{group.events.length} evento{group.events.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                                <th className="py-4 pl-8 pr-4">Horário</th>
                                                <th className="py-4 px-4">País</th>
                                                <th className="py-4 px-4">Evento</th>
                                                <th className="py-4 px-4 text-center">Impacto</th>
                                                <th className="py-4 px-4 text-right">Previsto</th>
                                                <th className="py-4 pr-8 pl-4 text-right">Anterior</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.events.map((evt, i) => {
                                                const imp = getImpact(evt.impact); const cc = getCountry(evt.country); const ImpIcon = imp.icon;
                                                return (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <td className="py-4 pl-8 pr-4 text-slate-300 font-mono text-xs font-black">{formatTime(evt.date)}</td>
                                                        <td className="py-4 px-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${cc.bg} ${cc.text} border border-current/20`}>{cc.flag} {evt.country}</span>
                                                        </td>
                                                        <td className="py-4 px-4 text-slate-200 font-bold text-sm max-w-[320px] truncate" title={evt.title}>{evt.title}</td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${imp.bg} ${imp.color} border ${imp.border}`}>
                                                                <ImpIcon size={12} /> {imp.label}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-right text-slate-300 font-mono text-xs font-bold">{evt.forecast || '-'}</td>
                                                        <td className="py-4 pr-8 pl-4 text-right text-slate-500 font-mono text-xs font-bold">{evt.previous || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {tab === 'noticias' && (
                <>
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Filter size={14} className="text-trader-blue" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Filtrar por Tipo</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {['all', 'HIGH_IMPACT', 'MEDIUM_IMPACT', 'LOW_IMPACT'].map(f => (
                                <button key={f} onClick={() => setNewsFilter(f)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${newsFilter === f ? 'bg-trader-blue/20 text-trader-blue border-trader-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-950/40 text-slate-500 border-white/5 hover:text-slate-300 hover:border-slate-700'}`}>
                                    {f === 'all' ? 'Todas' : f === 'HIGH_IMPACT' ? 'Alto Impacto' : f === 'MEDIUM_IMPACT' ? 'Médio Impacto' : 'Baixo Impacto'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredNews.length === 0 && (
                            <div className="col-span-full bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-12 text-center">
                                <Newspaper size={40} className="text-slate-700 mx-auto mb-3" />
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhuma notícia disponível</p>
                            </div>
                        )}
                        {filteredNews.map((evt, i) => {
                            const imp = getImpact(evt.impact);
                            const cc = getCountry(evt.country);
                            const ImpIcon = imp.icon;
                            return (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                                    className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 shadow-2xl relative overflow-hidden group hover:border-trader-blue/20 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-trader-blue/40 to-transparent" />
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border text-lg" style={{ backgroundColor: `${cc.bg}`, borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="text-lg">{cc.flag}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-black text-white italic leading-tight mb-2">{evt.title}</h3>
                                            <p className="text-[10px] text-slate-400 font-medium mb-3">
                                                {evt.forecast ? `Previsto: ${evt.forecast}` : ''}{evt.forecast && evt.previous ? ' | ' : ''}{evt.previous ? `Anterior: ${evt.previous}` : `Evento de ${imp.label.toLowerCase()} impacto para ${evt.country}`}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider ${cc.bg} ${cc.text} border border-current/20`}>
                                                    {cc.flag} {evt.country}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${imp.bg} ${imp.color} border ${imp.border}`}>
                                                    <ImpIcon size={10} /> {imp.label}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-600 flex items-center gap-1">
                                                    <Calendar size={8} /> Econômico
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                                        <span className="text-[8px] font-bold text-slate-600 flex items-center gap-1">
                                            <Activity size={8} />
                                            {new Date(evt.date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className={`text-[9px] font-black italic flex items-center gap-1 ${imp.color}`}>
                                            {evt.impact === 'High' && <TrendingUp size={12} />}
                                            {evt.impact === 'Medium' && <Activity size={12} />}
                                            {evt.impact === 'Low' && <Info size={12} />}
                                            {imp.label}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
