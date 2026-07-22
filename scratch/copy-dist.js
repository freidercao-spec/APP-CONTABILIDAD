import fs from 'fs';
import path from 'path';

const srcDir = './dist';
const destDir = '.';

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        const files = fs.readdirSync(src);
        for (const file of files) {
            copyRecursive(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    }
}

try {
    if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);
            copyRecursive(srcPath, destPath);
        }
        console.log("✅ Copy completed successfully!");
    } else {
        console.error("❌ dist directory does not exist!");
    }
} catch (err) {
    console.error("❌ Copy failed:", err);
}
