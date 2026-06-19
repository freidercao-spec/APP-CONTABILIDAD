const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Regex to find className={ any_text_without_quotes }
// We look for className={ followed by something that is NOT a backtick, quote, or open brace.
const regex = /className=\{([^`'"{][^}]*)\}/g;

let matchCount = 0;
const newContent = content.replace(regex, (match, p1) => {
    matchCount++;
    // Wrap the content in backticks
    return `className={\`${p1.trim()}\`}`;
});

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Global sanitization complete. Replaced ${matchCount} broken className instances.`);
