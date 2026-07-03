import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function run() {
  const { data: progs, error } = await sb.from('programaciones_mensuales')
    .select('id')
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', 2026)
    .eq('mes', 5);

  if (error) {
    console.error('Error fetching programs:', error);
    return;
  }

  const progIds = progs.map(p => p.id);
  console.log(`Testing details fetch for ${progIds.length} programs...`);

  const CHUNK_SIZE = 10;
  const chunkPromises = [];
  for (let i = 0; i < progIds.length; i += CHUNK_SIZE) {
    const chunk = progIds.slice(i, i + CHUNK_SIZE);
    chunkPromises.push(
      sb.from('asignaciones_programacion').select('*').in('programacion_id', chunk).limit(15000)
    );
  }

  console.log(`Launching ${chunkPromises.length} parallel queries...`);
  const start = Date.now();
  try {
    const results = await Promise.all(chunkPromises);
    const totalRows = results.reduce((acc, res) => acc + (res.data ? res.data.length : 0), 0);
    console.log(`Success! Fetched ${totalRows} assignments in ${Date.now() - start}ms.`);
  } catch (err) {
    console.error('Failed fetching details:', err);
  }
}

run().catch(console.error);
