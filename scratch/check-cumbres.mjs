import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);

async function main() {
  const { data: puestos } = await sb.from('puestos').select('id, nombre, zona').ilike('nombre', '%cumbres%');
  console.log('Puestos matching Cumbres:', puestos);

  if (puestos && puestos.length > 0) {
    const ids = puestos.map(p => p.id);
    const { data: progs } = await sb
      .from('programaciones_mensuales')
      .select('id, puesto_id, personal')
      .eq('anio', 2026)
      .eq('mes', 5)
      .in('puesto_id', ids);
    console.log('Programaciones found:', progs);

    for (const pr of progs) {
      const { data: asigs } = await sb
        .from('asignaciones_programacion')
        .select('dia, rol, turno, jornada, vigilante_id')
        .eq('programacion_id', pr.id)
        .eq('dia', 1);
      console.log(`Asignaciones for Dia 1 in prog ${pr.id}:`, asigs);
    }
  }
}

main().catch(console.error);
