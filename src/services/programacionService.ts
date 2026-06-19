import { supabase, EMPRESA_ID } from '../lib/supabase';
import type { ProgramacionMensual, PersonalPuesto, AsignacionDia, EstadoProgramacion, SyncResult } from '../store/programacionTypes';

export const ProgramacionService = {
    async fetchHeaders(empresaId: string, anio: number, mes: number) {
        let allRows: any[] = [];
        let from = 0;
        const BATCH = 1000;
        
        while (true) {
            const { data, error } = await supabase
                .from('programacion_mensual')
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
        const { data, error } = await supabase
            .from('programacion_mensual')
            .upsert({
                empresa_id: empresaId,
                puesto_id: prog.puestoId,
                anio: prog.anio,
                mes: prog.mes,
                estado: prog.estado || 'borrador',
                updated_at: new Date().toISOString()
            }, { onConflict: 'empresa_id,puesto_id,anio,mes' })
            .select('id')
            .single();

        if (error) throw error;
        return data;
    },

    async upsertPersonal(progId: string, personal: any[]) {
        const { error } = await supabase
            .from('personal_puesto')
            .upsert(personal, { onConflict: 'programacion_id,rol' });
        if (error) console.warn('[ProgramacionService] Personal warning:', error.message);
    },

    async upsertAsignaciones(asignaciones: any[]) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < asignaciones.length; i += BATCH_SIZE) {
            const chunk = asignaciones.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('asignaciones_dia')
                .upsert(chunk, { onConflict: 'programacion_id,dia,rol' });
            if (error) throw error;
        }
    }
};
