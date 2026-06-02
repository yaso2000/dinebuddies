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

const env = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
        rules: fs.readFileSync('storage.rules', 'utf8'),
    },
});

try {
    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/alice'), { role: 'user', email: 'alice@example.com' });
        await setDoc(doc(db, 'users/bob'), { role: 'user', email: 'bob@example.com' });
        await setDoc(doc(db, 'users/biz-free'), {
            role: 'business',
            subscriptionTier: 'free',
            offerCredits: 0,
        });
        await setDoc(doc(db, 'users/biz-pro'), {
            role: 'business',
            subscriptionTier: 'professional',
            offerCredits: 1,
        });
        await setDoc(doc(db, 'private_invitations/inv1'), {
            authorId: 'alice',
            invitedFriends: ['bob'],
            status: 'draft',
            rsvps: { bob: 'pending' },
        });
        await setDoc(doc(db, 'conversations/dm1'), {
            participants: ['alice', 'bob'],
            lastMessage: 'hello',
        });
    });

    const alice = env.authenticatedContext('alice');
    const aliceDb = alice.firestore();
    const freeBiz = env.authenticatedContext('biz-free').firestore();
    const proBiz = env.authenticatedContext('biz-pro').firestore();
    const anonDb = env.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(aliceDb, 'users/alice-admin'), {
        role: 'admin',
        email: 'alice-admin@example.com',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        subscriptionTier: 'elite',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        paidCredits: 999,
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
        display_name: 'Alice Example',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'private_invitations/inv1'), {
        status: 'published',
        publishedAt: new Date(),
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'private_invitations/inv1'), {
        title: 'Draft dinner',
    }));

    await assertFails(setDoc(doc(freeBiz, 'offers/free-offer'), {
        partnerId: 'biz-free',
        status: 'active',
    }));

    await assertSucceeds(setDoc(doc(proBiz, 'offers/pro-offer'), {
        partnerId: 'biz-pro',
        status: 'active',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'conversations/dm1'), {
        participants: ['alice', 'bob', 'eve'],
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'conversations/dm1'), {
        participants: ['alice', 'bob'],
        lastMessage: 'safe metadata update',
    }));

    await assertFails(setDoc(doc(anonDb, 'partner_notifications/spoofed'), {
        type: 'business_feedback',
        restaurantId: 'biz-free',
        senderId: 'guest',
    }));

    const anonStorage = env.unauthenticatedContext().storage();
    await assertFails(uploadString(
        ref(anonStorage, 'feedback_media/biz-free/proof.jpg'),
        'fake-image',
        'raw',
        { contentType: 'image/jpeg' },
    ));

    const aliceStorage = alice.storage();
    await assertSucceeds(uploadString(
        ref(aliceStorage, 'feedback_media/biz-free/proof.jpg'),
        'fake-image',
        'raw',
        { contentType: 'image/jpeg' },
    ));

    console.log('security rules regression assertions passed');
} finally {
    await env.cleanup();
}

assert.ok(true);
