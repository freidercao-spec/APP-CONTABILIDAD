import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const msg = '❌ ERROR: Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
    console.error(msg);
    if (typeof window !== 'undefined') {
        // Mostrar alerta visual en producción si faltan variables
        setTimeout(() => {
            const el = document.getElementById('root');
            if (el && el.innerHTML === '') {
                el.innerHTML = `<div style="padding:40px; color:white; background:#111; font-family:sans-serif; text-align:center;">
                    <h2 style="color:#ff4d4d">Configuración Incompleta</h2>
                    <p>${msg}</p>
                    <p style="color:#888; font-size:14px;">Asegúrate de configurar las <b>Environment Variables</b> en el panel de Vercel.</p>
                </div>`;
            }
        }, 1000);
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

// ID fijo de la empresa Coraza CTA (usado para insertar datos con empresa_id)
export const EMPRESA_ID = import.meta.env.VITE_EMPRESA_ID || 'a0000000-0000-0000-0000-000000000001';
