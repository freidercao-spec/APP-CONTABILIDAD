import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const EMPRESA_ID = process.env.VITE_EMPRESA_ID || 'a0000000-0000-0000-0000-000000000001';

async function seed() {
    console.log('🚀 TURBO ESTRÉS SEEDER...');
    
    // Fetch all posts we want to target
    const { data: currentPuestos } = await supabase.from('puestos').select('id, codigo').eq('empresa_id', EMPRESA_ID).limit(600);
    const puestos = currentPuestos || [];
    const { data: v } = await supabase.from('vigilantes').select('id').limit(100);
    const vigilantes = v || [];

    const anio = 2026;
    const mes = 2; // MARZO

    // Process everything in memory first so we can batch inserts
    const progsToInsert = [];
    const personalToInsert = [];
    const assignmentsToInsert = [];

    console.log(`Pre-calculating for ${puestos.length} posts...`);

    for (let i = 0; i < puestos.length; i++) {
        const p = puestos[i];
        progsToInsert.push({
            puesto_id: p.id, anio, mes, empresa_id: EMPRESA_ID, estado: 'publicado', version: 1, usuario_creador: 'TurboStress'
        });
    }

    // 1. Batch insert programs first so they get IDs (using upsert with onConflict)
    console.log('Upserting Programación headers...');
    const { data: seededProgs, error: pErr } = await supabase.from('programacion_mensual').upsert(progsToInsert, { onConflict: 'puesto_id,anio,mes' }).select('id, puesto_id');
    if (pErr) { console.error('P-Error:', pErr); return; }

    const progIds = seededProgs.map(pr => pr.id);
    console.log(`Fulfilling data for ${progIds.length} programs...`);

    // Clean old data for these programs efficiently
    await supabase.from('personal_puesto').delete().in('programacion_id', progIds);
    await supabase.from('asignaciones_dia').delete().in('programacion_id', progIds);

    for (let i = 0; i < seededProgs.length; i++) {
        const pr = seededProgs[i];
        const vIdx = (i * 3) % vigilantes.length;
        const vA = vigilantes[vIdx].id;
        const vB = vigilantes[(vIdx + 1) % vigilantes.length].id;
        const vR = vigilantes[(vIdx + 2) % vigilantes.length].id;

        personalToInsert.push({ programacion_id: pr.id, vigilante_id: vA, rol: 'titular_a' });
        personalToInsert.push({ programacion_id: pr.id, vigilante_id: vB, rol: 'titular_b' });
        personalToInsert.push({ programacion_id: pr.id, vigilante_id: vR, rol: 'relevante' });

        const roles = [{ id: vA, r: 'titular_a', off: 0 }, { id: vB, r: 'titular_b', off: 3 }, { id: vR, r: 'relevante', off: 6 }];
        for (let d = 1; d <= 31; d++) {
            roles.forEach(role => {
                const cycle = (d + role.off + i) % 9;
                let j = (cycle < 6) ? 'normal' : (cycle < 8) ? 'descanso_remunerado' : 'descanso_no_remunerado';
                assignmentsToInsert.push({
                    programacion_id: pr.id, vigilante_id: role.id, rol: role.r, dia: d, turno: 'AM', jornada: j
                });
            });
        }
    }

    // 2. Batch insert personal
    console.log(`Inserting ${personalToInsert.length} personal entries...`);
    for (let j = 0; j < personalToInsert.length; j += 100) {
        await supabase.from('personal_puesto').insert(personalToInsert.slice(j, j + 100));
    }

    // 3. Batch insert assignments in large chunks
    console.log(`Inserting ${assignmentsToInsert.length} assignments...`);
    for (let k = 0; k < assignmentsToInsert.length; k += 1000) {
        const { error } = await supabase.from('asignaciones_dia').insert(assignmentsToInsert.slice(k, k + 1000));
        if (error) console.error('A-Error:', error);
        if (k % 5000 === 0) process.stdout.write(`${k}...`);
    }

    console.log('\n🌟 TURBO ESTRÉS SEEDER FINISHED! 600 Puestos Listos 🌟');
}
seed();
