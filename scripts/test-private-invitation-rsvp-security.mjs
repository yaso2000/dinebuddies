/**
 * Rules regression: private_invitations host-forced RSVP → chat ACL.
 *
 * Host must not seed or rewrite invitee acceptance. Chat membership depends on
 * rsvps.{uid} == 'accepted', so forged acceptance grants private group chat.
 *
 * Requires Firestore emulator via @firebase/rules-unit-testing.
 */
import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    addDoc,
    collection,
    doc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-private-rsvp';
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
        await setDoc(doc(db, 'users/host'), {
            role: 'user',
            display_name: 'Host',
        });
        await setDoc(doc(db, 'users/victim'), {
            role: 'user',
            display_name: 'Victim',
        });
        await setDoc(doc(db, 'users/mallory'), {
            role: 'user',
            display_name: 'Mallory',
        });
        await setDoc(doc(db, 'private_invitations/pub1'), {
            title: 'Dinner',
            authorId: 'host',
            author: { id: 'host', name: 'Host' },
            invitedFriends: ['victim'],
            rsvps: { victim: 'pending' },
            status: 'published',
            publishedAt: new Date(),
            privacy: 'private',
        });
        await setDoc(doc(db, 'private_invitations/accepted1'), {
            title: 'Brunch',
            authorId: 'host',
            author: { id: 'host', name: 'Host' },
            invitedFriends: ['victim'],
            rsvps: { victim: 'accepted' },
            status: 'published',
            publishedAt: new Date(),
            privacy: 'private',
        });
    });

    const hostDb = testEnv.authenticatedContext('host').firestore();
    const victimDb = testEnv.authenticatedContext('victim').firestore();
    const malloryDb = testEnv.authenticatedContext('mallory').firestore();

    // --- Create: cannot seed accepted RSVPs or publishedAt ---
    await assertFails(setDoc(doc(hostDb, 'private_invitations/forged_rsvp'), {
        title: 'Trap',
        authorId: 'host',
        author: { id: 'host', name: 'Host' },
        invitedFriends: ['victim'],
        rsvps: { victim: 'accepted' },
        status: 'draft',
        privacy: 'private',
    }));
    await assertFails(setDoc(doc(hostDb, 'private_invitations/forged_published'), {
        title: 'Trap',
        authorId: 'host',
        author: { id: 'host', name: 'Host' },
        invitedFriends: ['victim'],
        rsvps: {},
        status: 'published',
        publishedAt: new Date(),
        privacy: 'private',
    }));
    await assertSucceeds(setDoc(doc(hostDb, 'private_invitations/draft_ok'), {
        title: 'Legit draft',
        authorId: 'host',
        author: { id: 'host', name: 'Host' },
        invitedFriends: ['victim'],
        status: 'draft',
        privacy: 'private',
    }));
    await assertSucceeds(setDoc(doc(hostDb, 'private_invitations/draft_empty_rsvps'), {
        title: 'Legit draft empty rsvps',
        authorId: 'host',
        author: { id: 'host', name: 'Host' },
        invitedFriends: ['victim'],
        rsvps: {},
        status: 'draft',
        privacy: 'private',
    }));

    // --- Host cannot force acceptance (chat ACL) ---
    await assertFails(updateDoc(doc(hostDb, 'private_invitations/pub1'), {
        rsvps: { victim: 'accepted' },
    }));
    await assertFails(updateDoc(doc(hostDb, 'private_invitations/pub1'), {
        'rsvps.victim': 'accepted',
    }));
    // Host can still update non-RSVP fields
    await assertSucceeds(updateDoc(doc(hostDb, 'private_invitations/pub1'), {
        title: 'Dinner updated',
    }));

    // --- Invitee can accept / decline self only ---
    await assertSucceeds(updateDoc(doc(victimDb, 'private_invitations/pub1'), {
        'rsvps.victim': 'accepted',
    }));
    await assertFails(updateDoc(doc(victimDb, 'private_invitations/pub1'), {
        rsvps: { victim: 'accepted', mallory: 'accepted' },
    }));
    await assertFails(updateDoc(doc(malloryDb, 'private_invitations/pub1'), {
        'rsvps.victim': 'declined',
    }));

    // --- Chat messages: pending invitee denied; accepted invitee allowed ---
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Reset pub1 victim back to pending for denial check
        await updateDoc(doc(db, 'private_invitations/pub1'), {
            rsvps: { victim: 'pending' },
        });
    });
    await assertFails(addDoc(collection(victimDb, 'private_invitations/pub1/messages'), {
        senderId: 'victim',
        text: 'should fail while pending',
        createdAt: new Date(),
    }));
    await assertSucceeds(addDoc(collection(victimDb, 'private_invitations/accepted1/messages'), {
        senderId: 'victim',
        text: 'hello after accept',
        createdAt: new Date(),
    }));
    // Host can always message
    await assertSucceeds(addDoc(collection(hostDb, 'private_invitations/pub1/messages'), {
        senderId: 'host',
        text: 'host message',
        createdAt: new Date(),
    }));

    console.log('test-private-invitation-rsvp-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
