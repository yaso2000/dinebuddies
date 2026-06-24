import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const tr = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/tr.json'), 'utf8'));

const KEEP_ENGLISH_KEYS = new Set([
    'app_title',
    'affiliate_dash_paypal_label',
    'dating_color_hex_label',
    'delivery_link_url_placeholder',
]);

function shouldKeepEnglish(key, value) {
    if (KEEP_ENGLISH_KEYS.has(key)) return true;
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (/^https?:\/\//.test(v)) return true;
    if (/\.(com|io|js|ts|json|env)\b/i.test(v) && v.length < 80) return true;
    if (/^(Firebase|Firestore|Stripe|PayPal|Google|FCM|UID|OAuth|npm|Vercel)/i.test(v)) return true;
    if (v === 'DineBuddies' || v.startsWith('DineBuddies ')) return true;
    return false;
}

const missing = {};
for (const key of Object.keys(en).sort()) {
    if (typeof en[key] !== 'string') continue;
    if (tr[key] === en[key] && !shouldKeepEnglish(key, en[key])) {
        missing[key] = en[key];
    }
}

const outPath = path.join(__dirname, '_tr-missing-keys.json');
fs.writeFileSync(outPath, `${JSON.stringify(missing, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ missing: Object.keys(missing).length, outPath }));
