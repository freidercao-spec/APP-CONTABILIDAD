import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function run() {
  const { count: countProgs, error: errProgs } = await sb.from('programaciones_mensuales')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', EMPRESA_ID);

  const { count: countAsigs, error: errAsigs } = await sb.from('asignaciones_programacion')
    .select('*', { count: 'exact', head: true });

  console.log('Programaciones count:', countProgs, 'Error:', errProgs);
  console.log('Asignaciones count:', countAsigs, 'Error:', errAsigs);

  // Fetch some programs for June 2026 to see if they exist
  const { data: progsJune, error: errJune } = await sb.from('programaciones_mensuales')
    .select('id, puesto_id, anio, mes, estado')
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', 2026)
    .eq('mes', 5); // June is 5 (0-indexed)

  console.log('June 2026 programs:', progsJune ? progsJune.length : 0, 'Error:', errJune);
  if (progsJune && progsJune.length > 0) {
    console.log('Sample June program:', progsJune[0]);
  }
}

run().catch(console.error);
