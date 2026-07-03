import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('scratch/excel_parsed_zona04.json', 'utf-8'));
const autonoma = data.find(item => item.cliente === 'AUTONOMA');
const amisi = data.find(item => item.cliente === 'AMISI');

console.log('Autonoma:', JSON.stringify(autonoma, null, 2));
console.log('Amisi:', JSON.stringify(amisi, null, 2));
