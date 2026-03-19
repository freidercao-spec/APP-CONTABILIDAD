import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';
import { useVigilanteStore } from './vigilanteStore';
import { usePuestoStore } from './puestoStore';

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
    tipo: 'asignacion' | 'publicacion' | 'borrador' | 'personal' | 'rechazo_ia';
    reglaViolada?: string;
}

export interface ResultadoValidacion {
    permitido: boolean;
    tipo: 'bloqueo' | 'advertencia' | 'ok';
    mensaje: string;
    regla?: string;
}

// ── Utility ──────────────────────────────────────────────────────────────────
export const esPeriodoBloqueadoVacaciones = (anio: number, mes: number): boolean => {
    if (mes === 11 || mes === 0) return true;
    return false;
};

export const esSemanaSanta = (anio: number, mes: number, dia: number): boolean => {
    const a = anio % 19;
    const b = Math.floor(anio / 100);
    const c = anio % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

    const easter = new Date(anio, easterMonth, easterDay);
    const weekStart = new Date(easter); weekStart.setDate(easter.getDate() - 6);
    const weekEnd = new Date(easter);

    const fecha = new Date(anio, mes, dia);
    return fecha >= weekStart && fecha <= weekEnd;
};

// ── Store ────────────────────────────────────────────────────────────────────

interface ProgramacionState {
    programaciones: ProgramacionMensual[];
    templates: TemplateProgramacion[];
    loaded: boolean;

    fetchProgramaciones: () => Promise<void>;
    fetchTemplates: () => Promise<void>;

    lastSyncError: string | null;
    isSyncing: boolean;

    getProgramacion: (puestoId: string, anio: number, mes: number) => ProgramacionMensual | undefined;
    crearOObtenerProgramacion: (puestoId: string, anio: number, mes: number, usuario: string) => ProgramacionMensual;
    asignarPersonal: (progId: string, personal: PersonalPuesto[], usuario: string) => void;
    actualizarAsignacion: (progId: string, dia: number, data: Partial<AsignacionDia>, usuario: string) => ResultadoValidacion;
    publicarProgramacion: (progId: string, usuario: string) => void;
    guardarBorrador: (progId: string, usuario: string) => void;

    guardarComoPlantilla: (progId: string, nombre: string, puestoNombre: string, usuario: string) => void;
    aplicarPlantilla: (templateId: string, puestoId: string, anio: number, mes: number, usuario: string) => void;
    eliminarPlantilla: (templateId: string) => void;

    getDiasTrabajoVigilante: (progId: string, vigilanteId: string) => number;
    getDiasDescansoVigilante: (progId: string, vigilanteId: string) => { remunerados: number; noRemunerados: number };
    getCoberturaPorcentaje: (progId: string) => number;
    getAlertas: (progId: string) => string[];
    forceSync: () => Promise<void>;
    fetchProgramacionById: (progId: string) => Promise<ProgramacionMensual | null>;
}

let _currentUser = 'Sistema';
export const setProgUser = (name: string) => { _currentUser = name; };

// ── Sync Logic with Debounce and Queue ───────────────────────────────────────

// Map to track active sync operations per program ID to avoid race conditions
const pendingSyncs = new Map<string, any>();
const activeSyncPromises = new Map<string, Promise<any>>();

// Helper: translate any HID (MED-0001) to UUID for DB
const translateToUuid = (id: string | null): string | null => {
    if (!id) return null;
    if (id && id.length > 20) return id; // Is a UUID
    const vigs = useVigilanteStore.getState().vigilantes;
    // Buscamos por el 'id' (shorthand) o 'dbId' (UUID)
    const v = vigs.find(vg => vg.id === id || vg.dbId === id);
    return v?.dbId || id;
};

const translateFromDb = (dbId: string | null) => {
    if (!dbId) return null;
    // Buscamos por dbId (UUID) o por id (shorthand si ya esta convertido)
    const v = useVigilanteStore.getState().vigilantes.find((v: any) => v.dbId === dbId || v.id === dbId);
    return v?.id || dbId;
};

// Helper: translate puesto ID (MED-0001) to UUID
const translatePuestoToUuid = (id: string | null): string | null => {
    if (!id) return null;
    if (id && id.length > 20) return id; // Is a UUID
    const puestos = usePuestoStore.getState().puestos;
    const p = puestos.find((pt: any) => pt.id === id || pt.dbId === id);
    return p?.dbId || id;
};

// Helper: translate UUID to puesto ID (shorthand) para mostrar en logs/ui
const translatePuestoFromDb = (dbId: string | null) => {
    if (!dbId) return null;
    const p = usePuestoStore.getState().puestos.find((pt: any) => pt.dbId === dbId || pt.id === dbId);
    return p?.id || dbId;
};

interface SyncResult {
    success: boolean;
    serverVersion: number;
    serverUpdatedAt: string | null;
}

async function syncProgramacionToDb(prog: ProgramacionMensual, set: any, get: any): Promise<SyncResult> {
    // If there's an active sync for this ID, wait for it
    if (activeSyncPromises.has(prog.id)) {
        await activeSyncPromises.get(prog.id);
    }

    const syncPromise = (async (): Promise<SyncResult> => {
        try {
            // CRITICAL FIX: The DB has a UNIQUE constraint on (puesto_id, anio, mes).
            // If we have a local ID that differs from what's in the DB, we MUST resolve it first.
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
                console.warn(`🔄 [SYNC] Resolviendo discrepancia de ID: ${prog.id} -> ${existing.id}`);
                dbId = existing.id;
                // Update local store to match DB ID for future operations
                set((state: any) => ({
                    programaciones: state.programaciones.map((p: any) => 
                        p.id === prog.id ? { ...p, id: dbId } : p
                    )
                }));
            }

            // CRITICAL FIX: Check if server has newer version before overwriting
            if (existing) {
                const serverVersion = existing.version || 1;
                const localVersion = prog.version;
                
                // CRITICAL SAFETY CHECK:
                // If local has 0 assignments but server has many, DO NOT OVERWRITE.
                // This prevents the "empty store" issue from destroying real data.
                const localAsigCount = prog.asignaciones.length;
                const { data: serverAsigs } = await supabase.from('asignaciones_dia').select('id', { count: 'exact', head: true }).eq('programacion_id', existing.id);
                const serverAsigCount = serverAsigs?.length || 0;
                
                if (localAsigCount === 0 && serverAsigCount > 10) {
                    console.error(`🛑 [SYNC] Blocked overwrite of populated server record (${serverAsigCount} asigs) with empty local record.`);
                    return { success: false, serverVersion, serverUpdatedAt: existing.updated_at };
                }

                // FIXED: Only block sync if server is MORE THAN 2 versions ahead
                if (serverVersion > localVersion + 2) {
                    console.warn(`⚠️ [SYNC] Server has much newer version (${serverVersion} >> ${localVersion}) for prog ${dbId}.`);
                    return { 
                        success: false, 
                        serverVersion: serverVersion, 
                        serverUpdatedAt: existing.updated_at 
                    };
                }
            }

            // 1. Upsert header using the resolved ID
            const { error: upsertErr } = await supabase
                .from('programacion_mensual')
                .upsert({
                    id: dbId,
                    empresa_id: EMPRESA_ID,
                    puesto_id: dbPuestoId,
                    anio: prog.anio,
                    mes: prog.mes,
                    estado: prog.estado,
                    version: prog.version,
                    updated_at: new Date().toISOString(),
                });

            if (upsertErr) throw upsertErr;

            // 2. Sync personal - delete and re-insert atomically
            await supabase.from('personal_puesto').delete().eq('programacion_id', dbId);
            const personalRows = prog.personal
                .filter(p => p.vigilanteId)
                .map(p => ({
                    programacion_id: dbId,
                    rol: p.rol,
                    vigilante_id: translateToUuid(p.vigilanteId),
                }));
            if (personalRows.length > 0) {
                const { error: persErr } = await supabase.from('personal_puesto').insert(personalRows);
                if (persErr) throw persErr;
            }

            // 3. Sync asignaciones - delete and re-insert atomically
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
                    const batch = asignacionRows.slice(i, i + 100);
                    const { error: batchErr } = await supabase.from('asignaciones_dia').insert(batch);
                    if (batchErr) throw batchErr;
                }
            }

            console.log(`✅ [SYNC] CUADRO OPERATIVO ${prog.puestoId} sincronizada exitosamente.`);
            return { success: true, serverVersion: prog.version, serverUpdatedAt: new Date().toISOString() };
        } catch (err: any) {
            console.error('❌ [SYNC] Error critico en sincronizacion:', err.message || err);
            throw err;
        } finally {
            activeSyncPromises.delete(prog.id);
        }
    })();

    activeSyncPromises.set(prog.id, syncPromise);
    return syncPromise;
}

const queueSync = (progId: string, set: any, get: any) => {
    if (pendingSyncs.has(progId)) {
        clearTimeout(pendingSyncs.get(progId)!);
    }

    const timeout = setTimeout(async () => {
        pendingSyncs.delete(progId);
        const prog = get().programaciones.find((p: any) => p.id === progId);
        if (!prog) return;
        
        // Don't sync if programacion is empty
        if (!prog.personal && !prog.asignaciones) return;

        set({ isSyncing: true, lastSyncError: null });
        try {
            const result = await syncProgramacionToDb(prog, set, get);
            
            if (result.success) {
                // MARK AS SYNCED if successful
                set((state: any) => ({
                    programaciones: state.programaciones.map((p: any) => 
                        p.id === progId ? { ...p, syncStatus: 'synced' as const } : p
                    )
                }));
            } else if (result.serverVersion > prog.version) {
                // If server is newer, refetch to merge
                console.log(`🔄 [QUEUE] Fetching latest version from server for ${progId}`);
                await get().fetchProgramaciones();
            }
            
            set({ isSyncing: false });
        } catch (err: any) {
            set((state: any) => ({
                isSyncing: false, 
                lastSyncError: err.message || 'Error de conexion',
                programaciones: state.programaciones.map((p: any) => 
                    p.id === progId ? { ...p, syncStatus: 'error' as const } : p
                )
            }));
        }
    }, 500); // REducir de 1500 a 500 para mayor agilidad

    pendingSyncs.set(progId, timeout);
};

async function logCambio(progId: string, usuario: string, descripcion: string, tipo: CambioProgramacion['tipo'], regla?: string) {
    await supabase.from('historial_programacion').insert({
        programacion_id: progId,
        usuario,
        descripcion,
        tipo,
        regla_violada: regla || null,
    });
}

export const useProgramacionStore = create<ProgramacionState>()(
    persist(
        (set, get) => ({
            programaciones: [],
            templates: [],
            loaded: false,
            isSyncing: false,
            lastSyncError: null,

            fetchProgramaciones: async () => {
                try {
                    const { data: rows, error } = await supabase
                        .from('programacion_mensual')
                        .select('*')
                        .eq('empresa_id', EMPRESA_ID)
                        .order('anio', { ascending: false })
                        .order('mes', { ascending: false })
                        .limit(20000);

                    if (error) {
                        console.error('Error fetching programacion_mensual:', error);
                        set({ loaded: true });
                        return;
                    }

                    if (!rows || rows.length === 0) {
                        set({ programaciones: [], loaded: true });
                        return;
                    }

                    const progIds = rows.map(r => r.id);
                    
                    // CHUNKING: Fetch sub-tables in chunks of 30 to stay within URL length limits
                    const CHUNK_SIZE = 30;
                    let allPersonal: any[] = [];
                    let allAsignaciones: any[] = [];
                    let allHistorial: any[] = [];

                    for (let i = 0; i < progIds.length; i += CHUNK_SIZE) {
                        const chunk = progIds.slice(i, i + CHUNK_SIZE);
                        const [persRes, asigsRes, histRes] = await Promise.all([
                            supabase.from('personal_puesto').select('*').in('programacion_id', chunk).limit(2000),
                            supabase.from('asignaciones_dia').select('*').in('programacion_id', chunk).limit(10000),
                            supabase.from('historial_programacion').select('*').in('programacion_id', chunk).order('created_at', { ascending: true }).limit(2000)
                        ]);

                        if (persRes.data) allPersonal = [...allPersonal, ...persRes.data];
                        if (asigsRes.data) allAsignaciones = [...allAsignaciones, ...asigsRes.data];
                        if (histRes.data) allHistorial = [...allHistorial, ...histRes.data];
                    }

                    const programaciones: ProgramacionMensual[] = rows.map(row => {
                        const personal = (allPersonal || [])
                            .filter(p => p.programacion_id === row.id)
                            .map(p => ({ rol: p.rol as RolPuesto, vigilanteId: translateFromDb(p.vigilante_id) }));

                        // Ensure all 3 roles exist
                        const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                        roles.forEach(rol => {
                            if (!personal.find(p => p.rol === rol)) personal.push({ rol, vigilanteId: null });
                        });

                        const asignaciones = (allAsignaciones || [])
                            .filter(a => a.programacion_id === row.id)
                            .map(a => ({
                                dia: a.dia,
                                vigilanteId: translateFromDb(a.vigilante_id),
                                turno: a.turno,
                                jornada: a.jornada as TipoJornada,
                                rol: a.rol as RolPuesto,
                            }));

                        const historialCambios = (allHistorial || [])
                            .filter(h => h.programacion_id === row.id)
                            .map(h => ({
                                id: h.id,
                                timestamp: h.created_at,
                                usuario: h.usuario,
                                descripcion: h.descripcion,
                                tipo: h.tipo as CambioProgramacion['tipo'],
                                reglaViolada: h.regla_violada || undefined,
                            }));

                        return {
                            id: row.id,
                            // MANTENEMOS EL UUID AQUI PARA EVITAR PROBLEMAS DE MAPEO
                            // La traduccion se hace en la capa de vista si es necesario
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
                        };
                    });

                    // --- MEJORA: MERGE INTELIGENTE ---
                    const localProgs = get().programaciones;
                    const mergedProgramaciones = programaciones.map(remote => {
                        const local = localProgs.find(lp => lp.id === remote.id);
                        // Si tenemos una version local pendiente de sync y es MAS NUEVA, mantenerla
                        if (local && local.syncStatus === 'pending' && (local.version > remote.version || local.actualizadoEn > remote.actualizadoEn)) {
                            console.log(`💎 [FETCH] Preservando local unsynced: ${local.id} (v${local.version})`);
                            return local;
                        }
                        return remote;
                    });

                    // Tambien añadir progs que esten en local pero NO en el fetch del server (nuevas progs no sync)
                    const brandNew = localProgs.filter(lp => lp.syncStatus === 'pending' && !programaciones.find(rp => rp.id === lp.id));
                    const finalProgs = [...mergedProgramaciones, ...brandNew];

                    console.log(`✅ [FETCH] ${finalProgs.length} progs loaded/merged`);
                    set({ programaciones: finalProgs, loaded: true });
                } catch (err) {
                    console.error('CRITICAL: fetchProgramaciones crash:', err);
                    set({ loaded: true });
                }
            },

            fetchTemplates: async () => {
                try {
                    const { data: rows } = await supabase
                        .from('plantillas_programacion')
                        .select('*')
                        .eq('empresa_id', EMPRESA_ID)
                        .limit(500);

                    if (rows) {
                        const templates: TemplateProgramacion[] = rows.map(r => ({
                            id: r.id,
                            nombre: r.nombre,
                            puestoId: r.puesto_id || '',
                            puestoNombre: r.puesto_nombre || '',
                            personal: (r.personal as PersonalPuesto[]) || [],
                            patron: (r.patron as any[]) || [],
                            creadoEn: r.created_at,
                            creadoPor: r.creado_por || '',
                        }));
                        set({ templates });
                    }
                } catch (err) {
                    console.error('Error fetching templates:', err);
                }
            },

            getProgramacion: (puestoId, anio, mes) => {
                // Robust lookup: search by UUID or shorthand ID
                const pStore = usePuestoStore.getState().puestos;
                const pRef = pStore.find(px => px.id === puestoId || px.dbId === puestoId);
                const uuid = pRef?.dbId || puestoId;
                const short = pRef?.id || puestoId;

                return get().programaciones.find(p => 
                    (p.puestoId === uuid || p.puestoId === short) && 
                    p.anio === anio && 
                    p.mes === mes
                );
            },

            crearOObtenerProgramacion: (puestoId, anio, mes, usuario) => {
                // Use robust lookup first
                const existing = get().getProgramacion(puestoId, anio, mes);
                if (existing) return existing;

                const dbPuestoId = translatePuestoToUuid(puestoId) || puestoId;
                const daysInMonth = new Date(anio, mes + 1, 0).getDate();
                const asignaciones: AsignacionDia[] = [];
                const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];

                for (let dia = 1; dia <= daysInMonth; dia++) {
                    roles.forEach(rol => {
                        asignaciones.push({
                            dia,
                            vigilanteId: null,
                            turno: 'AM',
                            jornada: 'sin_asignar',
                            rol,
                        });
                    });
                }

                const newProg: ProgramacionMensual = {
                    id: crypto.randomUUID(),
                    puestoId: dbPuestoId,
                    anio,
                    mes,
                    personal: [
                        { rol: 'titular_a', vigilanteId: null },
                        { rol: 'titular_b', vigilanteId: null },
                        { rol: 'relevante', vigilanteId: null },
                    ],
                    asignaciones,
                    estado: 'borrador',
                    creadoEn: new Date().toISOString(),
                    actualizadoEn: new Date().toISOString(),
                    version: 1,
                    historialCambios: [],
                    syncStatus: 'pending',
                };

                set(s => ({ programaciones: [...s.programaciones, newProg] }));
                queueSync(newProg.id, set, get);
                return newProg;
            },

            asignarPersonal: (progId, personal, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => {
                        if (p.id !== progId) return p;
                        return {
                            ...p,
                            personal,
                            actualizadoEn: new Date().toISOString(),
                            syncStatus: 'pending',
                            historialCambios: [
                                ...p.historialCambios,
                                { id: crypto.randomUUID(), timestamp: new Date().toISOString(), usuario, descripcion: 'Cambio de personal asignado', tipo: 'personal' }
                            ]
                        };
                    })
                }));
                queueSync(progId, set, get);
            },

            actualizarAsignacion: (progId, dia, data, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'CUADRO OPERATIVO no encontrada' };

                const vigilanteId = data.vigilanteId ?? null;
                const jornada = data.jornada ?? 'normal';
                const turno = data.turno ?? 'AM';

                // Validation: vacations
                if (jornada === 'vacacion') {
                    if (prog.mes === 11 || prog.mes === 0) {
                        const regla = 'No se permiten vacaciones en diciembre ni enero';
                        set(s => ({
                            programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                                ...p,
                                historialCambios: [...p.historialCambios, {
                                    id: crypto.randomUUID(), timestamp: new Date().toISOString(),
                                    usuario, descripcion: `Vacacion bloqueada - ${regla}`, tipo: 'rechazo_ia' as const, reglaViolada: regla,
                                }]
                            })
                        }));
                        logCambio(progId, usuario, `Vacacion bloqueada - ${regla}`, 'rechazo_ia', regla);
                        return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                    }
                    if (esSemanaSanta(prog.anio, prog.mes, dia)) {
                        const regla = 'No se permiten vacaciones en Semana Santa';
                        return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                    }
                }

                // Validation: rest days per biweekly period
                if (jornada === 'descanso_remunerado' || jornada === 'descanso_no_remunerado') {
                    if (vigilanteId) {
                        const quincena = dia <= 15 ? 1 : 2;
                        const daysInQuincena = prog.asignaciones.filter(a => {
                            const inQ = quincena === 1 ? a.dia <= 15 : a.dia > 15;
                            return inQ && a.vigilanteId === vigilanteId &&
                                (a.jornada === 'descanso_remunerado' || a.jornada === 'descanso_no_remunerado');
                        });
                        if (daysInQuincena.length >= 3) {
                            const regla = 'Cada vigilante solo puede tener 3 dias de descanso por quincena';
                            return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                        }
                        if (jornada === 'descanso_remunerado') {
                            const remunerados = daysInQuincena.filter(a => a.jornada === 'descanso_remunerado').length;
                            if (remunerados >= 2) {
                                const regla = 'Solo 2 descansos remunerados por quincena por vigilante';
                                return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                            }
                        }
                        if (jornada === 'descanso_no_remunerado') {
                            const noRem = daysInQuincena.filter(a => a.jornada === 'descanso_no_remunerado').length;
                            if (noRem >= 1) {
                                const regla = 'Solo 1 descanso no remunerado por quincena por vigilante';
                                return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                            }
                        }
                    }
                }

                // Validation: conflict
                if (vigilanteId && jornada === 'normal') {
                    const conflicto = prog.asignaciones.find(a =>
                        a.dia === dia && a.vigilanteId === vigilanteId &&
                        (a.jornada === 'descanso_remunerado' || a.jornada === 'descanso_no_remunerado') &&
                        a.rol !== (data.rol ?? 'NONE')
                    );
                    if (conflicto) {
                        const regla = 'El vigilante tiene un dia de descanso programado en esta fecha';
                        return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                    }
                }

                // Validation: shift overlap
                if (vigilanteId && jornada === 'normal') {
                    const same = prog.asignaciones.find(a =>
                        a.dia === dia &&
                        a.vigilanteId === vigilanteId &&
                        a.turno === turno &&
                        a.rol !== (data.rol ?? 'NONE')
                    );
                    if (same) {
                        const regla = 'El vigilante ya esta asignado a este turno en este dia en otro rol o puesto';
                        return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                    }
                }

                // Apply change
                const descripcion = vigilanteId
                    ? `DIA ${dia}: Asignado vigilante ${vigilanteId} (${turno} - ${jornada})`
                    : `DIA ${dia}: Celda limpiada`;

                // --- AUTO-APPEND MISSING ROWS ---
                let found = false;
                const asignaciones = prog.asignaciones.map(a => {
                    // Match strictly by day and role ID to prevent overwriting other rows
                    const match = a.dia === dia && a.rol === data.rol;
                    if (match) {
                        found = true;
                        return { ...a, ...data };
                    }
                    return a;
                });

                if (!found) {
                    asignaciones.push({
                        dia,
                        rol: (data.rol ?? 'relevante') as RolPuesto,
                        vigilanteId: vigilanteId,
                        turno: turno as TurnoHora,
                        jornada: jornada as TipoJornada,
                    });
                }

                const updatedProgData = {
                    ...prog,
                    asignaciones,
                    actualizadoEn: new Date().toISOString(),
                    historialCambios: [...prog.historialCambios, {
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        usuario,
                        descripcion,
                        tipo: 'asignacion' as const,
                    }],
                };

                set(s => ({
                    programaciones: s.programaciones.map(p => (p.id !== progId) ? p : {
                        ...updatedProgData,
                        syncStatus: 'pending' as const
                    })
                }));
                
                queueSync(progId, set, get);
                logCambio(progId, usuario, descripcion, 'asignacion');
                return { permitido: true, tipo: 'ok', mensaje: 'Asignacion actualizada' };
            },

            publicarProgramacion: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p,
                        estado: 'publicado' as const,
                        version: p.version + 1,
                        actualizadoEn: new Date().toISOString(),
                        syncStatus: 'pending',
                        historialCambios: [...p.historialCambios, {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion: 'CUADRO OPERATIVO PUBLICADA como version definitiva',
                            tipo: 'publicacion' as const,
                        }],
                    })
                }));

                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) {
                    // High priority sync for publicacion
                    set({ isSyncing: true, lastSyncError: null });
                    syncProgramacionToDb(prog, set, get)
                        .then((result) => {
                            set({ isSyncing: false });
                            // If server had newer version, show warning
                            if (!result.success) {
                                set({ lastSyncError: '⚠️ Conflict: Server has newer version. Your publish may not have been saved.' });
                            }
                        })
                        .catch(e => set({ isSyncing: false, lastSyncError: e.message }));
                    
                    logCambio(prog.id, usuario, 'CUADRO OPERATIVO PUBLICADA como version definitiva', 'publicacion');
                }
            },

            guardarBorrador: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p,
                        estado: 'borrador' as const,
                        actualizadoEn: new Date().toISOString(),
                        historialCambios: [...p.historialCambios, {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion: 'Borrador guardado',
                            tipo: 'borrador' as const,
                        }],
                    })
                }));

                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) {
                    set({ isSyncing: true, lastSyncError: null });
                    syncProgramacionToDb(prog, set, get)
                        .then(() => set({ isSyncing: false }))
                        .catch(e => set({ isSyncing: false, lastSyncError: e.message }));
                    
                    logCambio(prog.id, usuario, 'Borrador guardado manualmente', 'borrador');
                }
            },

            guardarComoPlantilla: async (progId, nombre, puestoNombre, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return;

                const template: TemplateProgramacion = {
                    id: crypto.randomUUID(),
                    nombre,
                    puestoId: prog.puestoId,
                    puestoNombre,
                    // ✅ Save the complete personal list (role → vigilanteId)
                    personal: prog.personal.map(p => ({ ...p })),
                    // ✅ Save EVERY assignment including vigilanteId per day
                    //    This way when applied next month, ALL replacements, rest days, etc. are restored
                    patron: prog.asignaciones.map(a => ({
                        diaRelativo: a.dia,
                        rol: a.rol,
                        turno: a.turno,
                        jornada: a.jornada,
                        vigilanteId: a.vigilanteId,    // ← KEY: save the specific vigilante for each day
                    })),
                    creadoEn: new Date().toISOString(),
                    creadoPor: usuario,
                };
                set(s => ({ templates: [...s.templates, template] }));

                // Save to Supabase
                try {
                    await supabase.from('plantillas_programacion').insert({
                        id: template.id,
                        empresa_id: EMPRESA_ID,
                        nombre,
                        puesto_id: prog.puestoId,
                        puesto_nombre: puestoNombre,
                        personal: template.personal,
                        patron: template.patron,
                        creado_por: usuario,
                    });
                } catch (err) {
                    console.error('Error saving template to DB:', err);
                }
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
                        const personal = tpl.personal.find(p => p.rol === rol);
                        asignaciones.push({
                            dia,
                            // ✅ Restore the exact vigilante saved in the pattern (day-specific)
                            //    Falls back to the role's titular if not set (old templates)
                            //    Falls back to null if neither is set
                            vigilanteId: match?.vigilanteId ?? personal?.vigilanteId ?? null,
                            turno: match?.turno ?? 'AM',
                            jornada: match?.jornada ?? 'sin_asignar',
                            rol,
                        });
                    });
                }

                const existing = get().getProgramacion(puestoId, anio, mes);
                if (existing) {
                    set(s => ({
                        programaciones: s.programaciones.map(p => p.id !== existing.id ? p : {
                            ...p,
                            personal: tpl.personal.map(per => ({ ...per })),
                            asignaciones,
                            actualizadoEn: new Date().toISOString(),
                            historialCambios: [...p.historialCambios, {
                                id: crypto.randomUUID(),
                                timestamp: new Date().toISOString(),
                                usuario,
                                descripcion: `Plantilla "${tpl.nombre}" aplicada - datos copiados y listos para modificar`,
                                tipo: 'borrador' as const,
                            }],
                        })
                    }));
                    const prog = get().programaciones.find(p => p.id === existing.id);
                    if (prog) queueSync(prog.id, set, get);
                } else {
                    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                    const nueva: ProgramacionMensual = {
                        id: crypto.randomUUID(),
                        puestoId,
                        anio,
                        mes,
                        personal: tpl.personal.map(per => ({ ...per })),
                        asignaciones,
                        estado: 'borrador',
                        creadoEn: new Date().toISOString(),
                        actualizadoEn: new Date().toISOString(),
                        version: 1,
                        historialCambios: [{
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion: `CUADRO OPERATIVO creada desde plantilla "${tpl.nombre}" para ${MONTH_NAMES[mes]} ${anio}`,
                            tipo: 'borrador',
                        }],
                    };
                    set(s => ({ programaciones: [...s.programaciones, nueva] }));
                    syncProgramacionToDb(nueva, set, get);
                }
            },

            eliminarPlantilla: async (templateId) => {
                set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }));
                await supabase.from('plantillas_programacion').delete().eq('id', templateId);
            },

            getDiasTrabajoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return 0;
                return prog.asignaciones.filter(a => a.vigilanteId === vigilanteId && a.jornada === 'normal').length;
            },

            getDiasDescansoVigilante: (progId, vigilanteId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { remunerados: 0, noRemunerados: 0 };
                const arr = prog.asignaciones.filter(a => a.vigilanteId === vigilanteId);
                return {
                    remunerados: arr.filter(a => a.jornada === 'descanso_remunerado').length,
                    noRemunerados: arr.filter(a => a.jornada === 'descanso_no_remunerado').length,
                };
            },

            getCoberturaPorcentaje: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return 0;
                const total = prog.asignaciones.length;
                const cubiertos = prog.asignaciones.filter(a => a.vigilanteId !== null && a.jornada === 'normal').length;
                return total === 0 ? 0 : Math.round((cubiertos / total) * 100);
            },

            getAlertas: (progId) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return [];
                const alertas: string[] = [];
                const sinAsignar = prog.asignaciones.filter(a => a.vigilanteId === null).length;
                if (sinAsignar > 0) alertas.push(`⚠️ ${sinAsignar} turnos sin asignar`);
                const personalNulo = prog.personal.filter(p => p.vigilanteId === null).length;
                if (personalNulo > 0) alertas.push(`⚠️ ${personalNulo} roles de personal sin asignar`);
                return alertas;
            },

            fetchProgramacionById: async (progId: string) => {
                const { data: r } = await supabase.from('programacion_mensual').select('*').eq('id', progId).single();
                if (!r) return null;
                const [pRes, aRes, hRes] = await Promise.all([
                    supabase.from('personal_puesto').select('*').eq('programacion_id', progId).limit(10),
                    supabase.from('asignaciones_dia').select('*').eq('programacion_id', progId).limit(1000),
                    supabase.from('historial_programacion').select('*').eq('programacion_id', progId).order('created_at').limit(500)
                ]);
                const news: ProgramacionMensual = {
                    id: r.id, 
                    puestoId: r.puesto_id, 
                    anio: r.anio, 
                    mes: r.mes, 
                    estado: r.estado as EstadoProgramacion, 
                    version: r.version || 1,
                    creadoEn: r.created_at,
                    actualizadoEn: r.updated_at,
                    // CRITICAL: Use translateFromDb to convert UUID -> short ID (MED-XXX)
                    // This must be consistent with fetchProgramaciones
                    personal: (pRes.data || []).map(p => ({ rol: p.rol as RolPuesto, vigilanteId: translateFromDb(p.vigilante_id) })),
                    asignaciones: (aRes.data || []).map(a => ({ 
                        dia: a.dia, 
                        vigilanteId: translateFromDb(a.vigilante_id), 
                        turno: a.turno, 
                        jornada: a.jornada as TipoJornada, 
                        rol: a.rol as RolPuesto 
                    })),
                    historialCambios: (hRes.data || []).map(h => ({ 
                        id: h.id, 
                        timestamp: h.created_at, 
                        usuario: h.usuario, 
                        descripcion: h.descripcion, 
                        tipo: h.tipo as CambioProgramacion['tipo'], 
                        reglaViolada: h.regla_violada || undefined 
                    }))
                };
                const perms = get().programaciones;
                const exists = perms.findIndex(p => p.id === progId);
                if (exists >= 0) { const up = [...perms]; up[exists] = news; set({ programaciones: up }); }
                else { set({ programaciones: [...perms, news] }); }
                return news;
            },

            forceSync: async () => {
                set({ loaded: false });
                await get().fetchProgramaciones();
            },
        }),
        {
            name: 'coraza-programacion-store-v1.3.7',
            // Persist templates AND programaciones as local cache.
            // The fetch updates them from the server, but cache prevents blank screens on reload.
            partialize: (state) => ({ 
                templates: state.templates,
                programaciones: state.programaciones,
                loaded: state.loaded,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // CRITICAL FIX: Keep cached programaciones as local fallback.
                    // The fresh fetch will update them from Supabase.
                    // Setting loaded=false ensures the init hook re-fetches from DB.
                    state.loaded = false;
                }
            },
            // Migrate old store (v1.3.6) that had no programacion cache
            migrate: (persistedState: any) => {
                return {
                    ...persistedState,
                    programaciones: persistedState.programaciones || [],
                    templates: persistedState.templates || [],
                    loaded: false,
                };
            },
            version: 2,
        }
    )
);
