import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/ZONA 06 JUNIO/JUNIO - ZONA 06.xlsx';

async function inspectDays() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log('--- Row 5 (Header Block 1) ---');
  const r5 = ws.getRow(5);
  for (let c = 1; c <= 40; c++) {
    const val = r5.getCell(c).value;
    if (val !== null && val !== '') {
      console.log(`Col ${c} (${r5.getCell(c).address}): ${val}`);
    }
  }

  console.log('\n--- Row 7 (Header Block 1 Days) ---');
  const r7 = ws.getRow(7);
  for (let c = 1; c <= 40; c++) {
    const val = r7.getCell(c).value;
    if (val !== null && val !== '') {
      console.log(`Col ${c} (${r7.getCell(c).address}): ${val}`);
    }
  }

  console.log('\n--- Row 31 (Header Block 2 Days) ---');
  const r31 = ws.getRow(31);
  for (let c = 1; c <= 40; c++) {
    const val = r31.getCell(c).value;
    if (val !== null && val !== '') {
      console.log(`Col ${c} (${r31.getCell(c).address}): ${val}`);
    }
  }

  console.log('\n--- Guard rows info ---');
  const checkRows = [8, 9, 11, 32, 33, 35, 36, 38];
  for (const rNum of checkRows) {
    const row = ws.getRow(rNum);
    console.log(`Row ${rNum}: Col2="${row.getCell(2).value}" | Col3="${row.getCell(3).value}" | Col4="${row.getCell(4).value}" | Col5="${row.getCell(5).value}" | Col6="${row.getCell(6).value}"`);
  }
}

inspectDays().catch(console.error);
