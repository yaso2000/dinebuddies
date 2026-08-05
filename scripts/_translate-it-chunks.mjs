/**
 * One-off: translate IT batch 5/6 + faq/seo via Google Translate (en→it).
 * Preserves {{tokens}}, emoji, and brand names.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const KEEP_ENGLISH = new Set([
    'DineBuddies',
    'WhatsApp',
    'Google',
    'Stripe',
    'PayPal',
    'Firebase',
    'Firestore',
    'Gemini',
    'VIP',
    'Pro',
    'Elite',
    'Maps',
    'OAuth',
    'FCM',
    'UID',
    'npm',
    'Vercel',
]);

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

function protectBrandNames(text) {
    const tokens = [];
    let safe = text;
    for (const brand of KEEP_ENGLISH) {
        const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        safe = safe.replace(re, (m) => {
            const id = `__BRAND_${tokens.length}__`;
            tokens.push({ id, raw: m });
            return id;
        });
    }
    return { safe, tokens: tokens };
}

function restoreBrandNames(text, tokens) {
    let out = text;
    for (const { id, raw } of tokens) {
        out = out.split(id).join(raw);
    }
    return out;
}

async function translateEnToIt(text) {
    if (typeof text !== 'string' || !text.trim()) return text;
    if (text.trim() === text.trim().toUpperCase() && text.length <= 4 && !/\s/.test(text)) return text;

    const { safe: s1, tokens: iTokens } = protectInterpolation(text);
    const { safe, tokens: bTokens } = protectBrandNames(s1);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t&q=${encodeURIComponent(safe)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for: ${text.slice(0, 60)}`);
    const data = await res.json();
    let translated = (data[0] || []).map((row) => row[0]).join('');

    translated = restoreBrandNames(translated, bTokens);
    translated = restoreInterpolation(translated, iTokens);

    // UI polish
    translated = translated
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\s+!/g, '!')
        .replace(/\s+\?/g, '?')
        .replace(/…/g, '…');

    return translated;
}

async function translateFlat(obj, label) {
    const keys = Object.keys(obj);
    const out = {};
    let i = 0;
    for (const key of keys) {
        out[key] = await translateEnToIt(obj[key]);
        i += 1;
        if (i % 25 === 0) console.log(`[${label}] ${i}/${keys.length}`);
        await new Promise((r) => setTimeout(r, 120));
    }
    return out;
}

async function translateNested(val) {
    if (typeof val === 'string') return translateEnToIt(val);
    if (Array.isArray(val)) {
        const arr = [];
        for (const item of val) arr.push(await translateNested(item));
        return arr;
    }
    if (val && typeof val === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(val)) {
            out[k] = await translateNested(v);
            await new Promise((r) => setTimeout(r, 80));
        }
        return out;
    }
    return val;
}

const missing = JSON.parse(fs.readFileSync(path.join(__dirname, '_it-missing-keys.json'), 'utf8'));
const keys = Object.keys(missing);
const chunk5En = Object.fromEntries(keys.slice(2164, 2705).map((k) => [k, missing[k]]));
const chunk6En = Object.fromEntries(keys.slice(2705).map((k) => [k, missing[k]]));

console.log('Translating batch 5…', Object.keys(chunk5En).length);
const batch5 = await translateFlat(chunk5En, 'batch5');
fs.writeFileSync(path.join(__dirname, 'locale-it-batch-5.json'), `${JSON.stringify(batch5, null, 2)}\n`, 'utf8');

console.log('Translating batch 6…', Object.keys(chunk6En).length);
const batch6 = await translateFlat(chunk6En, 'batch6');
fs.writeFileSync(path.join(__dirname, 'locale-it-batch-6.json'), `${JSON.stringify(batch6, null, 2)}\n`, 'utf8');

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
console.log('Translating faq+seo…');
const faqSeo = {
    faq: await translateNested(en.faq),
    seo: await translateNested(en.seo),
};
fs.writeFileSync(path.join(__dirname, 'locale-it-faq-seo.json'), `${JSON.stringify(faqSeo, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    batch5: Object.keys(batch5).length,
    batch6: Object.keys(batch6).length,
    faqSeoKeys: 2,
    faqUserQ: faqSeo.faq.user_questions.length,
    faqBizQ: faqSeo.faq.business_questions.length,
}));
