import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function inspect() {
  const { data: puestos, error } = await sb.from('puestos').select('id, nombre, turnos_config');
  if (error) {
    console.error('Error fetching puestos:', error);
    return;
  }
  
  console.log(`Found ${puestos.length} puestos:`);
  for (const p of puestos) {
    console.log(`\n--- Puesto: ${p.nombre} (ID: ${p.id}) ---`);
    console.log('Turnos Config:', JSON.stringify(p.turnos_config, null, 2));
  }
}

inspect();
