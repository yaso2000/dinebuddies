/**
 * Regression: auth email-flag sync must not create users/{uid} stubs that block profile bootstrap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { needsUserProfileBootstrap } from '../src/utils/userProfileBootstrap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const authSrc = readFileSync(join(root, 'src/context/AuthContext.jsx'), 'utf8');

// --- helper unit checks ---
assert.equal(needsUserProfileBootstrap(null), true);
assert.equal(needsUserProfileBootstrap(undefined), true);
assert.equal(needsUserProfileBootstrap({}), true);
assert.equal(needsUserProfileBootstrap({ emailVerified: true, authEmail: 'a@b.com' }), true);
assert.equal(needsUserProfileBootstrap({ role: 'user' }), false);
assert.equal(needsUserProfileBootstrap({ role: 'business' }), false);
assert.equal(needsUserProfileBootstrap({ role: null }), true);
assert.equal(needsUserProfileBootstrap({ role: '' }), true);
assert.equal(
    needsUserProfileBootstrap({ registrationIntent: 'business', emailVerified: true }),
    false,
    'business signup stubs must not be consumer-bootstrapped'
);
assert.equal(
    needsUserProfileBootstrap({ registrationIntent: 'business', role: 'user' }),
    false,
    'intent wins even if role was raced to user'
);

// --- AuthContext static contracts ---
const emailSyncEffect = authSrc.match(
    /CRITICAL: use updateDoc only[\s\S]*?}, \[currentUser\?\.uid, currentUser\?\.emailVerified, currentUser\?\.email, isGuest\]\);/
)?.[0];
assert.ok(emailSyncEffect, 'email flag sync useEffect block must be present');
assert.match(
    emailSyncEffect,
    /await updateDoc\(\s*doc\(\s*db,\s*['"]users['"]/,
    'email flag sync must updateDoc existing users/{uid} only'
);
assert.doesNotMatch(
    emailSyncEffect,
    /await setDoc\(/,
    'email flag sync must not await setDoc (creates incomplete stubs)'
);
assert.match(
    authSrc,
    /needsUserProfileBootstrap/,
    'sign-in paths must recover incomplete email-flag stubs via needsUserProfileBootstrap'
);
assert.match(
    authSrc,
    /signInWithGoogle[\s\S]*needsUserProfileBootstrap[\s\S]*signInWithFacebook[\s\S]*needsUserProfileBootstrap/s,
    'Google and Facebook sign-in must both recover incomplete stubs'
);

console.log('test-auth-email-sync-stub-race: ok');
