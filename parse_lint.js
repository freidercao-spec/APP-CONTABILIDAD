const fs = require('fs');
try {
  const content = fs.readFileSync('lint-utf8.json', 'utf8');
  const data = JSON.parse(content);
  data.forEach(f => {
    const errs = f.messages.filter(m => m.severity === 2);
    if(errs.length > 0) {
      console.log('FILE:', f.filePath);
      errs.forEach(e => console.log('  Line ' + e.line + ': ' + e.message));
    }
  });
} catch (e) {
  console.error("Error parsing JSON:", e);
}
