import React, { useMemo, useState, useCallback } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';

// ─── UTIL ─────────────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const Dashboard = () => {
    const vigilantes   = useVigilanteStore(s => s.vigilantes || []);
    const puestos      = usePuestoStore(s => s.puestos || []);
    const programaciones = useProgramacionStore(s => s.programaciones || []);
    const entries      = useAuditStore(s => s.entries || []);
    const getCobertura = usePuestoStore(s => s.getCobertura24Horas);
    const getCobPct    = useProgramacionStore(s => s.getCoberturaPorcentaje);
    const [isSyncing, setIsSyncing] = useState(false);

    // Date computed reactively so it refreshes after midnight
    const now = useMemo(() => new Date(), []);
    const CURR_MES = now.getMonth();
    const CURR_ANIO = now.getFullYear();

    const [activeTab, setActiveTab] = useState<'personal'|'puestos'>('personal');
    const [tableSearch, setTableSearch] = useState('');
    const [tablePage, setTablePage] = useState(0);
    const TABLE_PAGE_SIZE = 8;

    // ─── STATS ───────────────────────────────────────────────────────────────
    // ─── STATS OPTIMIZACIÓN CRÍTICA ───────────────────────────────────────────────
    const S = useMemo(() => {
        let vActivos = 0, vDisp = 0, vAusentes = 0, vConDesc = 0, vVacas = 0;
        const activeVigilantes = vigilantes.filter(v => v.estado !== 'inactivo');
        const vTotal = activeVigilantes.length;
        
        activeVigilantes.forEach(v => {
            if (v.estado === 'activo') vActivos++;
            else if (v.estado === 'disponible') vDisp++;
            else if (v.estado === 'ausente') vAusentes++;
            
            if ((v.descargos || []).some(d => d.estado === 'activo')) vConDesc++;
            if (v.vacaciones?.inicio) vVacas++;
        });

        let pCub = 0, pAlerta = 0, pDesp = 0, pArmas = 0, pOper24 = 0;
        const pTotal = puestos.length;

        puestos.forEach(p => {
            if (p.estado === 'cubierto') pCub++;
            else if (p.estado === 'alerta') pAlerta++;
            else if (p.estado === 'desprotegido') pDesp++;
            if (p.conArmamento) pArmas++;
            if (p.estado === 'cubierto' && getCobertura) {
                if (getCobertura(p.id).completa) pOper24++;
            }
        });

        const personalReq = pTotal * 3;
        const personalFalt = Math.max(0, personalReq - vTotal);
        const saludPersonal = personalReq > 0 ? Math.round((vTotal / personalReq) * 100) : 100;

        // O(N) — Filtrar programaciones una sola vez
        const progsEsteMes = programaciones.filter(p => p.anio === CURR_ANIO && p.mes === CURR_MES);
        const progPublicadas = progsEsteMes.filter(p => p.estado === 'publicado').length;
        const progBorrador   = progsEsteMes.filter(p => p.estado === 'borrador').length;
        
        // O(N) — Cálculo de cobertura promedio sin llamar repetitivamente selectores inestables
        let sumCobPct = 0;
        progsEsteMes.forEach(p => {
            sumCobPct += getCobPct(p.id);
        });
        const cobPromedioMes = progsEsteMes.length > 0 ? Math.round(sumCobPct / progsEsteMes.length) : 0;

        const alertasCrit = entries.filter(e => e.severity === 'critical').length;
        const alertasWarn = entries.filter(e => e.severity === 'warning').length;
        
        // Optimización: Comparación de fechas estable
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const eventosHoy = entries.filter(e => {
            const eth = new Date(e.timestamp).getTime();
            return eth >= startOfDay && eth < startOfDay + 86400000;
        }).length;
        
        const indiceCobertura = pTotal > 0 ? Math.round((pCub / pTotal) * 100) : 0;
        const globalHealth = Math.round((saludPersonal + indiceCobertura + cobPromedioMes) / 3);

        return {
            vTotal, vActivos, vDisp, vAusentes, vConDesc, vVacas,
            pTotal, pCub, pAlerta, pDesp, pArmas, pOper24,
            personalReq, personalFalt, saludPersonal,
            progsEsteMes: progsEsteMes.length, progPublicadas, progBorrador, cobPromedioMes,
            alertasCrit, alertasWarn, eventosHoy,
            indiceCobertura, globalHealth,
        };
    }, [vigilantes, puestos, programaciones, entries, getCobertura, getCobPct]);

    // Filtered & Paginated Table Data
    const filteredVigilantes = useMemo(() => {
        const q = tableSearch.toLowerCase();
        return vigilantes.filter(v => 
            v.estado !== 'inactivo' && (
                !q || v.nombre.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || (v.especialidad||'').toLowerCase().includes(q)
            )
        );
    }, [vigilantes, tableSearch]);

    const filteredPuestos = useMemo(() => {
        const q = tableSearch.toLowerCase();
        return puestos.filter(p => !q || p.nombre.toLowerCase().includes(q) || p.estado.toLowerCase().includes(q));
    }, [puestos, tableSearch]);

    const currentRows = activeTab === 'personal' ? filteredVigilantes : filteredPuestos;
    const totalPages = Math.ceil(currentRows.length / TABLE_PAGE_SIZE);
    const pagedRows = currentRows.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

    const handleTabChange = (tab: 'personal'|'puestos') => {
        setActiveTab(tab);
        setTableSearch('');
        setTablePage(0);
    };

    const handleForceSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            showTacticalToast({ title: 'Sincronizando', message: 'Iniciando sincronizacion con base de datos Coraza...', type: 'info', id: 'sync' });
            await Promise.all([
                useProgramacionStore.getState().forceSync?.(),
                usePuestoStore.getState().fetchPuestos(),
                useVigilanteStore.getState().fetchVigilantes()
            ]);
            showTacticalToast({ title: 'Sincronizacion Completa', message: 'Todos los sistemas actualizados exitosamente.', type: 'success', id: 'sync' });
        } catch {
            showTacticalToast({ title: 'Error de Sync', message: 'No se pudo completar la sincronizacion. Verifique su conexion.', type: 'error', id: 'sync' });
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    return (
        <div className="space-y-3 animate-fade-in pb-8">

            {/* ────── HEADER compacto ────── */}
            <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-3">
                    <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <h1 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">
                        Centro de <span className="text-primary">Mando</span>
                        <span className="ml-2 text-[11px] font-semibold text-slate-400 normal-case tracking-normal">{MESES[CURR_MES]} {CURR_ANIO}</span>
                    </h1>
                </div>
                <button
                    id="btn-forzar-sync"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                        isSyncing
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20'
                    }`}
                >
                    <span className={`material-symbols-outlined text-[13px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                    {isSyncing ? 'Sync...' : 'Sincronizar'}
                </button>
            </div>

            {/* ────── KPI STRIP compacto ────── */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
                <KpiCard label="Personal" value={S.vTotal} sub={`Req: ${S.personalReq}`} icon="groups" color="indigo" trend={S.vTotal >= S.personalReq ? 'up' : 'down'} />
                <KpiCard label="Puestos" value={S.pTotal} sub="Registrados" icon="location_on" color="blue" />
                <KpiCard label="Publicados" value={S.progPublicadas} sub={`${MESES[CURR_MES]}`} icon="verified" color="emerald" />
                <KpiCard label="Borradores" value={S.progBorrador} sub="En proceso" icon="edit_note" color="amber" />
                <KpiCard label="Sin Programar" value={S.pTotal - S.progsEsteMes} sub="Pendiente" icon="pending_actions" color="red" urgent={S.pTotal - S.progsEsteMes > 0} />
                <KpiCard label="Cobertura" value={`${S.cobPromedioMes}%`} sub="Mes actual" icon="donut_large" color="violet" trend={S.cobPromedioMes >= 80 ? 'up' : 'down'} />
            </div>

            {/* ────── SALUD + PUESTOS (compacto, sin SVG) ────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {/* Métricas de salud - barras simples */}
                <div className="xl:col-span-2 bg-white border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Salud Operativa</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            S.globalHealth >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            S.globalHealth >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                        }`}>
                            {S.globalHealth >= 75 ? '● Óptimo' : S.globalHealth >= 50 ? '● Estable' : '● Crítico'} {S.globalHealth}%
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        <SimpleBar label="Fuerza Laboral" pct={S.saludPersonal} sub={`${S.vTotal}/${S.personalReq}`} color="#4f46e5" />
                        <SimpleBar label="Cobertura Puestos" pct={S.indiceCobertura} sub={`${S.pCub}/${S.pTotal}`} color="#10b981" />
                        <SimpleBar label="Cuadro Operativo" pct={S.cobPromedioMes} sub={`${S.progPublicadas} publ.`} color="#8b5cf6" />
                    </div>
                </div>

                {/* Estado puestos */}
                <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Estado Puestos</h2>
                        <span className="text-[10px] font-black text-slate-400">{S.pTotal} total</span>
                    </div>
                    <div className="space-y-2.5">
                        <PuestoStatusBar label="Cubiertos" value={S.pCub} total={S.pTotal} color="emerald" icon="check_circle" />
                        <PuestoStatusBar label="En Alerta" value={S.pAlerta} total={S.pTotal} color="amber" icon="warning" />
                        <PuestoStatusBar label="Desprotegidos" value={S.pDesp} total={S.pTotal} color="red" icon="dangerous" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Salud Global</span>
                        <span className={`text-[18px] font-black tabular-nums ${
                            S.globalHealth >= 75 ? 'text-emerald-600' :
                            S.globalHealth >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>{S.globalHealth}%</span>
                    </div>
                </div>
            </div>

            {/* ────── ALERT BANNERS ────── */}
            {S.pDesp > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <span className="material-symbols-outlined text-red-600 text-[16px]">dangerous</span>
                    <p className="text-[11px] font-black text-red-800 uppercase tracking-wide">{S.pDesp} Puesto{S.pDesp > 1 ? 's' : ''} desprotegido{S.pDesp > 1 ? 's' : ''} — Se requiere asignación urgente</p>
                </div>
            )}

            {/* ────── TABLA DETALLE ────── */}
            <div className="horizon-card overflow-hidden">
                {/* Tabs + Search */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-50/60 border-b border-slate-100">
                    <div className="flex gap-0">
                        {(['personal', 'puestos'] as const).map(tab => (
                            <button
                                key={tab}
                                id={`tab-${tab}`}
                                onClick={() => handleTabChange(tab)}
                                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{tab === 'personal' ? 'groups' : 'hub'}</span>
                                {tab === 'personal' ? `Personal (${S.vTotal})` : `Puestos (${S.pTotal})`}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-56">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[16px]">search</span>
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={e => { setTableSearch(e.target.value); setTablePage(0); }}
                            placeholder="Buscar..."
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl pl-9 pr-4 text-[12px] font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {activeTab === 'personal' ? (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Código</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Nombre</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Estado</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Rango</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Especialidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(pagedRows as typeof vigilantes).map(v => (
                                    <tr key={v.id} className="border-b border-slate-50 hover:bg-primary/[0.02] transition-colors group">
                                        <td className="px-6 py-3.5">
                                            <span className="font-black text-[11px] text-primary font-mono bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">{v.id}</span>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <p className="font-black text-[13px] text-slate-900">{v.nombre}</p>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                                v.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                v.estado === 'disponible' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                                <span className={`size-1.5 rounded-full ${
                                                    v.estado === 'activo' ? 'bg-emerald-500' :
                                                    v.estado === 'disponible' ? 'bg-blue-500' : 'bg-red-500'
                                                }`} />
                                                {v.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-[12px] font-bold text-slate-600">{v.rango}</td>
                                        <td className="px-6 py-3.5 text-[11px] font-semibold text-slate-500">{v.especialidad || '—'}</td>
                                    </tr>
                                ))}
                                {pagedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-[12px] font-bold">
                                            No se encontraron resultados para "{tableSearch}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Puesto</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Estado</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Cobertura 24h</th>
                                    <th className="px-6 py-3 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Armamento</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(pagedRows as typeof puestos).map(p => {
                                    const cob = getCobertura(p.id);
                                    return (
                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-primary/[0.02] transition-colors">
                                            <td className="px-6 py-3.5 font-black text-[13px] text-slate-900">{p.nombre}</td>
                                            <td className="px-6 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                                    p.estado === 'cubierto' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                    p.estado === 'alerta' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                    'bg-red-50 text-red-700 border border-red-200'
                                                }`}>
                                                    <span className={`size-1.5 rounded-full ${
                                                        p.estado === 'cubierto' ? 'bg-emerald-500' :
                                                        p.estado === 'alerta' ? 'bg-amber-400' : 'bg-red-500'
                                                    }`} />
                                                    {p.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={`text-[11px] font-black ${cob.completa ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {cob.completa ? '✓ Completa' : '⚠ Con huecos'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                {p.conArmamento ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-600 uppercase">
                                                        <span className="material-symbols-outlined text-[14px]">security</span> Sí
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pagedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-[12px] font-bold">
                                            No se encontraron resultados para "{tableSearch}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                            Mostrando {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, currentRows.length)} de {currentRows.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setTablePage(p => Math.max(0, p - 1))}
                                disabled={tablePage === 0}
                                className="size-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setTablePage(i)}
                                    className={`size-8 flex items-center justify-center rounded-xl text-[11px] font-black transition-all ${
                                        tablePage === i ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={tablePage >= totalPages - 1}
                                className="size-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, icon, color, urgent, trend }: any) => {
    const colorMap: any = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <div className={`bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-2.5 ${urgent ? 'border-red-200 bg-red-50/50' : ''}`}>
            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg} ${c.border} border`}>
                <span className={`material-symbols-outlined text-[16px] ${c.text}`}>{icon}</span>
            </div>
            <div className="min-w-0 flex-1">
                <div className={`text-[19px] font-black leading-none tabular-nums ${urgent ? 'text-red-600' : 'text-slate-900'}`}>
                    {value}
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">{label}</p>
            </div>
            {trend && (
                <span className={`material-symbols-outlined text-[13px] shrink-0 ${trend === 'up' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {trend === 'up' ? 'trending_up' : 'trending_down'}
                </span>
            )}
        </div>
    );
};

const HealthOrb = ({ label, pct, sub, color }: any) => (
    <div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-slate-50 to-white border border-slate-100">
        <div className="relative size-28">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={40} fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                <circle cx="50" cy="50" r={40} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - Math.max(0, Math.min(100, pct)) / 100)}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-black text-slate-900 text-[20px] leading-none tabular-nums">{pct}%</span>
            </div>
        </div>
        <div className="text-center">
            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</p>
        </div>
    </div>
);

const SimpleBar = ({ label, pct, sub, color }: any) => (
    <div className="space-y-1">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">{sub}</span>
                <span className="text-[11px] font-black tabular-nums" style={{ color }}>{pct}%</span>
            </div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
    </div>
);

const PuestoStatusBar = ({ label, value, total, color, icon }: any) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorMap: any = {
        emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600', icon: 'text-emerald-500' },
        amber:   { bar: 'bg-amber-400',   text: 'text-amber-600',   icon: 'text-amber-500' },
        red:     { bar: 'bg-red-500',      text: 'text-red-600',     icon: 'text-red-500' },
    };
    const c = colorMap[color];
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <span className={`flex items-center gap-1.5 text-[11px] font-black text-slate-600 uppercase tracking-wider`}>
                    <span className={`material-symbols-outlined text-[14px] ${c.icon}`}>{icon}</span>
                    {label}
                </span>
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-black ${c.text}`}>{value}</span>
                    <span className="text-[9px] text-slate-400 font-bold">({pct}%)</span>
                </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${c.bar} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${pct}%`, boxShadow: `0 0 8px ${pct > 0 ? 'currentColor' : 'transparent'}` }}
                />
            </div>
        </div>
    );
};

export default Dashboard;
