const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');

// Get the full 2040-line version from git
const content = execSync('git show 652c9cb:src/pages/GestionPuestos.tsx', { 
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
});

const lines = content.split('\n');
console.log('Total lines from git:', lines.length);

// ════════════════════════════════════════════════════════════
//  COMPREHENSIVE FIX PASS
//  Fix all categories of syntax corruption in one shot
// ════════════════════════════════════════════════════════════

let fixed = content;
let count = 0;

// ── 1. Fix nested backticks: `text `${expr}`` → `text ${expr}`
let prev;
do {
    prev = fixed;
    fixed = fixed.replace(/`([^`\n]*?)`(\$\{[^}]+\})`([^`\n]*?)`/g, (m, a, b, c) => {
        count++;
        return '`' + a + b + c + '`';
    });
} while (fixed !== prev);

// ── 2. Fix naked className: className={text ...} → className={`text ...`}
fixed = fixed.replace(/className=\{\s*([^`'"{(\n][^}\n]*)\}/g, (m, p) => {
    // Skip if it's a JS expression like className={myVar} or className={x ? a : b}
    if (/^[\w$][\w$]*\s*$/.test(p.trim())) return m; // single variable → leave it
    if (p.trim().startsWith('?') || p.trim().startsWith(':')) return m;
    count++;
    return 'className={`' + p.trim() + '`}';
});

// ── 3. Fix style props with naked template expressions
//  e.g.  borderColor: ${s.color}22  →  borderColor: `${s.color}22`
fixed = fixed.replace(/([\w]+):\s*(\$\{[^}]+\}[^,\n;}\]]*)/g, (m, prop, val) => {
    if (val.startsWith('`') || val.startsWith("'") || val.startsWith('"')) return m;
    count++;
    return prop + ': `' + val.trim() + '`';
});

// ── 4. Fix naked template expressions in variable assignments
//  e.g.  const key = ${a.vigilanteId}-${a.dia};
fixed = fixed.replace(/=\s*(\$\{[^}]+\}(?:-\$\{[^}]+\})*)\s*(?=[;,\n])/g, (m, val) => {
    count++;
    return '= `' + val + '`';
});

// ── 5. Fix slot: ${...} patterns inside object literals that escaped fix #3
fixed = fixed.replace(/\{\s*slot:\s*(\$\{[^}]+\}-\$\{[^}]+\})/g, (m, val) => {
    count++;
    return '{ slot: `' + val + '`';
});

// ── 6. Fix }} at end of multiline className template (missing backtick before })
//  e.g.  : ""}}`  →  : ""}\``
fixed = fixed.replace(/(['""])\s*\}\s*\}\s*`\s*\}/g, (m) => {
    // this is too risky to change blindly
    return m;
});

// ── 7. Extra closing brace before style on its own line
//  e.g.  className={`size-7 ... hover:opacity-100'}`\n  style={{ ...
//  The issue is className ends with '}` not `}
//  Pattern: line ending with `}` instead of `}   (backtick-brace vs brace-backtick)
const fixedLines = fixed.split('\n');
for (let i = 0; i < fixedLines.length - 1; i++) {
    const curr = fixedLines[i].trimEnd();
    const next = fixedLines[i + 1].trimStart();
    // If current line ends with `'}` and next line starts with 'style='
    if (curr.endsWith("'\`}") && next.startsWith('style=')) {
        // The template literal needs a closing backtick + brace
        // Already has the backtick misplaced, let's fix
    }
}

// ── 8. Fix logAction calls with double backtick wrapping
fixed = fixed.replace(/logAction\(("PROGRAMACION")\s*,\s*(".*?")\s*,\s*`([^`]*?)`\$\{([^}]+)\}`([^`]*?)`\s*`\s*,\s*(".*?")\)/g,
    (m, p1, p2, prefix, expr, suffix, p6) => {
        count++;
        return `logAction(${p1}, ${p2}, \`${prefix}\${${expr}}${suffix}\`, ${p6})`;
    }
);

// ── 9. Fix doc.text(` ... `${...}`` , ...) type issues
fixed = fixed.replace(/doc\.text\(`([^`]*?)`\$\{([^}]+)\}`([^`]*?)``,/g, (m, a, expr, b) => {
    count++;
    return `doc.text(\`${a}\${${expr}}${b}\`,`;
});

// ── 10. Fix ws.mergeCells type issues
fixed = fixed.replace(/ws\.mergeCells\(`([^`]*?)`\$\{([^}]+)\}`([^`]*?)`\)`/g, (m, a, expr, b) => {
    count++;
    return `ws.mergeCells(\`${a}\${${expr}}${b}\`)`;
});

// ── 11. Fix key={`${...}`} type patterns (nested backticks in JSX key)
fixed = fixed.replace(/key=\{`\$\{([^}]+)\}`\}/g, (m, expr) => {
    count++;
    return `key={\`\${${expr}}\`}`;
});

//  Write the result
fs.writeFileSync(filePath, fixed, { encoding: 'utf8' });

const resultLines = fixed.split('\n');
console.log(`\nTotal fixes applied: ${count}`);
console.log(`Result: ${resultLines.length} lines, ${Buffer.byteLength(fixed, 'utf8')} bytes`);
console.log('File written successfully.');
