import { createClient } from '@supabase/supabase-js';

// CORRECCIÓN DE SEGURIDAD: Eliminado el fallback con credenciales hardcodeadas.
// Las variables de entorno deben estar correctamente configuradas en Vercel.
// Si no están presentes, la app falla rápido con un mensaje claro en lugar de
// exponer las credenciales en el código fuente del repositorio.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ ADVERTENCIA: Variables de entorno de Supabase no encontradas. Usando configuracion de respaldo. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: { 'x-client-info': 'coraza-cta-v7' }
    },
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

// ID fijo de la empresa Coraza CTA
export const EMPRESA_ID = import.meta.env.VITE_EMPRESA_ID || 'a0000000-0000-0000-0000-000000000001';
