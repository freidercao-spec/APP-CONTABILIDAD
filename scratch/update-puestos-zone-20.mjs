import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

function normalizarNombre(nombre) {
  return (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similitud(a, b) {
  const na = normalizarNombre(a), nb = normalizarNombre(b);
  if (na === nb) return 1;
  const numA = na.match(/\d+/g) || [];
  const numB = nb.match(/\d+/g) || [];
  if (numA.join('-') !== numB.join('-')) return 0;
  const wa = new Set(na.split(' ')), wb = new Set(nb.split(' '));
  const comunes = [...wa].filter(w => w.length > 3 && wb.has(w));
  return comunes.length / Math.max(wa.size, wb.size);
}

const { data: puestosDB } = await sb.from('puestos').select('id, nombre, zona').eq('empresa_id', EMPRESA_ID);

function buscarPuesto(cliente) {
  let best = null, bestSim = 0;
  for (const p of puestosDB) {
    const s = similitud(cliente, p.nombre);
    if (s > bestSim) { bestSim = s; best = p; }
  }
  if (bestSim >= 0.4) return best;
  const palabras = normalizarNombre(cliente).split(' ').filter(w => w.length > 3);
  const numCliente = normalizarNombre(cliente).match(/\d+/g) || [];
  for (const p of puestosDB) {
    const pn = normalizarNombre(p.nombre);
    const numP = pn.match(/\d+/g) || [];
    if (numCliente.join('-') !== numP.join('-')) continue;
    for (const pal of palabras) { if (pn.includes(pal)) return p; }
  }
  return null;
}

console.log('Updating puestos to "ZONA 20" based on Excel matches...\n');

let updatedCount = 0;
for (const excelPuesto of excelData) {
  const pDB = buscarPuesto(excelPuesto.cliente);
  if (pDB) {
    console.log(`Puesto: "${pDB.nombre}" (ID: ${pDB.id})`);
    console.log(`  Current Zone: "${pDB.zona}" -> New Zone: "ZONA 20"`);
    const { error } = await sb.from('puestos').update({ zona: 'ZONA 20' }).eq('id', pDB.id);
    if (error) {
      console.error(`  ❌ Error updating: ${error.message}`);
    } else {
      console.log(`  ✅ Updated!`);
      updatedCount++;
    }
  } else {
    console.warn(`  ⚠️ Puesto not matched: "${excelPuesto.cliente}"`);
  }
}

console.log(`\nDone! Updated ${updatedCount} puestos to "ZONA 20".`);
