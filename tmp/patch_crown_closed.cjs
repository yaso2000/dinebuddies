const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/BusinessProfile.jsx');
let content = fs.readFileSync(file, 'utf8');

// Replace badgePill arguments (around line 1235)
content = content.replace(
    /{badgePill\(isOpen \? '74,222,128' : '248,113,113', isOpen \? '74,222,128' : '248,113,113', isOpen \? 'OPEN' : 'CLOSED'\)}/g,
    "{badgePill(isOpen ? '74,222,128' : '248,113,113', isOpen ? '74,222,128' : '248,113,113', isOpen ? t('open', 'OPEN') : t('closed', 'CLOSED'))}"
);

// Replace crown icon position (around line 1297)
content = content.replace(
    /<div style=\{\{ position: 'absolute', top: '-6px', right: '-6px', background: '#000000', border:/g,
    "<div style={{ position: 'absolute', top: '-6px', left: '-6px', background: '#000000', border:"
);

fs.writeFileSync(file, content);
console.log("Patched BusinessProfile.jsx for CLOSED badge and crown icon.");

// Update Locales
const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const updates = {
    "open": { en: "OPEN", ar: "مفتوح" },
    "closed": { en: "CLOSED", ar: "مغلق" }
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(updates)) {
    if (enDict[key] !== trans.en) { enDict[key] = trans.en; dictUpdated = true; }
    if (arDict[key] !== trans.ar) { arDict[key] = trans.ar; dictUpdated = true; }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json for OPEN/CLOSED.");
}
