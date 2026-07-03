const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'PROGRAMACION DE JULIO', 'JUNIO ZONA 20 - 2.xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Parse all rows
const puestos = [];
let currentPuesto = null;
let headerRowIdx = -1;

const DAYS = ['1L','2M','3W','4J','5V','6S','7D','8L','9M','10W','11J','12V','13S','14D',
  '15L','16M','17W','18J','19V','20S','21D','22L','23M','24W','25J','26V','27S','28D',
  '29L','30M','31D'];

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  
  // Detect puesto header block
  if (row[7] === 'EMPRESA / CLIENTE:') {
    currentPuesto = {
      cliente: row[10] || '',
      puesto: '',
      direccion: '',
      guardas: []
    };
    puestos.push(currentPuesto);
  }
  if (currentPuesto && row[7] === 'PUESTO DE SERVICIO:') {
    currentPuesto.puesto = row[10] || '';
  }
  
  // Detect data header row (CEDULA column)
  if (row[5] === 'CEDULA ') {
    headerRowIdx = i;
    continue;
  }
  
  // Detect guard data rows (have cedula number)
  if (headerRowIdx >= 0 && typeof row[5] === 'number' && row[5] > 1000 && row[6]) {
    const guarda = {
      cedula: row[5],
      nombre: row[6],
      anio: row[7],
      mes: row[8],
      dias: {}
    };
    
    // Days start at column 9
    for (let d = 0; d < DAYS.length; d++) {
      const val = row[9 + d];
      if (val !== '') {
        guarda.dias[d + 1] = val; // 1-indexed day
      }
    }
    
    guarda.totalDia = row[40];
    guarda.totalNoche = row[41];
    guarda.totalDescansos = row[42];
    
    if (currentPuesto) {
      currentPuesto.guardas.push(guarda);
    }
  }
}

console.log('=== PUESTOS ENCONTRADOS ===');
puestos.forEach((p, pi) => {
  console.log(`\nPUESTO ${pi+1}: ${p.cliente} - ${p.puesto}`);
  p.guardas.forEach(g => {
    console.log(`  Guarda: ${g.nombre} (CC: ${g.cedula})`);
    console.log(`  Mes: ${g.mes} ${g.anio}`);
    const diasStr = Object.entries(g.dias).map(([d,t]) => `${d}:${t}`).join(', ');
    console.log(`  Dias: ${diasStr}`);
    console.log(`  Total: Dia=${g.totalDia}, Noche=${g.totalNoche}, Descansos=${g.totalDescansos}`);
  });
});

// Save full parsed data
const fs = require('fs');
fs.writeFileSync('./scratch/excel_parsed.json', JSON.stringify(puestos, null, 2));
console.log('\n\nSaved to scratch/excel_parsed.json');
