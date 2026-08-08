const fs = require('fs');
const path = require('path');

const re = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
const keys = new Set();

function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {
            if (!f.name.startsWith('.') && f.name !== 'node_modules') walk(p);
        } else if (/\.(jsx|js)$/.test(f.name)) {
            const s = fs.readFileSync(p, 'utf8');
            let m;
            while ((m = re.exec(s))) keys.add(m[1]);
        }
    }
}

walk(path.join(__dirname, '..', 'src'));
const arr = [...keys].sort();
fs.writeFileSync(path.join(__dirname, '..', '_t_keys.txt'), arr.join('\n'), 'utf8');
console.log('Unique t() keys:', arr.length);
