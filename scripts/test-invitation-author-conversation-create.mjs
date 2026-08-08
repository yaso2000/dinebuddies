/**
 * Rules regression: invitation authorship lock + conversation client-create deny.
 * Requires Firestore emulator via @firebase/rules-unit-testing.
 */
import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-author-convo-security';
const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'invitations/pub1'), {
            title: 'Coffee',
            author: { id: 'host', name: 'Host' },
            authorId: 'host',
            requests: [],
            joined: [],
        });
        await setDoc(doc(db, 'private_invitations/priv1'), {
            title: 'Private dinner',
            authorId: 'host',
            author: { id: 'host', name: 'Host' },
            invitedFriends: ['alice'],
            rsvps: { alice: 'pending' },
            status: 'draft',
        });
        await setDoc(doc(db, 'conversations/alice_bob'), {
            participants: ['alice', 'bob'],
            lastMessage: 'hi',
            unreadBy: [],
        });
    });

    const hostDb = testEnv.authenticatedContext('host').firestore();
    const malloryDb = testEnv.authenticatedContext('mallory').firestore();

    // Host must not reassign public invitation authorship onto a victim
    await assertFails(updateDoc(doc(hostDb, 'invitations/pub1'), {
        author: { id: 'victim', name: 'Victim' },
        authorId: 'victim',
    }));

    // Host can still update non-authorship fields
    await assertSucceeds(updateDoc(doc(hostDb, 'invitations/pub1'), {
        title: 'Coffee updated',
    }));

    // Host must not reassign private invitation authorship
    await assertFails(updateDoc(doc(hostDb, 'private_invitations/priv1'), {
        authorId: 'victim',
        author: { id: 'victim', name: 'Victim' },
    }));

    await assertSucceeds(updateDoc(doc(hostDb, 'private_invitations/priv1'), {
        title: 'Private dinner updated',
    }));

    // Private create cannot set mismatched authorId (victim) with attacker author.id
    await assertFails(setDoc(doc(malloryDb, 'private_invitations/forged'), {
        authorId: 'victim',
        author: { id: 'mallory', name: 'Mallory' },
        invitedFriends: ['victim'],
        status: 'draft',
    }));

    // Legitimate private create still works
    await assertSucceeds(setDoc(doc(malloryDb, 'private_invitations/ok'), {
        authorId: 'mallory',
        author: { id: 'mallory', name: 'Mallory' },
        invitedFriends: ['alice'],
        status: 'draft',
    }));

    // Client must not create conversations (random id flood / block bypass)
    await assertFails(setDoc(doc(malloryDb, 'conversations/random_flood_1'), {
        participants: ['mallory', 'victim'],
        lastMessage: null,
        unreadBy: [],
    }));
    await assertFails(setDoc(doc(malloryDb, 'conversations/mallory_victim'), {
        participants: ['mallory', 'victim'],
        lastMessage: null,
        unreadBy: [],
    }));

    // Existing participants can still update metadata, not membership
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(aliceDb, 'conversations/alice_bob'), {
        lastMessage: 'updated',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'conversations/alice_bob'), {
        participants: ['alice', 'bob', 'mallory'],
    }));

    console.log('test-invitation-author-conversation-create: all assertions passed');
} finally {
    await testEnv.cleanup();
}
