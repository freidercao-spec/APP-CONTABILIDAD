import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';
import { showTacticalToast } from '../utils/tacticalToast';
import { useVigilanteStore } from './vigilanteStore';
import { useAuthStore } from './authStore';

export interface TurnoVigilante {
    vigilanteId: string;
    horaInicio: string;
    horaFin: string;
    dia?: string;
}

export interface HistorialPuesto {
    id: string;
    timestamp: string;
    action: 'creacion' | 'asignacion' | 'remocion' | 'cambio' | 'cobertura';
    vigilanteId?: string;
    details: string;
}

export interface TurnoConfig {
    id: string;
    nombre: string;
    inicio: string;
    fin: string;
    color?: string;
}

export interface JornadaCustom {
    id: string;
    nombre: string;
    short: string;
    color: string;
    textColor: string;
}

export interface Puesto {
    id: string;       // MED-0001 format (maps to "codigo" in DB)
    dbId?: string;     // UUID from Supabase
    nombre: string;
    tipo: 'hospital' | 'comando' | 'torre' | 'edificio' | 'retail' | 'logistica' | 'banco' | 'puerto';
    lat: number;
    lng: number;
    elevacion: number;
    estado: 'cubierto' | 'alerta' | 'desprotegido';
    fechaRegistro: string;
    turnos: TurnoVigilante[];
    historial: HistorialPuesto[];
    coberturas?: string[];
    contacto?: string;
    telefono?: string;
    requisitos?: string;
    instrucciones?: string;
    prioridad?: 'baja' | 'media' | 'alta' | 'critica';
    numeroContrato?: string;
    cliente?: string;
    tipoServicio?: string;
    direccion?: string;
    conArmamento?: boolean;
    turnosConfig?: TurnoConfig[];
    jornadasCustom?: JornadaCustom[];
    plantillaRecurrente?: {
        activa: boolean;
        asignaciones: import('./programacionStore').AsignacionDia[];
        personal: import('./programacionStore').PersonalPuesto[];
        desdeAnio: number;
        desMes: number;
    } | null;
}

interface PuestoState {
    puestos: Puesto[];
    nextIdNumber: number;
    loaded: boolean;

    fetchPuestos: () => Promise<void>;
    addPuesto: (
        nombre: string,
        tipo: Puesto['tipo'],
        lat: number,
        lng: number,
        elevacion?: number,
        detalles?: {
            contacto?: string;
            telefono?: string;
            requisitos?: string;
            instrucciones?: string;
            prioridad?: Puesto['prioridad'];
            coberturas?: string[];
            numeroContrato?: string;
            cliente?: string;
            tipoServicio?: string;
            direccion?: string;
            conArmamento?: boolean;
        }
    ) => Promise<string>;
    updatePuestoStatus: (id: string, estado: Puesto['estado']) => void;
    deletePuesto: (id: string) => void;
    updatePuesto: (id: string, changes: Partial<Pick<Puesto, 'turnosConfig'|'jornadasCustom'|'plantillaRecurrente'|'nombre'|'contacto'|'telefono'|'requisitos'|'instrucciones'|'prioridad'|'numeroContrato'|'cliente'|'tipoServicio'|'direccion'|'conArmamento'>>) => void;

    assignGuard: (puestoId: string, vigilanteId: string, horaInicio: string, horaFin: string) => void;
    removeGuard: (puestoId: string, vigilanteId: string, reason?: string) => void;

    getCobertura24Horas: (puestoId: string) => { completa: boolean; huecos: string[] };
    verificarCoberturaTotal: () => { puestosDesprotegidos: Puesto[] };
}

// Nota: el estado de un puesto se calcula dinámicamente al cargarlo
// (cubierto si tiene turnos activos, desprotegido si no)

export const usePuestoStore = create<PuestoState>()(
    (set, get) => ({
            puestos: [],
            nextIdNumber: 1,
            loaded: false,

            fetchPuestos: async () => {
                try {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    
                    let allRows: any[] = [];
                    let from = 0;
                    const BATCH = 1000;
                    
                    while (true) {
                        const { data, error } = await supabase
                            .from('puestos')
                            .select('*')
                            .eq('empresa_id', currentEmpresaId)
                            .range(from, from + BATCH - 1)
                            .eq('estado', 'Activo')
                            .order('codigo', { ascending: true });

                        if (error) {
                            console.error('Error fetching puestos batch:', error);
                            break;
                        }
                        if (!data || data.length === 0) break;
                        
                        allRows = [...allRows, ...data];
                        from += BATCH;
                        if (allRows.length >= 10000) break;
                    }

                    const rows = allRows;
                    if (!rows || rows.length === 0) {
                        set({ puestos: [], loaded: true });
                        return;
                    }


                    // PERFORMANCE CRÍTICA: Pre-mapear vigilancia para evitar O(n^2) en la traducción de IDs
                    const currentVigilantes = useVigilanteStore.getState().vigilantes;
                    const vigLookup = new Map<string, string>();
                    currentVigilantes.forEach(v => {
                        if (v.dbId) vigLookup.set(v.dbId, v.id);
                        vigLookup.set(v.id, v.id);
                    });

                    const translateVigFromDb = (dbId: string | null) => {
                        if (!dbId) return null;
                        return vigLookup.get(dbId) || dbId;
                    };

                    const puestoIds = rows.map(r => r.id);

                    // LIMITES DE URL: chunkSize seguro para evitar HTTP 414 URI Too Long (~140 UUIDs max en GET)
                    const CHUNK_SIZE = 140;
                    let allTurnos: any[] = [];
                    let allHistorial: any[] = [];

                    for (let i = 0; i < puestoIds.length; i += CHUNK_SIZE) {
                        const chunk = puestoIds.slice(i, i + CHUNK_SIZE);
                        const [turnosRes, histRes] = await Promise.all([
                            supabase.from('turnos_puesto').select('*').in('puesto_id', chunk),
                            supabase.from('historial_puesto').select('*').in('puesto_id', chunk).order('created_at', { ascending: true })
                        ]);

                        if (turnosRes.data) allTurnos = [...allTurnos, ...turnosRes.data];
                        if (histRes.data) allHistorial = [...allHistorial, ...histRes.data];
                    }

                    // Pre-agrupar para evitar .filter() en cada iteración
                    const turnsByPuestoId = new Map<string, any[]>();
                    allTurnos.forEach(t => {
                        if (!turnsByPuestoId.has(t.puesto_id)) turnsByPuestoId.set(t.puesto_id, []);
                        turnsByPuestoId.get(t.puesto_id)!.push(t);
                    });

                    const histByPuestoId = new Map<string, any[]>();
                    allHistorial.forEach(h => {
                        if (!histByPuestoId.has(h.puesto_id)) histByPuestoId.set(h.puesto_id, []);
                        histByPuestoId.get(h.puesto_id)!.push(h);
                    });

                    const puestos: Puesto[] = rows.map(row => {
                        const turnos = (turnsByPuestoId.get(row.id) || [])
                            .map(t => ({
                                vigilanteId: translateVigFromDb(t.vigilante_id) as string,
                                horaInicio: t.hora_inicio,
                                horaFin: t.hora_fin,
                                dia: t.dia || undefined,
                            }));

                        const historial = (histByPuestoId.get(row.id) || [])
                            .map(h => ({
                                id: h.id,
                                timestamp: h.created_at,
                                action: h.accion as HistorialPuesto['action'],
                                vigilanteId: translateVigFromDb(h.vigilante_id) as string || undefined,
                                details: h.detalles || '',
                            }));

                        return {
                            id: row.codigo,
                            dbId: row.id,
                            nombre: row.nombre,
                            tipo: row.tipo as Puesto['tipo'],
                            lat: parseFloat(row.latitud) || 6.2308,
                            lng: parseFloat(row.longitud) || -75.5667,
                            elevacion: 9.14,
                            estado: turnos.length > 0 ? 'cubierto' as const : 'desprotegido' as const,
                            fechaRegistro: row.created_at,
                            turnos,
                            historial,
                            contacto: row.contacto || undefined,
                            telefono: row.telefono || undefined,
                            requisitos: row.requisitos || undefined,
                            instrucciones: row.instrucciones || undefined,
                            prioridad: (row.prioridad as Puesto['prioridad']) || 'media',
                            numeroContrato: row.numero_contrato || undefined,
                            cliente: row.cliente || undefined,
                            tipoServicio: row.tipo_servicio || undefined,
                            direccion: row.direccion || undefined,
                            conArmamento: row.con_armamento || false,
                            coberturas: [],
                            turnosConfig: row.turnos_config || [],
                            jornadasCustom: row.jornadas_custom || [],
                            plantillaRecurrente: row.plantilla_recurrente || null,
                        };
                    });

                    let maxNum = 0;
                    puestos.forEach(p => {
                        const match = p.id.match(/MED-(\d+)/);
                        if (match) {
                            const num = parseInt(match[1], 10);
                            if (num > maxNum) maxNum = num;
                        }
                    });

                    set({ puestos, nextIdNumber: maxNum + 1, loaded: true });
                } catch (err) {
                    console.error('Error in fetchPuestos:', err);
                    set({ loaded: true });
                }
            },

            addPuesto: async (nombre, tipo, lat, lng, elevacion, detalles) => {
                try {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    const { data: inserted, error } = await supabase
                        .from('puestos')
                        .insert({
                            empresa_id: currentEmpresaId,
                            nombre,
                            tipo,
                            latitud: lat,
                            longitud: lng,
                            contacto: detalles?.contacto || null,
                            telefono: detalles?.telefono || null,
                            requisitos: detalles?.requisitos || null,
                            instrucciones: detalles?.instrucciones || null,
                            prioridad: detalles?.prioridad || 'media',
                            numero_contrato: detalles?.numeroContrato || null,
                            cliente: detalles?.cliente || null,
                            tipo_servicio: detalles?.tipoServicio || null,
                            direccion: detalles?.direccion || null,
                            con_armamento: detalles?.conArmamento || false,
                        })
                        .select()
                        .single();

                    if (error) {
                        console.error('Error inserting puesto:', error);
                        showTacticalToast({ title: 'Error', message: `No se pudo crear el puesto: ${error.message}`, type: 'error' });
                        return '';
                    }

                    const codigo = inserted.codigo;
                    const { useAuditStore } = await import('./auditStore');
                    useAuditStore.getState().logAction('PUESTOS', 'Nuevo Puesto', `Puesto ${codigo} (${nombre}) registrado en red.`, 'success');

                    await supabase.from('historial_puesto').insert({
                        puesto_id: inserted.id,
                        accion: 'creacion',
                        detalles: `Puesto ${nombre} creado en el sistema`,
                    });

                    await get().fetchPuestos();

                    showTacticalToast({ title: 'Puesto Registrado', message: `Nodo ${codigo} activado en la red operativa.`, type: 'success' });
                    return codigo;
                } catch (err) {
                    console.error('Error adding puesto:', err);
                    showTacticalToast({ title: 'Error', message: 'Error de conexion al crear puesto.', type: 'error' });
                    return '';
                }
            },

            updatePuestoStatus: async (id, estado) => {
                const puesto = get().puestos.find(p => p.id === id);

                set((state) => ({
                    puestos: state.puestos.map((p) =>
                        p.id === id
                            ? {
                                ...p,
                                estado,
                                historial: [
                                    ...(p.historial || []),
                                    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'cambio' as const, details: `Estado cambiado a: ${estado.toUpperCase()}` }
                                ]
                            } : p
                    )
                }));

                if (puesto?.dbId) {
                    await supabase.from('historial_puesto').insert({
                        puesto_id: puesto.dbId,
                        accion: 'cambio',
                        detalles: `Estado cambiado a: ${estado.toUpperCase()}`,
                    });
                }
            },

            deletePuesto: async (id) => {
                const puesto = get().puestos.find(p => p.id === id);

                set((state) => ({
                    puestos: state.puestos.filter((p) => p.id !== id)
                }));

                if (puesto?.dbId) {
                    await supabase.from('puestos').update({ estado: 'Inactivo' }).eq('id', puesto.dbId);
                }

                showTacticalToast({ title: 'Puesto Removido', message: 'Nodo desactivado y eliminado del sistema.', type: 'warning' });
            },

            updatePuesto: async (id, changes) => {
                const puesto = get().puestos.find(p => p.id === id || p.dbId === id);

                set((state) => ({
                    puestos: state.puestos.map(p => (p.id === id || p.dbId === id) ? { ...p, ...changes } : p)
                }));

                if (puesto?.dbId) {
                    const dbUpdates: Record<string, any> = {};
                    if (changes.nombre !== undefined) dbUpdates.nombre = changes.nombre;
                    if (changes.contacto !== undefined) dbUpdates.contacto = changes.contacto;
                    if (changes.telefono !== undefined) dbUpdates.telefono = changes.telefono;
                    if (changes.requisitos !== undefined) dbUpdates.requisitos = changes.requisitos;
                    if (changes.instrucciones !== undefined) dbUpdates.instrucciones = changes.instrucciones;
                    if (changes.prioridad !== undefined) dbUpdates.prioridad = changes.prioridad;
                    if (changes.numeroContrato !== undefined) dbUpdates.numero_contrato = changes.numeroContrato;
                    if (changes.cliente !== undefined) dbUpdates.cliente = changes.cliente;
                    if (changes.tipoServicio !== undefined) dbUpdates.tipo_servicio = changes.tipoServicio;
                    if (changes.direccion !== undefined) dbUpdates.direccion = changes.direccion;
                    if (changes.conArmamento !== undefined) dbUpdates.con_armamento = changes.conArmamento;
                    if (changes.turnosConfig !== undefined) dbUpdates.turnos_config = changes.turnosConfig;
                    if (changes.jornadasCustom !== undefined) dbUpdates.jornadas_custom = changes.jornadasCustom;
                    if (changes.plantillaRecurrente !== undefined) dbUpdates.plantilla_recurrente = changes.plantillaRecurrente;

                    if (Object.keys(dbUpdates).length > 0) {
                        const { useAuditStore } = await import('./auditStore');
                        useAuditStore.getState().logAction('PUESTOS', 'Edicion Puesto', `Actualizacion de parametros para el puesto ${id}.`, 'info');
                        await supabase.from('puestos').update(dbUpdates).eq('id', puesto.dbId);
                    }
                }
            },

            assignGuard: async (puestoId, vigilanteId, horaInicio, horaFin) => {
                if (horaInicio >= horaFin) {
                    showTacticalToast({ title: 'Inconsistencia de Tiempo', message: 'La hora de inicio debe ser cronologicamente anterior a la de fin.', type: 'error' });
                    return;
                }

                // Helper: translate HID to UUID
                const translateVigToUuid = (id: string | null): string | null => {
                    if (!id) return null;
                    if (id.length > 20) return id;
                    const v = useVigilanteStore.getState().vigilantes.find(vg => vg.id === id);
                    return v?.dbId || id;
                };

                const translatePuestoToUuid = (id: string | null): string | null => {
                    if (!id) return null;
                    if (id.length > 20) return id;
                    const p = get().puestos.find(px => px.id === id);
                    return p?.dbId || id;
                };

                const puesto = get().puestos.find(p => p.id === puestoId);

                // Validate overlap
                const isInvalid = get().puestos.some(p =>
                    p.turnos.some(t => {
                        const isSameGuardOtherPost = t.vigilanteId === vigilanteId && p.id !== puestoId;
                        const isOtherGuardSamePost = t.vigilanteId !== vigilanteId && p.id === puestoId;
                        if ((isSameGuardOtherPost || isOtherGuardSamePost) && (horaInicio < t.horaFin && t.horaInicio < horaFin)) return true;
                        return false;
                    })
                );

                if (isInvalid) {
                    showTacticalToast({ title: 'Conflicto TACTICO', message: 'Solapamiento de horarios detectado en la red de efectivos.', type: 'error' });
                    return;
                }

                const wasAssigned = puesto?.turnos.some(t => t.vigilanteId === vigilanteId);

                // Optimistic
                set((state) => ({
                    puestos: state.puestos.map((p) => {
                        if (p.id !== puestoId) return p;
                        const exists = p.turnos.find(t => t.vigilanteId === vigilanteId);
                        if (exists) {
                            return {
                                ...p,
                                turnos: p.turnos.map(t => t.vigilanteId === vigilanteId ? { ...t, horaInicio, horaFin } : t),
                                historial: [...(p.historial || []), { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'cambio' as const, vigilanteId, details: `Horario modificado: ${horaInicio} - ${horaFin}` }]
                            };
                        }
                        return {
                            ...p,
                            turnos: [...(p.turnos || []), { vigilanteId, horaInicio, horaFin }],
                            historial: [...(p.historial || []), { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'asignacion' as const, vigilanteId, details: `Nuevo vigilante asignado: ${horaInicio} - ${horaFin}` }]
                        };
                    })
                }));

                // Supabase sync
                const dbPuestoId = translatePuestoToUuid(puestoId);
                const dbVigilanteId = translateVigToUuid(vigilanteId);

                if (dbPuestoId && dbVigilanteId) {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    if (wasAssigned) {
                        await supabase.from('turnos_puesto')
                            .update({ hora_inicio: horaInicio, hora_fin: horaFin })
                            .eq('puesto_id', dbPuestoId)
                            .eq('vigilante_id', dbVigilanteId);
                    } else {
                        await supabase.from('turnos_puesto').insert({
                            empresa_id: currentEmpresaId,
                            puesto_id: dbPuestoId,
                            vigilante_id: dbVigilanteId,
                            hora_inicio: horaInicio,
                            hora_fin: horaFin,
                        });
                    }
                    await supabase.from('historial_puesto').insert({
                        puesto_id: dbPuestoId,
                        accion: wasAssigned ? 'cambio' : 'asignacion',
                        vigilante_id: dbVigilanteId,
                        detalles: wasAssigned ? `Horario modificado: ${horaInicio} - ${horaFin}` : `Nuevo vigilante asignado: ${horaInicio} - ${horaFin}`,
                    });
                    const { useAuditStore } = await import('./auditStore');
                    useAuditStore.getState().logAction('PUESTOS', wasAssigned ? 'Modificacion Turno' : 'Asignacion Turno', `${wasAssigned ? 'Modificado' : 'Asignado'} vigilante ${vigilanteId} al puesto ${puestoId}.`, 'info');
                }

                showTacticalToast({
                    title: wasAssigned ? 'Horario Modificado' : 'Efectivo Desplegado',
                    message: wasAssigned ? 'Cronograma actualizado para el puesto.' : 'Nuevo vigilante incorporado a la linea.',
                    type: 'success'
                });
            },

            removeGuard: async (puestoId, vigilanteId, reason = 'Removido por operador') => {
                const puesto = get().puestos.find(p => p.id === puestoId);

                set((state) => ({
                    puestos: state.puestos.map((p) =>
                        p.id === puestoId
                            ? {
                                ...p,
                                turnos: (p.turnos || []).filter(t => t.vigilanteId !== vigilanteId),
                                historial: [...(p.historial || []), { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'remocion' as const, vigilanteId, details: reason }]
                            } : p
                    )
                }));

                // Helper local (already defined in assignGuard scope, but this is a different method)
                const vigUuId = useVigilanteStore.getState().vigilantes.find(vg => vg.id === vigilanteId)?.dbId || vigilanteId;

                if (puesto?.dbId) {
                    await supabase.from('turnos_puesto')
                        .delete()
                        .eq('puesto_id', puesto.dbId)
                        .eq('vigilante_id', vigUuId);

                    await supabase.from('historial_puesto').insert({
                        puesto_id: puesto.dbId,
                        accion: 'remocion',
                        vigilante_id: vigUuId,
                        detalles: reason,
                    });
                }

                showTacticalToast({ title: 'Efectivo Retirado', message: 'El vigilante ha sido removido de su posicion actual.', type: 'info' });
            },

            getCobertura24Horas: (puestoId) => {
                const puesto = get().puestos.find(p => p.id === puestoId);
                if (!puesto || !puesto.turnos || puesto.turnos.length === 0) {
                    return { completa: false, huecos: ['00:00 - 24:00'] };
                }

                // Usamos un array de 48 slots (cada 30 min) para representar las 24h
                const slots = new Uint8Array(48); // 0 = vacío, 1 = cubierto
                
                puesto.turnos.forEach(turno => {
                    const [hI, mI] = turno.horaInicio.split(':').map(Number);
                    const [hF, mF] = turno.horaFin.split(':').map(Number);
                    
                    const startSlot = hI * 2 + (mI >= 30 ? 1 : 0);
                    const endSlot = hF * 2 + (mF >= 30 ? 1 : 0);
                    
                    // Manejo de turnos que cruzan la medianoche
                    if (startSlot < endSlot) {
                        for (let i = startSlot; i < endSlot; i++) slots[i] = 1;
                    } else if (startSlot > endSlot) {
                        // Turno de noche (ej: 22:00 a 06:00)
                        for (let i = startSlot; i < 48; i++) slots[i] = 1;
                        for (let i = 0; i < endSlot; i++) slots[i] = 1;
                    }
                });

                const huecos: string[] = [];
                let inGap = false;
                let gapStart = 0;

                for (let i = 0; i <= 48; i++) {
                    const isCovered = i < 48 ? slots[i] === 1 : true; // Cierre virtual al final
                    
                    if (!isCovered && !inGap) {
                        inGap = true;
                        gapStart = i;
                    } else if (isCovered && inGap) {
                        inGap = false;
                        const hS = Math.floor(gapStart / 2).toString().padStart(2, '0');
                        const mS = (gapStart % 2 === 0 ? '00' : '30');
                        const hE = Math.floor(i / 2).toString().padStart(2, '0');
                        const mE = (i % 2 === 0 ? '00' : '30');
                        huecos.push(`${hS}:${mS} - ${hE}:${mE}`);
                    }
                }

                return { completa: huecos.length === 0, huecos };
            },

            verificarCoberturaTotal: () => {
                const puestos = get().puestos;
                const desprotegidos = puestos.filter(p => {
                    const cobertura = get().getCobertura24Horas(p.id);
                    return !cobertura.completa;
                });
                return { puestosDesprotegidos: desprotegidos };
            }
        })
);
