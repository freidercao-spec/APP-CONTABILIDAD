import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import toast from 'react-hot-toast';

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

    const puestosByDbId = useMemo(() => {
        const map = new Map();
        puestos.forEach(p => map.set(p.id, p));
        return map;
    }, [puestos]);

    // ─── STATS ───────────────────────────────────────────────────────────────
    const S = useMemo(() => {
        const vTotal     = vigilantes.length;
        const vActivos   = vigilantes.filter(v => v.estado === 'activo').length;
        const vDisp      = vigilantes.filter(v => v.estado === 'disponible').length;
        const vAusentes  = vigilantes.filter(v => v.estado === 'ausente').length;
        const vConDesc   = vigilantes.filter(v => (v.descargos||[]).some(d=>d.estado==='activo')).length;
        const vVacas     = vigilantes.filter(v => v.vacaciones?.inicio).length;

        const pTotal     = puestos.length;
        const pCub       = puestos.filter(p => p.estado === 'cubierto').length;
        const pAlerta    = puestos.filter(p => p.estado === 'alerta').length;
        const pDesp      = puestos.filter(p => p.estado === 'desprotegido').length;
        const pArmas     = puestos.filter(p => p.conArmamento).length;
        const pOper24    = puestos.filter(p => getCobertura ? getCobertura(p.id).completa : false).length;

        const personalReq = pTotal * 3;
        const personalFalt = Math.max(0, personalReq - vTotal);
        const saludPersonal = personalReq > 0 ? Math.round((vTotal / personalReq) * 100) : 100;

        const progsEsteMes = programaciones.filter(p => p.anio === CURR_ANIO && p.mes === CURR_MES);
        const progPublicadas = progsEsteMes.filter(p => p.estado === 'publicado').length;
        const progBorrador   = progsEsteMes.filter(p => p.estado === 'borrador').length;
        const cobPromedioMes = progsEsteMes.length > 0
            ? Math.round(progsEsteMes.reduce((acc,p) => acc + (getCobPct ? getCobPct(p.id) : 0), 0) / progsEsteMes.length)
            : 0;

        const alertasCrit  = entries.filter(e => e.severity === 'critical').length;
        const alertasWarn  = entries.filter(e => e.severity === 'warning').length;
        const eventosHoy   = entries.filter(e => new Date(e.timestamp).toDateString() === now.toDateString()).length;

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

    const eventosRecientes = useMemo(() => entries.slice(0, 10), [entries]);

    const handleForceSync = async () => {
        try {
            toast.loading('Iniciando sincronizacion forzada...', { id: 'sync' });
            await Promise.all([
                useProgramacionStore.getState().forceSync(),
                usePuestoStore.getState().fetchPuestos(),
                useVigilanteStore.getState().fetchVigilantes()
            ]);
            toast.success('Sincronizacion completada con exito', { id: 'sync' });
        } catch (e) {
            toast.error('Error al sincronizar datos', { id: 'sync' });
        }
    };

    return (
        <div className="space-y-7 animate-fade-in-up pb-24">

            {/* HEADER */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="size-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.35em]">Sistema Operativo - En Linea</span>
                    </div>
                    <h1 className="text-3xl xl:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                        Control <span className="text-primary">Operativo</span>
                    </h1>
                    <p className="text-[13px] text-slate-500 font-semibold mt-1">
                        Panel de Mando a {MESES[CURR_MES]} {CURR_ANIO} - CORAZA Seguridad Privada CTA
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        <button 
                            onClick={handleForceSync}
                            className="px-5 h-10 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg shadow-red-600/20 hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                            Forzar Sincronizacion
                        </button>
                        <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[16px] text-amber-500">schedule</span>
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{now.toLocaleDateString('es-CO', {weekday:'long', day:'numeric', month:'long'})}</span>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        v.1.2.7 - Sincronizacion Robusta
                    </span>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard label="Total Personal" value={S.vTotal} sub={`Req: ${S.personalReq}`} icon="groups" color="indigo"   />
                <KpiCard label="Puestos Activos" value={S.pTotal} sub="Total registrados" icon="location_on" color="blue" />
                <KpiCard label="Publicados" value={S.progPublicadas} sub="Marzo 2026" icon="verified" color="emerald" />
                <KpiCard label="Borradores" value={S.progBorrador} sub="En proceso" icon="edit_note" color="amber" />
                <KpiCard label="Sin Programar"  value={S.pTotal - S.progsEsteMes} sub="Pendiente" icon="pending_actions" color="red" urgent={S.pTotal - S.progsEsteMes > 0} />
                <KpiCard label="Cobertura Prom." value={`${S.cobPromedioMes}%`} sub="Mes actual" icon="donut_large" color="violet"   />
            </div>

            {/* HEALTH & STATUS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 horizon-card p-8 relative overflow-hidden">
                    <h2 className="section-title mb-8">Indicadores de Salud Operativa</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <HealthOrb label="Fuerza Laboral" pct={S.saludPersonal} sub={`${S.vTotal} / ${S.personalReq} req.`} color="#4f46e5" />
                        <HealthOrb label="Cobertura Puestos" pct={S.indiceCobertura} sub={`${S.pCub} cubiertos de ${S.pTotal}`} color="#10b981" />
                        <HealthOrb label="CUADRO OPERATIVO Mes" pct={S.cobPromedioMes} sub={`${S.progPublicadas} publicadas`} color="#8b5cf6" />
                    </div>
                </div>

                <div className="horizon-card p-8 flex flex-col">
                    <h2 className="section-title mb-6">Estado de Puestos</h2>
                    <div className="space-y-4">
                        <PuestoStatusBar label="Cubiertos" value={S.pCub} total={S.pTotal} color="emerald" icon="check_circle" />
                        <PuestoStatusBar label="En Alerta" value={S.pAlerta} total={S.pTotal} color="amber" icon="warning" />
                        <PuestoStatusBar label="Desprotegidos" value={S.pDesp} total={S.pTotal} color="red" icon="dangerous" />
                    </div>
                    <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[12px] font-black text-slate-400 uppercase">Salud Global</span>
                        <span className="text-[20px] font-black text-slate-900">
                             {Math.round((S.saludPersonal + S.indiceCobertura + S.cobPromedioMes)/3)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* TABLA DETALLE */}
            <div className="horizon-card overflow-hidden">
                <div className="flex items-center gap-0 border-b border-slate-100 px-8 bg-slate-50/40">
                    {[{id:'personal', label:'Personal', icon:'groups'}, {id:'puestos', label:'Puestos', icon:'hub'}].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-6 py-5 text-[11px] font-black uppercase border-b-2 transition-all ${activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 overflow-x-auto">
                    {activeTab === 'personal' && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-4 py-3">Operador</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Especialidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vigilantes.map(v => (
                                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <p className="font-black text-slate-900">{v.nombre}</p>
                                            <p className="text-[10px] text-slate-400">{v.id}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${v.estado === 'activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{v.estado}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-bold text-slate-500">{v.especialidad || 'General'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {activeTab === 'puestos' && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-4 py-3">Puesto</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Cobertura</th>
                                </tr>
                            </thead>
                            <tbody>
                                {puestos.map(p => (
                                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-black text-slate-900">{p.nombre}</td>
                                        <td className="px-4 py-3 text-[10px] font-black uppercase">{p.estado}</td>
                                        <td className="px-4 py-3 text-[11px] font-bold">
                                            {getCobertura(p.id).completa ? '✅ 100%' : '⚠️ Huecos'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

const KpiCard = ({ label, value, sub, icon, color, urgent }: any) => {
    const colors: any = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100',
    };
    return (
        <div className={`horizon-card p-5 group transition-all hover:-translate-y-1 ${urgent ? 'ring-2 ring-red-200 ring-offset-1' : ''}`}>
            <div className={`size-10 rounded-xl flex items-center justify-center border ${colors[color]} mb-4`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <div className={`text-[28px] font-black leading-none ${urgent ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>{value}</div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
    );
}

const HealthOrb = ({ label, pct, sub, color }: any) => (
    <div className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-slate-50 border border-slate-100">
        <div className="relative size-24">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${2*Math.PI*40}`} strokeDashoffset={`${2*Math.PI*40*(1-pct/100)}`} style={{transition:'stroke-dashoffset 1s ease'}} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-black text-slate-900">{pct}%</div>
        </div>
        <div className="text-center">
            <p className="text-[11px] font-black text-slate-800 uppercase">{label}</p>
            <p className="text-[10px] text-slate-400">{sub}</p>
        </div>
    </div>
);

const PuestoStatusBar = ({ label, value, total, color, icon }: any) => {
    const pct = total > 0 ? Math.round((value/total)*100) : 0;
    const colors: any = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
    return (
        <div>
            <div className="flex justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 uppercase">
                    <span className={`material-symbols-outlined text-[14px]`}>{icon}</span>{label}
                </span>
                <span className="text-[11px] font-black">{value}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${colors[color]} rounded-full transition-all duration-1000`} style={{width: `${pct}%`}} />
            </div>
        </div>
    );
};

export default Dashboard;
