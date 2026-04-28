const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Properties that usually take string values
const props = ['boxShadow', 'backdropFilter', 'background', 'border', 'transition', 'animation', 'fontFamily', 'transform'];

let matchCount = 0;
let newContent = content;

props.forEach(prop => {
    // Find prop: val where val doesn't start with quote/backtick/open brace, 
    // and val contains spaces or non-variable chars (like decimals/units)
    const regex = new RegExp(`${prop}:\\s*([^'\"\`\\s\\{\\[][^,;\\n\\}]*)`, 'g');
    newContent = newContent.replace(regex, (match, val) => {
        // Double check if it's already a string
        if (/^['\"\`]/.test(val.trim())) return match;
        // If it's a number, skip
        if (/^\d+(\.\d+)?$/.test(val.trim())) return match;
        
        matchCount++;
        return `${prop}: '${val.trim()}'`;
    });
});

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Global CSS property sanitization complete. Replaced ${matchCount} broken property values.`);
