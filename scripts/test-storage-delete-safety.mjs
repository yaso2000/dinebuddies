/**
 * Regression: scheduled Admin Storage cleanup must not delete objects
 * referenced by planted foreign Firebase Storage URLs.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    extractStorageObjectPath,
    isOwnedStoragePath,
    contentOwnerIds,
} = require('../functions/storageDeleteSafety.js');

const attacker = 'attacker1';
const victim = 'victim99';

assert.equal(
    isOwnedStoragePath(`stories/${attacker}/photo.jpg`, [attacker]),
    true,
    'own story media allowed'
);
assert.equal(
    isOwnedStoragePath(`avatars/${victim}_123.jpg`, [attacker]),
    false,
    'planted victim avatar blocked'
);
assert.equal(
    isOwnedStoragePath(`gallery/${victim}/menu.jpg`, [attacker]),
    false,
    'planted gallery path blocked'
);
assert.equal(
    isOwnedStoragePath(`logos/${victim}/logo.jpg`, [attacker]),
    false,
    'planted logo path blocked'
);
assert.equal(
    isOwnedStoragePath(`chat_images/${attacker}/clip.jpg`, [attacker]),
    true,
    'own chat image allowed'
);
assert.equal(
    isOwnedStoragePath(`chat_images/${victim}/clip.jpg`, [attacker]),
    false,
    'other-user chat image blocked'
);
assert.equal(
    isOwnedStoragePath(`invitations/${attacker}/cover.jpg`, [attacker]),
    true,
    'own invitation media allowed'
);
assert.equal(
    isOwnedStoragePath(`invitations/inv123/${attacker}/cover.jpg`, [attacker]),
    true,
    'legacy invitation path with owner segment allowed'
);
assert.equal(
    isOwnedStoragePath(`invitations/inv123/${victim}/cover.jpg`, [attacker]),
    false,
    'legacy invitation path with foreign owner blocked'
);
assert.equal(
    isOwnedStoragePath(`community-posts/${attacker}/post.jpg`, [attacker]),
    true,
    'own community post media allowed'
);
assert.equal(
    isOwnedStoragePath(`premium_offers/${attacker}_1.jpg`, [attacker]),
    true,
    'flat premium offer path allowed'
);
assert.equal(
    isOwnedStoragePath('../stories/attacker1/x.jpg', [attacker]),
    false,
    'path traversal blocked'
);
assert.equal(
    isOwnedStoragePath(`stories/${attacker}/photo.jpg`, []),
    false,
    'empty owners blocked'
);

const plantedAvatarUrl =
    'https://firebasestorage.googleapis.com/v0/b/dinebuddies.appspot.com/o/avatars%2Fvictim99_1.jpg?alt=media&token=abc';
assert.equal(extractStorageObjectPath(plantedAvatarUrl), 'avatars/victim99_1.jpg');
assert.equal(
    isOwnedStoragePath(extractStorageObjectPath(plantedAvatarUrl), [attacker]),
    false,
    'story plant of victim avatar must not be deletable as attacker'
);

const ownStoryUrl =
    'https://firebasestorage.googleapis.com/v0/b/dinebuddies.appspot.com/o/stories%2Fattacker1%2F1.jpg?alt=media';
assert.equal(extractStorageObjectPath(ownStoryUrl), 'stories/attacker1/1.jpg');
assert.equal(
    isOwnedStoragePath(extractStorageObjectPath(ownStoryUrl), contentOwnerIds({ userId: attacker })),
    true,
    'legitimate story cleanup still works'
);

console.log('test-storage-delete-safety: all assertions passed');
