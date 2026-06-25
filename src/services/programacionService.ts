import { supabase } from '../lib/supabase';
import type { ProgramacionMensual } from '../store/programacionTypes';

export const ProgramacionService = {
    async fetchHeaders(empresaId: string, anio: number, mes: number) {
        let allRows: any[] = [];
        let from = 0;
        const BATCH = 1000;
        
        while (true) {
            const { data, error } = await supabase
                .from('programaciones_mensuales')
                .select('*')
                .eq('empresa_id', empresaId)
                .eq('anio', anio)
                .eq('mes', mes)
                .range(from, from + BATCH - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows = [...allRows, ...data];
            from += BATCH;
            if (allRows.length >= 7000) break;
        }
        return allRows;
    },

    async upsertHeader(empresaId: string, prog: ProgramacionMensual) {
        const personalPayload = (prog.personal || [])
            .filter(p => p.rol)
            .map(p => ({
                rol: p.rol,
                vigilanteId: p.vigilanteId || null,
                turnoId: p.turnoId || null,
                displayName: p.displayName || null
            }));

        const { data, error } = await supabase
            .from('programaciones_mensuales')
            .upsert({
                empresa_id: empresaId,
                puesto_id: prog.puestoId,
                anio: prog.anio,
                mes: prog.mes,
                estado: prog.estado || 'borrador',
                personal: personalPayload,
                historial_cambios: (prog as any).historialCambios || [],
                updated_at: new Date().toISOString()
            }, { onConflict: 'empresa_id,puesto_id,anio,mes' })
            .select('id')
            .single();

        if (error) throw error;
        return data;
    },

    async upsertPersonal(progId: string, personal: any[]) {
        console.log('[ProgramacionService] upsertPersonal is no-op: managed directly in programaciones_mensuales');
    },

    async upsertAsignaciones(asignaciones: any[]) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < asignaciones.length; i += BATCH_SIZE) {
            const chunk = asignaciones.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('asignaciones_programacion')
                .upsert(chunk, { onConflict: 'programacion_id,dia,rol' });
            if (error) throw error;
        }
    }
};
