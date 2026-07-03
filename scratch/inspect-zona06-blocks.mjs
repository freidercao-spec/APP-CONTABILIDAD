import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/ZONA 06 JUNIO/JUNIO - ZONA 06.xlsx';

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log(`Checking all headers in ZONA 06 - ${ws.rowCount} rows`);

  const headers = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c3 = String(row.getCell(3).value || '').trim().toUpperCase(); // Column C PUESTO
    const c4 = String(row.getCell(4).value || '').trim().toUpperCase(); // Column D CÉDULA
    const c5 = String(row.getCell(5).value || '').trim().toUpperCase(); // Column E NOMBRE

    const isHeader = (c3.includes('PUESTO') || c3.includes('SERVICIO')) &&
                     (c4.includes('CÉDULA') || c4.includes('CEDULA') || c4 === '') &&
                     (c5.includes('NOMBRE') || c5.includes('GUARDA'));

    if (isHeader) {
      headers.push(r);
    }
  }

  console.log(`Found ${headers.length} headers:`, headers);
}

inspect().catch(console.error);
