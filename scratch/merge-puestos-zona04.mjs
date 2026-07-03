import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizarNombre(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '') // Strips dots and special characters
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

async function main() {
  const file = path.join(__dirname, 'excel_parsed_zona04.json');
  const data = JSON.parse(readFileSync(file, 'utf-8'));

  console.log(`Original parsed puestos: ${data.length}`);

  const merged = [];

  for (const item of data) {
    // Find if we already have a similar puesto in merged
    let found = null;
    for (const m of merged) {
      if (similitud(item.cliente, m.cliente) >= 0.8) {
        found = m;
        break;
      }
    }

    if (found) {
      console.log(`Merging "${item.cliente}" into "${found.cliente}"`);
      // Merge guardas
      for (const g of item.guardas) {
        // Check if guard already exists in the found puesto
        const existingGuard = found.guardas.find(x => x.cedula === g.cedula);
        if (existingGuard) {
          // Merge days
          for (const [day, code] of Object.entries(g.dias)) {
            existingGuard.dias[day] = code;
          }
        } else {
          found.guardas.push(g);
        }
      }
    } else {
      merged.push(item);
    }
  }

  console.log(`\nMerged parsed puestos: ${merged.length}`);
  writeFileSync(file, JSON.stringify(merged, null, 2));
  console.log('Saved merged data back to excel_parsed_zona04.json');
}

main().catch(console.error);
