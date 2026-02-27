import fs from 'fs';

function findDuplicates(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const keys = {};
    const duplicates = [];

    lines.forEach((line, i) => {
        const match = line.match(/^\s*"([^"]+)"\s*:/);
        if (match) {
            const key = match[1];
            if (keys[key]) {
                duplicates.push({ key, line: i + 1 });
            }
            keys[key] = true;
        }
    });
    return duplicates;
}

const arPath = 'c:/Users/yaser/inebuddies/dinebuddies/src/locales/ar.json';
const enPath = 'c:/Users/yaser/inebuddies/dinebuddies/src/locales/en.json';

console.log('--- Arabic (ar.json) Duplicates ---');
console.log(JSON.stringify(findDuplicates(arPath), null, 2));

console.log('--- English (en.json) Duplicates ---');
console.log(JSON.stringify(findDuplicates(enPath), null, 2));
