/**
 * Regression: account deletion must re-authenticate BEFORE deleting Firestore.
 * Otherwise a stale Auth session wipes users/{uid}, then fails Auth delete and
 * leaves the user able to sign in to an empty profile (permanent data loss).
 *
 * Static source checks (no Firebase required).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const authCtx = readFileSync(join(root, 'src/context/AuthContext.jsx'), 'utf8');

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

const start = authCtx.indexOf('const deleteUserAccount = async');
assert(start >= 0, 'deleteUserAccount must exist in AuthContext.jsx');

const end = authCtx.indexOf('const signOut = async', start);
assert(end > start, 'could not bound deleteUserAccount block');

const block = authCtx.slice(start, end);

const reauthIdx = block.indexOf('await reauthenticateForDeletion()');
const firestoreIdx = block.indexOf('await doFirestoreDelete()');
const authDeleteIdx = block.indexOf('await doAuthDelete()');

assert(reauthIdx >= 0, 'must call reauthenticateForDeletion before deletes');
assert(firestoreIdx >= 0, 'must call doFirestoreDelete');
assert(authDeleteIdx >= 0, 'must call doAuthDelete');
assert(
    reauthIdx < firestoreIdx && firestoreIdx < authDeleteIdx,
    'order must be reauthenticate → Firestore delete → Auth delete'
);

// Must not delete Firestore first inside a performDelete helper (legacy bug).
assert(
    !block.includes('const performDelete = async'),
    'legacy performDelete (Firestore-before-reauth) must not return'
);

// Password accounts must prompt before destructive work when no password given.
assert(
    block.includes("providerIds.includes('password')"),
    'password accounts must be detected for pre-delete reauth prompt'
);
assert(
    block.includes('err.requirePassword = true'),
    'password prompt flag must be set before Firestore delete'
);

console.log('test-account-deletion-order: all assertions passed');
