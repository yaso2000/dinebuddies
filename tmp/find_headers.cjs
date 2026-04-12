const fs = require('fs');
const path = require('path');

function searchFile(filePath, queries) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const lowerLine = line.toLowerCase();
        for (const query of queries) {
            if (lowerLine.includes(query)) {
                console.log(`${path.basename(filePath)}:${i + 1}: ${line.trim()}`);
            }
        }
    });
}

function scanDir(dir, queries) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath, queries);
        } else if (file.endsWith('.jsx')) {
            searchFile(fullPath, queries);
        }
    }
}

const queries = ['>contact<', '>services<', '>menus<', 'contact us', 'service', 'menus'];
const dirs = [
    path.join(__dirname, '../src/components'),
    path.join(__dirname, '../src/pages')
];

dirs.forEach(d => scanDir(d, queries));
