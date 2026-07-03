import { readFileSync } from 'fs';

const files = [
  'src/pages/GestionPuestos.tsx',
  'src/pages/Puestos.tsx'
];

for (const file of files) {
  console.log(`\n=== FILE: ${file} ===`);
  const lines = readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('logo.png')) {
      console.log(`${idx + 1}: ${line.trim()}`);
      // Print context (3 lines before and after)
      for (let i = Math.max(0, idx - 3); i <= Math.min(lines.length - 1, idx + 3); i++) {
        console.log(`  [${i + 1}] ${lines[i]}`);
      }
    }
  });
}
