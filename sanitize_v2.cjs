const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// More aggressive regex: find className={ followed by anything that doesn't start with quote/backtick
// and capture until the first }
// Including potential leading whitespace/tabs
const regex = /className=\{\s*([^`'"{][^}]*)\}/g;

let matchCount = 0;
const newContent = content.replace(regex, (match, p1) => {
    matchCount++;
    // Clean up p1: remove starting/ending whitespace and non-printable chars
    let cleaned = p1.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, ""); 
    return `className={\`${cleaned}\`}`;
});

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Global sanitization v2 complete. Replaced ${matchCount} broken className instances.`);
