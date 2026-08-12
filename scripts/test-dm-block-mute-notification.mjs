/**
 * Unit checks for DM block/mute notification gating (no emulator required).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    isMessagingRestrictedBetweenUserDocs,
} = require('../functions/messagingRestriction.js');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

assert(
    isMessagingRestrictedBetweenUserDocs(
        { blockedUserIds: ['bob'] },
        { blockedUserIds: [] },
        'alice',
        'bob'
    ) === true,
    'blocker → blocked must restrict'
);

assert(
    isMessagingRestrictedBetweenUserDocs(
        { blockedUserIds: [] },
        { blockedUserIds: ['alice'] },
        'alice',
        'bob'
    ) === true,
    'blocked-by recipient must restrict'
);

assert(
    isMessagingRestrictedBetweenUserDocs(
        { mutedUserIds: ['bob'] },
        {},
        'alice',
        'bob'
    ) === true,
    'mute must restrict'
);

assert(
    isMessagingRestrictedBetweenUserDocs(
        { blockedUserIds: [], mutedUserIds: [] },
        { blockedUserIds: [], mutedUserIds: [] },
        'alice',
        'bob'
    ) === false,
    'open pair must allow'
);

assert(
    isMessagingRestrictedBetweenUserDocs({}, {}, 'alice', 'alice') === true,
    'self pair is invalid/restricted'
);

console.log('test-dm-block-mute-notification: all assertions passed');
