const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src/pages/GestionPuestos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace corrupted emoji sequences with Material Symbols
content = content.replace(/ðŸ‘¤/g, '<span className="material-symbols-outlined text-[10px]">person</span>');
content = content.replace(/ðŸ“/g, '<span className="material-symbols-outlined text-[10px]">description</span>');
content = content.replace(/ðŸ“©/g, '<span className="material-symbols-outlined text-[10px]">mail</span>');
content = content.replace(/ðŸ’/g, '<span className="material-symbols-outlined text-[10px]">security</span>');
content = content.replace(/ðŸ”/g, '<span className="material-symbols-outlined text-[10px]">location_on</span>');

// Also check for any literal emoji and replace them to be safe
content = content.replace(/👤/g, '<span className="material-symbols-outlined text-[10px]">person</span>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed emojis in GestionPuestos.tsx');
