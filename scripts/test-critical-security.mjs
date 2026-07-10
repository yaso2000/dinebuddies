import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const projectId = `dinebuddies-critical-security-${Date.now()}`;
const rules = readFileSync(resolve('firestore.rules'), 'utf8');

const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
});

async function seed(path, data) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), path), data);
    });
}

try {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin-user', { admin: true }).firestore();
    const anon = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'user',
        isGuest: false,
        created_time: serverTimestamp(),
        last_active_time: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isProfileComplete: false,
    }));

    const charlie = testEnv.authenticatedContext('charlie', { email: 'charlie@example.com' }).firestore();
    await assertFails(setDoc(doc(charlie, 'users/charlie'), {
        uid: 'charlie',
        email: 'charlie@example.com',
        display_name: 'Charlie',
        role: 'admin',
        paidCredits: 999999,
        subscriptionTier: 'elite',
    }));

    await seed('users/bob', {
        uid: 'bob',
        email: 'bob@example.com',
        display_name: 'Bob',
        role: 'user',
    });
    const bob = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();

    await assertFails(updateDoc(doc(bob, 'users/bob'), {
        paidCredits: 999999,
        subscriptionTier: 'elite',
        banned: false,
    }));

    await assertSucceeds(updateDoc(doc(bob, 'users/bob'), {
        display_name: 'Bobby',
        lastSeen: serverTimestamp(),
    }));

    const business = testEnv.authenticatedContext('alice-business', { email: 'biz@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(business, 'users/alice-business'), {
        uid: 'alice-business',
        email: 'biz@example.com',
        display_name: 'Alice Cafe',
        role: 'partner',
        pendingBusinessRegistration: false,
        businessInfo: {
            businessName: 'Alice Cafe',
            businessType: 'Restaurant',
            city: 'Sydney',
            isPublished: false,
        },
    }));

    await assertFails(setDoc(doc(alice, 'private_invitations/published-direct'), {
        authorId: 'alice',
        invitedFriends: ['bob'],
        rsvps: { bob: 'pending' },
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await seed('private_invitations/draft-1', {
        authorId: 'alice',
        invitedFriends: ['bob'],
        rsvps: { bob: 'pending' },
        status: 'draft',
        createdAt: new Date(),
    });

    await assertFails(updateDoc(doc(alice, 'private_invitations/draft-1'), {
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(anon, 'partner_notifications/anon-feedback'), {
        restaurantId: 'business-1',
        type: 'business_feedback',
        message: 'spam',
        createdAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(doc(adminDb, 'users/bob'), {
        paidCredits: 100,
        subscriptionTier: 'pro',
    }));

    console.log('critical security rules assertions passed');
} finally {
    await testEnv.cleanup();
}
