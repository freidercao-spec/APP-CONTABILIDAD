import fs from 'fs';
import https from 'https';

const fsPath = './public/models';
if (!fs.existsSync(fsPath)) {
    fs.mkdirSync(fsPath, { recursive: true });
}

const BOX_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF-Binary/BoxTextured.glb';

const models = [
    { name: 'hospital.glb', url: BOX_URL },
    { name: 'comando.glb', url: BOX_URL },
    { name: 'torre.glb', url: BOX_URL },
    { name: 'edificio.glb', url: BOX_URL },
    { name: 'retail.glb', url: BOX_URL },
    { name: 'logistica.glb', url: BOX_URL },
    { name: 'banco.glb', url: BOX_URL },
    { name: 'puerto.glb', url: BOX_URL },
];

models.forEach(m => {
    https.get(m.url, res => {
        const stream = fs.createWriteStream(`${fsPath}/${m.name}`);
        res.pipe(stream);
        stream.on('finish', () => {
            stream.close();
            console.log(`Downloaded ${m.name}`);
        });
    }).on('error', err => {
        console.error(`Error with ${m.name}: ${err.message}`);
    });
});
