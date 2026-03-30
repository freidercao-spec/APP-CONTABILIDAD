import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');

async function checkDb() {
    const { data: progs } = await sb.from('programacion_mensual').select('id, anio, mes, puesto_id, updated_at, version').limit(15).order('updated_at', { ascending: false });
    const results = [];
    for (const p of (progs || [])) {
        const { count } = await sb.from('asignaciones_dia').select('*', { count: 'exact', head: true }).eq('programacion_id', p.id);
        results.push({ id: p.id, puesto: p.puesto_id, assignments: count, version: p.version });
    }
    fs.writeFileSync('db_out.json', JSON.stringify(results, null, 2));
}
checkDb();
l