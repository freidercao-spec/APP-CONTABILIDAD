import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function main() {
  // Try inserting a dummy duplicate assignment to see if it triggers a unique constraint error
  const dummyAsig = {
    programacion_id: 'a0000000-0000-0000-0000-000000000001', // dummy or invalid uuid
    empresa_id: 'a0000000-0000-0000-0000-000000000001',
    vigilante_id: 'a0000000-0000-0000-0000-000000000001',
    rol: 'titular_a',
    dia: 1,
    turno: 'AM',
    jornada: 'normal',
    inicio: '06:00',
    fin: '18:00'
  };

  const { error } = await sb.from('asignaciones_programacion').insert([dummyAsig, dummyAsig]);
  if (error) {
    console.log('Insert error details (this is expected to fail or succeed):');
    console.log(`Code: ${error.code}`);
    console.log(`Message: ${error.message}`);
    console.log(`Details: ${error.details}`);
  } else {
    console.log('No error. Duplicates are allowed by database schema.');
    // Clean up
    await sb.from('asignaciones_programacion').delete()
      .eq('vigilante_id', 'a0000000-0000-0000-0000-000000000001')
      .eq('dia', 1);
  }
}

main().catch(console.error);
