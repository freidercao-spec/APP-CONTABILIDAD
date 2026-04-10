const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxtvzhzqmxvzqzfzxqfz.supabase.co'; // Example if not found
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// I will try to find the actual values from the codebase
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log("Checking for duplicates in programacion_mensual...");
    const { data, error } = await supabase
        .from('programacion_mensual')
        .select('id, puesto_id, anio, mes, created_at, updated_at, estado')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    const counts = {};
    data.forEach(p => {
        const key = `${p.puesto_id}-${p.anio}-${p.mes}`;
        if (!counts[key]) counts[key] = [];
        counts[key].push(p);
    });

    for (const key in counts) {
        if (counts[key].length > 1) {
            console.log(`[DUPE FOUND] ${key}:`, counts[key]);
            // Check which one has assignments
            for (const p of counts[key]) {
                const { count: aCount } = await supabase.from('asignaciones_dia').select('*', { count: 'exact', head: true }).eq('programacion_id', p.id);
                const { count: pCount } = await supabase.from('personal_puesto').select('*', { count: 'exact', head: true }).eq('programacion_id', p.id);
                console.log(`  -> ID: ${p.id} | Asigs: ${aCount} | Pers: ${pCount} | Created: ${p.created_at}`);
            }
        }
    }
}

checkDuplicates();
