import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

function normNombre(n) { return (n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }
function sim(a,b) {
  const wa=new Set(normNombre(a).split(' ')), wb=new Set(normNombre(b).split(' '));
  const c=[...wa].filter(w=>w.length>3&&wb.has(w));
  return c.length/Math.max(wa.size,wb.size);
}

const { data: puestosDB } = await sb.from('puestos').select('id,nombre').eq('empresa_id',EMPRESA_ID);

function buscarPuesto(cliente) {
  let best=null,bs=0;
  for(const p of puestosDB){const s=sim(cliente,p.nombre);if(s>bs){bs=s;best=p;}}
  if(bs>=0.4)return { best, bs, method: 'sim' };
  for(const p of puestosDB){const pn=normNombre(p.nombre);for(const w of normNombre(cliente).split(' ').filter(x=>x.length>3)){if(pn.includes(w))return { best: p, bs: 0.1, method: 'word' };}}
  return { best: null, bs: 0, method: 'none' };
}

console.log('Matches list:');
for (const p of excelData) {
  const m = buscarPuesto(p.cliente);
  console.log(`Excel: "${p.cliente.trim()}" -> DB: "${m.best ? m.best.nombre : 'NOT FOUND'}" (${m.method}, score: ${m.bs})`);
}
