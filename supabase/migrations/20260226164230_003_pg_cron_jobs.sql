-- Migración para configurar pg_cron y automatizar el Motor de Estados

-- 1. Habilitar la extensión pg_cron (depende de que esté soportado en el tier de Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Crear el Job que se ejecutará cada minuto
-- NOTA: Requiere que la URL del Edge Function y el Service Role Key estén configurados
-- en la tabla vault.secrets de Supabase o inyectados directamente.

/* 
-- Ejemplo de como se programaría usando pg_net para invocar el Edge Function:
SELECT cron.schedule(
    'invoke-motor-estados',
    '* * * * *', -- Cada minuto
    $$
    SELECT net.http_post(
        url:='https://[PROJECT_REF].supabase.co/functions/v1/motor-estados',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
    )
    $$
);
*/
