const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
                results = results.concat(walk(file));
            }
        } else {
            const ext = path.extname(file);
            if (['.tsx', '.ts', '.css', '.html', '.js', '.mjs', '.cjs'].includes(ext)) {
                results.push(file);
            }
        }
    });
    return results;
}

const replacements = [
    { from: 'Ã³', to: 'ó' },
    { from: 'Ã¡', to: 'á' },
    { from: 'Ã©', to: 'é' },
    { from: 'Ã', to: 'í' }, // This one is tricky if it's just Ã
    { from: 'Ãº', to: 'ú' },
    { from: 'Ã±', to: 'ñ' },
    { from: 'Ã“', to: 'Ó' },
    { from: 'Ã ', to: 'Á' },
    { from: 'Ã‰', to: 'É' },
    { from: 'Ã ', to: 'Í' },
    { from: 'Ãš', to: 'Ú' },
    { from: 'Ã‘', to: 'Ñ' },
    { from: 'Â·', to: '·' },
    { from: 'â€“', to: '–' },
    { from: 'â€”', to: '—' },
    { from: 'Ã¼', to: 'ü' },
    { from: 'âœ“', to: '✓' },
    { from: 'âœ✎', to: '✎' }, // Found in 1135: âœ ï¸ 
    { from: 'âœ ï¸ ', to: '✎' },
];

const files = walk('c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src');
files.push('c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/index.html');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // We also need to handle the case where Ã followed by hidden/weird char is actually í
    // í is C3 AD. AD is non-printable.
    content = content.replace(/\xC3\xAD/g, 'í');
    content = content.replace(/\xC3\xB3/g, 'ó');
    content = content.replace(/\xC3\xA1/g, 'á');
    content = content.replace(/\xC3\xA9/g, 'é');
    content = content.replace(/\xC3\xBA/g, 'ú');
    content = content.replace(/\xC3\xB1/g, 'ñ');
    content = content.replace(/\xC3\x93/g, 'Ó');
    content = content.replace(/\xC3\x81/g, 'Á');
    content = content.replace(/\xC3\x89/g, 'É');
    content = content.replace(/\xC3\x8D/g, 'Í');
    content = content.replace(/\xC3\x9A/g, 'Ú');
    content = content.replace(/\xC3\x91/g, 'Ñ');
    content = content.replace(/\xC2\xB7/g, '·');

    replacements.forEach(r => {
        if (content.includes(r.from)) {
            content = content.split(r.from).join(r.to);
            changed = true;
        }
    });

    if (changed || content.includes('Ã')) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed: ${file}`);
    }
});
