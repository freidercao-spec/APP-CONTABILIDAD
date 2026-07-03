import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function inspect() {
  const { data: progs, error } = await sb.from('programaciones_mensuales').select('*');
  if (error) {
    console.error('Error fetching programaciones_mensuales:', error);
    return;
  }
  
  console.log(`Found ${progs.length} programaciones:`);
  for (const p of progs) {
    const { data: puesto } = await sb.from('puestos').select('nombre').eq('id', p.puesto_id).single();
    console.log(`\n--- Programacion ID: ${p.id} | Puesto: ${puesto?.nombre || p.puesto_id} | Mes: ${p.mes + 1}/${p.anio} ---`);
    console.log('Personal:', JSON.stringify(p.personal, null, 2));
  }
}

inspect();
