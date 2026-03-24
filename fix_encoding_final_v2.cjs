const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Sequence for Ó: C3 93 inside a UTF-8 file being shown as C3 81 and C3 A2 or something?
    // Actually if it's UTF-8, Ó is C3 93. If I see Á“, it's literal C3 81 and E2 80 9C (in UTF8)
    
    const fixes = [
        { from: /Á“/g, to: 'Ó' },
        { from: /Á‰/g, to: 'É' },
        { from: /Á\u00ad/g, to: 'Í' },
        { from: /Á\u00a0/g, to: 'Á' },
        { from: /Áº/g, to: 'Ú' },
        { from: /Á±/g, to: 'ñ' },
        { from: /Á\u00a1/g, to: 'á' },
        { from: /Á\u00a9/g, to: 'é' },
        { from: /Á\/g, to: 'í' }, // risky
        { from: /Á³/g, to: 'ó' },
        { from: /Áº/g, to: 'ú' },
        { from: /Â°/g, to: '°' },
        { from: /â”€/g, to: '─' },
        // Specific combos seen in hex
        { from: /TÁ\u0081CTICO/g, to: 'TÁCTICO' }, // C3 81 C2 81
        { from: /PÁ GINA/g, to: 'PÁGINA' },
        { from: /TÁ CTICO/g, to: 'TÁCTICO' },
        { from: /INSTALACIÁ“N/g, to: 'INSTALACIÓN' },
        { from: /EMISIÁ“N/g, to: 'EMISIÓN' },
        { from: /CONFIGURACIÁ“N/g, to: 'CONFIGURACIÓN' },
        { from: /RELACIÁ“N/g, to: 'RELACIÓN' },
        { from: /ATENCIÁ“N/g, to: 'ATENCIÓN' },
        { from: /DIRECCIÁ“N/g, to: 'DIRECCIÓN' },
        { from: /GESTIÁ“N/g, to: 'GESTIÓN' },
        { from: /PROGRAMACIÁ“N/g, to: 'PROGRAMACIÓN' },
        { from: /VERSIÁ“N/g, to: 'VERSIÓN' },
        { from: /REPORTE TÁ CTICO/g, to: 'REPORTE TÁCTICO' },
        { from: /DETALLES TÁ‰CNICOS/g, to: 'DETALLES TÉCNICOS' },
        { from: /CÁ‰DULA/g, to: 'CÉDULA' },
        { from: /DÁ AS/g, to: 'DÍAS' },
        { from: /TÁ‰CNICO/g, to: 'TÉCNICO' },
        { from: /SÁ\u0081B/g, to: 'SÁB' },
        { from: /MÁ\u0081S/g, to: 'MÁS' },
        { from: /VÂ°BÂ°/g, to: 'V°B°' },
    ];

    fixes.forEach(f => {
        content = content.split(f.from).join(f.to);
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
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
    }
});
