import XLSX from 'xlsx';

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';

async function parseDetails() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['JUNIO'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Let's print the first block's header and first guard in detail
  let foundHeaders = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    // Find header
    const cedulaIdx = row.findIndex(val => typeof val === 'string' && val.includes('CEDULA'));
    if (cedulaIdx !== -1 && !foundHeaders) {
      console.log('--- Header Row ---');
      console.log(row.map((val, idx) => `Col ${idx}: "${val}"`).join('\n'));
      foundHeaders = true;
      
      console.log('\n--- Next 5 Rows ---');
      for (let j = 1; j <= 5; j++) {
        const nextRow = rows[i + j] || [];
        console.log(`Row ${i + j + 1}:`, nextRow);
      }
      break;
    }
  }
}

parseDetails().catch(err => console.error(err));
