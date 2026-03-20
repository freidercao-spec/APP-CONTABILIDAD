/**
 * fix_all_encoding.cjs
 * Fixes UTF-8 encoding corruption in all source TSX/TS files.
 * The â"€ characters are corrupted box-drawing / em-dash chars.
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

// Mapping of corrupted sequences to their correct replacement
const REPLACEMENTS = [
  // Box drawing / line chars that appear as â"€ etc.
  [/â"€/g, '─'],
  [/â"‚/g, '│'],
  [/â"/g, '┌'],
  [/â"┐/g, '┐'],
  [/â""â"€/g, '└─'],
  [/â"˜/g, '┘'],
  [/â"œ/g, '├'],
  [/â"¬/g, '┬'],
  [/â"´/g, '┴'],
  [/â"¼/g, '┼'],
  // Smart quotes / special chars
  [/â€œ/g, '"'],
  [/â€/g, '"'],
  [/â€˜/g, "'"],
  [/â€™/g, "'"],
  [/â€¦/g, '…'],
  [/â€"/g, '–'],
  [/â€"/g, '—'],
  // Accented characters that got corrupted
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ã­/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'],
  [/Ã/g, 'Á'],
  [/Ã‰/g, 'É'],
  [/Ã/g, 'Í'],
  [/Ã"]/g, 'Ó'],
  [/Ãš/g, 'Ú'],
  [/Ã'/g, 'Ñ'],
  [/Â¿/g, '¿'],
  [/Â¡/g, '¡'],
  // Remaining artifacts
  [/Â /g, ' '],
  [/Â·/g, '·'],
];

let totalFixed = 0;
let totalFiles = 0;

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name.match(/\.(tsx|ts|css|json)$/)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [pattern, replacement] of REPLACEMENTS) {
        const before = content;
        content = content.replace(pattern, replacement);
        if (content !== before) changed = true;
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Fixed: ${path.relative(__dirname, fullPath)}`);
        totalFixed++;
      }
      totalFiles++;
    }
  }
}

console.log('🔧 CORAZA - Encoding Fix Tool');
console.log('================================');
processDir(SRC_DIR);
console.log(`\n📊 Processed ${totalFiles} files, fixed ${totalFixed} files.`);
console.log('✅ Done!');
