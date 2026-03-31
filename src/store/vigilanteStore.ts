import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';
import { showTacticalToast } from '../utils/tacticalToast';
import { useAuthStore } from './authStore';

export interface GuardHistory {
    id: string;
    timestamp: string;
    action: string;
    details: string;
}

export interface Descargo {
    id: string;
    puestoId?: string;
    puestoNombre?: string;
    fecha: string;
    descripcion: string;
    tipo: 'disciplinario' | 'incidente' | 'queja' | 'administrativo';
    estado: 'activo' | 'resuelto';
}

export interface Vigilante {
    id: string; // C-0001 format (maps to "codigo" in DB)
    dbId?: string; // UUID from Supabase
    nombre: string;
    cedula: string;
    rango: string;
    estado: 'disponible' | 'activo' | 'ausente';
    foto?: string;
    puestoId?: string;
    fechaIngreso: string;
    historial: GuardHistory[];
    justificacionDisponible?: string;
    descargos: Descargo[];
    vacaciones?: {
        inicio: string;
        fin: string;
        motivo?: string;
    };
    telefono?: string;
    email?: string;
    especialidad?: string;
}

interface VigilanteState {
    vigilantes: Vigilante[];
    nextIdNumber: number;
    loaded: boolean;
    vigilanteMap: Map<string, Vigilante>;

    // Actions
    getVigilanteById: (id: string) => Vigilante | undefined;
    fetchVigilantes: (addLog?: (msg: string) => void) => Promise<void>;
    addVigilante: (
        nombre: string,
        cedula: string,
        rango: string,
        modulo: 'activo' | 'disponible',
        justificacion?: string,
        assignment?: { puestoId: string; horaInicio: string; horaFin: string }
    ) => Promise<string>;
    updateGuardStatus: (id: string, estado: Vigilante['estado'], puestoId?: string, justificacion?: string) => void;
    addActivity: (id: string, action: string, details: string) => void;
    deleteVigilante: (id: string) => void;
    addDescargo: (vigilanteId: string, descargo: Omit<Descargo, 'id'>) => void;
    resolverDescargo: (vigilanteId: string, descargoId: string) => void;
    setVacaciones: (vigilanteId: string, inicio: string, fin: string, motivo?: string) => void;
    cancelarVacaciones: (vigilanteId: string) => void;
    updateVigilante: (id: string, updates: Partial<Pick<Vigilante, 'nombre' | 'cedula' | 'rango' | 'foto' | 'telefono' | 'email' | 'especialidad'>>) => void;
    tieneDescargoEnPuesto: (vigilanteId: string, puestoId: string) => boolean;
}

// Helper: Map DB row → Vigilante
function mapDbToVigilante(row: any, historial: any[], descargos: any[], vacacion: any): Vigilante {
    return {
        id: row.codigo,
        dbId: row.id,
        nombre: `${row.nombres} ${row.apellidos}`.trim(),
        cedula: row.cedula,
        rango: row.rango || 'Vigilante',
        estado: row.estado as Vigilante['estado'],
        foto: row.foto_url || undefined,
        puestoId: row.puesto_actual_id || undefined,
        fechaIngreso: row.fecha_ingreso || row.created_at,
        justificacionDisponible: row.justificacion_disponible || undefined,
        telefono: row.telefono || undefined,
        email: row.email || undefined,
        especialidad: row.especialidad || undefined,
        historial: (historial || []).map((h: any) => ({
            id: h.id,
            timestamp: h.created_at,
            action: h.accion,
            details: h.detalles || '',
        })),
        descargos: (descargos || []).map((d: any) => ({
            id: d.id,
            puestoId: d.puesto_id || undefined,
            puestoNombre: d.puesto_nombre || undefined,
            fecha: d.fecha,
            descripcion: d.descripcion,
            tipo: d.tipo,
            estado: d.estado,
        })),
        vacaciones: vacacion ? {
            inicio: vacacion.fecha_inicio,
            fin: vacacion.fecha_fin,
            motivo: vacacion.motivo || undefined,
        } : undefined,
    };
}

export const useVigilanteStore = create<VigilanteState>()(
    (set, get) => ({
            vigilantes: [],
            nextIdNumber: 1,
            loaded: false,
            vigilanteMap: new Map(),

            getVigilanteById: (id: string) => {
                if (!id) return undefined;
                return get().vigilanteMap.get(id);
            },

            fetchVigilantes: async (addLog?: (msg: string) => void) => {
                try {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    
                    // 1. CARGA RÁPIDA: Primero obtenemos el conteo o estimación para paralelizar
                    const { count, error: countErr } = await supabase
                        .from('vigilantes')
                        .select('*', { count: 'exact', head: true })
                        .eq('empresa_id', currentEmpresaId)
                        // FIX: Excluir dados de baja para conteo correcto
                        .neq('estado', 'inactivo');

                    if (countErr) throw countErr;
                    
                    const totalRecords = count || 0;
                    const BATCH = 1000;
                    const fetchPromises = [];

                    for (let from = 0; from < totalRecords; from += BATCH) {
                        fetchPromises.push(
                            supabase
                                .from('vigilantes')
                                .select('*')
                                .eq('empresa_id', currentEmpresaId)
                                // FIX: No cargar registros inactivos (soft delete)
                                .neq('estado', 'inactivo')
                                .range(from, from + BATCH - 1)
                        );
                    }

                    const results = [];
                    // Fetch in sub-batches of 5 parallel requests to avoid browser network congestion
                    for (let i = 0; i < fetchPromises.length; i += 5) {
                        const batch = fetchPromises.slice(i, i + 5);
                        const batchResults = await Promise.all(batch);
                        results.push(...batchResults);
                        addLog?.(`📦 Vigilantes: Cargado ${Math.min((i + 5) * BATCH, totalRecords)} de ${totalRecords}...`);
                    }
                    
                    let allRows = results.flatMap((r: any) => r.data || []);
                    
                    if (allRows.length >= 25000) {
                        allRows = allRows.slice(0, 25000);
                    }

                    const rows = allRows;
                    if (rows.length === 0) {
                        set({ vigilantes: [], loaded: true });
                        return;
                    }

                    const vigilanteIds = rows.map(r => r.id);

                    // LIMITES DE URL: chunkSize seguro para evitar HTTP 414 URI Too Long (~140 UUIDs max en GET)
                    // PERFORMANCE CRÍTICA: Si hay miles de guardias, NO hacer 400 consultas de historial al inicio.
                    const CHUNK_SIZE = 140;
                    let allHistorial: any[] = [];
                    let allDescargos: any[] = [];
                    let allVacaciones: any[] = [];

                    if (vigilanteIds.length <= 1500) {
                        for (let i = 0; i < vigilanteIds.length; i += CHUNK_SIZE) {
                            const chunk = vigilanteIds.slice(i, i + CHUNK_SIZE);

                            const [histRes, descRes, vacRes] = await Promise.all([
                                supabase.from('historial_vigilante').select('*').in('vigilante_id', chunk).order('created_at', { ascending: true }),
                                supabase.from('descargos').select('*').in('vigilante_id', chunk),
                                supabase.from('vacaciones').select('*').in('vigilante_id', chunk).eq('estado', 'aprobado')
                            ]);

                            if (histRes.data) allHistorial = [...allHistorial, ...histRes.data];
                            if (descRes.data) allDescargos = [...allDescargos, ...descRes.data];
                            if (vacRes.data) allVacaciones = [...allVacaciones, ...vacRes.data];
                        }
                    } else {
                        console.log('[PERFORMANCE] Saltando historial completo por masividad. Se traerán en O(1).');
                    }

                    // Final mapping and lookup population
                    const vMap = new Map<string, Vigilante>();
                    let maxNum = 0;

                    const vigilantes: Vigilante[] = rows.map(row => {
                        const hist = (allHistorial || []).filter(h => h.vigilante_id === row.id);
                        const desc = (allDescargos || []).filter(d => d.vigilante_id === row.id);
                        const vac = (allVacaciones || []).find(v => v.vigilante_id === row.id);
                        const v = mapDbToVigilante(row, hist, desc, vac);
                        
                        // Index lookup for O(1) searches
                        vMap.set(v.id, v);
                        if (v.dbId) vMap.set(v.dbId, v);
                        
                        // Max number calculation
                        const match = v.id.match(/C-(\d+)/);
                        if (match) {
                            const num = parseInt(match[1], 10);
                            if (num > maxNum) maxNum = num;
                        }
                        return v;
                    });

                    set({ 
                        vigilantes, 
                        vigilanteMap: vMap,
                        nextIdNumber: maxNum + 1, 
                        loaded: true 
                    });
                } catch (err) {
                    console.error('Error in fetchVigilantes:', err);
                    set({ loaded: true });
                }
            },

            addVigilante: async (nombre, cedula, rango, modulo, justificacion, assignment) => {
                const { useAuditStore } = await import('./auditStore');
                const logAction = useAuditStore.getState().logAction;
                const nameParts = nombre.trim().split(' ');
                const nombres = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ');
                const apellidos = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ') || nombres;

                try {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    // Insert into Supabase - codigo is auto-generated by trigger
                    const { data: inserted, error } = await supabase
                        .from('vigilantes')
                        .insert({
                            empresa_id: currentEmpresaId,
                            cedula,
                            nombres,
                            apellidos,
                            rango,
                            estado: modulo === 'activo' ? 'activo' : 'disponible',
                            puesto_actual_id: assignment?.puestoId || null,
                            justificacion_disponible: modulo === 'disponible' ? justificacion : null,
                            fecha_ingreso: new Date().toISOString().split('T')[0],
                        })
                        .select()
                        .single();

                    if (error) {
                        console.error('Error inserting vigilante:', error);
                        showTacticalToast({ title: 'Error', message: `No se pudo registrar: ${error.message}`, type: 'error' });
                        return '';
                    }

                    const codigo = inserted.codigo;
                    logAction('VIGILANTES', 'Registro Inicial', `Efectivo ${codigo} (${nombre}) incorporado al sistema.`, 'success');

                    // Insert initial historial
                    await supabase.from('historial_vigilante').insert({
                        vigilante_id: inserted.id,
                        accion: 'Registro Inicial',
                        detalles: `Ingreso al sistema con codigo tactico ${codigo}. Modulo: ${modulo === 'activo' ? 'Vigilantes Activos' : 'Personal Disponible'}`,
                    });

                    // Refresh from DB
                    await get().fetchVigilantes();

                    showTacticalToast({
                        title: 'Efectivo Registrado',
                        message: `Vigilante ${codigo} incorporado exitosamente al modulo de ${modulo === 'activo' ? 'Personal Activo' : 'Personal Disponible'}.`,
                        type: 'success'
                    });
                    return codigo;
                } catch (err) {
                    console.error('Error adding vigilante:', err);
                    showTacticalToast({ title: 'Error', message: 'Error de conexion al registrar vigilante.', type: 'error' });
                    return '';
                }
            },

            updateGuardStatus: async (id, estado, puestoId, justificacion) => {
                const { useAuditStore } = await import('./auditStore');
                const logAction = useAuditStore.getState().logAction;
                const vigilante = get().vigilantes.find(v => v.id === id);
                if (!vigilante?.dbId) return;

                logAction('VIGILANTES', 'Cambio de Estado', `Efectivo ${id} paso a estado ${estado.toUpperCase()}${justificacion ? `. Motivo: ${justificacion}` : ''}`, 'info');

                // Optimistic update
                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === id
                            ? {
                                ...v,
                                estado,
                                puestoId: estado === 'disponible' ? undefined : (puestoId !== undefined ? (puestoId || undefined) : v.puestoId),
                                justificacionDisponible: estado === 'disponible' && justificacion ? justificacion : v.justificacionDisponible,
                                historial: [
                                    ...(v.historial || []),
                                    {
                                        id: crypto.randomUUID(),
                                        timestamp: new Date().toISOString(),
                                        action: 'Cambio de Estado',
                                        details: `Transicion a ${estado.toUpperCase()}${puestoId ? ` en puesto ${puestoId}` : ''}${justificacion ? `. Motivo: ${justificacion}` : ''}`
                                    }
                                ]
                            }
                            : v
                    )
                }));

                // Write to Supabase
                await supabase
                    .from('vigilantes')
                    .update({
                        estado,
                        puesto_actual_id: estado === 'disponible' ? null : (puestoId || vigilante.puestoId || null),
                        justificacion_disponible: estado === 'disponible' && justificacion ? justificacion : null,
                    })
                    .eq('id', vigilante.dbId);

                await supabase.from('historial_vigilante').insert({
                    vigilante_id: vigilante.dbId,
                    accion: 'Cambio de Estado',
                    detalles: `Transicion a ${estado.toUpperCase()}${puestoId ? ` en puesto ${puestoId}` : ''}${justificacion ? `. Motivo: ${justificacion}` : ''}`,
                });
            },

            addActivity: async (id, action, details) => {
                const vigilante = get().vigilantes.find(v => v.id === id);

                // Optimistic
                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === id
                            ? {
                                ...v,
                                historial: [
                                    ...(v.historial || []),
                                    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action, details }
                                ]
                            }
                            : v
                    )
                }));

                if (vigilante?.dbId) {
                    await supabase.from('historial_vigilante').insert({
                        vigilante_id: vigilante.dbId,
                        accion: action,
                        detalles: details,
                    });
                }
            },

            deleteVigilante: async (id) => {
                const vigilante = get().vigilantes.find(v => v.id === id);

                // Optimistic
                set((state) => ({
                    vigilantes: state.vigilantes.filter((v) => v.id !== id)
                }));

                if (vigilante?.dbId) {
                    const { useAuditStore } = await import('./auditStore');
                    useAuditStore.getState().logAction('VIGILANTES', 'Baja de Efectivo', `Efectivo ${id} (${vigilante.nombre}) dado de baja del sistema.`, 'warning');

                    await supabase
                        .from('vigilantes')
                        .update({ estado: 'inactivo' })
                        .eq('id', vigilante.dbId);
                }
            },

            addDescargo: async (vigilanteId, descargo) => {
                const vigilante = get().vigilantes.find(v => v.id === vigilanteId);
                const newId = crypto.randomUUID();

                // Optimistic
                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === vigilanteId
                            ? {
                                ...v,
                                descargos: [...(v.descargos || []), { ...descargo, id: newId }],
                                historial: [
                                    ...(v.historial || []),
                                    {
                                        id: crypto.randomUUID(),
                                        timestamp: new Date().toISOString(),
                                        action: 'Descargo Registrado',
                                        details: `${descargo.tipo.toUpperCase()}: ${descargo.descripcion}`
                                    }
                                ]
                            }
                            : v
                    )
                }));

                if (vigilante?.dbId) {
                    const currentEmpresaId = useAuthStore.getState().empresaId || EMPRESA_ID;
                    await supabase.from('descargos').insert({
                        empresa_id: currentEmpresaId,
                        vigilante_id: vigilante.dbId,
                        puesto_id: descargo.puestoId || null,
                        puesto_nombre: descargo.puestoNombre || null,
                        fecha: descargo.fecha,
                        descripcion: descargo.descripcion,
                        tipo: descargo.tipo,
                        estado: descargo.estado,
                    });
                    await supabase.from('historial_vigilante').insert({
                        vigilante_id: vigilante.dbId,
                        accion: 'Descargo Registrado',
                        detalles: `${descargo.tipo.toUpperCase()}: ${descargo.descripcion}`,
                    });
                }

                showTacticalToast({ title: 'Descargo Registrado', message: 'Nueva incidencia vinculada al historial del efectivo.', type: 'warning' });
            },

            resolverDescargo: async (vigilanteId, descargoId) => {
                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === vigilanteId
                            ? { ...v, descargos: (v.descargos || []).map(d => d.id === descargoId ? { ...d, estado: 'resuelto' as const } : d) }
                            : v
                    )
                }));

                await supabase
                    .from('descargos')
                    .update({ estado: 'resuelto' })
                    .eq('id', descargoId);

                showTacticalToast({ title: 'Caso Resuelto', message: 'El descargo administrativo ha sido marcado como resuelto.', type: 'success' });
            },

            setVacaciones: async (vigilanteId, inicio, fin, motivo) => {
                const vigilante = get().vigilantes.find(v => v.id === vigilanteId);

                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === vigilanteId
                            ? {
                                ...v,
                                vacaciones: { inicio, fin, motivo },
                                historial: [
                                    ...(v.historial || []),
                                    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'Vacaciones Programadas', details: `Del ${inicio} al ${fin}${motivo ? '. ' + motivo : ''}` }
                                ]
                            }
                            : v
                    )
                }));

                if (vigilante?.dbId) {
                    // CORRECCIÓN: Cancelar vacaciones previas antes de insertar las nuevas
                    // Evita duplicados en la tabla vacaciones
                    await supabase
                        .from('vacaciones')
                        .update({ estado: 'cancelado' })
                        .eq('vigilante_id', vigilante.dbId)
                        .eq('estado', 'aprobado');
                    
                    await supabase.from('vacaciones').insert({
                        vigilante_id: vigilante.dbId,
                        fecha_inicio: inicio,
                        fecha_fin: fin,
                        motivo: motivo || null,
                        estado: 'aprobado',
                    });
                    await supabase.from('historial_vigilante').insert({
                        vigilante_id: vigilante.dbId,
                        accion: 'Vacaciones Programadas',
                        detalles: `Del ${inicio} al ${fin}${motivo ? '. ' + motivo : ''}`,
                    });
                }

                showTacticalToast({ title: 'Licencia Programada', message: `Ciclo de vacaciones registrado para el efectivo ${vigilanteId}.`, type: 'info' });
            },

            cancelarVacaciones: async (vigilanteId) => {
                const vigilante = get().vigilantes.find(v => v.id === vigilanteId);
                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === vigilanteId ? { ...v, vacaciones: undefined } : v
                    )
                }));

                if (vigilante?.dbId) {
                    await supabase
                        .from('vacaciones')
                        .update({ estado: 'cancelado' })
                        .eq('vigilante_id', vigilante.dbId)
                        .eq('estado', 'aprobado');
                }
            },

            updateVigilante: async (id, updates) => {
                const { useAuditStore } = await import('./auditStore');
                const logAction = useAuditStore.getState().logAction;
                const vigilante = get().vigilantes.find(v => v.id === id);

                logAction('VIGILANTES', 'Edicion Perfil', `Se actualizaron datos del efectivo ${id} (${vigilante?.nombre}).`, 'info');

                set((state) => ({
                    vigilantes: state.vigilantes.map((v) =>
                        v.id === id
                            ? {
                                ...v,
                                ...updates,
                                historial: [
                                    ...(v.historial || []),
                                    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'Perfil Actualizado', details: `Se modificaron datos del perfil: ${Object.keys(updates).join(', ')}` }
                                ]
                            }
                            : v
                    )
                }));

                if (vigilante?.dbId) {
                    const dbUpdates: Record<string, any> = {};
                    if (updates.nombre) {
                        const parts = updates.nombre.trim().split(' ');
                        dbUpdates.nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
                        dbUpdates.apellidos = parts.slice(Math.ceil(parts.length / 2)).join(' ') || dbUpdates.nombres;
                    }
                    if (updates.cedula) dbUpdates.cedula = updates.cedula;
                    if (updates.rango) dbUpdates.rango = updates.rango;
                    if (updates.foto) dbUpdates.foto_url = updates.foto;
                    if (updates.telefono) dbUpdates.telefono = updates.telefono;
                    if (updates.email) dbUpdates.email = updates.email;
                    if (updates.especialidad) dbUpdates.especialidad = updates.especialidad;

                    if (Object.keys(dbUpdates).length > 0) {
                        await supabase.from('vigilantes').update(dbUpdates).eq('id', vigilante.dbId);
                    }
                    await supabase.from('historial_vigilante').insert({
                        vigilante_id: vigilante.dbId,
                        accion: 'Perfil Actualizado',
                        detalles: `Se modificaron datos del perfil: ${Object.keys(updates).join(', ')}`,
                    });
                }

                showTacticalToast({ title: 'Perfil Actualizado', message: 'La informacion del efectivo ha sido modificada correctamente.', type: 'success' });
            },

            tieneDescargoEnPuesto: (vigilanteId, puestoId) => {
                const v = get().vigilantes.find(v => v.id === vigilanteId);
                if (!v) return false;
                return (v.descargos || []).some(
                    d => d.estado === 'activo' && (d.puestoId === puestoId || !d.puestoId)
                );
            }
        })
);
