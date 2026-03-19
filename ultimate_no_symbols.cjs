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

const safeFixes = [
    [/Programación/g, 'CUADRO OPERATIVO'],
    [/Gestión/g, 'GESTION'],
    [/ProgramaciÃ³n/g, 'CUADRO OPERATIVO'],
    [/GestiÃ³n/g, 'GESTION'],
    [/Â·/g, '-'],
    [/·/g, '-'],
    [/â€“/g, 'a'],
    [/–/g, 'a'],
    [/â€”/g, '-'],
    [/—/g, '-'],
    [/élite/g, 'ELITE'],
    [/Ã©lite/g, 'ELITE'],
    [/Ã³/g, 'o'],
    [/Ã¡/g, 'a'],
    [/Ã©/g, 'e'],
    [/Ã­/g, 'i'],
    [/Ãº/g, 'u'],
    [/Ã±/g, 'n'],
    [/Día/g, 'DIA'],
    [/DÃ­a/g, 'DIA'],
    [/Sábado/g, 'SABADO'],
    [/SÃ¡bado/g, 'SABADO'],
    [/Página/g, 'PAGINA'],
    [/PÃ¡gina/g, 'PAGINA'],
    [/Táctico/g, 'TACTICO'],
    [/TÃ¡ctico/g, 'TACTICO']
];

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Wipe Unicode escapes first
    content = content.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
    });

    safeFixes.forEach(([reg, rep]) => {
        content = content.replace(reg, rep);
    });
    
    // One more pass for anything else
    content = content.split('ó').join('o');
    content = content.split('á').join('a');
    content = content.split('é').join('e');
    content = content.split('í').join('i');
    content = content.split('ú').join('u');
    content = content.split('ñ').join('n');
    content = content.split('Ó').join('O');
    content = content.split('Á').join('A');
    content = content.split('É').join('E');
    content = content.split('Í').join('I');
    content = content.split('Ú').join('U');
    content = content.split('Ñ').join('N');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Secured (No-Symbols): ${filePath}`);
});
