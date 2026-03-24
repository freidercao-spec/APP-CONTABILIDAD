const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { from: /EMISIÁ“N/g, to: 'EMISIÓN' },
    { from: /PÁ GINA/g, to: 'PÁGINA' },
    { from: /REPORTE TÁ CTICO DE PROGRAMACIÁ“N/g, to: 'REPORTE TÁCTICO DE PROGRAMACIÓN' },
    { from: /INSTALACIÁ“N/g, to: 'INSTALACIÓN' },
    { from: /VERSIÁ“N/g, to: 'VERSIÓN' },
    { from: /DETALLES TÁ‰CNICOS/g, to: 'DETALLES TÉCNICOS' },
    { from: /CÁ‰DULA/g, to: 'CÉDULA' },
    { from: /DÁ AS T\./g, to: 'DÍAS T.' },
    { from: /VÂ°BÂ° CONTROL Y SUPERVISIÁ“N/g, to: 'V°B° CONTROL Y SUPERVISIÓN' },
    { from: /REPORTE TÁ CTICO/g, to: 'REPORTE TÁCTICO' },
    { from: /PROGRAMACIÁ“N/g, to: 'PROGRAMACIÓN' },
    { from: /â”€â”€/g, to: '──' },
];

replacements.forEach(r => {
    content = content.replace(r.from, r.to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding issues in GestionPuestos.tsx');
