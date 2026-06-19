import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ylcpizjfwupfvffsbjmz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE');

async function getRPC() {
    const { data, error } = await sb.rpc('guardar_programacion_atomica', {}).select('*');
    // Esto va a dar error porque no pasamos args, peo puede darnos pista
}
getRPC();
