const fs = require('fs');
const path = require('path');

function scanDir(dir) {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(scanDir(fullPath));
        } else if (file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('absolute') && (line.includes('right:') || line.includes('left:') || line.includes('right :') || line.includes('left :'))) {
                    results.push(`${file}:${i + 1}: ${line.trim()}`);
                }
            });
        }
    }
    return results;
}

const res = [
    ...scanDir(path.join(__dirname, '../src/components')),
    ...scanDir(path.join(__dirname, '../src/pages'))
];

console.log(res.join('\n'));
