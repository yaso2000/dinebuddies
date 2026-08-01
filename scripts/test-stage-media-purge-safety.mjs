/**
 * Regression: stage purge must not delete arbitrary Storage objects referenced in forged URLs.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isSafeStageMediaPath, extractStorageObjectPath } = require('../functions/stageMediaSafety.js');

const members = new Set(['host1', 'guest2']);

assert.equal(
    isSafeStageMediaPath('chat_images/guest2/guest2_1.jpg', members),
    true,
    'member chat image allowed'
);
assert.equal(
    isSafeStageMediaPath('voice_messages/host1/clip.webm', members),
    true,
    'member voice allowed'
);
assert.equal(
    isSafeStageMediaPath('avatars/victim_99.jpg', members),
    false,
    'avatar wipe blocked'
);
assert.equal(
    isSafeStageMediaPath('gallery/victim/photo.jpg', members),
    false,
    'gallery wipe blocked'
);
assert.equal(
    isSafeStageMediaPath('chat_images/victim/evil.jpg', members),
    false,
    'other-user chat path blocked'
);
assert.equal(
    isSafeStageMediaPath('../chat_images/host1/x.jpg', members),
    false,
    'path traversal blocked'
);
assert.equal(
    isSafeStageMediaPath('invitations/host1/cover.jpg', members),
    false,
    'non-stage prefix blocked'
);

const url =
    'https://firebasestorage.googleapis.com/v0/b/dinebuddies.appspot.com/o/avatars%2Fvictim_1.jpg?alt=media&token=abc';
assert.equal(extractStorageObjectPath(url), 'avatars/victim_1.jpg');
assert.equal(isSafeStageMediaPath(extractStorageObjectPath(url), members), false);

console.log('test-stage-media-purge-safety: all assertions passed');
