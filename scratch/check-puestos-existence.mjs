import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

const targetPuestos = [
  "PARQUE EMPESARIAL NORTIKO",
  "UR SAN JUAN CAMPESTRE",
  "CACIQUE NIQUIA M1",
  "ED MIRADOR DE ARANJUEZ",
  "ED MONTSERRAT",
  "ED MIRADOR DEL NORTE",
  "ED FUNDADORES DOS",
  "ED FUNDADORES UNO",
  "OBRA PIAMONTE",
  "UR TORRES DEL MARQUES",
  "TORREON DE SABANETA",
  "UR MIRADOR DE LAS FLORES",
  "ED EL CORAL",
  "ED TORRE MAGENTA",
  "EL EDEN",
  "CONDOMINIO PALMAZERA",
  "QUINTAS DE VERACRUZ",
  "CR SAN ANGEL",
  "OBRA DUBLIN",
  "DISPONIBLES"
];

async function main() {
  const { data: puestos, error } = await sb.from('puestos').select('id, nombre, turnos_config');
  if (error) {
    console.error('Error fetching puestos:', error);
    return;
  }

  console.log('=== MATCHING PUESTOS IN DB ===');
  for (const name of targetPuestos) {
    const matches = puestos.filter(p => 
      p.nombre.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(p.nombre.toLowerCase())
    );
    if (matches.length > 0) {
      console.log(`\nTarget: "${name}"`);
      for (const m of matches) {
        console.log(`  Match: "${m.nombre}" | ID: ${m.id}`);
      }
    } else {
      console.log(`\nTarget: "${name}" -> NO MATCH IN DB`);
    }
  }
}

main();
