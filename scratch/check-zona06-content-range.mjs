import ExcelJS from 'exceljs';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/ZONA 06 JUNIO/JUNIO - ZONA 06.xlsx';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  console.log(`Checking content range...`);
  let contentRows = 0;
  for (let r = 95; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const hasContent = row.values.some(v => v !== null && v !== '');
    if (hasContent) {
      contentRows++;
      if (contentRows <= 10) {
        console.log(`Row ${r}: Col3="${row.getCell(3).value}" | Col4="${row.getCell(4).value}" | Col5="${row.getCell(5).value}"`);
      }
    }
  }
  console.log(`Total rows with content above row 95: 95`);
  console.log(`Total rows with content below row 95: ${contentRows}`);
}

main().catch(console.error);
