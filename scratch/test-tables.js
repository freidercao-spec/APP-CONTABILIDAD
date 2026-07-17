import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const supabaseAnonKey = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Listing all rows in programaciones_mensuales...");
    const { data: rows, error } = await supabase.from('programaciones_mensuales').select('*');
    if (error) {
        console.error("❌ ERROR:", error);
    } else {
        console.log("✅ SUCCESS, rows count:", rows.length);
        console.log("Rows:", rows.map(r => ({ id: r.id, puesto_id: r.puesto_id, anio: r.anio, mes: r.mes, estado: r.estado })));
    }
}

run();
