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
    inicio?: string; 
    fin?: string;    
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
    isDetailLoaded?: boolean; // Nuevo campo para carga bajo demanda
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
    selectedProgId: string | null; // ID actualmente seleccionado en UI

    fetchProgramaciones: () => Promise<void>;
    fetchProgramacionesByMonth: (anio: number, mes: number) => Promise<void>;
    fetchTemplates: () => Promise<void>;
    fetchProgramacionById: (progId: string) => Promise<ProgramacionMensual | null>;
    fetchProgramacionDetalles: (progId: string) => Promise<void>; // Carga selectiva
    setSelectedProgId: (id: string | null) => void;
    forceSync: () => Promise<void>;
    getProgramacion: (puestoId: string, anio: number, mes: number) => ProgramacionMensual | undefined;
    crearOObtenerProgramacion: (puestoId: string, anio: number, mes: number, usuario: string) => ProgramacionMensual | null;
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

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const translateToUuid = (idRaw: string | null): string | null => {
    if (!idRaw) return null;
    const id = String(idRaw).trim();
    if (uuidRegex.test(id)) return id;
    
    // PERFORMANCE: Use Map from store if possible, or limited find for small sets
    const vStore = useVigilanteStore.getState();
    const v = vStore.vigilantes.find(vx => vx.id === id || vx.dbId === id);
    if (v?.dbId && uuidRegex.test(v.dbId)) return v.dbId;
    return null; 
};

const translateFromDb = (dbId: string | null, lookupMap?: Map<string, string>) => {
    if (!dbId) return null;
    if (lookupMap) return lookupMap.get(dbId) || dbId;
    const v = useVigilanteStore.getState().vigilantes.find((v: any) => v.dbId === dbId || v.id === dbId);
    return v?.id || dbId;
};

const translatePuestoToUuid = (idRaw: string | null): string | null => {
    if (!idRaw) return null;
    const id = String(idRaw).trim();
    if (uuidRegex.test(id)) return id;
    const p = usePuestoStore.getState().puestos.find((pt: any) => pt.id === id || pt.dbId === id);
    return p?.dbId || (uuidRegex.test(id) ? id : null);
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
    if (activeSyncPromises.has(prog.id)) {
        try { await activeSyncPromises.get(prog.id); } catch {}
    }

    const syncPromise = (async (): Promise<SyncResult> => {
        try {
            const dbId = String(prog.id).trim();
            const dbPuestoId = translatePuestoToUuid(prog.puestoId);
            if (!dbPuestoId) throw new Error("ID de puesto no encontrado");

            const currentEmpresaId = String(useAuthStore.getState().empresaId || EMPRESA_ID).trim();
            
            // PREPARAR PAYLOAD JSONB ATÓMICO
            const asignacionesPayload = prog.asignaciones
                .filter(a => a.vigilanteId)
                .map(a => {
                    const mappedVid = translateToUuid(a.vigilanteId);
                    return mappedVid ? {
                        dia: a.dia,
                        vigilante_id: mappedVid,
                        turno: a.turno,
                        jornada: a.jornada,
                        rol: a.rol,
                        inicio: a.inicio || null,
                        fin: a.fin || null
                    } : null;
                })
                .filter(r => r !== null);

            // LLAMADA ATÓMICA AL RPC (Transacción en Servidor)
            const { error: rpcErr } = await supabase.rpc('guardar_programacion_atomica', {
                p_prog_id: dbId,
                p_empresa_id: currentEmpresaId,
                p_puesto_id: dbPuestoId,
                p_anio: prog.anio,
                p_mes: prog.mes,
                p_estado: prog.estado,
                p_asignaciones: asignacionesPayload
            });

            if (rpcErr) {
                console.error('[Coraza] ❌ Fallo en Guardado Atómico RPC:', rpcErr);
                throw new Error(`Servidor: ${rpcErr.message}`);
            }

            console.log(`[Coraza] 🛡️ Sincronización ATÓMICA Exitosa: ${prog.id}`);
            return { success: true, serverVersion: (prog.version || 0) + 1, serverUpdatedAt: new Date().toISOString() };
        } catch (err: any) {
            console.error('[Coraza] ❌ Error de Persistencia:', err);
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
            set((state: any) => ({
                programaciones: state.programaciones.map((p: any) => 
                    p.id === progId ? { ...p, syncStatus: 'synced' as const, version: res.serverVersion } : p
                ),
                isSyncing: false
            }));
        } catch (err: any) {
            console.error('[Coraza] ❌ ERROR CRÍTICO SYNCHRONIZACIÓN:', err);
            set({ isSyncing: false, lastSyncError: err?.message || 'Error de escritura' });
            showTacticalToast({ 
                title: "❌ ERROR NÚCLEO", 
                message: `La base de datos rechazó el despliegue: ${err?.message || 'Error desconocido'}`, 
                type: "error",
                duration: 8000
            });
        }
    };

    if (immediate) {
        runSync();
    } else {
        const timeout = setTimeout(runSync, 1000);
        pendingSyncs.set(progId, timeout);
    }
};

// ── Store Logic ──────────────────────────────────────────────────────────────

export const useProgramacionStore = create<ProgramacionState>()(
    (set, get) => ({
            programaciones: [],
            templates: [],
            loaded: false,
            isSyncing: false,
            lastSyncError: null,
            selectedProgId: null,

            forceSync: async () => {
                set({ loaded: false });
                await get().fetchProgramaciones();
            },

            fetchProgramaciones: async () => {
                try {
                    set({ loaded: false });
                    const now = new Date();
                    const anio = now.getFullYear();
                    const mes = now.getMonth();
                    
                    await get().fetchProgramacionesByMonth(anio, mes);
                } catch (error) {
                    console.error('[Coraza] ❌ fetchProgramaciones Error:', error);
                    set({ loaded: true });
                }
            },

            fetchProgramacionesByMonth: async (anio: number, mes: number) => {
                try {
                    set({ loaded: false });
                    
                    let allRows: any[] = [];
                    let from = 0;
                    const BATCH = 1000;
                    
                    while (true) {
                        const { data, error } = await supabase
                            .from('programacion_mensual')
                            .select('*')
                            .eq('anio', anio)
                            .eq('mes', mes)
                            .range(from, from + BATCH - 1);

                        if (error) {
                            console.error('Error fetching prog batch:', error);
                            break;
                        }
                        if (!data || data.length === 0) break;
                        
                        allRows = [...allRows, ...data];
                        from += BATCH;
                        if (allRows.length >= 7000) break;
                    }

                    const rows = allRows;

                    if (rows && rows.length > 0) {
                         const headers = rows.map(row => ({
                            id: row.id,
                            puestoId: row.puesto_id as string,
                            anio: row.anio,
                            mes: row.mes,
                            estado: row.estado as EstadoProgramacion as any,
                            creadoEn: row.created_at,
                            actualizadoEn: row.updated_at,
                            version: row.version || 1,
                            syncStatus: 'synced' as const,
                            personal: [],
                            asignaciones: [],
                            isDetailLoaded: false
                        }));

                        set((state: any) => {
                            const merged = [...state.programaciones];
                            headers.forEach(h => {
                                let idx = merged.findIndex(p => p.id === h.id);
                                if (idx < 0) {
                                    const dbUuid = translatePuestoToUuid(h.puestoId);
                                    idx = merged.findIndex(p => 
                                        (p.puestoId === h.puestoId || p.puestoId === dbUuid) && 
                                        p.anio === h.anio && p.mes === h.mes
                                    );
                                }

                                if (idx >= 0) {
                                    const existing = merged[idx];
                                    const hasDetailedData = existing.isDetailLoaded || (existing.asignaciones && existing.asignaciones.length > 0);
                                    
                                    merged[idx] = { 
                                        ...existing, 
                                        ...h,
                                        id: h.id, 
                                        asignaciones: hasDetailedData ? existing.asignaciones : [],
                                        personal: hasDetailedData ? existing.personal : [],
                                        isDetailLoaded: hasDetailedData
                                    };
                                } else {
                                    merged.push(h);
                                }
                            });

                            // Optimization: Only auto-hydrate if < 1000 posts
                            if (rows.length < 1000) {
                                setTimeout(() => {
                                    get()._fetchDetails(rows, rows.map(r => r.id));
                                }, 100);
                            } else {
                                console.warn(`[Coraza] ⚡ Carga masiva detectada (${rows.length} registros). La hidratación detallada se realizará bajo demanda.`);
                            }

                            return { programaciones: merged, loaded: true };
                        });
                    } else {
                        set({ loaded: true });
                    }
                } catch (err) {
                    console.error('[Coraza] ❌ fetchProgramacionesByMonth Error:', err);
                    set({ loaded: true });
                }
            },

            fetchProgramacionDetalles: async (progId: string) => {
                try {
                    const prog = get().programaciones.find(p => p.id === progId);
                    const hasLocalData = prog && prog.asignaciones && prog.asignaciones.length > 0;
                    if (prog && ((prog as any).isDetailLoaded || hasLocalData)) {
                        if (!(prog as any).isDetailLoaded) {
                            set((state: any) => ({
                                programaciones: state.programaciones.map((p: any) => p.id === progId ? { ...p, isDetailLoaded: true } : p)
                            }));
                        }
                        return; // Ya cargado con datos locales reales
                    }

                    const [persRes, asigsRes] = await Promise.all([
                        supabase.from('personal_puesto').select('*').eq('programacion_id', progId),
                        supabase.from('asignaciones_dia').select('*').eq('programacion_id', progId).limit(200) // 93 max
                    ]);

                    if (persRes.error || asigsRes.error) {
                        console.error('[Laser Loading] ❌ Fallo en red:', persRes.error || asigsRes.error);
                        return; // Abortamos para no sobreescribir con arrays vacíos por error de red
                    }

                    const personal = (persRes.data || []).map((p: any) => ({ 
                        rol: p.rol as RolPuesto, 
                        vigilanteId: translateFromDb(p.vigilante_id) 
                    }));

                    ['titular_a', 'titular_b', 'relevante'].forEach(rol => {
                        if (!personal.find(p => p.rol === rol)) personal.push({ rol, vigilanteId: null });
                    });

                    const asigMap = new Map();
                    (asigsRes.data || []).forEach((a: any) => {
                        asigMap.set(`${a.dia}-${a.rol}`, a);
                    });

                    const daysInMonth = new Date(prog?.anio || 2026, (prog?.mes || 0) + 1, 0).getDate();
                    const asignaciones: AsignacionDia[] = [];
                    const rolesToEnsure: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];

                    for (let d = 1; d <= daysInMonth; d++) {
                        rolesToEnsure.forEach(rol => {
                            const match = asigMap.get(`${d}-${rol}`);
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
                                asignaciones.push({ dia: d, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol });
                            }
                        });
                    }

                    console.log(`[Laser Loading] ✅ Datos reconstruidos para ${progId}: ${asignaciones.length} turnos.`);

                    const incomingHasData = asignaciones.some(a => a.vigilanteId !== null);
                    
                    set((state: any) => ({
                        programaciones: state.programaciones.map((p: any) => {
                             if (p.id !== progId) return p;
                             
                             const localIsPending = p.syncStatus === 'pending';
                             const localHasData = p.asignaciones && p.asignaciones.some((a: AsignacionDia) => a.vigilanteId !== null);
                             
                             // REGLA DE CONFLICTO: Si hay trabajo local sin guardar, no dejamos que la DB lo pise
                             // a menos que la versión de la DB sea mayor.
                             if (localIsPending) {
                                 const incomingVersion = (asignaciones.length > 0) ? (p.version || 1) : 0; // Aproximación
                                 // Nota: En fetching de un solo ID, row no está disponible aquí directamente, 
                                 // pero version suele estar en el objeto 'p'.
                                 return { ...p, isDetailLoaded: true }; // Mantenemos local
                             }

                             if (localHasData && !incomingHasData) {
                                 return { ...p, isDetailLoaded: true };
                             }
                             
                             return {
                                 ...p,
                                 personal,
                                 asignaciones,
                                 isDetailLoaded: true
                             };
                        })
                    }));
                } catch (err) {
                    console.error('fetchProgramacionDetalles Error:', err);
                }
            },

            _fetchDetails: async (rows: any[], progIds: string[]) => {
                // REDUCIDO: Chunk de 20 para máxima seguridad en payloads de Supabase
                const CHUNK_SIZE = 20; 
                let allPersonal: any[] = [];
                let allAsignaciones: any[] = [];

                console.log(`[Sync] 📥 Descargando detalles en bloques de ${CHUNK_SIZE}...`);

                const chunkPromises = [];
                for (let i = 0; i < progIds.length; i += CHUNK_SIZE) {
                    const chunk = progIds.slice(i, i + CHUNK_SIZE);
                    chunkPromises.push(
                        Promise.all([
                            supabase.from('personal_puesto').select('*').in('programacion_id', chunk),
                            supabase.from('asignaciones_dia').select('*').in('programacion_id', chunk).limit(5000)
                        ])
                    );
                }

                const chunkResults = await Promise.all(chunkPromises);
                chunkResults.forEach(([persRes, asigsRes]) => {
                    if (persRes.data) allPersonal = [...allPersonal, ...persRes.data];
                    if (asigsRes.data) allAsignaciones = [...allAsignaciones, ...asigsRes.data];
                });

                console.log(`[Sync] 📊 ${progIds.length} programaciones hidratadas en paralelo.`);

                // OPTIMIZACIÓN CRÍTICA: Pre-mapear vigilancia para evitar O(n^2) en la traducción de IDs
                const currentVigilantes = useVigilanteStore.getState().vigilantes;
                const vigLookup = new Map<string, string>();
                currentVigilantes.forEach(v => {
                    if (v.dbId) vigLookup.set(v.dbId, v.id);
                    vigLookup.set(v.id, v.id);
                });

                // OPTIMIZACIÓN: Pre-agrupar asignaciones por ID de programación para evitar filtrar 14k records en cada iteración
                const assignmentsByProgId = new Map<string, any[]>();
                allAsignaciones.forEach(a => {
                    if (!assignmentsByProgId.has(a.programacion_id)) assignmentsByProgId.set(a.programacion_id, []);
                    assignmentsByProgId.get(a.programacion_id)!.push(a);
                });

                const newProgramaciones: ProgramacionMensual[] = rows.map(row => {
                    const personal = allPersonal
                        .filter(p => p.programacion_id === row.id)
                        .map(p => ({ 
                            rol: p.rol as RolPuesto, 
                            vigilanteId: p.vigilante_id ? (vigLookup.get(p.vigilante_id) || p.vigilante_id) : null 
                        }));

                    ['titular_a', 'titular_b', 'relevante'].forEach(rol => {
                        if (!personal.find(p => p.rol === rol)) personal.push({ rol, vigilanteId: null });
                    });

                    const dbAsignaciones = assignmentsByProgId.get(row.id) || [];
                    const asigMap = new Map();
                    dbAsignaciones.forEach(a => {
                        const key = `${a.dia}-${a.rol}`;
                        asigMap.set(key, a);
                    });

                    const daysInMonth = new Date(row.anio, row.mes + 1, 0).getDate();
                    const asignaciones: AsignacionDia[] = [];
                    const rolesToEnsure: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                    
                    for (let d = 1; d <= daysInMonth; d++) {
                        rolesToEnsure.forEach(rol => {
                            const match = asigMap.get(`${d}-${rol}`);
                            if (match) {
                                asignaciones.push({
                                    dia: match.dia,
                                    vigilanteId: match.vigilante_id ? (vigLookup.get(match.vigilante_id) || match.vigilante_id) : null,
                                    turno: match.turno,
                                    jornada: (match.jornada || 'sin_asignar') as TipoJornada,
                                    rol: (match.rol || rol) as RolPuesto,
                                    inicio: match.inicio || undefined,
                                    fin: match.fin || undefined
                                });
                            } else {
                                asignaciones.push({ dia: d, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol });
                            }
                        });
                    }

                    return {
                        id: row.id, puestoId: row.puesto_id as string, anio: row.anio, mes: row.mes,
                        personal, asignaciones, estado: row.estado as EstadoProgramacion,
                        creadoEn: row.created_at, actualizadoEn: row.updated_at,
                        version: row.version || 1, historialCambios: [], syncStatus: 'synced' as const
                    };
                });

                set((state: any) => {
                    const merged = [...state.programaciones];
                    newProgramaciones.forEach(np => {
                        const idx = merged.findIndex(p => p.id === np.id);
                        if (idx >= 0) {
                            const existingLocal = merged[idx];
                            const localHasData = existingLocal.asignaciones && existingLocal.asignaciones.some((a: AsignacionDia) => a.vigilanteId !== null);
                            const incomingHasData = np.asignaciones && np.asignaciones.some((a: AsignacionDia) => a.vigilanteId !== null);

                            // DETERMINAR VERACIDAD: ¿El incoming es realmente una actualización valiosa?
                            const localIsPending = existingLocal.syncStatus === 'pending';
                            
                            // Si el local tiene data y está pendiente de guardado, solo permitimos sobrescribir
                            // si la versión de la DB es ESTRICTAMENTE MAYOR.
                            if (localIsPending) {
                                if ((np.version || 0) > (existingLocal.version || 0)) {
                                    merged[idx] = { ...existingLocal, ...np, isDetailLoaded: true, syncStatus: 'synced' };
                                } else {
                                    // Ignoramos el incoming porque el local es más fresco (aunque no se haya guardado aún)
                                    merged[idx].isDetailLoaded = true;
                                }
                            } else {
                                // Si no hay nada pendiente localmente, usamos la lógica estándar de protección anti-vacío
                                if (localHasData && !incomingHasData) {
                                    merged[idx] = { ...existingLocal, isDetailLoaded: true };
                                } else if (incomingHasData || !localHasData) {
                                    if ((np.version || 0) >= (existingLocal.version || 0)) {
                                        merged[idx] = { ...existingLocal, ...np, isDetailLoaded: true };
                                    }
                                }
                            }
                        } else {
                            merged.push({ ...np, isDetailLoaded: true });
                        }
                    });
                    return { programaciones: merged, loaded: true };
                });
            },

            fetchTemplates: async () => {
                const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                const { data: rows } = await supabase.from('plantillas_programacion').select('*').eq('empresa_id', currentEmpresaId);
                if (rows) {
                    set({ templates: rows.map(r => ({
                        id: r.id, nombre: r.nombre, puestoId: r.puesto_id || '', puestoNombre: r.puesto_nombre || '',
                        personal: (r.personal as PersonalPuesto[]) || [], patron: (r.patron as any[]) || [],
                        creadoEn: r.created_at, creadoPor: r.creado_por || '',
                    })) });
                }
            },

            getProgramacion: (puestoId, anio, mes) => {
                return get().getProgramacionRapid(puestoId, anio, mes);
            },

            // USAR ESTE PARA RENDERING MASIVO (O(1))
            getProgramacionRapid: (puestoId: string, anio: number, mes: number) => {
                const dbUuid = translatePuestoToUuid(puestoId);
                const key1 = `${puestoId}-${anio}-${mes}`;
                const key2 = `${dbUuid}-${anio}-${mes}`;
                
                const state = get() as any;
                const map = state._progMap || new Map<string, any>();
                return map.get(key1) || map.get(key2) || undefined;
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
                    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), 
                    puestoId: dbPuestoId, anio, mes,
                    personal: [{ rol: 'titular_a', vigilanteId: null }, { rol: 'titular_b', vigilanteId: null }, { rol: 'relevante', vigilanteId: null }],
                    asignaciones, estado: 'borrador', creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
                    version: 1, historialCambios: [], syncStatus: 'pending',
                    isDetailLoaded: true // Nueva programación nace con su esqueleto cargado
                };
                set(s => ({ programaciones: [...s.programaciones, newProg] }));
                queueSync(newProg.id, set, get);
                return newProg;
            },

            asignarPersonal: (progId, personal, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, personal, actualizadoEn: new Date().toISOString(), syncStatus: 'pending'
                    })
                }));
                queueSync(progId, set, get, true);
            },

            actualizarAsignacion: (progId, dia, data, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'Error: Programación no hallada' };
                
                // ── VALIDACIÓN DE CONFLICTOS IA ───────────────────────
                if (data.vigilanteId && data.jornada !== 'sin_asignar') {
                    const otrosConflictos = get().programaciones.some(p => 
                        p.id !== prog.id && p.anio === prog.anio && p.mes === prog.mes &&
                        p.asignaciones.some(a => a.dia === dia && idsMatch(a.vigilanteId, data.vigilanteId as string | null) && a.jornada !== 'sin_asignar')
                    );
                    if (otrosConflictos) return { permitido: false, tipo: 'bloqueo', mensaje: 'IA: El vigilante ya tiene una asignación en OTRO puesto hoy.' };
                }

                const newAsignaciones = [...prog.asignaciones];
                const idx = newAsignaciones.findIndex(a => a.dia === dia && a.rol === data.rol);
                if (idx >= 0) newAsignaciones[idx] = { ...newAsignaciones[idx], ...data };
                else newAsignaciones.push({ dia, vigilanteId: data.vigilanteId || null, turno: data.turno || 'AM', jornada: data.jornada || 'sin_asignar', rol: data.rol as string });

                set(s => ({
                    programaciones: s.programaciones.map(p => p.id === progId ? { ...p, asignaciones: newAsignaciones, actualizadoEn: new Date().toISOString(), syncStatus: 'pending' } : p)
                }));
                
                queueSync(progId, set, get, true);
                return { permitido: true, tipo: 'ok', mensaje: 'Asignación guardada' };
            },

            publicarProgramacion: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : { ...p, estado: 'publicado', syncStatus: 'pending' })
                }));
                queueSync(progId, set, get, true);
            },

            guardarBorrador: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : { ...p, estado: 'borrador', syncStatus: 'pending' })
                }));
                queueSync(progId, set, get, true);
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
                const prog = get().getProgramacion(puestoId, anio, mes);
                if (!prog) return;
                
                const newAsignaciones = prog.asignaciones.map(a => {
                    const match = tpl.patron.find(p => p.diaRelativo === a.dia && p.rol === a.rol);
                    return match ? { ...a, vigilanteId: match.vigilanteId, turno: match.turno, jornada: match.jornada } : a;
                });

                set(s => ({
                    programaciones: s.programaciones.map(p => p.id === prog.id ? { ...p, personal: tpl.personal, asignaciones: newAsignaciones, syncStatus: 'pending' } : p)
                }));
                queueSync(prog.id, set, get, true);
            },

            eliminarPlantilla: async (templateId) => {
                set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }));
                await supabase.from('plantillas_programacion').delete().eq('id', templateId);
            },

            getDiasTrabajoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return 0;
                return prog.asignaciones.filter(a => idsMatch(a.vigilanteId, vigilanteId) && (a.jornada !== 'sin_asignar')).length;
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
                const total = prog.asignaciones.length;
                const cubiertos = prog.asignaciones.filter(a => a.vigilanteId && a.jornada !== 'sin_asignar').length;
                return total === 0 ? 0 : Math.round((cubiertos / total) * 100);
            },

            getAlertas: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return [];
                const alertas: string[] = [];
                const vacios = prog.asignaciones.filter(a => !a.vigilanteId).length;
                if (vacios > 0) alertas.push(`${vacios} turnos vacíos`);
                return alertas;
            },

            fetchProgramacionById: async (progId: string) => {
                const { data: r } = await supabase.from('programacion_mensual').select('*').eq('id', progId).single();
                if (!r) return null;
                await get().fetchProgramacionDetalles(progId);
                return get().programaciones.find(p => p.id === progId) || null;
            },

            setSelectedProgId: (id: string | null) => {
                set({ selectedProgId: id });
                if (id) {
                    get().fetchProgramacionDetalles(id);
                }
            },
            diasTrabajoMap: new Map<string, number>(),
            
            // Re-calcular el mapa de acceso rápido cada vez que cambien las programaciones
            _updateMap: () => {
                const progs = get().programaciones;
                const newMap = new Map<string, any>();
                progs.forEach(p => {
                    newMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                    newMap.set(`${p.id}`, p); // También indexar por ID propio
                });
                set({ _progMap: newMap } as any);
            },
        })
);

// Middleware para auto-actualizar el mapa de búsqueda rápida
const originalSet = useProgramacionStore.setState;
useProgramacionStore.setState = (fn: any, replace?: boolean) => {
    originalSet(fn, replace);
    const state = useProgramacionStore.getState() as any;
    if (state._updateMap) {
        state._updateMap();
    }
};
