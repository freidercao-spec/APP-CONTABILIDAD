/**
 * VERIFICACIÓN DIRECTA - Sin bugs
 * Muestra día a día lo que hay en la BD vs el Excel para 2 puestos problemáticos
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

// Verificar BOULEVARD 49 (puesto 9) y CARISMA BELEN (puesto 33)
const testPuestos = [
  { excelIdx: 8,  cedula: '1002490936', nombre: 'BAENA JIMENEZ MISAEL' },
  { excelIdx: 32, cedula: '98566804',   nombre: 'GILBELTO OCAÑAS SUAREZ' },
  { excelIdx: 18, cedula: '1214743442', nombre: 'GALLEGO JIMEZ MICHELL ANDREA' },
  { excelIdx: 19, cedula: '71734133',   nombre: 'CORDOBA GUARIN CESAR AUGUSTO' },
  { excelIdx: 26, cedula: '70851012',   nombre: 'RIOS OSPINA CRISTOBAL DE JESUS' },
];

let totalOk = 0, totalFalla = 0;

for (const test of testPuestos) {
  const excelPuesto = excelData[test.excelIdx];
  const guarda = excelPuesto.guardas.find(g => String(g.cedula) === test.cedula);
  if (!guarda) { console.log(`No encontrado en Excel: ${test.nombre}`); continue; }

  // Buscar vigilante en BD
  const { data: vig } = await sb.from('vigilantes').select('id, nombres, cedula').eq('empresa_id', EMPRESA_ID).eq('cedula', test.cedula).maybeSingle();
  if (!vig) { console.log(`❌ Vigilante NO en BD: ${test.nombre} CC:${test.cedula}`); continue; }

  // Obtener sus asignaciones (en CUALQUIER programación de junio)
  const { data: progsJunio } = await sb.from('programaciones_mensuales').select('id').eq('empresa_id', EMPRESA_ID).eq('anio', 2026).eq('mes', 5);
  const progIds = (progsJunio || []).map(p => p.id);

  const { data: asigs } = await sb
    .from('asignaciones_programacion')
    .select('dia, jornada, turno, inicio, fin')
    .eq('vigilante_id', vig.id)
    .in('programacion_id', progIds)
    .order('dia', { ascending: true });

  const asigPorDia = new Map((asigs || []).map(a => [a.dia, a]));

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`PUESTO: ${excelPuesto.cliente}`);
  console.log(`VIGILANTE: ${vig.nombres} (CC: ${vig.cedula})`);
  console.log(`══════════════════════════════════════════════`);
  console.log(`${'Día'.padEnd(5)} ${'EXCEL'.padEnd(6)} ${'BD JORNADA'.padEnd(24)} ${'TURNO'.padEnd(6)} ${'HORARIO'.padEnd(15)} OK?`);
  console.log(`${'─'.repeat(65)}`);

  let okCount = 0, failCount = 0;
  for (const [diaStr, codigoExcel] of Object.entries(guarda.dias)) {
    const dia = parseInt(diaStr);
    if (isNaN(dia) || dia > 30) continue;
    const asig = asigPorDia.get(dia);
    const horario = asig ? `${asig.inicio || '  -  '}-${asig.fin || '  -  '}` : 'NO EXISTE';
    const ok = asig ? '✅' : '❌';
    if (asig) okCount++; else failCount++;
    console.log(`Día ${String(dia).padEnd(2)}  ${String(codigoExcel).padEnd(6)} ${(asig?.jornada || 'FALTA').padEnd(24)} ${(asig?.turno || '').padEnd(6)} ${horario.padEnd(15)} ${ok}`);
  }
  console.log(`\nResultado: ${okCount} OK, ${failCount} FALTANTES`);
  totalOk += okCount; totalFalla += failCount;
}

console.log(`\n${'═'.repeat(65)}`);
console.log(`TOTAL: ${totalOk} OK, ${totalFalla} FALTANTES para los 5 vigilantes problema`);
