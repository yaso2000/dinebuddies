/**
 * Download fresh google-services.json for com.dinebuddies.mobile from Firebase.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const appName =
  'projects/dinebuddies/androidApps/1:686703042572:android:e9daf60324f97e9242ce29';
const res = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/config`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error('download failed', res.status, await res.text());
  process.exit(1);
}
const cfg = await res.json();
// API returns { configFileContents: base64 } or similar
const b64 = cfg.configFilename
  ? cfg.configFileContents || cfg.configContents
  : cfg.configFileContents || cfg.configContents;
if (!b64 && typeof cfg === 'object') {
  // Some versions return the JSON body directly under configFileContents as string
  console.log('keys', Object.keys(cfg));
}
const contents = cfg.configFileContents || cfg.configContents;
if (!contents) {
  console.error('Unexpected response', JSON.stringify(cfg).slice(0, 500));
  process.exit(1);
}
const jsonText = Buffer.from(contents, 'base64').toString('utf8');
const outPath = path.join(root, 'android/app/google-services.json');
fs.writeFileSync(outPath, jsonText, 'utf8');
const parsed = JSON.parse(jsonText);
const app = parsed.client.find(
  (c) => c.client_info?.android_client_info?.package_name === 'com.dinebuddies.mobile'
);
console.log('Wrote', outPath);
console.log(
  'oauth clients',
  (app?.oauth_client || []).map((o) => ({
    type: o.client_type,
    id: o.client_id,
    cert: o.android_info?.certificate_hash,
  }))
);
