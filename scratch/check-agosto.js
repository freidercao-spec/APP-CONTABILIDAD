import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const supabaseKey = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPuesto() {
  const { data: puestos, error: pError } = await supabase
    .from('puestos')
    .select('id, nombre');

  if (pError) {
    console.error('Error fetching puestos:', pError);
    return;
  }
  
  console.log('Puestos listed:', puestos);

  // Check if Agosto exists for each
  const { data: progs, error: prError } = await supabase
    .from('programaciones_mensuales')
    .select('id, puesto_id, anio, mes')
    .eq('anio', 2026)
    .eq('mes', 7);

  if (prError) {
    console.error('Error fetching progs:', prError);
    return;
  }

  console.log('Existing programations in Agosto:', progs);
}

checkPuesto();
