import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        '❌ Faltan las variables de entorno de Supabase.',
        'Asegúrate de configurar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);

// ID fijo de la empresa Coraza CTA (usado para insertar datos con empresa_id)
export const EMPRESA_ID = import.meta.env.VITE_EMPRESA_ID || 'a0000000-0000-0000-0000-000000000001';
