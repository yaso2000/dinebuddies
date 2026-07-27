/**
 * Delete + re-add Play App Signing SHA-1 to force Google OAuth client refresh.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAY_SHA1 = 'e00525d80311a4444a3acd1c8a32454cac1c9d20';

function loadEnv() {
  const raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v.replace(/\\n/g, '\n');
  }
  return out;
}

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const jwt = `${unsigned}.${sign.sign(env.FIREBASE_PRIVATE_KEY, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(JSON.stringify(json));
  return json.access_token;
}

const env = loadEnv();
const token = await getAccessToken(env);
const headers = { Authorization: `Bearer ${token}` };
const appName =
  'projects/dinebuddies/androidApps/1:686703042572:android:e9daf60324f97e9242ce29';

const listRes = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/sha`, { headers });
const list = await listRes.json();
const playCert = (list.certificates || []).find(
  (c) => String(c.shaHash || '').toLowerCase() === PLAY_SHA1 && c.certType === 'SHA_1'
);
if (!playCert?.name) {
  console.error('Play SHA-1 not found in Firebase', list);
  process.exit(1);
}

const delRes = await fetch(`https://firebase.googleapis.com/v1beta1/${playCert.name}`, {
  method: 'DELETE',
  headers,
});
console.log('delete', delRes.status, await delRes.text());

await new Promise((r) => setTimeout(r, 1500));

const addRes = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/sha`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ shaHash: PLAY_SHA1, certType: 'SHA_1' }),
});
console.log('re-add', addRes.status, await addRes.text());

const again = await (
  await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/sha`, { headers })
).json();
console.log('certs now', JSON.stringify(again, null, 2));
