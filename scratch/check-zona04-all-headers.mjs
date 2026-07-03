import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/zona 04 junio/JUNIO - ZONA 04.xlsx';

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log(`Checking column consistency across headers...`);

  const headers = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = String(row.getCell(1).value || '').trim().toUpperCase();
    const c2 = String(row.getCell(2).value || '').trim().toUpperCase();
    const c3 = String(row.getCell(3).value || '').trim().toUpperCase();

    const isHeader = (c1.includes('PUESTO') || c1.includes('SERVICIO')) &&
                     (c2.includes('CÉDULA') || c2.includes('CEDULA')) &&
                     (c3.includes('NOMBRE') || c3.includes('GUARDA'));

    if (isHeader) {
      headers.push(r);
    }
  }

  // Check a few header rows
  for (const hRow of headers.slice(0, 10)) {
    const row = ws.getRow(hRow);
    const days = [];
    for (let c = 4; c <= 35; c++) {
      days.push(row.getCell(c).value);
    }
    console.log(`Header row ${hRow}: days=${days.slice(0, 5).join(',')}... to ${days.slice(29, 32).join(',')}`);
  }
}

inspect().catch(console.error);
