import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');

async function checkDetails() {
    const { data: progs } = await sb.from('programacion_mensual').select('id, anio, mes, puesto_id').limit(1);
    if(progs && progs.length > 0) {
        const { data: asigs } = await sb.from('asignaciones_dia').select('*').eq('programacion_id', progs[0].id).limit(5);
        fs.writeFileSync('db_asigs.json', JSON.stringify(asigs, null, 2));
    }
}
checkDetails();
