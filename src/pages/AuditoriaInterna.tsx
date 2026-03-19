import { useState, useMemo } from 'react';
import { useAuditStore, type AuditModule, type AuditSeverity } from '../store/auditStore';
import toast from 'react-hot-toast';
import { showTacticalToast } from '../utils/tacticalToast';
import { MilitaryTimeInput } from '../components/ui/MilitaryTimeInput';

const MODULE_LABELS: Record<AuditModule, string> = {
    LOGIN: 'Autenticacion',
    VIGILANTES: 'Vigilantes',
    PUESTOS: 'Puestos',
    PROGRAMACION: 'CUADRO OPERATIVO',
    NOVEDADES: 'Novedades',
    RESUMEN: 'Resumen/PDF',
    CONFIGURACION: 'Configuracion',
    INTELIGENCIA: 'Inteligencia IA',
    SISTEMA: 'Sistema',
};

const SEVERITY_CONFIG: Record<AuditSeverity, { label: string; cls: string; dotCls: string }> = {
    info:     { label: 'Info',    cls: 'bg-primary/10 text-primary border-primary/20',       dotCls: 'bg-primary' },
    success:  { label: 'Exito',   cls: 'bg-success/10 text-success border-success/20',       dotCls: 'bg-success' },
    warning:  { label: 'Aviso',   cls: 'bg-warning/10 text-warning border-warning/20',       dotCls: 'bg-warning' },
    critical: { label: 'Critico', cls: 'bg-danger/10 text-danger border-danger/20',          dotCls: 'bg-danger animate-pulse' },
};

const AuditoriaInterna = () => {
    const { entries, clearAll } = useAuditStore();

    const [search, setSearch] = useState('');
    const [filterModule, setFilterModule] = useState<AuditModule | 'todos'>('todos');
    const [filterSeverity, setFilterSeverity] = useState<AuditSeverity | 'todos'>('todos');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo]   = useState('');
    const [filterHourFrom, setFilterHourFrom] = useState('');
    const [filterHourTo, setFilterHourTo]   = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 30;

    const filtered = useMemo(() => {
        return entries.filter(e => {
            const dt = new Date(e.timestamp);
            const dateStr = dt.toISOString().split('T')[0]; // yyyy-mm-dd
            const timeStr = dt.toTimeString().slice(0, 5);  // HH:MM

            if (filterModule !== 'todos' && e.module !== filterModule) return false;
            if (filterSeverity !== 'todos' && e.severity !== filterSeverity) return false;
            if (filterDateFrom && dateStr < filterDateFrom) return false;
            if (filterDateTo   && dateStr > filterDateTo)   return false;
            if (filterHourFrom && timeStr < filterHourFrom) return false;
            if (filterHourTo   && timeStr > filterHourTo)   return false;
            if (search) {
                const q = search.toLowerCase();
                if (!e.action.toLowerCase().includes(q) &&
                    !e.details.toLowerCase().includes(q) &&
                    !e.user.toLowerCase().includes(q) &&
                    !e.module.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [entries, search, filterModule, filterSeverity, filterDateFrom, filterDateTo, filterHourFrom, filterHourTo]);

    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const stats = useMemo(() => ({
        total: entries.length,
        critical: entries.filter(e => e.severity === 'critical').length,
        warning:  entries.filter(e => e.severity === 'warning').length,
        today:    entries.filter(e => e.timestamp.startsWith(new Date().toISOString().split('T')[0])).length,
    }), [entries]);

    const handleClear = () => {
        if (confirm('¿Esta seguro? Se eliminaran todos los registros de auditoria. Esta accion es irreversible.')) {
            clearAll();
            showTacticalToast({
                title: 'Audit Purge',
                message: 'Todos los registros de auditoria han sido eliminados del sistema.',
                type: 'success'
            });
        }
    };

    const handleExport = () => {
        const headers = ['Timestamp','Modulo','Accion','Detalles','Usuario','Severidad'];
        const rows = filtered.map(e => [
            new Date(e.timestamp).toLocaleString('es-CO'),
            MODULE_LABELS[e.module],
            e.action,
            e.details,
            e.user,
            e.severity.toUpperCase(),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `CORAZA_Auditoria_${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
        showTacticalToast({
            title: 'Exportacion Exitosa',
            message: 'El reporte de auditoria CSV ha sido generado y descargado.',
            type: 'success'
        });
    };

    const resetFilters = () => {
        setSearch(''); setFilterModule('todos'); setFilterSeverity('todos');
        setFilterDateFrom(''); setFilterDateTo(''); setFilterHourFrom(''); setFilterHourTo('');
        setPage(1);
    };

    return (
        <div className="page-container space-y-8 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Sistema</span>
                        <span className="material-symbols-outlined text-[14px] notranslate" translate="no">chevron_right</span>
                        <span className="text-primary font-black">Auditoria Interna</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        Auditoria <span className="text-primary">Interna</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Registro completo de todos los movimientos y cambios realizados en el sistema</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 px-5 py-3 bg-success/10 border border-success/20 text-success rounded-xl hover:bg-success/20 transition-all text-[10px] font-black uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[18px] notranslate">download</span>
                        Exportar CSV
                    </button>
                    <button onClick={handleClear} className="flex items-center gap-2 px-5 py-3 bg-danger/10 border border-danger/20 text-danger rounded-xl hover:bg-danger/20 transition-all text-[10px] font-black uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[18px] notranslate">delete_sweep</span>
                        Purgar Todo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Registros', value: stats.total, icon: 'receipt_long', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Eventos Hoy', value: stats.today, icon: 'today', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Avisos', value: stats.warning, icon: 'warning', color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'Criticos', value: stats.critical, icon: 'report', color: 'text-danger', bg: 'bg-danger/10' },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                        <div className={`${s.bg} size-10 rounded-2xl flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${s.color} notranslate`}>{s.icon}</span>
                        </div>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary notranslate">filter_list</span>
                        Filtros de Busqueda
                    </h3>
                    <button onClick={resetFilters} className="text-[9px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-colors">
                        Limpiar todo
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative lg:col-span-2">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] notranslate">search</span>
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Buscar accion, detalle, usuario..."
                            className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>

                    {/* Module filter */}
                    <select
                        value={filterModule}
                        onChange={e => { setFilterModule(e.target.value as AuditModule | 'todos'); setPage(1); }}
                        className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30"
                    >
                        <option value="todos">Todos los modulos</option>
                        {(Object.entries(MODULE_LABELS) as [AuditModule, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>

                    {/* Severity filter */}
                    <select
                        value={filterSeverity}
                        onChange={e => { setFilterSeverity(e.target.value as AuditSeverity | 'todos'); setPage(1); }}
                        className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30"
                    >
                        <option value="todos">Toda severidad</option>
                        <option value="info">Info</option>
                        <option value="success">Exito</option>
                        <option value="warning">Aviso</option>
                        <option value="critical">Critico</option>
                    </select>

                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Desde:</label>
                        <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
                            className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-primary/30" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Hasta:</label>
                        <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
                            className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-primary/30" />
                    </div>

                    {/* Hour range */}
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Hora desde:</label>
                        <MilitaryTimeInput value={filterHourFrom} onChange={val => { setFilterHourFrom(val); setPage(1); }}
                            className="flex-1 !h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-primary/30" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">Hora hasta:</label>
                        <MilitaryTimeInput value={filterHourTo} onChange={val => { setFilterHourTo(val); setPage(1); }}
                            className="flex-1 !h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-primary/30" />
                    </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold">
                    Mostrando <strong className="text-slate-600">{filtered.length}</strong> de <strong className="text-slate-600">{entries.length}</strong> registros
                    {filtered.length !== entries.length && (
                        <button onClick={resetFilters} className="ml-2 text-primary hover:underline">Limpiar filtros</button>
                    )}
                </p>
            </div>

            {/* Log Table */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                {entries.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined text-6xl notranslate">policy</span>
                        <div>
                            <p className="text-[12px] font-black uppercase tracking-widest text-slate-400">Sin registros de auditoria</p>
                            <p className="text-[10px] text-slate-300 mt-1">Los movimientos del sistema comenzaran a registrarse automaticamente.</p>
                        </div>
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="text-center py-16 text-slate-300">
                        <span className="material-symbols-outlined text-5xl notranslate">search_off</span>
                        <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">Sin resultados para los filtros aplicados</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-6 py-4">Fecha / Hora</th>
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Modulo</th>
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Accion</th>
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Detalles</th>
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Usuario</th>
                                    <th className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Nivel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((e, i) => {
                                    const sev = SEVERITY_CONFIG[e.severity];
                                    const dt = new Date(e.timestamp);
                                    return (
                                        <tr key={e.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <p className="text-[12px] font-bold text-slate-900">{dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</p>
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg whitespace-nowrap">
                                                    {MODULE_LABELS[e.module]}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <p className="text-[12px] font-bold text-slate-900 whitespace-nowrap">{e.action}</p>
                                            </td>
                                            <td className="px-3 py-3.5 max-w-[300px]">
                                                <p className="text-[11px] text-slate-500 truncate" title={e.details}>{e.details}</p>
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <p className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{e.user}</p>
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${sev.cls}`}>
                                                    <span className={`size-1.5 rounded-full ${sev.dotCls}`} />
                                                    {sev.label}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400">
                            PAGINA {page} de {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 disabled:opacity-30 transition-all">
                                <span className="material-symbols-outlined text-[18px] notranslate">chevron_left</span>
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`size-8 rounded-xl text-[11px] font-black transition-all ${p === page ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-400 hover:border-primary/30 hover:text-primary'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 disabled:opacity-30 transition-all">
                                <span className="material-symbols-outlined text-[18px] notranslate">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditoriaInterna;
