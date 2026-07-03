const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'PROGRAMACION DE JULIO', 'JUNIO ZONA 20 - 2.xlsx');
console.log('Reading:', filePath);

const wb = XLSX.readFile(filePath);
console.log('Sheets:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  console.log('\n=== SHEET:', sheetName, '===');
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  data.slice(0, 50).forEach((row, i) => {
    if (row.some(c => c !== '')) {
      console.log(i + ':', JSON.stringify(row));
    }
  });
});
