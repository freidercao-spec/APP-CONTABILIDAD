import fs from 'fs';
import path from 'path';

const projectRoot = 'c:/Users/gdocumental/Downloads/CHATBOT/PROGRAMACION/APP-CONTABILIDAD';
const srcDir = path.join(projectRoot, 'src');

// Helper to recursively get all files in a directory
function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getFiles(filePath, fileList);
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = getFiles(srcDir);
console.log(`Total source files found: ${allFiles.length}`);

// We want to find imports
// Matches: import ... from '...' or import('...') or from "..."
const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

const dependencyGraph = {};
const fileToImports = {};

allFiles.forEach(file => {
  const relativeFile = path.relative(srcDir, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf-8');
  const imports = [];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  fileToImports[relativeFile] = imports;
});

// Resolve imports to absolute/relative-to-src paths
const resolvedDependencies = {};
allFiles.forEach(file => {
  const relativeFile = path.relative(srcDir, file).replace(/\\/g, '/');
  resolvedDependencies[relativeFile] = new Set();
});

function resolveImport(importPath, currentFileDir) {
  // If absolute-like (aliased or from node_modules)
  if (!importPath.startsWith('.')) {
    return { type: 'npm', path: importPath };
  }

  // Relative import
  const absolutePath = path.resolve(currentFileDir, importPath);
  
  // Try extensions
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  for (const ext of extensions) {
    const fullPath = absolutePath + ext;
    if (fs.existsSync(fullPath)) {
      const rel = path.relative(srcDir, fullPath).replace(/\\/g, '/');
      return { type: 'local', path: rel };
    }
    // Also handle directory import like import X from './components' -> ./components/index.tsx
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      const dirIndex = path.join(absolutePath, 'index' + ext);
      if (fs.existsSync(dirIndex)) {
        const rel = path.relative(srcDir, dirIndex).replace(/\\/g, '/');
        return { type: 'local', path: rel };
      }
    }
  }

  // Maybe extension is already included in import
  if (fs.existsSync(absolutePath)) {
    const rel = path.relative(srcDir, absolutePath).replace(/\\/g, '/');
    return { type: 'local', path: rel };
  }

  return { type: 'unknown', path: importPath };
}

const npmDependenciesUsed = new Set();

Object.keys(fileToImports).forEach(file => {
  const absoluteFileDir = path.dirname(path.join(srcDir, file));
  const rawImports = fileToImports[file];

  rawImports.forEach(imp => {
    const resolved = resolveImport(imp, absoluteFileDir);
    if (resolved.type === 'local') {
      if (resolvedDependencies[resolved.path]) {
        resolvedDependencies[resolved.path].add(file);
      } else {
        // Maybe resolved with a slightly different extension or case
        // Let's search keys ignoring case or extension
        const matchedKey = Object.keys(resolvedDependencies).find(
          k => k.toLowerCase() === resolved.path.toLowerCase() || k.replace(/\.[^/.]+$/, "") === resolved.path.replace(/\.[^/.]+$/, "")
        );
        if (matchedKey) {
          resolvedDependencies[matchedKey].add(file);
        } else {
          // It's a new or external local path
          resolvedDependencies[resolved.path] = new Set([file]);
        }
      }
    } else if (resolved.type === 'npm') {
      // Get package name (e.g. @supabase/supabase-js -> @supabase/supabase-js, react-router-dom -> react-router-dom)
      let pkg = resolved.path;
      if (pkg.startsWith('@')) {
        const parts = pkg.split('/');
        pkg = parts.slice(0, 2).join('/');
      } else {
        pkg = pkg.split('/')[0];
      }
      npmDependenciesUsed.add(pkg);
    }
  });
});

// Identify unused local source files
const entryPoints = ['main.tsx', 'index.css', 'App.tsx'];
const deadFiles = [];

Object.keys(resolvedDependencies).forEach(file => {
  if (entryPoints.includes(file)) return;
  const importers = resolvedDependencies[file];
  if (importers.size === 0) {
    deadFiles.push(file);
  }
});

console.log('\n--- LOCAL UNUSED FILES (DEAD CODE candidates) ---');
deadFiles.forEach(f => {
  console.log(`- src/${f}`);
});

// Read package.json to find unused npm dependencies
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const declaredDependencies = Object.keys(packageJson.dependencies || {});

console.log('\n--- DECLARED DEPENDENCIES vs USED ---');
const unusedDeps = [];
declaredDependencies.forEach(dep => {
  // Types are usually not imported directly (they are in devDependencies anyway, but some are in dependencies)
  if (dep.startsWith('@types/')) return;
  
  if (!npmDependenciesUsed.has(dep)) {
    unusedDeps.push(dep);
  }
});

unusedDeps.forEach(dep => {
  console.log(`- ${dep} (Declared in package.json dependencies, but no import found in src/)`);
});

// Let's also check for size and structure
console.log('\n--- LARGEST FILES ---');
const fileSizes = allFiles.map(file => {
  const stats = fs.statSync(file);
  return {
    path: path.relative(srcDir, file).replace(/\\/g, '/'),
    size: stats.size
  };
}).sort((a, b) => b.size - a.size);

fileSizes.slice(0, 10).forEach(f => {
  console.log(`- src/${f.path}: ${(f.size / 1024).toFixed(2)} KB`);
});
