/**
 * Build fr.json from en.json — preserves existing French translations.
 * Usage: node scripts/build-fr-locale.mjs [--dry-run] [--limit=N] [--skip-auto]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const skipAuto = process.argv.includes('--skip-auto');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
let fr = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/fr.json'), 'utf8'));

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

function protectInterpolation(text) {
    const tokens = [];
    const safe = String(text).replace(/\{\{[^}]+\}\}/g, (m) => {
        const id = `__I18N_${tokens.length}__`;
        tokens.push({ id, raw: m });
        return id;
    });
    return { safe, tokens };
}

function restoreInterpolation(text, tokens) {
    let out = text;
    for (const { id, raw } of tokens) {
        out = out.split(id).join(raw);
    }
    return out;
}

async function translateEnToFr(text) {
    const { safe, tokens } = protectInterpolation(text);
    if (!safe.trim()) return text;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(safe)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const translated = (data[0] || []).map((row) => row[0]).join('');
    return restoreInterpolation(translated, tokens);
}

function loadManualBatches() {
    const out = {};
    for (const name of fs.readdirSync(__dirname)) {
        if (!name.startsWith('locale-fr-') || !name.endsWith('.json')) continue;
        Object.assign(out, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    }
    return out;
}

function mergeNested(existing, enVal) {
    if (Array.isArray(enVal)) return existing ?? enVal;
    if (typeof enVal !== 'object' || enVal === null) return existing ?? enVal;
    const base = existing && typeof existing === 'object' ? { ...existing } : {};
    for (const [k, v] of Object.entries(enVal)) {
        base[k] = mergeNested(base[k], v);
    }
    return base;
}

async function main() {
    const manual = loadManualBatches();
    const result = { ...fr };
    let autoCount = 0;
    let manualCount = 0;
    let kept = 0;
    const keys = Object.keys(en).sort();

    for (const key of keys) {
        if (autoCount >= limit) break;
        const enVal = en[key];

        if (typeof enVal === 'object' && enVal !== null) {
            result[key] = mergeNested(result[key], enVal);
            continue;
        }

        if (typeof enVal !== 'string') continue;

        if (manual[key] && manual[key] !== enVal) {
            result[key] = manual[key];
            manualCount += 1;
            continue;
        }

        if (result[key] !== undefined && result[key] !== enVal) {
            kept += 1;
            continue;
        }

        if (shouldKeepEnglish(key, enVal)) {
            result[key] = enVal;
            kept += 1;
            continue;
        }

        if (skipAuto) {
            if (result[key] === undefined) result[key] = enVal;
            continue;
        }

        try {
            result[key] = await translateEnToFr(enVal);
            autoCount += 1;
            if (autoCount % 25 === 0) {
                console.log(`Translated ${autoCount}… (${key})`);
                await new Promise((r) => setTimeout(r, 600));
            } else {
                await new Promise((r) => setTimeout(r, 150));
            }
        } catch (e) {
            console.warn(`Fallback EN for ${key}:`, e.message);
            result[key] = enVal;
        }
    }

    const sorted = Object.fromEntries(
        Object.keys(en)
            .sort()
            .map((k) => [k, result[k] !== undefined ? result[k] : en[k]]),
    );

    console.log(JSON.stringify({ total: Object.keys(sorted).length, autoCount, manualCount, kept, dryRun }));

    if (!dryRun) {
        fs.writeFileSync(path.join(root, 'src/locales/fr.json'), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
