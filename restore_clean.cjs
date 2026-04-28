const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/GestionPuestos.tsx');

// Get the clean file from the latest good commit
const content = execSync('git show d553614:src/pages/GestionPuestos.tsx', { 
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer
});

console.log('Got content, length:', content.length, 'lines:', content.split('\n').length);

// Write directly - no intermediate steps
fs.writeFileSync(filePath, content, { encoding: 'utf8' });

console.log('SUCCESS: File written cleanly from git commit d553614');

// Quick verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('Verified file size:', verify.length, 'bytes,', verify.split('\n').length, 'lines');
