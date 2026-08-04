/**
 * Regression: story "private replies" must not be stored on publicly readable
 * stories/{storyId} documents. Text replies belong in stories/.../private_replies
 * with owner/author-only read rules.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const viewerSrc = readFileSync(join(root, 'src/components/StoryViewer.jsx'), 'utf8');

const storiesMatch = rules.match(/match \/stories\/\{storyId\} \{[\s\S]*?\n    \}/)?.[0];
assert.ok(storiesMatch, 'stories match block must exist');

assert.match(
    storiesMatch,
    /match \/private_replies\/\{replyId\}/,
    'stories must define a private_replies subcollection'
);

const privateRepliesMatch = storiesMatch.match(
    /match \/private_replies\/\{replyId\} \{[\s\S]*?\n      \}/
)?.[0];
assert.ok(privateRepliesMatch, 'private_replies match block must exist');

assert.match(
    privateRepliesMatch,
    /request\.resource\.data\.userId == request\.auth\.uid/,
    'create must bind userId to the authenticated caller'
);
assert.match(
    privateRepliesMatch,
    /request\.resource\.data\.type == 'text'/,
    'create must restrict private_replies to text replies'
);
assert.match(
    privateRepliesMatch,
    /isStoryOwner\(\)/,
    'read path must allow the story owner'
);
assert.match(
    privateRepliesMatch,
    /resource\.data\.userId == request\.auth\.uid/,
    'read path must allow the reply author'
);

// Public story docs remain world-readable — private reply text must not rely on client filtering.
assert.match(storiesMatch, /allow read: if true/, 'stories remain publicly readable');

const handleSendReply = viewerSrc.match(
    /const handleSendReply = async \(content = null\) => \{[\s\S]*?\n    \};/
)?.[0];
assert.ok(handleSendReply, 'handleSendReply must be present');

assert.match(
    handleSendReply,
    /private_replies/,
    'text replies must write to private_replies subcollection'
);
assert.doesNotMatch(
    handleSendReply,
    /type:\s*content\s*\?\s*'emoji'\s*:\s*'text'/,
    'must not write typed text replies into the public reactions array'
);

// Text branch uses addDoc(private_replies); emoji may still use public reactions.
assert.match(
    handleSendReply,
    /addDoc\(collection\(db,\s*'stories',\s*currentStory\.id,\s*'private_replies'\)/,
    'text reply persistence must use addDoc on private_replies'
);

// UI must subscribe to private_replies rather than trusting public reactions for private text.
assert.match(
    viewerSrc,
    /collection\(db,\s*'stories',\s*currentStory\.id,\s*'private_replies'\)/,
    'StoryViewer must listen to private_replies'
);
assert.match(
    viewerSrc,
    /where\('userId',\s*'==',\s*currentUser\.uid\)/,
    'non-owner query must be scoped to the viewer\'s own replies'
);

console.log('test-story-private-replies: ok');
