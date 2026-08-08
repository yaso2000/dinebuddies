/**
 * List Firebase Android SHA certs and Google Cloud OAuth clients
 * for package com.dinebuddies.app. Prints hashes only (no secrets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = 'com.dinebuddies.app';
const UPLOAD_SHA1 = '32c47db7c1d6dcff44edfe42f589a41a8a7645a9';
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

function summarizeClient(c) {
  const id = String(c.clientId || c.client_id || c.name || '').replace(
    /\.apps\.googleusercontent\.com$/,
    ''
  );
  const type = c.clientType || c.type || c.client_type;
  const android = c.androidInfo || c.android_info || {};
  const pkg = android.packageName || android.package_name || '';
  const hash = (
    android.certificateHash ||
    android.certificate_hash ||
    ''
  ).toLowerCase();
  return {
    idPrefix: id.slice(0, 28),
    type,
    package: pkg,
    sha1: hash,
    matchUpload: hash === UPLOAD_SHA1,
    matchPlay: hash === PLAY_SHA1,
  };
}

const env = loadEnv();
const projectId = env.FIREBASE_PROJECT_ID || 'dinebuddies';
const token = await getAccessToken(env);

const appsRes = await fetch(
  `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const appsJson = await appsRes.json();
const app =
  (appsJson.apps || []).find((a) => a.packageName === PACKAGE) || appsJson.apps?.[0];
console.log(
  'firebase_android_app',
  app
    ? { packageName: app.packageName, appId: app.appId, name: app.name }
    : appsJson
);

if (app?.name) {
  const shaRes = await fetch(`https://firebase.googleapis.com/v1beta1/${app.name}/sha`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const shaJson = await shaRes.json();
  console.log(
    'firebase_sha_certs',
    (shaJson.certificates || []).map((c) => `${c.certType}:${c.shaHash}`)
  );
  console.log(
    'has_upload_sha1',
    (shaJson.certificates || []).some(
      (c) => c.certType === 'SHA_1' && c.shaHash.toLowerCase() === UPLOAD_SHA1
    )
  );
  console.log(
    'has_play_sha1',
    (shaJson.certificates || []).some(
      (c) => c.certType === 'SHA_1' && c.shaHash.toLowerCase() === PLAY_SHA1
    )
  );
}

const cfgRes = await fetch(`https://firebase.googleapis.com/v1beta1/${app.name}/config`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cfg = await cfgRes.json();
const contents = cfg.configFileContents || cfg.configContents;
const parsed = JSON.parse(Buffer.from(contents, 'base64').toString('utf8'));
const oauth = (parsed.client || []).flatMap((c) => c.oauth_client || []);
console.log(
  'google_services_oauth_clients',
  oauth.map((o) => ({
    type: o.client_type,
    sha: o.android_info?.certificate_hash || null,
    idPrefix: String(o.client_id || '').slice(0, 28),
    matchUpload: o.android_info?.certificate_hash === UPLOAD_SHA1,
    matchPlay: o.android_info?.certificate_hash === PLAY_SHA1,
  }))
);

// Try several Google Cloud OAuth client listing endpoints.
const projectNumber = String(parsed.project_info?.project_number || '686703042572');
const probes = [
  `https://oauth2.googleapis.com/v1/projects/${projectNumber}/clients`,
  `https://clientauthconfig.googleapis.com/v1/projects/${projectNumber}/clients`,
  `https://www.googleapis.com/oauth2/v1/projects/${projectId}/clients`,
  `https://cloudidentity.googleapis.com/v1/oauthClients`,
];

for (const url of probes) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let summary = text.slice(0, 240);
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j.clients)) {
      summary = JSON.stringify(j.clients.map(summarizeClient).slice(0, 20));
    } else if (Array.isArray(j.items)) {
      summary = JSON.stringify(j.items.map(summarizeClient).slice(0, 20));
    }
  } catch {
    // keep slice
  }
  console.log('probe', res.status, url, summary);
}
