const fs = require('fs');
const enPath = './src/locales/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en['rankings_top_elite'] = 'Top Elite Ranking';
en['latest_invitations'] = 'Latest Invitations';
en['nav_messages'] = 'Messages';
fs.writeFileSync(enPath, JSON.stringify(en, null, 4));

const arPath = './src/locales/ar.json';
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
// Because JSON.parse removes duplicates by choosing the last one, rewriting it cleans duplicates!
fs.writeFileSync(arPath, JSON.stringify(ar, null, 4));
console.log('Fixed translations and cleaned duplicates.');
