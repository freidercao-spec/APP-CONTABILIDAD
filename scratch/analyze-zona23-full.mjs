import ExcelJS from 'exceljs';

const filePath = 'ZONA 23 JUNIO/JUNIO ZONA 23 - AC.xlsx';
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);
const sheet = workbook.getWorksheet('MAYO 2026') || workbook.worksheets[0];

console.log(`Analyzing first 60 rows of ZONA 23 sheet...`);

let lastPuesto = '';
const parsed = [];

for (let r = 8; r <= 80; r++) {
  const row = sheet.getRow(r);
  const puestoVal = row.getCell(3).value; // Column C
  const cedulaVal = row.getCell(4).value; // Column D
  const nombreVal = row.getCell(5).value; // Column E
  const zonaVal = row.getCell(6).value;   // Column F

  if (puestoVal) {
    lastPuesto = String(puestoVal).trim();
  }

  // If we have a guard name and a cedula (must look like a number/string)
  const name = nombreVal ? String(nombreVal).trim() : '';
  const cedula = cedulaVal ? String(cedulaVal).trim() : '';
  
  if (name && /^\d+$/.test(cedula)) {
    // Check days 1 to 30/31
    const dias = {};
    for (let d = 1; d <= 31; d++) {
      const cellVal = row.getCell(6 + d).value; // Days start at Col G (7)
      if (cellVal !== null && cellVal !== undefined && cellVal !== '') {
        dias[d] = String(cellVal).trim();
      }
    }
    console.log(`Row ${r}: Puesto="${lastPuesto}" | Guard="${name}" (CC:${cedula}) | Days Count: ${Object.keys(dias).length}`);
  } else {
    console.log(`Row ${r} (skipped): C3="${puestoVal || ''}" C4="${cedulaVal || ''}" C5="${nombreVal || ''}"`);
  }
}
