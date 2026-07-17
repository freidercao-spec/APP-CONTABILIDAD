import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';

const sb = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log("Checking OLD database records...");
    const currentEmpresaId = 'a0000000-0000-0000-0000-000000000001';
    
    try {
        const resV = await sb
            .from('vigilantes')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', currentEmpresaId)
            .neq('estado', 'inactivo');
            
        console.log("Vigilantes count:", resV.count, "error:", resV.error?.message);
        
        const resP = await sb
            .from('puestos')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', currentEmpresaId)
            .neq('estado', 'inactivo');
            
        console.log("Puestos count:", resP.count, "error:", resP.error?.message);
    } catch (e) {
        console.error("Exception checking old database:", e.message);
    }
}
check();
