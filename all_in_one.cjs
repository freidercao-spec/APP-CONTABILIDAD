const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// Global fixes
c = c.replace(/className=\{\s*([^`'"{][^}]*)\}/g, (m, p1) => `className={\`${p1.trim()}\`}`);
c = c.replace(/(\w+):\s*(\$\{.*?\}[^,;\}\n]*)/g, (m, p, v) => {
    if (v.startsWith('`') || v.startsWith("'") || v.startsWith('"')) return m;
    return `${p}: \`${v.trim()}\``;
});
c = c.replace(/`([^`\n]*?)`(\$\{.*?\})`([^`\n]*?)`/g, '`$1$2$3`');
c = c.replace(/(\$\{.*?\})\s*\}\s*\}/g, '$1`}');
c = c.replace(/`\$\{([^`}]*?)\}`/g, '${$1}');

// Specific fixes
c = c.replace('logAction("PROGRAMACION", "Personal Actualizado", `Puesto: `${puestoNombre}``, "success");', 'logAction("PROGRAMACION", "Personal Actualizado", `Puesto: ${puestoNombre}`, "success");');

fs.writeFileSync(filePath, c, 'utf8');
console.log('Final All-In-One fix complete.');
