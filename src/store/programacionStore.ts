import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type TipoJornada = 'normal' | 'descanso_remunerado' | 'descanso_no_remunerado' | 'vacacion' | 'sin_asignar';
export type TurnoHora = 'AM' | 'PM' | '24H';
export type RolPuesto = 'titular_a' | 'titular_b' | 'relevante';
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
export const esPeríodoBloqueadoVacaciones = (anio: number, mes: number): boolean => {
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
}

let _currentUser = 'Sistema';
export const setProgUser = (name: string) => { _currentUser = name; };

// Helper: sync programacion to Supabase — robust with visible error reporting
async function syncProgramacionToDb(prog: ProgramacionMensual): Promise<boolean> {
    try {
        // 1. Upsert the programacion header (DO NOT send creado_por — it's a UUID FK managed by DB)
        const { error: upsertErr } = await supabase
            .from('programacion_mensual')
            .upsert({
                id: prog.id,
                empresa_id: EMPRESA_ID,
                puesto_id: prog.puestoId,
                anio: prog.anio,
                mes: prog.mes,
                estado: prog.estado,
                version: prog.version,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (upsertErr) {
            console.warn('⚠️ [SYNC] Error upserting programacion_mensual:', upsertErr.message, upsertErr.details);
            return false;
        }

        // 2. Delete old personal rows and reinsert
        await supabase.from('personal_puesto').delete().eq('programacion_id', prog.id);
        const personalRows = prog.personal
            .filter(p => p.vigilanteId)
            .map(p => ({
                programacion_id: prog.id,
                rol: p.rol,
                vigilante_id: p.vigilanteId,
            }));
        if (personalRows.length > 0) {
            const { error: persErr } = await supabase.from('personal_puesto').insert(personalRows);
            if (persErr) console.warn('⚠️ [SYNC] Error inserting personal_puesto:', persErr.message);
        }

        // 3. Delete old asignaciones and reinsert in batches of 100
        await supabase.from('asignaciones_dia').delete().eq('programacion_id', prog.id);
        const asignacionRows = prog.asignaciones.map(a => ({
            programacion_id: prog.id,
            dia: a.dia,
            vigilante_id: a.vigilanteId || null,
            turno: a.turno,
            jornada: a.jornada,
            rol: a.rol,
        }));

        for (let i = 0; i < asignacionRows.length; i += 100) {
            const batch = asignacionRows.slice(i, i + 100);
            const { error: asigErr } = await supabase.from('asignaciones_dia').insert(batch);
            if (asigErr) {
                console.warn(`⚠️ [SYNC] Error inserting asignaciones batch ${i}-${i+batch.length}:`, asigErr.message);
                return false;
            }
        }

        console.log(`✅ [SYNC] Programación ${prog.puestoId} ${prog.anio}/${prog.mes+1} sincronizada con Supabase (${asignacionRows.length} asignaciones)`);
        return true;
    } catch (err) {
        console.warn('⚠️ [SYNC] Error inesperado sincronizando con Supabase:', err);
        return false;
    }
}

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

            fetchProgramaciones: async () => {
                try {
                    const { data: rows, error } = await supabase
                        .from('programacion_mensual')
                        .select('*')
                        .eq('empresa_id', EMPRESA_ID);

                    if (error) {
                        console.warn('⚠️ [FETCH] Error fetching programacion_mensual:', error.message);
                        set({ loaded: true });
                        return;
                    }

                    if (!rows || rows.length === 0) {
                        // No data in DB → clear local cache so stale data doesn't persist
                        set({ programaciones: [], loaded: true });
                        return;
                    }

                    const progIds = rows.map(r => r.id);

                    const [{ data: allPersonal }, { data: allAsignaciones }, { data: allHistorial }] = await Promise.all([
                        supabase.from('personal_puesto').select('*').in('programacion_id', progIds),
                        supabase.from('asignaciones_dia').select('*').in('programacion_id', progIds),
                        supabase.from('historial_programacion').select('*').in('programacion_id', progIds).order('created_at', { ascending: true }),
                    ]);

                    const programaciones: ProgramacionMensual[] = rows.map(row => {
                        const personal = (allPersonal || [])
                            .filter(p => p.programacion_id === row.id)
                            .map(p => ({ rol: p.rol as RolPuesto, vigilanteId: p.vigilante_id }));

                        // Ensure all 3 roles exist
                        const roles: RolPuesto[] = ['titular_a', 'titular_b', 'relevante'];
                        roles.forEach(rol => {
                            if (!personal.find(p => p.rol === rol)) {
                                personal.push({ rol, vigilanteId: null });
                            }
                        });

                        const asignaciones = (allAsignaciones || [])
                            .filter(a => a.programacion_id === row.id)
                            .map(a => ({
                                dia: a.dia,
                                vigilanteId: a.vigilante_id,
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
                            puestoId: row.puesto_id,
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

                    // ✅ Always replace local state with fresh Supabase data
                    console.log(`✅ [FETCH] ${programaciones.length} programaciones cargadas desde Supabase`);
                    set({ programaciones, loaded: true });
                } catch (err) {
                    console.warn('⚠️ [FETCH] Error inesperado cargando programaciones:', err);
                    set({ loaded: true });
                }
            },

            fetchTemplates: async () => {
                try {
                    const { data: rows } = await supabase
                        .from('plantillas_programacion')
                        .select('*')
                        .eq('empresa_id', EMPRESA_ID);

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
                return get().programaciones.find(p => p.puestoId === puestoId && p.anio === anio && p.mes === mes);
            },

            crearOObtenerProgramacion: (puestoId, anio, mes, usuario) => {
                const existing = get().getProgramacion(puestoId, anio, mes);
                if (existing) return existing;

                const daysInMonth = new Date(anio, mes + 1, 0).getDate();
                const asignaciones: AsignacionDia[] = [];
                for (let dia = 1; dia <= daysInMonth; dia++) {
                    asignaciones.push({ dia, vigilanteId: null, turno: 'AM', jornada: 'sin_asignar', rol: 'titular_a' });
                    asignaciones.push({ dia, vigilanteId: null, turno: 'PM', jornada: 'sin_asignar', rol: 'titular_b' });
                    asignaciones.push({ dia, vigilanteId: null, turno: 'OFF', jornada: 'sin_asignar', rol: 'relevante' });
                }

                const nueva: ProgramacionMensual = {
                    id: crypto.randomUUID(),
                    puestoId,
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
                    historialCambios: [{
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        usuario,
                        descripcion: `Programación creada para ${anio}/${mes + 1}`,
                        tipo: 'borrador',
                    }],
                };

                set(s => ({ programaciones: [...s.programaciones, nueva] }));

                // Sync to DB in background
                syncProgramacionToDb(nueva);
                logCambio(nueva.id, usuario, `Programación creada para ${anio}/${mes + 1}`, 'borrador');

                return nueva;
            },

            asignarPersonal: (progId, personal, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p,
                        personal,
                        asignaciones: p.asignaciones.map(a => {
                            const per = personal.find(pers => pers.rol === a.rol);
                            return per ? { ...a, vigilanteId: per.vigilanteId } : a;
                        }),
                        actualizadoEn: new Date().toISOString(),
                        historialCambios: [...p.historialCambios, {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion: 'Personal del puesto actualizado y propagado al calendario',
                            tipo: 'personal' as const,
                        }],
                    })
                }));

                // Sync in background
                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) {
                    syncProgramacionToDb(prog);
                    logCambio(progId, usuario, 'Personal del puesto actualizado y propagado al calendario', 'personal');
                }
            },

            actualizarAsignacion: (progId, dia, data, usuario) => {
                const prog = get().programaciones.find(p => p.id === progId);
                if (!prog) return { permitido: false, tipo: 'bloqueo', mensaje: 'Programación no encontrada' };

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
                                    usuario, descripcion: `Vacación bloqueada — ${regla}`, tipo: 'rechazo_ia' as const, reglaViolada: regla,
                                }]
                            })
                        }));
                        logCambio(progId, usuario, `Vacación bloqueada — ${regla}`, 'rechazo_ia', regla);
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
                            const regla = 'Cada vigilante solo puede tener 3 días de descanso por quincena';
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
                        (a.jornada === 'descanso_remunerado' || a.jornada === 'descanso_no_remunerado')
                    );
                    if (conflicto) {
                        const regla = 'El vigilante tiene un día de descanso programado en esta fecha';
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
                        const regla = 'El vigilante ya está asignado a este turno en este día en otro rol o puesto';
                        return { permitido: false, tipo: 'bloqueo', mensaje: `🚫 ${regla}`, regla };
                    }
                }

                // Apply change
                const descripcion = vigilanteId
                    ? `Día ${dia}: Asignado vigilante ${vigilanteId} (${turno} · ${jornada})`
                    : `Día ${dia}: Celda limpiada`;

                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p,
                        asignaciones: p.asignaciones.map(a =>
                            a.dia === dia && a.rol === (data.rol ?? a.rol) ? { ...a, ...data } : a
                        ),
                        actualizadoEn: new Date().toISOString(),
                        historialCambios: [...p.historialCambios, {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion,
                            tipo: 'asignacion' as const,
                        }],
                    })
                }));

                // ✅ Auto-sync to DB on EVERY change so nothing is lost even without clicking "Guardar"
                const updatedProg = get().programaciones.find(p => p.id === progId);
                if (updatedProg) {
                    syncProgramacionToDb(updatedProg);
                }
                logCambio(progId, usuario, descripcion, 'asignacion');

                return { permitido: true, tipo: 'ok', mensaje: 'Asignación registrada correctamente' };
            },

            publicarProgramacion: (progId, usuario) => {
                set(s => ({
                    programaciones: s.programaciones.map(p => p.id !== progId ? p : {
                        ...p,
                        estado: 'publicado' as const,
                        version: p.version + 1,
                        actualizadoEn: new Date().toISOString(),
                        historialCambios: [...p.historialCambios, {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            usuario,
                            descripcion: 'Programación PUBLICADA como versión definitiva',
                            tipo: 'publicacion' as const,
                        }],
                    })
                }));

                const prog = get().programaciones.find(p => p.id === progId);
                if (prog) {
                    syncProgramacionToDb(prog);
                    logCambio(progId, usuario, 'Programación PUBLICADA como versión definitiva', 'publicacion');
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
                    syncProgramacionToDb(prog);
                    logCambio(progId, usuario, 'Borrador guardado', 'borrador');
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
                                descripcion: `Plantilla "${tpl.nombre}" aplicada — datos copiados y listos para modificar`,
                                tipo: 'borrador' as const,
                            }],
                        })
                    }));
                    const prog = get().programaciones.find(p => p.id === existing.id);
                    if (prog) syncProgramacionToDb(prog);
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
                            descripcion: `Programación creada desde plantilla "${tpl.nombre}" para ${MONTH_NAMES[mes]} ${anio}`,
                            tipo: 'borrador',
                        }],
                    };
                    set(s => ({ programaciones: [...s.programaciones, nueva] }));
                    syncProgramacionToDb(nueva);
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
        }),
        {
            name: 'coraza-programacion-v3',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.programaciones = (state.programaciones || []).map(p => ({
                        ...p,
                        personal: p.personal || [],
                        asignaciones: p.asignaciones || [],
                        historialCambios: p.historialCambios || []
                    }));
                    state.templates = state.templates || [];
                }
            }
        }
    )
);
