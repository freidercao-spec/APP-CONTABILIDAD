import XLSX from 'xlsx';

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';

async function parse() {
  console.log('Loading workbook...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['JUNIO'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`Loaded ${rows.length} rows.`);

  const puestos = [];
  let currentPuesto = null;
  let inGuardRows = false;
  let headers = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    // Check if we find a title row
    const titleVal = row.find(val => typeof val === 'string' && val.includes('PROGRAMACION DE TURNOS'));
    if (titleVal) {
      inGuardRows = false;
      currentPuesto = null;
      headers = null;
      continue;
    }

    // Check for PUESTO DE SERVICIO / EMPRESA / CLIENTE
    // Wait, let's scan columns for PUESTO DE SERVICIO or EMPRESA / CLIENTE
    const empresaIdx = row.findIndex(val => typeof val === 'string' && val.includes('EMPRESA / CLIENTE:'));
    if (empresaIdx !== -1) {
      const clientName = row[empresaIdx + 3] || row[empresaIdx + 2] || row[empresaIdx + 1];
      currentPuesto = {
        cliente: clientName,
        servicio: '',
        guards: [],
        startRow: i
      };
      puestos.push(currentPuesto);
      continue;
    }

    const puestoIdx = row.findIndex(val => typeof val === 'string' && val.includes('PUESTO DE SERVICIO:'));
    if (puestoIdx !== -1 && currentPuesto) {
      currentPuesto.servicio = row[puestoIdx + 3] || row[puestoIdx + 2] || row[puestoIdx + 1];
      continue;
    }

    // Check for the header row containing CEDULA / APELLIDOS Y NOMBRES
    const cedulaIdx = row.findIndex(val => typeof val === 'string' && val.includes('CEDULA'));
    if (cedulaIdx !== -1) {
      headers = row;
      inGuardRows = true;
      continue;
    }

    // If we are in guard rows, check if this is a guard row
    if (inGuardRows) {
      const cedula = row[5]; // CEDULA is usually in column 5 (F)
      const nombre = row[6]; // NOMBRE is in column 6 (G)
      
      // A valid guard row has a numerical cedula or a string name
      if (cedula && nombre && typeof nombre === 'string' && nombre.trim()) {
        // Collect days schedule
        const schedule = {};
        // Days start from column 9 (1L, 2M, ...)
        for (let colIdx = 9; colIdx < row.length; colIdx++) {
          const headerVal = headers[colIdx];
          if (headerVal) {
            schedule[headerVal] = row[colIdx];
          }
        }
        
        currentPuesto.guards.push({
          cedula: String(cedula).trim(),
          nombre: nombre.trim(),
          anio: row[7],
          mes: row[8],
          schedule
        });
      }
    }
  }

  console.log(`\nParsed ${puestos.length} puesto blocks:`);
  puestos.forEach((p, idx) => {
    console.log(`[${idx + 1}] Cliente/Puesto: ${p.cliente} | Servicio: ${p.servicio} | Guards Count: ${p.guards.length}`);
    if (p.guards.length > 0) {
      console.log('    Guards:', p.guards.map(g => `${g.nombre} (${g.cedula})`).join(', '));
    }
  });
}

parse().catch(err => console.error(err));
