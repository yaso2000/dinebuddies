/**
 * Rules regression tests for invitation join-request wipe and chat membership rewrite.
 * Requires Firestore emulator (via @firebase/rules-unit-testing).
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

const projectId = 'demo-dinebuddies-chat-invite-security';
const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    // Seed invitation + conversation as admin (bypass rules)
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'invitations/inv1'), {
            title: 'Dinner',
            author: { id: 'host' },
            requests: ['alice', 'bob', 'carol'],
            joined: [],
        });
        await setDoc(doc(db, 'conversations/convo1'), {
            participants: ['alice', 'bob'],
            lastMessage: 'hi',
            unreadBy: ['bob'],
        });
        await setDoc(doc(db, 'conversations/convo1/messages/msg1'), {
            senderId: 'alice',
            senderName: 'Alice',
            text: 'hello',
            type: 'text',
            status: 'sent',
            reactions: {},
        });
        await setDoc(doc(db, 'chats/chat1'), {
            participants: ['alice', 'bob'],
            name: 'group',
        });
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const malloryDb = testEnv.authenticatedContext('mallory').firestore();

    // Attacker must not wipe other users' join requests
    await assertFails(updateDoc(doc(malloryDb, 'invitations/inv1'), {
        requests: [],
    }));
    await assertFails(updateDoc(doc(malloryDb, 'invitations/inv1'), {
        requests: ['alice'],
    }));

    // Caller may remove only themselves
    await assertSucceeds(updateDoc(doc(aliceDb, 'invitations/inv1'), {
        requests: ['bob', 'carol'],
    }));

    // Participant must not rewrite conversation membership
    await assertFails(updateDoc(doc(aliceDb, 'conversations/convo1'), {
        participants: ['alice', 'bob', 'mallory'],
    }));
    await assertFails(updateDoc(doc(aliceDb, 'conversations/convo1'), {
        participants: ['alice'],
    }));

    // Metadata updates still allowed
    await assertSucceeds(updateDoc(doc(aliceDb, 'conversations/convo1'), {
        lastMessage: 'updated',
        unreadBy: ['bob'],
    }));

    // Group chat membership must stay immutable for participants
    await assertFails(updateDoc(doc(aliceDb, 'chats/chat1'), {
        participants: ['alice', 'bob', 'mallory'],
    }));

    // Message author cannot reassign sender identity
    await assertFails(updateDoc(doc(aliceDb, 'conversations/convo1/messages/msg1'), {
        senderId: 'bob',
        text: 'impersonation',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'conversations/convo1/messages/msg1'), {
        senderName: 'Bob',
    }));

    // Author can still update non-identity fields on own message
    await assertSucceeds(updateDoc(doc(aliceDb, 'conversations/convo1/messages/msg1'), {
        text: 'edited hello',
    }));

    console.log('test-chat-invitation-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
