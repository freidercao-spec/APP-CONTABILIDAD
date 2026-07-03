import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'excel_parsed_zona07.json');

function main() {
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  const codes = new Set();
  
  data.forEach(p => {
    p.guardas.forEach(g => {
      Object.values(g.dias).forEach(c => {
        if (c) codes.add(String(c).trim().toUpperCase());
      });
    });
  });

  console.log('Unique codes in ZONA 07 parsed JSON:', Array.from(codes));
}

main();
