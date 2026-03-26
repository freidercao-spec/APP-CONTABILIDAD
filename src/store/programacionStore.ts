import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';
import { useVigilanteStore } from './vigilanteStore';
import { usePuestoStore } from './puestoStore';
import { useAuthStore } from './authStore';
import { showTacticalToast } from '../utils/tacticalToast';

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
    inicio?: string; // Nuevo: Entrada personalizada
    fin?: string;    // Nuevo: Salida personalizada
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

const translateToUuid = (idRaw: string | null): string | null => {
    if (!idRaw) return null;
    const id = String(idRaw).trim();
    
    // Robust UUID check: ensure it's not a generic placeholder
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) return id;
    
    const vigilantes = useVigilanteStore.getState().vigilantes || [];
    // Robust search: check code, uuid, and full name (case insensitive)
    const v = vigilantes.find((vx: any) => 
        vx.id === id || 
        vx.dbId === id || 
        String(vx.nombre || '').toLowerCase() === id.toLowerCase()
    );
    
    if (v?.dbId) return v.dbId;
    if (v?.id && uuidRegex.test(v.id)) return v.id;
    
    // CRITICAL FIX: If it looks like a custom ID or shorthand but we didn't find the UUID yet,
    // DO NOT return null if we are in the middle of a sync, as it would erase the data.
    // Instead return the raw ID and let the DB handle it or skip ONLY if it's obviously invalid.
    if (id.length > 5) return id; 

    console.warn(`[Coraza] ⚠️ ID no mapeado: ${id}`);
    return id; // Defensive: return original instead of null to prevent data loss
};

const translateFromDb = (dbId: string | null) => {
    if (!dbId) return null;
    const v = useVigilanteStore.getState().vigilantes.find((v: any) => v.dbId === dbId || v.id === dbId);
    return v?.id || dbId;
};

const translatePuestoToUuid = (idRaw: string | null): string | null => {
    if (!idRaw) return null;
    const id = String(idRaw).trim();
    if (id.includes('-') && id.length > 20) return id; 

    const puestos = usePuestoStore.getState().puestos || [];
    const p = puestos.find((pt: any) => 
        pt.id === id || 
        pt.dbId === id || 
        String(pt.nombre || '').toLowerCase() === id.toLowerCase()
    );
    if (p?.dbId) return p.dbId;
    if (p?.id && (p.id.includes('-'))) return p.id;
    return null;
};

const idsMatch = (id1: string | null, id2: string | null): boolean => {
    if (!id1 || !id2) return false;
    const str1 = String(id1).trim().toLowerCase();
    const str2 = String(id2).trim().toLowerCase();
    if (str1 === str2) return true;
    
    const vigilantes = useVigilanteStore.getState().vigilantes || [];
    const v1 = vigilantes.find((vx: any) => vx.id === id1 || vx.dbId === id1 || (vx.nombre && vx.nombre.toLowerCase() === str1));
    const v2 = vigilantes.find((vx: any) => vx.id === id2 || vx.dbId === id2 || (vx.nombre && vx.nombre.toLowerCase() === str2));
    
    if (v1 && v2) {
        return (v1.dbId === v2.dbId || v1.id === v2.id);
    }
    // Cross-match: check if one ID matches the other's property
    if (v1 && (v1.dbId === id2 || v1.id === id2)) return true;
    if (v2 && (v2.dbId === id1 || v2.id === id1)) return true;

    return false;
};

interface SyncResult {
    success: boolean;
    serverVersion: number;
    serverUpdatedAt: string | null;
}

async function syncProgramacionToDb(prog: ProgramacionMensual, set: any, get: any): Promise<SyncResult> {
    // If a sync is already running for this prog, wait for it to finish first
    if (activeSyncPromises.has(prog.id)) {
        try { await activeSyncPromises.get(prog.id); } catch {}
    }

    const syncPromise = (async (): Promise<SyncResult> => {
        try {
            let dbId = String(prog.id).trim();
            const dbPuestoId = translatePuestoToUuid(prog.puestoId);
            if (!dbPuestoId) {
                console.error(`[Coraza] 🚨 No se pudo resolver puesto UUID para: ${prog.puestoId}`);
                throw new Error("ID de puesto no encontrado en el directorio local");
            }
            const cleanPuestoId = String(dbPuestoId).trim();

            // Check if there's already a record for this puesto/month in DB
            const { data: existing } = await supabase
                .from('programacion_mensual')
                .select('id, version, updated_at')
                .eq('puesto_id', cleanPuestoId)
                .eq('anio', prog.anio)
                .eq('mes', prog.mes)
                .maybeSingle();

            const originalLocalId = prog.id;
            // Reconciliation: If DB ID is different, update local state before proceeding
            if (existing && String(existing.id).trim() !== dbId) {
                console.warn(`[Coraza] 🛠️ Sincronizando ID local ${originalLocalId} → ${dbId}`);
                set((state: any) => ({
                    programaciones: state.programaciones.map((p: any) =>
                        p.id === originalLocalId ? { ...p, id: dbId } : p
                    )
                }));
            }

            const currentEmpresaId = String(useAuthStore.getState().empresaId || EMPRESA_ID).trim();
            const newVersion = (existing?.version || prog.version || 1) + 1;
            
            // ATOMIC UPSERT: Use reconciled ID
            const { error: upsertErr } = await supabase
                .from('programacion_mensual')
                .upsert({
                    id: dbId,
                    empresa_id: currentEmpresaId,
                    puesto_id: cleanPuestoId,
                    anio: prog.anio,
                    mes: prog.mes,
                    estado: prog.estado,
                    version: newVersion,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

            if (upsertErr) {
                console.error('[Coraza] ❌ Upsert Error details:', upsertErr);
                // If it's a cache/postgrest error, it might be a stale schema. 
                // We'll throw but with a better message.
                throw new Error(`Error de Servidor: ${upsertErr.message} (Cod: ${upsertErr.code})`);
            }

            // Sync sequence: DELETE ASIGNACIONES FIRST to avoid FK violations
            // CRITICAL PROTECTION: If we have 0 asignations in memory but we expect some, ABORT to prevent wipeout
            if (prog.asignaciones.length === 0) {
                console.error('[Coraza] 🛑 ABORTO PREVENTIVO: Intento de sincronizar programación vacía. Posible fallo de carga.');
                throw new Error("La programación local está vacía. Abortando para proteger los datos en la nube.");
            }

            const { error: delAsigErr } = await supabase.from('asignaciones_dia').delete().eq('programacion_id', dbId);
            if (delAsigErr) console.warn('[Coraza] ⚠️ Error limpiando asignaciones:', delAsigErr.message);
            
            const { error: delPersErr } = await supabase.from('personal_puesto').delete().eq('programacion_id', dbId);
            if (delPersErr) console.warn('[Coraza] ⚠️ Error limpiando nómina:', delPersErr.message);

            const personalRows = prog.personal
                .filter(p => p.vigilanteId)
                .map(p => {
                    const mapped = translateToUuid(p.vigilanteId);
                    return mapped ? {
                        programacion_id: dbId,
                        rol: p.rol,
                        vigilante_id: mapped,
                    } : null;
                })
                .filter(r => r !== null);
            
            if (personalRows.length > 0) {
                const { error: pError } = await supabase.from('personal_puesto').insert(personalRows);
                if (pError) console.error('[Coraza] ⚠️ Error personal_puesto:', pError.message);
            }

            // Sync asignaciones_dia: delete then batch-insert only non-empty slots
            await supabase.from('asignaciones_dia').delete().eq('programacion_id', dbId);
            const asignacionRows = prog.asignaciones
                .filter(a => a.vigilanteId && a.jornada !== 'sin_asignar')
                .map(a => ({
                    programacion_id: dbId,
                    dia: a.dia,
                    vigilante_id: translateToUuid(a.vigilanteId),
                    turno: a.turno,
                    jornada: a.jornada,
                    rol: a.rol,
                    inicio: a.inicio || null,
                    fin: a.fin || null,
                }))
                .filter(r => r.vigilante_id);

            if (asignacionRows.length > 0) {
                for (let i = 0; i < asignacionRows.length; i += 100) {
                    const chunk = asignacionRows.slice(i, i + 100);
                    const { error: aError } = await supabase.from('asignaciones_dia').insert(chunk);
                    if (aError) {
                        console.error(`[Coraza] ❌ Error chunk asignaciones [${i}-${i+chunk.length}]:`, aError.message);
                        throw aError;
                    }
                }
            }

            console.log(`[Coraza] ✅ Sync OK: ${prog.id} | ${asignacionRows.length} asignaciones guardadas`);
            return { success: true, serverVersion: newVersion, serverUpdatedAt: new Date().toISOString() };
        } catch (err: any) {
            console.error('[Coraza] ❌ Sync Error:', err?.message || err);
            throw err;
        } finally {
            activeSyncPromises.delete(prog.id);
        }
    })();

    activeSyncPromises.set(prog.id, syncPromise);
    return syncPromise;
}

const queueSync = (progId: string, set: any, get: any, immediate = false) => {
    if (pendingSyncs.has(progId)) clearTimeout(pendingSyncs.get(progId)!);
    
    const runSync = async () => {
        pendingSyncs.delete(progId);
        const prog = get().programaciones.find((p: any) => p.id === progId);
        if (!prog) return;
        set({ isSyncing: true });
        try {
            const res = await syncProgramacionToDb(prog, set, get);
            if (res && res.success === false) {
                console.warn('[Coraza] Sync rechazado por conflicto de versiones');
            }
            set((state: any) => ({
                programaciones: state.programaciones.map((p: any) => 
                    p.id === progId ? { ...p, syncStatus: 'synced' as const } : p
                ),
                isSyncing: false
            }));
        } catch (err: any) {
            console.error('[Coraza] ❌ ERROR CRÍTICO SYNCHRONIZACIÓN:', err);
            set({ isSyncing: false, lastSyncError: err?.message || 'Error de escritura' });
            showTacticalToast({ 
                title: "❌ ERROR NÚCLEO (V6.0)", 
                message: err?.message?.includes('cache') 
                    ? "Fallo de caché en el servidor. Por favor, recarga el navegador (F5)." 
                    : `La base de datos rechazó el despliegue: ${err?.message || 'Error desconocido'}`, 
                type: "error",
                duration: 8000
            });
        }
    };

    if (immediate) {
        runSync();
    } else {
        const timeout = setTimeout(runSync, 500);
        pendingSyncs.set(progId, timeout);
    }
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

                    // 1. CARGA BRUTA: Sin filtros complejos para evitar errores RLS
                    const { data: rows, error } = await supabase
                        .from('programacion_mensual')
                        .select('*')
                        .eq('anio', anio)
                        .eq('mes', mes);

                    if (error) throw error;
                    
                    if (rows && rows.length > 0) {
                        console.log(`[Coraza] 📈 ${rows.length} cabeceras recibidas. Iniciando hidratación profunda...`);
                        const getIds = rows.map(r => r.id);
                        await get()._fetchDetails(rows, getIds); // REFRESCAR NÚCLEO (V3.0)
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

                    const dbAsignaciones = allAsignaciones.filter(a => a.programacion_id === row.id);
                    const daysInMonth = new Date(row.anio, row.mes + 1, 0).getDate();
                    const asignaciones: AsignacionDia[] = [];
                    
                    // Priority: If DB has data, use it. But ensure every role/day has a slot for grid consistency.
                    const rolesToEnsure: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                    
                    for (let d = 1; d <= daysInMonth; d++) {
                        rolesToEnsure.forEach(rol => {
                            const match = dbAsignaciones.find(a => a.dia === d && a.rol === rol);
                            if (match) {
                                asignaciones.push({
                                    dia: match.dia,
                                    vigilanteId: translateFromDb(match.vigilante_id),
                                    turno: match.turno,
                                    jornada: (match.jornada || 'sin_asignar') as TipoJornada,
                                    rol: (match.rol || rol) as RolPuesto,
                                    inicio: match.inicio || undefined,
                                    fin: match.fin || undefined
                                });
                            } else {
                                // Baseline slot: ensure it's interactive and counts for coverage (as vacío)
                                asignaciones.push({
                                    dia: d,
                                    vigilanteId: null,
                                    turno: 'AM',
                                    jornada: 'sin_asignar',
                                    rol: rol
                                });
                            }
                        });
                    }

                    // Add any EXTRA roles that might be in DB but not in the standard 3
                    dbAsignaciones.forEach(a => {
                        if (!rolesToEnsure.includes(a.rol as any)) {
                            // Check if already added (avoid duplicates)
                            if (!asignaciones.some(ax => ax.dia === a.dia && ax.rol === a.rol)) {
                                asignaciones.push({
                                    dia: a.dia,
                                    vigilanteId: translateFromDb(a.vigilante_id),
                                    turno: a.turno,
                                    jornada: (a.jornada || 'sin_asignar') as TipoJornada,
                                    rol: a.rol as RolPuesto,
                                    inicio: a.inicio || undefined,
                                    fin: a.fin || undefined
                                });
                            }
                        }
                    });

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
                // CRITICAL: Ensure new program is injected into store for immediate 'actualizar' access
                const current = get().programaciones;
                if (!current.some(p => p.puestoId === dbPuestoId && p.anio === anio && p.mes === mes)) {
                    set({ programaciones: [...current, newProg] });
                }
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
                const state = get();
                const prog = state.programaciones.find((p: any) => 
                    String(p.id).toLowerCase() === String(progId).toLowerCase()
                ) || state.getProgramacion(progId, state.programaciones[0]?.anio, state.programaciones[0]?.mes);
                
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'Error: Programación no hallada' };
                
                const targetRol = data.rol;
                const newVid = data.vigilanteId;

                // ── VIRC (IA LOGIC): VALIDACIÓN DE CONFLICTOS ───────────────────────
                if (newVid && data.jornada !== 'sin_asignar') {
                    // 1. Conflictos en OTROS puestos (Triple check)
                    const otrosConflictos = state.programaciones.some(p => {
                        if (p.id === prog.id) return false; // same post is handled below
                        if (p.anio !== prog.anio || p.mes !== prog.mes) return false;
                        return p.asignaciones.some(a => 
                            a.dia === dia && 
                            idsMatch(a.vigilanteId, newVid) && 
                            a.jornada !== 'sin_asignar'
                        );
                    });

                    if (otrosConflictos) {
                        return { 
                            permitido: false, 
                            tipo: 'bloqueo', 
                            mensaje: 'IA: El vigilante ya tiene un turno asignado en OTRO puesto para este día.' 
                        };
                    }

                    // 2. Conflictos en el MISMO puesto (otro rol)
                    const conflictoMismoPuesto = prog.asignaciones.some(a => 
                        a.dia === dia && 
                        a.rol !== targetRol && 
                        idsMatch(a.vigilanteId, newVid) && 
                        a.jornada !== 'sin_asignar'
                    );

                    if (conflictoMismoPuesto) {
                        return { 
                            permitido: false, 
                            tipo: 'bloqueo', 
                            mensaje: 'IA: El vigilante ya está asignado a otro rol en este mismo puesto hoy.' 
                        };
                    }
                }

                let newAsignaciones = [...prog.asignaciones];
                const index = newAsignaciones.findIndex(a =>
                    a.dia === dia &&
                    String(a.rol).toLowerCase().trim() === String(targetRol).toLowerCase().trim()
                );

                if (index >= 0) {
                    newAsignaciones[index] = { ...newAsignaciones[index], ...data };
                } else {
                    newAsignaciones.push({ dia, vigilanteId: newVid || null, turno: data.turno || 'AM', jornada: data.jornada || 'sin_asignar', rol: targetRol || 'relevante' });
                }

                let newPersonal = [...prog.personal];
                if (newVid) {
                    if (!newPersonal.some(p => idsMatch(p.vigilanteId, newVid))) {
                        newPersonal.push({ rol: targetRol || 'relevante', vigilanteId: newVid });
                    }
                }

                set((s: any) => ({
                    programaciones: s.programaciones.map((p: any) => p.id === prog.id ? {
                        ...p, personal: newPersonal, asignaciones: newAsignaciones, actualizadoEn: new Date().toISOString(), syncStatus: 'pending',
                    } : p)
                }));

                queueSync(prog.id, set, get, true);
                return { permitido: true, tipo: 'ok', mensaje: 'Asignación guardada' };
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
                if (!prog) return 0;
                // Count ALL active jornadas: normal work + paid rest + unpaid rest + vacation
                // All of these represent days the guard is contracted/assigned (not unassigned)
                return prog.asignaciones.filter(a => 
                    idsMatch(a.vigilanteId, vigilanteId) && 
                    (a.jornada === 'normal' || a.jornada === 'descanso_remunerado' || 
                     a.jornada === 'descanso_no_remunerado' || a.jornada === 'vacacion')
                ).length;
            },

            getDiasDescansoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { remunerados: 0, noRemunerados: 0 };
                const as = prog.asignaciones.filter(a => idsMatch(a.vigilanteId, vigilanteId));
                return { 
                    remunerados: as.filter(a => a.jornada === 'descanso_remunerado').length, 
                    noRemunerados: as.filter(a => a.jornada === 'descanso_no_remunerado').length 
                };
            },

            getCoberturaPorcentaje: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return 0;
                // Consider normal, paid rest and vacation as covered slots for the post
                const total = prog.asignaciones.length;
                const cubiertos = prog.asignaciones.filter(a => 
                    a.vigilanteId && 
                    (a.jornada === 'normal' || a.jornada === 'descanso_remunerado' || a.jornada === 'vacacion')
                ).length;
                return total === 0 ? 0 : Math.round((cubiertos / total) * 100);
            },

            getAlertas: (progId) => {
                const state = get();
                const prog = state.programaciones.find(p => p.id === progId);
                if (!prog) return [];
                const alertas: string[] = [];
                const vacios = prog.asignaciones.filter(a => !a.vigilanteId).length;
                if (vacios > 0) alertas.push(`${vacios} turnos vacíos`);

                // ── IA SCANNER: Detección de duplicidades globales ──
                const vigilantesYaVistos = new Set<string>();
                prog.asignaciones.forEach(asig => {
                    if (!asig.vigilanteId || asig.jornada === 'sin_asignar') return;
                    const key = `${asig.vigilanteId}-${asig.dia}`;
                    if (vigilantesYaVistos.has(key)) return;

                    const conflicto = state.programaciones.some(p => {
                        if (p.anio !== prog.anio || p.mes !== prog.mes) return false;
                        return p.asignaciones.some(a => 
                            a.id !== asig.dia + asig.rol && // Evitar compararse consigo mismo
                            (p.id !== prog.id || a.rol !== asig.rol) && 
                            idsMatch(a.vigilanteId, asig.vigilanteId) && 
                            a.jornada !== 'sin_asignar' &&
                            a.dia === asig.dia
                        );
                    });

                    if (conflicto) {
                        const vNombre = useVigilanteStore.getState().vigilantes.find(v => idsMatch(v.id, asig.vigilanteId))?.nombre || asig.vigilanteId;
                        alertas.push(`Día ${asig.dia}: ${vNombre} tiene duplicidad de turno.`);
                        vigilantesYaVistos.add(key);
                    }
                });

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
                    asignaciones: (aRes.data || []).map(a => ({ dia: a.dia, vigilanteId: translateFromDb(a.vigilante_id), turno: a.turno, jornada: a.jornada as TipoJornada, rol: a.rol as RolPuesto, inicio: a.inicio || undefined, fin: a.fin || undefined })),
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
            name: 'coraza-programacion-store-v1.5.0',
            partialize: (state) => ({ templates: state.templates, programaciones: state.programaciones, loaded: state.loaded }),
            version: 4,
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
