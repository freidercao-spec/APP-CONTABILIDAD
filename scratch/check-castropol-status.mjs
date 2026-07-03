import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function run() {
  const { data: puesto, error: errP } = await sb.from('puestos')
    .select('id, nombre')
    .eq('empresa_id', EMPRESA_ID)
    .ilike('nombre', '%Castropol 2%')
    .single();

  if (errP || !puesto) {
    console.error('Puesto Castropol 2 not found:', errP);
    return;
  }
  console.log('Puesto:', puesto);

  const { data: prog, error: errProg } = await sb.from('programaciones_mensuales')
    .select('id, anio, mes, estado')
    .eq('puesto_id', puesto.id)
    .eq('anio', 2026)
    .eq('mes', 5) // June is 5
    .single();

  console.log('Programacion June 2026:', prog, 'Error:', errProg);

  if (prog) {
    const { count, error: errAsig } = await sb.from('asignaciones_programacion')
      .select('*', { count: 'exact', head: true })
      .eq('programacion_id', prog.id);
    console.log('Asignaciones count for June:', count, 'Error:', errAsig);
  }
}

run().catch(console.error);
