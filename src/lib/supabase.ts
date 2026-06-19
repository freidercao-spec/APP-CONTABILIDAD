import { createClient } from '@supabase/supabase-js';

// Nuevo Supabase: ykchpbqkjvmnddndkvno (olbk41228-arch's Project)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ykchpbqkjvmnddndkvno.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Usando credenciales de respaldo. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.');
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
