import fs from 'fs';

const gap = JSON.parse(fs.readFileSync('scripts/_gap-en-source.json', 'utf8'));
const missing = JSON.parse(fs.readFileSync('scripts/_missing-locale-en.json', 'utf8'));
const out = JSON.parse(fs.readFileSync('scripts/locale-gap-i18n.json', 'utf8'));
const gapKeys = Object.keys(gap).sort();
const missingKeys = Object.keys(missing).sort();
const langs8 = ['de', 'es', 'fr', 'it', 'pt', 'tr', 'hi', 'ur'];
let ok = true;

for (const lang of langs8) {
  const keys = Object.keys(out[lang]).sort();
  const match = keys.length === 313 && gapKeys.every((k, i) => keys[i] === gapKeys[i] && out[lang][k]);
  console.log(`${lang}: ${keys.length} keys, matches _gap-en-source.json: ${match}`);
  if (!match) ok = false;
}

const arKeys = Object.keys(out.ar).sort();
const arMatch = arKeys.length === 77 && missingKeys.every((k, i) => arKeys[i] === missingKeys[i] && out.ar[k]);
console.log(`ar: ${arKeys.length} keys, matches _missing-locale-en.json: ${arMatch}`);

const interpChecks = [
  ['ar', 'favorite_places_local_hint', '${searchData.city}'],
  ['ar', 'private_send_invite_badge_title', '${displayName}'],
  ['ar', 'private_send_invite_confirm', '${displayName}'],
  ['de', 'favorite_places_local_hint', '${searchData.city}'],
  ['de', 'social_share_greeting', '🎉'],
  ['es', 'editor_leave_dont_save', 'No guardar'],
  ['fr', 'community_blocked_message', "{{name}}"],
];

for (const [lang, key, needle] of interpChecks) {
  const v = out[lang][key];
  const pass = v && v.includes(needle);
  console.log(`interp ${lang}.${key} contains "${needle}": ${pass}`);
  if (!pass) ok = false;
}

console.log('ALL OK:', ok && arMatch);
process.exit(ok && arMatch ? 0 : 1);
