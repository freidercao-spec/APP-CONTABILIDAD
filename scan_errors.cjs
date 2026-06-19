const fs = require('fs');
const lines = fs.readFileSync('src/pages/GestionPuestos.tsx', 'utf8').split('\n');
const errors = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Naked template expression
    if (line.includes('${') && !line.includes('`')) {
        errors.push({ line: i + 1, content: line.trim(), type: 'Naked Expression' });
    }
    // Nested backticks
    if (line.match(/`[^`]*?`(\$\{.*?\})`[^`]*?`/)) {
        errors.push({ line: i + 1, content: line.trim(), type: 'Nested Backticks' });
    }
    // Naked className
    if (line.includes('className={') && !line.includes('`') && !line.match(/className=\{['"]/)) {
        // Double check if it's a variable or object
        if (!line.match(/className=\{\s*(\w+|\[.*?\]|\{.*?\})\s*\}/)) {
            errors.push({ line: i + 1, content: line.trim(), type: 'Naked className' });
        }
    }
}
console.log(JSON.stringify(errors, null, 2));
