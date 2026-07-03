import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('scratch/excel_parsed_zona04.json', 'utf-8'));
const empty = data.filter(item => item.guardas && item.guardas.length > 0 && Object.keys(item.guardas[0].dias).length === 0);
console.log('Empty items count:', empty.length);
if (empty.length > 0) {
  console.log('Sample empty item:', JSON.stringify(empty[0], null, 2));
}
