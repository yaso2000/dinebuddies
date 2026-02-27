import fs from 'fs';

function deduplicate(filePath) {
    console.log(`Processing ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf8');

    // Using a regex-based approach to preserve order and identify duplicates
    const lines = content.split('\n');
    const seen = new Set();
    const result = [];

    let nesting = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^\s*"([^"]+)"\s*:/);

        if (match) {
            const key = match[1];
            if (seen.has(key)) {
                console.log(`  Removing duplicate key: "${key}" at line ${i + 1}`);
                continue;
            }
            seen.add(key);
        }
        result.push(line);
    }

    fs.writeFileSync(filePath, result.join('\n'));
    console.log(`  Done. Total keys: ${seen.size}`);
}

const arPath = 'c:/Users/yaser/inebuddies/dinebuddies/src/locales/ar.json';
const enPath = 'c:/Users/yaser/inebuddies/dinebuddies/src/locales/en.json';

deduplicate(arPath);
deduplicate(enPath);
