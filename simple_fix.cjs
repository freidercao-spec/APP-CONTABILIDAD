const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The line esbuild is complaining about:
const badLine = '            .push({ slot: ${a.dia}-${a.turno}, puesto: pNombre });';
const goodLine = '            .push({ slot: `${a.dia}-${a.turno}`, puesto: pNombre });';

if (content.includes(badLine)) {
    content = content.replace(badLine, goodLine);
}

// Any other naked ${...} in common spots
content = content.replace(/ \$\{puestoNombre\} /g, ' `${puestoNombre}` ');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Very simple string fix complete.');
