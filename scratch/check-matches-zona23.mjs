import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

function normalizarNombre(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similitud(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (na === nb) return 1;

  const numA = na.match(/\d+/g) || [];
  const numB = nb.match(/\d+/g) || [];
  if (numA.join('-') !== numB.join('-')) {
    return 0;
  }

  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const comunes = [...wordsA].filter(w => w.length > 3 && wordsB.has(w));
  const total = Math.max(wordsA.size, wordsB.size);
  return comunes.length / total;
}

function buscarPuesto(cliente, puestosDB) {
  let mejorMatch = null, mejorSim = 0;
  for (const p of puestosDB) {
    const sim = similitud(cliente, p.nombre);
    if (sim > mejorSim) { mejorSim = sim; mejorMatch = p; }
  }
  if (mejorSim >= 0.5) return { match: mejorMatch, sim: mejorSim, method: 'similarity' };
  return { match: null, sim: 0, method: 'none' };
}

async function main() {
  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona23.json'), 'utf-8'));
  const { data: puestosDB } = await sb.from('puestos').select('id, nombre, zona').eq('empresa_id', EMPRESA_ID);

  console.log(`Excel Puestos: ${excelData.length}, DB Puestos: ${puestosDB.length}`);
  for (const [i, ep] of excelData.entries()) {
    const res = buscarPuesto(ep.cliente, puestosDB);
    if (res.match) {
      console.log(`[${i+1}] Excel: "${ep.cliente}" -> DB: "${res.match.nombre}" (Zona: ${res.match.zona}) [Sim: ${res.sim.toFixed(2)}, Method: ${res.method}]`);
    } else {
      console.log(`[${i+1}] Excel: "${ep.cliente}" -> ❌ NO MATCH`);
    }
  }
}

main();
