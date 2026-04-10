import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

// ── Helpers de Traducción y Comparación ───────────────────────────────────────

/**
 * Compara dos IDs (UUIDs o IDs Shorthand) de forma segura.
 */
export const idsMatch = (id1: string | null | undefined, id2: string | null | undefined): boolean => {
    if (!id1 || !id2) return id1 === id2;
    const s1 = String(id1).trim();
    const s2 = String(id2).trim();
    if (s1 === s2) return true;
    
    const vStore = useVigilanteStore.getState();
    const pStore = usePuestoStore.getState();

    // Caso Vigilante
    const v1 = vStore.vigilantes?.find(v => v.id === s1 || v.dbId === s1);
    const v2 = vStore.vigilantes?.find(v => v.id === s2 || v.dbId === s2);
    if (v1 && v2 && (v1.id === v2.id || v1.dbId === v2.dbId)) return true;

    // Caso Puesto
    const p1 = pStore.puestos?.find(p => p.id === s1 || p.dbId === s1);
    const p2 = pStore.puestos?.find(p => p.id === s2 || p.dbId === s2);
    if (p1 && p2 && (p1.id === p2.id || p1.dbId === p2.dbId)) return true;

    return false;
};

/**
 * Traduce un ID Readable / UUID a UUID puro para la DB.
 */
export const translatePuestoToUuid = (id: string | null): string | null => {
    if (!id) return null;
    const pStore = usePuestoStore.getState();
    const found = pStore.puestos?.find(p => p.id === id || p.dbId === id);
    return found?.dbId || id;
};

/**
 * Traduce un ID de vigilante a UUID.
 */
export const translateToUuid = (id: string | null): string | null => {
    if (!id) return null;
    const vStore = useVigilanteStore.getState();
    const found = vStore.vigilantes?.find(v => v.id === id || v.dbId === id);
    return found?.dbId || id;
};

/**
 * Traduce un UUID a ID legible para la UI.
 */
export const translateToReadableId = (dbId: string): string => {
    const pStore = usePuestoStore.getState();
    const found = pStore.puestos?.find(p => p.dbId === dbId || p.id === dbId);
    return found?.id || dbId;
};

/**
 * Traduce un UUID de la base de datos al formato legible de la UI.
 */
export const translateFromDb = (dbId: string | null, lookupMap?: Map<string, string>) => {
    if (!dbId) return null;
    if (lookupMap) return lookupMap.get(dbId) || dbId;
    const v = useVigilanteStore.getState().getVigilanteById(dbId);
    return v?.id || dbId;
};

export interface PersonalPuesto {
    rol: RolPuesto;
    vigilanteId: string | null;
    turnoId?: string; // ID del turno (AM, PM, o custom) vinculado a este rol/puesto
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
    isDetailLoaded?: boolean;
    isFetching?: boolean;
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
    actualizarPersonalPuesto: (progId: string, personal: PersonalPuesto[], usuario: string) => void;
    publicarProgramacion: (progId: string, usuario: string) => void;
    guardarBorrador: (progId: string, usuario: string) => void;
    guardarComoPlantilla: (progId: string, nombre: string, puestoNombre: string, usuario: string) => Promise<void>;
    aplicarPlantilla: (templateId: string, puestoId: string, anio: number, mes: number, usuario: string) => void;
    eliminarPlantilla: (templateId: string) => Promise<void>;
    getDiasTrabajoVigilante: (progId: string, vigilanteId: string) => number;
    getDiasDescansoVigilante: (progId: string, vigilanteId: string) => { remunerados: number; noRemunerados: number };
    getCoberturaPorcentaje: (progId: string) => number;
    getAlertas: (progId: string) => string[];
    getBusyDays: (vigilanteId: string, anio: number, mes: number) => Set<number>;
    getAssignmentsForVigilante: (vigilanteId: string, anio: number, mes: number) => AsignacionDia[];
    recuperarDatosHuerfanos: (puestoId: string, anio: number, mes: number) => Promise<boolean>;
    getProgramacionRapid: (puestoId: string, anio: number, mes: number) => ProgramacionMensual | undefined;
    _progMap?: Map<string, ProgramacionMensual>;
    _busyMap?: Map<string, Set<number>>; // key: vid-anio-mes
    _fetchDetails: (rows: any[], progIds: string[]) => Promise<void>;
    _updateMap: () => void;
    hasPendingChanges: () => boolean;
    setupRealtime: () => void;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

const activeSyncPromises = new Map<string, Promise<SyncResult>>();
const pendingSyncs = new Map<string, any>();

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SyncResult {
    success: boolean;
    serverVersion: number;
    serverUpdatedAt: string | null;
}

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
            
            const { error: headerErr } = await supabase
                .from('programacion_mensual')
                .upsert({
                    id: dbId,
                    empresa_id: currentEmpresaId,
                    puesto_id: dbPuestoId,
                    anio: prog.anio,
                    mes: prog.mes,
                    estado: prog.estado,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'empresa_id,puesto_id,anio,mes' }); 
            if (headerErr) throw new Error(`Cabecera: ${headerErr.message}`);

            // 2. Personal
            const personalPayload = prog.personal
                .filter(p => p.rol)
                .map(p => {
                    const mappedVid = p.vigilanteId ? translateToUuid(p.vigilanteId) : null;
                    const validVid = mappedVid && uuidRegex.test(mappedVid) ? mappedVid : null;
                    return { programacion_id: dbId, rol: p.rol, vigilante_id: validVid, turno_id: p.turnoId || null };
                });
            if (personalPayload.length > 0) {
                const { error: persErr } = await supabase
                    .from('personal_puesto')
                    .upsert(personalPayload, { onConflict: 'programacion_id,rol' });
                if (persErr) console.warn('[Coraza] Personal warning:', persErr.message);
            }

            // 3. Asignaciones en lotes de 100
            const asignacionesPayload = prog.asignaciones
                .map(a => {
                    const mappedVid = a.vigilanteId ? translateToDb(a.vigilanteId) : null;
                    return {
                        programacion_id: dbId,
                        dia: a.dia,
                        vigilante_id: mappedVid,
                        turno: a.turno || 'AM',
                        jornada: a.jornada || 'sin_asignar',
                        rol: a.rol || 'titular_a',
                        inicio: a.inicio || null,
                        fin: a.fin || null,
                        updated_at: new Date().toISOString()
                    };
                });

            const BATCH_SIZE = 100;
            for (let i = 0; i < asignacionesPayload.length; i += BATCH_SIZE) {
                const chunk = asignacionesPayload.slice(i, i + BATCH_SIZE);
                const { error: asigErr } = await supabase
                    .from('asignaciones_dia')
                    .upsert(chunk, { onConflict: 'programacion_id,dia,rol' });
                if (asigErr) console.warn('[Coraza] Asignaciones warning:', asigErr.message);
            }

            console.log(`[Coraza] Guardado directo OK: ${prog.id} | ${asignacionesPayload.length} asignaciones`);
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
    if (pendingSyncs.has(progId)) {
        clearTimeout(pendingSyncs.get(progId)!);
        pendingSyncs.delete(progId);
    }
    
    const runSync = async () => {
        pendingSyncs.delete(progId);
        const prog = get().programaciones.find((p: any) => p.id === progId);
        if (!prog) return;
        
        if (activeSyncPromises.has(progId)) {
            pendingSyncs.set(progId, setTimeout(runSync, 300));
            return;
        }
        
        set({ isSyncing: true });
        try {
            const res = await syncProgramacionToDb(prog, set, get);
            set((state: any) => ({
                programaciones: state.programaciones.map((p: any) => 
                    p.id === progId ? { ...p, syncStatus: 'synced' as const, version: res.serverVersion } : p
                ),
                isSyncing: get().programaciones.some((p: any) => p.syncStatus === 'pending') || pendingSyncs.size > 0
            }));
        } catch (err: any) {
            console.error('[Coraza] ❌ ERROR CRÍTICO SINCRONIZACIÓN:', err);
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
        const timeout = setTimeout(runSync, 800);
        pendingSyncs.set(progId, timeout);
        set({ isSyncing: true });
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
            selectedProgId: null,

            hasPendingChanges: () => {
                const s = get();
                return s.programaciones.some(p => p.syncStatus === 'pending') || pendingSyncs.size > 0;
            },

            forceSync: async () => {
                set({ loaded: false });
                await get().fetchProgramaciones();
            },

            fetchProgramaciones: async () => {
                try {
                    set({ loaded: false });
                    const now = new Date();
                    const anio = now.getFullYear();
                    const mesActual = now.getMonth();
                    
                    const meses = [
                        { anio: mesActual === 0 ? anio - 1 : anio, mes: mesActual === 0 ? 11 : mesActual - 1 },
                        { anio, mes: mesActual },
                        { anio: mesActual === 11 ? anio + 1 : anio, mes: mesActual === 11 ? 0 : mesActual + 1 },
                    ];
                    await Promise.all(meses.map(m => get().fetchProgramacionesByMonth(m.anio, m.mes)));
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
                    
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    
                    while (true) {
                        const { data, error } = await supabase
                            .from('programacion_mensual')
                            .select('*')
                            .eq('empresa_id', currentEmpresaId)
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
                                const dbUuid = translatePuestoToUuid(h.puestoId) || h.puestoId;
                                let idx = merged.findIndex(p => p.id === h.id);
                                if (idx < 0) {
                                    idx = merged.findIndex(p => 
                                        (p.puestoId === h.puestoId || p.puestoId === dbUuid) && 
                                        p.anio === h.anio && 
                                        p.mes === h.mes
                                    );
                                }

                                if (idx >= 0) {
                                    const existing = merged[idx];
                                    
                                    if (existing.syncStatus === 'pending' && existing.id !== h.id) {
                                    } else {
                                        merged[idx] = { 
                                            ...h, 
                                            asignaciones: (existing.asignaciones?.length > 0) ? existing.asignaciones : [],
                                            personal: (existing.personal?.length > 0) ? existing.personal : [],
                                            isDetailLoaded: existing.isDetailLoaded || false,
                                            historialCambios: existing.historialCambios || []
                                        };
                                    }
                                } else {
                                    merged.push(h);
                                }
                            });

                            const newMap = new Map<string, ProgramacionMensual>();
                            merged.forEach(p => {
                                newMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                                const uuid = translatePuestoToUuid(p.puestoId);
                                if (uuid && uuid !== p.puestoId) newMap.set(`${uuid}-${p.anio}-${p.mes}`, p);
                                newMap.set(p.id, p);
                            });

                            if (rows.length < 1000) {
                                setTimeout(() => get()._fetchDetails(rows, rows.map(r => r.id)), 100);
                            }

                            return { programaciones: merged, loaded: true, _progMap: newMap };
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
                    const state = get();
                    const prog = state.programaciones.find(p => p.id === progId);
                    
                    if (!prog || prog.isFetching) return;

                    const hasLocalData = prog.asignaciones && prog.asignaciones.length > 0;
                    if (prog.isDetailLoaded || hasLocalData) {
                        return; 
                    }

                    set((s: any) => ({
                        programaciones: s.programaciones.map((p: any) => p.id === progId ? { ...p, isFetching: true } : p)
                    }));

                    const [persRes, asigsRes] = await Promise.all([
                        supabase.from('personal_puesto').select('*').eq('programacion_id', progId),
                        supabase.from('asignaciones_dia').select('*').eq('programacion_id', progId).limit(1500)
                    ]);

                    if (persRes.error || asigsRes.error) {
                        console.error('[Laser Loading] ❌ Fallo en red:', persRes.error || asigsRes.error);
                        return; 
                    }

                    const personal = (persRes.data || []).map((p: any) => ({ 
                        rol: p.rol as RolPuesto, 
                        vigilanteId: translateFromDb(p.vigilante_id),
                        turnoId: p.turno_id || undefined
                    }));

                    ['titular_a', 'titular_b', 'relevante'].forEach(rol => {
                        if (!personal.find(p => p.rol === rol)) personal.push({ rol, vigilanteId: null, turnoId: undefined });
                    });

                    const asigMap = new Map();
                    (asigsRes.data || []).forEach((a: any) => {
                        asigMap.set(`${a.dia}-${a.rol}`, a);
                    });

                    const daysInMonth = new Date(prog?.anio || 2026, (prog?.mes || 0) + 1, 0).getDate();
                    const asignaciones: AsignacionDia[] = [];
                    const rolesToEnsure: RolPuesto[] = personal.length > 0 
                        ? personal.map(p => p.rol)
                        : ['titular_a', 'titular_b', 'relevante'];

                    for (let d = 1; d <= daysInMonth; d++) {
                        const allRolesForDay = new Set<string>(rolesToEnsure);
                        asigMap.forEach((_v: any, key: string) => {
                            const [dayStr, ...rolParts] = key.split('-');
                            if (parseInt(dayStr) === d) allRolesForDay.add(rolParts.join('-'));
                        });

                        Array.from(allRolesForDay).forEach(rol => {
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
                    
                    set((state: ProgramacionState) => {
                        const updatedProgs = state.programaciones.map((p) => {
                            if (p.id !== progId) return p;
                            
                            const localIsPending = p.syncStatus === 'pending';
                            const localHasData = p.asignaciones && p.asignaciones.some((a: AsignacionDia) => a.vigilanteId !== null);
                            const remoteHasData = asignaciones && asignaciones.some(a => a.vigilanteId !== null);
                            
                            if (localIsPending) return { ...p, isDetailLoaded: true, isFetching: false };
                            if (localHasData && !remoteHasData) return { ...p, isDetailLoaded: true, isFetching: false };

                            return {
                                ...p,
                                personal: (personal && personal.length > 0) ? personal : p.personal,
                                asignaciones: (asignaciones && asignaciones.length > 0) ? asignaciones : p.asignaciones,
                                isDetailLoaded: true,
                                isFetching: false
                            };
                        });

                        const nextMap = new Map<string, ProgramacionMensual>(state._progMap || []);
                        const updatedProg = updatedProgs.find((px) => px.id === progId);
                        if (updatedProg) {
                            nextMap.set(progId, updatedProg);
                            nextMap.set(`${updatedProg.puestoId}-${updatedProg.anio}-${updatedProg.mes}`, updatedProg);
                            const dbUuid = translatePuestoToUuid(updatedProg.puestoId);
                            if (dbUuid && dbUuid !== updatedProg.puestoId) {
                                nextMap.set(`${dbUuid}-${updatedProg.anio}-${updatedProg.mes}`, updatedProg);
                            }
                        }
                        
                        return { 
                            programaciones: updatedProgs as ProgramacionMensual[], 
                            _progMap: nextMap 
                        } as Partial<ProgramacionState>;
                    });
                } catch (err) {
                    console.error('fetchProgramacionDetalles Error:', err);
                }
            },

            _fetchDetails: async (rows: any[], progIds: string[]) => {
                const CHUNK_SIZE = 10; 
                let allPersonal: any[] = [];
                let allAsignaciones: any[] = [];

                set((state: any) => {
                    const nextProgs: any[] = state.programaciones.map((p: any) => 
                        progIds.includes(p.id) ? { ...p, isFetching: true } : p
                    );
                    const nextMap = new Map<string, ProgramacionMensual>(state._progMap || []);
                    nextProgs.forEach((p: any) => {
                        if (progIds.includes(p.id)) {
                            nextMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                            nextMap.set(p.id, p);
                            const dbUuid = translatePuestoToUuid(p.puestoId);
                            if (dbUuid && dbUuid !== p.puestoId) nextMap.set(`${dbUuid}-${p.anio}-${p.mes}`, p);
                        }
                    });
                    return { programaciones: nextProgs, _progMap: nextMap };
                });

                console.log(`[Sync] 📥 Descargando detalles en bloques de ${CHUNK_SIZE}...`);

                const chunkPromises = [];
                for (let i = 0; i < progIds.length; i += CHUNK_SIZE) {
                    const chunk = progIds.slice(i, i + CHUNK_SIZE);
                    chunkPromises.push(
                        Promise.all([
                            supabase.from('personal_puesto').select('*').in('programacion_id', chunk),
                            supabase.from('asignaciones_dia').select('*').in('programacion_id', chunk).limit(15000)
                        ])
                    );
                }

                try {
                    const chunkResults = await Promise.all(chunkPromises);
                    chunkResults.forEach(([persRes, asigsRes]) => {
                        if (persRes.data) allPersonal = [...allPersonal, ...persRes.data];
                        if (asigsRes.data) allAsignaciones = [...allAsignaciones, ...asigsRes.data];
                    });

                    const currentVigilantes = useVigilanteStore.getState().vigilantes;
                    const vigLookup = new Map<string, string>();
                    currentVigilantes.forEach(v => {
                        if (v.dbId) vigLookup.set(v.dbId, v.id);
                        vigLookup.set(v.id, v.id);
                    });

                    const assignmentsByProgId = new Map<string, any[]>();
                    allAsignaciones.forEach(a => {
                        if (!assignmentsByProgId.has(a.programacion_id)) assignmentsByProgId.set(a.programacion_id, []);
                        assignmentsByProgId.get(a.programacion_id)!.push(a);
                    });

                    const newProgramaciones: ProgramacionMensual[] = rows.map(row => {
                        const personal = allPersonal.filter(p => p.programacion_id === row.id).map(p => ({ 
                            rol: p.rol as RolPuesto, 
                            vigilanteId: p.vigilante_id ? (vigLookup.get(p.vigilante_id) || p.vigilante_id) : null,
                            turnoId: p.turno_id || undefined
                        }));
                        ['titular_a', 'titular_b', 'relevante'].forEach(rol => {
                            if (!personal.find(p => p.rol === rol)) personal.push({ rol: rol as RolPuesto, vigilanteId: null, turnoId: rol === 'titular_b' ? 'PM' : 'AM' });
                        });
                        const dbAsignaciones = assignmentsByProgId.get(row.id) || [];
                        const asigMap = new Map();
                        dbAsignaciones.forEach(a => asigMap.set(`${a.dia}-${a.rol}`, a));
                        const daysInMonth = new Date(row.anio, row.mes + 1, 0).getDate();
                        const asignaciones: AsignacionDia[] = [];
                        const rolesToEnsure: RolPuesto[] = personal.length > 0 ? personal.map(p => p.rol) : ['titular_a', 'titular_b', 'relevante'];
                        for (let d = 1; d <= daysInMonth; d++) {
                            const allRolesForDay = new Set<string>(rolesToEnsure);
                            asigMap.forEach((_v: any, key: string) => {
                                const [dayStr, ...rolParts] = key.split('-');
                                if (parseInt(dayStr) === d) allRolesForDay.add(rolParts.join('-'));
                            });
                            Array.from(allRolesForDay).forEach(rol => {
                                const match = asigMap.get(`${d}-${rol}`);
                                if (match) asignaciones.push({
                                    dia: match.dia, vigilanteId: match.vigilante_id ? (vigLookup.get(match.vigilante_id) || match.vigilante_id) : null,
                                    turno: match.turno, jornada: (match.jornada || 'sin_asignar') as TipoJornada, rol: (match.rol || rol) as RolPuesto,
                                    inicio: match.inicio || undefined, fin: match.fin || undefined
                                }); else asignaciones.push({ dia: d, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol });
                            });
                        }
                        return {
                            id: row.id, puestoId: (row.puesto_id || row.puestoId) as string, anio: row.anio, mes: row.mes,
                            personal, asignaciones, estado: (row.estado || 'borrador') as EstadoProgramacion,
                            creadoEn: row.created_at || row.creadoEn || new Date().toISOString(), actualizadoEn: row.updated_at || row.actualizadoEn || new Date().toISOString(),
                            version: row.version || 1, historialCambios: row.historialCambios || [], syncStatus: 'synced' as const
                        };
                    });

                    set((state: any) => {
                        const merged = [...state.programaciones];
                        newProgramaciones.forEach(np => {
                            const idx = merged.findIndex(p => p.id === np.id);
                            if (idx >= 0) merged[idx] = { ...merged[idx], ...np, isFetching: false, isDetailLoaded: true };
                            else merged.push({ ...np, isDetailLoaded: true, isFetching: false });
                        });
                        const newMap = new Map<string, ProgramacionMensual>();
                        merged.forEach(p => {
                            newMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                            newMap.set(p.id, p);
                            const dbUuid = translatePuestoToUuid(p.puestoId);
                            if (dbUuid && dbUuid !== p.puestoId) newMap.set(`${dbUuid}-${p.anio}-${p.mes}`, p);
                        });
                        return { programaciones: merged, loaded: true, _progMap: newMap };
                    });
                    get()._updateMap();
                } catch (err) {
                    console.error('[Coraza] ❌ ERROR EN FETCH DETAILS:', err);
                    set((s: any) => ({
                        programaciones: s.programaciones.map((p: any) => 
                            progIds.includes(p.id) ? { ...p, isFetching: false, isDetailLoaded: true } : p
                        ),
                        loaded: true
                    }));
                }
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

            getProgramacionRapid: (puestoId: string, anio: number, mes: number) => {
                const s = get();
                const map = (s as any)._progMap;
                
                if (map) {
                    const key1 = `${puestoId}-${anio}-${mes}`;
                    if (map.has(key1)) return map.get(key1);

                    const dbUuid = translatePuestoToUuid(puestoId);
                    if (dbUuid && dbUuid !== puestoId) {
                        const key2 = `${dbUuid}-${anio}-${mes}`;
                        if (map.has(key2)) return map.get(key2);
                    }
                }

                return (s as any).programaciones.find((p: any) => 
                    (p.puestoId === puestoId || translatePuestoToUuid(p.puestoId) === translatePuestoToUuid(puestoId)) && 
                    p.anio === anio && 
                    p.mes === mes
                );
            },

            crearOObtenerProgramacion: (puestoId, anio, mes, usuario) => {
                const s = get();
                if (!s.loaded && !s.programaciones.length) return null;

                const existing = s.getProgramacion(puestoId, anio, mes);
                if (existing) return existing;

                const dbPuestoId = translatePuestoToUuid(puestoId) || puestoId;
                
                const deterministicId = `${dbPuestoId}-${anio}-${mes}`;
                
                const daysInMonth = new Date(anio, mes + 1, 0).getDate();
                const asignaciones: AsignacionDia[] = [];
                const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                for (let dia = 1; dia <= daysInMonth; dia++) {
                    roles.forEach(rol => asignaciones.push({ dia, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol }));
                }
 
                const newProg: ProgramacionMensual = {
                    id: deterministicId,
                    puestoId: dbPuestoId, anio, mes,
                    personal: [
                        { rol: 'titular_a', vigilanteId: null, turnoId: 'AM' }, 
                        { rol: 'titular_b', vigilanteId: null, turnoId: 'PM' }, 
                        { rol: 'relevante', vigilanteId: null, turnoId: 'AM' }
                    ],
                    asignaciones, estado: 'borrador', creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
                    version: 1, historialCambios: [], syncStatus: 'pending',
                    isDetailLoaded: true
                };

                // NO GUARDAR INMEDIATAMENTE SI NO HAY INTERACCION (Debounce de seguridad de 2s)
                set(s => ({ programaciones: [...s.programaciones, newProg] }));
                get()._updateMap();
                
                // Solo guardamos a los 5 segundos si no ha sido reemplazado por un fetch real
                setTimeout(() => {
                    const latest = get().getProgramacion(puestoId, anio, mes);
                    if (latest && latest.id === newProg.id && latest.syncStatus === 'pending') {
                        queueSync(newProg.id, set, get, true);
                    }
                }, 5000);

                return newProg;
            },

            recuperarDatosHuerfanos: async (puestoId: string, anio: number, mes: number) => {
                const dbPuestoId = translatePuestoToUuid(puestoId) || puestoId;
                const prog = get().getProgramacion(puestoId, anio, mes);
                if (!prog) return false;

                showTacticalToast({ title: '🔍 Escaneando DB...', message: 'Buscando rastro de datos operativos...', type: 'info' });

                try {
                    // Intento de recuperación profunda: buscar asignaciones de este puesto/mes ignorando el prog_id exacto (si falló mapping)
                    const { data, error } = await supabase
                        .from('asignaciones_dia')
                        .select('*')
                        .eq('puesto_id', dbPuestoId) // Si se guardó con puesto_id (redundancia)
                        .eq('anio', anio)
                        .eq('mes', mes);
                    
                    if (error || !data || data.length === 0) {
                        // Plan B: Buscar por programacion_id antigua
                        // Esto requiere cruce, pero intentamos al menos forzar un fetch limpio
                        await get().fetchProgramacionesByMonth(anio, mes);
                        return true;
                    }

                    showTacticalToast({ title: '✨ Datos Encontrados', message: `Recuperados ${data.length} turnos huérfanos. Aplicando al tablero...`, type: 'success' });
                    // Hydrate localmente
                    get().fetchProgramacionDetalles(prog.id);
                    return true;
                } catch (e) {
                    return false;
                }
            },

            asignarPersonal: (progId, personal, usuario) => {
                set(s => {
                    const newProgs = s.programaciones.map(p => p.id !== progId ? p : {
                        ...p, personal, actualizadoEn: new Date().toISOString(), syncStatus: 'pending' as const
                    });
                    
                    // INCREMENTAL MAP UPDATE: Avoid full re-scan
                // INCREMENTAL MAP UPDATE: Avoid full re-scan
                    const prog = newProgs.find(p => p.id === progId);
                    if (prog && (s as any)._progMap) {
                        (s as any)._progMap.set(prog.id, prog);
                        (s as any)._progMap.set(`${prog.puestoId}-${prog.anio}-${prog.mes}`, prog);
                    }
                    
                    return { programaciones: newProgs };
                });
                queueSync(progId, set, get, true);
            },

            actualizarAsignacion: (progId, dia, data, usuario) => {
                const state = get();
                const prog = state.programaciones.find(p => p.id === progId);
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'Programación no encontrada' };

                // ── VALIDACIÓN TÁCTICA FLEXIBLE (Shift-Aware) ───────────────────
                if (data.vigilanteId && data.jornada !== 'sin_asignar') {
                    const normVid = translateToUuid(data.vigilanteId);
                    const key = `${normVid}-${prog.anio}-${prog.mes}`;
                    const busyDays = (state as any)._busyMap?.get(key);
                    
                    const jornadaSolicitada = (data.jornada || (data as any).turno || 'normal') as string;
                    const isOccupiedShift = busyDays && (
                        busyDays.has(`${dia}-24H`) || 
                        busyDays.has(`${dia}-${jornadaSolicitada}`) ||
                        (jornadaSolicitada === '24H' && (busyDays.has(`${dia}-AM`) || busyDays.has(`${dia}-PM`)))
                    );

                    if (isOccupiedShift) {
                        // Buscamos si es en ESTA misma programación (posible cambio de rol)
                        const samePostConflict = prog.asignaciones.find(a => 
                            a.dia === dia && 
                            idsMatch(a.vigilanteId, data.vigilanteId as string) && 
                            ((a.jornada as string) === jornadaSolicitada || (a.jornada as string) === '24H' || jornadaSolicitada === '24H')
                        );

                        if (!samePostConflict) {
                            showTacticalToast({ 
                                title: "Carga Duplicada", 
                                message: `Vigilante ya tiene turno ${jornadaSolicitada} en otro puesto el día ${dia}. Asignación realizada con advertencia.`, 
                                type: "warning" 
                            });
                        }
                    }
                }

                const newAsignaciones = [...prog.asignaciones];
                const idx = newAsignaciones.findIndex(a => a.dia === dia && a.rol === data.rol);
                const oldAsig = idx >= 0 ? newAsignaciones[idx] : null;

                if (idx >= 0) newAsignaciones[idx] = { ...newAsignaciones[idx], ...data };
                else newAsignaciones.push({ dia, vigilanteId: data.vigilanteId || null, turno: data.turno || 'AM', jornada: data.jornada || 'sin_asignar', rol: data.rol as string });

                // AUDITORÍA INTERNA: Registrar el cambio en el historial
                const descripcionCambio = `Día ${dia}: Cambio en rol ${data.rol || oldAsig?.rol}. ${data.vigilanteId ? 'Asignado a: ' + data.vigilanteId : 'Puesto liberado'}.`;
                const nuevoCambio: CambioProgramacion = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    usuario: usuario || "Operador",
                    descripcion: descripcionCambio,
                    tipo: 'asignacion'
                };

                set((s: any) => {
                    const newProgs = s.programaciones.map((p: any) => p.id === progId ? { 
                        ...p, 
                        asignaciones: newAsignaciones, 
                        actualizadoEn: new Date().toISOString(), 
                        syncStatus: 'pending' as const,
                        historialCambios: [...(p.historialCambios || []), nuevoCambio]
                    } : p);
                    
                    const updatedProg = newProgs.find((p: any) => p.id === progId);
                    
                    // PROYECTAR NOVEDAD EN FICHA DEL VIGILANTE
                    if (data.vigilanteId) {
                        const vStore = useVigilanteStore.getState();
                        const pStore = usePuestoStore.getState();
                        const puestoNombre = pStore.puestos.find(px => px.id === (updatedProg?.puestoId || prog.puestoId))?.nombre || 'Puesto';
                        vStore.addActivity(
                            data.vigilanteId, 
                            'Asignación Diaria', 
                            `Asignado a ${puestoNombre} para el día ${dia} (Rol: ${data.rol || 'General'})`
                        );
                    }
                    
                    // INCREMENTAL BUSY MAP UPDATE (Shift-Aware)
                    if (s._busyMap) {
                        const anio = prog.anio;
                        const mes = prog.mes;

                        // 1. LIMPIAR OCUPACIÓN ANTIGUA (si existía)
                        if (oldAsig && oldAsig.vigilanteId && oldAsig.jornada !== 'sin_asignar') {
                            const oldVid = translateToUuid(oldAsig.vigilanteId);
                            const oldKey = `${oldVid}-${anio}-${mes}`;
                            const oldBusySet = s._busyMap.get(oldKey);
                            
                            if (oldBusySet) {
                                const nextSet = new Set(oldBusySet);
                                const oldJ = (oldAsig.jornada || (oldAsig as any).turno || 'normal') as string;
                                if (oldJ === '24H' || oldJ === 'normal' || oldJ === 'vacacion' || oldJ.startsWith('descanso')) {
                                    nextSet.delete(`${dia}-AM`);
                                    nextSet.delete(`${dia}-PM`);
                                    nextSet.delete(`${dia}-24H`);
                                    nextSet.delete(`${dia}-normal`);
                                } else {
                                    nextSet.delete(`${dia}-${oldJ}`);
                                }
                                const hasMore = Array.from(nextSet).some((k: any) => String(k).startsWith(`${dia}-`));
                                if (!hasMore) nextSet.delete(dia);
                                if (nextSet.size === 0) s._busyMap.delete(oldKey);
                                else s._busyMap.set(oldKey, nextSet);
                            }
                        }

                        // 2. REGISTRAR NUEVA OCUPACIÓN (si aplica)
                        if (data.vigilanteId && data.jornada && data.jornada !== 'sin_asignar') {
                            const newVid = translateToUuid(data.vigilanteId);
                            const newKey = `${newVid}-${anio}-${mes}`;
                            const currentSet = s._busyMap.get(newKey) || new Set();
                            const nextSet = new Set(currentSet);
                            const j = (data.jornada || (data as any).turno || 'normal') as string;
                            nextSet.add(dia);
                            if (j === '24H' || j === 'normal' || j.startsWith('descanso') || j === 'vacacion') {
                                nextSet.add(`${dia}-AM`);
                                nextSet.add(`${dia}-PM`);
                                nextSet.add(`${dia}-24H`);
                                nextSet.add(`${dia}-normal`);
                            } else if (j === 'AM') {
                                nextSet.add(`${dia}-AM`);
                            } else if (j === 'PM') {
                                nextSet.add(`${dia}-PM`);
                            } else {
                                nextSet.add(`${dia}-${j}`);
                            }
                            s._busyMap.set(newKey, nextSet);
                        }
                        s._busyMap = new Map(s._busyMap);
                    }
                    // 5. ACTUALIZAR MAPA DE PROGRAMACIÓN (FIN DE LA ACTUALIZACIÓN)
                    if (updatedProg && s._progMap) {
                        const key1 = `${updatedProg.puestoId}-${updatedProg.anio}-${updatedProg.mes}`;
                        const dbUuid = translatePuestoToUuid(updatedProg.puestoId);
                        s._progMap.set(updatedProg.id, updatedProg);
                        s._progMap.set(key1, updatedProg);
                        if (dbUuid && dbUuid !== updatedProg.puestoId) {
                            s._progMap.set(`${dbUuid}-${updatedProg.anio}-${updatedProg.mes}`, updatedProg);
                        }
                        s._progMap = new Map(s._progMap);
                    }

                    return { programaciones: newProgs, _busyMap: s._busyMap, _progMap: s._progMap };
                });
                
                queueSync(progId, set, get, true);

                const conflictMsg = get().checkConflict(progId, dia, data.vigilanteId || '', data.turno || 'AM');
                return { 
                    permitido: true, 
                    tipo: conflictMsg ? 'advertencia' : 'ok', 
                    mensaje: conflictMsg || 'Asignación guardada' 
                };
            },

            actualizarPersonalPuesto: (progId, personal, usuario) => {
                const state = get();
                const prog = state.programaciones.find(p => p.id === progId);
                if (!prog) return;

                const daysInMonth = new Date(prog.anio, prog.mes + 1, 0).getDate();
                const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                const newAsignaciones = [...prog.asignaciones];

                personal.forEach(per => {
                    if (per.vigilanteId) {
                        daysArr.forEach(dia => {
                            const idx = newAsignaciones.findIndex(a => a.dia === dia && a.rol === per.rol);
                            if (idx === -1) {
                                newAsignaciones.push({
                                    dia,
                                    rol: per.rol,
                                    vigilanteId: per.vigilanteId,
                                    turno: per.turnoId || 'AM',
                                    jornada: 'normal'
                                });
                            } else {
                                const exists = newAsignaciones[idx];
                                if (!exists.vigilanteId || exists.jornada === 'sin_asignar') {
                                    newAsignaciones[idx] = {
                                        ...exists,
                                        vigilanteId: per.vigilanteId,
                                        turno: per.turnoId || exists.turno || 'AM',
                                        jornada: exists.jornada === 'sin_asignar' ? 'normal' : exists.jornada
                                    };
                                }
                            }
                        });
                    } else {
                        // Si liberan el rol, eliminar el asignado de los dias inmutablemente
                        newAsignaciones.forEach((a, idx) => {
                            if (a.rol === per.rol) {
                                newAsignaciones[idx] = { ...a, vigilanteId: null, jornada: 'sin_asignar' };
                            }
                        });
                    }
                });

                set((s: any) => {
                    const updatedProgs = s.programaciones.map((p: any) =>
                        p.id === progId
                            ? { ...p, personal, asignaciones: newAsignaciones, actualizadoEn: new Date().toISOString(), syncStatus: 'pending' as const }
                            : p
                    );
                    
                    const target = updatedProgs.find((p: any) => p.id === progId);
                    if (target && s._progMap) {
                        const key1 = `${target.puestoId}-${target.anio}-${target.mes}`;
                        const dbUuid = translatePuestoToUuid(target.puestoId);
                        
                        s._progMap.set(target.id, target);
                        s._progMap.set(key1, target);
                        if (dbUuid && dbUuid !== target.puestoId) {
                            s._progMap.set(`${dbUuid}-${target.anio}-${target.mes}`, target);
                        }
                        s._progMap = new Map(s._progMap);
                    }

                    return { 
                        programaciones: updatedProgs,
                        _progMap: s._progMap
                    };
                });
                queueSync(progId, set, get, true);
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
                // CORRECCIÓN: incluir turnoId en personal para que la plantilla pueda restaurar
                // turnos personalizados al aplicarla
                const template: TemplateProgramacion = {
                    id: crypto.randomUUID(), nombre, puestoId: prog.puestoId, puestoNombre,
                    personal: prog.personal.map(p => ({ rol: p.rol, vigilanteId: p.vigilanteId, turnoId: p.turnoId })),
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
                const state = get();
                const tpl = state.templates.find(t => t.id === templateId);
                if (!tpl) return;
                
                const prog = state.getProgramacion(puestoId, anio, mes);
                if (!prog) return;
                
                const daysInTargetMonth = new Date(anio, mes + 1, 0).getDate();
                // CORRECCIÓN: preservar turnoId de la plantilla para que los turnos
                // personalizados se restauren correctamente en el tablero
                const newPersonal: PersonalPuesto[] = tpl.personal.map(p => ({ 
                    rol: p.rol, 
                    vigilanteId: p.vigilanteId,
                    turnoId: p.turnoId 
                }));
                const newAsignaciones: AsignacionDia[] = [];

                // Generar asignaciones para todos los roles de la plantilla
                for (let d = 1; d <= daysInTargetMonth; d++) {
                    newPersonal.forEach(p => {
                        const match = tpl.patron.find(pat => pat.diaRelativo === d && pat.rol === p.rol);
                        if (match) {
                           newAsignaciones.push({
                                dia: d,
                                vigilanteId: match.vigilanteId,
                                turno: (match.turno as any) || 'AM',
                                jornada: match.jornada as TipoJornada || 'sin_asignar',
                                rol: p.rol as string
                           });
                        } else {
                           newAsignaciones.push({
                                dia: d,
                                vigilanteId: null,
                                turno: p.turnoId || (p.rol === 'titular_b' ? 'PM' : 'AM'),
                                jornada: 'sin_asignar',
                                rol: p.rol as string
                           });
                        }
                    });
                }

                set((s: any) => {
                    const newProgs = s.programaciones.map((p: any) => p.id === prog.id 
                        ? { 
                            ...p, 
                            personal: newPersonal, 
                            asignaciones: newAsignaciones, 
                            actualizadoEn: new Date().toISOString(),
                            syncStatus: 'pending', 
                            isDetailLoaded: true 
                          } 
                        : p);

                    const newMap = new Map<string, ProgramacionMensual>(s._progMap || []);
                    const updatedProg = newProgs.find((p: any) => p.id === prog.id) as ProgramacionMensual;
                    if (updatedProg) {
                        newMap.set(prog.id, updatedProg);
                        newMap.set(`${prog.puestoId}-${prog.anio}-${prog.mes}`, updatedProg);
                    }
                    return { programaciones: newProgs, _progMap: newMap } as Partial<ProgramacionState>;
                });

                get()._updateMap();
                queueSync(prog.id, set, get, true);
                
                showTacticalToast({
                    title: "Plantilla Aplicada",
                    message: `Se ha cargado la plantilla "${tpl.nombre}" con ${newPersonal.length} roles y ${newAsignaciones.filter(a => a.vigilanteId).length} asignaciones.`,
                    type: "success"
                });
            },

            eliminarPlantilla: async (templateId) => {
                set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }));
                await supabase.from('plantillas_programacion').delete().eq('id', templateId);
            },

            getDiasTrabajoVigilante: (progId, vigilanteId) => {
                const prog = get()._progMap?.get(progId);
                if (!prog) return 0;
                return (prog.asignaciones || []).filter(a => idsMatch(a.vigilanteId, vigilanteId) && (a.jornada !== 'sin_asignar')).length;
            },

            getDiasDescansoVigilante: (progId, vigilanteId) => {
                const prog = get()._progMap?.get(progId);
                if (!prog) return { remunerados: 0, noRemunerados: 0 };
                const as = (prog.asignaciones || []).filter(a => idsMatch(a.vigilanteId, vigilanteId));
                return { 
                    remunerados: as.filter(a => a.jornada === 'descanso_remunerado').length, 
                    noRemunerados: as.filter(a => a.jornada === 'descanso_no_remunerado').length 
                };
            },

            getCoberturaPorcentaje: (progId) => {
                const prog = get()._progMap?.get(progId);
                if (!prog) return 0;
                const total = prog.asignaciones?.length || 0;
                if (total === 0) return 0;
                const cubiertos = prog.asignaciones.filter(a => a.vigilanteId && a.jornada !== 'sin_asignar').length;
                return Math.round((cubiertos / total) * 100);
            },

            getAlertas: (progId) => {
                const prog = get()._progMap?.get(progId);
                if (!prog) return [];
                const alertas: string[] = [];
                const vacios = (prog.asignaciones || []).filter(a => !a.vigilanteId).length;
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
            getBusyDays: (vid: string, anio: number, mes: number): Set<number> => {
                return get()._busyMap?.get(`${vid}-${anio}-${mes}`) || new Set();
            },

            _updateMap: () => {
                const progs = get().programaciones;
                const newMap = new Map<string, any>();
                const newBusyMap = new Map<string, Set<any>>();

                progs.forEach(p => {
                    // Indexar por puestoId y UUID para búsquedas rápidas
                    newMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                    newMap.set(`${p.id}`, p);
                    
                    const dbUuid = translatePuestoToUuid(p.puestoId);
                    if (dbUuid && dbUuid !== p.puestoId) {
                        newMap.set(`${dbUuid}-${p.anio}-${p.mes}`, p);
                    }

                    // Track busy days & shifts (Normalizar a UUID)
                    if (p.asignaciones) {
                        p.asignaciones.forEach(asig => {
                            if (asig.vigilanteId && asig.jornada !== 'sin_asignar') {
                                const dbVid = translateToUuid(asig.vigilanteId);
                                const key = `${dbVid}-${p.anio}-${p.mes}`;
                                const jornada = (asig.jornada || (asig as any).turno || 'normal') as string;

                                if (!newBusyMap.has(key)) newBusyMap.set(key, new Set());
                                
                                const busySet = newBusyMap.get(key)!;
                                // Marcar el día completo (legacy)
                                busySet.add(asig.dia);
                                busySet.add(`${asig.dia}`); // compatibilidad string
                                
                                // NORMALIZACIÓN DE LLAVES DE OCUPACIÓN (Sincronizado con CoordinationPanel)
                                if (jornada === '24H' || jornada === 'normal' || 
                                    jornada === 'descanso_remunerado' || 
                                    jornada === 'descanso_no_remunerado' || 
                                    jornada === 'vacacion') {
                                    busySet.add(`${asig.dia}-AM`);
                                    busySet.add(`${asig.dia}-PM`);
                                    busySet.add(`${asig.dia}-24H`);
                                    busySet.add(`${asig.dia}-normal`);
                                } else if (jornada === 'AM') {
                                    busySet.add(`${asig.dia}-AM`);
                                } else if (jornada === 'PM') {
                                    busySet.add(`${asig.dia}-PM`);
                                } else {
                                    busySet.add(`${asig.dia}-${jornada}`);
                                }
                            }
                        });
                    }
                });
                set({ _progMap: newMap, _busyMap: newBusyMap } as any);
            },

            getAssignmentsForVigilante: (vigilanteId, anio, mes) => {
                const results: any[] = [];
                const progs = get().programaciones.filter(p => p.anio === anio && p.mes === mes);
                const pStore = usePuestoStore.getState();
                
                progs.forEach(prog => {
                    const puesto = pStore.puestos.find(px => px.id === prog.puestoId || px.dbId === prog.puestoId);
                    prog.asignaciones.forEach(asig => {
                        if (idsMatch(asig.vigilanteId, vigilanteId)) {
                            results.push({
                                ...asig,
                                puestoNombre: puesto?.nombre || 'Puesto',
                                puestoId: puesto?.id || '?'
                            });
                        }
                    });
                });
                return results.sort((a, b) => a.dia - b.dia);
            },

            setupRealtime: () => {
                const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                
                supabase
                    .channel('programacion-realtime')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'programacion_mensual',
                            filter: `empresa_id=eq.${currentEmpresaId}`
                        },
                        async (payload) => {
                            console.log('[Realtime] Cambio detectado en programacion_mensual:', payload.eventType);
                            // Simplemente refrescar todo el mes para simplificar (evita inconsistencias)
                            const now = new Date();
                            await get().fetchProgramacionesByMonth(now.getFullYear(), now.getMonth());
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'asignaciones_dia',
                        },
                        async (payload) => {
                            // Si se cambia una asignacion, refrescar los detalles de esa programacion
                            if (payload.new && (payload.new as any).programacion_id) {
                                console.log('[Realtime] Cambio detectado en asignaciones_dia');
                                await get().fetchProgramacionDetalles((payload.new as any).programacion_id);
                            }
                        }
                    )
                    .subscribe();
            }
        }),
        {
            name: 'coraza-programacion-v10', // Versión del esquema
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                programaciones: state.programaciones,
                templates: state.templates,
                loaded: true
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // RECONSTRUCCIÓN DE MAPAS ÍNDICE (Crítico para que el tablero funcione)
                    const newMap = new Map<string, ProgramacionMensual>();
                    state.programaciones.forEach(p => {
                        newMap.set(`${p.puestoId}-${p.anio}-${p.mes}`, p);
                        newMap.set(p.id, p);
                        // También por DB ID si está disponible
                        const uuid = translatePuestoToUuid(p.puestoId);
                        if (uuid && uuid !== p.puestoId) newMap.set(`${uuid}-${p.anio}-${p.mes}`, p);
                    });
                    (state as any)._progMap = newMap;
                    (state as any)._updateMap(); // Gatillar la reconstrucción de busyMap
                    console.log('[Coraza] 💾 Datos rehidratados del disco local. Tablero Listo.');
                }
            }
        }
    )
);
