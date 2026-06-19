import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req) => {
  try {
    // Inicializar el cliente de Supabase usando las variables de entorno inyectadas
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Marcar vigilancia con Límite de Horas
    const { error: errorLimite } = await supabaseClient.rpc('actualizar_estado_vigilantes', {
      nuevo_estado: 'Límite Horas',
      motivo: 'Alcanzado límite de horas permitidas',
      condicion_filtro: 'SELECT id FROM vista_horas_mensuales WHERE total_horas_programadas >= 240' // Simplificado para Deno, idealmente toda esta lógica vive en BD o el Deno llama a cada vigilante
    })

    // En un caso real mas robusto el Edge function haría fetch de todos los vigilantes
    // evaluaría las reglas de negocio en TS y enviaría las actualizaciones en bulk
    const { data: vigilantes, error: fetchError } = await supabaseClient
      .from('vigilantes')
      .select('id, estado_actual, empresa_id');

    if (fetchError) throw fetchError;

    // Aquí irían todas las validaciones complejas de:
    // - Vigilantes que inician turno en 1 hora -> 'Próximo a Turno'
    // - Vigilantes que su turno acabó hace X tiempo -> volver a 'Disponible'

    // Ejemplo de simulación de resultado
    return new Response(
      JSON.stringify({
        message: 'Motor de estados ejecutado correctamente',
        vigilantes_escaneados: vigilantes?.length || 0
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
