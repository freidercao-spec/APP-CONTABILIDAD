import { createClient } from '@supabase/supabase-js';

// Nuevo Supabase: ykchpbqkjvmnddndkvno (olbk41228-arch's Project)
const fallbackUrl = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const fallbackKey = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackKey;

// Auto-bypass: si la URL en producción de Vercel apunta al proyecto antiguo inactivo (ylcpizjfwupfvffsbjmz), forzar el nuevo activo
if (supabaseUrl.includes('ylcpizjfwupfvffsbjmz')) {
    supabaseUrl = fallbackUrl;
    supabaseAnonKey = fallbackKey;
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
