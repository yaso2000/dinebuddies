/**
 * List Firebase Android SHA certs for com.dinebuddies.mobile and compare to google-services.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, '\n');
    out[k] = v;
  }
  return out;
}

async function getAccessToken(env) {
  const email = env.FIREBASE_CLIENT_EMAIL;
  const key = env.FIREBASE_PRIVATE_KEY;
  if (!email || !key) throw new Error('Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

const env = loadEnv();
const token = await getAccessToken(env);
const appName =
  'projects/dinebuddies/androidApps/1:686703042572:android:e9daf60324f97e9242ce29';

const shaRes = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/sha`, {
  headers: { Authorization: `Bearer ${token}` },
});
const shaJson = await shaRes.json();
console.log('Firebase SHA API status', shaRes.status);
console.log(JSON.stringify(shaJson, null, 2));

const gs = JSON.parse(fs.readFileSync(path.join(root, 'android/app/google-services.json'), 'utf8'));
const app = gs.client.find((c) => c.client_info?.android_client_info?.package_name === 'com.dinebuddies.mobile');
const hashes = (app?.oauth_client || [])
  .filter((o) => o.client_type === 1)
  .map((o) => o.android_info?.certificate_hash);
console.log('google-services.json android hashes:', hashes);
