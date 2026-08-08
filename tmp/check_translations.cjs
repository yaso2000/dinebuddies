const fs = require('fs');

const en = JSON.parse(fs.readFileSync('./src/locales/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('./src/locales/ar.json', 'utf8'));

const missing = {};

// Find keys in EN that are not in AR
for (const [key, value] of Object.entries(en)) {
    if (!ar.hasOwnProperty(key)) {
        missing[key] = value;
    }
}

console.log(`Found ${Object.keys(missing).length} missing keys in Arabic.`);
fs.writeFileSync('./tmp/missing_ar.json', JSON.stringify(missing, null, 2));

console.log("Missing keys extracted to tmp/missing_ar.json.");
