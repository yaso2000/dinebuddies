import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const scan = JSON.parse(fs.readFileSync(path.join(root, 'i18n-scan.json'), 'utf8'));
const enPath = path.join(root, 'src/locales/en.json');
const arPath = path.join(root, 'src/locales/ar.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const missingKeys = scan.missingInAr.map((x) => x.key);
const inEnNotAr = missingKeys.filter((k) => en[k] && !ar[k]);
const notInEn = missingKeys.filter((k) => !en[k]);

console.log('missing in ar (used in code):', missingKeys.length);
console.log('have en value:', inEnNotAr.length);
console.log('not in en at all:', notInEn.length);
fs.writeFileSync(
    path.join(root, 'keys-to-translate.json'),
    JSON.stringify({ inEnNotAr: inEnNotAr.map((k) => ({ key: k, en: en[k] })), notInEn }, null, 2)
);
