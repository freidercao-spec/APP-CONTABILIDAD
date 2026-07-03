import XLSX from 'xlsx';

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';

async function inspectValues() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['JUNIO'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const uniqueValues = new Set();
  let inGuardRows = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    const cedulaIdx = row.findIndex(val => typeof val === 'string' && val.includes('CEDULA'));
    if (cedulaIdx !== -1) {
      inGuardRows = true;
      continue;
    }

    const titleVal = row.find(val => typeof val === 'string' && val.includes('PROGRAMACION DE TURNOS'));
    if (titleVal) {
      inGuardRows = false;
      continue;
    }

    if (inGuardRows) {
      const cedula = row[5];
      const nombre = row[6];
      
      // Exclude legend rows
      if (cedula && nombre && typeof nombre === 'string' && nombre.trim()) {
        const nUpper = nombre.toUpperCase();
        if (nUpper.includes('HORARIO') || nUpper.includes('TURNO') || nUpper.includes('DESCANSO') || nUpper.includes('DISPONIBLE') || nUpper.includes('APELLIDOS')) {
          continue;
        }
        
        // Loop through day columns (9 to 39)
        for (let colIdx = 9; colIdx <= 39; colIdx++) {
          const val = row[colIdx];
          if (val !== undefined && val !== null) {
            uniqueValues.add(String(val).trim());
          }
        }
      }
    }
  }

  console.log('Unique Day Cell Values Found in Sheet:');
  console.log(Array.from(uniqueValues));
}

inspectValues().catch(err => console.error(err));
