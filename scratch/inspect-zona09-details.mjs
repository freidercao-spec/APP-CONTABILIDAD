import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/ZONA 09 JUNIO/JUNIO ZONA 09.xlsx';

async function inspectDays() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log('--- Row 7 (Header Block 1) ---');
  const r7 = ws.getRow(7);
  for (let c = 1; c <= 40; c++) {
    const val = r7.getCell(c).value;
    if (val !== null && val !== '') {
      console.log(`Col ${c} (${r7.getCell(c).address}): ${val}`);
    }
  }

  console.log('\n--- Row 29 (Header Block 2) ---');
  const r29 = ws.getRow(29);
  for (let c = 1; c <= 40; c++) {
    const val = r29.getCell(c).value;
    if (val !== null && val !== '') {
      console.log(`Col ${c} (${r29.getCell(c).address}): ${val}`);
    }
  }

  console.log('\n--- Guard rows info ---');
  const checkRows = [8, 9, 11, 12, 14, 30, 31, 33];
  for (const rNum of checkRows) {
    const row = ws.getRow(rNum);
    console.log(`Row ${rNum}: Puesto="${row.getCell(2).value}" | CC="${row.getCell(3).value}" | Name="${row.getCell(4).value}" | Zona="${row.getCell(5).value}"`);
  }
}

inspectDays().catch(console.error);
