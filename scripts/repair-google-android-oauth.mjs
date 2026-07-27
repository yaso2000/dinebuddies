/**
 * Force-repair Android Google Sign-In OAuth:
 * - ensure upload SHA-1 + SHA-256 are in Firebase
 * - recreate Play App Signing SHA-1 (forces Google OAuth Android client refresh)
 * - refresh google-services.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP =
  'projects/dinebuddies/androidApps/1:686703042572:android:e9daf60324f97e9242ce29';

const UPLOAD_SHA1 = '32c47db7c1d6dcff44edfe42f589a41a8a7645a9';
const UPLOAD_SHA256 =
  '280507f567c00513921d1f430dd2c023e86ba16a55dabb502857fd573cc0c4b1';
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

async function listSha(token) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/sha`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`list sha failed ${res.status} ${JSON.stringify(json)}`);
  return json.certificates || [];
}

async function addSha(token, shaHash, certType) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/sha`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ shaHash, certType }),
  });
  const text = await res.text();
  console.log(`add ${certType} ${shaHash}:`, res.status, text.slice(0, 200));
  return res.ok || res.status === 409;
}

async function deleteSha(token, name) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`delete ${name}:`, res.status);
  return res.ok;
}

async function refreshGoogleServices(token) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`config download failed ${res.status} ${await res.text()}`);
  const cfg = await res.json();
  const contents = cfg.configFileContents || cfg.configContents;
  if (!contents) throw new Error(`no config contents keys=${Object.keys(cfg)}`);
  const jsonText = Buffer.from(contents, 'base64').toString('utf8');
  const outPath = path.join(root, 'android/app/google-services.json');
  fs.writeFileSync(outPath, jsonText);
  const parsed = JSON.parse(jsonText);
  const hashes = (parsed.client || [])
    .flatMap((c) => c.oauth_client || [])
    .filter((o) => o.client_type === 1)
    .map((o) => o.android_info?.certificate_hash);
  console.log('Wrote', outPath);
  console.log('android oauth hashes now:', hashes);
  console.log('has_upload_sha1', hashes.includes(UPLOAD_SHA1));
  console.log('has_play_sha1', hashes.includes(PLAY_SHA1));
}

const env = loadEnv();
const token = await getAccessToken(env);
let certs = await listSha(token);
console.log(
  'before',
  certs.map((c) => `${c.certType}:${c.shaHash}`)
);

const hasUpload1 = certs.some(
  (c) => c.certType === 'SHA_1' && c.shaHash.toLowerCase() === UPLOAD_SHA1
);
const hasUpload256 = certs.some(
  (c) => c.certType === 'SHA_256' && c.shaHash.toLowerCase() === UPLOAD_SHA256
);
if (!hasUpload1) await addSha(token, UPLOAD_SHA1, 'SHA_1');
if (!hasUpload256) await addSha(token, UPLOAD_SHA256, 'SHA_256');

certs = await listSha(token);
const play = certs.find(
  (c) => c.certType === 'SHA_1' && c.shaHash.toLowerCase() === PLAY_SHA1
);
if (play?.name) {
  await deleteSha(token, play.name);
  await new Promise((r) => setTimeout(r, 2500));
}
await addSha(token, PLAY_SHA1, 'SHA_1');

await new Promise((r) => setTimeout(r, 2000));
await refreshGoogleServices(token);

certs = await listSha(token);
console.log(
  'after',
  certs.map((c) => `${c.certType}:${c.shaHash}`)
);
