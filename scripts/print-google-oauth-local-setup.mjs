/**
 * Print exact Google OAuth values for localhost dev (Firebase Google sign-in).
 * Usage: node scripts/print-google-oauth-local-setup.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
const ports = ['5176', '5177'];
const javascriptOrigins = ports.flatMap((p) => [
    `http://localhost:${p}`,
    `http://127.0.0.1:${p}`,
]);
const redirectUris = [
    `https://${authDomain}/__/auth/handler`,
    `https://${projectId}.web.app/__/auth/handler`,
];

console.log('--- Google sign-in on localhost (Firebase project:', projectId, ') ---\n');
console.log('Step 1 — Firebase Console → Authentication → Sign-in method → Google → Enabled');
console.log(`  ${`https://console.firebase.google.com/project/${projectId}/authentication/providers`}\n`);
console.log('Step 2 — Copy "Web client ID" from Web SDK configuration on that page.\n');
console.log('Step 3 — Google Cloud → Credentials → open that OAuth 2.0 Web client');
console.log(`  ${`https://console.cloud.google.com/apis/credentials?project=${projectId}`}\n`);
console.log('  Authorized JavaScript origins (add ALL):');
javascriptOrigins.forEach((o) => console.log('   ', o));
console.log('\n  Authorized redirect URIs (add ALL):');
redirectUris.forEach((u) => console.log('   ', u));
console.log('\nStep 4 — Firebase → Authentication → Settings → Authorized domains');
console.log(`  ${`https://console.firebase.google.com/project/${projectId}/authentication/settings`}`);
console.log('  Ensure: localhost, 127.0.0.1\n');
console.log('Step 5 — Deploy auth config from this repo (optional, syncs firebase.json):');
console.log('  npm run deploy:firebase-auth\n');
console.log('Step 6 — Open in Chrome (not Cursor preview): http://localhost:5176/login\n');
console.log('Do NOT set VITE_GOOGLE_WEB_CLIENT_ID in .env for localhost — use Firebase default Web client.');
