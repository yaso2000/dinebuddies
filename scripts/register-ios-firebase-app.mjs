/**
 * Register the iOS app (com.dinebuddies.app) in the existing Firebase project
 * (mirrors the already-registered Android app), then download its
 * GoogleService-Info.plist into ios/App/App/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_ID = 'com.dinebuddies.app';
const PROJECT = 'dinebuddies';

function loadEnv() {
    const raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
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

async function findExistingIosApp(token) {
    const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/iosApps`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`list iosApps failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return (json.apps || []).find((a) => a.bundleId === BUNDLE_ID) || null;
}

async function createIosApp(token) {
    const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/iosApps`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bundleId: BUNDLE_ID, displayName: 'DineBuddies iOS' }),
    });
    if (!res.ok) throw new Error(`create iosApp failed: ${res.status} ${await res.text()}`);
    const op = await res.json();

    // Firebase app creation is a long-running Operation — poll until done.
    const opName = op.name;
    for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`https://firebase.googleapis.com/v1beta1/${opName}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const pollJson = await pollRes.json();
        if (pollJson.done) {
            if (pollJson.error) throw new Error(`operation failed: ${JSON.stringify(pollJson.error)}`);
            return pollJson.response;
        }
    }
    throw new Error('Timed out waiting for iOS app creation to complete');
}

async function downloadConfig(token, appName) {
    const res = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/config`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`download config failed: ${res.status} ${await res.text()}`);
    const cfg = await res.json();
    const contents = cfg.configFileContents || cfg.configContents;
    if (!contents) throw new Error(`Unexpected response: ${JSON.stringify(cfg).slice(0, 500)}`);
    return Buffer.from(contents, 'base64').toString('utf8');
}

const env = loadEnv();
const token = await getAccessToken(env);

let app = await findExistingIosApp(token);
if (app) {
    console.log('iOS app already registered:', app.appId);
} else {
    console.log(`Registering iOS app for bundle id ${BUNDLE_ID}...`);
    app = await createIosApp(token);
    console.log('Created iOS app:', app.appId);
}

const plistContents = await downloadConfig(token, app.name);
const outPath = path.join(root, 'ios/App/App/GoogleService-Info.plist');
fs.writeFileSync(outPath, plistContents, 'utf8');
console.log('Wrote', outPath);
