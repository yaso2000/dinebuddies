import fs from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';

const projectId = `dinebuddies-critical-${Date.now()}`;

const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
        rules: fs.readFileSync('storage.rules', 'utf8'),
    },
});

try {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const aliceDb = alice.firestore();

    await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        email: 'alice@example.com',
        display_name: 'Alice',
        created_time: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        paidCredits: 999999,
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        subscriptionTier: 'elite',
        weeklyPrivateQuota: -1,
    }));
    await assertFails(setDoc(doc(aliceDb, 'users/attacker'), {
        uid: 'attacker',
        role: 'admin',
        email: 'attacker@example.com',
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'private_invitations/inv1'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: ['bob'],
        rsvps: {},
        status: 'draft',
        title: 'Dinner',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'private_invitations/inv1'), {
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    const business = testEnv.authenticatedContext('business');
    const businessDb = business.firestore();
    await assertSucceeds(setDoc(doc(businessDb, 'users/business'), {
        uid: 'business',
        role: 'partner',
        accountType: 'business',
        email: 'biz@example.com',
        display_name: 'Cafe',
        businessInfo: { businessName: 'Cafe' },
    }));
    await assertFails(addDoc(collection(businessDb, 'offers'), {
        partnerId: 'business',
        title: 'Free bypass attempt',
    }));

    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users/eliteBiz'), {
            uid: 'eliteBiz',
            role: 'partner',
            accountType: 'business',
            subscriptionTier: 'elite',
            email: 'elite@example.com',
            businessInfo: { businessName: 'Elite Cafe' },
        });
    });
    const elite = testEnv.authenticatedContext('eliteBiz');
    await assertSucceeds(addDoc(collection(elite.firestore(), 'offers'), {
        partnerId: 'eliteBiz',
        title: 'Legitimate paid offer',
    }));

    const unauth = testEnv.unauthenticatedContext();
    await assertFails(addDoc(collection(unauth.firestore(), 'partner_notifications'), {
        restaurantId: 'business',
        type: 'business_feedback',
        senderId: 'guest',
        title: 'spam',
    }));
    await assertSucceeds(addDoc(collection(aliceDb, 'partner_notifications'), {
        restaurantId: 'business',
        type: 'business_feedback',
        senderId: 'alice',
        title: 'feedback',
    }));

    await assertFails(uploadBytes(
        storageRef(unauth.storage(), 'feedback_media/business/evidence.png'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/png' },
    ));
    await assertSucceeds(uploadBytes(
        storageRef(alice.storage(), 'feedback_media/business/evidence.png'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/png' },
    ));

    await assertSucceeds(deleteDoc(doc(aliceDb, 'users/alice')));

    console.log('critical Firestore/Storage rules assertions passed');
} finally {
    await testEnv.cleanup();
}
