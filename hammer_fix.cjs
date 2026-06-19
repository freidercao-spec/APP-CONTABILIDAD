const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find any ${...} not in a string or backtick
// This is hard to do with regex perfectly, but let's try 
// finding common broken spots.

// Fix slot: ${...} and key: ${...} and similar
content = content.replace(/(\w+):\s*(\$\{.*?\}(?:-\$\{.*?\})*)/g, (match, prop, val) => {
    if (val.startsWith('`') || val.startsWith("'") || val.startsWith('"')) return match;
    return `${prop}: \`${val}\``;
});

// Final hammer: line 585 specifically
content = content.replace(/\.push\(\{ slot: \$\{a\.dia\}-\$\{a\.turno\}/, ".push({ slot: `${a.dia}-${a.turno}`");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Hammer fix complete.');
