const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const enPath = path.join(root, 'src', 'locales', 'en.json');
const arPath = path.join(root, 'src', 'locales', 'ar.json');

const en194 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'locale-en-194.json'), 'utf8')
);
const en91 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'locale-en-from-ar91.json'), 'utf8')
);
const ar194 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'locale-ar-194.json'), 'utf8')
);

function assertSameKeys(a, b, label) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  const missing = ka.filter((k) => !kb.includes(k));
  const extra = kb.filter((k) => !ka.includes(k));
  if (missing.length || extra.length) {
    console.error(label, 'key mismatch', { missing, extra });
    process.exit(1);
  }
}

assertSameKeys(en194, ar194, 'en194 vs ar194');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

Object.assign(en, en194, en91);
Object.assign(ar, ar194);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');

console.log('Merged', Object.keys(en194).length, 'keys into en + ar; merged', Object.keys(en91).length, 'into en only.');
