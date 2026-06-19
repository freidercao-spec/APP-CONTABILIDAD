const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://ylcpizjfwupfvffsbjmz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE'
);

(async () => {
  // 1. Programaciones de Abril (mes index 3)
  const { data: progs } = await sb
    .from('programacion_mensual')
    .select('id,puesto_id,anio,mes,estado')
    .eq('mes', 3);
  console.log('=== Programaciones Abril (mes=3) ===');
  console.log('Total:', progs?.length || 0);
  (progs || []).forEach(p => {
    console.log('  ID:', p.id, '| Puesto:', p.puesto_id, '| Estado:', p.estado);
  });

  // 2. Puestos
  const { data: puestos } = await sb.from('puestos').select('id,nombre').limit(10);
  console.log('\n=== Puestos ===');
  (puestos || []).forEach(p => console.log('  ID:', p.id, '| Nombre:', p.nombre));

  // 3. Vigilantes  
  const { data: vigs } = await sb.from('vigilantes').select('id,nombre').limit(10);
  console.log('\n=== Vigilantes ===');
  (vigs || []).forEach(v => console.log('  ID:', v.id, '| Nombre:', v.nombre));

  // 4. Asignaciones con vigilante (los que realmente se guardaron)
  const { data: asigs } = await sb
    .from('asignaciones_dia')
    .select('programacion_id,dia,vigilante_id,turno,jornada,rol')
    .not('vigilante_id', 'is', null)
    .limit(20);
  console.log('\n=== Asignaciones REALES (con vigilante) ===');
  console.log('Total:', asigs?.length || 0);
  (asigs || []).forEach(a => {
    console.log('  Prog:', a.programacion_id, '| Dia:', a.dia, '| Vig:', a.vigilante_id, '| Rol:', a.rol, '| Jornada:', a.jornada);
  });

  // 5. Personal asignado 
  const { data: pers } = await sb
    .from('personal_puesto')
    .select('programacion_id,rol,vigilante_id')
    .not('vigilante_id', 'is', null);
  console.log('\n=== Personal Asignado ===');
  console.log('Total:', pers?.length || 0);
  (pers || []).forEach(p => console.log('  Prog:', p.programacion_id, '| Rol:', p.rol, '| Vig:', p.vigilante_id));

  // 6. Check if there's a unique constraint issue
  console.log('\n=== Test: Intento de upsert con datos reales ===');
  if (progs && progs[0]) {
    const testProgId = progs[0].id;
    const { error: testErr } = await sb
      .from('personal_puesto')
      .upsert({ programacion_id: testProgId, rol: 'test_check', vigilante_id: null }, { onConflict: 'programacion_id,rol' });
    console.log('Upsert personal test error:', testErr);
    // cleanup
    await sb.from('personal_puesto').delete().eq('programacion_id', testProgId).eq('rol', 'test_check');
  }
})();
