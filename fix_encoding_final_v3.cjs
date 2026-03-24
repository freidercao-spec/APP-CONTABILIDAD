const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Use a very generic replacement for the broken sequences
    // \xC3\x81 is Á, \xC2\x81 is the non-printable char often found after it
    // \xC3\x93 is Ó but often shown as Á“
    
    // We'll replace sequences that look like the broken ones
    content = content.replace(/Á[\s\x80-\xFF]+GINA/g, 'PÁGINA');
    content = content.replace(/TÁ[\s\x80-\xFF]+CTICO/g, 'TÁCTICO');
    content = content.replace(/INSTALACIÁ[\s\x80-\xFF]+N/g, 'INSTALACIÓN');
    content = content.replace(/EMISIÁ[\s\x80-\xFF]+N/g, 'EMISIÓN');
    content = content.replace(/PROGRAMACIÁ[\s\x80-\xFF]+N/g, 'PROGRAMACIÓN');
    content = content.replace(/VERSIÁ[\s\x80-\xFF]+N/g, 'VERSIÓN');
    content = content.replace(/DETALLES TÁ[\s\x80-\xFF]+CNICOS/g, 'DETALLES TÉCNICOS');
    content = content.replace(/CÁ[\s\x80-\xFF]+DULA/g, 'CÉDULA');
    content = content.replace(/DÁ[\s\x80-\xFF]+AS/g, 'DÍAS');
    content = content.replace(/TÁ[\s\x80-\xFF]+CNICO/g, 'TÉCNICO');
    content = content.replace(/REPORTE TÁ[\s\x80-\xFF]+CTICO/g, 'REPORTE TÁCTICO');
    content = content.replace(/VÂ°BÂ°/g, 'V°B°');
    content = content.replace(/SUPERVISIÁ[\s\x80-\xFF]+N/g, 'SUPERVISIÓN');
    content = content.replace(/Á[\s\x80-\xFF]+N/g, 'ÓN'); // Very generic catch for any -ÓN suffix
    
    // Catch-all for basic UTF-8 double encoding patterns
    const map = {
        'Á“': 'Ó',
        'Á‰': 'É',
        'Á\xAD': 'Í',
        'Á\xA1': 'á',
        'Á\xA9': 'é',
        'Á\xAD': 'í',
        'Á³': 'ó',
        'Áº': 'ú',
        'Á±': 'ñ',
        'Á\xA0': 'á',
        'Â°': '°',
        'â”€': '──'
    };
    
    for (const [bad, good] of Object.entries(map)) {
        content = content.split(bad).join(good);
    }
    
    // One more pass for the specific "Á [char] N" pattern which is very common for "ÓN"
    content = content.replace(/ACIÁ\s+.N/g, 'ACIÓN');
    content = content.replace(/SIÁ\s+.N/g, 'SIÓN');

    fs.writeFileSync(filePath, content, 'utf8');
}

const files = [
    path.join(__dirname, 'src', 'pages', 'GestionPuestos.tsx'),
    path.join(__dirname, 'src', 'pages', 'Resumen.tsx'),
    path.join(__dirname, 'src', 'App.tsx'),
    path.join(__dirname, 'src', 'components', 'layout', 'Sidebar.tsx')
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        fixFile(f);
        console.log(`Fixed ${f}`);
    }
});
