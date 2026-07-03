import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/zona 04 junio/JUNIO - ZONA 04.xlsx';

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log(`Analyzing ZONA 04 sheet: "${ws.name}" - ${ws.rowCount} rows`);

  const headers = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = String(row.getCell(1).value || '').trim().toUpperCase();
    const c2 = String(row.getCell(2).value || '').trim().toUpperCase();
    const c3 = String(row.getCell(3).value || '').trim().toUpperCase();

    if (c1 === 'PUESTO' && c2 === 'CÉDULA' && c3 === 'NOMBRE DE GUARDA') {
      headers.push(r);
    }
  }

  console.log(`Found ${headers.length} header rows:`, headers);

  // Show some samples between headers
  for (let i = 0; i < Math.min(headers.length, 5); i++) {
    const hRow = headers[i];
    console.log(`\n--- Block starting at header row ${hRow} ---`);
    for (let r = hRow + 1; r < hRow + 6; r++) {
      const row = ws.getRow(r);
      console.log(`Row ${r}: Puesto="${row.getCell(1).value}" | CC="${row.getCell(2).value}" | Name="${row.getCell(3).value}" | Day1="${row.getCell(4).value}"`);
    }
  }
}

inspect().catch(console.error);
