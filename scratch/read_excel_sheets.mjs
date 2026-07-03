import XLSX from 'xlsx';
import path from 'path';

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';

async function analyze() {
  console.log(`Loading workbook from: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  
  console.log('Workbook loaded successfully.');
  console.log('Sheet Names:', workbook.SheetNames);
  
  // Analyze the first sheet
  const firstSheetName = workbook.SheetNames[0];
  console.log(`\nAnalyzing first sheet: "${firstSheetName}"`);
  const sheet = workbook.Sheets[firstSheetName];
  
  // Convert sheet to json with raw values
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total rows in sheet "${firstSheetName}": ${rows.length}`);
  
  console.log('\nFirst 20 rows (first 10 columns):');
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] || [];
    const truncatedRow = row.slice(0, 15);
    console.log(`Row ${i + 1}:`, truncatedRow);
  }
}

analyze().catch(err => {
  console.error('Error analyzing Excel file:', err);
});
