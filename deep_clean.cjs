const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix double backticks around template expressions
// `foo: `${bar}`` -> `foo: ${bar}`
let count = 0;
let oldContent;
do {
    oldContent = content;
    content = content.replace(/`([^`\n]*?)`(\$\{.*?\})`([^`\n]*?)`/g, (match, prefix, expr, suffix) => {
        count++;
        return `\`${prefix}${expr}${suffix}\``;
    });
} while (content !== oldContent);

// 2. Fix naked template expressions in common places
// - Function arguments: doc.text(${foo}, ...)
content = content.replace(/(\w+\.\w+\()([^`'"{]*?)(\$\{.*?\})([^`'"{]*?)([,)])/g, (match, fn, start, expr, end, suffix) => {
    count++;
    return `${fn}\`${start}${expr}${end}\`${suffix}`;
});

// - Variable assignments: const x = ${foo};
content = content.replace(/=\s*(\$\{.*?\}(?:-\$\{.*?\})*)(?=\s*;|\s*$)/g, (match, val) => {
    count++;
    return `= \`${val}\``;
});

// 3. Fix the "mojibake" or weird chars appearing as tabs/spaces before className
content = content.replace(/className=\{\s*([^`'"{][^}]*)\}/g, (match, p1) => {
    count++;
    return `className={\`${p1.trim()}\`}`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Deep cleaning complete. Replaced ${count} potential corruption points.`);
