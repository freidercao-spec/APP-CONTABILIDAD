import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);

const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const guards = [
  { cc: '98534558', name: 'DUQUE A GONZALO I' },
  { cc: '1066718661', name: 'DE LA OSSA T JUAN C' },
  { cc: '93378743', name: 'MORENO G JORGE W' },
  { cc: '8472629', name: 'AGUDELO G ALIRIO DE J' },
  { cc: '98581101', name: 'ZEA M CRISTOBAL A' }
];

async function main() {
  console.log('=== CHECKING PUESTOS ===');
  const { data: p1 } = await sb.from('puestos').select('*').ilike('nombre', '%SAN JUAN%');
  console.log('San Juan:', p1);

  const { data: p2 } = await sb.from('puestos').select('*').ilike('nombre', '%NIQUIA%');
  console.log('Niquia:', p2);

  console.log('\n=== CHECKING GUARDS ===');
  for (const g of guards) {
    const { data: vig } = await sb.from('vigilantes').select('*').eq('cedula', g.cc).maybeSingle();
    if (vig) {
      console.log(`Guard ${g.name} (CC: ${g.cc}) exists in DB!`);
      // Find if they have any programacion
      const { data: asigs } = await sb
        .from('asignaciones_programacion')
        .select(`
          programacion:programaciones_mensuales (
            mes,
            anio,
            puesto:puestos (
              nombre
            )
          )
        `)
        .eq('vigilante_id', vig.id)
        .limit(3);
      
      const puestosSeen = new Set(asigs.map(a => a.programacion?.puesto?.nombre).filter(Boolean));
      console.log(`  Puestos seen in DB:`, Array.from(puestosSeen));
    } else {
      console.log(`Guard ${g.name} (CC: ${g.cc}) does NOT exist in DB.`);
    }
  }
}

main().catch(console.error);
