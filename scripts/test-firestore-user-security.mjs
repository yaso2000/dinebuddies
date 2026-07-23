import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-dinebuddies-user-security',
    firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice', {
        email: 'alice@example.com',
        email_verified: true,
    }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', {
        email: 'bob@example.com',
        email_verified: false,
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin', { admin: true }).firestore();

    await assertFails(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        role: 'admin',
    }));

    await assertFails(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        paidCredits: 999999,
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        authEmail: 'alice@example.com',
        emailVerified: true,
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
        joinedCommunities: ['paid-business-community'],
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        businessInfo: { customLimits: { activeOffers: 999 } },
    }));

    await assertFails(setDoc(doc(bobDb, 'users/bob'), {
        uid: 'bob',
        role: 'user',
        authEmail: 'attacker@example.com',
        emailVerified: true,
    }));

    await assertSucceeds(setDoc(doc(bobDb, 'users/bob'), {
        uid: 'bob',
        email: 'bob@example.com',
        authEmail: 'bob@example.com',
        emailVerified: false,
        accountType: 'business',
        role: 'partner',
        display_name: 'Bob Bistro',
        businessInfo: {
            businessName: 'Bob Bistro',
            isPublished: false,
        },
    }));

    await assertSucceeds(updateDoc(doc(adminDb, 'users/alice'), {
        subscriptionTier: 'pro',
        paidCredits: 10,
        joinedCommunities: ['approved-community'],
    }));
} finally {
    await testEnv.cleanup();
}
