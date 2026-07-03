import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('scratch/excel_parsed_zona04.json', 'utf-8'));
const belfor = data.find(item => item.cliente && item.cliente.includes('BELFOR'));
console.log('Belfor:', JSON.stringify(belfor, null, 2));
