const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find all occurrences of property: ${...} and wrap the value in backticks
// e.g. borderColor: ${s.color}22  => borderColor: `${s.color}22`
// Using a regex that looks for typical style properties followed by a ${
const regex = /(\w+):\s*(\$\{.*?\}[^,;\}\n]*)/g;

let matchCount = 0;
const newContent = content.replace(regex, (match, prop, val) => {
    // If it's already wrapped in quotes or backticks, skip
    if (val.startsWith('`') || val.startsWith("'") || val.startsWith('"')) {
        return match;
    }
    matchCount++;
    return `${prop}: \`${val.trim()}\``;
});

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Global style sanitization complete. Replaced ${matchCount} broken template literals in styles.`);
