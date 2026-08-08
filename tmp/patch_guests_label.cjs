const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

en['guests_needed_label'] = 'Guests Needed';
ar['guests_needed_label'] = 'عدد الضيوف';

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched guests needed label!');
