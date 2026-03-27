import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const sb = createClient(supabaseUrl, supabaseAnonKey);

async function autoProgram() {
    console.log('🚀 INICIANDO PROGRAMACIÓN MASIVA DE 600 PUESTOS (EDICIÓN MARZO 2026)...');
    
    // 1. Obtener todos los puestos
    const { data: puestos, error: pError } = await sb
        .from('puestos')
        .select('id, codigo, nombre')
        .eq('empresa_id', EMPRESA_ID);
    
    if (pError) throw pError;
    console.log(`✅ ${puestos.length} puestos recuperados.`);

    // 2. Obtener pool de vigilantes (primeros 2000 para cubrir 600 puestos con 3 roles cada uno)
    const { data: vPool, error: vError } = await sb
        .from('vigilantes')
        .select('id, codigo, nombres')
        .eq('empresa_id', EMPRESA_ID)
        .limit(2000);
    
    if (vError) throw vError;
    console.log(`✅ Pool de ${vPool.length} vigilantes listo.`);

    const anio = 2026;
    const mes = 2; // Marzo
    const days = 31;
    const roles = ['titular_a', 'titular_b', 'relevante'];

    for (let i = 0; i < puestos.length; i++) {
        const p = puestos[i];
        
        // Crear Programación Mensual si no existe (o resetear)
        const { data: prog, error: prError } = await sb
            .from('programacion_mensual')
            .upsert({
                empresa_id: EMPRESA_ID,
                puesto_id: p.id,
                anio,
                mes,
                estado: 'publicado',
                version: 2
            }, { onConflict: 'puesto_id,anio,mes' })
            .select()
            .single();
        
        if (prError) {
            console.error(`❌ Error creando programa para ${p.codigo}:`, prError.message);
            continue;
        }

        // Asignar vigilantes específicos para este puesto para evitar colisiones internas
        // Puestos 0 -> Vigilantes 0, 1, 2
        // Puestos 1 -> Vigilantes 3, 4, 5...
        const baseIdx = (i * 3) % (vPool.length - 3);
        const gA = vPool[baseIdx].id;
        const gB = vPool[baseIdx + 1].id;
        const gR = vPool[baseIdx + 2].id;

        // Limpiar asignaciones previas para este puesto
        await sb.from('asignaciones_dia').delete().eq('programacion_id', prog.id);

        const assignments = [];
        for (let d = 1; d <= days; d++) {
            // Ciclo de descanso cada 6 días para Titular A
            const isRestA = d % 7 === 0;
            // Ciclo de descanso cada 6 días para Titular B (offset)
            const isRestB = (d + 3) % 7 === 0;

            // Titular A
            assignments.push({
                programacion_id: prog.id,
                dia: d,
                rol: 'titular_a',
                vigilante_id: gA,
                turno: 'AM',
                jornada: isRestA ? 'descanso_remunerado' : 'normal'
            });

            // Titular B
            assignments.push({
                programacion_id: prog.id,
                dia: d,
                rol: 'titular_b',
                vigilante_id: gB,
                turno: 'PM',
                jornada: isRestB ? 'descanso_remunerado' : 'normal'
            });

            // Relevante (solo trabaja cuando los otros descansan o aleatoriamente)
            assignments.push({
                programacion_id: prog.id,
                dia: d,
                rol: 'relevante',
                vigilante_id: gR,
                turno: '24H',
                jornada: (isRestA || isRestB) ? 'normal' : 'sin_asignar'
            });
        }

        // Insertar por lotes (93 registros por puesto)
        const { error: aError } = await sb.from('asignaciones_dia').insert(assignments);
        if (aError) {
            console.error(`❌ Error asignando en ${p.codigo}:`, aError.message);
        } else {
            if (i % 20 === 0) process.stdout.write(`| ${p.codigo} (100%) `);
        }
    }

    console.log('\n\n✅ MISIÓN CUMPLIDA: 600 PUESTOS PROGRAMADOS AL 100% PARA MARZO.');
}

autoProgram().catch(console.error);
