const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
                results = results.concat(walk(filePath));
            }
        } else {
            const ext = path.extname(filePath);
            if (['.tsx', '.ts', '.css', '.html', '.js'].includes(ext)) {
                results.push(filePath);
            }
        }
    });
    return results;
}

const files = walk('c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src');
files.push('c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/index.html');

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // First, convert back known Mojibake strings
    content = content.split('Ã³').join('ó');
    content = content.split('Ã¡').join('á');
    content = content.split('Ã©').join('é');
    content = content.split('Ã³').join('ó');
    content = content.split('Â·').join('·');
    content = content.split('â€“').join('–');
    content = content.split('â€”').join('—');
    
    let secured = '';
    let changed = false;
    for (let i = 0; i < content.length; i++) {
        const charCode = content.charCodeAt(i);
        if (charCode > 127) {
            secured += '\\u' + charCode.toString(16).padStart(4, '0');
            changed = true;
        } else {
            secured += content[i];
        }
    }
    
    if (changed) {
        fs.writeFileSync(filePath, secured, 'utf8');
        console.log(`Secured all non-ASCII in: ${filePath}`);
    }
});
