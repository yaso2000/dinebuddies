/**
 * Polish IT batch 5/6 + faq-seo after machine translation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OVERRIDES = {
    'locale-it-batch-5.json': {
        new_account: 'Nuovo account',
        new_password: 'Nuova password',
        next: 'Avanti',
        no_account: 'Non hai un account? Registrati',
        no_account_create: 'Non hai un account? Creane uno',
        no_members_yet: 'Nessun membro ancora. Condividi la tua community per farla crescere.',
        private_invitations_remaining: 'inviti privati rimanenti in questo {{period}}',
        private_invites_left: 'Inviti privati rimasti',
    },
    'locale-it-batch-6.json': {
        save_hours: 'Salva orari',
        save_pending: 'Salvataggio…',
        saving: 'Salvataggio…',
        studio_saving_draft: 'Salvataggio bozza…',
        settings_business_plan_value_paid: 'A pagamento ($${BUSINESS_PAID_MONTHLY_USD}/mese)',
        unlimited_private_invitations: 'Inviti privati illimitati',
        user_muted_toast: 'Non riceverai inviti privati, di appuntamenti o messaggi da questo utente.',
        restaurant_community: 'Community del locale',
        restaurant_closed: 'Locale chiuso',
        restaurant_not_found: 'Locale non trovato',
    },
};

function cleanText(s) {
    if (typeof s !== 'string') return s;
    return s
        .replace(/__MARCA_\d+__/g, 'DineBuddies')
        .replace(/__BRAND_\d+__/g, 'DineBuddies')
        .replace(/privati \u200b/g, 'privati ')
        .replace(/privati  \u200b/g, 'privati ')
        .replace(/privati \u00a0/g, 'privati ')
        .replace(/\u200b/g, '')
        .replace(/  +/g, ' ')
        .trim();
}

function walk(obj, fn) {
    if (typeof obj === 'string') return fn(obj);
    if (Array.isArray(obj)) return obj.map((v) => walk(v, fn));
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) out[k] = walk(v, fn);
        return out;
    }
    return obj;
}

for (const name of ['locale-it-batch-5.json', 'locale-it-batch-6.json', 'locale-it-faq-seo.json']) {
    const filePath = path.join(__dirname, name);
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data = walk(data, cleanText);
    const overrides = OVERRIDES[name];
    if (overrides) Object.assign(data, overrides);
    if (name === 'locale-it-faq-seo.json') {
        data.seo.title = 'DineBuddies | Ristorazione sociale premium e rete gastronomica esclusiva';
        data.faq.user_questions[2].q = 'Qual è la differenza tra inviti pubblici, privati e di appuntamento?';
        data.faq.user_questions[2].a = data.faq.user_questions[2].a.replace(/per appuntamenti/g, 'di appuntamento');
        data.faq.user_questions[6].a = data.faq.user_questions[6].a.replace(/inviti agli appuntamenti/g, 'inviti di appuntamento');
        data.faq.business_questions[1].a = data.faq.business_questions[1].a.replace('Pro Dashboard', 'Dashboard Pro');
        data.faq.business_questions[4].a = data.faq.business_questions[4].a.replace(/livello 'Elite'/g, 'livello «Elite»');
    }
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const b5 = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-it-batch-5.json'), 'utf8'));
const b6 = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-it-batch-6.json'), 'utf8'));
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-it-faq-seo.json'), 'utf8'));
console.log(JSON.stringify({
    batch5: Object.keys(b5).length,
    batch6: Object.keys(b6).length,
    faqSeo: { faq: 1, seo: 1, userQuestions: faq.faq.user_questions.length, businessQuestions: faq.faq.business_questions.length },
}));
