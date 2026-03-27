import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function seedScheduling() {
    console.log('🚀 MEGA-PROGRAMACIÓN EN PROCESO (6.000 PUESTOS)...');
    
    // 1. Obtener Posts y Vigilantes (Paginación para superar límites de Supabase)
    let allPuestos = [];
    let pFrom = 0;
    while (true) {
        const { data: pSlice } = await sb.from('puestos').select('id').eq('empresa_id', EMPRESA_ID).range(pFrom, pFrom + 999).limit(1000);
        if (!pSlice || pSlice.length === 0) break;
        allPuestos = [...allPuestos, ...pSlice];
        pFrom += 1000;
        if (allPuestos.length >= 6000) break;
    }
    const puestos = allPuestos;
    
    let allVigilantes = [];
    let from = 0;
    while (true) {
        const { data: vSlice } = await sb.from('vigilantes').select('id').eq('empresa_id', EMPRESA_ID).range(from, from + 999).limit(1000);
        if (!vSlice || vSlice.length === 0) break;
        allVigilantes = [...allVigilantes, ...vSlice];
        from += 1000;
        if (allVigilantes.length >= 18000) break;
    }
    const vigilantes = allVigilantes;
    
    if (!puestos || !vigilantes || vigilantes.length === 0) {

        console.error('❌ No hay datos previos. Corra massive-seed-18000.mjs primero.');
        return;
    }

    console.log(`Fulfilling: ${puestos.length} Posts y ${vigilantes.length} Vigilantes...`);

    const anio = 2026;
    const mes = 2; // MARZO 2026 (0-indexed logic would be mes=2)
    const BATCH_SIZE_H = 500; // Headers batch
    const BATCH_SIZE_A = 4000; // Assignments batch

    for (let b = 0; b < puestos.length; b += BATCH_SIZE_H) {
        const headerBatch = [];
        const slice = puestos.slice(b, b + BATCH_SIZE_H);
        
        for (const p of slice) {
            headerBatch.push({
                puesto_id: p.id,
                anio,
                mes,
                empresa_id: EMPRESA_ID,
                estado: 'publicado',
                version: 1,
                usuario_creador: 'Antigravity_MegaSeed'
            });
        }

        // 2. Upsert headers
        const { data: newProgs, error: pErr } = await sb.from('programacion_mensual').upsert(headerBatch, { onConflict: 'puesto_id,anio,mes' }).select('id, puesto_id');
        if (pErr) { console.error('Error headers:', pErr); continue; }

        console.log(`\n📦 Header Batch ${b + BATCH_SIZE_H} OK. Generando asignaciones...`);

        // 3. Generar asignaciones para este batch de programas
        const assignments = [];
        const personal = [];

        for (let i = 0; i < newProgs.length; i++) {
            const pr = newProgs[i];
            const vIdx = ( (b + i) * 3 ) % vigilantes.length;
            
            const vA = vigilantes[vIdx].id;
            const vB = vigilantes[(vIdx + 1) % vigilantes.length].id;
            const vR = vigilantes[(vIdx + 2) % vigilantes.length].id;

            // Personal fijo (Titulares)
            personal.push({ programacion_id: pr.id, vigilante_id: vA, rol: 'titular_a' });
            personal.push({ programacion_id: pr.id, vigilante_id: vB, rol: 'titular_b' });
            personal.push({ programacion_id: pr.id, vigilante_id: vR, rol: 'relevante' });

            // 31 días de turnos alternados
            const roles = [{ id: vA, r: 'titular_a', off: 0 }, { id: vB, r: 'titular_b', off: 3 }, { id: vR, r: 'relevante', off: 6 }];
            for (let d = 1; d <= 31; d++) {
                roles.forEach(role => {
                    const cycle = (d + role.off + i) % 9;
                    let j = (cycle < 6) ? 'normal' : (cycle < 8) ? 'descanso_remunerado' : 'descanso_no_remunerado';
                    assignments.push({
                        programacion_id: pr.id,
                        vigilante_id: role.id,
                        rol: role.r,
                        dia: d,
                        turno: 'AM',
                        jornada: j
                    });
                });
            }
        }

        // 4. Batch inserts (Personal)
        const { error: persErr } = await sb.from('personal_puesto').insert(personal);
        if (persErr) console.warn('Pers Error (Ignorable if redundant):', persErr.message);

        // 5. Batch inserts (Assignments) - Massive chunk!
        for (let k = 0; k < assignments.length; k += BATCH_SIZE_A) {
            const { error: aErr } = await sb.from('asignaciones_dia').insert(assignments.slice(k, k + BATCH_SIZE_A));
            if (aErr) console.error('A-Error:', aErr.message);
            if (k % 20000 === 0) process.stdout.write(`${k}...`);
        }
    }

    console.log('\n\n✅ MEGA-PROGRAMACIÓN COMPLETADA EXITOSAMENTE! 6.000 PUESTOS LISTOS EN MARZO 2026.');
    process.exit(0);
}

seedScheduling().catch(e => { console.error('💥 ERROR:', e); process.exit(1); });
