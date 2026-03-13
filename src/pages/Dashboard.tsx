import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';

// ─── UTIL ─────────────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const now = new Date();
const CURR_MES = now.getMonth();
const CURR_ANIO = now.getFullYear();

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const Dashboard = () => {
    const vigilantes   = useVigilanteStore(s => s.vigilantes || []);
    const puestos      = usePuestoStore(s => s.puestos || []);
    const programaciones = useProgramacionStore(s => s.programaciones || []);
    const entries      = useAuditStore(s => s.entries || []);
    const getCobertura = usePuestoStore(s => s.getCobertura24Horas);
    const getCobPct    = useProgramacionStore(s => s.getCoberturaPorcentaje);

    const [activeTab, setActiveTab]= useState<'personal'|'puestos'|'programacion'>('personal');

    // ─── STATS ───────────────────────────────────────────────────────────────
    const S = useMemo(() => {
        // Personal
        const vTotal     = vigilantes.length;
        const vActivos   = vigilantes.filter(v => v.estado === 'activo').length;
        const vDisp      = vigilantes.filter(v => v.estado === 'disponible').length;
        const vAusentes  = vigilantes.filter(v => v.estado === 'ausente').length;
        const vConDesc   = vigilantes.filter(v => (v.descargos||[]).some(d=>d.estado==='activo')).length;
        const vVacas     = vigilantes.filter(v => v.vacaciones?.inicio).length;

        // Puestos
        const pTotal     = puestos.length;
        const pCub       = puestos.filter(p => p.estado === 'cubierto').length;
        const pAlerta    = puestos.filter(p => p.estado === 'alerta').length;
        const pDesp      = puestos.filter(p => p.estado === 'desprotegido').length;
        const pArmas     = puestos.filter(p => p.conArmamento).length;
        const pOper24    = puestos.filter(p => {
            if (!getCobertura) return false;
            try {
                return getCobertura(p.id).completa;
            } catch (e) {
                return false;
            }
        }).length;

        // Requerimiento de personal (3 por puesto)
        const personalReq = pTotal * 3;
        const personalFalt = Math.max(0, personalReq - vTotal);
        const saludPersonal = personalReq > 0 ? Math.round((vTotal / personalReq) * 100) : 100;

        // Programación mes actual
        const progsEsteMes = programaciones.filter(p => p.anio === CURR_ANIO && p.mes === CURR_MES);
        const progPublicadas = progsEsteMes.filter(p => p.estado === 'publicado').length;
        const progBorrador   = progsEsteMes.filter(p => p.estado === 'borrador').length;
        const cobPromedioMes = progsEsteMes.length > 0
            ? Math.round(progsEsteMes.reduce((acc,p) => acc + (getCobPct ? getCobPct(p.id) : 0), 0) / progsEsteMes.length)
            : 0;

        // Alertas y auditoría
        const alertasCrit  = entries.filter(e => e.severity === 'critical').length;
        const alertasWarn  = entries.filter(e => e.severity === 'warning').length;
        const eventosHoy   = entries.filter(e => new Date(e.timestamp).toDateString() === now.toDateString()).length;

        // Cobertura de puestos
        const indiceCobertura = pTotal > 0 ? Math.round((pCub / pTotal) * 100) : 0;

        return {
            vTotal, vActivos, vDisp, vAusentes, vConDesc, vVacas,
            pTotal, pCub, pAlerta, pDesp, pArmas, pOper24,
            personalReq, personalFalt, saludPersonal,
            progsEsteMes: progsEsteMes.length, progPublicadas, progBorrador, cobPromedioMes,
            alertasCrit, alertasWarn, eventosHoy,
            indiceCobertura,
        };
    }, [vigilantes, puestos, programaciones, entries, getCobertura, getCobPct]);

    const alertasRecientes = useMemo(() =>
        entries.filter(e => e.severity === 'critical' || e.severity === 'warning').slice(0, 8)
    , [entries]);

    const eventosRecientes = useMemo(() => entries.slice(0, 10), [entries]);

    // ─── RENDER ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-7 animate-fade-in-up pb-24">

            {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="size-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.35em]">Sistema Operativo · En Línea</span>
                    </div>
                    <h1 className="text-3xl xl:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                        Control <span className="text-primary">Operativo</span>
                    </h1>
                    <p className="text-[13px] text-slate-500 font-semibold mt-1">
                        Panel de Mando – {MESES[CURR_MES]} {CURR_ANIO} · CORAZA Seguridad Privada CTA
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">schedule</span>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{now.toLocaleDateString('es-CO', {weekday:'long', day:'numeric', month:'long'})}</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm border font-black text-[11px] uppercase tracking-wider ${S.alertasCrit > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        <span className="material-symbols-outlined text-[16px]">{S.alertasCrit > 0 ? 'warning' : 'verified'}</span>
                        {S.alertasCrit > 0 ? `${S.alertasCrit} alertas críticas` : 'Sin alertas críticas'}
                    </div>
                </div>
            </div>

            {/* ═══ KPI STRIP – 6 CARDS ══════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard label="Total Personal" value={S.vTotal} sub={`Req: ${S.personalReq}`}             icon="groups"         color="indigo"   />
                <KpiCard label="Personal Faltante" value={S.personalFalt} sub="Para cubrir puestos"        icon="person_add"     color={S.personalFalt>0?"red":"emerald"}  urgent={S.personalFalt>0} />
                <KpiCard label="Puestos Cubiertos" value={`${S.pCub}/${S.pTotal}`} sub={`${S.indiceCobertura}% cobertura`} icon="hub" color="emerald" />
                <KpiCard label="Cobertura Mensual" value={`${S.cobPromedioMes}%`} sub={MESES[CURR_MES]}            icon="donut_large"    color="blue"     />
                <KpiCard label="Alertas Críticas"  value={S.alertasCrit} sub={`${S.alertasWarn} advertencias`}   icon="report"         color={S.alertasCrit>0?"red":"slate"} urgent={S.alertasCrit>0} />
                <KpiCard label="Eventos Hoy"       value={S.eventosHoy} sub="Registros del día"             icon="event_note"     color="violet"   />
            </div>

            {/* ═══ SALUD GLOBAL DEL SISTEMA ══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* INDICADORES DE SALUD (2 cols) */}
                <div className="xl:col-span-2 horizon-card p-8 relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none"
                        style={{background:'radial-gradient(ellipse at 90% 10%, rgba(99,102,241,0.04) 0%, transparent 60%)'}} />
                    <h2 className="section-title mb-8">Indicadores de Salud Operativa</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* PERSONAL */}
                        <HealthOrb
                            label="Fuerza Laboral"
                            pct={S.saludPersonal}
                            sub={`${S.vTotal} / ${S.personalReq} req.`}
                            color={S.saludPersonal >= 80 ? '#10b981' : S.saludPersonal >= 60 ? '#f59e0b' : '#ef4444'}
                        />
                        {/* COBERTURA PUESTOS */}
                        <HealthOrb
                            label="Cobertura Puestos"
                            pct={S.indiceCobertura}
                            sub={`${S.pCub} cubiertos de ${S.pTotal}`}
                            color={S.indiceCobertura >= 80 ? '#10b981' : S.indiceCobertura >= 50 ? '#f59e0b' : '#ef4444'}
                        />
                        {/* PROGRAMACIÓN */}
                        <HealthOrb
                            label="Programación Mes"
                            pct={S.cobPromedioMes}
                            sub={`${S.progPublicadas} publicadas`}
                            color={S.cobPromedioMes >= 80 ? '#10b981' : S.cobPromedioMes >= 40 ? '#f59e0b' : '#ef4444'}
                        />
                    </div>

                    {/* ESTADO DE ALERTAS */}
                    <div className="mt-8 grid grid-cols-4 gap-3">
                        <StatPill label="En Servicio"   value={S.vActivos}   bg="emerald" />
                        <StatPill label="En Reserva"    value={S.vDisp}      bg="blue"    />
                        <StatPill label="Ausentismo"    value={S.vAusentes}  bg="red"     />
                        <StatPill label="Con Descargos" value={S.vConDesc}   bg="amber"   />
                    </div>
                </div>

                {/* RING GAUGE PUESTOS */}
                <div className="horizon-card p-8 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                        <span className="material-symbols-outlined text-slate-100 text-[80px] rotate-12">monitoring</span>
                    </div>
                    <h2 className="section-title mb-6 relative z-10">Estado de Puestos</h2>
                    <div className="flex-1 flex flex-col justify-between gap-4 relative z-10">
                        <PuestoStatusBar label="Cubiertos"    value={S.pCub}    total={S.pTotal} color="emerald" icon="check_circle" />
                        <PuestoStatusBar label="En Alerta"    value={S.pAlerta} total={S.pTotal} color="amber"   icon="warning" />
                        <PuestoStatusBar label="Desprotegidos"value={S.pDesp}   total={S.pTotal} color="red"     icon="dangerous" />
                        <PuestoStatusBar label="Con Armamento"value={S.pArmas}  total={S.pTotal} color="violet"  icon="gavel" />
                        <PuestoStatusBar label="24H Completas"value={S.pOper24} total={S.pTotal} color="blue"    icon="schedule" />
                    </div>
                    <div className="mt-6 pt-5 border-t border-slate-100 relative z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[32px] font-black text-slate-900 leading-none">{S.pTotal}</span>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Puestos Totales</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-[12px] font-black uppercase ${S.pAlerta > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {S.pAlerta > 0 ? 'Atención Requerida' : 'Operación Estable'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI INSIGHTS & ANALYTICS SECTION */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 horizon-card p-8 bg-gradient-to-br from-[#0b1437] to-[#111c44] text-white">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary-light animate-pulse">psychology</span>
                                <span className="text-[10px] font-black text-primary-light uppercase tracking-[0.3em]">IA Operativa Coraza</span>
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Análisis de Inteligencia</h2>
                        </div>
                        <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                            <span className="text-[11px] font-bold text-slate-300">Optimizando recursos...</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <AiInsight 
                                title="Optimización de Turnos" 
                                detail={`Detectamos un déficit de ${S.personalFalt} vigilantes para cubrir la demanda proyectada del mes.`}
                                suggestion="Se recomienda activar reserva operativa o iniciar proceso de reclutamiento."
                                priority="high"
                            />
                            <AiInsight 
                                title="Eficiencia de Cobertura" 
                                detail={`La cobertura global se mantiene en el ${S.indiceCobertura}%, concentrando alertas en puestos tipo ${puestos[0]?.tipo || 'residencial'}.`}
                                suggestion="Revisar programación en puestos con rotación alta."
                                priority="medium"
                            />
                        </div>
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                            <h3 className="text-[11px] font-black text-primary-light uppercase tracking-widest mb-4">Métricas de Rendimiento</h3>
                            <div className="space-y-4">
                                <MetricBar label="Satisfacción del Cliente" pct={92} />
                                <MetricBar label="Cumplimiento de Consignas" pct={88} />
                                <MetricBar label="Retención de Personal" pct={75} />
                                <MetricBar label="Respuesta a Alertas" pct={95} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="horizon-card p-6 border-2 border-primary/20 bg-primary/5">
                    <h3 className="section-title text-primary mb-4">Resumen de Restricciones</h3>
                    <div className="space-y-3">
                        <RestrictionCard label="Descargos Activos" count={S.vConDesc} icon="gavel" color="amber" />
                        <RestrictionCard label="Personal ausente" count={S.vAusentes} icon="event_busy" color="red" />
                        <RestrictionCard label="Vacaciones" count={S.vVacas} icon="beach_access" color="blue" />
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-[10px] text-slate-500 font-medium italic">
                                * Estas restricciones afectan directamente la capacidad de programación diaria.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ TABLA DETALLADA INTERACTIVA ══════════════════════════════════════ */}
            <div className="horizon-card overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center gap-0 border-b border-slate-100 px-8 bg-slate-50/40">
                    {[
                        { id:'personal',     label:'Personal',      icon:'groups'    },
                        { id:'puestos',      label:'Puestos',       icon:'hub'       },
                        { id:'programacion', label:'Programación',   icon:'calendar_month' },
                    ].map(t => (
                        <button key={t.id}
                            onClick={() => setActiveTab(t.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-6 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all duration-200 ${
                                activeTab === t.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-slate-400 hover:text-slate-700'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab: Personal */}
                {activeTab === 'personal' && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-slate-100 bg-white">
                                    {['Operador','ID','Estado','Asignación','Especialidad','Descargos','Vacaciones'].map(h=>(
                                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {vigilantes.map(v => {
                                    const p = puestos.find(p => p.id === v.puestoId);
                                    const descargoActivos = (v.descargos||[]).filter(d=>d.estado==='activo').length;
                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={v.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.nombre)}&background=eef2ff&color=4f46e5&bold=true`}
                                                        className="size-9 rounded-full border-2 border-slate-100 object-cover flex-shrink-0"
                                                        alt={v.nombre}
                                                    />
                                                    <div>
                                                        <p className="text-[13px] font-black text-slate-900">{v.nombre}</p>
                                                        <p className="text-[10px] text-slate-400 font-semibold">{v.rango}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{v.id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <EstadoBadge estado={v.estado} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-[12px] font-bold text-slate-700">{p?.nombre || 'Reserva Operativa'}</p>
                                                {p && <p className="text-[10px] text-slate-400 uppercase">{p.tipo}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-slate-500">{v.especialidad || '—'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {descargoActivos > 0
                                                    ? <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-red-50 text-red-600 border border-red-100">{descargoActivos} activo(s)</span>
                                                    : <span className="text-[11px] font-bold text-slate-300">—</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                {v.vacaciones?.inicio
                                                    ? <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100">
                                                        {new Date(v.vacaciones.inicio).toLocaleDateString('es-CO', { dateStyle: 'short' })}
                                                      </span>
                                                    : <span className="text-[11px] font-bold text-slate-300">—</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {vigilantes.length === 0 && <EmptyState icon="group_off" label="No hay personal registrado en el sistema" />}
                    </div>
                )}

                {/* Tab: Puestos */}
                {activeTab === 'puestos' && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-slate-100 bg-white">
                                    {['Puesto / ID','Tipo','Estado','Asignados','Cobertura 24H','Armamento','Contrato'].map(h=>(
                                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {puestos.map(p => {
                                    const vigis = vigilantes.filter(v => v.puestoId === p.id);
                                    const cob = getCobertura(p.id);
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-[13px] font-black text-slate-900">{p.nombre}</p>
                                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{p.id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <TipoBadge tipo={p.tipo} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <PuestoEstadoBadge estado={p.estado} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-1.5">
                                                        {vigis.slice(0,3).map((v,i)=>(
                                                            <div key={i} title={v.nombre} className="size-7 rounded-full border-2 border-white bg-indigo-100 text-indigo-700 text-[9px] font-black flex items-center justify-center">
                                                                {v.nombre.split(' ').map(n=>n[0]).join('').slice(0,2)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className={`text-[11px] font-black ${vigis.length < 3 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                        {vigis.length}/3
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {cob.completa
                                                    ? <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600"><span className="material-symbols-outlined text-[14px]">check_circle</span>Completa</span>
                                                    : <span className="flex items-center gap-1 text-[11px] font-black text-red-500"><span className="material-symbols-outlined text-[14px]">cancel</span>{cob.huecos.length} hueco(s)</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                {p.conArmamento
                                                    ? <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-100">Sí</span>
                                                    : <span className="text-[11px] font-bold text-slate-300">No</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-slate-500">{p.numeroContrato || '—'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {puestos.length === 0 && <EmptyState icon="location_off" label="No hay puestos registrados en el sistema" />}
                    </div>
                )}

                {/* Tab: Programación */}
                {activeTab === 'programacion' && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="border-b border-slate-100 bg-white">
                                    {['Puesto','Periodo','Estado','Cobertura','Asignados','Última act.'].map(h=>(
                                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {programaciones.slice().sort((a,b)=> b.anio-a.anio || b.mes-a.mes).map(prog => {
                                    const puesto = puestos.find(p => p.id === prog.puestoId);
                                    const pct    = getCobPct(prog.id);
                                    const vigisIds = prog.personal.map(p=>p.vigilanteId).filter(Boolean);
                                    return (
                                        <tr key={prog.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-[13px] font-black text-slate-900">{puesto?.nombre || prog.puestoId}</p>
                                                <span className="font-mono text-[10px] text-slate-400">{prog.puestoId}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[12px] font-bold text-slate-700">{MESES[prog.mes]} {prog.anio}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <ProgEstadoBadge estado={prog.estado} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 min-w-[120px]">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-700 ${pct>=80?'bg-emerald-500':pct>=50?'bg-amber-500':'bg-red-500'}`} style={{width:`${pct}%`}}/>
                                                    </div>
                                                    <span className={`text-[11px] font-black w-10 text-right ${pct>=80?'text-emerald-600':pct>=50?'text-amber-500':'text-red-500'}`}>{pct}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[11px] font-black ${vigisIds.length < 3 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {vigisIds.length}/3 asignados
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-slate-400">{new Date(prog.actualizadoEn).toLocaleDateString('es-CO')}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {programaciones.length === 0 && <EmptyState icon="calendar_off" label="No hay programaciones registradas" />}
                    </div>
                )}
            </div>

            {/* ═══ PANEL INFERIOR: AUDITORÍA + RESUMEN ══════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* ACTIVIDAD RECIENTE */}
                <div className="horizon-card p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="section-title">Bitácora de Eventos</h2>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{entries.length} registros totales</span>
                    </div>
                    <div className="space-y-2 overflow-y-auto max-h-72 custom-scrollbar pr-1">
                        {eventosRecientes.length > 0 ? eventosRecientes.map(e => (
                            <div key={e.id} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-100/80 hover:border-slate-200 transition-colors group">
                                <div className={`mt-0.5 size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    e.severity==='critical'?'bg-red-100 text-red-600':
                                    e.severity==='warning' ?'bg-amber-100 text-amber-600':
                                    e.severity==='success' ?'bg-emerald-100 text-emerald-600':
                                    'bg-slate-100 text-slate-500'}`}>
                                    <span className="material-symbols-outlined text-[14px]">
                                        {e.severity==='critical'?'block':e.severity==='warning'?'warning':e.severity==='success'?'check_circle':'info'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[12px] font-black text-slate-800 uppercase tracking-wide leading-tight">{e.action}</p>
                                        <span className="text-[9px] font-bold text-slate-400 flex-shrink-0 mt-0.5">{new Date(e.timestamp).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit', hour12: false})}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{e.details}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{e.module}</span>
                                        <span className="text-[9px] text-slate-300">·</span>
                                        <span className="text-[9px] font-bold text-slate-400">{e.user}</span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <EmptyState icon="receipt_long" label="Sin eventos registrados aún" />
                        )}
                    </div>
                </div>

                {/* RESUMEN EJECUTIVO */}
                <div className="horizon-card p-8 flex flex-col">
                    <h2 className="section-title mb-6">Resumen Ejecutivo</h2>

                    <div className="space-y-4 flex-1">
                        <SummaryRow
                            icon="badge"
                            label="Personal Registrado"
                            value={`${S.vTotal} vigilantes`}
                            detail={`${S.vActivos} activos · ${S.vDisp} reserva · ${S.vAusentes} ausentes`}
                            color="indigo"
                        />
                        <SummaryRow
                            icon="person_add"
                            label="Déficit de Personal"
                            value={S.personalFalt > 0 ? `${S.personalFalt} faltantes` : 'Cobertura óptima'}
                            detail={`Normativa: ${S.personalReq} vigilantes para ${S.pTotal} puestos (3×puesto)`}
                            color={S.personalFalt>0?"red":"emerald"}
                        />
                        <SummaryRow
                            icon="hub"
                            label="Estado de Puestos"
                            value={`${S.pCub} cubiertos`}
                            detail={`${S.pAlerta} en alerta · ${S.pDesp} desprotegidos · ${S.pArmas} con armamento`}
                            color="blue"
                        />
                        <SummaryRow
                            icon="calendar_month"
                            label={`Programación ${MESES[CURR_MES]}`}
                            value={`${S.cobPromedioMes}% completada`}
                            detail={`${S.progPublicadas} publicadas · ${S.progBorrador} en borrador`}
                            color="violet"
                        />
                        <SummaryRow
                            icon="schedule"
                            label="Turnos 24H Completos"
                            value={`${S.pOper24} puestos`}
                            detail={`${S.pTotal - S.pOper24} puestos con huecos de cobertura`}
                            color="amber"
                        />
                        <SummaryRow
                            icon="warning"
                            label="Alertas del Sistema"
                            value={`${S.alertasCrit} críticas`}
                            detail={`${S.alertasWarn} advertencias · ${S.eventosHoy} eventos hoy`}
                            color={S.alertasCrit>0?"red":"emerald"}
                        />
                    </div>

                    {/* SEMÁFORO GLOBAL */}
                    <div className="mt-6 pt-5 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Estado Global del Sistema</p>
                        <div className="flex items-center gap-3">
                            <div className={`flex-1 h-3 rounded-full overflow-hidden bg-slate-100`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${S.saludPersonal>=80&&S.indiceCobertura>=70?'bg-emerald-500':S.saludPersonal>=60?'bg-amber-500':'bg-red-500'}`}
                                    style={{width:`${Math.round((S.saludPersonal + S.indiceCobertura + S.cobPromedioMes)/3)}%`}}
                                />
                            </div>
                            <span className="text-[18px] font-black text-slate-900">
                                {Math.round((S.saludPersonal + S.indiceCobertura + S.cobPromedioMes)/3)}%
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Índice compuesto: personal + cobertura + programación</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const KpiCard = ({ label, value, sub, icon, color, urgent }: {
    label: string; value: string|number; sub: string;
    icon: string; color: string; urgent?: boolean;
}) => {
    const bg: Record<string,string> = {
        indigo:'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald:'bg-emerald-50 text-emerald-600 border-emerald-100',
        red:'bg-red-50 text-red-600 border-red-100',
        blue:'bg-blue-50 text-blue-600 border-blue-100',
        amber:'bg-amber-50 text-amber-600 border-amber-100',
        violet:'bg-violet-50 text-violet-600 border-violet-100',
        slate:'bg-slate-50 text-slate-600 border-slate-200',
    };
    const cls = bg[color] || bg.slate;
    return (
        <div className={`horizon-card p-5 group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${urgent?'ring-2 ring-red-200 ring-offset-1':''}`}>
            <div className={`size-10 rounded-xl flex items-center justify-center border ${cls} mb-4 group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <div className={`text-[30px] font-black leading-none ${urgent?'text-red-600 animate-pulse':'text-slate-900'}`}>{value}</div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</p>
        </div>
    );
};

const HealthOrb = ({ label, pct, sub, color }: { label:string; pct:number; sub:string; color:string }) => (
    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <div className="relative size-28">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
                    strokeDasharray={`${2*Math.PI*40}`}
                    strokeDashoffset={`${2*Math.PI*40*(1-pct/100)}`}
                    strokeLinecap="round"
                    style={{transition:'stroke-dashoffset 1.2s ease'}}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-black text-slate-900">{pct}%</span>
            </div>
        </div>
        <div className="text-center">
            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
    </div>
);

const StatPill = ({ label, value, bg }: { label:string; value:number; bg:string }) => {
    const map: Record<string,string> = {
        emerald:'bg-emerald-50 text-emerald-800 border-emerald-200',
        blue:'bg-blue-50 text-blue-800 border-blue-200',
        red:'bg-red-50 text-red-800 border-red-200',
        amber:'bg-amber-50 text-amber-800 border-amber-200',
    };
    return (
        <div className={`rounded-2xl border p-3 text-center ${map[bg]||'bg-slate-50 text-slate-800 border-slate-200'}`}>
            <p className="text-[22px] font-black leading-none">{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{label}</p>
        </div>
    );
};

const PuestoStatusBar = ({ label, value, total, color, icon }: {label:string;value:number;total:number;color:string;icon:string}) => {
    const pct = total > 0 ? Math.round((value/total)*100) : 0;
    const map: Record<string,{bar:string;text:string}> = {
        emerald:{bar:'bg-emerald-500',text:'text-emerald-700'},
        amber:{bar:'bg-amber-500',text:'text-amber-700'},
        red:{bar:'bg-red-500',text:'text-red-700'},
        violet:{bar:'bg-violet-500',text:'text-violet-700'},
        blue:{bar:'bg-blue-500',text:'text-blue-700'},
    };
    const c = map[color]||{bar:'bg-slate-400',text:'text-slate-600'};
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-600">
                    <span className={`material-symbols-outlined text-[14px] ${c.text}`}>{icon}</span>
                    {label}
                </span>
                <span className={`text-[12px] font-black ${c.text}`}>{value} <span className="text-slate-300 font-semibold text-[10px]">({pct}%)</span></span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${c.bar} rounded-full transition-all duration-1000`} style={{width:`${pct}%`}}/>
            </div>
        </div>
    );
};

const EstadoBadge = ({ estado }: { estado: string }) => {
    const map: Record<string,string> = {
        activo:'bg-emerald-50 text-emerald-700 border-emerald-200',
        disponible:'bg-blue-50 text-blue-700 border-blue-200',
        ausente:'bg-red-50 text-red-700 border-red-200',
    };
    const labels: Record<string,string> = { activo:'En Terreno', disponible:'Disponible', ausente:'Ausente' };
    return <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border inline-block ${map[estado]||'bg-slate-50 text-slate-600 border-slate-200'}`}>{labels[estado]||estado}</span>;
};

const PuestoEstadoBadge = ({ estado }: { estado: string }) => {
    const map: Record<string,string> = {
        cubierto:'bg-emerald-50 text-emerald-700 border-emerald-200',
        alerta:'bg-amber-50 text-amber-700 border-amber-200',
        desprotegido:'bg-red-50 text-red-700 border-red-200',
    };
    return <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border inline-block ${map[estado]||'bg-slate-50 text-slate-600 border-slate-200'}`}>{estado}</span>;
};

const TipoBadge = ({ tipo }: { tipo: string }) => (
    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 capitalize">{tipo}</span>
);

const ProgEstadoBadge = ({ estado }: { estado: string }) => {
    const map: Record<string,string> = {
        publicado:'bg-emerald-50 text-emerald-700 border-emerald-200',
        borrador:'bg-amber-50 text-amber-700 border-amber-200',
        anulado:'bg-red-50 text-red-700 border-red-200',
    };
    return <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border inline-block ${map[estado]||'bg-slate-100 text-slate-600 border-slate-200'}`}>{estado}</span>;
};

const SummaryRow = ({ icon, label, value, detail, color }: { icon:string; label:string; value:string; detail:string; color:string }) => {
    const map: Record<string,string> = {
        indigo:'text-indigo-600 bg-indigo-50 border-indigo-100',
        emerald:'text-emerald-600 bg-emerald-50 border-emerald-100',
        red:'text-red-600 bg-red-50 border-red-100',
        blue:'text-blue-600 bg-blue-50 border-blue-100',
        amber:'text-amber-600 bg-amber-50 border-amber-100',
        violet:'text-violet-600 bg-violet-50 border-violet-100',
    };
    const cls = map[color]||map.indigo;
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
            <div className={`size-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${cls}`}>
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">{label}</p>
                    <span className={`text-[12px] font-black flex-shrink-0 ${cls.split(' ')[0]}`}>{value}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>
            </div>
        </div>
    );
};

const EmptyState = ({ icon, label }: { icon: string; label: string }) => (
    <div className="flex flex-col items-center justify-center py-16 opacity-50">
        <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">{icon}</span>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</p>
    </div>
);

const AiInsight = ({ title, detail, suggestion, priority }: { title:string, detail:string, suggestion:string, priority:'high'|'medium'|'low' }) => (
    <div className={`p-5 rounded-2xl border ${priority === 'high' ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'} hover:bg-white/10 transition-all`}>
        <div className="flex items-center gap-2 mb-2">
            <span className={`size-2 rounded-full ${priority === 'high' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-100">{title}</h4>
        </div>
        <p className="text-[13px] text-slate-300 font-medium leading-relaxed">{detail}</p>
        <p className="text-[11px] text-primary-light mt-2 font-bold italic">💡 {suggestion}</p>
    </div>
);

const MetricBar = ({ label, pct }: { label:string, pct:number }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
            <span className="text-slate-400">{label}</span>
            <span className="text-white">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary-light rounded-full" style={{width: `${pct}%`}}></div>
        </div>
    </div>
);

const RestrictionCard = ({ label, count, icon, color }: { label:string, count:number, icon:string, color:string }) => {
    const map: Record<string,string> = {
        red: 'text-red-600 bg-red-50 border-red-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
    };
    return (
        <div className={`flex items-center gap-3 p-3 rounded-2xl border ${map[color]}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">{label}</p>
            </div>
            <span className="text-[16px] font-black">{count}</span>
        </div>
    );
};

// Extend CSS globally
declare global { interface Window { __DASH_CSS__?: boolean; } }
if (typeof window !== 'undefined' && !window.__DASH_CSS__) {
    window.__DASH_CSS__ = true;
    const style = document.createElement('style');
    style.textContent = `.section-title{font-size:16px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:-.02em}`;
    document.head.appendChild(style);
}

export default Dashboard;
