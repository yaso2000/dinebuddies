/**
 * Split en.json string keys into locale-tr-batch-N.json templates for translation.
 * faq/seo go to locale-tr-faq-seo.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));

const stringKeys = Object.keys(en).filter((k) => typeof en[k] === 'string').sort();
const BATCH_SIZE = 470;
const batches = [];

for (let i = 0; i < stringKeys.length; i += BATCH_SIZE) {
    batches.push(stringKeys.slice(i, i + BATCH_SIZE));
}

for (let i = 0; i < batches.length; i += 1) {
    const obj = {};
    for (const k of batches[i]) obj[k] = en[k];
    const name = `locale-tr-batch-${i + 1}.json`;
    fs.writeFileSync(path.join(__dirname, name), `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
    console.log(`${name}: ${Object.keys(obj).length} keys`);
}

const faqSeo = {};
if (en.faq) faqSeo.faq = en.faq;
if (en.seo) faqSeo.seo = en.seo;
fs.writeFileSync(
    path.join(__dirname, 'locale-tr-faq-seo.json'),
    `${JSON.stringify(faqSeo, null, 2)}\n`,
    'utf8',
);
console.log(`locale-tr-faq-seo.json: faq=${!!en.faq} seo=${!!en.seo}`);
