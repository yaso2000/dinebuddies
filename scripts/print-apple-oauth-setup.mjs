/**
 * Print Apple Sign-In (web) setup checklist for Firebase + Apple Developer.
 * Usage: node scripts/print-apple-oauth-setup.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;

const returnUrls = [
    `https://${authDomain}/__/auth/handler`,
    `https://${projectId}.firebaseapp.com/__/auth/handler`,
    `https://${projectId}.web.app/__/auth/handler`,
];

const domains = [
    'www.dinebuddies.com',
    'dinebuddies.com',
    authDomain,
];

console.log('--- Apple Sign-In (web) for Firebase project:', projectId, '---\n');

console.log('1) Firebase Console → Authentication → Sign-in method → Apple → Enabled');
console.log(`   https://console.firebase.google.com/project/${projectId}/authentication/providers\n`);
console.log('   Fill in from Apple Developer:');
console.log('   - Services ID (e.g. com.dinebuddies.web)');
console.log('   - Apple Team ID');
console.log('   - Key ID + upload .p8 private key\n');

console.log('2) Apple Developer → Identifiers → Services IDs → (your Services ID)');
console.log('   https://developer.apple.com/account/resources/identifiers/list/serviceId\n');
console.log('   Description (shown to users on Apple sign-in — fix typos here, e.g. "DineBuddies web login"):');
console.log('   Enable "Sign in with Apple" → Configure:');
console.log('   Primary App ID: your iOS/macOS app id (if any)\n');
console.log('   Domains and Subdomains (add ALL):');
domains.forEach((d) => console.log('     ', d));
console.log('\n   Return URLs (add ALL — must match exactly):');
returnUrls.forEach((u) => console.log('     ', u));

console.log('\n3) Firebase → Authentication → Settings → Authorized domains');
console.log(`   https://console.firebase.google.com/project/${projectId}/authentication/settings`);
console.log('   Ensure listed: www.dinebuddies.com, dinebuddies.com\n');

console.log('4) On iPhone: open Safari directly (not Instagram/Facebook in-app browser):');
console.log('   https://www.dinebuddies.com/login\n');

console.log('5) Common errors:');
console.log('   - auth/internal-error → Return URL or Services ID mismatch');
console.log('   - auth/unauthorized-domain → domain missing in Firebase or Apple');
console.log('   - Redirect returns but no login → use Safari; avoid Private Relay blocking email on first sign-in\n');

console.log('6) After changing Apple/Firebase settings, wait 5–10 minutes and retry on iPhone.\n');
