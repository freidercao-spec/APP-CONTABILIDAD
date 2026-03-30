import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');

async function checkDb() {
    console.log("Checking Supabase tables...");
    
    const tables = ['puestos', 'vigilantes', 'programacion_mensual', 'asignaciones_dia'];
    
    for (const table of tables) {
        const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.error(`Error counting ${table}:`, error.message);
        } else {
            console.log(`Table ${table}: ${count} rows`);
        }
    }
    
    console.log("\nChecking last 5 programaciones with empresa_id:");
    const { data: progs, error: pErr } = await sb.from('programacion_mensual').select('id, anio, mes, empresa_id').limit(5).order('created_at', { ascending: false });
    if (pErr) console.error("Error fetching progs:", pErr.message);
    else console.log(JSON.stringify(progs, null, 2));

    console.log("\nChecking last 5 puestos with empresa_id:");
    const { data: puestos, error: puErr } = await sb.from('puestos').select('id, nombre, empresa_id').limit(5).order('created_at', { ascending: false });
    if (puErr) console.error("Error fetching puestos:", puErr.message);
    else console.log(JSON.stringify(puestos, null, 2));
}

checkDb();
