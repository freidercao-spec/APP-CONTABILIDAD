import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function seedMissing() {
    console.log('🔍 Buscando puestos sin programa para Marzo...');
    const { data: puestos } = await supabase.from('puestos').select('id, codigo').eq('empresa_id', EMPRESA_ID);
    const { data: progs } = await supabase.from('programacion_mensual').select('puesto_id').eq('anio', 2026).eq('mes', 2);
    const existingPIds = new Set(progs.map(p => p.puesto_id));
    const missing = puestos.filter(p => !existingPIds.has(p.id));

    console.log(`Faltan ${missing.length} puestos.`);
    const { data: v } = await supabase.from('vigilantes').select('id').limit(100);
    const vigilantes = v || [];

    for (let i = 0; i < missing.length; i++) {
        const p = missing[i];
        const { data: prog } = await supabase.from('programacion_mensual').insert({
            puesto_id: p.id, anio: 2026, mes: 2, empresa_id: EMPRESA_ID, estado: 'publicado', version: 1
        }).select('id').single();

        if (prog) {
            const pId = prog.id;
            const vIdx = (i * 3) % vigilantes.length;
            const vA = vigilantes[vIdx].id;
            const vB = vigilantes[(vIdx + 1) % vigilantes.length].id;
            const vR = vigilantes[(vIdx + 2) % vigilantes.length].id;

            await supabase.from('personal_puesto').insert([
                { programacion_id: pId, vigilante_id: vA, rol: 'titular_a' },
                { programacion_id: pId, vigilante_id: vB, rol: 'titular_b' },
                { programacion_id: pId, vigilante_id: vR, rol: 'relevante' }
            ]);

            const asigs = [];
            for (let d = 1; d <= 31; d++) {
                const cycle = (d + i) % 9;
                let j = (cycle < 6) ? 'normal' : 'descanso_remunerado';
                asigs.push({ programacion_id: pId, vigilante_id: (cycle < 6 ? vA : vR), rol: 'titular_a', dia: d, turno: 'AM', jornada: j });
            }
            await supabase.from('asignaciones_dia').insert(asigs);
            if (i % 20 === 0) process.stdout.write(`|`);
        }
    }
    console.log('\nFINALIZADO.');
}
seedMissing();
