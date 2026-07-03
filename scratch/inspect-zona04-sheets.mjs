import ExcelJS from 'exceljs';
import path from 'path';

const file = 'C:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD/zona 04 junio/JUNIO - ZONA 04.xlsx';

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log('Sheet names:');
  wb.worksheets.forEach((ws, idx) => {
    console.log(`[${idx}] "${ws.name}" - rows=${ws.rowCount}`);
  });

  const ws = wb.worksheets[0];
  console.log('\nFirst worksheet first 40 rows:');
  for (let r = 1; r <= 45; r++) {
    const row = ws.getRow(r);
    const vals = [];
    for (let c = 1; c <= 40; c++) {
      vals.push(row.getCell(c).value);
    }
    // Print row only if it has content
    if (vals.some(v => v !== null && v !== '')) {
      console.log(`Row ${String(r).padStart(2)}:`, vals.slice(0, 8).map(v => typeof v === 'object' && v !== null ? (v.richText ? v.richText.map(t=>t.text).join('') : JSON.stringify(v)) : v).join(' | '));
    }
  }
}

inspect().catch(console.error);
