/**
 * Regression: after publishPrivateInvitationDraft stamps publishedAt, hosts must not
 * expand invitedFriends (or clear the publish marker) via client Firestore updates.
 * The publish callable short-circuits on publishedAt and will not re-filter or re-charge.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    filterInviteesForPublishedEdit,
    hasOnlyPublishedInvitees,
    isPrivateInvitationPublished,
} from '../src/utils/privateInvitationPublishLock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const privateCreate = readFileSync(join(root, 'src/pages/CreatePrivateInvitation.jsx'), 'utf8');
const datingCreate = readFileSync(join(root, 'src/pages/CreateDatingInvitation.jsx'), 'utf8');
const publishFn = readFileSync(join(root, 'functions/index.js'), 'utf8');

assert.match(
    rules,
    /function privateInvitationPostPublishHostUpdateOk\(\)/,
    'rules must define post-publish host update guard'
);
assert.match(
    rules,
    /invitedFriends[\s\S]*hasOnly\(resource\.data\.get\('invitedFriends'/,
    'post-publish guard must prevent invitee expansion via hasOnly'
);
assert.match(
    rules,
    /hasAny\(\['authorId', 'author', 'publishedAt'\]\)/,
    'post-publish guard must lock authorship and publishedAt'
);

const privateMatch = rules.match(
    /match \/private_invitations\/\{invitationId\} \{[\s\S]*?\n    \}/
)?.[0];
assert.ok(privateMatch, 'private_invitations match block must exist');
assert.match(
    privateMatch,
    /isPrivateInvitationHost\(\) && privateInvitationPostPublishHostUpdateOk\(\)/,
    'host updates must require the post-publish guard'
);
assert.doesNotMatch(
    privateMatch,
    /Host can update freely/,
    'must not keep unrestricted host update comment/path'
);

assert.match(
    publishFn,
    /if \(invPre\.publishedAt\) \{\s*return \{ success: true, alreadyPublished: true/,
    'publish callable still short-circuits when publishedAt is set (rules must carry the lock)'
);

assert.equal(isPrivateInvitationPublished({ publishedAt: { seconds: 1 } }), true);
assert.equal(isPrivateInvitationPublished({ status: 'draft' }), false);
assert.deepEqual(
    filterInviteesForPublishedEdit(['a', 'b'], ['b', 'c', 'a']),
    ['b', 'a']
);
assert.equal(hasOnlyPublishedInvitees(['a', 'b'], ['a']), true);
assert.equal(hasOnlyPublishedInvitees(['a', 'b'], ['a', 'c']), false);

assert.match(privateCreate, /privateInvitationPublishLock/);
assert.match(datingCreate, /privateInvitationPublishLock/);
assert.match(privateCreate, /isPublishedEdit/);
assert.match(datingCreate, /isPublishedEdit/);
assert.match(privateCreate, /cannot_add_invitees_after_publish/);
assert.match(datingCreate, /cannot_add_invitees_after_publish/);

console.log('test-private-invitation-post-publish-lock: ok');
