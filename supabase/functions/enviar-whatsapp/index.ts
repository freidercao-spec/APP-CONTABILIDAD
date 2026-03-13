import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req) => {
  try {
    const { vigilante_id, mensaje, numero, tipo_alerta } = await req.json()

    if (!numero || !mensaje) {
      throw new Error('Número y mensaje son obligatorios')
    }

    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    if (!WHATSAPP_TOKEN || !PHONE_ID) {
      throw new Error('Credenciales de WhatsApp no configuradas')
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: mensaje }
    }

    // Call Meta API
    const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // Log the notification in the database (optional but recommended)
    /*
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    await supabaseClient.from('notificaciones').insert({
        vigilante_id,
        tipo: tipo_alerta,
        destino: numero,
        estado: response.ok ? 'Enviado' : 'Fallido',
        respuesta_api: result
    })
    */

    if (!response.ok) {
      console.error('Meta API Error:', result);
      throw new Error(`Error enviando WhatsApp: ${result.error?.message}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
