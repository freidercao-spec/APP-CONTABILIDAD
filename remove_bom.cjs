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
    let buf = fs.readFileSync(filePath);
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        buf = buf.subarray(3);
        fs.writeFileSync(filePath, buf);
        console.log(`BOM removed from: ${filePath}`);
    }
});
