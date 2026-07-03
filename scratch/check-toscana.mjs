import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'excel_parsed.json');

const excelData = JSON.parse(readFileSync(filePath, 'utf-8'));

for (const ep of excelData) {
  if (ep.cliente.includes('TOSCANA')) {
    console.log(JSON.stringify(ep, null, 2));
  }
}
