import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

async function run() {
  const { data: puestos, error: errP } = await sb.from('puestos')
    .select('id, nombre')
    .eq('empresa_id', EMPRESA_ID)
    .eq('estado', 'activo');

  if (errP) {
    console.error('Error fetching puestos:', errP);
    return;
  }

  console.log('Total active puestos:', puestos.length);

  const { data: progs, error: errProgs } = await sb.from('programaciones_mensuales')
    .select('id, puesto_id, anio, mes, estado')
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', 2026)
    .eq('mes', 5); // June is 5

  if (errProgs) {
    console.error('Error fetching progs:', errProgs);
    return;
  }

  console.log('Total progs in June 2026:', progs.length);

  const progIds = progs.map(p => p.id);
  const { data: asigs, error: errAsigs } = await sb.from('asignaciones_programacion')
    .select('programacion_id, dia, rol, vigilante_id')
    .in('programacion_id', progIds.slice(0, 100)); // Limit to first 100 to avoid query size limits

  console.log('Sample assignments checked. Checking if there are any blank progs (0 assignments).');

  const emptyProgs = [];
  const populatedProgs = [];

  for (const prog of progs) {
    const { count, error } = await sb.from('asignaciones_programacion')
      .select('*', { count: 'exact', head: true })
      .eq('programacion_id', prog.id);
    
    const puesto = puestos.find(p => p.id === prog.puesto_id);
    if (count === 0) {
      emptyProgs.push({ prog, puesto });
    } else {
      populatedProgs.push({ prog, puesto, count });
    }
  }

  console.log(`Empty programs count: ${emptyProgs.length}`);
  console.log(`Populated programs count: ${populatedProgs.length}`);

  if (emptyProgs.length > 0) {
    console.log('Empty programs detail:');
    emptyProgs.slice(0, 10).forEach(ep => {
      console.log(`- Puesto: "${ep.puesto?.nombre}" (ID: ${ep.prog.puesto_id}), Prog ID: ${ep.prog.id}`);
    });
  }
}

run().catch(console.error);
