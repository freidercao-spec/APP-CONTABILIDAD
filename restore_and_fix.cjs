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
    
    // 1. Revert literal \uXXXX sequences back to characters
    content = content.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
    });
    
    // 2. Fix Mojibake
    content = content.split('Ã³').join('ó');
    content = content.split('Ã¡').join('á');
    content = content.split('Ã©').join('é');
    content = content.split('Ã­').join('í');
    content = content.split('Ãº').join('ú');
    content = content.split('Ã±').join('ñ');
    content = content.split('Ã³').join('ó');
    content = content.split('Â·').join('·');
    content = content.split('â€“').join('–');
    content = content.split('â€”').join('—');
    content = content.split('Ã¼').join('ü');
    
    // 3. Write back as UTF-8
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Restored and cleaned: ${filePath}`);
});
