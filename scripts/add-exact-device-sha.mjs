/**
 * Add the exact device SHA-1 that Error 10 reported, then refresh google-services.json.
 * Device reported: 8f83e80478ebd15cdd2c84ef5abe630640d688bd
 * (Previously a near-miss SHA ending in 4d0688bd was added by mistake.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP =
  'projects/dinebuddies/androidApps/1:686703042572:android:e9daf60324f97e9242ce29';
const DEVICE_SHA1 = '8f83e80478ebd15cdd2c84ef5abe630640d688bd';
const WRONG_NEAR_MISS = '8f83e80478ebd15cdd2c84ef5abe63064d0688bd';

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
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const claim = Buffer.from(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope:
        'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
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

const listRes = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/sha`, { headers });
const list = await listRes.json();
const certs = list.certificates || [];
console.log(
  'before',
  certs.filter((c) => c.certType === 'SHA_1').map((c) => c.shaHash)
);

const wrong = certs.find(
  (c) => c.certType === 'SHA_1' && String(c.shaHash).toLowerCase() === WRONG_NEAR_MISS
);
if (wrong?.name) {
  const del = await fetch(`https://firebase.googleapis.com/v1beta1/${wrong.name}`, {
    method: 'DELETE',
    headers,
  });
  console.log('deleted_near_miss', del.status);
  await new Promise((r) => setTimeout(r, 1500));
}

const hasExact = certs.some(
  (c) => c.certType === 'SHA_1' && String(c.shaHash).toLowerCase() === DEVICE_SHA1
);
if (!hasExact) {
  const add = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/sha`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ shaHash: DEVICE_SHA1, certType: 'SHA_1' }),
  });
  console.log('add_exact', add.status, (await add.text()).slice(0, 200));
} else {
  // Force OAuth client refresh for this SHA
  const existing = certs.find(
    (c) => c.certType === 'SHA_1' && String(c.shaHash).toLowerCase() === DEVICE_SHA1
  );
  if (existing?.name) {
    await fetch(`https://firebase.googleapis.com/v1beta1/${existing.name}`, {
      method: 'DELETE',
      headers,
    });
    await new Promise((r) => setTimeout(r, 2000));
  }
  const add = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/sha`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ shaHash: DEVICE_SHA1, certType: 'SHA_1' }),
  });
  console.log('readd_exact', add.status, (await add.text()).slice(0, 200));
}

await new Promise((r) => setTimeout(r, 2500));
const cfgRes = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/config`, {
  headers,
});
const cfg = await cfgRes.json();
const contents = cfg.configFileContents || cfg.configContents;
const jsonText = Buffer.from(contents, 'base64').toString('utf8');
fs.writeFileSync(path.join(root, 'android/app/google-services.json'), jsonText);
const parsed = JSON.parse(jsonText);
const hashes = (parsed.client || [])
  .flatMap((c) => c.oauth_client || [])
  .filter((o) => o.client_type === 1)
  .map((o) => o.android_info?.certificate_hash);
console.log('has_exact_device_sha', hashes.includes(DEVICE_SHA1));
console.log('hashes', hashes);
