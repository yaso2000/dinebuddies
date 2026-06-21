import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-dinebuddies-critical-rules';

const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin', { admin: true }).firestore();

    await assertFails(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'admin',
    }));

    await assertFails(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'user',
        paidCredits: 999999,
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'user',
        isGuest: false,
        created_time: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
        display_name: 'Alice A.',
        updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        subscriptionTier: 'elite',
        paidCredits: 999999,
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        businessInfo: { customLimits: { activeOffers: 999 } },
    }));

    await assertSucceeds(updateDoc(doc(adminDb, 'users/alice'), {
        subscriptionTier: 'pro',
        paidCredits: 10,
    }));

    await assertSucceeds(setDoc(doc(bobDb, 'users/bob'), {
        uid: 'bob',
        email: 'bob@example.com',
        accountType: 'business',
        role: 'partner',
        display_name: 'Bob Bistro',
        businessInfo: {
            businessName: 'Bob Bistro',
            isPublished: false,
        },
    }));

    await assertFails(setDoc(doc(aliceDb, 'private_invitations/pub-on-create'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: ['bob'],
        rsvps: { bob: 'pending' },
        privacy: 'private',
        status: 'published',
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'private_invitations/draft-1'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: ['bob'],
        rsvps: { bob: 'pending' },
        privacy: 'private',
        title: 'Dinner draft',
        status: 'draft',
        createdAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'private_invitations/draft-1'), {
        title: 'Updated dinner draft',
        updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(aliceDb, 'private_invitations/draft-1'), {
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(doc(bobDb, 'private_invitations/draft-1'), {
        rsvps: { bob: 'accepted' },
        updatedAt: serverTimestamp(),
    }));

    const updated = await getDoc(doc(aliceDb, 'users/alice'));
    if (updated.data()?.display_name !== 'Alice A.') {
        throw new Error('Allowed profile update did not persist');
    }
} finally {
    await testEnv.cleanup();
}
