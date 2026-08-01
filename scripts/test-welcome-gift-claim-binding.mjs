/**
 * Regression: welcome_gifts_claimed must be bound to the caller's Auth identity,
 * and createUserProfile must claim only after users/{uid} is written.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const authSrc = readFileSync(join(root, 'src/context/AuthContext.jsx'), 'utf8');

const welcomeMatch = rules.match(
    /match \/welcome_gifts_claimed\/\{claimId\} \{[\s\S]*?\n    \}/
)?.[0];
assert.ok(welcomeMatch, 'welcome_gifts_claimed match block must exist');

assert.match(
    welcomeMatch,
    /claimId == request\.auth\.token\.email/,
    'create/get must bind claimId to Auth token email'
);
assert.match(
    welcomeMatch,
    /claimId == request\.auth\.token\.phone_number/,
    'create/get must bind claimId to Auth token phone_number'
);
assert.match(
    welcomeMatch,
    /request\.resource\.data\.userId == request\.auth\.uid/,
    'create must still bind userId to caller'
);

// Reject the old open create shape: signed-in + userId only (no claimId binding).
const createClause = welcomeMatch.match(/allow create: if[\s\S]*?;/)?.[0] || '';
assert.ok(createClause.includes('claimId == request.auth.token.email'), 'create clause must require email claimId bind');
assert.ok(
    createClause.includes('claimId == request.auth.token.phone_number'),
    'create clause must require phone claimId bind'
);

const createUserProfile = authSrc.match(
    /const createUserProfile = async \(userId, userData\) => \{[\s\S]*?\n    \};/
)?.[0];
assert.ok(createUserProfile, 'createUserProfile must be present');

assert.match(
    createUserProfile,
    /auth\.currentUser\?\.email \|\| auth\.currentUser\?\.phoneNumber/,
    'claim id must come from Auth currentUser email/phone (token-aligned)'
);
assert.doesNotMatch(
    createUserProfile,
    /userData\.email\?\.toLowerCase\(\)/,
    'must not lowercase a non-token email into a claimId that rules will reject'
);

const usersWriteIdx = createUserProfile.indexOf("setDoc(doc(db, 'users', userId)");
const giftWriteIdx = createUserProfile.indexOf("setDoc(doc(db, 'welcome_gifts_claimed'");
assert.ok(usersWriteIdx >= 0, 'must write users/{uid}');
assert.ok(giftWriteIdx >= 0, 'must write welcome_gifts_claimed after eligibility');
assert.ok(
    usersWriteIdx < giftWriteIdx,
    'users/{uid} must be written before welcome_gifts_claimed so a failed profile create cannot burn the gift'
);
assert.match(
    createUserProfile,
    /shouldClaimWelcomeGift/,
    'must gate gift claim behind successful profile path flag'
);

console.log('test-welcome-gift-claim-binding: ok');
