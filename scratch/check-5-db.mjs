import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const targetCeds = ['1002490936', '98566804', '1214743442', '71734133', '70851012'];

for (const ced of targetCeds) {
  console.log(`\nCC: ${ced}`);
  const { data: vig } = await sb.from('vigilantes').select('id, nombres, apellidos').eq('empresa_id', EMPRESA_ID).eq('cedula', ced).maybeSingle();
  if (!vig) {
    console.log('  Vigilante NOT found in DB');
    continue;
  }
  console.log(`  Vigilante: ${vig.nombres} ${vig.apellidos} (${vig.id})`);

  const { data: asigs } = await sb.from('asignaciones_programacion')
    .select('id, dia, rol, programacion_id, programaciones_mensuales(puestos(nombre))')
    .eq('vigilante_id', vig.id)
    .order('dia');

  console.log(`  Assignments in DB: ${asigs?.length}`);
  for (const a of asigs || []) {
    console.log(`    Dia ${a.dia} Rol ${a.rol} Puesto ${a.programaciones_mensuales?.puestos?.nombre} ProgId ${a.programacion_id}`);
  }
}
