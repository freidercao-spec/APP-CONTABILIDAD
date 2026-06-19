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
    
    // Clean up. Remove existing escapes (though they should be gone)
    content = content.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
    });

    // Fix Mojibake back to UTF-8
    const fixes = [
        ['Ã³', 'ó'], ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ãº', 'ú'], ['Ã±', 'ñ'],
        ['Ã“', 'Ó'], ['Ã ', 'Á'], ['Ã‰', 'É'], ['Ã ', 'Í'], ['Ãš', 'Ú'], ['Ã‘', 'Ñ'],
        ['Â·', '·'], ['â€“', '–'], ['â€”', '—'], ['Ã¼', 'ü'], ['Ã ', 'à']
    ];
    fixes.forEach(([from, to]) => {
        content = content.split(from).join(to);
    });
    
    // Add UTF-8 BOM if it's a source file
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const buf = Buffer.concat([bom, Buffer.from(content, 'utf8')]);
    
    fs.writeFileSync(filePath, buf);
    console.log(`Saved with BOM: ${filePath}`);
});
