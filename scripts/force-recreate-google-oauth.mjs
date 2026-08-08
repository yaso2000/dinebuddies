/**
 * Inspect Firebase Auth Google IdP config + force-recreate upload/play SHA OAuth clients.
 * Prints client id prefixes only (no secrets).
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
        'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit',
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
  return (await res.json()).certificates || [];
}

async function deleteSha(token, name) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('delete', name.split('/').pop(), res.status);
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
  console.log('add', certType, shaHash.slice(0, 8), res.status);
}

const env = loadEnv();
const token = await getAccessToken(env);
const projectId = env.FIREBASE_PROJECT_ID || 'dinebuddies';

// Identity Toolkit / Identity Platform config for Google IdP
const idpUrls = [
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
  `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`,
  `https://firebase.googleapis.com/v1beta1/projects/${projectId}/config`,
];
for (const url of idpUrls) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let summary = text.slice(0, 500);
  try {
    const j = JSON.parse(text);
    summary = JSON.stringify({
      status: res.status,
      signIn: j.signIn || j.signInConfig || null,
      idpConfig: j.idpConfig || j.providerConfigs || j.defaultSupportedIdpConfigs || null,
      keys: Object.keys(j),
    }).slice(0, 800);
  } catch {
    summary = `${res.status} ${summary}`;
  }
  console.log('idp', url, summary);
}

const defaultIdp = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const defaultIdpText = await defaultIdp.text();
console.log('google_idp_status', defaultIdp.status);
try {
  const j = JSON.parse(defaultIdpText);
  console.log('google_idp', {
    name: j.name,
    enabled: j.enabled,
    clientIdPrefix: String(j.clientId || '').slice(0, 40),
    hasSecret: Boolean(j.clientSecret),
  });
} catch {
  console.log('google_idp_raw', defaultIdpText.slice(0, 400));
}

// Force recreate upload + play SHA clients
let certs = await listSha(token);
for (const c of certs) {
  const h = String(c.shaHash || '').toLowerCase();
  if (
    (c.certType === 'SHA_1' && (h === UPLOAD_SHA1 || h === PLAY_SHA1)) ||
    (c.certType === 'SHA_256' && h === UPLOAD_SHA256)
  ) {
    await deleteSha(token, c.name);
  }
}
await new Promise((r) => setTimeout(r, 3000));
await addSha(token, UPLOAD_SHA1, 'SHA_1');
await addSha(token, UPLOAD_SHA256, 'SHA_256');
await addSha(token, PLAY_SHA1, 'SHA_1');
await new Promise((r) => setTimeout(r, 4000));

const cfgRes = await fetch(`https://firebase.googleapis.com/v1beta1/${APP}/config`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cfg = await cfgRes.json();
const contents = cfg.configFileContents || cfg.configContents;
const jsonText = Buffer.from(contents, 'base64').toString('utf8');
fs.writeFileSync(path.join(root, 'android/app/google-services.json'), jsonText);
const parsed = JSON.parse(jsonText);
const oauth = (parsed.client || []).flatMap((c) => c.oauth_client || []);
console.log(
  'oauth_after_recreate',
  oauth.map((o) => ({
    type: o.client_type,
    sha: o.android_info?.certificate_hash || null,
    idPrefix: String(o.client_id || '').slice(0, 32),
  }))
);
console.log(
  'has_upload',
  oauth.some((o) => o.android_info?.certificate_hash === UPLOAD_SHA1)
);
console.log(
  'has_play',
  oauth.some((o) => o.android_info?.certificate_hash === PLAY_SHA1)
);
