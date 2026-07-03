import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const { data: puestos } = await sb.from('puestos').select('id,nombre').eq('empresa_id', EMPRESA_ID).ilike('nombre', '%CACTUS%');

for (const p of puestos) {
  console.log(`\nPuesto: ${p.nombre} (${p.id})`);
  const { data: prog } = await sb.from('programaciones_mensuales').select('id, personal').eq('puesto_id', p.id).eq('anio', 2026).eq('mes', 5).maybeSingle();
  if (!prog) {
    console.log('  No programming found');
    continue;
  }
  console.log('  Programming ID:', prog.id);
  console.log('  Personal:', prog.personal);
  const { data: asigs } = await sb.from('asignaciones_programacion').select('id, dia, rol, vigilantes(nombres, cedula)').eq('programacion_id', prog.id).order('dia');
  console.log(`  Assignments Count: ${asigs?.length}`);
  // Let's summarize the guards that have assignments in this programming
  const guardCount = {};
  for (const a of asigs || []) {
    const name = a.vigilantes?.nombres;
    guardCount[name] = (guardCount[name] || 0) + 1;
  }
  console.log('  Guards in assignments:', guardCount);
}
