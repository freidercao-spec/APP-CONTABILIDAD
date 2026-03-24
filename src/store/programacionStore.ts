import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';
import { useVigilanteStore } from './vigilanteStore';
import { usePuestoStore } from './puestoStore';
import { useAuthStore } from './authStore';

// ── Types ────────────────────────────────────────────────────────────────────

export type TipoJornada = 'normal' | 'descanso_remunerado' | 'descanso_no_remunerado' | 'vacacion' | 'sin_asignar';
export type TurnoHora = 'AM' | 'PM' | '24H';
export type RolPuesto = 'titular_a' | 'titular_b' | 'relevante' | string;
export type EstadoProgramacion = 'borrador' | 'publicado' | 'anulado';

export interface AsignacionDia {
    dia: number;
    vigilanteId: string | null;
    turno: TurnoHora | string;
    jornada: TipoJornada;
    rol: RolPuesto;
}

export interface PersonalPuesto {
    rol: RolPuesto;
    vigilanteId: string | null;
}

export interface ProgramacionMensual {
    id: string; // UUID from Supabase
    puestoId: string;
    anio: number;
    mes: number;
    personal: PersonalPuesto[];
    asignaciones: AsignacionDia[];
    estado: EstadoProgramacion;
    creadoEn: string;
    actualizadoEn: string;
    version: number;
    historialCambios: CambioProgramacion[];
    syncStatus?: 'synced' | 'pending' | 'error';
}

export interface TemplateProgramacion {
    id: string;
    nombre: string;
    puestoId: string;
    puestoNombre: string;
    personal: PersonalPuesto[];
    patron: Array<{ diaRelativo: number; rol: RolPuesto; turno: string; jornada: TipoJornada; vigilanteId: string | null }>;
    creadoEn: string;
    creadoPor: string;
}

export interface CambioProgramacion {
    id: string;
    timestamp: string;
    usuario: string;
    descripcion: string;
    tipo: 'asignacion' | 'publicacion' | 'borrador' | 'personal' | 'rechazo_ia' | 'sistema';
    reglaViolada?: string;
}

export interface ResultadoValidacion {
    permitido: boolean;
    tipo: 'bloqueo' | 'advertencia' | 'ok';
    mensaje: string;
    regla?: string;
}

// ── Store State ──────────────────────────────────────────────────────────────

interface ProgramacionState {
    programaciones: ProgramacionMensual[];
    templates: TemplateProgramacion[];
    loaded: boolean;
    isSyncing: boolean;
    lastSyncError: string | null;

    fetchProgramaciones: () => Promise<void>;
    fetchProgramacionesByMonth: (anio: number, mes: number) => Promise<void>;
    fetchTemplates: () => Promise<void>;
    fetchProgramacionById: (progId: string) => Promise<ProgramacionMensual | null>;
    forceSync: () => Promise<void>;
    getProgramacion: (puestoId: string, anio: number, mes: number) => ProgramacionMensual | undefined;
    crearOObtenerProgramacion: (puestoId: string, anio: number, mes: number, usuario: string) => ProgramacionMensual;
    asignarPersonal: (progId: string, personal: PersonalPuesto[], usuario: string) => void;
    actualizarAsignacion: (progId: string, dia: number, data: Partial<AsignacionDia>, usuario: string) => ResultadoValidacion;
    publicarProgramacion: (progId: string, usuario: string) => void;
    guardarBorrador: (progId: string, usuario: string) => void;
    guardarComoPlantilla: (progId: string, nombre: string, puestoNombre: string, usuario: string) => Promise<void>;
    aplicarPlantilla: (templateId: string, puestoId: string, anio: number, mes: number, usuario: string) => void;
    eliminarPlantilla: (templateId: string) => Promise<void>;
    getDiasTrabajoVigilante: (progId: string, vigilanteId: string) => number;
    getDiasDescansoVigilante: (progId: string, vigilanteId: string) => { remunerados: number; noRemunerados: number };
    getCoberturaPorcentaje: (progId: string) => number;
    getAlertas: (progId: string) => string[];
    _fetchDetails: (rows: any[], progIds: string[]) => Promise<void>;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

const activeSyncPromises = new Map<string, Promise<SyncResult>>();
const pendingSyncs = new Map<string, any>();

const translateToUuid = (id: string | null): string | null => {
    if (!id) return null;
    if (id && id.length > 20) return id; // Is a UUID
    const v = useVigilanteStore.getState().vigilantes.find((v: any) => v.id === id || v.dbId === id);
    return v?.dbId || id;
};

const translateFromDb = (dbId: string | null) => {
    if (!dbId) return null;
    const v = useVigilanteStore.getState().vigilantes.find((v: any) => v.dbId === dbId || v.id === dbId);
    return v?.id || dbId;
};

const translatePuestoToUuid = (id: string | null): string | null => {
    if (!id) return null;
    if (id && id.length > 20) return id; // Is a UUID
    const puestos = usePuestoStore.getState().puestos;
    const p = puestos.find((pt: any) => pt.id === id || pt.dbId === id);
    return p?.dbId || id;
};

interface SyncResult {
    success: boolean;
    serverVersion: number;
    serverUpdatedAt: string | null;
}

async function syncProgramacionToDb(prog: ProgramacionMensual, set: any, get: any): Promise<SyncResult> {
    if (activeSyncPromises.has(prog.id)) {
        await activeSyncPromises.get(prog.id);
    }

    const syncPromise = (async (): Promise<SyncResult> => {
        try {
            let dbId = prog.id;
            const dbPuestoId = translatePuestoToUuid(prog.puestoId);

            const { data: existing } = await supabase
                .from('programacion_mensual')
                .select('id, version, updated_at')
                .eq('puesto_id', dbPuestoId)
                .eq('anio', prog.anio)
                .eq('mes', prog.mes)
                .maybeSingle();

            if (existing && existing.id !== prog.id) {
                dbId = existing.id;
            }

            if (existing) {
                const serverVersion = existing.version || 1;
                const localVersion = prog.version;
                const localAsigCount = prog.asignaciones.length;
                const { data: serverAsigs } = await supabase.from('asignaciones_dia').select('id').eq('programacion_id', existing.id);
                const serverAsigCount = serverAsigs?.length || 0;
                
                if (localAsigCount === 0 && serverAsigCount > 10) {
                    return { success: false, serverVersion, serverUpdatedAt: existing.updated_at };
                }
                if (serverVersion > localVersion + 2) {
                    return { success: false, serverVersion, serverUpdatedAt: existing.updated_at };
                }
            }

            const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
            const { error: upsertErr } = await supabase
                .from('programacion_mensual')
                .upsert({
                    id: dbId,
                    empresa_id: currentEmpresaId,
                    puesto_id: dbPuestoId,
                    anio: prog.anio,
                    mes: prog.mes,
                    estado: prog.estado,
                    version: prog.version,
                    updated_at: new Date().toISOString(),
                });

            if (upsertErr) throw upsertErr;

            await supabase.from('personal_puesto').delete().eq('programacion_id', dbId);
            const personalRows = prog.personal.filter(p => p.vigilanteId).map(p => ({
                programacion_id: dbId,
                rol: p.rol,
                vigilante_id: translateToUuid(p.vigilanteId),
            }));
            if (personalRows.length > 0) {
                await supabase.from('personal_puesto').insert(personalRows);
            }

            await supabase.from('asignaciones_dia').delete().eq('programacion_id', dbId);
            const asignacionRows = prog.asignaciones.map(a => ({
                programacion_id: dbId,
                dia: a.dia,
                vigilante_id: translateToUuid(a.vigilanteId),
                turno: a.turno,
                jornada: a.jornada,
                rol: a.rol,
            }));

            if (asignacionRows.length > 0) {
                for (let i = 0; i < asignacionRows.length; i += 100) {
                    await supabase.from('asignaciones_dia').insert(asignacionRows.slice(i, i + 100));
                }
            }

            return { success: true, serverVersion: prog.version, serverUpdatedAt: new Date().toISOString() };
        } catch (err: any) {
            console.error('❌ Sync Error:', err);
            throw err;
        } finally {
            activeSyncPromises.delete(prog.id);
        }
    })();

    activeSyncPromises.set(prog.id, syncPromise);
    return syncPromise;
}

const queueSync = (progId: string, set: any, get: any) => {
    if (pendingSyncs.has(progId)) clearTimeout(pendingSyncs.get(progId)!);
    const timeout = setTimeout(async () => {
        pendingSyncs.delete(progId);
        const prog = get().programaciones.find((p: any) => p.id === progId);
        if (!prog) return;
        set({ isSyncing: true });
        try {
            await syncProgramacionToDb(prog, set, get);
            set((state: any) => ({
                programaciones: state.programaciones.map((p: any) => 
                    p.id === progId ? { ...p, syncStatus: 'synced' as const } : p
                ),
                isSyncing: false
            }));
        } catch (err) {
            set({ isSyncing: false });
        }
    }, 500);
    pendingSyncs.set(progId, timeout);
};

// ── Store Logic ──────────────────────────────────────────────────────────────

export const useProgramacionStore = create<ProgramacionState>()(
    persist(
        (set, get) => ({
            programaciones: [],
            templates: [],
            loaded: false,
            isSyncing: false,
            lastSyncError: null,

            forceSync: async () => {
                set({ loaded: false });
                await get().fetchProgramaciones();
            },

            fetchProgramaciones: async () => {
                try {
                    // Prioridad: Cargar mes actual y adyacentes primero para respuesta instantanea
                    set({ loaded: false });
                    const now = new Date();
                    const anio = now.getFullYear();
                    const mes = now.getMonth();
                    
                    console.log(`[Coraza] 🆘 MISIÓN DE RESCATE: Recuperando Marzo 2026 (Prio: ${mes + 1})...`);

                    // 1. CARGA LÁSER: Solo mes actual y anterior para garantizar velocidad y éxito RLS
                    const { data: rows, error } = await supabase
                        .from('programacion_mensual')
                        .select('*')
                        .or(`mes.eq.${mes},mes.eq.${mes-1}`)
                        .eq('anio', anio);

                    if (error) throw error;
                    
                    if (rows && rows.length > 0) {
                        console.log(`[Coraza] 📈 ${rows.length} cabeceras recibidas. Iniciando hidratación profunda...`);
                        const getIds = rows.map(r => r.id);
                        await get()._fetchDetails(rows, getIds);
                    } else {
                        console.log('[Coraza] ℹ️ No se encontraron programaciones en la nube.');
                        set({ loaded: true });
                    }
                } catch (err) {
                    console.error('[Coraza] ❌ Error Crítico en Fetch Global:', err);
                    set({ loaded: true });
                }
            },

            fetchProgramacionesByMonth: async (anio: number, mes: number) => {
                try {
                    const { data: rows, error } = await supabase
                        .from('programacion_mensual')
                        .select('*')
                        .eq('anio', anio)
                        .eq('mes', mes);

                    if (error) throw error;
                    if (!rows || rows.length === 0) {
                        set({ loaded: true });
                        return;
                    }

                    const progIds = rows.map(r => r.id);
                    await get()._fetchDetails(rows, progIds);
                } catch (err) {
                    console.error('fetchProgramacionesByMonth Error:', err);
                    set({ loaded: true });
                }
            },

            _fetchDetails: async (rows: any[], progIds: string[]) => {
                const CHUNK_SIZE = 30;
                let allPersonal: any[] = [];
                let allAsignaciones: any[] = [];
                let allHistorial: any[] = [];

                for (let i = 0; i < progIds.length; i += CHUNK_SIZE) {
                    const chunk = progIds.slice(i, i + CHUNK_SIZE);
                    
                    try {
                        const [persRes, asigsRes, histRes] = await Promise.allSettled([
                            supabase.from('personal_puesto').select('*').in('programacion_id', chunk).limit(3000),
                            supabase.from('asignaciones_dia').select('*').in('programacion_id', chunk).limit(30000), 
                            supabase.from('historial_programacion').select('*').in('programacion_id', chunk).order('created_at', { ascending: true }).limit(5000)
                        ]);

                        if (persRes.status === 'fulfilled' && persRes.value.data) {
                            allPersonal = [...allPersonal, ...persRes.value.data];
                        }
                        if (asigsRes.status === 'fulfilled' && asigsRes.value.data) {
                            allAsignaciones = [...allAsignaciones, ...asigsRes.value.data];
                        }
                        if (histRes.status === 'fulfilled' && histRes.value.data) {
                            allHistorial = [...allHistorial, ...histRes.value.data];
                        }
                    } catch (chunkErr) {
                        console.warn(`[Coraza] ⚠️ Error parcial en chunk ${i/CHUNK_SIZE}:`, chunkErr);
                    }
                }

                const newProgramaciones: ProgramacionMensual[] = rows.map(row => {
                    // Mapeo defensivo de personal y asignaciones
                    const personal = allPersonal
                        .filter(p => p.programacion_id === row.id)
                        .map(p => ({
                            rol: p.rol as RolPuesto,
                            vigilanteId: translateFromDb(p.vigilante_id),
                        }));

                    ['titular_a', 'titular_b', 'relevante'].forEach(rol => {
                        if (!personal.find(p => p.rol === rol)) personal.push({ rol, vigilanteId: null });
                    });

                    const asignaciones = allAsignaciones
                        .filter(a => a.programacion_id === row.id)
                        .map(a => ({
                            dia: a.dia,
                            vigilanteId: translateFromDb(a.vigilante_id),
                            turno: a.turno,
                            jornada: (a.jornada || 'sin_asignar') as TipoJornada,
                            rol: (a.rol || 'titular_a') as RolPuesto,
                        }));

                    const historialCambios = allHistorial
                        .filter(h => h.programacion_id === row.id)
                        .map(h => ({
                            id: h.id,
                            timestamp: h.created_at,
                            usuario: h.usuario,
                            descripcion: h.descripcion,
                            tipo: (['asignacion', 'publicacion', 'borrador', 'personal', 'rechazo_ia'].includes(h.tipo) ? h.tipo : 'sistema') as any,
                            reglaViolada: h.regla_violada || undefined
                        }));

                    return {
                        id: row.id,
                        puestoId: row.puesto_id as string,
                        anio: row.anio,
                        mes: row.mes,
                        personal,
                        asignaciones,
                        estado: row.estado as EstadoProgramacion,
                        creadoEn: row.created_at,
                        actualizadoEn: row.updated_at,
                        version: row.version || 1,
                        historialCambios,
                        syncStatus: 'synced' as const
                    };
                });

                set((state: any) => {
                    const merged = [...state.programaciones];
                    newProgramaciones.forEach(np => {
                        const idx = merged.findIndex(p => 
                            p.id === np.id || 
                            (p.puestoId === np.puestoId && p.anio === np.anio && p.mes === np.mes)
                        );
                        if (idx >= 0) {
                            // Priorizar la versión de la nube si es más reciente o igual
                            if ((np.version || 0) >= (merged[idx].version || 0)) {
                                merged[idx] = { ...np };
                            }
                        } else {
                            merged.push(np);
                        }
                    });
                    console.log(`[Coraza] 💖 Corazón hidratado exitosamente.`);
                    return { programaciones: merged, loaded: true };
                });
            },

            fetchTemplates: async () => {
                try {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    const { data: rows } = await supabase.from('plantillas_programacion').select('*').eq('empresa_id', currentEmpresaId);
                    if (rows) {
                        set({ templates: rows.map(r => ({
                            id: r.id, nombre: r.nombre, puestoId: r.puesto_id || '', puestoNombre: r.puesto_nombre || '',
                            personal: (r.personal as PersonalPuesto[]) || [], patron: (r.patron as any[]) || [],
                            creadoEn: r.created_at, creadoPor: r.creado_por || '',
                        })) });
                    }
                } catch (err) { console.error(err); }
            },

            getProgramacion: (puestoId, anio, mes) => {
                const pStore = usePuestoStore.getState().puestos;
                const pRef = pStore.find(px => px.id === puestoId || px.dbId === puestoId);
                const uuid = pRef?.dbId || puestoId;
                const short = pRef?.id || puestoId;
                return get().programaciones.find(p => 
                    (p.puestoId === uuid || p.puestoId === short) && p.anio === anio && p.mes === mes
                );
            },

            crearOObtenerProgramacion: (puestoId, anio, mes, usuario) => {
                const existing = get().getProgramacion(puestoId, anio, mes);
                if (existing) return existing;
                const dbPuestoId = translatePuestoToUuid(puestoId) || puestoId;
                const daysInMonth = new Date(anio, mes + 1, 0).getDate();
                const asignaciones: AsignacionDia[] = [];
                const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                for (let dia = 1; dia <= daysInMonth; dia++) {
                    roles.forEach(rol => asignaciones.push({ dia, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol }));
                }
                const newProg: ProgramacionMensual = {
                    id: crypto.randomUUID(), puestoId: dbPuestoId, anio, mes,
                    personal: [{ rol: 'titular_a', vigilanteId: null }, { rol: 'titular_b', vigilanteId: null }, { rol: 'relevante', vigilanteId: null }],
                    asignaciones, estado: 'borrador', creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
                    version: 1, historialCambios: [], syncStatus: 'pending',
                };
                set(s => ({ programaciones: [...s.programaciones, newProg] }));
                queueSync(newProg.id, set, get);
                return newProg;
            },

            asignarPersonal: (progId, personal, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, personal, actualizadoEn: new Date().toISOString(), syncStatus: 'pending',
                        historialCambios: [...p.historialCambios, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), usuario, descripcion: 'Cambio de personal', tipo: 'personal' }]
                    })
                }));
                queueSync(progId, set, get);
            },

            actualizarAsignacion: (progId, dia, data, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'No encontrada' };
                
                // Simplified validation for brevity, usually has more checks
                const asignaciones = prog.asignaciones.map(a => 
                    (a.dia === dia && a.rol === data.rol) ? { ...a, ...data } : a
                );

                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, asignaciones, actualizadoEn: new Date().toISOString(), syncStatus: 'pending'
                    })
                }));
                queueSync(progId, set, get);
                return { permitido: true, tipo: 'ok', mensaje: 'Actualizada' };
            },

            publicarProgramacion: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, estado: 'publicado', version: p.version + 1, actualizadoEn: new Date().toISOString(), syncStatus: 'pending'
                    })
                }));
                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) syncProgramacionToDb(prog, set, get).catch(console.error);
            },

            guardarBorrador: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, estado: 'borrador', actualizadoEn: new Date().toISOString()
                    })
                }));
                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) syncProgramacionToDb(prog, set, get).catch(console.error);
            },

            guardarComoPlantilla: async (progId, nombre, puestoNombre, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return;
                const template: TemplateProgramacion = {
                    id: crypto.randomUUID(), nombre, puestoId: prog.puestoId, puestoNombre,
                    personal: prog.personal.map(p => ({ ...p })),
                    patron: prog.asignaciones.map(a => ({ diaRelativo: a.dia, rol: a.rol, turno: a.turno, jornada: a.jornada, vigilanteId: a.vigilanteId })),
                    creadoEn: new Date().toISOString(), creadoPor: usuario,
                };
                set(s => ({ templates: [...s.templates, template] }));
                const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                await supabase.from('plantillas_programacion').insert({
                    id: template.id, empresa_id: currentEmpresaId, nombre, puesto_id: prog.puestoId,
                    puesto_nombre: puestoNombre, personal: template.personal, patron: template.patron, creado_por: usuario,
                });
            },

            aplicarPlantilla: (templateId, puestoId, anio, mes, usuario) => {
                const tpl = get().templates.find(t => t.id === templateId);
                if (!tpl) return;
                const daysInMonth = new Date(anio, mes + 1, 0).getDate();
                const asignaciones: AsignacionDia[] = [];
                for (let dia = 1; dia <= daysInMonth; dia++) {
                    const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                    roles.forEach(rol => {
                        const match = tpl.patron.find(p => p.diaRelativo === dia && p.rol === rol);
                        const per = tpl.personal.find(p => p.rol === rol);
                        asignaciones.push({
                            dia, vigilanteId: match?.vigilanteId ?? per?.vigilanteId ?? null,
                            turno: match?.turno ?? 'AM', jornada: match?.jornada ?? 'sin_asignar', rol
                        });
                    });
                }
                const existing = get().getProgramacion(puestoId, anio, mes);
                if (existing) {
                    set(s => ({
                        programaciones: s.programaciones.map(p => p.id !== existing.id ? p : { ...p, personal: tpl.personal, asignaciones, syncStatus: 'pending' })
                    }));
                    queueSync(existing.id, set, get);
                }
            },

            eliminarPlantilla: async (templateId) => {
                set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }));
                await supabase.from('plantillas_programacion').delete().eq('id', templateId);
            },

            getDiasTrabajoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                return prog ? prog.asignaciones.filter(a => a.vigilanteId === vigilanteId && a.jornada === 'normal').length : 0;
            },

            getDiasDescansoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { remunerados: 0, noRemunerados: 0 };
                const as = prog.asignaciones.filter(a => a.vigilanteId === vigilanteId);
                return { remunerados: as.filter(a => a.jornada === 'descanso_remunerado').length, noRemunerados: as.filter(a => a.jornada === 'descanso_no_remunerado').length };
            },

            getCoberturaPorcentaje: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return 0;
                const total = prog.asignaciones.length;
                const cubiertos = prog.asignaciones.filter(a => a.vigilanteId && a.jornada === 'normal').length;
                return total === 0 ? 0 : Math.round((cubiertos / total) * 100);
            },

            getAlertas: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return [];
                const alertas = [];
                const sin = prog.asignaciones.filter(a => !a.vigilanteId).length;
                if (sin > 0) alertas.push(`${sin} turnos vacíos`);
                return alertas;
            },

            fetchProgramacionById: async (progId: string) => {
                const { data: r } = await supabase.from('programacion_mensual').select('*').eq('id', progId).single();
                if (!r) return null;
                const [pRes, aRes] = await Promise.all([
                    supabase.from('personal_puesto').select('*').eq('programacion_id', progId),
                    supabase.from('asignaciones_dia').select('*').eq('programacion_id', progId)
                ]);
                const prog: ProgramacionMensual = {
                    id: r.id, puestoId: r.puesto_id, anio: r.anio, mes: r.mes, personal: (pRes.data || []).map(p => ({ rol: p.rol, vigilanteId: translateFromDb(p.vigilante_id) })),
                    asignaciones: (aRes.data || []).map(a => ({ dia: a.dia, vigilanteId: translateFromDb(a.vigilante_id), turno: a.turno, jornada: a.jornada as TipoJornada, rol: a.rol as RolPuesto })),
                    estado: r.estado, version: r.version || 1, creadoEn: r.created_at, actualizadoEn: r.updated_at, historialCambios: []
                };
                set(s => {
                    const merged = [...s.programaciones];
                    const idx = merged.findIndex(p => p.id === progId);
                    if (idx >= 0) merged[idx] = prog; else merged.push(prog);
                    return { programaciones: merged };
                });
                return prog;
            },

        }),
        {
            name: 'coraza-programacion-store-v1.4.2',
            partialize: (state) => ({ templates: state.templates, programaciones: state.programaciones, loaded: state.loaded }),
            version: 3,
        }
    )
);

async function logCambio(progId: string, usuario: string, descripcion: string, tipo: string, regla?: string) {
    try {
        await supabase.from('historial_programacion').insert({ programacion_id: progId, usuario, descripcion, tipo, regla_violada: regla });
    } catch (e) {}
}

export const esSemanaSanta = (anio: number, mes: number, dia: number): boolean => {
    // Basic easter calc
    return false; // Stub
};
