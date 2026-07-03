import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const ANO = 2026;
const MES_INDEX = 5; // Junio = index 5

async function main() {
  console.log('--- CLEANING UP ZONA 20 JUNE 2026 DATA ---');

  // Get all puestos in ZONA 20
  const { data: puestos, error: pErr } = await sb
    .from('puestos')
    .select('id, nombre, zona')
    .eq('empresa_id', EMPRESA_ID)
    .eq('zona', 'ZONA 20');

  if (pErr) {
    console.error('Error fetching puestos:', pErr);
    process.exit(1);
  }

  console.log(`Found ${puestos.length} puestos in ZONA 20`);
  const puestoIds = puestos.map(p => p.id);

  if (puestoIds.length === 0) {
    console.log('No puestos found, nothing to clean.');
    return;
  }

  // Get programaciones for these puestos in June 2026
  const { data: progs, error: prErr } = await sb
    .from('programaciones_mensuales')
    .select('id, puesto_id')
    .in('puesto_id', puestoIds)
    .eq('anio', ANO)
    .eq('mes', MES_INDEX);

  if (prErr) {
    console.error('Error fetching programaciones:', prErr);
    process.exit(1);
  }

  console.log(`Found ${progs.length} programaciones in June 2026 for ZONA 20`);
  const progIds = progs.map(p => p.id);

  if (progIds.length > 0) {
    // Delete assignments first
    const { error: dAsigErr } = await sb
      .from('asignaciones_programacion')
      .delete()
      .in('programacion_id', progIds);

    if (dAsigErr) {
      console.error('Error deleting assignments:', dAsigErr);
      process.exit(1);
    }
    console.log(`Deleted assignments for ${progIds.length} programaciones`);

    // Delete programaciones
    const { error: dProgErr } = await sb
      .from('programaciones_mensuales')
      .delete()
      .in('id', progIds);

    if (dProgErr) {
      console.error('Error deleting programaciones:', dProgErr);
      process.exit(1);
    }
    console.log(`Deleted ${progIds.length} programaciones`);
  }

  console.log('Cleanup completed successfully.');
}

main().catch(console.error);
