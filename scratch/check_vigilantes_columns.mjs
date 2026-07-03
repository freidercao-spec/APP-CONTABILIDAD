import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function check() {
  const currentEmpresaId = 'a0000000-0000-0000-0000-000000000001';
  const mockCedula = '999999999';
  
  // Try inserting without rango
  const { data: inserted, error } = await sb
    .from('vigilantes')
    .insert({
      empresa_id: currentEmpresaId,
      cedula: mockCedula,
      nombres: 'TEST VIGILANTE',
      apellidos: 'MOCK',
      estado: 'disponible'
    })
    .select();

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Inserted Vigilante Row Keys:', Object.keys(inserted[0]));
    console.log('Inserted Vigilante Data:', inserted[0]);
    
    // Clean up
    await sb.from('vigilantes').delete().eq('cedula', mockCedula);
    console.log('Cleaned up mock vigilante.');
  }
}

check();
