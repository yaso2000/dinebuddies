import assert from 'node:assert/strict';
import fs from 'node:fs';
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
import {
    ref,
    uploadString,
} from 'firebase/storage';

const projectId = `dinebuddies-security-${Date.now()}`;

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
    await testEnv.clearFirestore();
    await testEnv.clearStorage();

    const alice = testEnv.authenticatedContext('alice');
    const bob = testEnv.authenticatedContext('bob');
    const charlie = testEnv.authenticatedContext('charlie');
    const anon = testEnv.unauthenticatedContext();

    const aliceDb = alice.firestore();
    const bobDb = bob.firestore();
    const charlieDb = charlie.firestore();

    await assertSucceeds(setDoc(doc(aliceDb, 'users', 'alice'), {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        email: 'alice@example.com',
    }));

    await assertFails(setDoc(doc(bobDb, 'users', 'bob'), {
        uid: 'bob',
        role: 'admin',
        display_name: 'Bob',
    }));

    await assertFails(setDoc(doc(charlieDb, 'users', 'charlie'), {
        uid: 'charlie',
        role: 'user',
        purchasedPrivateCredits: 999,
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users', 'alice'), {
        subscriptionTier: 'elite',
        paidCredits: 9999,
    }));

    await assertSucceeds(setDoc(doc(bobDb, 'users', 'bob'), {
        uid: 'bob',
        role: 'partner',
        accountType: 'business',
        subscriptionTier: 'free',
        display_name: 'Bob Business',
        businessInfo: {
            businessName: 'Bob Business',
            city: 'Sydney',
        },
        ownedCommunities: [],
    }));

    await assertFails(updateDoc(doc(bobDb, 'users', 'bob'), {
        'businessInfo.customLimits': { featuredPosts: 999 },
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'private_invitations', 'draft-ok'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: [],
        rsvps: {},
        status: 'draft',
        title: 'Draft',
    }));

    await assertFails(setDoc(doc(aliceDb, 'private_invitations', 'published-create'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: [],
        rsvps: {},
        status: 'published',
        publishedAt: new Date().toISOString(),
        title: 'Published without charge',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'private_invitations', 'draft-ok'), {
        status: 'published',
        publishedAt: new Date().toISOString(),
    }));

    await assertFails(setDoc(doc(anon.firestore(), 'partner_notifications', 'anon-feedback'), {
        restaurantId: 'bob',
        type: 'business_feedback',
        senderId: 'guest',
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'partner_notifications', 'auth-feedback'), {
        restaurantId: 'bob',
        type: 'business_feedback',
        senderId: 'alice',
    }));

    await assertFails(uploadString(
        ref(anon.storage(), 'feedback_media/bob/proof.png'),
        'not really an image',
        'raw',
        { contentType: 'image/png' },
    ));

    await assertSucceeds(uploadString(
        ref(alice.storage(), 'feedback_media/bob/proof.png'),
        'not really an image',
        'raw',
        { contentType: 'image/png' },
    ));

    assert.ok(true);
    console.log('security-rules-tests: ok');
} finally {
    await testEnv.cleanup();
}
