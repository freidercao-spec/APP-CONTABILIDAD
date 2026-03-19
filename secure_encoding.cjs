const fs = require('fs');

const filePaths = [
    'c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src/pages/GestionPuestos.tsx',
    'c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src/components/layout/Topbar.tsx',
    'c:/Users/Mirley/Downloads/APP - PORGRAMACION/coraza-cta-app/src/pages/Puestos.tsx'
];

const escapes = {
    'á': '\\u00e1', 'é': '\\u00e9', 'í': '\\u00ed', 'ó': '\\u00f3', 'ú': '\\u00fa', 'ñ': '\\u00f1',
    'Á': '\\u00c1', 'É': '\\u00c9', 'Í': '\\u00cd', 'Ó': '\\u00d3', 'Ú': '\\u00da', 'Ñ': '\\u00d1',
    '·': '\\u00b7', '–': '\\u2013', '—': '\\u2014', 'ü': '\\u00fc', '✓': '\\u2713'
};

filePaths.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [char, escape] of Object.entries(escapes)) {
        content = content.split(char).join(escape);
    }
    // Also catch some Mojibake sequences that might have stayed
    content = content.replace(/Ã³/g, '\\u00f3');
    content = content.replace(/Ã¡/g, '\\u00e1');
    content = content.replace(/Ã©/g, '\\u00e9');
    content = content.replace(/Ã/g, '\\u00ed'); // Danger?
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Secured: ${filePath}`);
});
