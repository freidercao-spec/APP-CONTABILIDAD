import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const supabaseAnonKey = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Checking most recently updated programaciones_mensuales...");
    const { data: progs, error: err1 } = await supabase
        .from('programaciones_mensuales')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (err1) {
        console.error("❌ ERROR programaciones_mensuales:", err1);
    } else {
        console.log("✅ Latest programaciones_mensuales:", progs.map(p => ({
            id: p.id,
            puesto_id: p.puesto_id,
            anio: p.anio,
            mes: p.mes,
            updated_at: p.updated_at,
            estado: p.estado
        })));
    }

    console.log("Checking most recently updated asignaciones_programacion...");
    const { data: asigs, error: err2 } = await supabase
        .from('asignaciones_programacion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (err2) {
        console.error("❌ ERROR asignaciones_programacion:", err2);
    } else {
        console.log("✅ Latest asignaciones_programacion:", asigs.map(a => ({
            id: a.id,
            programacion_id: a.programacion_id,
            dia: a.dia,
            vigilante_id: a.vigilante_id,
            rol: a.rol,
            turno: a.turno,
            jornada: a.jornada,
            created_at: a.created_at
        })));
    }
}

run();
