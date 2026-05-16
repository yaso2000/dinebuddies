/**
 * Resolve import graph from src/ and list modules never reached from entry points.
 * Entry: src/main.jsx (adjust if needed).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const ENTRY = path.join(src, 'main.jsx');

const EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules']);

function walk(dir, out = []) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, name.name);
        if (name.isDirectory()) {
            if (SKIP_DIRS.has(name.name)) continue;
            walk(p, out);
        } else if (EXT.has(path.extname(name.name))) {
            out.push(p);
        }
    }
    return out;
}

const IMPORT_RE =
    /\b(?:import\s+[^'";]+from\s+|import\s*\(\s*)['"]([^'"]+)['"]|(?:import|export)\s+['"]([^'"]+)['"]/g;

function resolveImport(fromFile, spec) {
    if (!spec || spec.startsWith('http') || spec.startsWith('//')) return null;
    if (spec.startsWith('@/')) {
        return path.join(src, spec.slice(2));
    }
    if (!spec.startsWith('.')) {
        // bare package — skip
        return null;
    }
    const base = path.resolve(path.dirname(fromFile), spec);
    const exts = ['', '.jsx', '.js', '.tsx', '.ts', '/index.jsx', '/index.js'];
    for (const e of exts) {
        const candidate = base + e;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
}

const allFiles = walk(src);
const reachable = new Set();
const queue = [];

function add(f) {
    const norm = path.normalize(f);
    if (!norm.startsWith(src)) return;
    if (!reachable.has(norm)) {
        reachable.add(norm);
        queue.push(norm);
    }
}

if (fs.existsSync(ENTRY)) add(ENTRY);
else {
    const alt = path.join(src, 'main.tsx');
    if (fs.existsSync(alt)) add(alt);
}

while (queue.length) {
    const file = queue.pop();
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        continue;
    }
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(text)) !== null) {
        const spec = m[1] || m[2];
        const resolved = resolveImport(file, spec);
        if (resolved) add(resolved);
    }
}

const orphans = allFiles
    .map((f) => path.normalize(f))
    .filter((f) => !reachable.has(f))
    .map((f) => path.relative(root, f).split(path.sep).join('/'))
    .sort();

console.log(JSON.stringify({ entry: path.relative(root, ENTRY).split(path.sep).join('/'), orphanCount: orphans.length, orphans }, null, 2));
