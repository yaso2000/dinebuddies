/**
 * Rules regression: block/mute must stop DM message writes on existing conversations.
 * Requires Firestore emulator via @firebase/rules-unit-testing.
 */
import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-dm-block-mute';
const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
});

const messagePayload = {
    senderId: 'bob',
    text: 'still here',
    type: 'text',
    createdAt: serverTimestamp(),
    status: 'sent',
    reactions: {},
};

try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/alice'), {
            role: 'user',
            displayName: 'Alice',
            blockedUserIds: ['bob'],
            mutedUserIds: [],
        });
        await setDoc(doc(db, 'users/bob'), {
            role: 'user',
            displayName: 'Bob',
            blockedUserIds: [],
            mutedUserIds: [],
        });
        await setDoc(doc(db, 'users/cara'), {
            role: 'user',
            displayName: 'Cara',
            blockedUserIds: [],
            mutedUserIds: [],
        });
        await setDoc(doc(db, 'users/dan'), {
            role: 'user',
            displayName: 'Dan',
            blockedUserIds: [],
            mutedUserIds: ['erin'],
        });
        await setDoc(doc(db, 'users/erin'), {
            role: 'user',
            displayName: 'Erin',
            blockedUserIds: [],
            mutedUserIds: [],
        });
        // Existing conversation before Alice blocked Bob
        await setDoc(doc(db, 'conversations/alice_bob'), {
            participants: ['alice', 'bob'],
            lastMessage: 'hey',
            lastMessageTime: new Date(),
            unreadBy: ['alice'],
            typing: {},
        });
        await setDoc(doc(db, 'conversations/cara_open'), {
            participants: ['cara', 'bob'],
            lastMessage: null,
            unreadBy: [],
            typing: {},
        });
        await setDoc(doc(db, 'conversations/dan_erin'), {
            participants: ['dan', 'erin'],
            lastMessage: 'yo',
            unreadBy: [],
            typing: {},
        });
    });

    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const caraDb = testEnv.authenticatedContext('cara').firestore();
    const erinDb = testEnv.authenticatedContext('erin').firestore();

    // Blocked sender cannot write messages on the existing conversation
    await assertFails(
        addDoc(collection(bobDb, 'conversations/alice_bob/messages'), messagePayload)
    );

    // Blocked sender cannot bump lastMessage / unread badge
    await assertFails(
        updateDoc(doc(bobDb, 'conversations/alice_bob'), {
            lastMessage: 'harassment',
            unreadBy: ['alice'],
        })
    );

    // Blocker can still clear their own unread badge
    await assertSucceeds(
        updateDoc(doc(aliceDb, 'conversations/alice_bob'), {
            unreadBy: [],
        })
    );

    // Unrelated open conversation still allows messages
    await assertSucceeds(
        addDoc(collection(bobDb, 'conversations/cara_open/messages'), {
            ...messagePayload,
            senderId: 'bob',
            text: 'hello cara',
        })
    );
    await assertSucceeds(
        updateDoc(doc(caraDb, 'conversations/cara_open'), {
            lastMessage: 'hello cara',
        })
    );

    // Mute is treated like block for messaging
    await assertFails(
        addDoc(collection(erinDb, 'conversations/dan_erin/messages'), {
            senderId: 'erin',
            text: 'muted still?',
            type: 'text',
            createdAt: serverTimestamp(),
            status: 'sent',
            reactions: {},
        })
    );

    console.log('test-dm-block-mute-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
