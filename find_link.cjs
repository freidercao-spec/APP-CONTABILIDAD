const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Mirley\\Downloads\\APP - PORGRAMACION\\coraza-cta-app';
const target = 'vercel.app';

function search(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            if (file === 'node_modules' || file === '.git') continue;
            search(fullPath);
        } else if (file.endsWith('.txt') || file.endsWith('.md')) {
            try {
                const buffer = fs.readFileSync(fullPath);
                let content = '';
                try { content = buffer.toString('utf-8'); } catch (e) {}
                if (!content.includes(target)) {
                  try { content = buffer.toString('utf16le'); } catch (e) {}
                }
                
                if (content.includes(target)) {
                    const lines = content.split('\n');
                    lines.forEach((line, i) => {
                        if (line.includes(target)) {
                            console.log(`${fullPath} [L${i+1}]: ${line.trim()}`);
                        }
                    });
                }
            } catch (e) {}
        }
    }
}

search(dir);
