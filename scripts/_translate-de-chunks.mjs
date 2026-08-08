/**
 * One-off: translate DE batch 5/6 + faq/seo via Google Translate (en→de).
 * Preserves {{tokens}}, emoji, and brand names. Post-processes toward informal du.
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
    'OpenStreetMap',
    'Instagram',
    'TikTok',
    'Twitter',
    'Facebook',
    'Apple',
    'USD',
    'iPhone',
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
    return { safe, tokens };
}

function restoreBrandNames(text, tokens) {
    let out = text;
    for (const { id, raw } of tokens) {
        out = out.split(id).join(raw);
    }
    return out;
}

/** Light post-process toward informal du in UI strings */
function polishGermanDu(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/\bSie können\b/g, 'Du kannst')
        .replace(/\bSie haben\b/g, 'Du hast')
        .replace(/\bSie sind\b/g, 'Du bist')
        .replace(/\bSie müssen\b/g, 'Du musst')
        .replace(/\bSie sollten\b/g, 'Du solltest')
        .replace(/\bSie werden\b/g, 'Du wirst')
        .replace(/\bSie erhalten\b/g, 'Du erhältst')
        .replace(/\bSie bekommen\b/g, 'Du bekommst')
        .replace(/\bSie sehen\b/g, 'Du siehst')
        .replace(/\bSie verwenden\b/g, 'Du verwendest')
        .replace(/\bSie nutzen\b/g, 'Du nutzt')
        .replace(/\bSie wählen\b/g, 'Du wählst')
        .replace(/\bSie tippen\b/g, 'Tippe')
        .replace(/\bSie klicken\b/g, 'Klicke')
        .replace(/\bSie öffnen\b/g, 'Öffne')
        .replace(/\bSie gehen\b/g, 'Gehe')
        .replace(/\bSie geben\b/g, 'Gib')
        .replace(/\bSie fügen\b/g, 'Füge')
        .replace(/\bSie teilen\b/g, 'Teile')
        .replace(/\bSie erstellen\b/g, 'Erstelle')
        .replace(/\bSie senden\b/g, 'Sende')
        .replace(/\bSie bestätigen\b/g, 'Bestätige')
        .replace(/\bSie melden\b/g, 'Melde')
        .replace(/\bSie abonnieren\b/g, 'Abonniere')
        .replace(/\bSie abonnieren\b/g, 'Abonniere')
        .replace(/\bIhr Profil\b/g, 'dein Profil')
        .replace(/\bIhre Einladung\b/g, 'deine Einladung')
        .replace(/\bIhre Einladungen\b/g, 'deine Einladungen')
        .replace(/\bIhr Konto\b/g, 'dein Konto')
        .replace(/\bIhr Passwort\b/g, 'dein Passwort')
        .replace(/\bIhre Nachricht\b/g, 'deine Nachricht')
        .replace(/\bIhre E-Mail\b/g, 'deine E-Mail')
        .replace(/\bIhre Daten\b/g, 'deine Daten')
        .replace(/\bIhre Einstellungen\b/g, 'deine Einstellungen')
        .replace(/\bIhren Standort\b/g, 'deinen Standort')
        .replace(/\bIhrem Gerät\b/g, 'deinem Gerät')
        .replace(/\bIhrem Browser\b/g, 'deinem Browser')
        .replace(/\bIhrem Dashboard\b/g, 'deinem Dashboard')
        .replace(/\bIhrem Konto\b/g, 'deinem Konto')
        .replace(/\bIhrem Profil\b/g, 'deinem Profil')
        .replace(/\bIhrem Chat\b/g, 'deinem Chat')
        .replace(/\bIhrem Feed\b/g, 'deinem Feed')
        .replace(/\bIhrem Unternehmen\b/g, 'deinem Unternehmen')
        .replace(/\bIhrem Restaurant\b/g, 'deinem Restaurant')
        .replace(/\bIhrem Menü\b/g, 'deinem Menü')
        .replace(/\bIhrem Abonnement\b/g, 'deinem Abonnement')
        .replace(/\bIhrem Plan\b/g, 'deinem Plan')
        .replace(/\bIhrem Guthaben\b/g, 'deinem Guthaben')
        .replace(/\bIhrem Gerät\b/g, 'deinem Gerät')
        .replace(/\bIhrem Gerät\b/g, 'deinem Gerät')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\s+!/g, '!')
        .replace(/\s+\?/g, '?');
}

async function fetchTranslate(url, retries = 4) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, 400 * attempt));
        }
    }
    throw new Error('fetchTranslate exhausted retries');
}

async function translateEnToDe(text) {
    if (typeof text !== 'string' || !text.trim()) return text;
    if (text.trim() === text.trim().toUpperCase() && text.length <= 4 && !/\s/.test(text)) return text;

    const { safe: s1, tokens: iTokens } = protectInterpolation(text);
    const { safe, tokens: bTokens } = protectBrandNames(s1);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=${encodeURIComponent(safe)}`;
    const data = await fetchTranslate(url);
    let translated = (data[0] || []).map((row) => row[0]).join('');

    translated = restoreBrandNames(translated, bTokens);
    translated = restoreInterpolation(translated, iTokens);
    translated = polishGermanDu(translated);

    return translated;
}

async function translateFlat(obj, label) {
    const keys = Object.keys(obj);
    const out = {};
    let i = 0;
    for (const key of keys) {
        out[key] = await translateEnToDe(obj[key]);
        i += 1;
        if (i % 25 === 0) console.log(`[${label}] ${i}/${keys.length}`);
        await new Promise((r) => setTimeout(r, 120));
    }
    return out;
}

async function translateNested(val) {
    if (typeof val === 'string') return translateEnToDe(val);
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

const missing = JSON.parse(fs.readFileSync(path.join(__dirname, '_de-missing-keys.json'), 'utf8'));
const keys = Object.keys(missing);
const chunk5En = Object.fromEntries(keys.slice(2164, 2705).map((k) => [k, missing[k]]));
const chunk6En = Object.fromEntries(keys.slice(2705).map((k) => [k, missing[k]]));

console.log('Translating batch 5…', Object.keys(chunk5En).length);
const batch5 = await translateFlat(chunk5En, 'batch5');
fs.writeFileSync(path.join(__dirname, 'locale-de-batch-5.json'), `${JSON.stringify(batch5, null, 2)}\n`, 'utf8');

console.log('Translating batch 6…', Object.keys(chunk6En).length);
const batch6 = await translateFlat(chunk6En, 'batch6');
fs.writeFileSync(path.join(__dirname, 'locale-de-batch-6.json'), `${JSON.stringify(batch6, null, 2)}\n`, 'utf8');

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
console.log('Translating faq+seo…');
const faqSeo = {
    faq: await translateNested(en.faq),
    seo: await translateNested(en.seo),
};
fs.writeFileSync(path.join(__dirname, 'locale-de-faq-seo.json'), `${JSON.stringify(faqSeo, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    batch5: Object.keys(batch5).length,
    batch6: Object.keys(batch6).length,
    faqSeoTopLevel: Object.keys(faqSeo).length,
    faqUserQ: faqSeo.faq.user_questions.length,
    faqBizQ: faqSeo.faq.business_questions.length,
}));
