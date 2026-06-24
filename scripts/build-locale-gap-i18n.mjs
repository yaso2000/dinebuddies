import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gapKeys = JSON.parse(fs.readFileSync(path.join(__dirname, '_gap-keys.json'), 'utf8'));
const gapSource = JSON.parse(fs.readFileSync(path.join(__dirname, '_gap-en-source.json'), 'utf8'));
const missingArKeys = JSON.parse(fs.readFileSync(path.join(__dirname, '_missing-locale-en.json'), 'utf8'));
const arBase = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-gap-ar-77.json'), 'utf8'));

const langs = ['de', 'es', 'fr', 'it', 'pt', 'tr', 'hi', 'ur'];
const out = {};

for (const lang of langs) {
  const file = path.join(__dirname, 'gap-langs', `${lang}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
  out[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = Object.keys(out[lang]);
  if (keys.length !== 313) {
    console.error(`${lang}: expected 313 keys, got ${keys.length}`);
    process.exit(1);
  }
  const missing = gapKeys.filter((k) => !out[lang][k]);
  const extra = keys.filter((k) => !gapKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`${lang}: missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error('  missing:', missing.slice(0, 5));
    process.exit(1);
  }
}

const ar = { ...arBase };
ar.favorite_places_local_hint = 'عرض الأماكن في ${searchData.city}';
ar.private_send_invite_badge_title = 'إرسال دعوة خاصة إلى ${displayName}';
ar.private_send_invite_confirm = 'إرسال دعوة خاصة إلى ${displayName}؟';

const arKeys = Object.keys(missingArKeys);
out.ar = {};
for (const k of arKeys) {
  if (!ar[k]) {
    console.error(`ar missing key: ${k}`);
    process.exit(1);
  }
  out.ar[k] = ar[k];
}
if (arKeys.length !== 77) {
  console.error(`ar expected 77 keys, got ${arKeys.length}`);
  process.exit(1);
}

const outPath = path.join(__dirname, 'locale-gap-i18n.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath);
console.log('Key counts:', Object.fromEntries(Object.entries(out).map(([l, o]) => [l, Object.keys(o).length])));

// Verify against source key lists
const srcKeys = Object.keys(gapSource);
for (const lang of langs) {
  const match = srcKeys.every((k) => out[lang][k] !== undefined);
  console.log(`${lang} matches _gap-en-source.json:`, match);
}
console.log('ar matches _missing-locale-en.json:', arKeys.every((k) => out.ar[k] !== undefined));
