const fs = require('fs');
const lines = fs.readFileSync('src/pages/GestionPuestos.tsx', 'utf8').split('\n');
const errors = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Count backticks, braces
    const btCount = (line.match(/`/g) || []).length;
    const braceOpen = (line.match(/\{/g) || []).length;
    const braceClose = (line.match(/\}/g) || []).length;
    
    // Ignore lines that are clearly objects or complex
    if (line.includes('className={') || line.includes('style={{')) {
        if (btCount % 2 !== 0 && !line.includes('//')) {
             errors.push({ line: i + 1, content: line.trim(), type: 'Odd Backticks' });
        }
        if (line.includes('${') && btCount === 0) {
             errors.push({ line: i + 1, content: line.trim(), type: 'Naked Expression' });
        }
    }
}
console.log(JSON.stringify(errors, null, 2));
