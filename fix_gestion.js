const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');
let c = fs.readFileSync(filePath, 'utf8');
const lines = c.split('\n');

// Count broken className patterns
let fixCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Pattern 1: className={px-2 py-6 border-r border-white/5 text-center transition-all }
  if (line.includes('className={px-2 py-6 border-r border-white/5 text-center transition-all }')) {
    lines[i] = line.replace(
      'className={px-2 py-6 border-r border-white/5 text-center transition-all }',
      'className={`px-2 py-6 border-r border-white/5 text-center transition-all ${isWeekend ? \'bg-indigo-950/20\' : \'\'}`}'
    );
    fixCount++;
    console.log('Fixed line', i + 1, '(day header th)');
  }

  // Pattern 2: className={\text-lg font-black italic }
  // The backslash before 'text' is what appears in the raw file
  if (line.includes('className={\\text-lg font-black italic }') || line.includes('className={\\text-lg')) {
    lines[i] = line.replace(
      /className=\{\\text-lg font-black italic \}/,
      'className={`text-lg font-black italic ${isWeekend ? \'text-primary-light\' : \'text-slate-200\'}`}'
    );
    fixCount++;
    console.log('Fixed line', i + 1, '(day number p)');
  }

  // Catch-all: find any className={ followed immediately by a CSS class (not a quote, backtick, or expression)
  // but avoid already-fixed ones
  if (/className=\{[a-z]/.test(line) && !line.includes('className={`')) {
    console.log('POTENTIAL BROKEN className at line', i + 1, ':', line.trim().substring(0, 80));
  }
}

const result = lines.join('\n');
fs.writeFileSync(filePath, result, 'utf8');
console.log('\nTotal fixes applied:', fixCount);

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
const vlines = verify.split('\n');
console.log('Line 1974:', vlines[1973].trim().substring(0, 90));
console.log('Line 1978:', vlines[1977].trim().substring(0, 90));
