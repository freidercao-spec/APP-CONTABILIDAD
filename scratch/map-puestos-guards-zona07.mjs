import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== ZONA 07 ROW MAP ===');
  let currentHeaderPuestos = [];
  
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c1 = row.getCell(1).value;
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;

    const s1 = String(c1 || '').trim().toUpperCase();
    const s6 = String(c6 || '').trim();
    const s7 = String(c7 || '').trim();

    // Check if it's a grid header row
    if (s1 === 'CLIENTE:') {
      console.log(`Row ${r}: --- GRID HEADER --- (Previous Puesto Headers Seen: ${JSON.stringify(currentHeaderPuestos)})`);
      currentHeaderPuestos = []; // Reset seen headers after a grid header
      continue;
    }

    // Check if it's a puesto header block
    if (s6 && !/^\d+$/.test(s6) && !s6.includes('CEDULA') && !s6.includes('CLIENTE') && !s6.includes('PROGRAMACION') && !s6.includes('EMPRESA') && !s6.includes('NIT:') && !s6.includes('DIRECCION') && !s6.includes('TELEFONO')) {
      if (!currentHeaderPuestos.includes(s6)) {
        currentHeaderPuestos.push(s6);
      }
      continue;
    }

    // Check if it's a guard row
    if (s6 && /^\d+$/.test(s6)) {
      console.log(`Row ${r}: GUARD "${s7}" (CC: ${s6})`);
    }
  }
}

main().catch(console.error);
