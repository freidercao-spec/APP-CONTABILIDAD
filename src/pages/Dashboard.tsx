import React, { useMemo, useState, useCallback } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const Dashboard = () => {
    const vigilantes     = useVigilanteStore(s => s.vigilantes || []);
    const puestos        = usePuestoStore(s => s.puestos || []);
    const programaciones = useProgramacionStore(s => s.programaciones || []);
    const entries        = useAuditStore(s => s.entries || []);
    const getCobertura   = usePuestoStore(s => s.getCobertura24Horas);
    const getCobPct      = useProgramacionStore(s => s.getCoberturaPorcentaje);
    const [isSyncing, setIsSyncing] = useState(false);

    const CURR_MES = 7;
    const CURR_ANIO = 2026;

    const [activeTab, setActiveTab] = useState<'personal'|'puestos'>('personal');
    const [tableSearch, setTableSearch] = useState('');
    const [tablePage, setTablePage] = useState(0);
    const TABLE_PAGE_SIZE = 8;

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

        const progsEsteMes = programaciones.filter(p => p.anio === CURR_ANIO && p.mes === CURR_MES);
        const progPublicadas = progsEsteMes.filter(p => p.estado === 'publicado').length;
        const progBorrador   = progsEsteMes.filter(p => p.estado === 'borrador').length;
        
        let sumCobPct = 0;
        progsEsteMes.forEach(p => {
            sumCobPct += getCobPct(p.id);
        });
        const cobPromedioMes = progsEsteMes.length > 0 ? Math.round(sumCobPct / progsEsteMes.length) : 0;

        const alertasCrit = entries.filter(e => e.severity === 'critical').length;
        const alertasWarn = entries.filter(e => e.severity === 'warning').length;
        
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
            showTacticalToast({ title: 'Sincronizando', message: 'Iniciando sincronización con base de datos Coraza...', type: 'info', id: 'sync' });
            await Promise.all([
                useProgramacionStore.getState().forceSync?.(),
                usePuestoStore.getState().fetchPuestos(),
                useVigilanteStore.getState().fetchVigilantes()
            ]);
            showTacticalToast({ title: 'Sincronización Completa', message: 'Todos los sistemas actualizados exitosamente.', type: 'success', id: 'sync' });
        } catch {
            showTacticalToast({ title: 'Error de Sync', message: 'No se pudo completar la sincronización. Verifique su conexión.', type: 'error', id: 'sync' });
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    return (
        <div className="space-y-4 animate-fade-in pb-8 p-6 bg-slate-950 min-h-screen text-slate-100">

            {/* HEADER */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="size-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                    <h1 className="text-[16px] font-black text-white uppercase tracking-tight">
                        Centro de <span className="text-indigo-400">Mando Operativo</span>
                        <span className="ml-3 text-[11px] font-bold text-slate-400 normal-case tracking-wide bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                            {MESES[CURR_MES]} {CURR_ANIO}
                        </span>
                    </h1>
                </div>
                <button
                    id="btn-forzar-sync"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-2 px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        isSyncing
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-lg shadow-indigo-600/25 active:scale-95'
                    }`}
                >
                    <span className={`material-symbols-outlined text-[15px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                    {isSyncing ? 'Sync...' : 'Sincronizar Datos'}
                </button>
            </div>

            {/* KPI STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard label="Personal" value={S.vTotal} sub={`Req: ${S.personalReq}`} icon="groups" color="indigo" trend={S.vTotal >= S.personalReq ? 'up' : 'down'} />
                <KpiCard label="Puestos" value={S.pTotal} sub="Registrados" icon="location_on" color="blue" />
                <KpiCard label="Publicados" value={S.progPublicadas} sub={`${MESES[CURR_MES]}`} icon="verified" color="emerald" />
                <KpiCard label="Borradores" value={S.progBorrador} sub="En proceso" icon="edit_note" color="amber" />
                <KpiCard label="Sin Programar" value={S.pTotal - S.progsEsteMes} sub="Pendiente" icon="pending_actions" color="red" urgent={S.pTotal - S.progsEsteMes > 0} />
                <KpiCard label="Cobertura" value={`${S.cobPromedioMes}%`} sub="Mes actual" icon="donut_large" color="violet" trend={S.cobPromedioMes >= 80 ? 'up' : 'down'} />
            </div>

            {/* SALUD Y PUESTOS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-400 text-[16px]">monitor_heart</span>
                            Salud Operativa Global
                        </h2>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                            S.globalHealth >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            S.globalHealth >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                            {S.globalHealth >= 75 ? '● Óptimo' : S.globalHealth >= 50 ? '● Estable' : '● Crítico'} {S.globalHealth}%
                        </span>
                    </div>
                    <div className="space-y-3.5">
                        <SimpleBar label="Fuerza Laboral" pct={S.saludPersonal} sub={`${S.vTotal}/${S.personalReq}`} color="#6366f1" />
                        <SimpleBar label="Cobertura Puestos" pct={S.indiceCobertura} sub={`${S.pCub}/${S.pTotal}`} color="#10b981" />
                        <SimpleBar label="Cuadro Operativo" pct={S.cobPromedioMes} sub={`${S.progPublicadas} publ.`} color="#8b5cf6" />
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                            <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-400 text-[16px]">shield</span>
                                Estado Puestos
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{S.pTotal} Total</span>
                        </div>
                        <div className="space-y-3">
                            <PuestoStatusBar label="Cubiertos" value={S.pCub} total={S.pTotal} color="emerald" icon="check_circle" />
                            <PuestoStatusBar label="En Alerta" value={S.pAlerta} total={S.pTotal} color="amber" icon="warning" />
                            <PuestoStatusBar label="Desprotegidos" value={S.pDesp} total={S.pTotal} color="red" icon="dangerous" />
                        </div>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Índice Global</span>
                        <span className={`text-[20px] font-black tabular-nums ${
                            S.globalHealth >= 75 ? 'text-emerald-400' :
                            S.globalHealth >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>{S.globalHealth}%</span>
                    </div>
                </div>
            </div>

            {/* ALERT BANNERS */}
            {S.pDesp > 0 && (
                <div className="flex items-center gap-3 px-5 py-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-md">
                    <span className="material-symbols-outlined text-rose-400 text-[18px] animate-pulse">dangerous</span>
                    <p className="text-[11px] font-black text-rose-300 uppercase tracking-wide">
                        {S.pDesp} Puesto{S.pDesp > 1 ? 's' : ''} desprotegido{S.pDesp > 1 ? 's' : ''} — Se requiere asignación urgente de personal.
                    </p>
                </div>
            )}

            {/* TABLA DETALLE */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
                    <div className="flex gap-1.5">
                        {(['personal', 'puestos'] as const).map(tab => (
                            <button
                                key={tab}
                                id={`tab-${tab}`}
                                onClick={() => handleTabChange(tab)}
                                className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{tab === 'personal' ? 'groups' : 'hub'}</span>
                                {tab === 'personal' ? `Personal (${S.vTotal})` : `Puestos (${S.pTotal})`}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[16px]">search</span>
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={e => { setTableSearch(e.target.value); setTablePage(0); }}
                            placeholder="Buscar en tabla..."
                            className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 text-[12px] font-semibold text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'personal' ? (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left bg-slate-950/40 border-b border-slate-800">
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Código</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Nombre Efectivo</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Estado</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Rango</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Especialidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {(pagedRows as typeof vigilantes).map(v => (
                                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <span className="font-black text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">{v.id}</span>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <p className="font-black text-[13px] text-white">{v.nombre}</p>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                                v.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                v.estado === 'disponible' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            }`}>
                                                <span className={`size-1.5 rounded-full ${
                                                    v.estado === 'activo' ? 'bg-emerald-500' :
                                                    v.estado === 'disponible' ? 'bg-blue-500' : 'bg-rose-500'
                                                }`} />
                                                {v.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-[12px] font-bold text-slate-300">{v.rango}</td>
                                        <td className="px-6 py-3.5 text-[11px] font-semibold text-slate-400">{v.especialidad || '—'}</td>
                                    </tr>
                                ))}
                                {pagedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-[12px] font-bold">
                                            No se encontraron resultados para "{tableSearch}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left bg-slate-950/40 border-b border-slate-800">
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Puesto</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Estado</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Cobertura 24h</th>
                                    <th className="px-6 py-3.5 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Armamento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {(pagedRows as typeof puestos).map(p => {
                                    const cob = getCobertura(p.id);
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-3.5 font-black text-[13px] text-white">{p.nombre}</td>
                                            <td className="px-6 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                                    p.estado === 'cubierto' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    p.estado === 'alerta' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                    <span className={`size-1.5 rounded-full ${
                                                        p.estado === 'cubierto' ? 'bg-emerald-500' :
                                                        p.estado === 'alerta' ? 'bg-amber-400' : 'bg-rose-500'
                                                    }`} />
                                                    {p.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={`text-[11px] font-black ${cob.completa ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {cob.completa ? '✓ Completa' : '⚠ Con huecos'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                {p.conArmamento ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase">
                                                        <span className="material-symbols-outlined text-[14px]">security</span> Sí
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pagedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-[12px] font-bold">
                                            No se encontraron resultados para "{tableSearch}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
                        <span className="text-[11px] font-bold text-slate-400">
                            Mostrando {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, currentRows.length)} de {currentRows.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setTablePage(p => Math.max(0, p - 1))}
                                disabled={tablePage === 0}
                                className="size-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setTablePage(i)}
                                    className={`size-8 flex items-center justify-center rounded-xl text-[11px] font-black transition-all ${
                                        tablePage === i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:bg-slate-800'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={tablePage >= totalPages - 1}
                                className="size-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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

const KpiCard = ({ label, value, sub, icon, color, urgent, trend }: any) => {
    const colorMap: any = {
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
        red: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
        blue: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <div className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-md ${urgent ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
            <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.border} border`}>
                <span className={`material-symbols-outlined text-[18px] ${c.text}`}>{icon}</span>
            </div>
            <div className="min-w-0 flex-1">
                <div className={`text-[20px] font-black leading-none tabular-nums ${urgent ? 'text-rose-400' : 'text-white'}`}>
                    {value}
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate mt-1">{label}</p>
            </div>
            {trend && (
                <span className={`material-symbols-outlined text-[14px] shrink-0 ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trend === 'up' ? 'trending_up' : 'trending_down'}
                </span>
            )}
        </div>
    );
};

const SimpleBar = ({ label, pct, sub, color }: any) => (
    <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-black">
            <span className="text-slate-300 uppercase tracking-wider">{label}</span>
            <span className="text-slate-400 font-mono">{pct}% ({sub})</span>
        </div>
        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
        </div>
    </div>
);

const PuestoStatusBar = ({ label, value, total, color, icon }: any) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorMap: any = {
        emerald: 'bg-emerald-500 text-emerald-400',
        amber: 'bg-amber-500 text-amber-400',
        red: 'bg-rose-500 text-rose-400',
    };
    return (
        <div className="flex items-center justify-between text-[11px] font-bold">
            <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[15px] ${colorMap[color].split(' ')[1]}`}>{icon}</span>
                <span className="text-slate-300 uppercase text-[10px] tracking-wider">{label}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-white font-black">{value}</span>
                <span className="text-slate-500">({pct}%)</span>
            </div>
        </div>
    );
};

export default Dashboard;
