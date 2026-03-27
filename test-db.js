const { createClient } = require('@supabase/supabase-js');

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');

async function checkDb() {
    console.log("CONSULTANDO SUPABASE...");
    const { data: progs, error: pErr } = await sb.from('programacion_mensual').select('id, anio, mes, puesto_id, updated_at, version').limit(15).order('updated_at', { ascending: false });
    if(pErr) console.error("Error headers:", pErr);
    
    console.log("LAST 15 PROGRAMACIONES MENSUALES:");
    for (const p of (progs || [])) {
        const { count, error: aErr } = await sb.from('asignaciones_dia').select('*', { count: 'exact', head: true }).eq('programacion_id', p.id);
        if(aErr) console.error("Error asigs:", aErr);
        console.log(`- Prog ${p.id} (${p.puesto_id}): ${count} ASIGNACIONES DIA.`);
    }
}
checkDb();
