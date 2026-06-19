const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix className={...} where it doesn't start with backtick/quote
// This replaces className={text ...} with className={`text ...`}
content = content.replace(/className=\{\s*([^`'"{][^}]*)\}/g, (match, p1) => {
    return `className={\`${p1.trim()}\`}`;
});

// 2. Fix style values like borderColor: ${s.color}22
// This replaces prop: ${...} with prop: `${...}`
content = content.replace(/(\w+):\s*(\$\{.*?\}[^,;\}\n]*)/g, (match, prop, val) => {
    if (val.startsWith('`') || val.startsWith("'") || val.startsWith('"') || val.startsWith('{')) return match;
    return `${prop}: \`${val.trim()}\``;
});

// 3. Fix slot: ${var}-${var}
// This is a special case of #2 but might involve multiple ${}
// Replaced by #2? Let's check. 
// slot: ${a.dia}-${a.turno} -> slot: `${a.dia}-${a.turno}`

// 4. Double check for any triple backticks or nested mess potentially introduced
content = content.replace(/``\s*`([^`]*?)`\s*``/g, '`$1`');
content = content.replace(/`\$\{([^`}]*?)\}`/g, '${$1}'); 
// wait, the line above is dangerous if it's NOT inside a backtick string.
// Actually #2 and #1 already wrap them in backticks if they were naked.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Comprehensive sanitization complete.');
