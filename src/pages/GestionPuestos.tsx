import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePuestoStore, type TurnoConfig, type JornadaCustom } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useProgramacionStore, type AsignacionDia, type TipoJornada, type RolPuesto, type TemplateProgramacion } from '../store/programacionStore';
import { useAuthStore } from '../store/authStore';
import { useAuditStore } from '../store/auditStore';
import { useAIStore } from '../store/aiStore';
import { showTacticalToast } from '../utils/tacticalToast';
import { MilitaryTimeInput } from '../components/ui/MilitaryTimeInput';
import jsPDF from 'jspdf';

// ── Default turn config ───────────────────────────────────────────────────────
const DEFAULT_TURNOS: TurnoConfig[] = [
    { id: 'AM', nombre: 'Turno AM', inicio: '06:00', fin: '18:00' },
    { id: 'PM', nombre: 'Turno PM', inicio: '18:00', fin: '06:00' },
];

// ── Default jornada colors ────────────────────────────────────────────────────
const DEFAULT_JORNADAS: JornadaCustom[] = [
    { id: 'normal', nombre: 'Normal', short: 'N', color: '#4318FF', textColor: '#fff' },
    { id: 'descanso_remunerado', nombre: 'Desc. Rem.', short: 'DR', color: '#00b377', textColor: '#fff' },
    { id: 'descanso_no_remunerado', nombre: 'Desc. N/Rem.', short: 'DNR', color: '#ff9500', textColor: '#fff' },
    { id: 'vacacion', nombre: 'Vacación', short: 'VAC', color: '#8b5cf6', textColor: '#fff' },
    { id: 'sin_asignar', nombre: 'Sin asignar', short: '-', color: '#ef4444', textColor: '#fff' },
];

const getJornada = (id: string, custom?: JornadaCustom[]) => {
    const list = custom?.length ? custom : DEFAULT_JORNADAS;
    return list.find(j => j.id === id) ?? DEFAULT_JORNADAS[4];
};

const ROL_LABELS: Record<RolPuesto, string> = {
    titular_a: 'Titular A',
    titular_b: 'Titular B',
    relevante: 'Relevante',
};

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Legacy compat shim ───────────────────────────────────────────────────────
const JORNADA_COLORS: Record<string, { bg: string; text: string; label: string; short: string }> = {
    normal: { bg: '#4318FF', text: '#fff', label: 'Normal', short: 'N' },
    descanso_remunerado: { bg: '#00b377', text: '#fff', label: 'Desc. Rem.', short: 'DR' },
    descanso_no_remunerado: { bg: '#ff9500', text: '#fff', label: 'Desc. N/Rem.', short: 'DNR' },
    vacacion: { bg: '#8b5cf6', text: '#fff', label: 'Vacación', short: 'VAC' },
    sin_asignar: { bg: '#ef4444', text: '#fff', label: 'Sin asignar', short: '!' },
};



// ── Subcomponents ─────────────────────────────────────────────────────────────

interface CeldaCalendarioProps {
    asig: AsignacionDia;
    vigilanteNombre?: string;
    onEdit: () => void;
    jornadasCustom?: JornadaCustom[];
}

const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
};

const CeldaCalendario = ({ asig, vigilanteNombre, onEdit, jornadasCustom, turnosConfig }: CeldaCalendarioProps & { turnosConfig?: TurnoConfig[] }) => {
    const j = getJornada(asig.jornada, jornadasCustom);
    const isSinAsignar = asig.jornada === 'sin_asignar' || !asig.vigilanteId;
    const bg = isSinAsignar ? '#ef4444' : j.color;
    const tc = isSinAsignar ? '#fff' : j.textColor;

    const tCfg = turnosConfig?.find(t => t.id === asig.turno);
    const turnoNombre = tCfg ? `${tCfg.nombre} (${tCfg.inicio}-${tCfg.fin})` : asig.turno;
    const militaryHours = tCfg ? `${tCfg.inicio}-${tCfg.fin}` : '';

    // Split name into first name + last name for compact display
    const nameParts = (vigilanteNombre || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    return (
        <button
            onClick={onEdit}
            title={`${vigilanteNombre || '¡SIN ASIGNAR!'} · ${turnoNombre} · ${j.nombre}`}
            className="w-full rounded-xl tracking-wide transition-all hover:scale-105 hover:z-10 relative flex flex-col items-center justify-center border border-white/20 shadow-md px-1 py-1.5 gap-0"
            style={{ background: bg, color: tc, minHeight: '76px' }}
        >
            {/* Turno label top */}
            <span className="text-[7px] opacity-90 uppercase font-black tracking-tighter leading-none mb-0.5">
                {asig.jornada === 'normal' ? (militaryHours || turnoNombre) : j.nombre}
            </span>
            {/* Jornada short badge */}
            <span
                className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black leading-none"
                style={{ background: 'rgba(0,0,0,0.18)', color: tc }}
            >
                {j.short}
            </span>
            {/* Vigilante name — primary content */}
            {isSinAsignar ? (
                <span className="mt-1 text-[9px] font-black leading-tight text-center w-full px-0.5 opacity-90">
                    Sin asignar
                </span>
            ) : (
                <div className="mt-1 flex flex-col items-center w-full px-0.5">
                    {firstName && (
                        <span className="text-[9px] font-black leading-none text-center w-full truncate">
                            {firstName}
                        </span>
                    )}
                    {lastName && (
                        <span className="text-[8px] font-bold leading-none text-center w-full truncate opacity-90">
                            {lastName}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
};

// Modal for editing a single day cell — with cross-validation
interface EditCeldaModalProps {
    asig: AsignacionDia;
    vigilantes: { id: string; nombre: string; estado?: string }[];
    titularesId: string[];
    ocupados: Map<string, string[]>; // vigilanteId -> ['dia-turno',...]
    turnosConfig: TurnoConfig[];
    jornadasCustom: JornadaCustom[];
    onSave: (data: Partial<AsignacionDia>) => void;
    onClose: () => void;
}

const EditCeldaModal = ({ asig, vigilantes, titularesId, ocupados, turnosConfig, jornadasCustom, onSave, onClose }: EditCeldaModalProps) => {
    const [vigilanteId, setVigilanteId] = useState(asig.vigilanteId || '');
    const [turno, setTurno] = useState(asig.turno);
    const [jornada, setJornada] = useState(asig.jornada);
    const [conflicto, setConflicto] = useState<string | null>(null);

    const rolLabel = ROL_LABELS[asig.rol] || asig.rol;

    const checkConflict = (vid: string, t: string): string | null => {
        if (!vid) return null;
        const slots = ocupados.get(vid) || [];
        if (slots.includes(`${asig.dia}-${t}`)) {
            return `${vigilantes.find(v => v.id === vid)?.nombre} ya tiene turno el día ${asig.dia} (${t})`;
        }
        // PM → AM next day rule
        if (t === 'AM') {
            const prevDay = asig.dia - 1;
            if (slots.includes(`${prevDay}-PM`)) {
                return `${vigilantes.find(v => v.id === vid)?.nombre} cubrió PM el día ${prevDay} — sin descanso mínimo para AM del día ${asig.dia}`;
            }
        }
        return null;
    };

    const handleVigChange = (vid: string) => {
        setVigilanteId(vid);
        setConflicto(checkConflict(vid, turno));
    };
    const handleTurnoChange = (t: string) => {
        setTurno(t as typeof turno);
        setConflicto(checkConflict(vigilanteId, t));
    };

    const jornadasList = jornadasCustom.length ? jornadasCustom : DEFAULT_JORNADAS;

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-5 duration-300" onClick={e => e.stopPropagation()}>
                <div className="mb-6 pb-4 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit_calendar</span>
                        EDITAR ASIGNACIÓN
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase">{rolLabel}</span>
                        <p className="text-[11px] text-slate-500 font-bold">Día {asig.dia}</p>
                    </div>
                </div>
                {conflicto && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
                        <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">block</span>
                        <p className="text-[11px] font-bold text-red-700">{conflicto}</p>
                    </div>
                )}

                <div className="space-y-5">
                    {/* Sugerencias Rápidas (Titulares) */}
                    {titularesId.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 block">Sugerencia: Titulares</label>
                            <div className="flex flex-wrap gap-2">
                                {titularesId.map(vid => {
                                    const v = vigilantes.find(vig => vig.id === vid);
                                    if (!v) return null;
                                    const isSelected = vigilanteId === vid;
                                    const c = checkConflict(vid, turno);
                                    return (
                                        <button
                                            key={vid}
                                            onClick={() => handleVigChange(vid)}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2 ${isSelected ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50'}`}
                                        >
                                            <span className="material-symbols-outlined text-[14px]">{c ? 'warning' : 'person'}</span>
                                            {v.nombre}
                                            {c && <span className="text-[8px] opacity-70">⚠</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos los Vigilantes</label>
                        <select value={vigilanteId} onChange={e => handleVigChange(e.target.value)}
                            className="w-full mt-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary/50">
                            <option value="">— Sin asignar —</option>
                            <optgroup label="✅ TITULARES DEL PUESTO">
                                {vigilantes.filter(v => titularesId.includes(v.id)).map(v => {
                                    const c = checkConflict(v.id, turno);
                                    return <option key={v.id} value={v.id}>{c ? `⚠ ${v.nombre}` : v.nombre}</option>;
                                })}
                            </optgroup>
                            <optgroup label="🔄 REEMPLAZOS / OTROS">
                                {vigilantes.filter(v => !titularesId.includes(v.id)).map(v => {
                                    const c = checkConflict(v.id, turno);
                                    const estadoMark = v.estado === 'disponible' ? ' (Disponible)' : '';
                                    return <option key={v.id} value={v.id}>{c ? `⚠ ${v.nombre}${estadoMark}` : `${v.nombre}${estadoMark}`}</option>;
                                })}
                            </optgroup>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turno</label>
                        <div className="flex gap-2 mt-1">
                            {turnosConfig.map(t => (
                                <button key={t.id} onClick={() => handleTurnoChange(t.id)}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${turno === t.id ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-500 hover:border-primary/30'}`}>
                                    {t.nombre}<br /><span className="text-[8px] opacity-70">{t.inicio}–{t.fin}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Jornada</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            {jornadasList.map(j => (
                                <button key={j.id} onClick={() => setJornada(j.id as TipoJornada)}
                                    className={`py-2.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all text-left ${jornada === j.id ? 'border-primary shadow-lg' : 'border-slate-100 hover:border-slate-300'}`}
                                    style={{ background: jornada === j.id ? j.color : '#f8fafc', color: jornada === j.id ? j.textColor : '#64748b' }}>
                                    {j.nombre}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button disabled={!!conflicto}
                        onClick={() => !conflicto && onSave({ vigilanteId: vigilanteId || null, turno: turno, jornada, rol: asig.rol })}
                        className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg ${conflicto ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:brightness-110 shadow-primary/30'}`}>
                        Guardar
                    </button>
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition-all">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

// ── Panel de Programación Mensual ─────────────────────────────────────────────
interface PanelMensualProps {
    puestoId: string;
    puestoNombre: string;
    anio: number;
    mes: number;
    onClose: () => void;
}

const PanelMensualPuesto = ({ puestoId, puestoNombre, anio, mes, onClose }: PanelMensualProps) => {
    const { username } = useAuthStore();
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const logAction = useAuditStore(s => s.logAction);
    const addAIAction = useAIStore(s => s.addAction);
    const allPuestos = usePuestoStore(s => s.puestos);
    const puesto = useMemo(() => allPuestos.find(p => p.id === puestoId), [allPuestos, puestoId]);
    const updatePuesto = usePuestoStore(s => s.updatePuesto);
    const allProgramaciones = useProgramacionStore(s => s.programaciones);
    const updateGuardStatus = useVigilanteStore(s => s.updateGuardStatus);

    // Use individual stable selectors instead of destructuring the whole store
    // (destructuring causes new object references each render = infinite loops)
    const crearOObtenerProgramacion = useProgramacionStore(s => s.crearOObtenerProgramacion);
    const asignarPersonal = useProgramacionStore(s => s.asignarPersonal);
    const actualizarAsignacion = useProgramacionStore(s => s.actualizarAsignacion);
    const publicarProgramacion = useProgramacionStore(s => s.publicarProgramacion);
    const guardarBorrador = useProgramacionStore(s => s.guardarBorrador);
    const guardarComoPlantilla = useProgramacionStore(s => s.guardarComoPlantilla);
    const aplicarPlantilla = useProgramacionStore(s => s.aplicarPlantilla);
    const eliminarPlantilla = useProgramacionStore(s => s.eliminarPlantilla);
    const getDiasTrabajoVigilante = useProgramacionStore(s => s.getDiasTrabajoVigilante);
    const getDiasDescansoVigilante = useProgramacionStore(s => s.getDiasDescansoVigilante);
    const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
    const getAlertas = useProgramacionStore(s => s.getAlertas);

    // Get raw data from store — NEVER use .filter()/.find() inside selectors (creates new refs = infinite loop)
    const allTemplates = useProgramacionStore(s => s.templates);
    const templates = useMemo(() => allTemplates.filter(t => t.puestoId === puestoId), [allTemplates, puestoId]);

    const allProgramaciones2 = useProgramacionStore(s => s.programaciones);
    const prog = useMemo(() =>
        allProgramaciones2.find(p => p.puestoId === puestoId && p.anio === anio && p.mes === mes),
        [allProgramaciones2, puestoId, anio, mes]
    );

    const [editCell, setEditCell] = useState<AsignacionDia | null>(null);
    const [activeTab, setActiveTab] = useState<'calendario' | 'personal' | 'historial' | 'alertas' | 'config' | 'plantillas'>('calendario');
    const [showJustificacion, setShowJustificacion] = useState<{
        vigilante: any,
        per: any,
        newVigilanteId: string
    } | null>(null);
    const [justificacionText, setJustificacionText] = useState('');
    const [showSaveTplModal, setShowSaveTplModal] = useState(false);
    const [tplNombre, setTplNombre] = useState('');
    const alertasDisparadas = useRef<Set<string>>(new Set());

    const handleGuardarPlantilla = () => {
        if (!tplNombre.trim()) return;
        guardarComoPlantilla(prog!.id, tplNombre.trim(), puestoNombre, username || 'Sistema');
        setShowSaveTplModal(false);
        setTplNombre('');
        showTacticalToast({ title: 'Plantilla Guardada', message: `"${tplNombre.trim()}" lista para reutilizar en meses futuros.`, type: 'success' });
        logAction('PROGRAMACION', 'Plantilla creada', `"${tplNombre.trim()}" — Puesto: ${puestoNombre}`, 'info');
    };

    const handleAplicarPlantilla = (tpl: TemplateProgramacion) => {
        aplicarPlantilla(tpl.id, puestoId, anio, mes, username || 'Sistema');
        showTacticalToast({ title: 'Plantilla Aplicada', message: `Se cargó "${tpl.nombre}" — puedes editar cualquier celda libremente.`, type: 'info' });
        logAction('PROGRAMACION', 'Plantilla aplicada', `"${tpl.nombre}" — ${MONTH_NAMES[mes]} ${anio}`, 'info');
        setActiveTab('calendario');
    };

    const turnosConfig: TurnoConfig[] = puesto?.turnosConfig?.length ? puesto.turnosConfig : DEFAULT_TURNOS;
    const jornadasCustom: JornadaCustom[] = puesto?.jornadasCustom?.length ? puesto.jornadasCustom : [];

    // Cross-programacion occupied slots map
    const ocupados = useMemo(() => {
        const map = new Map<string, string[]>();
        allProgramaciones.filter(p => p.anio === anio && p.mes === mes && p.puestoId !== puestoId).forEach(p => {
            p.asignaciones.forEach(a => {
                if (!a.vigilanteId) return;
                const slots = map.get(a.vigilanteId) || [];
                slots.push(`${a.dia}-${a.turno}`);
                map.set(a.vigilanteId, slots);
            });
        });
        return map;
    }, [allProgramaciones, anio, mes, puestoId]);

    // Quincena rest counters — use stable string IDs as deps, not object references
    const progId = prog?.id;
    const progAsignacionesKey = prog?.asignaciones?.length ?? 0;
    const progPersonalKey = prog?.personal?.map(p => p.vigilanteId).join(',') ?? '';
    const restCounters = useMemo(() => {
        if (!prog) return {};
        const result: Record<string, { q1rem: number; q1nrem: number; q2rem: number; q2nrem: number }> = {};
        (prog.personal || []).forEach(per => {
            if (!per.vigilanteId) return;
            const vid = per.vigilanteId;
            result[vid] = { q1rem: 0, q1nrem: 0, q2rem: 0, q2nrem: 0 };
            (prog.asignaciones || []).filter(a => a.vigilanteId === vid).forEach(a => {
                const q = a.dia <= 15 ? 'q1' : 'q2';
                const key = `${q}${a.jornada === 'descanso_remunerado' ? 'rem' : 'nrem'}` as keyof typeof result[string];
                if (result[vid][key] !== undefined) result[vid][key]++;
            });
        });
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progId, progAsignacionesKey, progPersonalKey]);

    // Alert on unassigned cells - Only when tab is calendar, debounced to avoid loop
    const progIdForEffect = prog?.id;
    const progAsignacionesCountForEffect = prog?.asignaciones?.filter(a => !a.vigilanteId).length ?? 0;
    useEffect(() => {
        if (!progIdForEffect || activeTab !== 'calendario') return;
        if (progAsignacionesCountForEffect > 0) {
            const key = `missing-${progIdForEffect}-${progAsignacionesCountForEffect}`;
            if (alertasDisparadas.current.has(key)) return;
            alertasDisparadas.current.add(key);
            addAIAction({
                text: `**ASIGNACIÓN INCOMPLETA:** El puesto "${puestoNombre}" tiene ${progAsignacionesCountForEffect} turnos sin vigilante asignado para ${MONTH_NAMES[mes]}.`,
                type: 'notification',
                sender: 'ai',
                priority: 'medium'
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progIdForEffect, activeTab, progAsignacionesCountForEffect]);

    if (!prog) {
        return (
            <div className="absolute inset-0 z-[50] bg-slate-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
                <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="size-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all border border-slate-200">
                            <span className="material-symbols-outlined font-black">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{puestoNombre}</h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{MONTH_NAMES[mes]} {anio} · Programación Mensual</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <span className="material-symbols-outlined text-[80px] text-slate-200 mb-6 font-light">edit_calendar</span>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Programación de {MONTH_NAMES[mes]} {anio}</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-sm">No se ha iniciado la programación para este mes. Haz clic en el botón para generar el cuadro de turnos en blanco.</p>
                    <button
                        onClick={() => {
                            crearOObtenerProgramacion(puestoId, anio, mes, username || 'Sistema');
                            showTacticalToast({
                                title: 'Sistema Inicializado',
                                message: `Panel de ${MONTH_NAMES[mes]} listo para despliegue.`,
                                type: 'success'
                            });
                        }}
                        className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 shadow-xl shadow-primary/30 transition-all hover:-translate-y-1"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Iniciar Programación
                    </button>
                </div>
            </div>
        );
    }

    const daysInMonth = new Date(anio, mes + 1, 0).getDate();
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const cobertura = getCoberturaPorcentaje(prog.id);
    const alertas = getAlertas(prog.id);

    const getVigilanteName = (id: string | null) => {
        if (!id) return undefined;
        return vigilantes.find(v => v.id === id)?.nombre;
    };

    const handleSaveCell = (data: Partial<AsignacionDia>) => {
        if (!editCell) return;
        const resultado = actualizarAsignacion(prog.id, editCell.dia, { ...data, rol: editCell.rol }, username || 'Sistema');
        if (!resultado.permitido) {
            showTacticalToast({
                title: 'Restricción AI',
                message: resultado.mensaje,
                type: 'error'
            });
            logAction('PROGRAMACION', 'Asignación bloqueada por IA', resultado.regla || resultado.mensaje, 'critical');
        } else {
            showTacticalToast({
                title: 'Actualización Local',
                message: 'Turno registrado correctamente.',
                type: 'success'
            });
            logAction('PROGRAMACION', `Turno editado — Día ${editCell.dia}`, `Puesto: ${puestoNombre}`, 'info');
        }
        setEditCell(null);
    };

    const handlePublicar = () => {
        publicarProgramacion(prog.id, username || 'Sistema');
        logAction('PROGRAMACION', 'Programación PUBLICADA', `Puesto: ${puestoNombre} · ${MONTH_NAMES[mes]} ${anio}`, 'success');
        showTacticalToast({
            title: 'Despliegue Exitoso',
            message: 'Programación publicada y activa para el personal.',
            type: 'success'
        });
    };

    const handleBorrador = () => {
        guardarBorrador(prog.id, username || 'Sistema');
        logAction('PROGRAMACION', 'Borrador guardado', `Puesto: ${puestoNombre}`, 'info');
        showTacticalToast({
            title: 'Progreso Guardado',
            message: 'Borrador almacenado en el núcleo del sistema.',
            type: 'info'
        });
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const accent: [number, number, number] = [11, 20, 65]; // Header bg
        const accentLight: [number, number, number] = [67, 24, 255]; // Primary
        const margin = 8;

        // ── Helper to convert image to Base64 (Reliable Rendering) ──
        const getBase64Image = (url: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } else reject();
                };
                img.onerror = reject;
                img.src = url;
            });
        };

        const generatePDF = async () => {
            const logoBase64 = await getBase64Image('/logo_premium.png').catch(() => null);

            // ── Helper to add logo ──
            const addHeaderLogo = (doc: jsPDF) => {
                if (logoBase64) {
                    try {
                        doc.setFillColor(255, 255, 255);
                        doc.roundedRect(margin + 2, 4, 26, 26, 3, 3, 'F');
                        doc.addImage(logoBase64, 'PNG', margin + 3, 5, 24, 24);
                    } catch (e) { /* fallback below */ }
                } else {
                    doc.setFontSize(7);
                    doc.setTextColor(255, 255, 255);
                    doc.text('CORAZA', margin + 15, 15, { align: 'center' });
                    doc.text('SEGURIDAD', margin + 15, 19, { align: 'center' });
                }
            };

            // ============================================================
            // PAGE 1: COVER — Post details + Personnel summary
            // ============================================================

        // ── Header Banner ──
        doc.setFillColor(...accent);
        doc.rect(0, 0, pageW, 34, 'F');
        
        addHeaderLogo(doc);

        const textStartX = margin + 34;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('PROGRAMACIÓN MENSUAL — CORAZA SEGURIDAD CTA', textStartX, 13);
        
        doc.setFontSize(8);
        doc.setTextColor(180, 200, 255);
        doc.text(`Puesto: ${puestoNombre.toUpperCase()}`, textStartX, 20);
        doc.text(`Período: ${MONTH_NAMES[mes].toUpperCase()} ${anio}`, textStartX, 26);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })} — ${new Date().toLocaleTimeString('es-CO', { hour12: false })}`, textStartX, 31);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(`v${prog.version} · Estado: ${prog.estado.toUpperCase()}`, pageW - margin, 13, { align: 'right' });
        doc.text(`Cobertura: ${cobertura}%`, pageW - margin, 20, { align: 'right' });

        // ── Post Details Card ──
        let y = 42;
        doc.setFillColor(245, 247, 252);
        doc.roundedRect(margin, y, pageW - margin * 2, 38, 3, 3, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentLight);
        doc.text('DATOS DEL PUESTO', margin + 5, y + 7);
        
        doc.setDrawColor(...accentLight);
        doc.setLineWidth(0.4);
        doc.line(margin + 5, y + 9, margin + 62, y + 9);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 90);
        const details = [
            ['Puesto:', puestoNombre],
            ['ID:', puesto?.id || '—'],
            ['Dirección:', puesto?.direccion || 'No registrada'],
            ['Cliente:', puesto?.cliente || '—'],
            ['N° Contrato:', puesto?.numeroContrato || '—'],
            ['Tipo de Servicio:', puesto?.tipoServicio || '—'],
            ['Contacto:', puesto?.contacto || '—'],
            ['Teléfono:', puesto?.telefono || '—'],
            ['Armamento:', puesto?.conArmamento ? 'CON ARMAMENTO' : 'SIN ARMAMENTO'],
            ['Prioridad:', (puesto?.prioridad || 'media').toUpperCase()],
        ];
        
            const col1X = margin + 6;
            const col2X = pageW / 2 + 10;
            details.forEach((pair, i) => {
                const isRight = i >= 5;
                const x = isRight ? col2X : col1X;
                const row = isRight ? i - 5 : i;
                doc.setFont('helvetica', 'bold');
                doc.text(pair[0], x, y + 16 + row * 4);
                doc.setFont('helvetica', 'normal');
                
                // Manejo de texto largo para dirección y cliente
                const val = pair[1];
                const maxWidth = isRight ? pageW - x - margin - 5 : col2X - x - 30;
                const lines = doc.splitTextToSize(val, maxWidth);
                doc.text(lines, x + 28, y + 16 + row * 4);
            });

        // ── Turnos Config ──
        y += 44;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentLight);
        doc.text('CONFIGURACIÓN DE TURNOS OPERATIVOS', margin + 2, y);
        y += 5;
        turnosConfig.forEach((tc) => {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 90);
            doc.text(`● ${tc.nombre}: ${tc.inicio} → ${tc.fin} (12 Horas)`, margin + 6, y);
            y += 4.5;
        });

        // ── Personnel Summary ──
        y += 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentLight);
        doc.text('RESUMEN DE PERSONAL — DETALLE POR QUINCENA', margin + 2, y);
        y += 6;

        // Table header
        doc.setFillColor(...accent);
        doc.rect(margin, y, pageW - margin * 2, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        const headers = ['ROL', 'NOMBRE COMPLETO', 'DÍAS T.', 'Q1: REM', 'Q1: N/REM', 'Q2: REM', 'Q2: N/REM', 'TOT. DESC.'];
        const colWidths = [28, 55, 20, 19, 19, 19, 19, 21];
        let hx = margin + 2;
        headers.forEach((h, i) => {
            doc.text(h, hx, y + 5);
            hx += colWidths[i];
        });
        y += 7;

        prog.personal.forEach((per, pIdx) => {
            if (!per.vigilanteId) return;
            const vig = vigilantes.find(v => v.id === per.vigilanteId);
            const diasT = getDiasTrabajoVigilante(prog.id, per.vigilanteId);
            const diasD = getDiasDescansoVigilante(prog.id, per.vigilanteId);
            const r = restCounters[per.vigilanteId] || { q1rem: 0, q1nrem: 0, q2rem: 0, q2nrem: 0 };

            const bg: [number, number, number] = pIdx % 2 === 0 ? [250, 251, 255] : [255, 255, 255];
            doc.setFillColor(...bg);
            doc.rect(margin, y, pageW - margin * 2, 6.5, 'F');
            doc.setTextColor(40, 40, 70);
            doc.setFontSize(6.5);

            const row = [
                ROL_LABELS[per.rol].toUpperCase(),
                (vig?.nombre || 'VACANTE').toUpperCase(),
                String(diasT),
                String(r.q1rem),
                String(r.q1nrem),
                String(r.q2rem),
                String(r.q2nrem),
                String(diasD.remunerados + diasD.noRemunerados),
            ];
            let rx = margin + 2;
            row.forEach((cell, ci) => {
                doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal');
                doc.text(cell, rx, y + 4.5);
                rx += colWidths[ci];
            });
            y += 6.5;
        });

        // ── Instructions / Requirements ──
        if (puesto?.instrucciones || puesto?.requisitos) {
            y += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...accentLight);
            doc.text('INSTRUCCIONES Y REQUISITOS', margin + 2, y);
            y += 6;
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 90);
            
            const instr = `Instrucciones: ${puesto?.instrucciones || 'N/A'} | Requisitos: ${puesto?.requisitos || 'N/A'}`;
            const instrLines = doc.splitTextToSize(instr, pageW - margin * 2 - 10);
            doc.text(instrLines, margin + 4, y);
        }

        // ============================================================
        // PAGE 2: CALENDAR GRID
        // ============================================================
        doc.addPage('a4', 'landscape');
        
        // Header
        doc.setFillColor(...accent);
        doc.rect(0, 0, pageW, 25, 'F');
        addHeaderLogo(doc);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`CUADRO DE PROGRAMACIÓN — ${puestoNombre.toUpperCase()}`, textStartX, 10);
        doc.setFontSize(7);
        doc.text(`${MONTH_NAMES[mes].toUpperCase()} ${anio} · Cobertura: ${cobertura}%`, textStartX, 16);
        doc.text(`Operadores asignados: ${prog.personal.filter(p => p.vigilanteId).length}`, textStartX, 21);

        y = 32;

        // Calendar grid
        const colW = (pageW - margin * 2) / (daysInMonth + 4.5);
        const rowH = 9.5;

        // Header - Day numbers
        doc.setFillColor(...accent);
        doc.rect(margin, y, colW * 4.5, rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text('OPERADOR / ROL', margin + colW * 2.25, y + 6, { align: 'center' });

        dayNumbers.forEach((d, i) => {
            const x = margin + colW * 4.5 + i * colW;
            const dayName = new Date(anio, mes, d).toLocaleDateString('es-CO', { weekday: 'short' }).charAt(0).toUpperCase();
            doc.setFillColor(...accent);
            doc.rect(x, y, colW, rowH, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5);
            doc.text(dayName, x + colW / 2, y + 3.5, { align: 'center' });
            doc.setFontSize(6.5);
            doc.text(String(d).padStart(2, '0'), x + colW / 2, y + 7.5, { align: 'center' });
        });
        y += rowH;

        // Data rows per personal
        prog.personal.forEach((per, pIdx) => {
            const vig = per.vigilanteId ? vigilantes.find(v => v.id === per.vigilanteId) : null;
            const bgRow: [number, number, number] = pIdx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
            doc.setFillColor(...bgRow);
            doc.rect(margin, y, pageW - margin * 2, rowH, 'F');

            doc.setDrawColor(220, 220, 225);
            doc.setLineWidth(0.1);
            doc.rect(margin, y, pageW - margin * 2, rowH, 'S');

            doc.setTextColor(30, 30, 60);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            const label = `${vig?.nombre || 'VACANTE'} (${ROL_LABELS[per.rol]})`;
            doc.text(label.toUpperCase(), margin + 2, y + 6, { maxWidth: colW * 4.3 });

            dayNumbers.forEach((d, i) => {
                const asig = prog.asignaciones.find(a => a.dia === d && a.rol === per.rol);
                const jornada = asig?.jornada ?? 'sin_asignar';
                const jCfg = getJornada(jornada, jornadasCustom);

                const isSinAsignar = jornada === 'sin_asignar' || !asig?.vigilanteId;
                const [r, g, b] = hexToRgb(isSinAsignar ? '#fee2e2' : jCfg.color);
                const textColor: [number, number, number] = isSinAsignar ? [220, 38, 38] : [255, 255, 255];

                const x = margin + colW * 4.5 + i * colW;
                doc.setFillColor(r, g, b);
                doc.rect(x + 0.3, y + 0.6, colW - 0.6, rowH - 1.2, 'F');

                doc.setDrawColor(240, 240, 240);
                doc.rect(x, y, colW, rowH, 'S');

                doc.setTextColor(...textColor);
                doc.setFontSize(4.5);
                doc.setFont('helvetica', 'bold');
                doc.text(jCfg.short, x + colW / 2, y + 5.5, { align: 'center' });
            });
            y += rowH;
        });

        // Legend & Signatures
        y += 6;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accent);
        doc.text('LEYENDA DE JORNADAS:', margin + 2, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        const finalListJ = jornadasCustom.length ? jornadasCustom : DEFAULT_JORNADAS;
        let xl = margin + 2;
        finalListJ.forEach((j) => {
            const [cr, cg, cb] = hexToRgb(j.color);
            doc.setFillColor(cr, cg, cb);
            doc.rect(xl, y - 2.5, 3.5, 3.5, 'F');
            doc.setTextColor(60, 60, 90);
            doc.setFontSize(6);
            doc.text(`${j.short} = ${j.nombre}`, xl + 5, y);
            xl += 36;
            if (xl > pageW - 40) { xl = margin + 2; y += 5; }
        });

        // Final footer
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(
            `CORAZA SEGURIDAD CTA · Nit. 901324567-8 · Medellín, Colombia · 3113836939`,
            pageW / 2, pageH - 8, { align: 'center' }
        );
        doc.text(`Página 2 de 2 · Reporte Operativo Generado automáticamente por el Sistema CTA`, pageW / 2, pageH - 5, { align: 'center' });

        doc.save(`CORAZA_${puestoNombre.replace(/\s+/g, '_')}_${MONTH_NAMES[mes]}_${anio}.pdf`);
        showTacticalToast({
            title: 'PDF Generado',
            message: `Reporte operativo de ${puestoNombre} exportado con éxito.`,
            type: 'success'
        });
        logAction('PROGRAMACION', 'PDF exportado', `Puesto: ${puestoNombre}`, 'info');
        };

        generatePDF();
    };

    const statsBar = prog.personal.map(per => {
        if (!per.vigilanteId) return null;
        const nombre = vigilantes.find(v => v.id === per.vigilanteId)?.nombre || per.vigilanteId;
        const dias = getDiasTrabajoVigilante(prog.id, per.vigilanteId);
        const desc = getDiasDescansoVigilante(prog.id, per.vigilanteId);
        return { nombre, dias, ...desc, rol: per.rol };
    }).filter(Boolean);

    return (
        <div className="absolute inset-x-0 top-0 bottom-0 z-[50] bg-slate-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500 min-h-screen">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm z-10">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button onClick={onClose} className="shrink-0 size-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all border border-slate-200">
                        <span className="material-symbols-outlined font-black">arrow_back</span>
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight truncate leading-none">{puestoNombre}</h2>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{MONTH_NAMES[mes]} {anio} · Programación Mensual</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 no-scrollbar">
                    {/* Coverage badge */}
                    <div className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl font-black text-[10px] sm:text-[11px] uppercase ${cobertura >= 80 ? 'bg-success/10 text-success border border-success/20' : cobertura >= 50 ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
                        {cobertura}%
                    </div>
                    <div className={`shrink-0 px-2 sm:px-3 py-2 rounded-xl font-black text-[9px] sm:text-[10px] uppercase ${prog.estado === 'publicado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {prog.estado === 'publicado' ? '✓' : '✏️'}
                    </div>
                    <button onClick={handleExportPDF} className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200/50">
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span> PDF
                    </button>
                    <button onClick={handleBorrador} className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200/50">
                        <span className="material-symbols-outlined text-[16px]">save</span> Guardar
                    </button>
                    {/* Save as template button */}
                    <button
                        onClick={() => { setTplNombre(''); setShowSaveTplModal(true); }}
                        title="Guardar como plantilla reutilizable"
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-violet-50 text-violet-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-violet-100 transition-all border border-violet-200"
                    >
                        <span className="material-symbols-outlined text-[16px]">bookmark_add</span> Plantilla
                    </button>
                    <button onClick={handlePublicar} className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-primary/30 transition-all border border-primary-light/20">
                        <span className="material-symbols-outlined text-[16px]">publish</span> Publicar
                    </button>
                </div>
            </div>

            {/* Save Template Modal */}
            {showSaveTplModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSaveTplModal(false)}>
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-violet-600 text-[28px]">bookmark_add</span>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase">Guardar Plantilla</h3>
                                <p className="text-[11px] text-slate-500 font-bold">Reutilizable en meses futuros</p>
                            </div>
                        </div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre de la plantilla</label>
                        <input
                            autoFocus
                            value={tplNombre}
                            onChange={e => setTplNombre(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGuardarPlantilla()}
                            placeholder="Ej: Turnos Estándar Enero"
                            className="w-full h-11 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-violet-400 transition-all"
                        />
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleGuardarPlantilla} disabled={!tplNombre.trim()} className="flex-1 py-3 bg-violet-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-violet-700 disabled:opacity-40 transition-all">
                                Guardar
                            </button>
                            <button onClick={() => setShowSaveTplModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts strip */}
            {alertas.length > 0 && (
                <div className="bg-warning/10 border-b border-warning/20 px-6 py-2 flex items-center gap-3 flex-wrap">
                    <span className="material-symbols-outlined text-warning text-[18px]">warning</span>
                    {alertas.map((a, i) => (
                        <span key={i} className="text-[11px] font-bold text-warning">{a}</span>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white border-b border-slate-100 px-6 flex gap-1 overflow-x-auto">
                {([['calendario', 'calendar_month', 'Calendario'], ['personal', 'people', 'Personal'], ['plantillas', 'bookmarks', 'Plantillas'], ['historial', 'history', 'Historial'], ['alertas', 'notifications', 'Alertas IA'], ['config', 'tune', 'Configurar']] as const).map(([tab, icon, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <span className="material-symbols-outlined text-[16px]">{icon}</span>
                        {label}{tab === 'plantillas' && templates.length > 0 && <span className="ml-1 bg-violet-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">{templates.length}</span>}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {/* ── CALENDARIO ─────────────────────────────────────────────── */}
                {activeTab === 'calendario' && (
                    <div className="space-y-6">
                        {/* Stats per vigilante */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {statsBar.map(s => s && (
                                <div key={s.rol} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{ROL_LABELS[s.rol]}</p>
                                    <p className="text-sm font-black text-slate-900 truncate">{s.nombre}</p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s.dias} días trabajados</span>
                                        <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full">{s.remunerados} D.Rem</span>
                                        <span className="text-[10px] font-bold bg-warning/10 text-warning px-2 py-0.5 rounded-full">{s.noRemunerados} D.N/Rem</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leyenda:</span>
                            {Object.entries(JORNADA_COLORS).map(([key, cfg]) => (
                                <div key={key} className="flex items-center gap-1.5">
                                    <div className="size-3 rounded" style={{ background: cfg.bg }} />
                                    <span className="text-[10px] font-bold text-slate-600">{cfg.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-xl overflow-x-auto">
                            <table className="w-full" style={{ minWidth: `${dayNumbers.length * 80 + 200}px` }}>
                                <thead>
                                    <tr className="bg-slate-900">
                                        <th className="sticky left-0 z-30 bg-slate-900 px-6 py-4 text-left text-[11px] font-black text-slate-300 uppercase tracking-widest border-r border-slate-800" style={{ minWidth: '200px' }}>Vigilante / Rol</th>
                                        {dayNumbers.map(d => (
                                            <th key={d} className="py-4 text-center text-[10px] font-black text-slate-300 border-r border-slate-800">{d}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {prog.personal.map(per => {
                                        const vig = per.vigilanteId ? vigilantes.find(v => v.id === per.vigilanteId) : null;
                                        return (
                                            <tr key={per.rol} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="sticky left-0 z-20 bg-white px-6 py-4 border-r border-slate-100 shadow-[4px_0_8px_rgba(0,0,0,0.03)]">
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-900 uppercase leading-none">{vig?.nombre || '— No asignado —'}</span>
                                                        <span className={`text-[9px] font-bold mt-1 inline-block px-2 py-0.5 rounded-md w-max ${per.rol === 'titular_a' ? 'bg-indigo-50 text-indigo-600' : per.rol === 'titular_b' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {ROL_LABELS[per.rol]}
                                                        </span>
                                                    </div>
                                                </td>
                                                {dayNumbers.map(d => {
                                                    const asig = prog.asignaciones.find(a => a.dia === d && a.rol === per.rol);
                                                    if (!asig) return <td key={d} className="p-1 border-r border-slate-50"><div className="w-full h-[76px] rounded-xl bg-slate-100"></div></td>;
                                                    // Use the cell's own vigilanteId (may differ from the row's vigilante)
                                                    const cellVigName = getVigilanteName(asig.vigilanteId);
                                                    return (
                                                        <td key={d} className="p-1 border-r border-slate-50">
                                                            <CeldaCalendario
                                                                asig={asig}
                                                                vigilanteNombre={cellVigName}
                                                                onEdit={() => setEditCell(asig)}
                                                                jornadasCustom={jornadasCustom}
                                                                turnosConfig={turnosConfig}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── PLANTILLAS ─────────────────────────────────────────────── */}
                {activeTab === 'plantillas' && (
                    <div className="max-w-2xl space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-violet-50 border border-violet-200 rounded-2xl">
                            <span className="material-symbols-outlined text-violet-600 text-[22px] mt-0.5">info</span>
                            <div>
                                <p className="text-[12px] font-black text-violet-900">Sistema de Plantillas Reutilizables</p>
                                <p className="text-[11px] text-violet-700 font-bold mt-1">
                                    Guarda la programación actual como plantilla y aplícala en cualquier mes futuro.
                                    Los horarios y jornadas se copian exactamente; puedes modificar lo que necesites después.
                                </p>
                            </div>
                        </div>

                        {/* Save current as template shortcut */}
                        <button
                            onClick={() => { setTplNombre(''); setShowSaveTplModal(true); }}
                            className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-violet-300 rounded-2xl text-violet-700 hover:bg-violet-50 transition-all group"
                        >
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">bookmark_add</span>
                            <div className="text-left">
                                <p className="text-[12px] font-black uppercase tracking-widest">Guardar Programación Actual como Plantilla</p>
                                <p className="text-[10px] font-bold opacity-70">Captura el estado actual del tablero de {MONTH_NAMES[mes]} {anio}</p>
                            </div>
                        </button>

                        {templates.length === 0 ? (
                            <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <span className="material-symbols-outlined text-[64px] text-slate-200 mb-4">bookmarks</span>
                                <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Sin plantillas guardadas</p>
                                <p className="text-[11px] text-slate-400 mt-2 font-bold">Guarda la programación de este mes para reutilizarla luego</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Plantillas de {puestoNombre} — {templates.length} guardada{templates.length !== 1 && 's'}
                                </p>
                                {templates.map(tpl => (
                                    <div key={tpl.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 group hover:border-violet-200 transition-all">
                                        <div className="size-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-violet-600 text-[22px]">bookmark</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black text-slate-900 truncate">{tpl.nombre}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                Creada por {tpl.creadoPor} · {new Date(tpl.creadoEn).toLocaleDateString('es-CO')}
                                                · {tpl.patron.length} asignaciones
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleAplicarPlantilla(tpl)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20"
                                            >
                                                <span className="material-symbols-outlined text-[15px]">upload</span>
                                                Aplicar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    eliminarPlantilla(tpl.id);
                                                    showTacticalToast({ title: 'Plantilla Eliminada', message: `"${tpl.nombre}" ha sido borrada.`, type: 'info' });
                                                }}
                                                className="size-9 flex items-center justify-center rounded-xl text-slate-300 hover:text-danger hover:bg-danger/5 transition-all"
                                                title="Eliminar plantilla"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── PERSONAL ───────────────────────────────────────────────── */}
                {activeTab === 'personal' && (
                    <div className="max-w-xl space-y-4">
                        <p className="text-[11px] text-slate-500 font-bold">Asigna los 3 vigilantes responsables de este puesto este mes.</p>
                        {prog.personal.map(per => (
                            <div key={per.rol} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                                <div className={`size-10 rounded-xl flex items-center justify-center font-black text-[11px] text-white ${per.rol === 'titular_a' ? 'bg-primary' : per.rol === 'titular_b' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                    {ROL_LABELS[per.rol][0]}
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ROL_LABELS[per.rol]}</p>
                                    <select
                                        value={per.vigilanteId || ''}
                                        onChange={e => {
                                            const newVigilanteId = e.target.value || null;

                                            const processChange = (just: string) => {
                                                const updated = prog.personal.map(p => p.rol === per.rol ? { ...p, vigilanteId: newVigilanteId } : p);
                                                asignarPersonal(prog.id, updated, username || 'Sistema');

                                                if (newVigilanteId) {
                                                    const v = vigilantes.find(gv => gv.id === newVigilanteId);
                                                    if (v && v.estado === 'disponible') {
                                                        updateGuardStatus(newVigilanteId, 'activo', puestoId, `Asignado como TITULAR en ${puestoNombre}: ${just}`);
                                                    }
                                                }
                                                logAction('PROGRAMACION', 'Personal actualizado', `Rol ${ROL_LABELS[per.rol]}: ${newVigilanteId}`, 'info');
                                                showTacticalToast({
                                                    title: 'Personal Asignado',
                                                    message: `Se ha vinculado al titular para el rol de ${ROL_LABELS[per.rol]}.`,
                                                    type: 'success'
                                                });
                                            };

                                            if (newVigilanteId) {
                                                const v = vigilantes.find(gv => gv.id === newVigilanteId);
                                                if (v && v.estado === 'disponible') {
                                                    // Instead of prompt, show modal
                                                    setShowJustificacion({ vigilante: v, per, newVigilanteId });
                                                    setJustificacionText('');
                                                } else {
                                                    processChange('Actualización de personal');
                                                }
                                            } else {
                                                // Removal
                                                const updated = prog.personal.map(p => p.rol === per.rol ? { ...p, vigilanteId: null } : p);
                                                asignarPersonal(prog.id, updated, username || 'Sistema');
                                                showTacticalToast({
                                                    title: 'Puesto Despejado',
                                                    message: `Rol ${ROL_LABELS[per.rol]} ahora se encuentra vacante.`,
                                                    type: 'info'
                                                });
                                            }
                                        }}
                                        className="mt-1 w-full h-10 bg-white border-2 border-slate-100 rounded-xl px-3 text-sm font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-sm"
                                    >
                                        <option value="">— Seleccionar del personal —</option>
                                        <optgroup label="DIPONIBLES">
                                            {vigilantes.filter(v => v.estado === 'disponible').map(v => (
                                                <option key={v.id} value={v.id}>✅ {v.nombre}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="ACTIVOS">
                                            {vigilantes.filter(v => v.estado === 'activo').map(v => (
                                                <option key={v.id} value={v.id}>👤 {v.nombre}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="OTROS">
                                            {vigilantes.filter(v => v.estado !== 'disponible' && v.estado !== 'activo').map(v => (
                                                <option key={v.id} value={v.id}>⚠ {v.nombre} ({v.estado})</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── HISTORIAL ──────────────────────────────────────────────── */}
                {activeTab === 'historial' && (
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                        {prog.historialCambios.slice().reverse().map(h => (
                            <div key={h.id} className={`flex items-start gap-3 p-4 rounded-xl border ${h.tipo === 'rechazo_ia' ? 'bg-danger/5 border-danger/20' : h.tipo === 'publicacion' ? 'bg-success/5 border-success/20' : 'bg-white border-slate-100'}`}>
                                <span className={`material-symbols-outlined text-[18px] mt-0.5 ${h.tipo === 'rechazo_ia' ? 'text-danger' : h.tipo === 'publicacion' ? 'text-success' : 'text-primary'}`}>
                                    {h.tipo === 'rechazo_ia' ? 'block' : h.tipo === 'publicacion' ? 'verified' : h.tipo === 'borrador' ? 'save' : 'edit'}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900">{h.descripcion}</p>
                                    {h.reglaViolada && <p className="text-[11px] text-danger font-bold mt-0.5">Regla: {h.reglaViolada}</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(h.timestamp).toLocaleString('es-CO', { hour12: false })} · {h.usuario}</p>
                                </div>
                            </div>
                        ))}
                        {prog.historialCambios.length === 0 && (
                            <p className="text-center text-slate-400 font-bold py-10">Sin cambios registrados aún</p>
                        )}
                    </div>
                )}

                {/* ── ALERTAS IA ─────────────────────────────────────────────── */}
                {activeTab === 'alertas' && (
                    <div className="space-y-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                            <h3 className="font-black text-primary flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined">smart_toy</span>
                                Validaciones IA Activas
                            </h3>
                            <ul className="space-y-2 text-[12px] text-slate-700 font-medium">
                                {[
                                    '🚫 Un vigilante no puede estar en dos puestos al mismo tiempo en el mismo turno',
                                    '🚫 Máximo 3 días de descanso por quincena por vigilante',
                                    '🚫 Los 3 descansos deben ser: 2 remunerados + 1 no remunerado exactamente',
                                    '🚫 No se aprueban vacaciones en diciembre, enero ni Semana Santa',
                                    '🚫 Si el vigilante tiene descanso, no puede ser asignado a otro puesto ese día',
                                    '⚠️ El relevante con días vacíos recibirá sugerencia de asignación alterna',
                                    '⚠️ Días sin cobertura generan alerta de puesto desprotegido',
                                ].map((r, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-0.5">→</span> {r}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-black text-slate-900 mb-3 text-[13px]">Rechazos de IA registrados</h3>
                            {prog.historialCambios.filter(h => h.tipo === 'rechazo_ia').length === 0 ? (
                                <p className="text-[12px] text-success font-bold">✅ Sin rechazos en este período. Todo en orden.</p>
                            ) : (
                                prog.historialCambios.filter(h => h.tipo === 'rechazo_ia').map(h => (
                                    <div key={h.id} className="flex gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl mb-2">
                                        <span className="material-symbols-outlined text-danger text-[18px]">block</span>
                                        <div>
                                            <p className="text-[12px] font-bold text-danger">{h.reglaViolada}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(h.timestamp).toLocaleString('es-CO', { hour12: false })}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── CONFIG TAB ─────────────────────────────────────── */}
                {activeTab === 'config' && (
                    <div className="space-y-8 max-w-2xl">
                        {/* Turnos Config */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">schedule</span>Configurar Turnos del Puesto</h3>
                            <div className="space-y-3">
                                {turnosConfig.map((tc, idx) => (
                                    <div key={tc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <input className="flex-1 h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-bold outline-none" value={tc.nombre}
                                            onChange={e => { const t = [...turnosConfig]; t[idx] = { ...t[idx], nombre: e.target.value }; updatePuesto(puestoId, { turnosConfig: t }); }} />
                                        <MilitaryTimeInput value={tc.inicio}
                                            onChange={val => { const t = [...turnosConfig]; t[idx] = { ...t[idx], inicio: val }; updatePuesto(puestoId, { turnosConfig: t }); }} />
                                        <span className="text-slate-400">→</span>
                                        <MilitaryTimeInput value={tc.fin}
                                            onChange={val => { const t = [...turnosConfig]; t[idx] = { ...t[idx], fin: val }; updatePuesto(puestoId, { turnosConfig: t }); }} />
                                        <button onClick={() => { const t = turnosConfig.filter((_, i) => i !== idx); updatePuesto(puestoId, { turnosConfig: t }); }} className="size-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => { const t = [...turnosConfig, { id: `T${Date.now()}`, nombre: `Turno ${turnosConfig.length + 1}`, inicio: '06:00', fin: '18:00' }]; updatePuesto(puestoId, { turnosConfig: t }); }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl font-black text-[11px] uppercase hover:bg-primary/20 transition-all">
                                    <span className="material-symbols-outlined text-[16px]">add</span>Agregar Turno
                                </button>
                            </div>
                        </div>
                        {/* Leyenda Config */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">palette</span>Personalizar Leyenda de Jornadas</h3>
                            <div className="space-y-3">
                                {(jornadasCustom.length ? jornadasCustom : DEFAULT_JORNADAS).map((j, idx) => (
                                    <div key={j.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100" style={{ background: j.color + '22' }}>
                                        <input type="color" className="size-9 rounded-lg border-0 cursor-pointer" value={j.color}
                                            onChange={e => { const list = jornadasCustom.length ? [...jornadasCustom] : [...DEFAULT_JORNADAS]; list[idx] = { ...list[idx], color: e.target.value }; updatePuesto(puestoId, { jornadasCustom: list }); }} />
                                        <input className="flex-1 h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-bold outline-none" value={j.nombre}
                                            onChange={e => { const list = jornadasCustom.length ? [...jornadasCustom] : [...DEFAULT_JORNADAS]; list[idx] = { ...list[idx], nombre: e.target.value }; updatePuesto(puestoId, { jornadasCustom: list }); }} />
                                        <input className="w-16 h-9 bg-white border border-slate-200 rounded-lg px-2 text-sm font-black outline-none text-center" value={j.short}
                                            onChange={e => { const list = jornadasCustom.length ? [...jornadasCustom] : [...DEFAULT_JORNADAS]; list[idx] = { ...list[idx], short: e.target.value }; updatePuesto(puestoId, { jornadasCustom: list }); }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Programación Recurrente */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-primary">repeat</span>Programación Recurrente</h3>
                            <p className="text-[11px] text-slate-500 mb-4">Guarda el mes actual como plantilla para replicar automáticamente en meses futuros.</p>
                            <button onClick={() => {
                                if (!prog) return;
                                updatePuesto(puestoId, { plantillaRecurrente: { activa: true, asignaciones: prog.asignaciones, personal: prog.personal, desdeAnio: anio, desMes: mes } });
                                showTacticalToast({
                                    title: 'Plantilla Guardada',
                                    message: 'Configuración guardada para recursividad mensual.',
                                    type: 'success'
                                });
                                logAction('PROGRAMACION', 'Plantilla recurrente guardada', `Puesto: ${puestoNombre} desde ${MONTH_NAMES[mes]} ${anio}`, 'info');
                            }} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-black text-[11px] uppercase hover:brightness-110 transition-all shadow-md shadow-primary/30">
                                <span className="material-symbols-outlined text-[16px]">save</span>Guardar como Plantilla Base
                            </button>
                            {puesto?.plantillaRecurrente?.activa && (
                                <p className="mt-3 text-[11px] text-success font-bold">✓ Plantilla activa desde {MONTH_NAMES[puesto?.plantillaRecurrente?.desMes || 0]} {puesto?.plantillaRecurrente?.desdeAnio}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit cell modal */}
            {editCell && (
                <EditCeldaModal
                    asig={editCell}
                    vigilantes={vigilantes.map(v => ({ id: v.id, nombre: v.nombre, estado: v.estado }))}
                    titularesId={prog!.personal.filter(p => !!p.vigilanteId).map(p => p.vigilanteId as string)}
                    ocupados={ocupados}
                    turnosConfig={turnosConfig}
                    jornadasCustom={jornadasCustom}
                    onSave={handleSaveCell}
                    onClose={() => setEditCell(null)}
                />
            )}

            {/* Tactical Justification Modal */}
            {showJustificacion && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in transition-all">
                    <div className="bg-white max-w-sm w-full rounded-[32px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.5)] border border-slate-100 animate-in slide-in-from-bottom-10 duration-500">
                        <div className="bg-primary p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 -mr-16 -mt-16 bg-white/10 rounded-full blur-3xl opacity-20" />
                            <div className="relative flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
                                    <span className="material-symbols-outlined text-2xl">swap_horiz</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Justificación</h3>
                                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Protocolo de Seguridad</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                                    Justifique el traslado de <span className="text-primary font-black">{showJustificacion.vigilante.nombre}</span> a un puesto fijo.
                                </p>
                            </div>

                            <div>
                                <textarea
                                    autoFocus
                                    value={justificacionText}
                                    onChange={e => setJustificacionText(e.target.value)}
                                    placeholder="Escriba el motivo aquí..."
                                    className="w-full h-24 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-primary/30 focus:bg-white transition-all resize-none shadow-sm"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowJustificacion(null);
                                        showTacticalToast({
                                            title: 'Operación Abortada',
                                            message: 'Se requiere justificación para asignar personal disponible.',
                                            type: 'info'
                                        });
                                    }}
                                    className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={!justificacionText.trim()}
                                    onClick={() => {
                                        const { per, newVigilanteId } = showJustificacion;
                                        const updated = prog!.personal.map(p => p.rol === per.rol ? { ...p, vigilanteId: newVigilanteId } : p);
                                        asignarPersonal(prog!.id, updated, username || 'Sistema');

                                        updateGuardStatus(newVigilanteId, 'activo', puestoId, `Asignado como TITULAR en ${puestoNombre}: ${justificacionText}`);

                                        logAction('PROGRAMACION', 'Personal actualizado', `Rol ${ROL_LABELS[per.rol as RolPuesto]}: ${newVigilanteId}`, 'info');

                                        showTacticalToast({
                                            title: 'Traslado Registrado',
                                            message: `${showJustificacion.vigilante.nombre} activado exitosamente.`,
                                            type: 'success'
                                        });

                                        setShowJustificacion(null);
                                    }}
                                    className="flex-[1.5] h-12 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-30 disabled:hover:scale-100 active:scale-95"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

const GestionPuestos = () => {
    const puestos = usePuestoStore(s => s.puestos);
    const programaciones = useProgramacionStore(s => s.programaciones);
    const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
    const getAlertas = useProgramacionStore(s => s.getAlertas);
    const crearOObtenerProgramacion = useProgramacionStore(s => s.crearOObtenerProgramacion);
    const { username } = useAuthStore();

    const now = new Date();
    const [anio, setAnio] = useState(now.getFullYear());
    const [mes, setMes] = useState(now.getMonth());
    const [filtroZona, setFiltroZona] = useState('todos');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [filtroCobertura, setFiltroCobertura] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [puestoSeleccionado, setPuestoSeleccionado] = useState<{ id: string; nombre: string } | null>(null);

    const puestosConProg = useMemo(() => {
        return puestos.map(p => {
            const prog = programaciones.find(pr => pr.puestoId === p.id && pr.anio === anio && pr.mes === mes);
            const cobertura = prog ? getCoberturaPorcentaje(prog.id) : 0;
            const alertas = prog ? getAlertas(prog.id) : [];
            return { ...p, cobertura, alertas, progEstado: prog?.estado ?? 'sin_programacion' };
        });
    }, [puestos, programaciones, anio, mes, getCoberturaPorcentaje, getAlertas]);

    const puestosFiltrados = useMemo(() => {
        return puestosConProg.filter(p => {
            if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
            if (filtroCobertura === 'completo' && p.cobertura < 80) return false;
            if (filtroCobertura === 'incompleto' && p.cobertura >= 80) return false;
            if (busqueda) {
                const q = busqueda.toLowerCase();
                if (!p.nombre.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [puestosConProg, filtroEstado, filtroCobertura, busqueda]);

    const statsGlobales = useMemo(() => ({
        total: puestos.length,
        publicados: puestosConProg.filter(p => p.progEstado === 'publicado').length,
        borradores: puestosConProg.filter(p => p.progEstado === 'borrador').length,
        sinProg: puestosConProg.filter(p => p.progEstado === 'sin_programacion').length,
        coberturaPromedio: puestosConProg.length > 0 ? Math.round(puestosConProg.reduce((a, p) => a + p.cobertura, 0) / puestosConProg.length) : 0,
    }), [puestos, puestosConProg]);

    if (puestoSeleccionado) {
        return (
            <PanelMensualPuesto
                puestoId={puestoSeleccionado.id}
                puestoNombre={puestoSeleccionado.nombre}
                anio={anio}
                mes={mes}
                onClose={() => setPuestoSeleccionado(null)}
            />
        );
    }

    return (
        <div className="page-container space-y-8 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Sistema</span>
                        <span className="material-symbols-outlined text-[14px] notranslate">chevron_right</span>
                        <span className="text-primary font-black">Puestos Activos</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        Programación <span className="text-primary">Puestos Activos</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Panel de control mensual · Gestión de personal élite</p>
                </div>

                {/* Month/Year selector */}
                <div className="flex items-center gap-3 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-2">Mes a programar:</span>
                    <select value={mes} onChange={e => setMes(Number(e.target.value))} className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none hover:border-primary/50 transition-all cursor-pointer">
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} className="h-10 w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none hover:border-primary/50 transition-all cursor-text" />
                </div>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Total Puestos', value: statsGlobales.total, icon: 'location_on', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Publicados', value: statsGlobales.publicados, icon: 'verified', color: 'text-success', bg: 'bg-success/10' },
                    { label: 'Borradores', value: statsGlobales.borradores, icon: 'edit_note', color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'Sin Programar', value: statsGlobales.sinProg, icon: 'schedule', color: 'text-danger', bg: 'bg-danger/10' },
                    { label: 'Cobertura Prom.', value: `${statsGlobales.coberturaPromedio}%`, icon: 'donut_large', color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
                        <div className={`${s.bg} size-10 rounded-2xl flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${s.color} notranslate`}>{s.icon}</span>
                        </div>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] notranslate">search</span>
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar puesto..."
                        className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-primary/50"
                    />
                </div>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none">
                    <option value="todos">Todos los estados</option>
                    <option value="cubierto">Cubierto</option>
                    <option value="alerta">En Alerta</option>
                    <option value="desprotegido">Desprotegido</option>
                </select>
                <select value={filtroCobertura} onChange={e => setFiltroCobertura(e.target.value)} className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none">
                    <option value="todos">Toda la cobertura</option>
                    <option value="completo">≥80% Completo</option>
                    <option value="incompleto">&lt;80% Incompleto</option>
                </select>
                <span className="text-[10px] font-bold text-slate-400">{puestosFiltrados.length} puestos</span>
            </div>

            {/* Puestos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {puestosFiltrados.map(p => (
                    <div
                        key={p.id}
                        className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                        onClick={() => setPuestoSeleccionado({ id: p.id, nombre: p.nombre })}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.id}</p>
                                <h3 className="text-base font-black text-slate-900 mt-0.5 group-hover:text-primary transition-colors">{p.nombre}</h3>
                            </div>
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${p.estado === 'cubierto' ? 'bg-success/10 text-success' : p.estado === 'alerta' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}>
                                {p.estado}
                            </span>
                        </div>

                        {/* Coverage bar */}
                        <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Programación {MONTH_NAMES[mes]}</span>
                                <span className={`text-[11px] font-black ${p.cobertura >= 80 ? 'text-success' : p.cobertura >= 50 ? 'text-warning' : 'text-danger'}`}>{p.cobertura}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${p.cobertura >= 80 ? 'bg-success' : p.cobertura >= 50 ? 'bg-warning' : 'bg-danger'}`}
                                    style={{ width: `${p.cobertura}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${p.progEstado === 'publicado' ? 'bg-success/10 text-success' : p.progEstado === 'borrador' ? 'bg-warning/10 text-warning' : 'bg-slate-100 text-slate-400'}`}>
                                {p.progEstado === 'publicado' ? '✓ Publicado' : p.progEstado === 'borrador' ? '✏️ Borrador' : 'Sin programar'}
                            </span>
                            {p.alertas.length > 0 && (
                                <span className="text-[10px] font-black text-danger flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    {p.alertas.length} alerta{p.alertas.length > 1 ? 's' : ''}
                                </span>
                            )}
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-[20px]">arrow_forward</span>
                        </div>
                    </div>
                ))}

                {puestosFiltrados.length === 0 && (
                    <div className="col-span-3 text-center py-20">
                        <span className="material-symbols-outlined text-6xl text-slate-200">location_off</span>
                        <p className="mt-4 text-[12px] font-black text-slate-400 uppercase tracking-widest">Sin puestos que coincidan con los filtros</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GestionPuestos;
